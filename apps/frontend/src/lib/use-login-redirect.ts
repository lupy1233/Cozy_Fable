'use client';

import { useCallback } from 'react';
import { useRouter } from '@/i18n/routing';
import { useSessionHint } from './session-hint-context';
import { loginTarget, wasSessionLost } from './session-lost';

// prefixul de limba, ca in middleware.ts (LOCALE_PATH)
const LOCALE_PREFIX = /^\/(ro|en)(?=\/|$)/;

// Calea curenta FARA prefixul de limba + query-ul, citite in momentul redirectului.
export function currentAppLocation(): { pathname: string; search: string } {
  if (typeof window === 'undefined') return { pathname: '/', search: '' };
  const pathname = window.location.pathname.replace(LOCALE_PREFIX, '') || '/';
  return { pathname, search: window.location.search };
}

// f3 (review M2): garda comuna a paginilor cu cont. In loc de `router.replace('/login')` gol
// (care ar suprascrie redirectul ascultatorului si ar sterge mesajul + intoarcerea), duce la
// /login?redirect=<pagina curenta>, cu reason=expired cand omul chiar avea o sesiune:
// ascultatorul a tratat o sesiune pierduta, sau pagina a pornit cu indiciul de sesiune
// (cookie mm_session). Vizitatorul fara cont ajunge pe login fara mesajul „sesiunea a expirat”.
export function useLoginRedirect(): () => void {
  const router = useRouter();
  const hint = useSessionHint();
  return useCallback(() => {
    const { pathname, search } = currentAppLocation();
    router.replace(loginTarget(pathname, search, { expired: hint !== null || wasSessionLost() }));
  }, [router, hint]);
}
