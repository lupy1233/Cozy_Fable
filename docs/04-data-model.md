<!-- Product Bible Master v6 — Model de date complet. Sursa de adevar. Ierarhie la conflict: invariante (02) > decisions log (07) > reguli business (03). Nu ghici: marcheaza DECIZIE NECESARA si opreste-te. -->

# 5. Model de date complet

## 5.1 Entități păstrate (din v3/v4)

users, companies, company_members, company_locations, teams, company_verification_profiles, company_portfolio_items, subscription_plans, subscriptions, company_credit_wallets, credit_transactions, requests, request_versions, request_rooms, request_items, request_attachments, request_contact_preferences, claim_slots, claim_withdrawals, chat_threads, messages, message_attachments, clarification_requests, quotes, quote_versions, quote_change_requests, quote_attachments, penalty_events, reviews, review_disputes, notifications, audit_logs, admin_notes, system_settings, mock_billing_orders.

## 5.2 Tabele noi

| **Tabel** | **Coloane cheie** | **Sursă** |
| --- | --- | --- |
| project_sizing_config | id, category, option_key, option_label, points, is_active | 4.5 |
| project_size_thresholds | size (SMALL/MEDIUM/LARGE), min_points, max_points, claim_cost_credits (seed 1/2/4) | 4.5 |
| physical_consultation_invites | id, quote_id, company_id, location_address, proposed_datetime, alternative_datetimes (jsonb), status, client_response_text, created_at, responded_at, expires_at (= created_at + 7d) | 4.13 |
| quote_validity_extensions | id, quote_version_id, extended_by_days, extended_at, extended_by_user_id, previous_valid_until, new_valid_until | 4.13 |
| company_offer_field_permissions | id, company_id, role, field_key, can_edit | 4.13 |
| credit_packages | id, credits, price_ron, is_active | 4.16 |
| refresh_tokens | id, user_id, token_hash, family_id, rotated_from_id, expires_at, revoked_at, replaced_at | 3.13 |
| request_company_exclusions | id, request_id, company_id, reason (SLA_BREACH), created_at | 4.11 |
| penalty_rules | id, rule_key, points, is_active (configurabil Admin; seed: cele 3 abateri din 4.12) | 4.12 |

## 5.3 Coloane adăugate

| **Tabel** | **Coloane adăugate** | **Sursă** |
| --- | --- | --- |
| requests | project_score INT, project_size ENUM, includes_paid_design BOOLEAN DEFAULT FALSE, address_text/county/city/lat/lng, country VARCHAR(2) DEFAULT 'RO' (livrare internationala, F5 2026-07-08), budget_estimate_ron INT nullable (sliderul estimat din scor, F5; budget_range ramane pentru filtre/scoring), deleted_at, anonymized_at, last_edit_at, desired_deadline_bucket ENUM (inlocuieste desired_deadline DATE, overhaul 2026-07) | 4.5/4.1/4.3 |
| request_contact_preferences | channel ENUM(EMAIL/PHONE), value (validat ca format); priority ELIMINAT (overhaul 2026-07) | 4.2 |
| claim_slots | claimed_by_user_id, assigned_to_user_id (nullable), sla_deadline_at, sla_paused_at, project_size_snapshot, project_score_snapshot, claim_cost_credits_snapshot, withdrawn_at, status | 4.x |
| quotes | extra_versions_count INT DEFAULT 0, currency ENUM(RON/EUR) DEFAULT RON | 4.13 |
| quote_version_room_prices | quote_version_id FK, request_room_id FK, price NUMERIC(12,2) — defalcarea pe camere a unei versiuni de oferta (F7 2026-07-08, item 22); scrisa o data cu versiunea; suma = price-ul versiunii (validat in service); UNIQUE(quote_version_id, request_room_id) | 4.13 |
| quote_versions | valid_until TIMESTAMPTZ (default trimitere + 14 zile), design_fee NUMERIC nullable | 4.13/4.1 |
| chat_threads | negotiation_ended_by_company BOOLEAN DEFAULT FALSE | 4.13 |
| subscription_plans | price_ron, included_credits, marketplace_gating_delay_minutes (0/30/60) | 4.10/4.16 |
| subscriptions | is_trial BOOLEAN, trial_ends_at TIMESTAMPTZ | 4.16 |
| users | language_preference ENUM(RO/EN) DEFAULT RO, two_factor_secret (nullable), two_factor_enabled BOOLEAN DEFAULT FALSE | 3.13/4.20 |
| penalty_events | applied_at TIMESTAMPTZ, expires_at = applied_at + 180d, scope (EMPLOYEE/COMPANY) | 4.12 |
| companies / company_locations | address_text/county/city/lat/lng; company_locations.coverage_radius_km NUMERIC DEFAULT 50 | 3.8/4.8 |
| mock_billing_orders | invoice_series, invoice_number, vat_rate, seller_snapshot (jsonb) | 4.17 |

## 5.4 Chei system_settings (seed)

quote_validity_default_days=14 · consultation_invite_expiry_days=7 · employee_penalty_threshold=9 · employee_block_months=3 · company_penalty_threshold=12 · company_suspension_months=6 · eur_ron_rate=5.2 · vat_rate=21 · trial_enabled=true · trial_plan=GOLD · trial_duration_days=30 · trial_bonus_credits=10

