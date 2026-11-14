<!-- Product Bible Master v6 — Invariante tehnice — NON-NEGOCIABILE. Sursa de adevar. Ierarhie la conflict: invariante (02) > decisions log (07) > reguli business (03). Nu ghici: marcheaza DECIZIE NECESARA si opreste-te. -->

# 3. Invariante tehnice (non-negociabile)

*Reguli tehnice pe care NU le poți schimba. Dacă o regulă business pare în conflict, oprește-te și cere clarificare.*

### 3.1 Concurrency pe claim

Operațiunea de claim este tranzacțională (isolationLevel Serializable, timeout 10s) cu SELECT ... FOR UPDATE pe rândul din requests. Pași autoritativi:

- Lock pe request (FOR UPDATE).

- Verifică status ∈ {IN_MARKETPLACE, CLAIMED_PARTIAL, OFFERS_RECEIVED, NEGOTIATION}; altfel ClaimNotAllowed. Cererea rămâne preluabilă și după prima ofertă, până se ocupă locurile (pasul următor) sau clientul acceptă o ofertă. Comutatorul din Admin `system_settings.claims_open_after_first_offer` (implicit `true`) poate reveni la setul {IN_MARKETPLACE, CLAIMED_PARTIAL}. CLAIMED_FULL nu e niciodată preluabil. (amendat 2026-11-13, PO: a1-1)

- count(claim_slots WHERE status ∈ {ACTIVE, OFFER_SENT}); dacă ≥ 3 → ClaimSlotsFull.

- Verifică firma: eligibilitate + credite suficiente + regula 1-claim-activ-fără-ofertă + excluderi (request_company_exclusions).

- Insert claim_slot + credit_transaction(RESERVE) + chat_thread.

- Update request.status dacă devine CLAIMED_PARTIAL / CLAIMED_FULL.

Toate operațiile care modifică numărul de claim_slots active ale unui request folosesc același pattern de lock.

### 3.2 Idempotență pentru POST critice

Header Idempotency-Key (UUID v4 generat de frontend) pe: POST /requests/:id/claim, /quotes/:id/accept, /quotes, /webhooks/payment, /credits/purchase. Tabel idempotency_keys (key, user_id, endpoint, request_hash, response_body, response_status, expires_at), dedup 24h. Match key+endpoint+hash → răspuns cached; key+endpoint dar hash diferit → 409 Conflict.

Adaugare 2026-11-13 (etapa 4, PO a4-1): si POST /client/quotes/:id/decline (refuzul ofertei de catre client; cheie tranzactionala, ca la acceptare — raspunsul se salveaza in aceeasi tranzactie cu refuzul).

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

Fișierele NU sunt accesibile prin URL static și NU se servesc prin endpoint NestJS. Limite: 25MB/fișier, 10 fișiere la nivel de cerere + 8 pe cameră (7 schițe + instantaneul 3D), camerele numărate până la cel mult 50 (`maxAttachmentsForRequest` din shared), 5 fișiere/ofertă (amendat 2026-11-13, b5: limita pe cameră exista din feedbackul PO 2026-07-13, invarianta nu fusese adusă la zi). Interfața verifică înainte de trimitere tipul (cu extensia ca rezervă când browserul nu dă tip), fișierul gol și 25MB, cu aceleași constante din shared; serverul rămâne autoritar (presign răspunde `FILE_TYPE_NOT_ALLOWED` / `FILE_TOO_LARGE` / `FILE_LIMIT_REACHED`). ZIP permis dar untrusted, fără preview.

Adaugare 2026-11-14 (etapa 9, f6 — docs/07 D-E9-7, D-E9-33, D-E9-36): ștergerea ciornelor vechi (jobul `cleanup.drafts`, coada `draft-cleanup`) merge pe fiecare ciornă în trei pași: (1) sub `FOR UPDATE` pe rândul `requests` reverifică `status = 'DRAFT'` și pragul (sau `deleted_at` deja pus) și o marchează ștearsă, cu `draft_token_hash` golit (după commit tokenul nu mai deschide ciorna); (2) șterge din storage obiectele atașamentelor ei, doar dacă nicio altă linie din `attachments` nu folosește aceeași cheie; (3) sub o a doua blocare șterge rândurile `attachments` și ciorna (`deleteMany` condiționat de `DRAFT` + `deleted_at`). O ciornă publicată sau atinsă între timp e sărită; un eșec de storage se reia la rularea următoare. Publicarea citește ciorna sub `FOR UPDATE`; o ciornă marcată ștearsă → `DRAFT_TOKEN_INVALID`. Jobul nu atinge niciodată cererile publicate sau fișierele lor.

