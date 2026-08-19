# Aria: securitate backend + auth

Audit READ-ONLY, 2026-08-19. Referinta: docs/02-technical-invariants.md. Toate caile sunt relative la `F:/Cozy Fable/`.
Fisiere citite integral: main.ts, app.module.ts, config/config.schema.ts, common/** (filter, guards, idempotency, company-context, settings), infra/** (prisma, redis, storage, socket, event-bus, mail, queues, health), modules/auth/** complet, toate cele 28 de controllere din modules/**, serviciile unde se verifica ownership-ul (requests, uploads, claims, clarifications, withdrawals, chat, quotes, quote-pdf, companies, payments, invoice-pdf, fulfillment, notifications, notification-emails, admin, studio, boards, marketplace, credits, message-crypto, audit), FE: lib/api.ts, middleware.ts, hooks/use-auth.ts, hooks/use-socket.ts; .env.example, .env (doar cheile), .gitignore, .dockerignore, Dockerfile.app, apps/backend/Dockerfile, start-combined.sh, package.json + pnpm-lock (versiuni rezolvate).

Nota despre `.env`: `apps/backend/.env` exista local si contine valori reale (inclusiv MESSAGE_ENCRYPTION_KEY si secrete JWT). NU este urmarit de git (`git ls-files apps/backend/.env` = gol; `.gitignore:5` il ignora) si NU intra in imaginea Docker (`.dockerignore` are `**/.env`). OK.

## BINE FACUT (controale prezente si corecte — concret)

- Hashing parole bcrypt cost 12 (`modules/auth/auth.service.ts:24,70`), comparatie cu hash dummy pentru timing uniform la login (`auth.service.ts:26,121`). Parola max 72 (limita bcrypt), min 8 (`dto/register.dto.ts:27-28`).
- Tokenuri DOAR in cookie httpOnly (`auth.controller.ts:77-92`): `secure` in prod, `sameSite: 'lax'`, refresh cookie cu path restrans la `/api/v1/auth` (`auth.constants.ts:185`). FE nu pune JWT in localStorage (`apps/frontend/src/lib/api.ts:23`, `credentials: 'include'`), refresh dedupe cu un singur request in zbor (`api.ts:30-40`).
- Refresh token rotation cu familie + grace 30s + detectie reuse (revoca toata familia, persistata INAINTE de throw) (`modules/auth/token.service.ts:246-293`); in DB doar sha256 al tokenului (`token.service.ts:207-209`); o singura sesiune activa: login revoca tot + `auth_expired` pe socketul vechi (`auth.service.ts:151-155`); logout revoca familia (`token.service.ts:295-305`).
- Access token 15 min, refresh 7 zile (`auth.constants.ts:177-178`); secretele JWT vin din env cu `min(16)` si boot fail-fast (`config/config.schema.ts:164-167,189-197`), fara default hardcodat pentru secrete. `JwtModule.register({})` — secret per-sign (`auth.module.ts:15`).
- Email verification obligatorie la login (`auth.service.ts:128-133`); token de verificare 32 bytes random, stocat in Redis doar ca sha256, TTL 24h, one-time (sters la folosire) (`auth.service.ts:82-113`).
- ADMIN nu se poate inregistra public (`dto/register.dto.ts:41-43`, `@IsIn([CLIENT, COMPANY_USER])`).
- Guard-uri globale prin APP_GUARD in ordinea Throttler → JwtAuthGuard → RolesGuard (`auth.module.ts:26-28`); rutele publice sunt marcate explicit cu `@Public()`; rolul se verifica cu `getAllAndOverride` (clasa + handler).
- Rate limit global 100/min/IP (`app.module.ts:95`) + limite dedicate: login 5/min (`auth.controller.ts:116`), claim 10/min (`claims.controller.ts:33`), presign upload 30/min (`requests.controller.ts:96,154`, `chat.controller.ts:52,120`, `quotes.controller.ts:158`), estimate 20/min, webhook 30/min.
- ValidationPipe global `whitelist + forbidNonWhitelisted + transform` (`main.ts:30-32`); DTO-uri class-validator pe toate body-urile citite; `ParseUUIDPipe` pe majoritatea parametrilor `:id`; query-ul galeriei are `limit` max 100 (`inspiration/dto/inspiration.dto.ts`), paginarea audit-logs e clampata la 100 (`admin/admin.service.ts:93`).
- Helmet (`main.ts:22`), CORS cu origin unic din env + credentials (`main.ts:24-27`), `FRONTEND_ORIGIN` validat ca URL (`config.schema.ts:130`).
- Format unic de eroare; exceptiile non-HTTP (inclusiv erorile Prisma) ajung la client ca `INTERNAL_ERROR` generic, stack-ul doar in log (`common/filters/all-exceptions.filter.ts:54-67`). Header-ele `authorization` si `cookie` sunt redactate in pino (`app.module.ts:89`).
- Upload (invarianta 3.4): doar presigned PUT 15 min / GET 5 min (`infra/storage/storage.service.ts:83-117`); cheia S3 e construita server-side `entity/entityId/uuid/filename-sanitizat` (`modules/uploads/uploads.service.ts:36-55`) — nu exista path traversal; MIME whitelist + size max in DTO (`requests/dto/request.dto.ts:375-388`, `chat/dto/chat.dto.ts:20-33`); download URL doar pentru status SAFE (`uploads.service.ts:161-162`); `relink` valideaza apartenenta + SAFE (`uploads.service.ts:117-142`); attachment id-urile din schite trebuie sa apartina cererii (`requests.service.ts:747-768`). Nu exista controller de download prin Nest.
- Ownership verificat in service pentru: cereri client (`requests.service.ts:448-457`), chat (`chat/chat.service.ts:55-118` — TEAM doar membri, CLAIM doar client/companie), oferte (`quotes.service.ts:905-911,777-779`), PDF-uri oferta (`quote-pdf.service.ts:30-36` via aceleasi cai), claims assign/withdraw/withdrawals list (`claims.service.ts:275-277`, `withdrawals.service.ts:47-49,260-264`), clarificari raspuns/list client (`clarifications.service.ts:75-81,113-117`), notificari (`notifications.service.ts:47-51`), studio drafts (`studio.service.ts:107-109`), colectii (`boards.service.ts:154`), locatii/membri/portofoliu firma (`companies.service.ts:365-496`, `updateMany/deleteMany` cu `companyId`), facturi (`invoice-pdf.service.ts:28` via `getOrderForCompany`), review/livrare (`fulfillment.service.ts:49,76,126`).
- Scope firma: `CompanyApprovedGuard` rezolva apartenenta + status APPROVED/SUSPENDED si ataseaza `companyContext`; `SubscriptionActiveGuard` cere abonament activ (`common/guards/*.ts`). Marketplace: DTO-ul firmei NU contine adresa, lat/lng, contacte (doar city/county) (`marketplace/marketplace.service.ts:120-143`); contactele clientului apar doar in contextul claim-ului propriu (`quotes.service.ts:643`). DTO-ul clientului ascunde lat/lng/sizing (`requests.service.ts:961-965`).
- Claim tranzactional conform 3.1: `Serializable` + `SELECT ... FOR UPDATE` pe `requests`, status, sloturi, excluderi, 1-claim, coverage, rezervare credite in aceeasi tranzactie (`claims/claims.service.ts:104-204`). Idempotency-Key pe claim, quotes (create/revise/extra/reoffer), accept, credits/subscription purchase, webhook (`common/idempotency/*`, dedup 24h, 409 pe hash diferit).
- Webhook plata: HMAC-SHA256 cu secret din env, `timingSafeEqual`, status whitelist, idempotent; `confirm` refuza ordinele ne-PENDING (`billing/payments.controller.ts:140-160`, `payments.service.ts:101-111`). Pretul vine din DB (pachet activ), nu din client (`payments.service.ts:55-68`).
- Actiuni admin (aprobare/respingere firma, confirmare plata, retragere, disputa, setari) cu `@Audit` + AuditInterceptor; IP hashat cu `IP_HASH_SALT` (`audit/audit.service.ts:29`); `audit_logs` append-only prin trigger DB (`prisma/migrations/20260615201326_.../migration.sql:125`).
- Penalizari/retrageri/dispute/confirmari plata doar `@Roles(ADMIN)`; CLIENT nu poate accesa rutele de firma si invers (roluri pe clasa).
- Criptare mesaje la stocare AES-256-GCM, IV random, dual-read (`chat/message-crypto.service.ts`); cheia validata ca 64 hex (`config.schema.ts:181-184`). Decizia "nu e2e" e documentata.
- SQL brut doar cu template-uri parametrizate Prisma (`Prisma.sql`/`Prisma.join`), fara `$queryRawUnsafe` (verificat prin grep).
- HTML-ul pentru PDF-uri (Puppeteer) escapeaza toate campurile user-controlled (`billing/invoice-pdf.service.ts:105-135`, `quotes/quote-pdf.service.ts:135-166`).
- Unsubscribe din email cu HMAC + `timingSafeEqual` (`notifications/notification-emails.service.ts:36-46`).
- Socket.IO: auth la handshake pe acelasi cookie httpOnly, `auth_expired` + disconnect cand tokenul lipseste/expira, room doar `user:{sub}` si NU exista handler care sa permita clientului sa intre in alte room-uri (`infra/event-bus/events.gateway.ts`); evenimentele private (chat/oferte/claim) se emit doar catre participanti (`event-bus.service.ts:81-92`).
- Health public, dar expune doar `up/down` per dependinta, fara versiuni/config (`health/health.controller.ts`).
- Fara Swagger/OpenAPI in dependinte (nu e expus). Pagina FE `/dev/piece-3d` intoarce 404 in productie (`apps/frontend/src/app/[locale]/dev/piece-3d/page.tsx:17`).
- Dependinte: Next 14.2.35 (include patch-urile pentru CVE-2025-29927 si seria 14.2.32), express 4.22.1, jsonwebtoken 9.0.3, helmet 7.2.0, socket.io 4.8.x, bcrypt 6.0.0, class-validator 0.14.4, nodemailer 6.10.1 — nu am identificat versiuni cunoscute ca vulnerabile. Nu se foloseste multer.

## DE MODIFICAT — `[P0|P1|P2] cale:linie — problema → recomandare`

- [P0] `apps/backend/prisma/seed-demo.ts:27-33,48-53` — seed-ul demo creeaza `admin@demo.ro` (ADMIN) + ~10 conturi cu parola implicita `Demo1234!` (literal in repo si in comentariu), fara guard pe `NODE_ENV`; conform memoriei de proiect seed-ul demo A RULAT pe prod (wallets/cereri demo recalculate). Daca `DEMO_ADMIN_PASSWORD`/`DEMO_PASSWORD` nu au fost setate la acel moment, exista un cont ADMIN pe productie cu parola publica → preluare completa (aprobare firme, confirmare plati, setari, audit). → Verifica imediat pe prod (hash-ul lui admin@demo.ro vs bcrypt('Demo1234!')), roteaza parola/dezactiveaza conturile demo inainte de lansare, adauga `if (process.env.NODE_ENV === 'production' && !process.env.DEMO_ADMIN_PASSWORD) throw` in seed-demo si scoate literalul din cod.
- [P1] `apps/backend/src/modules/claims/lifecycle.controller.ts:97-100` + `clarifications.service.ts:104-110` — IDOR: `GET /claims/:id/clarifications` nu primeste `ctx` si `listForClaim` filtreaza doar dupa `claimSlotId` → orice firma APPROVED poate citi intrebarile/raspunsurile (text liber al clientului, posibil PII) de pe claim-urile altor firme. → Pasa `ctx` si verifica `slot.companyId === ctx.companyId` (ca in `withdrawals.service.ts:260-264`).
- [P1] `apps/backend/src/main.ts:21` — `app.set('trust proxy', true)` are incredere in TOATE hop-urile; `ThrottlerGuard` (v6) foloseste `req.ips[0]` = cel mai din stanga X-Forwarded-For, iar AuditInterceptor/`req.ip` la fel. Daca edge-ul (Railway) adauga IP-ul real la XFF in loc sa-l suprascrie, un atacator poate trimite `X-Forwarded-For` random pe fiecare request si ocoleste limita 5/min la login (brute-force pe parole; nu exista lockout de cont). → `trust proxy` cu numarul exact de hop-uri (ex. 2: edge + Next) sau un `getTracker` custom care ia IP-ul din dreapta minus N; plus lockout progresiv pe email (ex. 10 esecuri → 15 min) si `@Throttle` pe `/auth/register` si `/auth/refresh`.
- [P1] `apps/backend/src/modules/quotes/quotes.service.ts:550-582` — `acceptQuote`: verificarile `quote.status === 'SENT'`/validitate sunt facute INAINTE de `$transaction`, iar in tranzactie update-urile nu au conditie de status si nu exista lock pe `requests` (3.1 cere lock pentru orice operatie care schimba sloturile). Doua accept-uri concurente pe doua oferte ale aceleiasi cereri (dublu-click pe doua carduri, doua taburi) pot lasa doua oferte ACCEPTED si consuma creditele gresit. → In tranzactie: `SELECT ... FOR UPDATE` pe request, `updateMany({ where: { id, status: 'SENT' } })` si abort daca `count === 0`, verifica `request.status` nu e deja ACCEPTED.
- [P1] `apps/backend/src/modules/auth/auth.controller.ts` (lipsa) — NU exista forgot-password / reset-password / change-password (grep in backend+frontend: zero rezultate). O parola compromisa nu poate fi rotita de utilizator sau de admin din aplicatie (nici adminul demo de mai sus). → Implementeaza reset cu token random 32B hashat in Redis (TTL 30-60 min, one-time, raspuns identic indiferent daca emailul exista, throttle 3/min), si change-password autenticat care revoca toate refresh tokenurile.
- [P1] `apps/backend/src/infra/prisma/prisma.service.ts` + lipsa `UserAnonymizationService` (grep "anonymiz" = zero in src) — invarianta 3.12 nu e implementata: nu exista middleware Prisma pentru `deleted_at`, nu exista endpoint de stergere cont / anonimizare / export date. Pentru lansare in UE (GDPR art. 17/20) e un blocant legal si creste suprafata PII retinuta la nesfarsit. → Endpoint `DELETE /auth/me` (sau admin) care anonimizeaza email/name/phone (hash) + revoca tokenurile + soft-delete; export JSON al datelor proprii.
- [P1] `apps/backend/src/config/config.schema.ts:181-184` + `chat/message-crypto.service.ts:26-31` — `MESSAGE_ENCRYPTION_KEY` e optionala si lipsa ei inseamna fallback SILENTIOS la text clar (doar un warn in log). Pe prod e setata (memorie), dar schema permite regresia la un redeploy/rotatie de env. → `superRefine`: obligatorie cand `NODE_ENV === 'production'`.
- [P2] `apps/backend/src/infra/event-bus/events.gateway.ts:16` — `@WebSocketGateway({ cors: { origin: true, credentials: true } })` reflecta orice Origin (HTTP-ul are origin strict). Azi e protejat doar de `SameSite=Lax` pe cookie (browserele moderne nu trimit cookie Lax pe handshake cross-site). → `origin: FRONTEND_ORIGIN` din config, ca la `enableCors`.
- [P2] `apps/backend/src/modules/requests/requests.controller.ts:42-46,95-118` — `POST /requests/drafts` si `POST /requests/drafts/:token/attachments` sunt anonime: oricine poate crea rand-uri `requests` (100/min/IP) si presigned PUT de 25MB (30/min/IP) fara cont; nu exista job de curatare pentru drafturi abandonate / atasamente `PENDING_UPLOAD`. → Cota per IP/zi + TTL (job BullMQ care sterge drafturi > 30 zile si obiectele S3 orfane), sau cere cont pentru upload.
- [P2] `apps/backend/src/modules/requests/requests.controller.ts:81-91` + `apps/frontend/src/components/configurator/configurator-wizard.tsx:405` — tokenul de draft ramane valabil si DUPA publicare (`/drafts/:token/edit`, `/repost`) si e pastrat permanent in `localStorage` (`mm_req_token_<id>`); in plus apare in `req.url` logat de pino (`GET/PATCH /requests/drafts/<token>`). → La publish invalideaza tokenul (seteaza `draftTokenHash = null`; editarea autentificata exista deja: `POST /requests/:id/edit`), sau cel putin expira-l; redacteaza `req.url` pentru prefixul `/requests/drafts/`.
- [P2] `apps/backend/src/modules/notifications/notification-emails.service.ts:129-153` si `auth/auth.service.ts:92` — `requestTitle`, `companyName`, `user.name` sunt interpolate neescapate in HTML-ul emailurilor → HTML injection in emailuri (o firma cu nume `<a href=...>` / un client cu titlu de cerere) → phishing prin emailurile platformei. → functie `esc()` ca in serviciile PDF.
- [P2] `apps/backend/src/modules/billing/payments.service.ts:101-138` — in `confirm` verificarea `status !== 'PENDING'` e in afara tranzactiei si update-ul nu are conditie de status → doua confirmari concurente (admin + webhook replay cu alt Idempotency-Key; semnatura HMAC nu include timestamp/nonce) pot dubla `grant`-ul de credite; azi te salveaza indirect doar `@@unique(invoiceSeries, invoiceNumber)`. → `updateMany({ where: { id, status: 'PENDING' } })` + abort pe `count === 0`; include `timestamp` in semnatura webhook cu fereastra de 5 min.
- [P2] `apps/backend/src/common/idempotency/idempotency.interceptor.ts:219-222` — `endpoint` = pattern-ul rutei (`/quotes/:id/revise`) si hash-ul = body + userId, fara path params → aceeasi cheie reutilizata de acelasi user pe alt `:id` primeste raspunsul cached al primului (azi FE genereaza UUID nou per apel). → include `req.params`/`originalUrl` in hash.
- [P2] `apps/backend/src/modules/companies/companies.service.ts:397-419` — `addMember` ataseaza un user existent la firma DOAR dupa email, fara consimtamant (nu exista invitatie/accept) si raspunsurile diferite (`NOT_FOUND` vs `MEMBER_ALREADY_EXISTS`) permit enumerarea emailurilor de COMPANY_USER. → flux de invitatie cu token acceptat de invitat; raspuns uniform.
- [P2] `apps/backend/src/modules/inspiration/inspiration.controller.ts:107-145` — `InspirationAdminController` are `@Audit(...)` pe scrieri dar NU are `@UseInterceptors(AuditInterceptor)` (nu e global) → aceste actiuni admin nu sunt auditate. → adauga interceptorul pe clasa (ca in `admin.controller.ts:31`).
- [P2] `apps/backend/src/modules/auth/auth.service.ts:160-167` — `refresh()` incarca userul cu `findUniqueOrThrow` fara `deletedAt`/status → un cont soft-deleted/blocat isi poate reinnoi sesiunea pana la 7 zile; `JwtAuthGuard` e stateless (ok pentru 15 min), dar refresh-ul ar trebui sa fie punctul de revocare. → verifica `deletedAt === null` (si, daca apare, un flag `isBlocked`) la refresh si revoca familia.
- [P2] `apps/backend/src/modules/notifications/notification-emails.service.ts:36-37` — HMAC-ul de unsubscribe foloseste `JWT_ACCESS_SECRET` (reutilizare de secret; compromiterea unuia le compromite pe ambele). → secret dedicat `UNSUBSCRIBE_SECRET` in schema.
- [P2] `apps/backend/src/modules/auth/auth.controller.ts:99-104` — `/auth/register` nu are `@Throttle` dedicat (doar 100/min global) si trimite email de verificare la orice adresa → poate fi folosit pentru mail-bombing / epuizarea cotei SMTP; raspunsul `EMAIL_ALREADY_REGISTERED` permite enumerare (acceptabil pentru register, dar combinat cu lipsa throttling-ului devine ieftin). → `@Throttle 3-5/min`, eventual captcha; raspuns uniform "daca emailul nu e folosit vei primi un mesaj".
- [P2] `apps/backend/src/modules/claims/withdrawals.service.ts`, `sla-breach.processor.ts`, `requests.service.ts:524-543` (deleteForClient), `claim-assign.processor.ts` — schimba statusul sloturilor / refund fara `FOR UPDATE` pe `requests` si fara Serializable, contrar 3.1 ("toate operatiile care modifica numarul de claim_slots active folosesc acelasi pattern"). Risc practic mic (concurenta rara), dar e o abatere de la invarianta. → extrage un helper `withRequestLock(tx, requestId)` si foloseste-l in toate.
- [P2] `apps/backend/src/modules/uploads/uploads.service.ts:95-100` — "scanarea" e mock si sincrona (SAFE imediat la confirm, fara PENDING_SCAN/worker), extensia fisierului nu e corelata cu MIME (un `.exe` declarat `image/png` trece), ZIP permis fara inspectie. Acceptat de invariante pentru MVP, dar firmele descarca fisierele clientilor (si invers). → la lansare: ClamAV/serviciu extern in worker, verificare magic bytes la confirm, `Content-Disposition: attachment` pe GET presigned (ResponseContentDisposition).
- [P2] `Dockerfile.app`, `apps/backend/Dockerfile` — containerul ruleaza ca root (fara `USER node`); Puppeteer porneste cu `--no-sandbox` (`quotes/quote-pdf.service.ts:46`) si randeaza HTML generat din date user-controlled (escapate azi — orice regresie de escapare devine SSRF/LFI prin Chromium). → `USER node`, `page.setRequestInterception` cu deny pentru orice request extern/`file:` in ambele servicii PDF.
- [P2] `apps/backend/src/modules/billing/credits.service.ts:41-62` — `reserve`/`consume` citesc si apoi scad fara CHECK `balance >= 0` in DB si fara retry pe serialization failure (P2034 → 500 la client). Corect sub Serializable, dar fragil. → `UPDATE ... SET balance = balance - n WHERE balance >= n` (updateMany cu `balance: { gte: amount }`) + CHECK constraint in migrare.
- [P2] `apps/backend/src/modules/companies/admin-companies.controller.ts:131` — `@Query('status') status?: CompanyStatus` nu e validat (string arbitrar → Prisma arunca → 500). → DTO cu `@IsEnum(CompanyStatus) @IsOptional()`.
- [P2] `apps/backend/src/modules/chat/chat.service.ts:207-218` — `listMessages` fara paginare (toate mesajele + un presigned URL per atasament). → cursor/limit 100.
- [P2] `apps/backend/src/infra/event-bus/event-bus.service.ts:91-92` — evenimentele fara tinta (`request.status_changed`, `claim.withdrawn` din processor) se emit broadcast catre TOATE socketurile (clienti + firme). Payload = doar id-uri/statusuri, dar o firma neeligibila afla ca exista cererea X si ca s-a schimbat. → emite pe room-uri `company:{id}` / `user:{id}`.
- [P2] `apps/frontend/next.config.mjs` (in afara ariei, dar relevant pentru auth pe cookie) — nu exista `headers()` cu CSP / X-Frame-Options / Referrer-Policy pe frontend; helmet-ul e doar pe API-ul proxied. Un XSS in FE are acces la toate rutele (cookie-ul e trimis automat). → CSP minimala + `frame-ancestors 'none'`.
- [P2] `apps/backend/src/modules/audit/audit.interceptor.ts:45` — `after: result` salveaza intreg raspunsul handlerului (3.9 cere snapshot doar pentru campuri non-sensibile declarate). Azi raspunsurile auditate sunt DTO-uri fara secrete, dar nu e garantat la adaugarea de rute. → whitelist de campuri in `@Audit('X', 'entity', ['id','status'])`.

## DE STERS — endpoint-uri/dev/debug/cod mort

- `apps/backend/prisma/seed-demo.ts:3,32` — literalul `Demo1234!` (si mentionarea lui in comentariu) + lipsa guard-ului de productie (vezi P0). Pastreaza scriptul, scoate default-ul.
- `apps/backend/src/modules/inspiration/inspiration.controller.ts:24` — `@UseGuards(OptionalJwtAuthGuard)` pe `InspirationController` care are o singura ruta `@Public()` si nu foloseste `req.user` → guard inutil.
- `apps/backend/src/modules/auth/guards/two-factor.guard.ts` — `TwoFactorGuard` e no-op in ambele ramuri (returneaza `true` si cu flag on) si nu e aplicat nicaieri (grep: doar provider/export). E "arhitectural" per 3.13, dar azi e cod mort; ori il legi de rute cand activezi 2FA, ori il marchezi explicit TODO.
- `apps/backend/prisma/update-demo-credits.ts` — script one-off pentru date demo; nu ar trebui sa ramana rulabil in `package.json` (`seed:demo-credits`) pe un deploy de productie.
- Nu am gasit endpoint-uri `dev/debug/test/mock/fake` in controllere (grep pe toate `*.controller.ts`: singurul match e numele entitatii `mock_billing_order` in `@Audit`).

## INTREBARI PENTRU PO

1. Conturile demo (`*@demo.ro`, inclusiv `admin@demo.ro`) raman pe productie dupa lansare? Daca da, cu ce parole si cine le detine? (vezi P0)
2. Nu exista flux "am uitat parola" / schimbare parola / re-trimitere email de verificare. Un client care nu primeste emailul in 24h nu se mai poate loga niciodata. Intra in scope-ul de lansare?
3. Stergere cont / anonimizare (GDPR art. 17) si export date (art. 20): cine le poate declansa (user self-service vs. admin) si ce se intampla cu cererile/ofertele/chatul legate de cont?
4. Drafturile anonime (fara cont) raman politica produsului? Daca da, acceptam cota per IP + curatare automata la 30 de zile (drafturi + fisiere)?
5. Adaugarea unui membru in firma fara acceptul lui (doar dupa email) e intentionata?
6. Scanarea antivirus reala a fisierelor e necesara la lansare sau ramane mock (firmele descarca fisiere de la clienti si invers)?
7. Vrem lockout de cont dupa N parole gresite (in plus fata de limita per IP)?

## ANEXA: tabel rute (metoda, path, guard/rol, ownership verificat? da/nu/partial)

Prefix global `/api/v1`. Guard-uri globale: ThrottlerGuard + JwtAuthGuard (sarit doar pe `@Public`) + RolesGuard. "CA" = CompanyApprovedGuard, "SA" = SubscriptionActiveGuard, "Idem" = Idempotency-Key obligatoriu.

| Metoda | Path | Guard / rol | Ownership | Observatii |
|---|---|---|---|---|
| POST | /auth/register | Public | n/a | fara throttle dedicat (P2) |
| POST | /auth/verify-email | Public | n/a | token 32B one-time |
| POST | /auth/login | Public, 5/min | n/a | cookie httpOnly |
| POST | /auth/refresh | Public | token | rotation + family |
| POST | /auth/logout | Public | token | revoca familia |
| GET | /auth/me | JWT | da (sub) | |
| POST | /auth/2fa/setup, /2fa/verify | JWT | da | blocate cat flag=off |
| GET | /health | Public | n/a | up/down |
| POST | /requests/estimate | Public, 20/min | n/a | |
| POST | /requests/drafts | Public | token emis | anonim (P2) |
| GET/PATCH/DELETE | /requests/drafts/:token | Public | da (token secret, hash in DB) | tokenul valabil si dupa publish (P2) |
| POST | /requests/drafts/:token/publish | Public + OptionalJwt | token + cere user logat | nu verifica rolul (orice cont publica) |
| POST | /requests/drafts/:token/edit, /repost | Public | token | |
| POST/DELETE | /requests/drafts/:token/attachments[/:id/confirm] | Public, 30/min | token + entity scope | anonim (P2) |
| GET | /requests, /requests/dashboard-stats | CLIENT | da (clientUserId) | |
| GET/DELETE | /requests/:id | CLIENT | da | |
| POST | /requests/:id/edit | CLIENT | da | |
| POST/DELETE | /requests/:id/attachments[/:attachmentId[/confirm]] | CLIENT, 30/min | da | |
| POST | /requests/:id/confirm-delivery, /review; GET /requests/:id/review | CLIENT | da | |
| GET | /marketplace/requests[/:id] | COMPANY_USER + CA + SA | da (vizibilitate firma in SQL) | fara PII |
| POST | /claims | COMPANY_USER + CA + SA, 10/min, Idem | da (ctx) | lock FOR UPDATE |
| GET | /claims/mine | COMPANY_USER + CA + SA | da | |
| POST | /claims/:id/assign | COMPANY_USER + CA + SA | da | owner/manager |
| POST | /claims/:id/clarifications | COMPANY_USER + CA | da | |
| GET | /claims/:id/clarifications | COMPANY_USER + CA | **NU** | IDOR (P1) |
| POST | /claims/:id/withdraw; GET /claims/:id/withdrawals | COMPANY_USER + CA | da | |
| GET | /client/clarifications/request/:requestId | CLIENT | da | |
| POST | /client/clarifications/:id/answer | CLIENT | da | |
| GET | /admin/withdrawals; POST /admin/withdrawals/:id/review | ADMIN | n/a | audit |
| GET | /chat/threads, /chat/threads/:id/messages | CLIENT | da | fara paginare |
| POST | /chat/threads/:id/read, /messages, /attachments[/:id/confirm] | CLIENT (30/min pe presign) | da | |
| GET | /company/chat/threads, /team, /threads/:id/messages | COMPANY_USER + CA | da | |
| POST | /company/chat/threads/:id/read, /messages, /attachments[/:id/confirm] | COMPANY_USER + CA | da | |
| POST | /quotes | COMPANY_USER + CA, Idem | da (slot.companyId) | |
| GET | /quotes/mine, /quotes/by-claim/:claimSlotId, /quotes/:id, /quotes/:id/pdf | COMPANY_USER + CA | da | |
| POST | /quotes/:id/revise, /extra, /reoffer (Idem), /extend-validity, /withdraw, /end-negotiation, /changes/:changeId/reject, /consultation-invites | COMPANY_USER + CA | da | |
| POST | /quotes/claims/:claimSlotId/attachments[/:id/confirm] | COMPANY_USER + CA, 30/min | da | |
| GET | /client/quotes/request/:requestId, /client/quotes/:id, /client/quotes/:id/pdf | CLIENT | da | |
| POST | /client/quotes/changes, /client/quotes/consultation-invites/:inviteId/respond | CLIENT | da | |
| POST | /client/quotes/:id/accept | CLIENT, Idem | da | race fara lock (P1) |
| GET | /companies/partners | Public | n/a | date publice firme |
| POST | /companies; GET /companies/me, /me/dashboard-stats; PATCH /companies/me | COMPANY_USER | da (membership) | |
| POST/PUT/DELETE | /companies/me/locations[/:id], /me/members[/:id], /me/portfolio[/:id] | COMPANY_USER | da (companyId in where) | addMember fara consimtamant (P2) |
| PUT | /companies/me/offer-permissions | COMPANY_USER | da (OWNER) | |
| GET | /admin/companies[/:id]; POST /admin/companies/:id/approve, /reject | ADMIN | n/a | audit; `status` nevalidat |
| GET | /billing/wallet, /billing/subscription, /billing/credit-packages, /billing/orders, /billing/orders/:id/invoice | COMPANY_USER + CA | da | |
| POST | /billing/credits/purchase, /billing/subscription/purchase | COMPANY_USER + CA, Idem | da | pret din DB |
| GET | /admin/payments; POST /admin/payments/:id/confirm | ADMIN | n/a | audit |
| POST | /webhooks/payment | Public, 30/min, Idem, HMAC | n/a | fara timestamp in semnatura (P2) |
| GET | /penalties/me | COMPANY_USER | da | fara CA (intentionat) |
| POST | /company/requests/:id/deliver | COMPANY_USER + CA | da (oferta acceptata a firmei) | |
| GET | /admin/disputes; POST /admin/disputes/:id/resolve | ADMIN | n/a | audit |
| GET | /notifications, /unread-count, /email-preference; PATCH /email-preference; POST /:id/read, /read-all | JWT (orice rol) | da (userId) | |
| POST | /notifications/unsubscribe | Public | HMAC | |
| GET | /admin/kpi, /audit-logs, /settings, /penalty-rules, /credit-packages, /plans, /thresholds, /jobs | ADMIN | n/a | |
| PUT/PATCH/POST | /admin/settings/:key, /penalty-rules/:id, /credit-packages[/:id], /plans/:id, /thresholds/:id, /jobs/:queue/:id/retry | ADMIN | n/a | audit; queue whitelist |
| GET | /inspiration | Public | n/a | limit max 100 |
| GET/POST/PATCH/DELETE | /inspiration/boards[...] | JWT (orice rol) | da (userId) | |
| GET/POST/PATCH/DELETE | /admin/inspiration[...], /:id/image/presign, /confirm | ADMIN | n/a | @Audit FARA interceptor (P2) |
| GET/POST/PUT/DELETE | /studio/drafts[/:id] | JWT (orice rol) | da (userId) | |
| WS | /socket.io | cookie httpOnly la handshake | room user:{sub} | cors origin: true (P2) |
