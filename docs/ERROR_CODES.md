# ERROR_CODES (invarianta 3.10)

Format raspuns unic: `{ error: { code, message, details, timestamp, traceId } }`.
Codurile sunt constante in `packages/shared`; frontend mapeaza cod → mesaj localizat (ro+en), `message` doar fallback.

## Generale
- `VALIDATION_ERROR` — body/query invalid (ValidationPipe).
- `UNAUTHORIZED` — lipsa/invalid access token.
- `FORBIDDEN` — rol/permisiune insuficienta.
- `NOT_FOUND` — entitate inexistenta sau soft-deleted.
- `RATE_LIMITED` — prag rate limit depasit.
- `DEPLOYMENT_STANDBY` — slotul Blue/Green este read-only si refuza temporar mutatiile (503).
- `IDEMPOTENCY_CONFLICT` — acelasi key+endpoint cu hash diferit (409).
- `DATABASE_BUSY` (503, reincercabil, header `Retry-After: 2`) — Prisma P2028 (timeout tranzactie interactiva / nu a putut porni) sau P2024 (timeout pool de conexiuni); actiunea NU a fost salvata, cheia idempotenta ramane deschisa (E-company-2).
- `INTERNAL_ERROR` — fallback neasteptat.

## Auth (3.13)
- `INVALID_CREDENTIALS` · `EMAIL_ALREADY_REGISTERED` · `EMAIL_NOT_VERIFIED` · `ACCOUNT_BLOCKED` (D-L1-2: users.blocked_at)
- `LOGIN_COOLDOWN` (429) — cooldown per email dupa N autentificari esuate (10 in 15 min; 5 pentru conturile ADMIN); identic pentru conturi existente si inexistente (si cu parola corecta cat tine cooldown-ul); `details.retryAfterSec` + header `Retry-After` (E-admin-platform-5)
- `REFRESH_TOKEN_INVALID` · `REFRESH_TOKEN_REUSED` (familie revocata) · `SESSION_SUPERSEDED` (login pe alt device)
- `TWO_FACTOR_REQUIRED` · `TWO_FACTOR_INVALID_CODE` (flag off in MVP)
- `RESET_TOKEN_INVALID` (400) — token de resetare parola invalid/expirat/deja folosit (L0-A)
- `PASSWORD_INCORRECT` (400) — parola curenta gresita la `POST /auth/change-password` (L0-A)
- `TERMS_NOT_ACCEPTED` (400) — `termsAccepted` lipseste sau e `false` la `POST /auth/register` (L0-A)

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
- `INSUFFICIENT_CREDITS` · `SUBSCRIPTION_INACTIVE` · `OUT_OF_COVERAGE_AREA`
- `GATING_NOT_OPEN` (403) — published_at + delay-ul planului (4.10) nu a trecut inca; verificat si in tranzactia de claim (L0-B).
- `COMPANY_EXCLUDED_FROM_REQUEST` (request_company_exclusions)
- `ACTIVE_CLAIM_WITHOUT_OFFER_EXISTS` — regula 1-claim-activ.
- `MANAGER_UNASSIGNED_CAP_REACHED` — cap claim-uri neatribuite.
- `ASSIGNED_USER_HAS_ACTIVE_CLAIM` · `ASSIGNED_USER_PENALTY_BLOCKED` (prag 9 pct)
- `CLAIM_ALREADY_EXISTS` — firma are deja claim pe cerere.

## Retrageri / anulari (4.15)
- `WITHDRAWAL_REASON_NOT_VALIDATED` — conditia automata nu e indeplinita.
- `WITHDRAWAL_ALREADY_PENDING` · `WITHDRAWAL_GRACE_EXPIRED` (info: peste 30 min → penalizare)
- `WITHDRAWAL_OUTCOME_CHANGED` (409, E-company-6) — firma a confirmat in dialog alt rezultat decat cel calculat acum de server pentru retragerea voluntara (`expectedOutcome` REFUND vs CONSUME_AND_PENALTY; de regula gratia de 30 min a expirat intre timp). Refuz fara efecte (inainte de orice tranzactie); `details.outcome` = rezultatul actual. Previzualizarea read-only: `GET /claims/:id/withdraw-preview`.

