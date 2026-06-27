<!-- Sprint 0 — Arhitectura monorepo, module, model de date, endpoint map, flow-uri critice. Livrabil conform FIRST_ACTION din docs/05. Fara cod. -->

# Sprint 0 — Arhitectura si design

## 1. Arhitectura monorepo

```
marketplace-mobilier/
├── apps/
│   ├── backend/                  # NestJS + Prisma
│   │   ├── prisma/               # schema.prisma, migrations/, seed/
│   │   └── src/
│   │       ├── main.ts           # bootstrap: Helmet, CORS, ValidationPipe global, pino
│   │       ├── config/           # config.schema.ts (Zod fail-fast la boot)
│   │       ├── common/           # interceptors (audit, traceId), filters (error format 3.10),
│   │       │                     # guards (roles, subscription), decorators (@Audit, @Idempotent)
│   │       ├── infra/            # prisma/, redis/, storage/ (MinIO), mail/ (Mailpit),
│   │       │                     # event-bus/ (EventBusService), queues/ (BullMQ registry)
│   │       └── modules/          # un director per modul de business (lista in sectiunea 2)
│   ├── frontend/                 # Next.js 14 App Router
│   │   └── src/
│   │       ├── app/[locale]/     # next-intl (ro+en), rute in sectiunea 3
│   │       ├── components/       # shadcn/ui + componente de domeniu
│   │       ├── lib/              # api client (fetch + Idempotency-Key), socket client
│   │       ├── hooks/            # TanStack queries/mutations per domeniu
│   │       ├── stores/           # Zustand (DOAR UI state, vezi STATE_CONVENTIONS.md)
│   │       └── messages/         # ro.json, en.json
├── packages/
│   └── shared/                   # tipuri TS, scheme Zod comune, ERROR_CODES const, enums
├── dev-infra/
│   └── docker-compose.yml        # PostgreSQL 16, Redis, MinIO, Mailpit
├── docs/                         # Product Bible v6 + livrabile sprint
└── pnpm-workspace.yaml
```

Layering backend per modul: `controller → service → prisma` + DTO-uri cu class-validator/Zod; evenimente DOAR prin `EventBusService.publish` (3.5); joburi prin BullMQ.

## 2. Module backend (responsabilitati)

| Modul | Responsabilitate | Tabele principale |
| --- | --- | --- |
| `auth` | register/login/refresh rotation+grace 30s, sesiune unica, email verify mock, 2FA TOTP (flag off), guards | users, refresh_tokens |
| `users` | profil, language_preference, anonimizare GDPR (UserAnonymizationService) | users |
| `companies` | onboarding, verificare + risk flags, approve/reject, locatii cu coverage_radius_km, membri+roluri, matrice permisiuni oferta | companies, company_members, company_locations, company_verification_profiles, company_portfolio_items, company_offer_field_permissions, teams |
| `subscriptions` | planuri, trial (Gold 30d + 10 credite la approve), gating delay | subscription_plans, subscriptions |
| `credits` | wallet, RESERVE/CONSUME/REFUND, top-up cu Idempotency-Key | company_credit_wallets, credit_transactions, credit_packages |
| `billing` | facturi mock PDF (serie+numar secvential, TVA 21% snapshot, seller_snapshot) | mock_billing_orders |
| `payments` | confirm admin + webhook HMAC (3.7), PaymentsService.confirm(id, source) | mock_billing_orders, idempotency_keys |
| `requests` | draft anonim cu token, formular, editare (3 pre / 1 post-claim), expirare 5 zile lucratoare, repost, contact preferences | requests, request_versions, request_rooms, request_items, request_attachments, request_contact_preferences |
| `sizing` | ProjectSizingService.calculate → {score, size}; config admin | project_sizing_config, project_size_thresholds |
| `geo` | geocoding Nominatim via BullMQ 1 req/s, cache 90 zile, Haversine SQL | geocoding_cache |
| `marketplace` | listare cereri eligibile (gating + raza + excluderi), filtre | requests (read), request_company_exclusions |
| `claims` | claim tranzactional (3.1), self-assign, cap manager, atribuire 1h, retrageri (4.15) | claim_slots, claim_withdrawals, request_company_exclusions |
| `chat` | threads auto la claim, mesaje realtime, read-only la accept/end-negotiation | chat_threads, messages, message_attachments |
| `quotes` | oferte structurate, max 3 versiuni, change requests, valid_until+extensii, design_fee, RON/EUR, PDF, retragere 1 zi, consultanta fizica | quotes, quote_versions, quote_change_requests, quote_attachments, quote_validity_extensions, physical_consultation_invites |
| `sla` | business calendar (date-holidays + business_calendar_holidays), deadline materializat, clarificari SLA-pausing, ratare individuala/in masa | claim_slots (sla_*), clarification_requests, business_calendar_holidays |
| `penalties` | penalty_events 180d rolling, praguri 9/12, blocare angajat / suspendare firma | penalty_events, penalty_rules |
| `reviews` | review post-COMPLETED, <3 stele → dispute auto | reviews, review_disputes |
| `notifications` | consumer BullMQ al EventBus, in-app + email Mailpit | notifications |
| `uploads` | presign/complete/scan mock (3.4), limite 25MB/10/5 | attachments (request_/message_/quote_) |
| `admin` | KPI, firme, claim-uri, credite, penalizari, dispute, settings, audit viewer, jobs | admin_notes, system_settings, audit_logs |
| `audit` | interceptor + @Audit, append-only trigger DB | audit_logs |
| `health` | /api/v1/health (DB, Redis, MinIO) | — |

