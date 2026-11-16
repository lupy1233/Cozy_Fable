'use client';

import { useSyncExternalStore } from 'react';

// Interogare media citita in React (etapa 8, problema 40). Folosita acolo unde un element
// trebuie sa existe O SINGURA DATA in pagina, dar in locuri diferite dupa latime (butonul
// "Publica" in bara lipita pe telefon / in cardul de publicare pe desktop; tabelul de comparare
// vs. cardurile pe rubrica). Cu clase CSS (hidden / lg:flex) ar fi doua butoane cu acelasi nume
// in DOM. Pe server si la hidratare intoarce `serverValue`, apoi valoarea reala.
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list?.addEventListener?.('change', onChange);
      return () => list?.removeEventListener?.('change', onChange);
    },
    () =>
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(query)?.matches === true
        : serverValue,
    () => serverValue,
  );
}

// Pragurile Tailwind (sm = 640 px, lg = 1024 px): "sub" = strict mai ingust decat pragul.
export const BELOW_SM = '(max-width: 639.98px)';
export const BELOW_LG = '(max-width: 1023.98px)';
