<!-- Product Bible Master v6 — Invariante tehnice — NON-NEGOCIABILE. Sursa de adevar. Ierarhie la conflict: invariante (02) > decisions log (07) > reguli business (03). Nu ghici: marcheaza DECIZIE NECESARA si opreste-te. -->

# 3. Invariante tehnice (non-negociabile)

*Reguli tehnice pe care NU le poți schimba. Dacă o regulă business pare în conflict, oprește-te și cere clarificare.*

### 3.1 Concurrency pe claim

Operațiunea de claim este tranzacțională (isolationLevel Serializable, timeout 10s) cu SELECT ... FOR UPDATE pe rândul din requests. Pași autoritativi:

- Lock pe request (FOR UPDATE).

- Verifică status ∈ {IN_MARKETPLACE, CLAIMED_PARTIAL}; altfel ClaimNotAllowed.

- count(claim_slots WHERE status ∈ {ACTIVE, OFFER_SENT}); dacă ≥ 3 → ClaimSlotsFull.

- Verifică firma: eligibilitate + credite suficiente + regula 1-claim-activ-fără-ofertă + excluderi (request_company_exclusions).

- Insert claim_slot + credit_transaction(RESERVE) + chat_thread.

- Update request.status dacă devine CLAIMED_PARTIAL / CLAIMED_FULL.

Toate operațiile care modifică numărul de claim_slots active ale unui request folosesc același pattern de lock.

### 3.2 Idempotență pentru POST critice

Header Idempotency-Key (UUID v4 generat de frontend) pe: POST /requests/:id/claim, /quotes/:id/accept, /quotes, /webhooks/payment, /credits/purchase. Tabel idempotency_keys (key, user_id, endpoint, request_hash, response_body, response_status, expires_at), dedup 24h. Match key+endpoint+hash → răspuns cached; key+endpoint dar hash diferit → 409 Conflict.

### 3.3 Timezone și calendar

Toate datetime-urile în PostgreSQL ca TIMESTAMPTZ în UTC. SLA și calendar de business în Europe/Bucharest. Zile lucrătoare: npm date-holidays (sărbători fixe) + tabel business_calendar_holidays (Paște Ortodox + a doua zi, 2025–2028, + override admin pentru punți guvernamentale). SLA materializat în claim_slots.sla_deadline_at la momentul claim-ului; recalculele după clarificări actualizează coloana via worker, nu se calculează la fiecare citire.

**Clarificare ceasuri operaționale (D-v6-9): **ceasurile scurte sunt ORE CALENDARISTICE (wall-clock), NU zile lucrătoare: atribuirea manager (1h), warning-ul (+30 min), grația de retragere voluntară (30 min), CLIENT_UNRESPONSIVE_48H (48h), SLA admin pentru anulări custom (48h), grace period SLA (12h). Doar SLA-ul de ofertă (3/5 zile) și expirarea cererii (5 zile) folosesc zile lucrătoare.

### 3.4 Storage și fișiere

StorageService expune getPresignedUploadUrl / getPresignedDownloadUrl / deleteObject. Flow obligatoriu:

- POST /uploads/presign (filename, mimeType, size, entityType, entityId) → backend validează → row attachments PENDING_UPLOAD → presigned PUT 15 min.

- Frontend face PUT direct la MinIO/S3.

- POST /uploads/:id/complete → backend verifică obiectul → PENDING_SCAN → enqueue scan.

- Worker mock-scan: 2s → SAFE (sau BLOCKED dacă numele conține „malware”).

- La citire: presigned GET 5 min, doar cu auth check inline.

Fișierele NU sunt accesibile prin URL static și NU se servesc prin endpoint NestJS. Limite: 25MB/fișier, 10 fișiere/cerere, 5 fișiere/ofertă. ZIP permis dar untrusted, fără preview.

### 3.5 Socket.IO și realtime