## 3. Zone frontend (rute principale)

| Zona | Rute |
| --- | --- |
| Public | `/` landing · `/login` · `/register` · `/verify-email` · `/requests/new` (draft anonim cu token) · `/pricing` |
| Client | `/client/requests` lista · `/client/requests/[id]` detaliu+oferte compare · `/client/requests/[id]/chat/[threadId]` · `/client/reviews` |
| Firma | `/company/onboarding` · `/company/dashboard` · `/company/marketplace` · `/company/claims` · `/company/claims/[id]` (chat+oferta) · `/company/team` · `/company/settings` (matrice permisiuni, locatii) · `/company/billing` (abonament, credite, facturi) |
| Admin | `/admin` KPI · `/admin/companies` · `/admin/requests` · `/admin/claims` · `/admin/penalties` · `/admin/disputes` · `/admin/payments` · `/admin/settings` · `/admin/audit` · `/admin/jobs` |

## 4. Endpoint map (REST, /api/v1)

**auth**: POST /auth/register · /auth/login · /auth/refresh · /auth/logout · /auth/verify-email · GET /auth/me · POST /auth/2fa/setup|verify (flag off)
**users**: PATCH /users/me · POST /users/me/anonymize
**companies**: POST /companies (onboarding) · GET/PATCH /companies/:id · POST /companies/:id/locations · PATCH/DELETE /companies/:id/locations/:locId · GET/POST/PATCH/DELETE /companies/:id/members · GET/PUT /companies/:id/offer-field-permissions · POST /companies/:id/portfolio
**subscriptions/credits**: GET /subscription-plans · POST /subscriptions (alege plan) · GET /credits/wallet · GET /credits/transactions · GET /credit-packages · POST /credits/purchase ⚿idem
**requests**: POST /requests/draft (anonim, token) · GET /requests/draft/:token · POST /requests (submit/publish) · GET /requests/:id · PATCH /requests/:id (reguli edit) · DELETE /requests/:id (soft) · POST /requests/:id/repost · GET/PUT /requests/:id/contact-preferences
**marketplace**: GET /marketplace/requests (filtre: size, judet, raza, gating aplicat server-side)
**claims**: POST /requests/:id/claim ⚿idem · POST /claims/:id/assign · POST /claims/:id/withdraw · GET /claims (ale firmei)
**chat**: GET /threads/:id · GET /threads/:id/messages · POST /threads/:id/messages (+ Socket.IO realtime)
**quotes**: POST /quotes ⚿idem · GET /quotes/:id · POST /quotes/:id/versions · POST /quotes/:id/accept ⚿idem · POST /quotes/:id/withdraw · POST /quote-versions/:id/change-requests · POST /change-requests/:id/reject · POST /quote-versions/:id/extend-validity · GET /quote-versions/:id/pdf · POST /quotes/:id/consultation-invites · POST /consultation-invites/:id/respond · POST /threads/:id/end-negotiation
**sla**: POST /claims/:id/clarifications · POST /clarifications/:id/answer
**delivery/review**: POST /claims/:id/delivered · POST /requests/:id/confirm-delivery · POST /reviews · GET /companies/:id/reviews
**uploads**: POST /uploads/presign · POST /uploads/:id/complete · GET /uploads/:id/download-url
**payments**: POST /webhooks/payment ⚿idem+HMAC · POST /admin/payments/:id/confirm
**admin**: GET /admin/kpi · GET/POST /admin/companies/:id/approve|reject · GET/PUT /admin/settings · GET/PUT /admin/penalty-rules · GET/PUT /admin/sizing-config · GET /admin/audit-logs · GET /admin/jobs · POST /admin/withdrawals/:id/approve|reject · GET /admin/disputes · POST /admin/disputes/:id/decide
**health**: GET /health

