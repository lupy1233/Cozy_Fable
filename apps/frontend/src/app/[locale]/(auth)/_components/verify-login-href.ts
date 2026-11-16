import { safeRedirect } from '@/lib/safe-redirect';

const NEW_REQUEST_PATH = '/requests/new';

// b4 — linkul „Mergi la autentificare” de pe pagina de confirmare a emailului: intoarcerea
// din link (filtrata cu safeRedirect), altfel — pe acelasi dispozitiv — formularul cu
// ciorna nepublicata din browser; fara niciuna, /login simplu (→ Panou).
export function verifyLoginHref(returnTo: string | null, hasLocalDraft: boolean): string {
  const target = safeRedirect(returnTo, '') || (hasLocalDraft ? NEW_REQUEST_PATH : '');
  return target ? `/login?redirect=${encodeURIComponent(target)}` : '/login';
}