Auth socket cookie-based (același httpOnly cookie). La handshake, middleware validează access token; expirat → event auth_expired → client face refresh + reconectare. Evenimentele se emit DOAR prin EventBusService.publish(event, payload) (controllerele nu emit direct), care emite pe Socket.IO + enqueue BullMQ pentru notifications. Redis adapter obligatoriu de la Sprint 1. Evenimente minime: claim.created, claim.withdrawn, quote.created, quote.updated, quote.accepted, message.created, request.status_changed, sla.expiring_soon.

### 3.6 Frontend state boundaries

- TanStack Query: orice date din API (single source of truth).

- Zustand: doar UI state pur (modale, sidebar, draft local pre-submit, filtre, theme). Niciodată date din API.

- React Hook Form: doar state-ul formularului în completare.

- Optimistic updates prin TanStack mutate (onMutate/onError), nu prin Zustand. Dacă apare nevoia de a duplica server state în Zustand, oprește-te și cere clarificare.

- Livrabil Sprint 0: STATE_CONVENTIONS.md cu 5 exemple (creare cerere, claim, ofertă, chat, dashboard).

### 3.7 Webhook plată mock

Calea A (UI admin): POST /admin/payments/:id/confirm. Calea B (webhook): POST /webhooks/payment {paymentId, status, signature}, signature = HMAC-SHA256 cu secret din .env + Idempotency-Key + replay protection. Ambele apelează PaymentsService.confirm(paymentId, source), source ∈ {admin, webhook}, înregistrat în audit log.

### 3.8 Geocoding

Nominatim (public cu user-agent custom + rate limit 1 req/s via BullMQ dedicat, sau self-host mediagis/nominatim). Write-time (la submit cerere și la setare locație firmă): salvezi address_text + lat + lng. geocoding_cache (query_normalized, lat, lng, provider, expires_at), TTL 90 zile. Filtre de rază: Haversine în SQL (PostGIS opțional la scalare).

### 3.9 Audit log

NestJS interceptor + decorator @Audit('action'). Captează userId, role, IP (hashed cu salt din .env), userAgent, entityType, entityId, timestamp. Before/after snapshots DOAR pentru câmpuri non-sensibile declarate explicit. NICIODATĂ parole, token-uri, conținut mesaje (doar metadata: cine, când, ce thread). Append-only enforced la nivel DB prin trigger BEFORE UPDATE OR DELETE pe audit_logs care RAISE EXCEPTION.

### 3.10 Erori și format răspuns

Format unic: { error: { code, message, details, timestamp, traceId } }. Coduri UPPER_SNAKE_CASE documentate în ERROR_CODES.md. Frontend mapează codurile la mesaje localizate (RO + EN); nu folosește message direct decât ca fallback.

### 3.11 Observabilitate minimă

Logging structurat JSON (pino sau Nest Logger) cu traceId per request. Health la /api/v1/health (DB, Redis, MinIO). Jobs BullMQ eșuate vizibile în /admin/jobs (bull-board sau UI minim).

### 3.12 Soft delete și GDPR

Entitățile cu PII au deleted_at TIMESTAMPTZ nullable; Prisma middleware filtrează automat WHERE deleted_at IS NULL. UserAnonymizationService.anonymizeUser(userId) înlocuiește email/name/phone cu hash + marchează anonymized_at. Audit log păstrează doar userId (nu poate fi de-anonimizat).

### 3.13 Auth, sesiuni, 2FA

- Refresh token rotation la fiecare refresh, cu grace period 30s pentru race conditions multi-tab. Reuse după grace → revocă toată familia de token-uri (detecție furt).

- O singură sesiune activă per user: login nou pe alt device invalidează sesiunea anterioară (revocă refresh_tokens active, emite familie nouă, socketul vechi primește auth_expired).

- 2FA (TOTP via otplib) IMPLEMENTAT arhitectural (schema, rute, UI) dar INACTIV în MVP, comutabil prin feature flag pentru V1. TwoFactorGuard este no-op cât flag-ul e off.

- Parole bcrypt cost 12, niciodată în log/audit/response. Secrets în .env validate la boot cu Zod (config.schema.ts) — boot fail-fast dacă lipsesc. Rate limiting: 5/min /auth/login, 10/min /claim, 30/min /upload, 100/min global per IP. CORS strict, Helmet + CSP.
