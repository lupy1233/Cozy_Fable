// Constante auth — TTL-uri (presupunere Sprint 2, nespecificate in docs)
export const ACCESS_TOKEN_TTL_SEC = 15 * 60; // 15 min
export const REFRESH_TOKEN_TTL_SEC = 7 * 24 * 60 * 60; // 7 zile
export const ROTATION_GRACE_MS = 30_000; // grace 30s multi-tab (invarianta 3.13)
export const EMAIL_VERIFY_TTL_SEC = 24 * 60 * 60; // 24h, token in Redis
export const PASSWORD_RESET_TTL_SEC = 60 * 60; // 60 min, token in Redis (L0-A)

export const ACCESS_COOKIE = 'mm_access';
export const REFRESH_COOKIE = 'mm_refresh';
// refresh cookie limitat la rutele auth
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export interface AccessTokenPayload {
  sub: string; // user id
  role: 'CLIENT' | 'COMPANY_USER' | 'ADMIN';
  email: string;
}