## 5.5 Enum-uri (valori)

- project_size: SMALL, MEDIUM, LARGE

- budget_range: UNDER_5K, FROM_5K_TO_15K, OVER_15K, UNDISCLOSED

- room_type: KITCHEN, DRESSING, LIVING, OFFICE, BEDROOM, BATHROOM, PIECES (fallback "Alta piesa", formular liber), HALLWAY, PANTRY, LAUNDRY, BALCONY (camere noi 2026-07), PIECE_WARDROBE, PIECE_TV_UNIT, PIECE_BOOKCASE, PIECE_DESK, PIECE_BED, PIECE_DRESSER, PIECE_TABLE, PIECE_SHOE_CABINET, PIECE_NIGHTSTAND, PIECE_BENCH (piese ghidate individuale 2026-07, fiecare cu flow propriu)

- desired_deadline_bucket: ASAP, ONE_TO_THREE_MONTHS, THREE_TO_SIX_MONTHS, SIX_PLUS_MONTHS, FLEXIBLE

- material: PAL, MDF (legacy, nu se mai ofera in flow-uri), MDF_INFOLIAT, MDF_VOPSIT, MDF_FURNIR, LEMN_MASIV, ALTUL (material liber — textul clientului intra in request_items.description) — extindere 2026-07-08

- item_system: PUSH, GLISANTE, BUTON_PRESIUNE (legacy), MANER, GOLA, AVENTOS (doar corpuri suspendate in kitchen v2) — extindere 2026-07-08

- inspiration_color: WHITE, BLACK, GRAY, BEIGE, BROWN, NATURAL_WOOD, GREEN, BLUE, RED, YELLOW, MULTICOLOR — nou F6 2026-07-08 (filtru galerie inspiratie)

- inspiration_photos (F6): company_id FK (atelierul care a facut piesa — doar mobilier real al partenerilor), title, room_type ENUM, colors[]/materials[]/systems[] (filtre), image_url SAU attachment_id (upload prin presign, servit cu presigned GET), source_url TEXT nullable (R6 2026-07-12: linkul proiectului-sursa din portofoliul atelierului, afisat ca "Vezi proiectul"), published/featured BOOLEAN, deleted_at (soft delete — pozele pot fi referite de cereri); request_inspiration_photos (request_id, photo_id) — pozele alese de client ca inspiratie pe cerere (max 10)

- inspiration_boards (P6 2026-07-11, feedback PO r2 item 8): colectiile de salvari ale utilizatorului (stil Pinterest) — id, user_id FK (cascade), name (UNIQUE per user), created_at, updated_at; inspiration_board_items (board_id, photo_id, created_at, PK compus, cascade ambele FK-uri) — salvarile; doar poze publicate/nesterse (validate cu assertSelectable). Fara PII proprii → hard delete.

- chat_thread_reads (Q2 2026-07-12, idee 1 PO r2): marcajul "citit pana la" per utilizator per conversatie — chat_thread_id FK (cascade), user_id FK (cascade), last_read_at TIMESTAMPTZ, PK compus (chat_thread_id, user_id), index user_id. Necitit = mesajele ALTORA cu created_at > last_read_at (sau toate, daca nu exista rand). Fara PII proprii → hard delete.

- users.email_notifications_enabled BOOLEAN DEFAULT TRUE (Q4 2026-07-12, idee 5 PO r2): opt-out global pentru emailurile de notificare (oferta noua / mesaj nou / cerere preluata); notificarile in-app raman mereu active. Dezabonare din email prin link semnat HMAC (fara login) sau toggle in clopotel.

- contact_channel: EMAIL, PHONE

- company_member.role: OWNER, MANAGER, EMPLOYEE_TRUSTED, EMPLOYEE_MANAGED

- claim_slots.status: ACTIVE, OFFER_SENT, CANCELLED_UNASSIGNED, CANCELLED_BY_CLIENT, WITHDRAWN_VOLUNTARY, COMPLETED

- claim_withdrawals.reason_type: CLIENT_UNRESPONSIVE_48H, REQUEST_MODIFIED_POST_CLAIM, CLIENT_CONTACT_INVALID, CLIENT_REQUESTED_CANCELLATION, VOLUNTARY_NO_REASON, CUSTOM

- claim_withdrawals.status: AUTO_APPROVED, PENDING_ADMIN_REVIEW, ADMIN_APPROVED, ADMIN_REJECTED

- physical_consultation_invites.status: PENDING_CLIENT, ACCEPTED, DECLINED, COMPLETED, EXPIRED

- quotes.currency: RON, EUR

- offer field_key: PRICE, DELIVERY_TERM, DELIVERY_DATE, WARRANTY, DESCRIPTION

- company status: PENDING_VERIFICATION, APPROVED, REJECTED, SUSPENDED

- request status: DRAFT, PUBLISHED/IN_MARKETPLACE, CLAIMED_PARTIAL, CLAIMED_FULL, OFFERS_RECEIVED, NEGOTIATION, ACCEPTED, IN_EXECUTION, DELIVERED_BY_COMPANY, COMPLETED, DISPUTED, EXPIRED

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
