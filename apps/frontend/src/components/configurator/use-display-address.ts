'use client';

import { formatDisplayAddress, type DisplayAddressInput } from '@marketplace/shared';
import { useLocale } from 'next-intl';
import { useCallback } from 'react';

// b12: adresa pentru afisare (Sumar, pagina cererii, firma), fara dubluri; numele tarii
// (doar cand nu e Romania) in limba aplicatiei, nu a browserului.
export function useDisplayAddress(): (input: DisplayAddressInput) => string {
  const locale = useLocale();
  return useCallback(
    (input: DisplayAddressInput) => {
      let names: Intl.DisplayNames | null = null;
      try {
        names = new Intl.DisplayNames([locale], { type: 'region' });
      } catch {
        names = null;
      }
      return formatDisplayAddress(input, { countryName: (iso) => names?.of(iso) });
    },
    [locale],
  );
}
