// Indiciu de sesiune (cookie mm_session, httpOnly, setat de backend la login/refresh):
// contine DOAR rolul si serveste exclusiv la alegerea headerului randat pe server.
// NU e folosit pentru autorizare — backendul ramane singura autoritate.
export const SESSION_HINT_COOKIE = 'mm_session';

export type SessionRole = 'CLIENT' | 'COMPANY_USER' | 'ADMIN';

const ROLES: readonly SessionRole[] = ['CLIENT', 'COMPANY_USER', 'ADMIN'];

// whitelist exacta; orice altceva → null
export function parseSessionHint(raw: string | undefined | null): SessionRole | null {
  return ROLES.find((r) => r === raw) ?? null;
}
