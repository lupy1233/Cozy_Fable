<!-- Product Bible Master v6 — Model de date complet. Sursa de adevar. Ierarhie la conflict: invariante (02) > decisions log (07) > reguli business (03). Nu ghici: marcheaza DECIZIE NECESARA si opreste-te. -->

# 5. Model de date complet

Actualizare 2026-10-01 (Sprint 73 / E-admin-platform-58, migrarea `20261001060000_plans_as_data`, expand blue/green): planurile de abonament devin date. `subscription_plans.code TEXT NOT NULL UNIQUE` (backfill = `tier`::text pentru SILVER/GOLD/PLATINUM; identitatea planului, imuabila), `name_ro` / `name_en TEXT NULL` (nume afisat; lipsa = codul), `tier` devine NULLABLE (legacy; planurile noi au `tier` NULL; `DROP COLUMN tier` + `DROP TYPE subscription_plan_tier` = release separat). Tabel nou `subscription_plan_features` (PK `plan_id, feature_key`, FK CASCADE, `enabled` default false, `limit_value` INT NULL, `updated_at`); backfill `MARKETPLACE_ACCESS = true` pentru cele 3 planuri existente (comportament identic). Eligibilitatea (4.8) = abonament activ (`status = ACTIVE` si `expires_at > now`, predicatul unic `activeSubscriptionWhere`) + `MARKETPLACE_ACCESS` pe plan; `price_ron = 0` e permis (plan gratuit) dar nu se cumpara online (409 `PLAN_NOT_PURCHASABLE`) — il acorda adminul sau `trial_plan` (cheia `system_settings.trial_plan` = codul unui plan ACTIV, validat la salvare). DTO-urile pastreaza numele de camp `tier` / `planTier`, care poarta acum codul (identic pentru planurile vechi). Rollback: vezi comentariul din migrare (imaginea veche ignora functiile — un plan cu acces dezactivat ar avea acces in timpul rollback-ului).

Actualizare 2026-10-01 (Sprint 23 / E-company-24, migrarea `20261001050000_bank_transfer_billing_emails`, strict aditiva): `mock_billing_orders.payment_claimed_at TIMESTAMPTZ NULL` (firma a apasat „Am platit” pe o comanda prin transfer bancar; setat o singura data, comanda nu se mai anuleaza automat) si `mock_billing_orders.transfer_reminder_sent_at TIMESTAMPTZ NULL` (reminderul de plata trimis o singura data); `companies.billing_email VARCHAR(254) NULL` (Prisma `billingEmail`, email de facturare optional al firmei — ex. contabilul — salvat trim + lowercase, vizibil doar OWNER/MANAGER, NU intra in audit: PII); `domain_event_outbox.billing_contact_emailed_at TIMESTAMPTZ NULL` (copia documentului catre `billing_email` trimisa o singura data per eveniment). Chei noi `system_settings` (§5.4, date in aceeasi migrare): `bank_transfer_reminder_days` = `0` si `bank_transfer_expiry_days` = `0` (intregi 0..365, zile calendaristice de la `created_at`; 0 = oprit) — DECIZIE NECESARA PO. „Comanda prin transfer” = `status='PENDING'`, `stripe_session_id` NULL, `stripe_checkout_attempt` NULL, `test_mode=false` (fara coloana de canal noua). Tipuri noi de evenimente outbox: `payment.transfer_instructions`, `payment.transfer_reminder`, `payment.auto_cancelled` (OWNER/MANAGER) si `payment.marked_paid` (admini).

Actualizare 2026-10-01 (Sprint 23 / E-company-19, migrarea `20261001040000_invoice_vat_payer_service_period`, strict aditiva): `companies.is_vat_payer BOOLEAN NOT NULL DEFAULT false` (Prisma `isVatPayer`) — firma declarata platitoare de TVA (prefix RO tastat la onboarding sau `PATCH /companies/me { isVatPayer }`, auditat `COMPANY_PROFILE_UPDATED`); pe factura apare „Cod TVA RO…”, altfel „CUI …”. Backfill: `is_vat_payer = true` unde `cui ~* '^RO'` (seed / date vechi); `cui` NU se rescrie (onboardingul il salveaza fara prefix). `mock_billing_orders.service_period_start / service_period_end TIMESTAMPTZ NULL` — perioada abonamentului facturat, scrisa o data la `confirm()` (end = noul `subscriptions.expires_at`, start = end - 30 zile); pachetele de credite si comenzile test raman NULL, comenzile confirmate inainte de migrare raman NULL (perioada nu se reconstituie). `buyer_snapshot` v2 = `{name, cui (fara prefix RO), regCom, address, isVatPayer}`; cititorul accepta si v1 (`{name, cui, regCom, address}`, platitor daca `cui` incepe cu RO). DECIZIE NECESARA PO: snapshot pentru facturile emise inainte de E-admin-platform-4 (implicit: nu se completeaza) si verificarea ANAF a statutului de platitor.