⚿idem = Idempotency-Key obligatoriu (3.2).

## 5. Flow-uri critice

### 5.1 Claim (invarianta 3.1)
1. `POST /requests/:id/claim` (Idempotency-Key) → check idempotency_keys.
2. TX Serializable, timeout 10s: `SELECT ... FOR UPDATE` pe requests.
3. status ∈ {IN_MARKETPLACE, CLAIMED_PARTIAL}? altfel `CLAIM_NOT_ALLOWED`.
4. count(claim_slots ACTIVE|OFFER_SENT) ≥ 3 → `CLAIM_SLOTS_FULL`.
5. Eligibilitate firma: APPROVED + abonament activ + gating deschis + raza Haversine OK + nu e in request_company_exclusions + credite ≥ cost (snapshot size) + regula 1-claim-activ pe assigned/claimed user + cap manager (4.9) + angajat ne-blocat de penalizari.
6. INSERT claim_slot (snapshots: score, size, cost) + credit_transaction RESERVE + chat_thread.
7. UPDATE request.status → CLAIMED_PARTIAL / CLAIMED_FULL.
8. Post-commit: EventBus `claim.created`; BullMQ delayed jobs: warning +30min, auto-cancel +1h daca neatribuit; job SLA deadline (sla_deadline_at = business days 3/3/5 + grace 12h).

### 5.2 Accept offer
1. `POST /quotes/:id/accept` (Idempotency-Key) → TX: lock request FOR UPDATE.
2. Valideaza: quote_version curenta ne-expirata (valid_until), request in stare ofertabila, clientul e ownerul.
3. quote → ACCEPTED; claim_slot castigator → COMPLETED-track (ramane activ pt executie); request.status → ACCEPTED.
4. Celelalte claim_slots: chat_threads read-only IMEDIAT; ofertele lor raman istoric.
5. Credite: castigatorul CONSUME definitiv; ne-castigatorii conform regulilor (fara refund automat — au concurat). Contact: daca preferinta = (4), se deschid telefon+email pentru castigator.
6. EventBus `quote.accepted`; notificari toate partile.

### 5.3 SLA breach individual
1. Worker BullMQ la sla_deadline_at + 12h grace: claim fara OFFER_SENT?
2. claim_slot → expirat (slot eliberat), credit conform 4.8 (fara refund — SLA ratat), penalty_event 3 pct scope EMPLOYEE (assigned/claimed user) + 3 pct scope COMPANY.
3. Evaluare praguri: SUM(points, expires_at > now()) ≥ 9 angajat → block 3 luni; ≥ 12 firma → SUSPENDED 6 luni.
4. request.status recalculat (CLAIMED_FULL → CLAIMED_PARTIAL / IN_MARKETPLACE); EventBus `sla.expiring_soon` inainte, `request.status_changed` dupa.

### 5.4 Ratare SLA in masa (toate 3)
1. Acelasi worker detecteaza al 3-lea breach → TX cu lock pe request.
2. Toate claim-urile expirate; 3 pct penalizare fiecarei firme (+ angajati).
3. INSERT request_company_exclusions (reason SLA_BREACH) pentru cele 3 firme.
4. request → IN_MARKETPLACE cu ceas NOU de expirare 5 zile lucratoare (D-v6-13), repost-ul clientului NU e consumat.
5. Client notificat; EventBus `request.status_changed`.

### 5.5 Payment confirm (3.7)
- Calea A: `POST /admin/payments/:id/confirm` (rol ADMIN).
- Calea B: `POST /webhooks/payment` {paymentId, status, signature} → verifica HMAC-SHA256 (secret .env) + Idempotency-Key + replay protection (key dedup 24h).
- Ambele → `PaymentsService.confirm(paymentId, source ∈ {admin, webhook})`: TX marcheaza mock_billing_order platit → activeaza abonament / crediteaza wallet (credit_transaction PURCHASE) → genereaza factura PDF (serie+numar secvential, vat_rate snapshot, seller_snapshot) → audit log cu source → EventBus + notificare.

