// Constante auth — TTL-uri (presupunere Sprint 2, nespecificate in docs)
export const ACCESS_TOKEN_TTL_SEC = 15 * 60; // 15 min
export const REFRESH_TOKEN_TTL_SEC = 7 * 24 * 60 * 60; // 7 zile
export const ROTATION_GRACE_MS = 30_000; // grace 30s multi-tab (invarianta 3.13)
export const EMAIL_VERIFY_TTL_SEC = 24 * 60 * 60; // 24h, token in Redis
export const PASSWORD_RESET_TTL_SEC = 60 * 60; // 60 min, token in Redis (L0-A)

// E-admin-platform-5: blocare temporara per email dupa parole gresite (recomandarea din
// docs/17-audit-prelansare-2026-08-19 si audit 08-security-backend: "10 esecuri -> 15 min").
// Constante de securitate, nu reguli de business; pragul ADMIN e decizie PO deschisa.
export const LOGIN_FAILURE_WINDOW_SEC = 15 * 60; // fereastra de numarare a esecurilor
export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_MAX_FAILURES_ADMIN = 5;
export const LOGIN_COOLDOWN_SEC = 15 * 60; // pauza dupa atingerea pragului

export const ACCESS_COOKIE = 'mm_access';
export const REFRESH_COOKIE = 'mm_refresh';
// indiciu de UI (rolul) pentru headerul randat pe server; NU e material de sesiune
// si NU se foloseste pentru autorizare (backendul ramane singura autoritate)
export const SESSION_HINT_COOKIE = 'mm_session';
// refresh cookie limitat la rutele auth
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export interface AccessTokenPayload {
  sub: string; // user id
  role: 'CLIENT' | 'COMPANY_USER' | 'ADMIN';
  email: string;
  sid?: string; // familia sesiunii; tokenurile vechi se reinnoiesc prin refresh
  exp?: number;
}