Actualizare 2026-10-01 (E-company-21, migrarea de date `20261001020000_claim_cost_settings`, fara schimbare de schema/enum): chei noi `system_settings` (§5.4) — `credit_value_ron` = `1000` (1..1.000.000; lei din bugetul minim estimat per credit, PO r5 V1), `claim_cost_min` = `1` (1..1000), `claim_cost_max` = `0` (0 = fara plafon, altfel 1..1000 si >= `claim_cost_min`, verificat la `PUT /admin/settings/:key`). Implicitele dau exact costul de dinainte. `requests.credit_cost` = `creditCostFromBaseScore(baseScore, rules)` la publicare/editare; `claim_slots.claim_cost_credits_snapshot` ramane inghetat. `GET /legal/firm-rules` intoarce `claims.claimCost` = `{ min, max | null }`. DECIZIE NECESARA PO: valorile min/max. Expirarea creditelor (docs/03 4.16) NU e implementata (fara tip EXPIRE).

Actualizare 2026-10-01 (Sprint 21 / E-admin-platform-14, migrarea `20261001003000_threshold_credit_cost_nullable`, expand non-distructiv): `project_size_thresholds.credit_cost` devine NULLABLE (Prisma `creditCost Int?`) — coloana e legacy (PO r5: costul claim-ului = `creditCostFromBaseScore(baseScore)`, 1 credit = 1.000 lei din bugetul minim), nu e citita de cod si nu mai e scrisa de seed; randurile existente (1/2/4) raman neschimbate. `DROP COLUMN` = release separat (contract, blue/green), doar dupa decizia PO (r5 #3 "fara migrare distructiva"). Rollback: `UPDATE ... SET credit_cost = 0 WHERE credit_cost IS NULL; ALTER ... SET NOT NULL`.

Actualizare 2026-09-30 (E-company-3, migrarea de date `20260930210000_claim_contact_access_settings`, fara schimbare de schema): doua chei noi `system_settings` (§5.4) — `claim_contact_reveal_policy` (`ON_CLAIM` implicit = W1, sau `AFTER_GRACE`) si `completed_claim_contact_retention_days` (intreg 0..3650, implicit 0 = fara prag); ambele DECIZIE NECESARA PO (momentul dezvaluirii contactelor / rambursarea in gratie dupa dezvaluire / plafon lunar; durata de retentie dupa livrare). `GET /quotes/by-claim/:id` intoarce `visibility` (`FULL` | `REDACTED` | `TOMBSTONE`), `clientHiddenReason` (`NOT_OCCUPYING` | `NOT_ASSIGNED_TO_YOU` | `REVEAL_PENDING` | `RETENTION_EXPIRED` | `REQUEST_DELETED`) si `clientVisibleFrom`; modurile REDACTED/TOMBSTONE nu presemneaza fisiere si nu intorc raspunsuri, scene sau contacte. Previzualizarea retragerii (`GET /claims/:id/withdraw-preview`) intoarce per motiv `notEligibleReason` (`FIRM_MESSAGE_REQUIRED` | `WAITING_48H` | `REQUEST_NOT_EDITED` | `OFFER_SENT_AFTER_EDIT`); acelasi camp apare in `details` la 409 `WITHDRAWAL_REASON_NOT_VALIDATED`. Semnalele se calculeaza din citiri indexate (`messages.chat_thread_id`, `clarification_requests.claim_slot_id`, `quote_versions.sent_at`), fara coloana noua.

Actualizare 2026-09-30 (E-client-3, migrarea de date `20260930200000_clear_published_draft_tokens`, fara schimbare de schema): `requests.draft_token_hash` este secretul unei CIORNE si e NULL pe orice rand care nu e `DRAFT` (sau e sters): publicarea si aruncarea ciornei (`DELETE /requests/drafts/:token`) il seteaza NULL in acelasi update, iar migrarea a golit hash-urile ramase pe cererile publicate/terminale si pe ciornele sterse. Rutele cu token (`/requests/drafts/:token*`) raspund doar pentru `status = DRAFT`, iar un cont logat diferit de `client_user_id` primeste 404 `DRAFT_TOKEN_INVALID`; o ciorna anonima salvata (PATCH) de un user logat primeste `client_user_id` = acel user. Dupa publicare proprietarul lucreaza doar pe rutele autentificate `:id` (`/edit`, `/attachments`, `/repost`). Rutele `drafts/:token/edit` si `drafts/:token/repost` au fost scoase.

Actualizare 2026-10-01 (E-admin-platform-45, migrarea `20261001001000_request_contact_detections`, strict aditiva): tabel nou `request_contact_detections` (`id` TEXT PK uuid, `request_id` TEXT NOT NULL FK -> `requests(id)` ON DELETE CASCADE, `trigger` VARCHAR(16) PUBLISH|EDIT, `field` VARCHAR(16) TITLE|DESCRIPTION|ANSWER, `room_type` `room_type` NULL, `step_id` VARCHAR(80) NULL, `kinds` TEXT[] (PHONE|EMAIL|URL|HANDLE|MESSENGER), `excerpt` VARCHAR(240) NOT NULL, `action` VARCHAR(16) MASKED|BLOCKED|TITLE_REPLACED|FLAGGED, `created_at` TIMESTAMPTZ; indexuri pe `request_id` si `created_at`). Valorile sunt validate in aplicatie din constantele shared (`CONTACT_DETECTION_*`, `CONTACT_MATCH_KINDS`), fara enum-uri Postgres. `excerpt` = fragment de ±60 caractere cu contactele partial ascunse (telefon `07•• ••• •56`, email `a•••@domeniu`, link doar host, cont `@a•••`); fara valoare bruta, fara user id; randurile dispar doar prin cascada cu cererea. Cheie noua `system_settings` (§5.4): `pre_claim_contact_text_policy` = `MASK` (implicit, DECIZIE NECESARA PO) | `BLOCK`. Textele stocate in `requests` / `request_rooms.answers` / `request_items` NU se rescriu: mascarea (`⟦contact⟧`) se face la citire in DTO-urile pentru firme.

Actualizare 2026-10-01 (E-client-9, migrarea de date `20261001002000_location_privacy_settings`, fara schimbare de schema): chei noi `system_settings` (§5.4) — `marketplace_distance_display` = `KM` (implicit) | `BAND`; `company_locations_max` = `10` (1..100); `company_location_changes_per_day` = `20` (1..1000, fereastra de 24h rolling numarata din `audit_logs` cu `entity_type = 'company_location'`, `entity_id` = id-ul firmei). Toate trei = DECIZIE NECESARA PO, validate in aplicatie (Admin -> Setari). `attachments.storage_key` dupa confirm/scan are forma neutra `<entity>/<entity_id>/<attachment_id>/(sealed|clean)-<uuid>.<ext>` (fara numele fisierului); `size_bytes` se actualizeaza cand scanul re-encodeaza o imagine (EXIF eliminat). `filename` ramane numele original (vazut doar de proprietar si in chat). Jobul `sanitize.legacy` (coada `uploads`, la pornire) muta randurile REQUEST SAFE vechi pe chei neutre.

Actualizare 2026-09-30 (E-client-1, migrarea `20260930150000_quote_accepted_version`, strict aditiva): `quotes.accepted_version_id TEXT NULL` FK -> `quote_versions(id)` ON DELETE SET NULL, UNIQUE (`quotes_accepted_version_id_key`) — versiunea de oferta confirmata de client la accept (body `POST /client/quotes/:id/accept` = `{ quoteVersionId }`, verificata inainte de tranzactie si sub FOR UPDATE pe cerere; alta versiune decat ultima → 409 `QUOTE_VERSION_CHANGED`). Scrisa in acelasi `updateMany` SENT→ACCEPTED. FARA backfill: accepturile dinainte de migrare raman NULL si cititorii (DTO `acceptedVersionId`, cardul "Acordul vostru", PDF-ul ofertei) cad pe ultima versiune — echivalent, pentru ca dupa ACCEPTED nu se mai pot adauga versiuni. `QuoteVersionDto` primeste si `total`/`totalRon`/`totalEur` (calculate, fara coloana: pret + design_fee in moneda ofertei, conversie informativa D-v6-12).

Actualizare 2026-09-29 (E-company-2, migrarea `20260929213000_quotes_live_uniqueness`, strict aditiva, DOAR SQL): doua indexuri unice PARTIALE, invizibile pentru Prisma (comentarii-santinela in `schema.prisma`): `quotes_one_live_per_claim_slot` pe `quotes(claim_slot_id) WHERE status IN ('SENT', 'EXPIRED')` — cel mult o oferta vie per slot (plasa impotriva cursei createQuote vs inchidere/accept; P2002 → 409 `QUOTE_ALREADY_SENT`) si `quote_change_requests_one_pending_per_version` pe `quote_change_requests(quote_version_id) WHERE status = 'PENDING'` (P2002 → 409 `VALIDATION_ERROR`). Inainte de aplicarea pe prod, SELECT-urile de duplicate din antetul migrarii trebuie sa intoarca 0 randuri. Fara coloane/enum-uri noi.

Actualizare 2026-09-29 (E-admin-platform-2, migrarea `20260929150000_legal_acceptance_versions`, strict aditiva): `users.terms_version VARCHAR(32) NULL` si `users.privacy_version VARCHAR(32) NULL` — versiunea Termenilor/Politicii acceptata (constantele `LEGAL_TERMS_VERSION`/`LEGAL_PRIVACY_VERSION` din `packages/shared/src/legal.ts`); NULL sau diferit de versiunea curenta = utilizatorul primeste `needsLegalAcceptance=true` si vede dialogul de re-acceptare (adminii sunt exceptati); `users.terms_accepted_at` se re-stampileaza la fiecare acceptare (`POST /legal/accept`, audit `LEGAL_ACCEPTED`). Chei noi `system_settings` (§5.4): `legal_contact_email` (implicit gol) si `legal_identity_published` (implicit `false`); identitatea operatorului afisata in Termeni/Politica/footer se citeste din `seller_name`, `seller_cui`, `seller_reg_com`, `seller_address` + `legal_contact_email` si apare DOAR cand flagul e `true` si toate cele 5 valori sunt completate.

Actualizare P02 (2026-09-16): `domain_event_outbox` si coloanele nullable
`notifications.event_id`, `notifications.email_delivered_at` sunt documentate in
`docs/durable-event-contract.md`. Unique `(event_id, user_id)` deduplica livrarea,
iar `completed_at` al outbox-ului confirma finalizarea consumatorului, nu doar enqueue.

Actualizare checkout: `mock_billing_orders.stripe_checkout_attempt JSONB NULL` pastreaza cheia opaca, momentul crearii si parametrii fixati inainte de apelul Stripe. Nu apare in DTO-uri/loguri; poate contine emailul deja furnizat si ramane protejat de accesul DB. [Contract si verificari](implementation/verification.md#checkout-recovery-contract). Datele existente raman NULL; migrarea este aditiva.

Actualizari 2026-09-29 (E-admin-platform-3, migrarea `20260929120000_project_closure_offer_expiry`, strict aditiva):
- `request_status` + `CANCELLED` (proiect anulat dupa acceptare, inchis DOAR de admin cu decontare unica); `claim_slot_status` + `CANCELLED_PROJECT` (slotul castigator la anularea proiectului) si `CANCELLED_OFFER_EXPIRED` (oferta EXPIRED fara decizie a clientului, inchisa automat — doar cu setarile activate). Valorile de enum nu se pot sterge in Postgres: la rollback raman marcate „rezervat".
- `requests.cancelled_at TIMESTAMPTZ NULL` (momentul inchiderii de catre admin); `quote_versions.extension_requested_at TIMESTAMPTZ NULL` (clientul a cerut prelungirea unei oferte EXPIRED; o singura data per versiune).
- Tabel nou `request_project_cases`: id, request_id FK (cascade), claim_slot_id FK (slotul castigator, cascade), opened_by ENUM(CLIENT/COMPANY), opened_by_user_id, reason ENUM(FIRM_UNRESPONSIVE/CLIENT_UNRESPONSIVE/MUTUAL_CANCEL_REQUEST/OTHER), note TEXT NULL (max 1000), status ENUM(OPEN/CLOSED_PROJECT_CANCELLED/DISMISSED) DEFAULT OPEN, response ENUM(CONFIRMED_CANCEL/CONTESTED) NULL, responded_by_user_id, response_note, responded_at, resolved_by_user_id, resolved_at, credit_outcome ENUM settlement_outcome(REFUND/CONSUME) NULL, admin_note, created_at, updated_at; index pe request_id si status + index unic PARTIAL `request_project_cases_one_open_per_request` (request_id) WHERE status='OPEN' (traieste DOAR in SQL). Fara soft delete: notele sunt text liber, fara coloane PII; `UserAnonymizationService` NU atinge aceste note.
- Chei `system_settings` noi: `expired_offer_autoclose_enabled=false`, `expired_offer_autoclose_days=14` (placeholder, folosit doar daca PO activeaza), `expired_offer_autoclose_credit_outcome=UNSET` (REFUND/CONSUME; UNSET = procesor no-op), `delivery_reminder_days_before=3`.

Actualizare E-admin-platform-4 (2026-09-29, migrarea `20260929170000_billing_readiness_e_invoice`, strict aditiva, blue/green safe):
- Enum nou `e_invoice_status` (PENDING/UPLOADED/VALIDATED/REJECTED/NOT_REQUIRED) — raportarea e-Factura per comanda, ruta manuala (contabil + SPV) pana la decizia PO.
- `mock_billing_orders` + `test_mode BOOLEAN NOT NULL DEFAULT false` (comanda creata cu cheie Stripe de test: la confirmare NU primeste serie/numar fiscal, `e_invoice_status=NOT_REQUIRED`), `buyer_snapshot JSONB NULL` ({name, cui, regCom, address} — cumparatorul inghetat la emitere, alaturi de `seller_snapshot`), `e_invoice_status e_invoice_status NULL`, `anaf_upload_id VARCHAR(32) NULL` (index incarcare SPV), `anaf_download_id VARCHAR(32) NULL`, `e_invoice_updated_at TIMESTAMPTZ NULL`; index pe `e_invoice_status`. Backfill: comenzile CONFIRMED cu `invoice_number` → `PENDING` („de raportat"). NULL + CONFIRMED + numar fiscal (confirmata de un slot vechi) se trateaza ca PENDING in DTO/export.
- `system_settings.seller_*` (name/cui/reg_com/address/iban): seed-ul le lasa goale; se completeaza DOAR din Admin → Setari → Date fiscale (`PUT /admin/billing/seller`, validare CUI cifra de control + IBAN mod-97, respinge valorile de exemplu din seed). Pana atunci cumpararile si confirmarile raspund 503 `BILLING_NOT_CONFIGURED`.

Actualizare E-admin-platform-10 (2026-09-30, migrarea de date `20260930120000_claims_open_after_first_offer_setting`, fara schimbare de schema):
- Cheie `system_settings` noua `claims_open_after_first_offer=false`. Cu `true`, o cerere in OFFERS_RECEIVED/NEGOTIATION ramane claimabila cat timp sloturile ocupante < `max_claims_per_request` (varianta A). Implicit `false` = invarianta 3.1 literala (DECIZIE NECESARA PO: activarea cere amendarea 3.1 + intrare in docs/07). Admin accepta doar 'true'/'false'.
- `max_claims_per_request` accepta din Admin doar intregi 1..3 (docs/03 4.8); recalculul statusului (CLAIMED_PARTIAL/CLAIMED_FULL) il citeste acum pe toate caile, nu doar la claim.

Actualizare E-admin-platform-15 (2026-10-01, migrarile SQL-only `20261001010000_credit_settlement_unique` + `20261001011000_wallet_check_validate`, fara schimbare de model Prisma):
- `credit_transactions`: 2 indexuri UNICE PARTIALE, traiesc DOAR in SQL — `credit_transactions_one_reserve_per_slot` (`claim_slot_id` WHERE `type='RESERVE'`) si `credit_transactions_one_settlement_per_slot` (`claim_slot_id` WHERE `type IN ('REFUND','CONSUME')`): max un RESERVE si max o decontare per slot.
- `company_credit_wallets`: CHECK-urile `company_credit_wallets_balance_nonneg` / `company_credit_wallets_reserved_nonneg` sunt acum VALIDATE (inainte NOT VALID).
- `credit_transactions.reason` ramane `TEXT`; scrierile noi folosesc lista `CREDIT_REASONS` din `packages/shared/src/enums.ts` (grant: CREDIT_PURCHASE/SUBSCRIPTION_CREDITS/TRIAL_BONUS; reserve: CLAIM_RESERVE; 15 motive de decontare). Randurile istorice pot avea alte valori.

Actualizare hotfix pre-deploy (2026-10-04, decizie PO, migrarea de date `20261004120000_legal_reaccept_setting`, fara schimbare de schema):
- Cheie `system_settings` noua `legal_reaccept_existing_users=false`. Cu `false` (implicit), `needsLegalAcceptance` e `false` pentru toti (conturile noi primesc versiunile curente la inregistrare, cele existente nu sunt blocate pana la revizuirea avocatului). Cu `true` revine regula E-admin-platform-2 (versiune NULL sau diferita de cea curenta → dialog; adminii exceptati). Admin accepta doar 'true'/'false'; backendul tine valoarea in memorie 60 s.

## 5.1 Entități păstrate (din v3/v4)

users, companies, company_members, company_locations, teams, company_verification_profiles, company_portfolio_items, subscription_plans, subscriptions, company_credit_wallets, credit_transactions, requests, request_versions, request_rooms, request_items, request_attachments, request_contact_preferences, claim_slots, claim_withdrawals, chat_threads, messages, message_attachments, clarification_requests, quotes, quote_versions, quote_change_requests, quote_attachments, penalty_events, reviews, review_disputes, notifications, audit_logs, admin_notes, system_settings, mock_billing_orders.

## 5.2 Tabele noi

| **Tabel** | **Coloane cheie** | **Sursă** |
| --- | --- | --- |
| project_sizing_config | id, category, option_key, option_label, points, is_active | 4.5 |
| project_size_thresholds | size (SMALL/MEDIUM/LARGE), min_score, max_score, credit_cost (LEGACY, nullable din Sprint 21 — costul real = creditCostFromBaseScore, PO r5; DROP in release separat) | 4.5 |
| physical_consultation_invites | id, quote_id, company_id, location_address, proposed_datetime, alternative_datetimes (jsonb), status, client_response_text, created_at, responded_at, expires_at (= created_at + 7d) | 4.13 |
| quote_validity_extensions | id, quote_version_id, extended_by_days, extended_at, extended_by_user_id, previous_valid_until, new_valid_until | 4.13 |
| company_offer_field_permissions | id, company_id, role, field_key, can_edit | 4.13 |
| credit_packages | id, credits, price_ron, is_active | 4.16 |
| refresh_tokens | id, user_id, token_hash, family_id, rotated_from_id, expires_at, revoked_at, replaced_at | 3.13 |
| request_company_exclusions | id, request_id, company_id, reason (SLA_BREACH), created_at | 4.11 |
| penalty_rules | id, rule_key, points, is_active (configurabil Admin; seed: cele 3 abateri din 4.12) | 4.12 |
| subscription_plan_features | plan_id (FK -> subscription_plans ON DELETE CASCADE), feature_key (TEXT, registrul `PLAN_FEATURE_KEYS` din shared; azi doar MARKETPLACE_ACCESS), enabled (BOOLEAN, default false), limit_value (INT NULL = fara limita, pentru cote viitoare), updated_at; PK (plan_id, feature_key); rand lipsa = functie dezactivata (E-admin-platform-58) | 4.8/4.10/4.16 |

## 5.3 Coloane adăugate

| **Tabel** | **Coloane adăugate** | **Sursă** |
| --- | --- | --- |
| requests | project_score INT, project_size ENUM, includes_paid_design BOOLEAN DEFAULT FALSE, address_text/county/city/lat/lng, country VARCHAR(2) DEFAULT 'RO' (livrare internationala, F5 2026-07-08), budget_estimate_ron INT nullable (sliderul estimat din scor, F5; budget_range ramane pentru filtre/scoring), deleted_at, anonymized_at, last_edit_at, desired_deadline_bucket ENUM (inlocuieste desired_deadline DATE, overhaul 2026-07), delivered_at TIMESTAMPTZ nullable (momentul marcarii livrarii; auto-COMPLETED la 14 zile, D-L1-1 2026-08-23) | 4.5/4.1/4.3 |
| request_contact_preferences | channel ENUM(EMAIL/PHONE), value (validat ca format); priority ELIMINAT (overhaul 2026-07) | 4.2 |
| claim_slots | claimed_by_user_id, assigned_to_user_id (nullable), sla_deadline_at, sla_paused_at, project_size_snapshot, project_score_snapshot, claim_cost_credits_snapshot, withdrawn_at, status | 4.x |
| quotes | extra_versions_count INT DEFAULT 0, currency ENUM(RON/EUR) DEFAULT RON, accepted_version_id FK quote_versions NULL UNIQUE ON DELETE SET NULL (E-client-1: versiunea acceptata; NULL = neacceptata sau acceptata inainte de migrare → ultima versiune) | 4.13 |
| quote_version_room_prices | quote_version_id FK, request_room_id FK, price NUMERIC(12,2) — defalcarea pe camere a unei versiuni de oferta (F7 2026-07-08, item 22); scrisa o data cu versiunea; suma = price-ul versiunii (validat in service); UNIQUE(quote_version_id, request_room_id) | 4.13 |
| quote_versions | valid_until TIMESTAMPTZ (default trimitere + 14 zile), design_fee NUMERIC nullable | 4.13/4.1 |
| chat_threads | negotiation_ended_by_company BOOLEAN DEFAULT FALSE | 4.13 |
| subscription_plans | price_ron (>= 0; 0 = plan gratuit, necumparabil online), included_credits, marketplace_gating_delay_minutes (0/30/60); E-admin-platform-58: code (TEXT NOT NULL UNIQUE, identitatea planului, `^[A-Z][A-Z0-9_]{1,31}$`, imuabil), name_ro / name_en (TEXT NULL), tier devine LEGACY NULLABLE (DROP in release separat) | 4.10/4.16 |
| subscriptions | is_trial BOOLEAN, trial_ends_at TIMESTAMPTZ | 4.16 |
| users | language_preference ENUM(RO/EN) DEFAULT RO, two_factor_secret (nullable), two_factor_enabled BOOLEAN DEFAULT FALSE, blocked_at TIMESTAMPTZ nullable (blocare de admin — login/refresh/me refuza cu ACCOUNT_BLOCKED, D-L1-2 2026-08-23), terms_version/privacy_version VARCHAR(32) nullable (versiunile juridice acceptate; NULL = cont vechi → re-acceptare, E-admin-platform-2 2026-09-29; din 2026-10-04 re-acceptarea ruleaza doar cu `legal_reaccept_existing_users=true`) | 3.13/4.20 |
| penalty_events | applied_at TIMESTAMPTZ, expires_at = applied_at + 180d, scope (EMPLOYEE/COMPANY) | 4.12 |
| companies / company_locations | address_text/county/city/lat/lng; company_locations.coverage_radius_km NUMERIC DEFAULT 50; companies.is_vat_payer BOOLEAN NOT NULL DEFAULT false (E-company-19: platitor TVA declarat → cod TVA RO pe factura) | 3.8/4.8/4.17 |
| mock_billing_orders | invoice_series, invoice_number, vat_rate, seller_snapshot (jsonb), buyer_snapshot (jsonb, v2 cu isVatPayer), service_period_start / service_period_end TIMESTAMPTZ NULL (E-company-19: perioada abonamentului facturat), payment_claimed_at / transfer_reminder_sent_at TIMESTAMPTZ NULL (E-company-24: „Am platit” + reminder transfer bancar) | 4.17 |
| companies (facturare) | billing_email VARCHAR(254) NULL (E-company-24: email de facturare optional, doar OWNER/MANAGER) | 4.17 |
| domain_event_outbox | billing_contact_emailed_at TIMESTAMPTZ NULL (E-company-24: copia catre emailul de facturare, o data) | 4.17 |

## 5.4 Chei system_settings (seed)

quote_validity_default_days=14 · consultation_invite_expiry_days=7 · employee_penalty_threshold=9 · employee_block_months=3 · company_penalty_threshold=12 · company_suspension_months=6 · eur_ron_rate=5.2 · vat_rate=21 · trial_enabled=true · trial_plan=GOLD · trial_duration_days=30 · trial_bonus_credits=10 · expired_offer_autoclose_enabled=false · expired_offer_autoclose_days=14 · expired_offer_autoclose_credit_outcome=UNSET · delivery_reminder_days_before=3 (E-admin-platform-3) · legal_contact_email='' · legal_identity_published=false (E-admin-platform-2, 2026-09-29) · claims_open_after_first_offer=false (E-admin-platform-10, 2026-09-30; DECIZIE NECESARA PO, invarianta 3.1) · claim_contact_reveal_policy=ON_CLAIM · completed_claim_contact_retention_days=0 (E-company-3, 2026-09-30; DECIZIE NECESARA PO — implicitele pastreaza W1 si Î18) · credit_value_ron=1000 · claim_cost_min=1 · claim_cost_max=0 (E-company-21, 2026-10-01; 0 = fara plafon; DECIZIE NECESARA PO — valorile min/max) · bank_transfer_reminder_days=0 · bank_transfer_expiry_days=0 (E-company-24, 2026-10-01; zile calendaristice, 0 = oprit; DECIZIE NECESARA PO) · legal_reaccept_existing_users=false (hotfix 2026-10-04, decizie PO: re-acceptarea Termenilor/Politicii pentru conturile existente doar dupa revizuirea avocatului; admin accepta doar 'true'/'false')

## 5.5 Enum-uri (valori)

- project_size: SMALL, MEDIUM, LARGE

- budget_range: UNDER_5K, FROM_5K_TO_15K, OVER_15K, UNDISCLOSED

- room_type: KITCHEN, DRESSING, LIVING, OFFICE, BEDROOM, BATHROOM, PIECES (fallback "Alta piesa", formular liber), HALLWAY, PANTRY, LAUNDRY, BALCONY (camere noi 2026-07), PIECE_WARDROBE, PIECE_TV_UNIT, PIECE_BOOKCASE, PIECE_DESK, PIECE_BED, PIECE_DRESSER, PIECE_TABLE, PIECE_SHOE_CABINET, PIECE_NIGHTSTAND, PIECE_BENCH (piese ghidate individuale 2026-07, fiecare cu flow propriu)

- desired_deadline_bucket: ASAP, ONE_TO_THREE_MONTHS, THREE_TO_SIX_MONTHS, SIX_PLUS_MONTHS, FLEXIBLE

- material: PAL, MDF (legacy, nu se mai ofera in flow-uri), MDF_INFOLIAT, MDF_VOPSIT, MDF_FURNIR, LEMN_MASIV, ALTUL (material liber — textul clientului intra in request_items.description) — extindere 2026-07-08

- item_system: PUSH, GLISANTE, BUTON_PRESIUNE (legacy), MANER, GOLA, AVENTOS (doar corpuri suspendate in kitchen v2) — extindere 2026-07-08

- inspiration_color: WHITE, BLACK, GRAY, BEIGE, BROWN, NATURAL_WOOD, GREEN, BLUE, RED, YELLOW, MULTICOLOR — nou F6 2026-07-08 (filtru galerie inspiratie)

- inspiration_photos (F6): company_id FK (atelierul care a facut piesa — doar mobilier real al partenerilor), title, room_type ENUM, colors[]/materials[]/systems[] (filtre), image_url SAU attachment_id (upload prin presign, servit cu presigned GET), source_url TEXT nullable (R6 2026-07-12: linkul proiectului-sursa din portofoliul atelierului, afisat ca "Vezi proiectul"), published/featured BOOLEAN, deleted_at (soft delete — pozele pot fi referite de cereri); request_inspiration_photos (request_id, photo_id, note VARCHAR(200) nullable, request_room_id FK → request_rooms ON DELETE SET NULL, nullable — E-client-34 2026-10) — pozele alese de client ca inspiratie pe cerere (max 10), cu notita clientului (text liber: screening PHOTO_NOTE + mascare ca descrierea) si camera careia ii sunt destinate

- inspiration_boards (P6 2026-07-11, feedback PO r2 item 8): colectiile de salvari ale utilizatorului (stil Pinterest) — id, user_id FK (cascade), name (UNIQUE per user), created_at, updated_at; inspiration_board_items (board_id, photo_id, note VARCHAR(200) nullable, room_type ENUM nullable — E-client-34: notita privata + camera pentru care a salvat ideea, created_at, PK compus, cascade ambele FK-uri) — salvarile (o poza poate sta in mai multe colectii); doar poze publicate/nesterse (validate cu assertSelectable). Fara PII proprii → hard delete.

- chat_thread_reads (Q2 2026-07-12, idee 1 PO r2): marcajul "citit pana la" per utilizator per conversatie — chat_thread_id FK (cascade), user_id FK (cascade), last_read_at TIMESTAMPTZ, PK compus (chat_thread_id, user_id), index user_id. Necitit = mesajele ALTORA cu created_at > last_read_at (sau toate, daca nu exista rand). Fara PII proprii → hard delete.

- users.email_notifications_enabled BOOLEAN DEFAULT TRUE (Q4 2026-07-12, idee 5 PO r2): opt-out global pentru emailurile de notificare (oferta noua / mesaj nou / cerere preluata); notificarile in-app raman mereu active. Dezabonare din email prin link semnat HMAC (fara login) sau toggle in clopotel.

- contact_channel: EMAIL, PHONE

- company_member.role: OWNER, MANAGER, EMPLOYEE_TRUSTED, EMPLOYEE_MANAGED

- claim_slots.status: ACTIVE, OFFER_SENT, CANCELLED_UNASSIGNED, CANCELLED_BY_CLIENT, WITHDRAWN_VOLUNTARY, COMPLETED, CANCELLED_PROJECT, CANCELLED_OFFER_EXPIRED (E-admin-platform-3)

- request_project_cases: reason FIRM_UNRESPONSIVE, CLIENT_UNRESPONSIVE, MUTUAL_CANCEL_REQUEST, OTHER · opened_by CLIENT, COMPANY · status OPEN, CLOSED_PROJECT_CANCELLED, DISMISSED · response CONFIRMED_CANCEL, CONTESTED · settlement_outcome REFUND, CONSUME (E-admin-platform-3)

- claim_withdrawals.reason_type: CLIENT_UNRESPONSIVE_48H, REQUEST_MODIFIED_POST_CLAIM, CLIENT_CONTACT_INVALID, CLIENT_REQUESTED_CANCELLATION, VOLUNTARY_NO_REASON, CUSTOM

- claim_withdrawals.status: AUTO_APPROVED, PENDING_ADMIN_REVIEW, ADMIN_APPROVED, ADMIN_REJECTED

- physical_consultation_invites.status: PENDING_CLIENT, ACCEPTED, DECLINED, COMPLETED, EXPIRED

- quotes.currency: RON, EUR

- offer field_key: PRICE, DELIVERY_TERM, DELIVERY_DATE, WARRANTY, DESCRIPTION

- company status: PENDING_VERIFICATION, APPROVED, REJECTED, SUSPENDED

- request status: DRAFT, PUBLISHED/IN_MARKETPLACE, CLAIMED_PARTIAL, CLAIMED_FULL, OFFERS_RECEIVED, NEGOTIATION, ACCEPTED, IN_EXECUTION, DELIVERED_BY_COMPANY, COMPLETED, DISPUTED, EXPIRED, CANCELLED (E-admin-platform-3)

## 5.6 Relații principale

- companies 1—N company_members; companies 1—N company_locations; companies 1—1 subscription (activă); companies 1—1 company_credit_wallet.

- requests 1—N request_rooms 1—N request_items; requests 1—N claim_slots (max 3 active); requests 1—1 request_contact_preferences.

- claim_slots 1—1 chat_thread; claim_slots 1—N quotes 1—N quote_versions; quote_versions 1—N quote_change_requests.

- users 1—N refresh_tokens (o singură familie activă); penalty_events N—1 (company sau user, prin scope).

## Actualizari 2026-08-19 (Sprint L0)

- `users.terms_accepted_at TIMESTAMPTZ NULL` — momentul acceptarii Termenilor la inregistrare (obligatoriu la register din L0-A; userii vechi raman NULL).
- `claim_slots.status` primeste valoarea `CANCELLED_REQUEST_ACCEPTED` — toate sloturile nealese la acceptarea unei oferte (ACTIVE → refund, OFFER_SENT → consum pay-to-play; D-L0-3).
- `mock_billing_orders` + `stripe_session_id` (unic), `stripe_payment_intent_id`, `paid_at`, `cancelled_at`; `payment_source` ∈ {admin, webhook, stripe}; tabel nou `stripe_events(id, type, received_at)` pentru dedup webhook (D-L0-1).
- Abonamentul cumparat peste unul activ PRELUNGESTE randul activ (`expires_at = max(expires_at, now) + 30 zile`), nu creeaza rand nou (D-L0-2).
- Nota: sectiunile de mai sus (§5.1–5.6) sunt in urma fata de `schema.prisma` (vezi `docs/audit-2026-08-19/11-shared-prisma.md` P2) — sincronizarea completa e planificata in Sprint L2.