Corectat după revizuirea de cod (2026-11-14 — D-E9-33, D-E9-43 … D-E9-45):
- Listarea candidaților se face cu SQL brut (`$queryRaw`, `listCandidates`), NU prin Prisma: filtrul de ștergere logică (`softDeleteReads`) adaugă `deleted_at IS NULL` la orice `findMany` pe `Request` și ar ascunde ciornele aruncate. Listarea ia doar `status = 'DRAFT'`: fie cu `deleted_at` pus de peste 30 de minute (`DRAFT_CLEANUP_DELETED_GRACE_MS`, ca o urcare sau o sigilare în curs să se termine), fie neatinse peste prag; ordonat după `id`, pe loturi. Starea se reverifică în continuare sub `FOR UPDATE`.
- La pasul (3) rândurile `attachments` se șterg doar pe perechile (`id`, `storage_key`) șterse din storage la pasul (2); un rând a cărui cheie s-a schimbat între timp rămâne, ciorna e sărită și se reia la rularea următoare (nicio cheie nouă orfană).
- Salvarea automată (`patchDraft`) scrie cu `updateMany` condiționat pe `status = 'DRAFT'` și `deleted_at IS NULL`; fără rând atins → 404 `DRAFT_TOKEN_INVALID`.
- Editarea după preluare: limitele de editare (`assertEditableAndCount`) se reverifică în tranzacția editării, pe valorile citite cu `SELECT … FOR UPDATE` pe rândul cererii, iar contoarele se scriu pe același rând; două salvări simultane nu pot trece amândouă (`EDIT_LIMIT_POST_CLAIM_REACHED`). Verificarea dinaintea tranzacției rămâne doar ca refuz rapid.

### 3.5 Socket.IO și realtime

Auth socket cookie-based (același httpOnly cookie). La handshake, middleware validează access token; expirat → event auth_expired → client face refresh + reconectare. Evenimentele se emit DOAR prin EventBusService.publish(event, payload) (controllerele nu emit direct), care emite pe Socket.IO + enqueue BullMQ pentru notifications. Redis adapter obligatoriu de la Sprint 1. Evenimente minime: claim.created, claim.withdrawn, quote.created, quote.updated, quote.accepted, message.created, request.status_changed, sla.expiring_soon.

Adaugare 2026-11-13 (etapa 4): quote.declined (refuzul clientului, catre membrii firmei: clopotel + e-mail cu motivul; prin outbox) si quote.updated cu `kind` (`CHANGE_REQUESTED` → e-mail firmei; `NEW_VERSION` + `version` → e-mail clientului). Mesajele de sistem din conversatie nu publica message.created.

Adaugare 2026-11-14 (etapa 5): execution.stage_updated (firma castigatoare a bifat o etapa de executie; doar catre clientul cererii, clopotel fara e-mail; prin outbox, cheie fixa `execution.stage_updated:<requestId>:<stage>` — cel mult o notificare pe etapa, re-bifarea nu mai anunta; payload `{ requestId, stage, companyId, companyName, requestTitle }`; debifarea nu publica nimic) si request.no_coverage (cerere publicata fara nicio firma care acopera zona; catre administratorii activi — nestersi, neblocati, neanonimizati —, clopotel + e-mail; acoperirea si destinatarii se citesc inaintea tranzactiei publicarii (o eroare nu opreste publicarea), iar inregistrarea in outbox se face in tranzactie, cheie `request.no_coverage:<requestId>`; payload `{ requestId, requestTitle, city, county }`). Semnalul de sesiune `auth_expired` (nu e eveniment de domeniu) merge din 2026-11-14 doar la socketurile sesiunilor revocate (3.13).

