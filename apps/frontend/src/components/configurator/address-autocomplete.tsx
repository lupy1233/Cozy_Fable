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

  useEffect(() => {
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
          const comps: { long_name: string; types: string[] }[] = place?.address_components ?? [];
          const get = (type: string) => comps.find((c) => c.types.includes(type))?.long_name ?? '';
          const street = [get('route'), get('street_number')].filter(Boolean).join(' ');
          const parts: AddressParts = {
            addressText: street || place?.formatted_address || inputRef.current?.value || '',
            // Bucuresti nu are judet in raspuns → folosim localitatea
            county: get('administrative_area_level_1') || get('locality'),
            city: get('locality') || get('administrative_area_level_2'),
          };
          onResolved(parts);
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
