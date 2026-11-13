// Adresa de intoarcere dupa login / inregistrare / confirmarea emailului (parametrul ?redirect=).
// Se accepta DOAR cai interne care incep cu un singur „/”. In partea de CALE (inainte de ? / #)
// sunt respinse: „//” si „\” oriunde, segmentele „.” si „..”, inclusiv in forma codata
// (%2e%2e, %5c, %2f%2f — decodata repetat). Peste tot: scheme, caractere de control. → fallback.
// Query-ul si fragmentul raman libere (ex. „/requests/abc?x=1&y=//z” e acceptat).

export const DEFAULT_REDIRECT = '/dashboard';
const MAX_LENGTH = 512;
const MAX_DECODE_PASSES = 3;
const BASE = 'http://cozy.invalid';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function unsafePath(path: string): boolean {
  if (path.includes('//') || path.includes('\\') || CONTROL_CHARS.test(path)) return true;
  return path.split('/').some((segment) => segment === '.' || segment === '..');
}

export function isSafeRedirect(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_LENGTH) return false;
  if (value[0] !== '/' || CONTROL_CHARS.test(value)) return false;

  // partea de cale: pana la primul ? sau #
  const end = value.search(/[?#]/);
  let path = end === -1 ? value : value.slice(0, end);
  // forma bruta si formele decodate (o dubla codare nu trece de verificare)
  for (let pass = 0; pass <= MAX_DECODE_PASSES; pass++) {
    if (unsafePath(path)) return false;
    let decoded: string;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      return false; // secventa % invalida
    }
    if (decoded === path) break;
    if (pass === MAX_DECODE_PASSES) return false; // codare prea adanca: refuz
    path = decoded;
  }

  try {
    return new URL(value, BASE).origin === BASE;
  } catch {
    return false;
  }
}

export function safeRedirect(value: string | null | undefined, fallback: string = DEFAULT_REDIRECT): string {
  return isSafeRedirect(value) ? value : fallback;
}
