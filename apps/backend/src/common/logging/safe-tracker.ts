import { safeErrorSummary } from './safe-error';

// E-admin-platform-8: ce ajunge in trackerul de erori (aceeasi politica allowlist ca safe-error):
// tipul exceptiei + safeErrorSummary ca valoare, cadrele (fisier, functie, linie, coloana) fara
// cod sursa si fara variabile. Nimic din request, user, breadcrumbs, extra, server_name, modules, message.
const CONTEXT_KEYS = new Set(['runtime', 'os', 'trace']);
const TAG_KEYS = new Set(['traceId', 'route', 'test', 'slot', 'mode']);
const FRAME_KEYS = new Set(['filename', 'function', 'lineno', 'colno', 'in_app']);

function pick(source: Record<string, any>, keys: Set<string>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(source)) {
    if (keys.has(key)) out[key] = value;
  }
  return out;
}

export function scrubServerEvent<E extends Record<string, any>>(event: E, original?: unknown): E {
  const target = event as Record<string, any>;
  for (const key of ['request', 'user', 'breadcrumbs', 'extra', 'server_name', 'modules', 'message', 'logentry']) {
    delete target[key];
  }
  if (target.contexts && typeof target.contexts === 'object') {
    target.contexts = pick(target.contexts, CONTEXT_KEYS);
  }
  if (target.tags && typeof target.tags === 'object') {
    target.tags = pick(target.tags, TAG_KEYS);
  }
  const values: unknown = target.exception?.values;
  if (Array.isArray(values)) {
    values.forEach((entry: Record<string, any>, index) => {
      // ultima intrare = exceptia exterioara (cea aruncata); cauzele inlantuite raman doar cu tipul
      entry.value = index === values.length - 1 ? safeErrorSummary(original) : undefined;
      const frames: unknown = entry.stacktrace?.frames;
      if (Array.isArray(frames)) {
        entry.stacktrace.frames = frames.map((frame: Record<string, any>) => {
          const kept = pick(frame, FRAME_KEYS);
          // fara module-metadata SDK-ul marcheaza si node_modules ca in_app
          if (typeof kept.filename === 'string' && /node_modules|^node:/.test(kept.filename)) kept.in_app = false;
          return kept;
        });
      }
    });
  }
  return event;
}
