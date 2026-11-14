// f3: semnal global „sesiune pierduta”. Il emit api.ts (reimprospatarea sesiunii a esuat, sau
// cererea reluata dupa reimprospatare primeste tot 401) si use-socket.ts (auth_expired urmat de
// reimprospatare esuata). Un singur ascultator, montat in providers.tsx, goleste datele contului
// si duce omul la login (session-lost-listener).
import { isSafeRedirect } from './safe-redirect';

export const SESSION_LOST_EVENT = 'cozy:session-lost';

// cheia „cine sunt eu” (useMe); aici ca ascultatorul sa nu traga use-auth cu dependintele lui
export const AUTH_QUERY_KEY = ['auth', 'me'] as const;

export type SessionLostDetail = {
  source: 'api' | 'socket';
  // calea API care a primit 401 (doar pentru source = 'api')
  path?: string;
};

// Ascultatorul intoarce `false` cand a ignorat semnalul (omul nu avea sesiune / nimic de facut).
// Orice alt rezultat = a actionat.
type Handler = (detail: SessionLostDetail) => boolean | void;
type Envelope = { detail: SessionLostDetail; acted: boolean };

// Mai multe cereri simultane care pica impreuna (sau REST + socket) = o singura actiune.
// Fereastra porneste DOAR dupa ce un ascultator a actionat (review M1/m4): un semnal ignorat
// (de ex. sosit inaintea lui /auth/me, cand „cine sunt eu” nu era inca in cache, sau de pe o
// pagina publica) nu inghite semnalul urmator, care poate duce la login.
const DEDUPE_MS = 5_000;
let lastActedAt = -Infinity;

export function signalSessionLost(detail: SessionLostDetail): void {
  if (typeof window === 'undefined') return;
  if (Date.now() - lastActedAt < DEDUPE_MS) return;
  const envelope: Envelope = { detail, acted: false };
  window.dispatchEvent(new CustomEvent<Envelope>(SESSION_LOST_EVENT, { detail: envelope }));
  if (envelope.acted) lastActedAt = Date.now();
}

export function onSessionLost(handler: Handler): () => void {
  const listener = (e: Event) => {
    const envelope = (e as CustomEvent<Envelope>).detail;
    if (handler(envelope?.detail ?? { source: 'api' }) !== false && envelope) envelope.acted = true;
  };
  window.addEventListener(SESSION_LOST_EVENT, listener);
  return () => window.removeEventListener(SESSION_LOST_EVENT, listener);
}

// A existat in aceasta pagina o sesiune pierduta pe care ascultatorul a tratat-o? (garda
// paginilor pune atunci si reason=expired, ca sa nu stearga mesajul — review M2.)
export function wasSessionLost(): boolean {
  return lastActedAt > -Infinity;
}

// la login / logout: o garda declansata mai tarziu nu mai pretinde ca sesiunea a expirat
export function clearSessionLost(): void {
  lastActedAt = -Infinity;
}

// doar pentru teste
export function resetSessionLostForTests(): void {
  clearSessionLost();
}

// Paginile care cer cont = cele cu garda `me.isError → /login` (dashboard, cereri, firma,
// piata, admin, colectiile de inspiratie, schimbarea parolei). Restul (prima pagina,
// inspiratie, firme, studio, pagini legale, cererea noua completata ca vizitator,
// paginile de autentificare) sunt publice: acolo doar se goleste starea de cont.
const ACCOUNT_PREFIXES = [
  '/dashboard',
  '/requests',
  '/company',
  '/marketplace',
  '/admin',
  '/inspiration/boards',
  '/change-password',
] as const;
const PUBLIC_EXCEPTIONS = ['/requests/new'] as const;

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

// pathname = calea FARA prefixul de limba (usePathname din @/i18n/routing)
export function isAccountPath(pathname: string): boolean {
  if (PUBLIC_EXCEPTIONS.some((p) => underPrefix(pathname, p))) return false;
  return ACCOUNT_PREFIXES.some((p) => underPrefix(pathname, p));
}

// /login?redirect=<pagina curenta>[&reason=expired]. Adresa de intoarcere trece prin aceeasi
// verificare ca la login (safe-redirect); una nesigura nu se propaga.
export function loginTarget(pathname: string, search = '', opts: { expired?: boolean } = {}): string {
  const back = `${pathname}${search && search !== '?' ? (search.startsWith('?') ? search : `?${search}`) : ''}`;
  const params = new URLSearchParams();
  if (isSafeRedirect(back)) params.set('redirect', back);
  if (opts.expired) params.set('reason', 'expired');
  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}

// Unde duce semnalul: null = fara redirect (pagina publica sau de autentificare).
export function sessionLostTarget(pathname: string, search = ''): string | null {
  if (!isAccountPath(pathname)) return null;
  return loginTarget(pathname, search, { expired: true });
}
