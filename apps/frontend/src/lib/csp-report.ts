// E-admin-platform-56: colector same-origin pentru incalcarile CSP (report-uri + report-to).
// Scrie o singura linie console.warn per raport in logurile Railway: doar directiva, originea
// blocata si calea mascata a paginii. NICIODATA URL-uri complete, query-uri, mostre de script
// sau IP-uri. Raspunde mereu 204 (si la corp invalid/prea mare), fara furnizor extern.
import { maskPath } from '@/lib/monitoring';

const MAX_BYTES = 16 * 1024;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const MAX_DIRECTIVE = 64;

let windowStart = 0;
let windowCount = 0;

// doar pentru teste
export function resetCspReportRateLimit(): void {
  windowStart = 0;
  windowCount = 0;
}

function allowReport(now: number): boolean {
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  windowCount += 1;
  return windowCount <= MAX_PER_WINDOW;
}

async function readLimited(req: Request, limit: number): Promise<string | null> {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

type Violation = Record<string, unknown>;

// Formatul vechi {"csp-report": {...}} (report-uri) sau lista Reporting API (report-to).
function violationsOf(payload: unknown): Violation[] {
  if (Array.isArray(payload)) {
    return payload
      .filter((entry): entry is { type: string; body: Violation } =>
        Boolean(entry && typeof entry === 'object' && entry.type === 'csp-violation' && entry.body && typeof entry.body === 'object'),
      )
      .map((entry) => entry.body);
  }
  if (payload && typeof payload === 'object') {
    const legacy = (payload as Record<string, unknown>)['csp-report'];
    if (legacy && typeof legacy === 'object') return [legacy as Violation];
  }
  return [];
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function blockedOrigin(raw: string | undefined): string {
  if (!raw) return 'unknown';
  if (raw === 'inline' || raw === 'eval' || raw === 'wasm-eval' || raw === 'trusted-types-policy') return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === 'data:' || url.protocol === 'blob:') return url.protocol.slice(0, -1);
    return url.origin === 'null' ? url.protocol.slice(0, -1) : url.origin;
  } catch {
    // valori ca "self" sau scheme fara URL complet
    return /^[a-z-]{1,32}$/i.test(raw) ? raw : 'unknown';
  }
}

function pagePath(raw: string | undefined): string {
  if (!raw) return 'unknown';
  try {
    return maskPath(new URL(raw).pathname);
  } catch {
    return 'unknown';
  }
}

function summarize(violation: Violation) {
  const directive =
    text(violation['effective-directive']) ??
    text(violation.effectiveDirective) ??
    text(violation['violated-directive']) ??
    text(violation.violatedDirective) ??
    'unknown';
  return {
    evt: 'csp_violation',
    directive: directive.split(' ')[0].slice(0, MAX_DIRECTIVE),
    blocked: blockedOrigin(text(violation['blocked-uri']) ?? text(violation.blockedURL)),
    page: pagePath(text(violation['document-uri']) ?? text(violation.documentURL)),
  };
}

const ACCEPTED_TYPES = ['application/csp-report', 'application/reports+json', 'application/json'];

export async function handleCspReport(req: Request): Promise<Response> {
  const done = () => new Response(null, { status: 204 });
  try {
    const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!ACCEPTED_TYPES.includes(type)) return done();
    const declared = Number(req.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > MAX_BYTES) return done();
    const body = await readLimited(req, MAX_BYTES);
    if (!body) return done();
    const violations = violationsOf(JSON.parse(body));
    for (const violation of violations) {
      if (!allowReport(Date.now())) break;
      console.warn(JSON.stringify(summarize(violation)));
    }
  } catch {
    // corp invalid → ignorat
  }
  return done();
}