## Oferte (4.13)
- `QUOTE_VERSION_LIMIT_REACHED` (3) · `CHANGE_REQUEST_ALREADY_REJECTED` (aceeasi modificare)
- `QUOTE_EXPIRED` (valid_until depasit) · `QUOTE_WITHDRAW_WINDOW_CLOSED` (1 zi lucratoare)
- `QUOTE_WITHDRAW_SLA_ACK_REQUIRED` (409, E-company-6) — retragerea ofertei dupa termenul SLA + 12h gratie (SLA nepus pe pauza) expira imediat preluarea; serverul cere `{ acknowledgeSlaBreach: true }` in body. Verificat sub lock, dupa fereastra de 1 zi lucratoare si inainte de orice scriere; `details.slaBreachAt`.
- `VALIDITY_EXTENSION_LIMIT_REACHED` (max 2) · `OFFER_FIELD_NOT_EDITABLE` (matrice permisiuni)
- `CONSULTATION_INVITE_EXPIRED` · `NEGOTIATION_ENDED`
- `QUOTE_ACCEPT_NOT_ALLOWED` — stare cerere/oferta invalida la accept (verificat sub lock FOR UPDATE pe cerere; a doua acceptare / cerere deja ACCEPTED → 409).
- `QUOTE_NOT_MODIFIABLE` (409) — actiune de firma (revizie/extra/reofertare/prelungire/invitatie/retragere) pe o oferta care nu mai e SENT/EXPIRED sau al carei slot nu mai e OFFER_SENT; verificat sub lock (E-company-2).
- `REQUEST_NOT_OPEN_FOR_OFFERS` (409) — firma incearca sa trimita/revizuiasca/reoferteze cand cererea nu mai e in CLAIMED_PARTIAL/CLAIMED_FULL/OFFERS_RECEIVED/NEGOTIATION (ex. deja ACCEPTED) sau a fost stearsa (L0-B).

## Chat / upload (3.4)
- `THREAD_READ_ONLY` · `FILE_TOO_LARGE` (25MB) · `FILE_LIMIT_REACHED` (10/cerere, 5/oferta)
- `FILE_TYPE_NOT_ALLOWED` · `FILE_SCAN_BLOCKED` · `UPLOAD_NOT_FOUND_IN_STORAGE`

## SLA / clarificari
- `CLARIFICATION_ALREADY_PENDING` · `SLA_ALREADY_BREACHED`

## Plati / credite / facturare
- `PAYMENT_SIGNATURE_INVALID` (semnatura Stripe `stripe-signature` pe corpul brut, sau HMAC la webhook-ul mock) · `PAYMENT_ALREADY_CONFIRMED` (409 — comanda nu mai e PENDING: confirmare dubla, anulare dupa confirmare) · `PAYMENT_NOT_FOUND`
- `CREDIT_PACKAGE_INACTIVE` · `CREDITS_EXPIRED`
- `PAYMENT_PROVIDER_UNAVAILABLE` (503 Stripe dezactivat cand e cerut explicit — webhook fara chei; 502 eroare la crearea sesiunii Checkout) · `PAYMENT_NOT_PENDING` (409 — "Continua plata" pe o comanda deja platita/anulata; E-admin-platform-4: si actualizarea e-Factura pe o comanda fara factura fiscala — test / neconfirmata)
- `BILLING_NOT_CONFIGURED` (503, E-admin-platform-4 — datele fiscale ale platformei `seller_*` lipsesc, sunt valorile de exemplu din seed sau CUI/IBAN invalid; raspuns la cumparare credite/abonament, "Continua plata" si la orice confirmare de plata — admin sau webhook Stripe, care reincearca)

## Review / dispute
- `REVIEW_NOT_ALLOWED_YET` (doar dupa COMPLETED) · `REVIEW_ALREADY_SUBMITTED`
- `DISPUTE_ALREADY_DECIDED`

## Admin
- `SETTING_KEY_UNKNOWN` · `AUDIT_LOG_IMMUTABLE` (trigger DB) · `ADMIN_DECISION_REQUIRED_FIELDS`

