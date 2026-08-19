# ERROR_CODES (invarianta 3.10)

Format raspuns unic: `{ error: { code, message, details, timestamp, traceId } }`.
Codurile sunt constante in `packages/shared`; frontend mapeaza cod → mesaj localizat (ro+en), `message` doar fallback.

## Generale
- `VALIDATION_ERROR` — body/query invalid (ValidationPipe).
- `UNAUTHORIZED` — lipsa/invalid access token.
- `FORBIDDEN` — rol/permisiune insuficienta.
- `NOT_FOUND` — entitate inexistenta sau soft-deleted.
- `RATE_LIMITED` — prag rate limit depasit.
- `IDEMPOTENCY_CONFLICT` — acelasi key+endpoint cu hash diferit (409).
- `INTERNAL_ERROR` — fallback neasteptat.

## Auth (3.13)
- `INVALID_CREDENTIALS` · `EMAIL_ALREADY_REGISTERED` · `EMAIL_NOT_VERIFIED`
- `REFRESH_TOKEN_INVALID` · `REFRESH_TOKEN_REUSED` (familie revocata) · `SESSION_SUPERSEDED` (login pe alt device)
- `TWO_FACTOR_REQUIRED` · `TWO_FACTOR_INVALID_CODE` (flag off in MVP)

## Companii / verificare
- `COMPANY_NOT_APPROVED` · `COMPANY_SUSPENDED` · `COMPANY_REAPPLY_BLOCKED` (3 luni CUI/email)
- `CUI_ALREADY_REGISTERED` · `MEMBER_ALREADY_EXISTS` · `LAST_OWNER_CANNOT_LEAVE`

## Cereri
- `DRAFT_TOKEN_INVALID` · `REQUEST_NOT_EDITABLE` (stare gresita)
- `EDIT_LIMIT_PRE_CLAIM_REACHED` (3) · `EDIT_LIMIT_POST_CLAIM_REACHED` (1) · `EDIT_BLOCKED_OFFER_RECEIVED`
- `REQUEST_EXPIRED` · `REPOST_ALREADY_USED` · `GEOCODING_FAILED`

## Claim (3.1, 4.8, 4.9)
- `CLAIM_NOT_ALLOWED` — status nu e IN_MARKETPLACE/CLAIMED_PARTIAL.
- `CLAIM_SLOTS_FULL` — deja 3 claim-uri active.
- `INSUFFICIENT_CREDITS` · `SUBSCRIPTION_INACTIVE` · `OUT_OF_COVERAGE_AREA` · `GATING_NOT_OPEN`
- `COMPANY_EXCLUDED_FROM_REQUEST` (request_company_exclusions)
- `ACTIVE_CLAIM_WITHOUT_OFFER_EXISTS` — regula 1-claim-activ.
- `MANAGER_UNASSIGNED_CAP_REACHED` — cap claim-uri neatribuite.
- `ASSIGNED_USER_HAS_ACTIVE_CLAIM` · `ASSIGNED_USER_PENALTY_BLOCKED` (prag 9 pct)
- `CLAIM_ALREADY_EXISTS` — firma are deja claim pe cerere.

## Retrageri / anulari (4.15)
- `WITHDRAWAL_REASON_NOT_VALIDATED` — conditia automata nu e indeplinita.
- `WITHDRAWAL_ALREADY_PENDING` · `WITHDRAWAL_GRACE_EXPIRED` (info: peste 30 min → penalizare)

## Oferte (4.13)
- `QUOTE_VERSION_LIMIT_REACHED` (3) · `CHANGE_REQUEST_ALREADY_REJECTED` (aceeasi modificare)
- `QUOTE_EXPIRED` (valid_until depasit) · `QUOTE_WITHDRAW_WINDOW_CLOSED` (1 zi lucratoare)
- `VALIDITY_EXTENSION_LIMIT_REACHED` (max 2) · `OFFER_FIELD_NOT_EDITABLE` (matrice permisiuni)
- `CONSULTATION_INVITE_EXPIRED` · `NEGOTIATION_ENDED`
- `QUOTE_ACCEPT_NOT_ALLOWED` — stare cerere/oferta invalida la accept.

## Chat / upload (3.4)
- `THREAD_READ_ONLY` · `FILE_TOO_LARGE` (25MB) · `FILE_LIMIT_REACHED` (10/cerere, 5/oferta)
- `FILE_TYPE_NOT_ALLOWED` · `FILE_SCAN_BLOCKED` · `UPLOAD_NOT_FOUND_IN_STORAGE`

## SLA / clarificari
- `CLARIFICATION_ALREADY_PENDING` · `SLA_ALREADY_BREACHED`

## Plati / credite / facturare
- `PAYMENT_SIGNATURE_INVALID` (semnatura Stripe `stripe-signature` pe corpul brut, sau HMAC la webhook-ul mock) · `PAYMENT_ALREADY_CONFIRMED` (409 — comanda nu mai e PENDING: confirmare dubla, anulare dupa confirmare) · `PAYMENT_NOT_FOUND`
- `CREDIT_PACKAGE_INACTIVE` · `CREDITS_EXPIRED`
- `PAYMENT_PROVIDER_UNAVAILABLE` (503 Stripe dezactivat cand e cerut explicit — webhook fara chei; 502 eroare la crearea sesiunii Checkout) · `PAYMENT_NOT_PENDING` (409 — "Continua plata" pe o comanda deja platita/anulata)

## Review / dispute
- `REVIEW_NOT_ALLOWED_YET` (doar dupa COMPLETED) · `REVIEW_ALREADY_SUBMITTED`
- `DISPUTE_ALREADY_DECIDED`

## Admin
- `SETTING_KEY_UNKNOWN` · `AUDIT_LOG_IMMUTABLE` (trigger DB) · `ADMIN_DECISION_REQUIRED_FIELDS`
