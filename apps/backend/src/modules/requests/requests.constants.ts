// Reguli editare cerere (docs/03): 3 editari pre-claim, 1 post-claim.
export const MAX_PRE_CLAIM_EDITS = 3;
export const MAX_POST_CLAIM_EDITS = 1;

// Expirare cerere publicata: 5 zile lucratoare fara claim.
export const EXPIRATION_WORKING_DAYS = 5;

// Tip entitate pentru atasamente (tabel generic attachments).
export const ENTITY_TYPE_REQUEST = 'REQUEST';

// Scrierile pe cerere (draft/publish/edit/repost) inlantuie 10-15 query-uri intr-o
// singura tranzactie interactiva. Peste latenta de retea aplicatie-Postgres (regiuni
// diferite = ~150 ms per round-trip) plafonul implicit Prisma de 5 s cadea cu P2028
// la publicare (prod 2026-09-17); 20 s acopera si un lock scurt pe cerere.
// E-admin-platform-54: plafonul de 20 s traieste acum in TX_PROFILES.write
// (infra/prisma/tx-options.ts); scrierile pe cerere trec prin runTx(this.prisma, 'write', ...).