Adaugare 2026-11-14 (etapa 7): request.company_withdrew (o firma a renuntat la preluare — voluntar, motiv validat automat sau retragere aprobata de admin; doar catre clientul cererii, clopotel + e-mail; prin outbox, cheie `request.company_withdrew:<claimSlotId>` — o singura data pe preluare; payload `{ requestId, requestTitle }`, fara numele firmei; inchiderile automate nu il publica — D-E7-5) si documents.pdf_failed (un PDF — oferta, proforma, factura — nu s-a putut genera; catre adminii activi, clopotel fara e-mail; prin outbox, cheie `documents.pdf_failed:<YYYY-MM-DD>` in Europe/Bucharest — cel mult o alerta pe zi; payload `{ day, kind }`; inregistrarea alertei nu ascunde niciodata eroarea originala; cel mult o incercare pe zi pe proces, iar pe slotul standby (`DEPLOYMENT_MODE=standby`) doar jurnal, fara scriere in baza — D-E7-17, D-E7-24).

Adaugare 2026-11-14 (etapa 9, g1 + e3 — docs/07 D-E9-5, D-E9-17 … D-E9-22, D-E9-28, D-E9-30), toate prin outbox, in aceeasi tranzactie cu schimbarea:
- request.published — doar clientul, doar e-mail (randul din `notifications` exista, dar e ascuns din clopotel si din necitite: `EMAIL_ONLY_EVENTS`); chei `request.published:<requestId>:client` (publicare) si `request.published:<requestId>:repost` (ambele republicari); payload `{ requestId, requestTitle, clientUserId, expiresAt }`.
- request.new_in_area — membrii activi ai unei firme care vede cererea in lista din piata (`MarketplaceService.list` cu intarzierea planului); doar clopotel; scris de jobul `scan.new-in-area` (coada `new-requests`, la 60 s; dupa revizuire doar perechile cerere + firma devenite vizibile in ultimele 20 de minute, fereastra de cautare = intarzierea maxima a planurilor + 20 min + 30 s; lista se cere doar pentru firmele cu o pereche scadenta; firmele eligibile tinute 5 min in memorie — D-E9-19, D-E9-41); cheie `request.new_in_area:<requestId>:<companyId>` (o data pe cerere si firma, pe viata, si la republicare); payload `{ requestId, requestTitle, companyId }`, titlul mascat (`maskFreeText`) si in `EventBusService.publish`, pentru ca outbox-ul il rehidrateaza brut. E-mailul e rezumatul zilnic `digest.new-requests` (08:00, OWNER / MANAGER), nu acest eveniment.
- clarification.asked — clientul (clopotel + e-mail); clarification.answered — membrii firmei (clopotel; e-mail dupa regula de mai jos); chei `clarification.asked:<clarificationId>` / `clarification.answered:<clarificationId>`.
- request.edited_after_claim — membrii firmei, cate unul pe fiecare preluare `ACTIVE` / `OFFER_SENT`; cheie `request.edited_after_claim:<claimSlotId>:<nr. editarii dupa preluare>`. Clopotel + e-mail.
- Payload-ul celor trei de mai sus: `{ requestId, requestTitle, claimSlotId, companyId, companyName, clientUserId, actorUserId }`.
- Reguli comune: `actorUserId` (cine a facut actiunea) e scos din destinatari, la clopotel si la e-mail, intr-un singur loc (`withoutActor`, procesorul cozii de notificari); socketul il primeste in continuare (invalidare de cache). Campul e pus si pe message.created (+ `claimSlotId`), quote.created si quote.updated NEW_VERSION (dupa revizuire), quote.accepted, quote.declined, quote.updated (CHANGE_REQUESTED), delivery.confirmed si review.created (+ `companyId`). La message.created (scris de client), quote.accepted, quote.updated (CHANGE_REQUESTED), quote.declined, clarification.answered, request.edited_after_claim, delivery.confirmed, review.created e-mailul catre firma merge doar la responsabilul preluarii + OWNER / MANAGER (`claimCompanyEmailRecipients`); restul membrilor au doar clopotelul.

### 3.6 Frontend state boundaries

- TanStack Query: orice date din API (single source of truth).

- Zustand: doar UI state pur (modale, sidebar, draft local pre-submit, filtre, theme). Niciodată date din API.

- React Hook Form: doar state-ul formularului în completare.

- Optimistic updates prin TanStack mutate (onMutate/onError), nu prin Zustand. Dacă apare nevoia de a duplica server state în Zustand, oprește-te și cere clarificare.

- Livrabil Sprint 0: STATE_CONVENTIONS.md cu 5 exemple (creare cerere, claim, ofertă, chat, dashboard).