## 6. Pseudo-prisma (conceptual)

```
enum ProjectSize { SMALL MEDIUM LARGE }
enum CompanyStatus { PENDING_VERIFICATION APPROVED REJECTED SUSPENDED }
enum CompanyMemberRole { OWNER MANAGER EMPLOYEE_TRUSTED EMPLOYEE_MANAGED }
enum RequestStatus { DRAFT IN_MARKETPLACE CLAIMED_PARTIAL CLAIMED_FULL OFFERS_RECEIVED
                     NEGOTIATION ACCEPTED IN_EXECUTION DELIVERED_BY_COMPANY COMPLETED DISPUTED EXPIRED }
enum ClaimSlotStatus { ACTIVE OFFER_SENT CANCELLED_UNASSIGNED CANCELLED_BY_CLIENT WITHDRAWN_VOLUNTARY COMPLETED }
enum WithdrawalReason { CLIENT_UNRESPONSIVE_48H REQUEST_MODIFIED_POST_CLAIM CLIENT_CONTACT_INVALID
                        CLIENT_REQUESTED_CANCELLATION VOLUNTARY_NO_REASON CUSTOM }
enum WithdrawalStatus { AUTO_APPROVED PENDING_ADMIN_REVIEW ADMIN_APPROVED ADMIN_REJECTED }
enum ConsultInviteStatus { PENDING_CLIENT ACCEPTED DECLINED COMPLETED EXPIRED }
enum Currency { RON EUR }
enum OfferFieldKey { PRICE DELIVERY_TERM DELIVERY_DATE WARRANTY DESCRIPTION }
enum Language { RO EN }
enum PenaltyScope { EMPLOYEE COMPANY }
enum UserRole { CLIENT COMPANY_USER ADMIN }
enum AttachmentStatus { PENDING_UPLOAD PENDING_SCAN SAFE BLOCKED }
enum CreditTxType { RESERVE CONSUME REFUND PURCHASE INCLUDED TRIAL_BONUS EXPIRE }
enum RoomType { KITCHEN DRESSING LIVING OFFICE BEDROOM BATHROOM }
enum Material { PAL MDF LEMN_MASIV }
enum ItemSystem { PUSH GLISANTE BUTON_PRESIUNE }

users(id, email UNIQUE, password_hash, name, phone, role UserRole,
      language_preference Language @default(RO), email_verified_at,
      two_factor_secret?, two_factor_enabled @default(false),
      deleted_at?, anonymized_at?, created_at)
refresh_tokens(id, user_id→users, token_hash, family_id, rotated_from_id?,
      expires_at, revoked_at?, replaced_at?)

companies(id, name, cui UNIQUE, reg_com, status CompanyStatus,
      address_text, county, city, lat, lng, rejected_until?, deleted_at, created_at)
company_members(id, company_id→companies, user_id→users, role CompanyMemberRole,
      blocked_until? /* penalizare angajat */)
company_locations(id, company_id, address_text, county, city, lat, lng,
      coverage_radius_km NUMERIC @default(50))
company_verification_profiles(id, company_id 1—1, risk_flags jsonb, submitted_at, decided_at, decided_by?)
company_portfolio_items(id, company_id, title, attachment_id)
company_offer_field_permissions(id, company_id, role, field_key OfferFieldKey, can_edit,
      @@unique(company_id, role, field_key))
teams(id, company_id, name)

subscription_plans(id, code SILVER|GOLD|PLATINUM, price_ron, included_credits,
      marketplace_gating_delay_minutes)
subscriptions(id, company_id, plan_id, status, is_trial, trial_ends_at?, starts_at, ends_at)
company_credit_wallets(id, company_id 1—1, balance, reserved)
credit_transactions(id, wallet_id, type CreditTxType, amount, claim_slot_id?, order_id?,
      expires_at? /* valabile 3 luni post-abonament */, created_at)
credit_packages(id, credits, price_ron, is_active)
mock_billing_orders(id, company_id, kind SUBSCRIPTION|CREDITS, amount_ron, status,
      invoice_series, invoice_number, vat_rate, seller_snapshot jsonb, confirmed_source?, created_at)

requests(id, client_user_id?→users /* null cat e draft anonim */, draft_token?,
      status RequestStatus, title, description, budget_range, desired_deadline,
      includes_paid_design @default(false), has_own_project,
      address_text, county, city, lat, lng,
      project_score INT, project_size ProjectSize,
      edits_pre_claim_count, edits_post_claim_count, last_edit_at,
      published_at, expires_at, reposted_at?, deleted_at?, anonymized_at?)
request_versions(id, request_id, snapshot jsonb, version_no, created_at)
request_rooms(id, request_id, room_type RoomType, length_m, width_m, height_m, linear_meters?)
request_items(id, room_id→request_rooms, name, material Material, systems ItemSystem[],
      description, quantity INT)
request_contact_preferences(id, request_id 1—1, option INT /* 1..5, 4.2 */)
request_company_exclusions(id, request_id, company_id, reason='SLA_BREACH', created_at)

claim_slots(id, request_id, company_id, claimed_by_user_id→users, assigned_to_user_id?→users,
      status ClaimSlotStatus, sla_deadline_at, sla_paused_at?,
      project_size_snapshot, project_score_snapshot, claim_cost_credits_snapshot,
      withdrawn_at?, created_at)
      -- partial unique: (assigned_to_user_id) WHERE status='ACTIVE' AND quote IS NULL
claim_withdrawals(id, claim_slot_id, reason_type WithdrawalReason, status WithdrawalStatus,
      custom_reason_text?, evidence_attachment_id?, decided_by?, decided_at?, created_at)

chat_threads(id, claim_slot_id 1—1, request_id, company_id, is_read_only @default(false),
      negotiation_ended_by_company @default(false), last_client_message_at?)
messages(id, thread_id, sender_user_id, body, created_at, deleted_at?)
message_attachments(id, message_id, attachment_id)
clarification_requests(id, claim_slot_id, question, answer?, asked_at, answered_at?,
      sla_extension_applied BOOLEAN)

quotes(id, claim_slot_id, company_id, status, currency Currency @default(RON),
      extra_versions_count INT @default(0), accepted_at?, withdrawn_at?, created_at)
quote_versions(id, quote_id, version_no 1..3, price, delivery_term_days, delivery_date?,
      warranty_months, description, design_fee?, valid_until /* +14d */, created_at)
quote_change_requests(id, quote_version_id, requested_changes text, status PENDING|ANSWERED|REJECTED,
      created_at, responded_at?)
quote_attachments(id, quote_version_id, attachment_id)
quote_validity_extensions(id, quote_version_id, extended_by_days, extended_at,
      extended_by_user_id, previous_valid_until, new_valid_until) -- max 2
physical_consultation_invites(id, quote_id, company_id, location_address, proposed_datetime,
      alternative_datetimes jsonb, status ConsultInviteStatus, client_response_text?,
      created_at, responded_at?, expires_at /* +7d */)

penalty_events(id, scope PenaltyScope, company_id?, user_id?, rule_key, points,
      applied_at, expires_at /* +180d */, claim_slot_id?)
penalty_rules(id, rule_key UNIQUE, points, is_active)

reviews(id, request_id, company_id, client_user_id, stars 1..5, text, created_at)
review_disputes(id, review_id 1—1, status, admin_decision?, decided_at?)

notifications(id, user_id, type, payload jsonb, read_at?, created_at)
attachments(id, owner_user_id, entity_type, entity_id, filename, mime_type, size_bytes,
      storage_key, status AttachmentStatus, created_at)
audit_logs(id, user_id?, role?, ip_hash, user_agent, action, entity_type, entity_id,
      before jsonb?, after jsonb?, trace_id, created_at) -- trigger append-only
admin_notes(id, admin_user_id, entity_type, entity_id, note, created_at)
system_settings(key PK, value, updated_at, updated_by?)
idempotency_keys(key, user_id, endpoint, request_hash, response_body jsonb,
      response_status, expires_at /* 24h */, @@unique(key, endpoint))
project_sizing_config(id, category, option_key, option_label, points, is_active)
project_size_thresholds(size ProjectSize PK, min_points, max_points, claim_cost_credits)
business_calendar_holidays(id, date DATE, label, source SEED|ADMIN)
geocoding_cache(id, query_normalized UNIQUE, lat, lng, provider, expires_at /* 90d */)
```