## Proiect acceptat / oferte expirate (E-admin-platform-3)
- `PROJECT_NOT_CLOSABLE` (409) — cererea nu mai e in ACCEPTED/IN_EXECUTION (deja anulata, livrata, finalizata) la inchiderea de catre admin sau la raportarea unui caz; dublu-click / doi admini → al doilea primeste acest cod, creditele se deconteaza o singura data.
- `PROJECT_CASE_ALREADY_OPEN` (409) — exista deja un caz OPEN pe proiect (verificat sub FOR UPDATE + index unic partial in SQL, P2002 mapat).
- `PROJECT_CASE_NOT_OPEN` (409) — cazul nu mai e deschis sau a primit deja un raspuns (raspuns dublu / respingere dubla de catre admin).
- `QUOTE_EXTENSION_NOT_REQUESTABLE` (409) — prelungirea se cere doar pe o oferta EXPIRED, cat timp cererea e in OFFERS_RECEIVED/NEGOTIATION.

## Acceptarea ofertei (E-client-1)
- `QUOTE_VERSION_CHANGED` (409) — `POST /client/quotes/:id/accept` cu `{ quoteVersionId }`: clientul a confirmat o versiune care nu mai e ultima (firma a revizuit / a trimis o varianta cat era deschis dialogul). Verificat inainte de tranzactie SI sub FOR UPDATE pe cerere; nimic nu se scrie (fara credite, fara outbox). `details: { currentVersionId, currentVersion }` (doar id-uri). Raspunsul se salveaza pe cheia de idempotenta: reincercarea cu aceeasi cheie reda 409; frontend-ul reciteste oferta si trimite noua versiune (corp nou → cheie noua). Un `quoteVersionId` care nu apartine ofertei → 400 `VALIDATION_ERROR`; body fara `quoteVersionId` → 400 `VALIDATION_ERROR`.

## Texte juridice (E-admin-platform-2)
- `LEGAL_VERSION_MISMATCH` (409) — `POST /legal/accept`: clientul a trimis alte versiuni decat cele curente ale Termenilor/Politicii (bundle vechi in timpul unui rollout blue/green); nu se scrie nimic, UI cere reincarcarea paginii. Endpoint-ul, JWT (orice rol), throttle 10/min, audit `LEGAL_ACCEPTED`. `GET /legal/operator` este public (throttle 60/min, `Cache-Control: public, max-age=300`).

## Publicare cerere (E-client-2)
- `REQUEST_PROJECT_FILE_REQUIRED` (400) — publish/edit cu „Am deja un proiect" (`hasOwnProject: true`) fara cel putin un atasament SAFE al cererii nereferit de nicio camera (nici schita, nici `snapshot3d`); docs/03 4.1. FE: pasul Fisiere blocheaza „Continuă", sumarul ofera salt la Fisiere.
- `INSPIRATION_UNAVAILABLE` (400) — una sau mai multe poze de inspiratie alese nu mai sunt publicate / au fost sterse / firma a fost stearsa; `details: { photoIds: string[] }`. FE scoate pozele din selectie si cere republicarea. Acelasi cod la salvarea unei poze indisponibile in colectii (era `NOT_FOUND`).
- `CONFIGURATOR_ANSWERS_INVALID` (400) are acum `details: [{ roomIndex, stepId, messageKey }]` si pentru: schite / `snapshot3d` care nu mai exista pe cerere (`messageKey: 'validation.fileUnavailable'`, era `VALIDATION_ERROR` fara detalii), noptiera asezata in Studio cu `count` diferit de ONE (`stepId: 'count'`, `messageKey: 'validation.studioNightstandSingle'`, verificat inainte de tranzactie) si camera cu dimensiuni obligatorii si lungime/latime/inaltime derivata 0 (`messageKey: 'validation.dimensionOutOfRange'`). `FILE_SCAN_BLOCKED` pe o schita respinsa la scanare poarta aceleasi detalii (`messageKey: 'validation.answerInvalid'`). `roomIndex` = ordinea camerelor din payload.

## Date de contact in texte libere (E-admin-platform-45)
- `REQUEST_CONTACT_INFO_IN_TEXT` (400) — publish/edit (`POST /requests/draft/:token/publish`, `POST /requests/:id/edit`) cand `system_settings.pre_claim_contact_text_policy = BLOCK` (implicit `MASK`, DECIZIE NECESARA PO) si "Mesaj pentru firme" sau un raspuns text / nume-descriere de piesa contine un telefon, email, link sau cont social. `details: [{ field: 'description', messageKey: 'validation.contactInText' } | { roomIndex, stepId, messageKey: 'validation.contactInText' }]` (`roomIndex` = ordinea camerelor din payload). Verificat inainte de geocodare si de tranzactie: nu se consuma editarea, nu se scrie cererea; se scriu doar randurile `BLOCKED` in `request_contact_detections`. Titlul nu blocheaza niciodata (un titlu manual cu contact e inlocuit cu titlul automat). Mentiunile simple de aplicatii ("prefer WhatsApp") nu blocheaza. In modul `MASK` publicarea trece si textul apare firmelor fara acces cu tokenul `⟦contact⟧`.