- Memoria ciornei din browser (adăugat 2026-11-13, etapa 2, b8 / b2 / b3): ciorna cererii noi stă în localStorage, cheia `mm_configurator_v1` (versiunea persist 5). Editarea unei cereri publicate are memoria ei, în sessionStorage, pe o cheie per cerere `mm_configurator_edit_v1:<id>` (`apps/frontend/src/stores/configurator-keys.ts`); editarea nu scrie niciodată în ciorna nouă. La ieșirea din editare memoria editării se aruncă și store-ul revine imediat pe ciorna nouă; cheia din sessionStorage se șterge după o fereastră scurtă de reluare (`EDIT_RESUME_WINDOW_MS` = 2 s), ca remontarea aceleiași cereri (schimbarea limbii, StrictMode) să reia editarea. Se aruncă imediat la deschiderea altei cereri în editare, la montarea `/requests/new`, la deconectare și după „Salvează modificările”. „Date generale” se scriu în ciornă la ~400 ms după ultima schimbare, fără validare (validarea strictă rămâne la „Continuă la sumar”); după publicare salvarea ciornei se oprește, iar memoria se golește abia la plecarea de pe pagină.

- Paginile cu cont (adăugat 2026-11-14, etapa 7, f4 + reparația buclei de la sesiunea pierdută — D-E7-7, D-E7-8): `useMe` are `retryOnMount: false` — după un `/auth/me` eșuat, „cine sunt eu” nu se reia singur la montarea unei componente noi, ci doar explicit (login, logout, semnalul de sesiune pierdută, socketul, refetch). O pagină cu cont NU montează componente care cer cont (`useMe`, `useWallet`, mesajul de abonament…) cât „cine sunt eu” e în încărcare SAU în eroare: arată scheletul până la redirect. Garda e comună: `useRequireAuth(rol?)` din `apps/frontend/src/lib/require-auth.tsx` (`loading` / `ok` / `wrongRole`; fără sesiune → `/login?redirect=…` prin `safeRedirect`; rol greșit → `RoleOnlyScreen`). Nicio pagină nu mai face `router.replace('/login')` sau `router.replace('/dashboard')` pe rol de mână. După revizuire (D-E7-21): `useMe` are și `refetchOnWindowFocus: (query) => query.state.status === 'error'` — reia „cine sunt eu” la revenirea în tab DOAR cât e în eroare (o cerere, `retry: false`), ca un tab rămas „vizitator” să afle de un login făcut în alt tab; cu sesiunea bună nu se cere nimic, iar restul aplicației rămâne cu `refetchOnWindowFocus: false` (`providers.tsx`).

- Regulile de editare ale pieselor 3D (adăugat 2026-11-14, etapa 9, l1 — docs/07 D-E9-12): limitele noi (front de sertar ≤ 50 cm, coloană de bibliotecă ≤ 80 cm, comoda TV ≥ 35 cm, diametrul mesei pe tip) stau în `applyPieceEditRules` (shared `questionnaire/piece3d/edit-rules.ts`; funcție pură, idempotentă), aplicată prin `editPieceConfig` doar la crearea, editarea și redeschiderea unei ciorne în pasul 3D. Schema `pieceConfig3dSchema` și `normalizePieceConfig` rămân permisive, deci o regulă nouă de editare nu schimbă validarea, prețul sau textul cererilor deja publicate (aceeași regulă ca la etapele 5 și 8: fluxurile și instantaneele rămân identice).

### 3.7 Webhook plată mock

Calea A (UI admin): POST /admin/payments/:id/confirm. Calea B (webhook): POST /webhooks/payment {paymentId, status, signature}, signature = HMAC-SHA256 cu secret din .env + Idempotency-Key + replay protection. Ambele apelează PaymentsService.confirm(paymentId, source), source ∈ {admin, webhook}, înregistrat în audit log.

### 3.8 Geocoding

Nominatim (public cu user-agent custom + rate limit 1 req/s via BullMQ dedicat, sau self-host mediagis/nominatim). Write-time (la submit cerere și la setare locație firmă): salvezi address_text + lat + lng. geocoding_cache (query_normalized, lat, lng, provider, expires_at), TTL 90 zile. Filtre de rază: Haversine în SQL (PostGIS opțional la scalare).

Adăugare 2026-11-14 (etapa 7, b12 — D-E7-9): geocodarea cererii folosește doar `address_text`, orașul, județul și țara; `requests.address_details` („Bloc, scară, apartament”) nu se trimite niciodată la geocodare.

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

