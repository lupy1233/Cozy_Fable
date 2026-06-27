import { ApiError } from '@/lib/api';

// Invarianta 3.10: frontend mapeaza CODURILE pe mesaje localizate;
// `message` din raspuns e doar fallback.
export function apiErrorKey(err: unknown): { key: string; fallback: string } {
  if (err instanceof ApiError) {
    return { key: `apiErrors.${err.code}`, fallback: err.message };
  }
  return { key: 'apiErrors.INTERNAL_ERROR', fallback: 'Unexpected error' };
}