Relatii-cheie (5.6): companies 1—N members/locations, 1—1 subscription activa + wallet; requests 1—N rooms 1—N items, 1—N claim_slots (max 3 active), 1—1 contact_preferences; claim_slots 1—1 chat_thread, 1—N quotes 1—N quote_versions 1—N change_requests; users 1—N refresh_tokens (o familie activa).

## 7. Seed scoring (4.5) — PROPUS PENTRU REVIZUIRE

`project_sizing_config` (category / option_key / points):

| Categorie | Optiune | Puncte |
| --- | --- | --- |
| ROOM_TYPE | KITCHEN 8 · DRESSING 6 · LIVING 5 · BEDROOM 4 · OFFICE 3 · BATHROOM 3 | per camera |
| ROOM_SIZE (linear_meters) | UNDER_2M 1 · FROM_2_TO_4M 3 · OVER_4M 5 | per camera |
| MATERIAL | PAL 1 · MDF 2 · LEMN_MASIV 4 | per piesa |
| SYSTEM | BUTON_PRESIUNE 1 · PUSH 2 · GLISANTE 3 | per piesa (max per sistem ales) |
| ITEM_QUANTITY | QTY_1 0 · QTY_2_3 2 · QTY_4_PLUS 4 | per piesa |
| PAID_DESIGN | YES 2 | per cerere |
| BUDGET | UNDER_5K 1 · FROM_5K_TO_15K 3 · OVER_15K 5 | per cerere |