- ~~O singură sesiune activă per user: login nou pe alt device invalidează sesiunea anterioară (revocă refresh_tokens active, emite familie nouă, socketul vechi primește auth_expired).~~ Înlocuit la 2026-11-13 de hotărârea PO f3-1 (docs/07 Î12, D-E5-10), implementat în etapa 5:

- Cel mult 5 sesiuni active per user (`MAX_ACTIVE_SESSIONS = 5`, `auth.constants.ts`). O sesiune = o familie de refresh tokens (`family_id` = `sid` din access token); activă = are cel puțin un token nerevocat și neexpirat. Un login nou peste limită revocă cea mai veche familie (după primul token al familiei, chiar dacă a fost rotită recent), în aceeași tranzacție cu emiterea familiei noi, sub `FOR UPDATE` pe rândul utilizatorului (login-uri simultane nu depășesc limita). `auth_expired` ajunge DOAR la socketurile sesiunilor revocate (după `sid`, `EventsGateway.expireSessions`), nu la toate ale contului. Logout = doar sesiunea curentă (familia ei + socketurile ei). Schimbarea parolei (`issueNewFamily(..., { revokeAll: true })`, dispozitivul curent primește familie nouă), resetarea parolei și blocarea contului de admin revocă toate sesiunile și trimit `auth_expired` la toate socketurile contului. Rotația cu grace și detecția de reutilizare de mai sus rămân neschimbate (reutilizarea revocă doar familia ei). Frontend: refresh eșuat → un singur semnal global „sesiune pierdută” (cel mult o dată la 5 s); de pe paginile cu cont (`ACCOUNT_PREFIXES`, `lib/session-lost.ts`) → `/login?redirect=<pagina>&reason=expired` prin `safeRedirect`; fără redirect de pe paginile publice și de pe cele de autentificare. Actualizat 2026-11-14 (după revizuire): ascultătorul global și toate gărzile paginilor cu cont folosesc aceeași țintă (`useLoginRedirect`); `reason=expired` se pune doar dacă omul chiar avea o sesiune; fereastra de 5 s pornește doar după un redirect efectiv; un 401 după o reîmprospătare reușită semnalează și el sesiunea pierdută.

- 2FA (TOTP via otplib) IMPLEMENTAT arhitectural (schema, rute, UI) dar INACTIV în MVP, comutabil prin feature flag pentru V1. TwoFactorGuard este no-op cât flag-ul e off.

- Parole bcrypt cost 12, niciodată în log/audit/response. Secrets în .env validate la boot cu Zod (config.schema.ts) — boot fail-fast dacă lipsesc. Rate limiting: 5/min /auth/login, 10/min /claim, 30/min /upload, 100/min global per IP. CORS strict, Helmet + CSP.

- Adresa de întoarcere după login (adăugat 2026-11-13, etapa 2, f1 / b4): parametrul `?redirect=` se citește DOAR prin `safeRedirect` (`apps/frontend/src/lib/safe-redirect.ts`) — se acceptă doar o cale internă care începe cu un singur „/”, fără `//` sau `\` și fără segmente `.` / `..` în partea de cale (verificat și pe formele decodate, până la 3 decodări), fără scheme, adrese absolute sau caractere de control, maximum 512 caractere; altfel `/dashboard`. Pe server, `returnTo` de la înregistrare intră în linkul de confirmare a e-mailului doar dacă e exact o cale din `VERIFY_EMAIL_RETURN_PATHS` (`auth.constants.ts`, azi doar `/requests/new`); altfel e ignorat fără eroare.

- Formularele de cont (adăugat 2026-11-13, etapa 2, f1): autentificare, înregistrare, parolă uitată, resetare și schimbare parolă au `method="post"`, iar butonul de trimitere e dezactivat până la încărcarea paginii (hidratare), ca e-mailul și parola să nu poată ajunge niciodată în adresa paginii.

- Publicarea cererii (adăugat 2026-11-13, etapa 2, f2): doar un cont cu rolul CLIENT publică o cerere; orice alt rol primește 403 `REQUEST_PUBLISH_CLIENT_ONLY`. Rolul se citește din baza de date, înainte de orice atingere a ciornei. O ciornă anonimă se leagă (`client_user_id`) doar de un cont de client, la `createDraft` și `patchDraft`.
