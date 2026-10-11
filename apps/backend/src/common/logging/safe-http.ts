import { randomUUID } from 'crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requestTraceId(value: unknown): string {
  return typeof value === 'string' && UUID.test(value) ? value : randomUUID();
}

// Pino livreaza obiectul serializat si accesul non-enumerabil raw. URL-ul brut
// poate contine tokenul unui draft; antetele de raspuns pot contine Set-Cookie.
export function safeRequestLog(req: { id?: unknown; method?: string; raw?: { route?: { path?: unknown } } }) {
  return {
    id: typeof req.id === 'string' && UUID.test(req.id) ? req.id : undefined,
    method: typeof req.method === 'string' && /^[A-Z]{3,10}$/.test(req.method) ? req.method : undefined,
    route: typeof req.raw?.route?.path === 'string' ? req.raw.route.path : 'unmatched',
  };
}

export function safeResponseLog(res: { statusCode?: number }) {
  return { statusCode: res.statusCode };
}

// E-admin-platform-8: pino-http construieste logger-ul copil inainte de rutare (route = 'unmatched');
// customProps se recalculeaza in onResFinished, cand req.route exista deja.
// Obiectul gol la inceputul cererii evita o dubla legare a cheii.
export function routeProps(req: { route?: { path?: unknown } }): { routePattern?: string } {
  return typeof req.route?.path === 'string' ? { routePattern: req.route.path } : {};
}

// Sondele de health reusite nu se logheaza (zgomot la 10 s); esecurile lor raman vizibile.
export function healthAwareLogLevel(
  req: { url?: string },
  res: { statusCode?: number },
  err?: unknown,
): 'error' | 'warn' | 'info' | 'silent' {
  const status = res.statusCode ?? 0;
  if (err || status >= 500) return 'error';
  if (status >= 400) return 'warn';
  if (typeof req.url === 'string' && req.url.startsWith('/api/v1/health')) return 'silent';
  return 'info';
}
