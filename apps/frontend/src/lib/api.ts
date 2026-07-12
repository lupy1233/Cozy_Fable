import type { ApiErrorBody, ErrorCode } from '@marketplace/shared';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function rawFetch(path: string, init?: RequestInit): Promise<Response> {
  // headers se compun EXPLICIT: init venea dupa `headers` si il suprascria
  // integral cand apelul avea headere proprii (Idempotency-Key) → corpul pleca
  // fara Content-Type si DTO-ul ajungea gol pe server (bug claim/oferte, F7)
  const { headers, ...rest } = init ?? {};
  return fetch(`${BASE_URL}${path}`, {
    credentials: 'include', // cookies httpOnly — niciodata JWT in localStorage
    ...rest,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

// Refresh dedupe — un singur refresh in zbor pentru toate requesturile concurente (grace 30s backend)
let refreshInFlight: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  refreshInFlight ??= rawFetch('/auth/refresh', { method: 'POST' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return new ApiError(body.error.code, res.status, body.error.message, body.error.details);
  } catch {
    return new ApiError('INTERNAL_ERROR', res.status, res.statusText);
  }
}

const NO_RETRY_PATHS = ['/auth/login', '/auth/refresh', '/auth/register', '/auth/logout'];

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await rawFetch(path, init);

  // 401 → o singura incercare de refresh + retry (rotation invarianta 3.13)
  if (res.status === 401 && !NO_RETRY_PATHS.includes(path)) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await rawFetch(path, init);
  }

  if (!res.ok) throw await parseError(res);
  // endpoint-urile void (salvare pin, redenumire/stergere colectie) raspund cu
  // body gol — res.json() ar arunca si mutatia ar parea esuata desi a reusit
  // (bug PO: "Salvat" nu aparea pana la refresh)
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
