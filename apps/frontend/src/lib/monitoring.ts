import * as Sentry from '@sentry/browser';

// E-admin-platform-8: tracker de erori in browser (protocol Sentry: Sentry EU sau GlitchTip,
// decizie PO). Copt la build; gol = dezactivat, nicio cerere spre /monitoring.
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || '';
// E-admin-platform-56: SHA-ul release-ului leaga bundle-ul public de sursa exacta; fara DSN nu
// e folosit, deci ramane 'unknown' si nu ajunge in bundle-ul clientului.
export const RELEASE = SENTRY_DSN ? process.env.NEXT_PUBLIC_RELEASE_SHA?.trim() || 'unknown' : 'unknown';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_SEGMENT = /^[A-Za-z0-9_-]{16,}$/;
const ALLOWED_TAGS = new Set(['route', 'digest', 'boundary', 'release']);
const MAX_TEXT = 300;

// Calea fara query si fara segmente identificabile (id-uri, tokenuri de draft/reset).
export function maskPath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] || '/';
  return path
    .split('/')
    .map((segment) => (UUID.test(segment) ? ':id' : TOKEN_SEGMENT.test(segment) ? ':token' : segment))
    .join('/');
}

// Mesaje de eroare fara emailuri, id-uri, tokenuri, numere lungi (telefon, CNP) sau query-uri.
export function maskText(input: string): string {
  return input
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi, '$1')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]')
    .replace(/[A-Za-z0-9_-]{24,}/g, '[token]')
    .replace(/\d{4,}/g, '[n]')
    .slice(0, MAX_TEXT);
}

type LooseEvent = Record<string, any>;

export function scrubClientEvent<E extends LooseEvent>(event: E): E {
  const target = event as LooseEvent;
  if (target.request && typeof target.request === 'object') {
    let url: string | undefined;
    try {
      const parsed = new URL(String(target.request.url));
      url = `${parsed.origin}${maskPath(parsed.pathname)}`;
    } catch {
      url = undefined;
    }
    target.request = url ? { url } : {};
  }
  for (const key of ['user', 'breadcrumbs', 'extra', 'message', 'logentry']) delete target[key];
  if (target.tags && typeof target.tags === 'object') {
    target.tags = Object.fromEntries(Object.entries(target.tags).filter(([key]) => ALLOWED_TAGS.has(key)));
  }
  const values: unknown = target.exception?.values;
  if (Array.isArray(values)) {
    for (const entry of values as LooseEvent[]) {
      if (typeof entry.value === 'string') entry.value = maskText(entry.value);
      const frames: unknown = entry.stacktrace?.frames;
      if (Array.isArray(frames)) {
        for (const frame of frames as LooseEvent[]) {
          delete frame.vars;
          delete frame.pre_context;
          delete frame.context_line;
          delete frame.post_context;
          if (typeof frame.filename === 'string') frame.filename = maskText(frame.filename.split(/[?#]/)[0]);
          if (typeof frame.abs_path === 'string') frame.abs_path = maskText(frame.abs_path.split(/[?#]/)[0]);
        }
      }
    }
  }
  return event;
}

export function reportClientError(error: Error & { digest?: string }, boundary: 'locale' | 'global'): void {
  if (!SENTRY_DSN) return;
  try {
    Sentry.withScope((scope) => {
      scope.setTags({
        route: maskPath(typeof location === 'undefined' ? '/' : location.pathname),
        digest: error.digest ?? 'none',
        boundary,
      });
      Sentry.captureException(error);
    });
  } catch {
    // raportarea nu are voie sa strice ecranul de eroare
  }
}
