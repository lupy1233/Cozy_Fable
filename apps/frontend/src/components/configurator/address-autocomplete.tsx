'use client';

import { MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

// Autocomplete de adresa cu Google Places — DOAR UI (completeaza campurile text).
// Geocodarea ramane pe server prin Nominatim (invarianta 3.8) — nicio schimbare.
// Fara NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, degradeaza la inputuri simple (dev).

declare global {
  interface Window {
    // API-ul Places e incarcat dinamic; tipurile complete nu sunt instalate
    google?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    __gmapsLoading?: Promise<void>;
  }
}

const PLACES_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

function loadPlaces(): Promise<void> {
  if (typeof window === 'undefined' || !PLACES_KEY) return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (!window.__gmapsLoading) {
    window.__gmapsLoading = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${PLACES_KEY}&libraries=places&language=ro&region=RO`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('places load failed'));
      document.head.appendChild(script);
    });
  }
  return window.__gmapsLoading;
}

export interface AddressParts {
  addressText: string;
  county: string;
  city: string;
}

type AddressComponent = { long_name: string; types: string[] };

// Google intoarce "Județul Ilfov" / "Comuna Chiajna" / "Oraș Voluntari" —
// pastram doar numele, consistent cu "București" (care vine fara prefix).
const cleanCounty = (raw: string) => raw.replace(/^jude[țt]ul\s+/i, '').trim();
const cleanCity = (raw: string) => raw.replace(/^(ora[șs]|comuna|municipiul|municipiu)\s+/i, '').trim();

function parseComponents(comps: AddressComponent[], fallbackText: string): AddressParts {
  const get = (type: string) => comps.find((c) => c.types.includes(type))?.long_name ?? '';
  const street = [get('route'), get('street_number')].filter(Boolean).join(' ');
  return {
    addressText: street || fallbackText,
    // Bucuresti nu are judet in raspuns → folosim localitatea
    county: cleanCounty(get('administrative_area_level_1') || get('locality')),
    city: cleanCity(get('locality') || get('administrative_area_level_2')),
  };
}

export function AddressAutocomplete({
  defaultValue,
  error,
  country = 'RO',
  onText,
  onResolved,
}: {
  defaultValue: string;
  error?: string;
  // ISO2 — restrictioneaza sugestiile la tara aleasa (F5, item 19: livram si international)
  country?: string;
  // tastare manuala: actualizeaza doar addressText (nu atinge judet/oras)
  onText: (text: string) => void;
  // apelat cand utilizatorul alege o sugestie; campurile county/city se completeaza
  onResolved: (parts: AddressParts) => void;
}) {
  const t = useTranslations('Requests');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const attached = useRef(false);
  // instanta Places, ca sa putem schimba restrictia de tara fara reatasare
  const autocompleteRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  // tara curenta, citita din listener (closure-ul e atasat o singura data)
  const countryRef = useRef(country);

  useEffect(() => {
    countryRef.current = country;
    if (!PLACES_KEY || !attached.current || !autocompleteRef.current) return;
    autocompleteRef.current.setComponentRestrictions({ country: country.toLowerCase() });
  }, [country]);

  useEffect(() => {
    if (!PLACES_KEY || attached.current) return;
    let cancelled = false;
    loadPlaces()
      .then(() => {
        if (cancelled || attached.current || !inputRef.current || !window.google) return;
        attached.current = true;
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: country.toLowerCase() },
          fields: ['address_components', 'formatted_address'],
          types: ['address'],
        });
        autocompleteRef.current = autocomplete;
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const typed = inputRef.current?.value ?? '';
          const comps: AddressComponent[] = place?.address_components ?? [];
          if (comps.length > 0) {
            onResolved(parseComponents(comps, place?.formatted_address || typed));
            return;
          }
          // Enter apasat fara o sugestie evidentiata: place-ul vine doar cu
          // "name", fara componente → judetul/orasul ar ramane goale si pasul
          // s-ar bloca la validare (bug PO r3, raportat pe adrese din Ilfov).
          // Geocodam textul tastat si completam campurile din primul rezultat.
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode(
            {
              address: typed,
              componentRestrictions: { country: countryRef.current.toLowerCase() },
            },
            (results: { address_components?: AddressComponent[]; formatted_address?: string }[] | null, status: string) => {
              const first = results?.[0];
              if (status === 'OK' && first?.address_components?.length) {
                onResolved(parseComponents(first.address_components, first.formatted_address || typed));
              } else {
                onResolved({ addressText: typed, county: '', city: '' });
              }
            },
          );
        });
      })
      .catch(() => {
        // fara Places, inputul ramane text simplu — nicio actiune
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Field label={t('field.addressText')} error={error}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          defaultValue={defaultValue}
          onChange={(e) => onText(e.target.value)}
          className="pl-9"
          placeholder={PLACES_KEY ? t('addressSearchPlaceholder') : undefined}
          autoComplete="off"
        />
      </div>
    </Field>
  );
}
