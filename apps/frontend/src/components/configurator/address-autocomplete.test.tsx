import { act, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';

// b12: Google Places simulat — alegerea unei sugestii nu pierde blocul / apartamentul tastate
type Listener = () => void;
function installPlaces(place: unknown) {
  const state: { listener: Listener | null } = { listener: null };
  window.google = {
    maps: {
      places: {
        Autocomplete: class {
          addListener(_name: string, fn: Listener) { state.listener = fn; }
          getPlace() { return place; }
          setComponentRestrictions() {}
        },
      },
      Geocoder: class { geocode() {} },
    },
  };
  return state;
}

async function load() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'test-key');
  return import('./address-autocomplete');
}

afterEach(() => {
  vi.unstubAllEnvs();
  delete window.google;
});

describe('extractAddressDetails (b12)', () => {
  it('keeps block / entrance / apartment fragments, not street names', async () => {
    const { extractAddressDetails } = await load();
    expect(extractAddressDetails('Str. Lalelelor 10, bl. A2, sc. 1, ap. 14')).toBe('bl. A2, sc. 1, ap. 14');
    expect(extractAddressDetails('Strada Etajului 3')).toBe('');
    expect(extractAddressDetails('Str. Apusului 5 bloc C3 ap 7')).toBe('bloc C3, ap 7');
  });

  // m10 (revizuire): formele lipite se recunosc, cuvintele obisnuite nu
  it('recognises glued forms (bl12, blA2, sc2, ap3) and letters with diacritics', async () => {
    const { extractAddressDetails } = await load();
    expect(extractAddressDetails('Str. Florilor 5 bl12 sc2 ap3')).toBe('bl12, sc2, ap3');
    expect(extractAddressDetails('Str. Florilor 5 blA2 et4')).toBe('blA2, et4');
    expect(extractAddressDetails('Str. Florilor 5 bl. Ă2')).toBe('bl. Ă2');
  });

  it('leaves ordinary words alone (Aprodul, Blaj, Școlii, Scării, Apeductului)', async () => {
    const { extractAddressDetails } = await load();
    expect(extractAddressDetails('Strada Aprodul Purice 3, Blaj')).toBe('');
    expect(extractAddressDetails('Strada Școlii 7')).toBe('');
    expect(extractAddressDetails('Strada Scării 2, Strada Apeductului 9, Strada Etajului 1')).toBe('');
  });
});

describe('AddressAutocomplete — choosing a suggestion (b12)', () => {
  it('passes the typed apartment along with the suggestion parts', async () => {
    const places = installPlaces({
      address_components: [
        { long_name: 'Strada Fabricii', types: ['route'] },
        { long_name: '5', types: ['street_number'] },
        { long_name: 'București', types: ['locality'] },
      ],
      formatted_address: 'Strada Fabricii 5, București, Romania',
    });
    const { AddressAutocomplete } = await load();
    const onResolved = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <AddressAutocomplete defaultValue="" onText={() => {}} onResolved={onResolved} />
      </NextIntlClientProvider>,
    );
    const input = screen.getByRole('textbox', { name: en.Requests.field.street });
    fireEvent.change(input, { target: { value: 'Strada Fabricii 5 bl. A2 ap. 14' } });
    await vi.waitFor(() => expect(places.listener).not.toBeNull());
    // Google pune textul sugestiei in camp inainte de place_changed
    (input as HTMLInputElement).value = 'Strada Fabricii 5, București, Romania';
    act(() => places.listener!());
    expect(onResolved).toHaveBeenCalledWith({
      addressText: 'Strada Fabricii 5',
      county: 'București',
      city: 'București',
      addressDetails: 'bl. A2, ap. 14',
    });
  });
});