`project_size_thresholds` (seed): SMALL 0–14 → 1 credit · MEDIUM 15–29 → 2 credite · LARGE 30+ → 4 credite (D-v6-5).

Exemplu: bucatarie 3.5ml, 2 corpuri MDF cu glisante, buget 12k → 8+3+(2+3+2)+3 = 21 → MEDIUM, 2 credite.

## 8. Campuri formular cerere (4.1) — PROPUS PENTRU REVIZUIRE

**Cerere:** title · description · budget_range ENUM(UNDER_5K, FROM_5K_TO_15K, OVER_15K) · desired_deadline DATE · includes_paid_design BOOL · has_own_project BOOL (+ atasament proiect) · address_text + county + city (geocodate la submit) · contact preference (optiunile 1–5 din 4.2) · atasamente max 10.
**Per camera:** room_type ENUM(KITCHEN/DRESSING/LIVING/OFFICE/BEDROOM/BATHROOM) · length_m · width_m · height_m (NUMERIC, m; linear_meters derivat = length_m pentru scoring).
**Per piesa:** name · material ENUM(PAL/MDF/LEMN_MASIV) · systems multi-select(PUSH/GLISANTE/BUTON_PRESIUNE) · description · quantity INT ≥ 1.

## 9. Decizie PDF

**puppeteer** (HTML→PDF): factura RO si oferta au layout tabelar + diacritice + bilingv — template HTML/CSS cu next-intl strings reutilizate e mult mai usor de intretinut decat desen imperativ pdfkit. Cost: Chromium in dev; acceptat pentru MVP. Rulat in worker BullMQ, nu in request path.

## 10. Riscuri tehnice

1. **Serializable + FOR UPDATE sub concurenta** — retry pe 40001 (serialization failure) cu backoff, max 3.
2. **Business calendar** — Paste Ortodox nu e in date-holidays fix → tabel business_calendar_holidays seeded 2025–2028 (3.3); test unitar dedicat.
3. **Recalcul SLA la clarificari** — exclusiv via worker (nu la citire); risc de drift daca jobul esueaza → joburi vizibile in /admin/jobs + retry.
4. **Nominatim public rate-limit** — coada BullMQ dedicata 1 req/s + cache 90 zile; fallback: input manual lat/lng admin.
5. **Sesiune unica + Socket.IO** — la login nou trebuie emis auth_expired pe socketul vechi prin Redis adapter; test manual multi-tab.
6. **Idempotenta** — hash request body stabil (sortare chei) altfel false 409.
7. **puppeteer pe Windows dev** — daca instalarea Chromium e problematica, fallback pdfkit doar pentru dev (interfata PdfService ramane stabila).

## 11. DECIZII NECESARE

Niciuna blocanta. Itemii marcati „PROPUS PENTRU REVIZUIRE" (scoring seed §7, campuri formular §8, alegerea puppeteer §9, presupunerea IN_MARKETPLACE vs PUBLISHED) asteapta confirmarea umana inainte de Sprint 1, conform D-v6-2 si 0.5.
