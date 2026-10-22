// E-admin-platform-8: tunel same-origin pentru trackerul de erori din browser. Accepta DOAR
// envelope-uri pentru DSN-ul configurat (nu e proxy deschis), limita de marime si de rata,
// si NU transmite IP-ul clientului / X-Forwarded-For catre furnizor.
import { allowMonitoringRequest as allowRequest } from '@/lib/monitoring-rate-limit';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 256 * 1024;

type Target = { host: string; projectId: string; upstream: string };

function configuredTarget(): Target | null {
  const raw = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!raw) return null;
  try {
    const dsn = new URL(raw);
    const segments = dsn.pathname.split('/').filter(Boolean);
    const projectId = segments.pop();
    if (!projectId || !/^\d+$/.test(projectId)) return null;
    const prefix = segments.length ? `/${segments.join('/')}` : '';
    return { host: dsn.host, projectId, upstream: `${dsn.protocol}//${dsn.host}${prefix}/api/${projectId}/envelope/` };
  } catch {
    return null;
  }
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

export async function POST(req: Request): Promise<Response> {
  const target = configuredTarget();
  if (!target) return new Response(null, { status: 404 });

  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BYTES) return new Response(null, { status: 413 });
  // citire limitata: o cerere chunked fara Content-Length nu poate umple memoria
  const body = await readLimited(req, MAX_BYTES);
  if (body === null) return new Response(null, { status: 413 });

  const firstLine = body.split('\n', 1)[0] ?? '';
  let headerDsn: URL;
  try {
    const header = JSON.parse(firstLine) as { dsn?: unknown };
    if (typeof header.dsn !== 'string') return new Response(null, { status: 400 });
    headerDsn = new URL(header.dsn);
  } catch {
    return new Response(null, { status: 400 });
  }
  const headerProject = headerDsn.pathname.split('/').filter(Boolean).pop();
  if (headerDsn.host !== target.host || headerProject !== target.projectId) {
    return new Response(null, { status: 400 });
  }

  if (!allowRequest(Date.now())) return new Response(null, { status: 429 });

  try {
    const upstream = await fetch(target.upstream, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      signal: AbortSignal.timeout(5000),
    });
    return new Response(null, { status: upstream.ok ? 200 : 502 });
  } catch {
    return new Response(null, { status: 502 });
  }
}