## Concurenta (3.1)
- `CONCURRENT_MODIFICATION` (409) — serialization failure (Prisma P2034) dupa retry (3 reincercari cu jitter 20-80 ms); si P2002 (violare de unicitate) scapata din serviciu; clientul poate reincerca actiunea (claim / accept oferta / actiuni pe oferta).

## Calendar de lucru (E-admin-platform-25)
- `CALENDAR_DATE_EXISTS` (409) — `POST /admin/calendar`: exista deja un rand in `business_calendar_holidays` pentru data ceruta (indexul unic pe `date`, P2002). Nu se scrie nimic; adminul editeaza randul existent (tipul zi libera / zi lucratoare fortata) in loc sa adauge unul nou. Data in afara intervalului [azi (Bucuresti), 31 dec anul curent+5] sau o data calendaristica inexistenta → 400 `VALIDATION_ERROR` cu `details: [{ field: 'date' }]`; id necunoscut la PATCH/DELETE → 404 `NOT_FOUND`.

## Confidentialitate pre-claim (E-client-9)
- `COMPANY_LOCATION_LIMIT_REACHED` (409) — `POST /companies/me/locations`: firma are deja `system_settings.company_locations_max` locatii (implicit 10, DECIZIE NECESARA PO). Numarat sub `pg_advisory_xact_lock` per firma (doua adaugari simultane nu depasesc plafonul); `details: { max }`. Nu se scrie nimic.
- `COMPANY_LOCATION_CHANGE_LIMIT` (429) — `POST /companies/me/locations`, `PUT|DELETE /companies/me/locations/:id`: firma a facut deja `system_settings.company_location_changes_per_day` schimbari de locatii in ultimele 24h (implicit 20; numarate din `audit_logs` COMPANY_LOCATION_CREATED/UPDATED/DELETED). Verificat inainte de orice scriere. Raza sub `MIN_COVERAGE_RADIUS_KM` (2 km) → 400 `VALIDATION_ERROR`; `:id` care nu e UUID → 400 `VALIDATION_ERROR`.

## Planuri ca date (E-admin-platform-58)
- `PLAN_FEATURE_REQUIRED` (403) — rutele cu `SubscriptionActiveGuard` (lista/detaliu marketplace, preluari) cand firma ARE abonament activ, dar planul lui nu include functia `MARKETPLACE_ACCESS` (`subscription_plan_features`, rand lipsa = dezactivat); `details: { feature: 'MARKETPLACE_ACCESS' }`. Fara abonament activ raspunsul ramane `SUBSCRIPTION_INACTIVE`. Acelasi cod il da `PlanFeatureGuard` (`@RequirePlanFeature(key)`) pentru functiile viitoare.
- `PLAN_NOT_PURCHASABLE` (409) — `POST /billing/subscription/purchase` pe un plan cu `price_ron = 0`: planul gratuit nu se cumpara online (Stripe nu incaseaza 0, o factura de 0 lei ar consuma un numar din serie); il acorda adminul (`POST /admin/subscriptions/grant`) sau setarea `trial_plan`. Verificat inainte de comanda si de Stripe — nu se scrie nimic.
- `PLAN_CODE_TAKEN` (409) — `POST /admin/plans`: exista deja un plan cu acelasi `code` (indexul unic `subscription_plans_code_key`, P2002). Nu se scrie nimic. Cod invalid (`PLAN_CODE_RE` = `^[A-Z][A-Z0-9_]{1,31}$`) sau `features.MARKETPLACE_ACCESS` lipsa → 400 `VALIDATION_ERROR`; `PUT /admin/settings/trial_plan` cu un cod care nu e al unui plan ACTIV → 400 `VALIDATION_ERROR` cu `details: [{ field: 'trial_plan', reason: 'PLAN_NOT_FOUND' }]`.
