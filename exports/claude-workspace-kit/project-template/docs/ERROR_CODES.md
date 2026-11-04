<!-- Source of truth: error-code catalogue (implements INV-10). Precedence: technical invariants (02) > decisions log (07) > business rules (03). Don't guess: mark DECISION NEEDED and stop. -->

# ERROR_CODES (INV-10)

Single response format: `{ error: { code, message, details, timestamp, traceId } }`.
Codes are constants in `<SHARED_PKG>` (a const registry with a derived union type); the frontend maps code → localized message (<LOCALES>), and `message` is only a fallback.

> **Template.** Created in Sprint 0 with the anticipated codes (DEL-003), then extended in the same change as the code that throws each new one (SOT-042). The general codes below are suggested names — rename them once, before Sprint 1, and never again. Delete the italic guidance once filled.

## How entries are written

*Group codes by domain, one `##` section per module, citing the invariant or business rule it implements. Each module defines its codes with its own prefix (`MODULE_ENTITY_*`) in `<name>.errors.ts` and appends them at the END of the shared registry (ENG-091). Every code has a translated message in every locale, in the error namespace of each page that can show it, and a test asserts this (ENG-094).*

Entry format (ENG-092):

- `CODE` (HTTP status) — trigger, on `METHOD /route` (all endpoints that throw it); `details: { ... }` shape (IDs and i18n keys only, never free text or PII); **nothing is written** / what is written; origin `<decision or package ID>`; frontend behaviour (message, which action is offered, whether it may retry).

## General

- `VALIDATION_FAILED` (400) — body/query/params invalid (global validation pipe); `details: [{ field, messageKey }]`.
- `UNAUTHENTICATED` (401) — missing or invalid access token; the client makes one refresh attempt and one retry (SEC-009).
- `FORBIDDEN` (403) — role or permission insufficient.
- `NOT_FOUND` (404) — entity does not exist, is soft-deleted, or belongs to another tenant (never reveal which).
- `RATE_LIMITED` (429) — rate-limit tier exceeded; `Retry-After` header.
- `IDEMPOTENCY_KEY_CONFLICT` (409) — same `Idempotency-Key` with a different request hash or user, or a receipt still in progress (INV-2).
- `SERVICE_BUSY` (503, retryable, `Retry-After: 2`) — transient DB error (`P2028`, `P2024`, `P1001`, `P1017`); the action was NOT saved and the idempotency key stays open (ENG-006).
- `READ_ONLY_STANDBY` (503) — the standby deployment slot refuses mutations (blue/green). Delete if you run a single slot.
- `INTERNAL` (500) — unexpected fallback; never carries a raw message, stack or ORM/provider text.

## Auth (INV-13)

*Cover at least these situations, each with its own code: wrong credentials (same answer for unknown accounts); email already registered; email not verified; account blocked (revealed only after a correct password); sign-in cooldown (429 with `details.retryAfterSec` + `Retry-After`, identical for unknown accounts); refresh token invalid; refresh token reused (family revoked); session superseded by a login elsewhere; 2FA required / invalid code (if built); reset token invalid, expired or used; wrong current password on change-password; terms not accepted at registration.*

## Concurrency (INV-1)

- `CONCURRENT_UPDATE` (409) — serialization failure (Prisma `P2034`, or `P2010` with SQLSTATE `40001`/`40P01`) still failing after 3 retries with 20–80 ms jitter, or a unique violation (`P2002`) that escaped a service; thrown by every capacity-limited and settlement endpoint; `details: {}`; **nothing is written**; origin D-T-001; frontend shows "someone else just changed this — try again" and re-fetches, retrying under the same idempotency key.

## <Domain> (<§4.n / INV-n>)

*One section per module. List the codes in the order the service checks them; checks that run before the transaction or before an external call say "nothing is written" (ENG-010).*

- `<MODULE_ENTITY_REASON>` (<HTTP>) — <trigger> on `<METHOD /route>`; `details: { ... }`; <written / nothing is written>; origin `<ID>`; frontend <behaviour>.
