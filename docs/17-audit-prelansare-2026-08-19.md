# Audit pre-lansare Cozy Home — 2026-08-19

Audit READ-ONLY (niciun fisier din repo modificat). Repo `F:/Cozy Fable` @ `afa58e0` + working tree necomis (copy RO/EN rescris, review-step/review-rail, fisa cererii, fix socket.io in `next.config.mjs`).

**Cum a fost facut**: 13 agenti paraleli, fiecare pe o arie (pagini publice, flux client + configurator, 3D piece/studio, flux firma, admin FE+BE, i18n/copy, cod mort FE + dependinte, securitate backend/auth, logica business backend, infra/deploy, shared + prisma, workflow end-to-end, porti de calitate) + o trecere vizuala a mea pe paginile publice (local dev; prod-ul Railway era OFFLINE la momentul auditului). Fiecare afirmatie din acest document a fost verificata in cod (cale:linie) sau reprodusa live pe backend-ul local; cifrele de cod mort vin din scripturi de graf de importuri / grep pe identificatori (reproductibile, in scratchpad). Rapoartele detaliate per arie sunt in Anexe (A1–A13) la finalul documentului.

**Porti de calitate rulate**: `pnpm -F @marketplace/shared build` OK · `pnpm typecheck` 0 erori (strict peste tot) · `pnpm lint` 0 warnings (DOAR frontend; backend/shared nu au ESLint) · `pnpm -F backend test` 39/39 PASS · shared vitest 113/113 PASS · `pnpm audit --prod` 55 vulnerabilitati (0 critical, 22 high, 29 moderate, 4 low).

---

## 1. Verdict si rezumat executiv

**Aplicatia NU e gata de lansare publica azi.** Fundatia tehnica e solida (auth pe cookie httpOnly cu rotation, claim tranzactional cu lock, idempotenta, criptare chat, validare stricta, zero console.log/TODO/cod comentat, typecheck/lint/teste verzi), dar exista blocante care ar lasa utilizatorii reali fara acces sau ar afisa date false/placeholder:

| # | Blocant (P0) | Efect real |
|---|---|---|
| 1 | SMTP de productie = Mailpit (sink) | niciun email real → nimeni nu poate verifica contul → **nimeni nu poate face login** |
| 2 | Fara retrimitere email de verificare + fara "am uitat parola" | cont mort dupa 24h sau la o parola uitata; `register()` arunca daca SMTP pica dupa crearea userului |
| 3 | Date demo pe prod (24 useri `@demo.ro`, 8 firme, 15 cereri, 2 facturi `MM` 400/700) + `admin@demo.ro` cu parola posibil `Demo1234!` (literal in repo) + `seller_*` fictive (CUI RO12345678, IBAN fals) in `system_settings` | risc de preluare cont admin; facturi invalide fiscal; numerotare cu gauri |
| 4 | Termeni + Politica de confidentialitate cu `[DENUMIRE LEGALĂ FIRMĂ] / [CUI] / [ADRESĂ] / [EMAIL CONTACT]` (10 locuri, RO+EN) | pagina publica cu placeholdere; GDPR art. 13 cere operatorul identificat |
| 5 | Ratinguri "Google" FABRICATE (hash din id: 4.6–5.0, 38–218 recenzii) pe landing + `/partners`, cu textul "Ratingurile vin din recenziile Google" | afirmatii false pe site public (risc legal/incredere) |
| 6 | Plata e mock si fara cale de abonament: cumpararea de credite pare reala dar creeaza o comanda PENDING fara instructiuni; `POST /billing/subscription/purchase` nu are UI; dupa trialul de 30 zile `SubscriptionActiveGuard` blocheaza firma definitiv (nici adminul nu poate prelungi) | firmele platitoare raman blocate; DECIZIE NECESARA |
| 7 | Cererea stearsa de client ramane vizibila si CLAIMABILA in marketplace (`deleted_at` nefiltrat in SQL-ul marketplace si in lock-ul de claim) | firme rezerva credite pe cereri inexistente |
| 8 | Gauri in masina de stari a ofertelor: `createQuote`/`acceptQuote` nu verifica statusul cererii (dubla acceptare posibila); la acceptare claim-urile ACTIVE ale altor firme raman active → SLA le penalizeaza (3 pct) si le consuma creditele pe o cerere deja ACCEPTED; retragere voluntara dupa gratie lasa creditele RESERVED la infinit; retragerea unui claim OFFER_SENT lasa oferta acceptabila | firmele pierd bani/puncte pe nedrept |
| 9 | Admin → Setari: salvarea Planuri/Pachete/Praguri NU functioneaza niciodata (`id` trimis in body → 400 `forbidNonWhitelisted`), fara nicio eroare in UI | adminul crede ca a salvat |
| 10 | Header public spart intre ~640 si ~1100 px (linkurile se rup pe 2-3 randuri, "Inregistrare" iese din ecran, pagina capata scroll orizontal) — confirmat in browser la 660/768/820/1024 px | prima impresie pe tableta / laptop mic |
| 11 | Dependinte cu CVE HIGH: `next@14.2.35` (8 HIGH, patch doar pe 15.x), `nodemailer@6.10.1` (2 HIGH) | bump nodemailer + overrides acum; Next 15 sprint dedicat |
| 12 | Fixul de socket.io din `next.config.mjs` (fara el handshake-ul WebSocket moare in prod) e NECOMIS, la fel ~4.800 linii de copy rescris; CHANGELOG in urma; prod-ul Railway e Offline | realtime degradat pe prod; munca nelivrata |

Cifre totale (dupa deduplicare intre arii): **~20 P0**, **~95 P1**, **~150 P2**, **~120 iteme de sters** (8 fisiere FE orfane = 685 linii, 26 exporturi moarte FE, 38 exporturi moarte shared, ~141 chei i18n moarte x2 limbi, 11 coduri de eroare moarte, 2 dependinte BE, 5+ rute BE neapelate, docs/branch-uri/fisiere repo), **~60 intrebari pentru PO** (consolidate in §7 la ~25).

---

## 2. CHECKLIST P0 — blocante de lansare

### 2.1 Email / auth (utilizatorii nu pot intra)
- [ ] **SMTP real pe prod** (Brevo/Resend/Postmark/SES) — `SMTP_HOST/PORT/USER/PASS/SMTP_SECURE/MAIL_FROM` pe serviciul `backend`; SPF + DKIM + DMARC pe domeniul de expediere; test e2e register → inbox real → verify → login. Codul suporta deja (`infra/mail/mail.service.ts`, `config.schema.ts:22-31`). Apoi sterge serviciul Mailpit. (A9, A10, A12)
- [ ] **`POST /auth/resend-verification`** (rate-limited) + buton pe ecranul de succes la register, pe `/verify-email` la token expirat si langa eroarea `EMAIL_NOT_VERIFIED` din login; trimiterea emailului in `register()` best-effort (try/catch + log) — azi `auth.service.ts:62-78,96-118` arunca dupa crearea userului → cont mort + `EMAIL_ALREADY_REGISTERED` la retry. (A2, A12)
- [ ] **Forgot / reset / change password** — 0 rezultate in BE/FE/shared; `/login` fara link. Token 32B hashat in Redis, TTL 30-60 min, one-time, raspuns identic indiferent daca emailul exista, throttle 3/min; change-password autenticat care revoca toate refresh-tokenurile. (A2, A8, A12)

### 2.2 Date demo si secrete pe productie
- [ ] **Verifica imediat `admin@demo.ro` pe prod** (hash vs bcrypt(`Demo1234!`)); roteaza/dezactiveaza. `seed-demo.ts:27-53` are literalul `Demo1234!` si nu are guard `NODE_ENV=production` → adauga guard (`ALLOW_DEMO_SEED=1` explicit) si scoate default-ul din cod. (A8, A10, A13)
- [ ] **Curatare demo pe prod** (inventar complet in A10 §"Date demo"): 24 useri `@demo.ro`, 8 firme (A Mobila Premium … H VintageHaus) cu membri/locatii/wallets (200 credite)/abonamente/penalizari, 15 cereri cu claims/chat/quotes/reviews/disputa, 2 `mock_billing_orders` (factura `MM` 400/700, seller "Marketplace Mobilier SRL"), 52 audit `entity_type='demo'`, 30 notificari `{demo:true}`. Script `cleanup-demo.ts` in ordinea FK sau DB reset + `seed.ts` + `seed-inspiration.ts`. Backup INAINTE. Pastreaza "Mobila Unicat" (completeaza CUI/RegCom reale — azi `N/A`).
- [ ] **`system_settings.seller_*` reale** (denumire, CUI, Reg. Com., adresa, IBAN, `invoice_series` reala) inainte de prima confirmare de plata — `seed.ts:149-156` le seed-uieste fictive si `payments.service.ts:112-119` le snapshot-uieste pe factura. Sterge comenzile demo `MM` 400/700 (altfel numerotarea continua de la 701 cu gauri).
- [ ] **Cont ADMIN real** — singura cale azi e `seed-demo.ts` (impreuna cu toate datele demo). Script `seed-admin.ts` cu `ADMIN_EMAIL`/`ADMIN_PASSWORD` obligatorii din env. (A5)

### 2.3 Legal / continut public
- [ ] **Completeaza datele juridice** in `Legal.terms.*` si `Legal.privacy.*` (RO+EN; `ro.json:4097,4134,4166` etc.) + `Legal.lastUpdated`; unifica brandul "CozyHome" (legal) vs "Cozy Home" (restul); denumirea de marca din Termeni = cea inregistrata. (A1, A6, A10, A12)
- [ ] **Checkbox obligatoriu "Accept Termenii si Politica"** la register (+ `termsAcceptedAt`). (A12, trecere vizuala)
- [ ] **Politica promite ce produsul nu are**: "setari de marketing in cont" si "stergerea contului" — fie construieste (vezi GDPR P1), fie rescrie textul (retragere prin email/link de dezabonare; stergere la cerere prin email). Mentioneaza Google Maps Places (IP catre Google) daca ramane activ. (A1, A10)
- [ ] **Scoate ratingurile fabricate**: `lib/mock-partner-meta.ts` (sterge), `partners-carousel.tsx:114-146`, `partners/page.tsx:38-41` — ascunde steaua/recenziile/specializarea cand `rating === null` (backend returneaza mereu `null`, `companies.service.ts:106`); sterge fraza `Landing.partnersSub` "Ratingurile vin din recenziile Google" si `Partners.ratingSoon` "Rating Google în curând" (sau integreaza recenziile reale — vezi P1 recenzii). (A1, A7, A12)

### 2.4 Bani / abonamente / integritate business
- [ ] **DECIZIE: plata la lansare** — PSP real sau "transfer bancar + confirmare admin" asumat explicit. Daca mock: (a) dialog de confirmare cu total CU TVA (butonul arata NET 100 RON, comanda 121 RON); (b) instructiuni de plata (IBAN din `seller_*`, referinta = nr. comanda); (c) notificare firmei la confirmare; (d) scoate "Document mock (MVP)" din PDF-urile de factura/oferta (`invoice-pdf.service.ts:210`, `quote-pdf.service.ts:171`); (e) admin: referinta/suma/data + "anuleaza comanda" (PENDING la infinit azi). (A4, A5, A9, A12)
- [ ] **Abonament**: sectiune "Abonament" in wallet cu planuri + cumparare (chiar si mock) SAU ruta admin de grant/prelungire; mesaj clar pe `/marketplace` cand `SUBSCRIPTION_INACTIVE`/`COMPANY_NOT_APPROVED` (azi `list.isError` nu e randat → pagina goala). Azi dupa 30 zile firma e blocata definitiv. (A4, A9, A12)
- [ ] **Soft-delete cerere**: `AND r.deleted_at IS NULL` in `marketplace.service.ts:179-212` si in lock-ul de claim `claims.service.ts:105-120` (+ `getDetail`, chat, quotes); ideal status terminal la delete sau middleware-ul Prisma din invarianta 3.12 (inexistent). (A9, A11)
- [ ] **Masina de stari oferte/claim** (`quotes.service.ts:96-161, 550-603`, `withdrawals.service.ts:139-150`, `sla-breach.processor.ts:43`): in tranzactie `FOR UPDATE` pe request + `updateMany where status='SENT'`; refuza create/revise/accept daca `request.status ∉ {CLAIMED_*, OFFERS_RECEIVED, NEGOTIATION}`; la accept toate sloturile ACTIVE/OFFER_SENT nealese → status terminal + thread read-only (refund vs consum = decizie PO); SLA processor verifica statusul cererii; retragere voluntara tarzie → `credits.consume(...)`; retragere claim OFFER_SENT → quote WITHDRAWN/SUPERSEDED. (A8, A9, A12)
- [ ] **Admin settings**: `hooks/use-admin.ts:64,76,88` — `const { id, ...body } = v`; + feedback succes/eroare (toaster exista). (A5)

### 2.5 Design / frontend public
- [ ] **Header public** `public-header.tsx:44-88`: nav in hamburger pana la `lg` (sau ascunde Autentificare/Inregistrare sub `md`); aliniaza cu `app-header.tsx` (`md:`). (A1 + verificat: la 820 px scrollWidth 896 > 820; la 1024 px linkurile inca pe 2 randuri)

### 2.6 Dependinte / livrare
- [ ] `nodemailer` → `^7.0.11` (2 HIGH); `pnpm.overrides` pe `lodash >=4.18`, `multer >=2.2.0`, `ws >=8.21`, `socket.io-parser >=4.2.7` (risc zero). **Next 15** (8 HIGH, DoS/SSRF in rewrites — exact suprafata `/api/v1` + `/socket.io`): sprint dedicat imediat dupa lansare sau inainte daca timpul permite (next-intl 3→4, eslint-config-next). (A13)
- [ ] **Commit separat** pentru `next.config.mjs` (fix socket.io) vs copy/UI; intrare CHANGELOG ("Studio 3D r7 + terminologie firma" — lipsesc si commiturile a319dae, 83ea274, fefa53a, afa58e0); deploy; verifica `transport=websocket` pe prod. Prod e Offline la 2026-08-19 (`railway status`). (A10, A13)

---

## 3. CHECKLIST P1 — important (inainte de lansare sau in primele zile)

### 3.1 Notificari si emailuri (gaura transversala)
- [ ] `EventBusService.publish()` persista notificari/trimite email DOAR cu `targetUserIds`; TOATE `request.status_changed` (14 locuri) si `claim.withdrawn` (4) sunt broadcast → `notifications.processor.ts:24-25` le ignora. Zero clopotel/email pentru: cerere expirata, livrare marcata/confirmata, recenzie/disputa deschisa/rezolvata, retragere claim, SLA ratat, re-publicare dupa SLA in masa, auto-anulare 1h, stergere cerere, editare post-claim, reminder admin 48h (`withdrawal-reminder.processor.ts:31`), aprobare/respingere firma, suspendare, clarificare ceruta/raspunsa. → publish tintit + tipuri distincte + continut email. Emailuri azi doar pentru 3 evenimente. (A9, A12, A5)
- [ ] Emailuri: "Atelierul <firma> ti-a trimis o oferta" (`notification-emails.service.ts:141,152`) → "Firma"; `requestTitle`/`companyName`/`user.name` neescapate in HTML (`:129-153`, `auth.service.ts:92`) → `esc()`; `replyTo`, varianta `text`, header `List-Unsubscribe` lipsa (`mail.service.ts:24`); `MAIL_FROM=no-reply@cozyfable.app` ≠ domeniul real. (A8, A9, A10)
- [ ] Adminul nu e anuntat de nimic (firma noua, plata PENDING, disputa, retragere custom); `grep ADMIN_EMAIL` = 0. (A5)

### 3.2 Securitate (A8 + A5 + A11)
- [ ] IDOR: `GET /claims/:id/clarifications` (`lifecycle.controller.ts:97`, `clarifications.service.ts:104`) nu filtreaza pe `companyId` → orice firma citeste clarificarile altora. Fix ca in `withdrawals.service.ts:260-264`.
- [ ] `main.ts:21` `trust proxy: true` → `X-Forwarded-For` spoofabil → throttle 5/min la login ocolibil; nu exista lockout de cont. → hop-uri exacte (2) + lockout progresiv pe email + `@Throttle` pe `/auth/register` si `/auth/refresh`.
- [ ] `config.schema.ts:181` `MESSAGE_ENCRYPTION_KEY` optionala → fallback silentios la text clar. → obligatorie in production.
- [ ] GDPR (invarianta 3.12): fara middleware soft-delete, fara stergere/anonimizare cont (`users.anonymized_at` 0 referinte, `UserAnonymizationService` inexistent), fara export date, fara editare profil/parola/limba (`PATCH /auth/me` inexistent). DECIZIE PO: in MVP sau amanat explicit (si atunci textul Politicii se rescrie).
- [ ] Gating 4.10 verificat doar la listare, nu la claim (`claims.service.ts:100-160`; `GATING_NOT_OPEN` mort) → o firma Silver cu id-ul da claim inainte de deschidere.
- [ ] `payments.service.confirm()` check PENDING in afara tranzactiei + update neconditionat → admin + webhook simultan livreaza creditele de 2 ori; numar factura `max+1` fara serializare → P2002 → 500. → `updateMany where status='PENDING'` + secventa per serie; timestamp in semnatura webhook.
- [ ] `events.gateway.ts:16` Socket.IO `cors: { origin: true }` → `FRONTEND_ORIGIN`.
- [ ] Admin FE: `admin/layout.tsx` fara guard de rol (4 pagini fara `useMe`, 6 il duplica), fara logout; `InspirationAdminController` are `@Audit` fara `@UseInterceptors(AuditInterceptor)` → 0 audit (162 poze, 0 intrari); `GET /admin/companies?status=XYZ` → 500 (enum nevalidat); setarile de sistem string liber fara tip/min/max (`vat_rate=abc`, `max_claims_per_request=0` acceptate); praguri fara validare `min<=max`/suprapunere, `ThresholdRow` trimite `maxScore:0` pentru LARGE (null); actiuni ireversibile fara confirmare (aproba firma, confirma plata, rezolva disputa, aproba retragere, sterge poza).
- [ ] Schema: `onDelete: Cascade` pe `mock_billing_orders`/`credit_transactions` (date financiare) → Restrict; FK-uri lipsa (`requests.client_user_id`, `notifications.user_id` si ~10 coloane `*_user_id`/`claim_slot_id`); abonament "1 activ per firma" neimpus, cumparare in timpul unuia activ pierde zilele ramase, `EXPIRED/CANCELLED` niciodata scrise.

### 3.3 Fundaturi de stare in backend (A9, A12)
- [ ] Clarificare fara raspuns → SLA pe pauza la nesfarsit, slot ocupat permanent; la raspuns nu se reprogrameaza jobul de breach; clientul NU e notificat ca i s-a cerut clarificare. → plafon (ex. 48h) + reprogramare + notificare.
- [ ] Oferta EXPIRED fara reofertare → slot ocupat la nesfarsit, cererea OFFERS_RECEIVED fara iesire; fara penalizare la expirare (4.12 o listeaza). DECIZIE.
- [ ] DELIVERED_BY_COMPANY neconfirmat → blocat, creditele castigatorului neconsumate, recenzie imposibila; clientul nu poate contesta "livrat". DECIZIE (auto-COMPLETED dupa N zile + buton "problema").
- [ ] SUSPENDED nu se ridica niciodata dupa 6 luni (guard nu compara `suspended_until < now()`, fara job, fara ruta admin unsuspend); claim-urile active ale firmei suspendate netratate; fara notificare la suspendare.
- [ ] Cerere revenita IN_MARKETPLACE dupa retrageri (`claims.helpers.ts:19-39`) nu primeste job nou de expirare → zombie in piata; cereri cu oferte fara decizie client la infinit → credite rezervate nelimitat (timeout de decizie = DECIZIE).
- [ ] Toate termenele traiesc DOAR ca delayed jobs in Redis (0 cron/repeat) → la pierderea Redis nimic nu mai expira, fara alarma. → sweep de reconciliere la 10 min pe `expires_at/sla_deadline_at/valid_until < now()`. Side-effects post-commit fara try/catch → 500 dupa operatie reusita daca Redis pica.
- [ ] Retrageri `CLIENT_CONTACT_INVALID`/`CLIENT_REQUESTED_CANCELLATION` auto-aprobate fara validare (`withdrawals.service.ts:106`, comentariu "mock") → refund integral oricand → minim PENDING_ADMIN_REVIEW.
- [ ] Repost doar prin token din localStorage (`requests/[id]/page.tsx:22-25,148`, singurul endpoint `POST /requests/drafts/:token/repost`) → pe alt device nu se poate reposta → `POST /requests/:id/repost` autentificat.
- [ ] Reminder client la 3 zile lucratoare (4.4), warning atribuire +30 min (`ASSIGN_WARNING_MS` nefolosit), `sla.expiring_soon` (declarat, niciodata publicat), avertizare expirare abonament, credite valabile 3 luni (4.16) — neimplementate.
- [ ] Geocodare Nominatim public inline fara coada 1 req/s (3.8), UA cu `dev@marketplace.local`; claim concurent → P2034 nemapat → 500 in loc de 409.
- [ ] `MASS_SLA_MISS` niciodata aplicat; withdrawQuote readuce slotul ACTIVE fara SLA job; calendar fara 6-7 ianuarie si Vinerea Mare; chat ramane scriibil dupa retragere/expirare claim.

### 3.4 Flux client (A2, A12)
- [ ] `details-step.tsx:391-394` "Inapoi" nu salveaza in store → descrierea/adresa se pierd.
- [ ] Edit-mode foloseste acelasi store persistat (`configurator-wizard.tsx:236-242`) → suprascrie/contamineaza ciorna noua; editarea porneste de la Cos si te obliga prin toate ecranele (`:80` `phase:'cart'`) → intra direct pe `review`.
- [ ] `configurator-wizard.tsx:274-277` `ready` ramane fals la eroare (403/404/retea) → "Se pregateste…" permanent, fara retry.
- [ ] Uploads: fara validare client de marime/tip (25MB din shared neverificat), `upload.isError` nerandat, `catch {}` in `room-sketch-upload.tsx:380-392` → fisierele respinse dispar tacut; `Dropzone` nu filtreaza `accept` la drag&drop.
- [ ] Acceptare oferta = 1 click fara confirmare, ireversibila (`offer-card.tsx:176-183`); `useAcceptQuote` nu invalideaza `['request']`.
- [ ] `useLogout` sterge doar `['auth']` din cache → datele userului precedent raman ~30s; `mm_req_token_*`, `mm_draft_token`, `mm_configurator_v1`, `mm_studio_v1.accountDraft` raman dupa logout → urmatorul cont mosteneste ciorna / vede "Actualizeaza draftul lui A". → `qc.clear()` + curatare localStorage la logout.
- [ ] `room-spec-card.tsx:199-202` "0 × 0.6 × 2.4 m" la proiect propriu / proiectare platita (vizibil si firmelor).
- [ ] `Configurator.nav.toDetails` "Spre date generale" duce la Fisiere; `requests/[id]/page.tsx:31-33` orice eroare = "Nicio cerere." (fara redirect la login pe 401, fara retry).
- [ ] Dupa acceptare: fundatura — clientul nu primeste contactul/profilul firmei castigatoare, niciun "ce urmeaza" (contract direct, avans, masuratori), `ClientFulfillment` returneaza `null` pe ACCEPTED/IN_EXECUTION; nu vede profil/portofoliu/rating la compararea ofertelor (doar `companyName`), fara vedere comparativa, fara "respinge oferta".
- [ ] Recenzia < 3 stele deschide automat DISPUTA fara niciun avertisment (`client-fulfillment.tsx:48-73`, `fulfillment.service.ts:99-113`); nu exista "deschide disputa" independent (ex. inainte de livrare).
- [ ] Dupa login-pentru-publicare reapare dialogul "continui sau incepi din nou?" (risc sa arunce ciorna completa); `?redirect=` se pierde prin verify-email → dupa login ajunge pe dashboard, nu la cerere.
- [ ] `details-step.tsx:315` randul telefon pe mobil ~35 px latime pentru numar (`grid-cols-[1fr_2fr_auto]` fara breakpoint).
- [ ] Detaliu cerere nu arata cate firme au preluat / SLA / "ce urmeaza"; niciun email/notificare de confirmare la publicare.

### 3.5 Flux firma (A4, A12)
- [ ] `marketplace/page.tsx:182-187`, `claims/page.tsx:206-212`, `messages/page.tsx:64-72`: `isError` netratat → firma PENDING/SUSPENDED/fara abonament vede pagini GOALE (si `/marketplace` e "acasa"); textele `Marketplace.apiErrors.COMPANY_NOT_APPROVED|COMPANY_SUSPENDED|SUBSCRIPTION_INACTIVE` EXISTA dar nu sunt folosite.
- [ ] `Marketplace.claimStatus` fara `WITHDRAWN`/`SLA_EXPIRED` (backend le seteaza) → cheie bruta afisata in 4 locuri.
- [ ] `lib/relative-time.ts:135` → pentru date viitoare "chiar acum" → "preluarea se anuleaza automat chiar acum" + SLA "chiar acum" (alarma falsa pe cel mai important ecran).
- [ ] Claim fara `assignToUserId` (`marketplace/[id]/page.tsx:128-134`) → toate preluarile pornesc neatribuite (auto-anulare 1h); EMPLOYEE_TRUSTED nu poate atribui (FE+BE) → claimul lui moare in 1h fara manager. → selector "Cine se ocupa?" (implicit eu); confirmare cu cost + SLA inainte de claim.
- [ ] Fisa de lucru: fara stare "ai pierdut" (slot ramane OFFER_SENT, contact client vizibil, "Retrage preluarea" activ); `ChatPanel` fara `readOnly` si fara erori la send; `DeliverButton` reapare dupa refresh; firma nu vede confirmarea/recenzia/disputa.
- [ ] `offer-builder.tsx`: fara atasamente (BE suporta, `quotes.controller.ts:159-168`); ignora matricea de permisiuni — cu defaults EMPLOYEE_TRUSTED/MANAGED nu pot trimite NICIODATA oferta (PRICE mereu "touched") dar vad formularul complet; `offer-card.tsx` CompanyActions fara nicio afisare de eroare, fara confirmare la "Inchei negocierea"/retragere; "Retrage preluarea" fara confirmare/consecinte (4.15).
- [ ] `company-dashboard.tsx`: `EMPTY_LOCATION` lat/lng 0/0 acceptat (firma in Golful Guineei, nu vede cereri); 0 afisare erori pe 8 mutatii; onboarding cere lat/lng tastate manual si NU creeaza locatie → firma aprobata vede marketplace gol fara explicatie; profilul nu e editabil (`useUpdateCompany` mort); "Adauga membru" cere cont COMPANY_USER preexistent, fara invitatie/explicatie/eroare; angajatul nou vede formularul "creeaza firma" (risc sa-si faca propria firma).
- [ ] Fara email/notificare la APPROVED/REJECTED; firma nu isi vede recenziile/ratingul nicaieri (`company.rating` mereu `null`, `computeRiskFlags(reviewCount=0)` → "Prea putine recenzii" la TOATE firmele).
- [ ] Wallet: pret buton NET vs comanda cu TVA; `e.ruleKey` brut ("SLA_MISS"); linkuri PDF `<a href>` direct catre API (ocolesc refresh → JSON 401 dupa 15 min).
- [ ] Admin lipsesc (4.19): cereri, claim-uri, credite (grant/ajustare), abonamente, penalizari per firma, useri, calendar business; dispute RESOLVED == DISMISSED ca efect, fara link la cerere, fara chat admin; detaliu firma arata doar contoare (DTO are membri/email/portofoliu/rejectionReason/suspendedUntil).

### 3.6 3D / Studio (A3)
- [ ] Dialogurile manuale (PieceEditorDialog, drafts, viewere; `studio-page.tsx:146,845,320`, `room-viewer.tsx:126`, `piece-viewer.tsx:136`) inchid la `click` pe backdrop → un drag pe slider/orbita eliberat peste margine pierde editarile. → inchide doar daca `pointerdown` a inceput pe backdrop, sau Radix Dialog.
- [ ] Drag din paleta/FloatingPanel fara `pointercancel` (`studio-page.tsx:1126-1162,540-572`, `room-canvas.tsx:797`) → pe touch ghost agatat + `dropPayload` in store (urmatorul tap aseaza piesa).
- [ ] "Adauga in cerere" apasat de doua ori dubleaza camerele-piesa in cos (`studio-page.tsx:1305-1328`, `addRoomWithAnswers` doar append).
- [ ] `RoomCanvas` (`room-canvas.tsx:969`, pagina publica `/studio`) singura scena fara `hasWebGl()` → crash fara WebGL.
- [ ] Scena 3D atasata cererii nu apare/nu se poate detasa nicaieri in wizard/sumar (grep `studioScenes` in configurator → 0); firma o vede si dupa ce clientul a scos piesele din cos.

### 3.7 i18n / copy (A6)
- [ ] Numele corpurilor din `packages/shared/questionnaire/flows/*.ts` (`'Masuta cafea'`, `'Comoda TV'`, `'Dulap pana in tavan'`, `notes.push('canal cabluri')` — ~35 valori) ajung in `room-spec-card.tsx:192`: RO fara diacritice si netraduse in EN.
- [ ] Brand vechi in backend: 2FA issuer `'Marketplace Mobilier'` (`two-factor.service.ts:40`), vanzator implicit `'Marketplace Mobilier SRL'` (`payments.service.ts:114`).
- [ ] `Nav.claims = "Revendicări"` vs "Preluările mele"/"Preia" (51 aparitii) — doua denumiri pentru acelasi concept (si in Termeni).
- [ ] `layout.tsx:31-35` un singur `metadata` static RO aplicat si pe `/en`; toate paginile au acelasi `<title>`; fara `metadataBase`/OG/hreflang/robots. → `generateMetadata` per locale + titluri per pagina.
- [ ] `ROLE_LABEL` hardcodat "Firmă" in `app-header.tsx:42-46` (si pe EN); `Landing.metricWorkshops/Projects/Satisfaction` "340+/2.8k/94%" — statistici inventate (moarte azi, de sters).

### 3.8 Infra / deploy / operare (A10, A13)
- [ ] `start-combined.sh`: bash PID 1 fara `trap`/`exec` → SIGTERM nu ajunge la node, shutdown hooks nu ruleaza in prod (Prisma/BullMQ/Puppeteer taiate); `migrate deploy` la boot fara backup/rollback si fara `healthcheckPath` Railway.
- [ ] `Dockerfile.app`: ruleaza ca root, `COPY --from=build /app ./` copiaza tot workspace-ul (devDeps, surse, `.next/cache`), `node:20` nepinuit (EOL); Puppeteer `--no-sandbox` ca root.
- [ ] Storage: `bitnamilegacy/minio` nementinut, fara backup volum, credentiale/consola nedocumentate; DB fara backup documentat/automat; fara job de curatare (refresh tokens, idempotency keys, geocoding cache, uploads orfane, drafturi anonime >30 zile).
- [ ] Observabilitate: fara Sentry/uptime/alerting, fara `LOG_LEVEL`, access-log pe tot inclusiv `/health`; nicio pagina de mentenanta.
- [ ] Domeniu custom + `FRONTEND_ORIGIN`/`MAIL_FROM`/restrictie cheie Google Maps (coapta in bundle — public by design) pe domeniu; `robots.ts` (disallow `/admin`, `/dashboard`, `/marketplace`, `/requests`, `/dev`), `sitemap.ts`, `icon.svg`/`apple-icon`, `not-found.tsx` + `error.tsx` (404 = pagina default Next, neagra, engleza, fara brand); `favicon.ico` 404 pe fiecare pagina.
- [ ] Imaginile din "Caietul de idei" de pe landing sunt hotlink-uite de pe CDN-ul Webflow al Mobila Unicat (`lib/inspiration.ts:16`) → copiaza in storage propriu (confirma acordul).
- [ ] Stari de eroare lipsa: `/partners` (goala), `/inspiration` (eroare = "nicio idee"), `/inspiration/boards`, `requests/page.tsx`, `dashboard`, admin dashboard "Se incarca…" la infinit.
- [ ] CI inexistent (`.github/` lipsa); root fara `test`; backend/shared fara ESLint; netestat: claim concurrency, idempotency, workerii SLA/expirare, penalizari, webhook plati, token rotation, quotes/requests lifecycle; FE 0 teste.
- [ ] Docs desincronizate: docs/08 descrie deploy pe 2 servicii (`apps/*/Dockerfile`, `BACKEND_INTERNAL_URL=https://…`) desi LIVE = `Dockerfile.app` un container; `.env.example` backend fara `MESSAGE_ENCRYPTION_KEY`/`NOMINATIM_*`, frontend fara `BACKEND_INTERNAL_URL` si cu `NEXT_PUBLIC_SOCKET_URL` mort; docs/03 inca are regula veche de credite (1/2/4), docs/04 fara `studio_drafts`/`request_studio_scenes` (+5 tabele inexistente descrise, 6 coloane redenumite), docs/07 se opreste la 2026-07-12, docs/ERROR_CODES.md 15 coduri nedocumentate; `README-SETUP.md` = nota starter-pack din iunie (refera docx inexistent).

### 3.9 Shared / prisma (A11)
- [ ] `project_size_thresholds.credit_cost` editabil din Admin dar necitit (costul = `creditCostFromBaseScore`, r5) → scoate din UI/DTO + actualizeaza docs/07 D-v6-5.
- [ ] Dubla validare zod (shared, ~45 scheme) vs class-validator (BE) — ~25 scheme ruleaza doar ca `z.infer`, drift deja prezent (`coverageRadiusKm`, enum-uri inline). DECIZIE: nestjs-zod sau reducere shared la tipuri.
- [ ] 8 coduri user-facing aruncate fara mesaj FE (`MANAGER_UNASSIGNED_CAP_REACHED`, `REQUEST_NOT_DELETABLE`, `REVIEW_NOT_ALLOWED_YET`, `REVIEW_ALREADY_SUBMITTED`, `DELIVERY_NOT_ALLOWED`, `COMPLETION_NOT_ALLOWED`, `CREDIT_PACKAGE_INACTIVE`, `UNAUTHORIZED`) → fallback generic; `VALIDATION_ERROR`/`INTERNAL_ERROR` duplicate in 6 namespace-uri.

---

## 4. CHECKLIST P2 — polish (dupa lansare, grupat)

- **Design system / consistenta**: 2 headere cu inaltimi/breakpoint-uri diferite; `SectionRule` desenat de 3 ori, `CtaBand` duplicata, `PIN_ASPECTS` x3; `window.confirm`/`confirm()` nativ in 4 locuri vs Dialog Radix; `offer-card.tsx` 11 `<button>` brute + `<style jsx>` in offer-builder vs `Input`/`Button` din ui; `Field`/`Section`/`toggle<T>` locale duplicate; `Stepper` local in configurator3d-step vs `ui/stepper`; `hasWebGl()` x3, `CameraRig` x2, `onZoneClick` x2, `StudioModal`/`TutorialModal`, constante culori x2; dialoguri manuale fara focus-trap in studio; `bg-[#b08d57]` vs `bg-brass`; `--surface` inexistent in `globals.css:148,172` (inelul slider-elor lipseste); contrast `--muted-2` ≈ 2.6:1 pe text mic; paleta `.dark` completa (44 linii) + `darkMode:'class'` fara toggle (decizie); `plan` alias, `shadow-glow`, `container` nefolosite; `Button` fara prop `loading` (niciun submit nu are spinner); `Alert` props `icon/title/action` si tonuri `sage/neutral` nefolosite.
- **UX client**: stepper-ul fazelor neclicabil; "Inapoi" de pe primul ecran al camerei 2+ sare la Cos; cardurile `h-72` pe mobil (6 optiuni = ~1.800 px scroll); `InspirationPicker` randat in doua faze; sumar fara buget/termen/contact; dimensiuni mereu "m" desi input in cm; "lei" hardcodat in slider vs "RON" in dashboard; Places `language=ro` si pe EN; ARIA labels hardcodate EN; `useSearchParams` fara Suspense in login/register; `IN_EXECUTION` tratat in FE dar niciodata setat de BE; `useRequest` retry pe 404; `OWN_PROJECT` exista de 2 ori (cartonas + checkbox in Cos) cu stare desincronizata; `onExitToCart()` apelat in render; panoul clopotel `w-[22rem]` iese din viewport sub 360 px; `href="#"` + `target=_blank` pe atasamente fara URL; `© 2026` hardcodat; cookie `NEXT_LOCALE` fara `Secure`; fara security headers in `next.config.mjs` (+ `poweredByHeader`); active-state cu `endsWith` gresit pe sub-rute; 11 PNG = 2,7 MB servite cu `<img>` (WebP/next-image); ghid schita: text "plan vazut de sus" vs plansa in perspectiva.
- **UX firma**: "Revendicari" vs "Preluari"; firma PENDING vede toate linkurile; deep-link notificari → lista generica (fara `claimSlotId` in payload); socket nu invalideaza `claims`/`quotes` la `claim.created`/`request.status_changed`, `claim.withdrawn` neascultat; date cu `toLocaleString()` (timezone browser) in 10 locuri vs `useFormatter` + `timeZone: 'Europe/Bucharest'`; SLA fara timp ramas/urgenta, `StatusBadge` fara ton pentru ACTIVE/SLA_EXPIRED; marketplace fara filtre/sortare/paginare (200 cereri), claims fara filtru "active"; EMPLOYEE_MANAGED vede "Preia" (BE refuza cu mesaj despre atribuire); flash de empty-state in wallet; "Disponibile" = "Sold liber" mereu egale; chat fara auto-scroll/data/Enter, 📎 emoji, input fisier fara filtru tip; "Cere clarificare" nu spune ca pune SLA pe pauza; stergere locatie/membru/portofoliu fara confirmare; portofoliu doar URL (fara upload); 3 "acasa" pentru firma.
- **Admin**: `adminApprove` permite aprobarea REJECTED/SUSPENDED; liste fara paginare (companii, 162 poze); `entityId=null` la SETTING_UPDATED; `seed.ts` suprascrie planuri/praguri la re-rulare; galeria poate atribui lucrari firmelor neaprobate, `@IsUrl` accepta http; audit viewer fara userId/entityId/after; jobs fara timestamp/payload/counts; Breakdown cu enum-uri brute; sidebar 260 px fix sub 900 px; "Plan · panou operational" filler; setari fara feedback si fara ordine S/M/L; mesajele "aprobata/respinsa" dispar instant; inspiratie fara cautare/editare; withdrawals fara deadline 48h vizibil.
- **3D**: `MAX_STUDIO_DRAFT_BYTES=300_000` vs body-parser 100 kb (413 generic); INVALID/TOO_LARGE/404 toate pe "mai incearca"; limitele 60/120/24 si `MAX_REQUEST_ROOMS` neaplicate in store; `snapshots3d` nepersistat (piesele din Studio publica fara PNG); `config3dContext` obiect nou la fiecare render; `'Camera 1'`/`'Piesa mea'` hardcodate in store; swatch-uri cu id brut; login din drafts fara `?redirect=/studio`; `RoomDimControl` fara `aria-label`; tur pierdut la refresh; `drawersTooHigh/hangingNeeds` traduse dar nefolosite; Esc inchide editorul fara confirmare; persist la fiecare pointermove; titluri "a clientului" afisate clientului; `doorType` hidden cu toate optiunile; `>= 0.22` hardcodat vs `COLUMN_W_MIN`.
- **i18n**: 12 plurale ICU fara `few`; "RON" (3 chei) vs "lei" (73); "Proiectare plătită" vs "Proiectare cu plată inclusă" (3 formulari); "..." vs "…"; `Legal.lastUpdated` static "iulie 2026"; cookie de limba descris in Politica vs `localeDetection:false` (verifica); "13.900 lei" hardcodat in process-band; `dialog.tsx` "Close" / `phone-input` "country code" EN.
- **Backend**: idempotency hash fara path params; `addMember` fara consimtamant + enumerare email; `refresh()` nu verifica `deletedAt`; HMAC unsubscribe reutilizeaza `JWT_ACCESS_SECRET`; drafturi + presigned PUT 25 MB anonime fara cota/curatare, token de draft valabil si dupa publish si logat in `req.url`; scan AV mock sincron, extensie necorelata cu MIME; lock 3.1 lipsa pe withdraw/SLA/delete/assign; `credits.reserve/consume` fara `balance >= n` in DB; `listMessages` fara paginare; N+1 pe liste oferte/mesaje; broadcast socket catre toate socketurile; `after: result` intreg in audit; `maxClaims: 3` hardcodat in DTO; `validityDays` max 365 hardcodat; PDF oferta doar RO + status enum brut; `available` calculat diferit dashboard vs wallet; lat/lng firma din client fara geocodare; ThrottlerModule in memorie; fara `compression()`; health fara throttle dedicat; `req.url` in log; Prisma fara `connection_limit` documentat.
- **Schema**: 7 indexi redundanti, indexi lipsa (`audit_logs(user_id/action)`, `messages(chat_thread_id,created_at)`, `notifications(user_id,created_at)`, `claim_slots(company_id,status)`, `requests(status,published_at)`), CUI fara unique partial; `updated_at` lipsa pe ~20 modele mutabile; `Idempotency-Key` si `User-Agent` stocate nelimitat; editarea post-claim sterge camerele → cascade pe `quote_version_room_prices` ale ofertelor retrase; enum-uri inline in shared in loc de constante; `CREDIT_VALUE_RON == BUDGET_RON_PER_POINT` (formula tautologica); comentariu stale "FK reala vine in Sprint 6".
- **Repo**: 9 fisiere > 800 linii (studio-page 1844, dimension-figures 1145, quotes.service 1140…); 9 `exhaustive-deps` dezactivate; `noUnusedLocals` off; 63 pachete in urma (NestJS 10→11, Prisma 5→7, zod 3→4, three/R3F/drei, tailwind 3→4, next-intl 3→4) → sprint "dependency refresh" post-lansare.

---

## 5. DE STERS — cod mort, filler, fisiere fara rost

### 5.1 Frontend — fisiere intregi (0 importatori; dovada: graf importuri + grep)
- [ ] `app/[locale]/_components/hero-sheets.tsx` (211 linii) — landing v1, inlocuit de `hero-demo.tsx`
- [ ] `app/[locale]/_components/process-section.tsx` (186) — inlocuit de `process-band.tsx` (contine si vigneta "trei ateliere")
- [ ] `components/ui/card.tsx` (50), `choice-card.tsx` (95, dublura `playing-card`), `score-gauge.tsx` (50), `separator.tsx` (21), `switch.tsx` (40), `timeline.tsx` (32)
- [ ] `lib/mock-partner-meta.ts` (30) — dupa fix-ul P0 (singurii consumatori: carusel + `/partners`)
- [ ] `app/[locale]/landing-v2/_components/` — director gol; `landing-v2/page.tsx` doar redirect → muta in `next.config.mjs redirects()` si sterge pagina (decizie)
- [ ] `app/[locale]/dev/piece-3d/page.tsx` — 404 in prod, dar ruta + bundle intra in build si e prerenderizata ro/en → exclude din build-ul de prod (sau sterge)

### 5.2 Frontend — exporturi/functii moarte
- [ ] 13 ilustratii line-art inlocuite de `photo.tsx`: `illustrations/common.tsx:26-92` (`IlluPal`, `IlluMdf`, `IlluLemnMasiv`, `IlluPush`, `IlluGlisante`, `IlluButonPresiune`, re-export `illustrationStrokeProps`), `materials-systems.tsx:9-93` (`IlluMdfInfoliat`, `IlluMdfVopsit`, `IlluMdfFurnir`, `IlluAltMaterial`, `IlluManer`, `IlluGola`, `IlluAventos`) — ramane doar `IlluCountertopHpl`
- [ ] `ui/dialog.tsx:8-9` `DialogTrigger`, `DialogClose`
- [ ] `hooks/use-company.ts` `useUpdateCompany`, `useUpdateLocation` (sau construieste editarea profilului — P1); `hooks/use-quotes.ts:27` `useCompanyQuotes`; `hooks/use-requests.ts:96` `useEditRequest`, `:169-175` `useUploadAttachment`, `useRemoveAttachment`
- [ ] `lib/inspiration.ts:6-14` `FURNITURE_TYPES` (+ tip); `inspiration/boards/[id]/page.tsx:110` `tc` nefolosit; `inspiration-picker.tsx:82-83` `t`/`tc` duplicat; `requests/page.tsx:177` ramura `statusValue.DRAFT`; `marketplace/[id]/page.tsx:150` `claim.isSuccess && t('claimSuccess')` (navigheaza imediat); `use-claims-lifecycle.ts:196-199` `void v`; `wallet/page.tsx:243` + `offer-card.tsx:19` `const API` duplicat din `lib/api.ts`
- [ ] ~40 `export` inutile (simbol folosit doar in propriul fisier): `dimension-figures.tsx` (9 figuri), `review-rail.tsx` `RailState/RailNode`, `attachment-item.tsx` `AttachmentKindIcon`, `button.tsx` `ButtonProps/buttonVariants`, `badge.tsx`, `alert.tsx`, `address-autocomplete.tsx`, `question-anchor.tsx`, `studio/palette.ts`, `tutorial.tsx` `TUTORIAL_STEPS/TutorialTarget`, `configurator-store.ts`, `studio-store.ts` (`STUDIO_WALLS`, `STUDIO_SNAP`, `clampToRoom`, `snapToGrid`, re-export `OPENING_SPECS`), `use-inspiration.ts` `INSPIRATION_PAGE_SIZE`, `mobile-nav.tsx`, `public-header.tsx` `PUBLIC_LINKS`
- [ ] Tailwind/CSS: `tailwind.config.ts:67-71` alias `plan/plan-deep/plan-soft` (0 uz vs `walnut` 294), `:107` `boxShadow.glow`, `:8-12` `container`, `darkMode` + `globals.css:65-108` bloc `.dark` (decizie PO); `.eslintrc.json:3` `plugins: ["@typescript-eslint"]` fara reguli

### 5.3 i18n — chei moarte (~141 x 2 limbi; lista completa in A6 Anexa)
- [ ] `Landing.*` — 47: hero vechi, metricile INVENTATE `metricWorkshops "340+"`, `metricProjects "2.8k"`, `metricSatisfaction "94%"`, sectiunea "Formatul proiectului" Small/Medium/Large, banda CTA firme, sectiunea inspiratie, + 16 vii doar in `hero-sheets`/`process-section` (neimportate). Raman vii: `partners*`, `googleReviews`, `reviewsShort`, `carousel*`, `partnerSpecialty.*` (dispar cu mock-ul), `footerTagline`. Redenumeste `LandingV2` → `Landing`.
- [ ] `Configurator.flows` — 35: `BEDROOM.wardrobeToCeiling.*` (7), `HALLWAY.depthProfile.*` (18), `DRESSING.toCeiling.*` (7), `OFFICE.cableManagement.*` (3); de confirmat `HALLWAY.openingSystems.title/subtitle`
- [ ] `Requests.*` — 25 (formularul vechi manual: `field.title/description/lengthM/…`, `addRoom/removeRoom/addItem/removeItem/items/newSubtitle/uploading/countryRomania`, `material.*`, `system.*`) + `Requests.validation.descriptionTooShort/contactChannelTooShort`
- [ ] `Configurator.sketchGuide.steps.*` (8, duplicat cu `SketchGuidePage.steps.*`), `Configurator.uploads.status.*` (4), `config3d.drawersTooHigh/hangingNeeds` (2 — sau foloseste-le ca hint), `diagram.islandLength/islandDepth` (2), `common.pieceSystems.title`
- [ ] `Marketplace.subscription.tier.*` (3), `Marketplace.publishedAgo`, `Common.loading`, `Common.languageSwitcher`, `Nav.home`, `Nav.forCompanies`, `Company.edit/save/role`, `Auth.logout`, `Quotes.noOffers/offerLabel`, `LandingV2.previewBadge`, `Studio.renameScenePrompt`, `Partners.ratingPlaceholder` (SAU foloseste-l la fix-ul P0), `Partners.ratingSoon` ("in curand"), `Inspiration.openPinterest`, `Marketplace.apiErrors.ASSIGNED_USER_PENALTY_BLOCKED` (cod mort)

### 5.4 Backend — dependinte, rute, cod mort
- [ ] `apps/backend/package.json` `uuid` + `@types/uuid` (0 importuri)
- [ ] `prisma/update-demo-credits.ts` + script `seed:demo-credits` (one-off deja rulat pe prod); literalul `Demo1234!` din `seed-demo.ts` + docs/06
- [ ] Rute fara apelant FE: `GET /quotes/:id`, `GET /client/quotes/:id`, `POST /quotes/claims/:claimSlotId/attachments` + `/confirm` (sau construieste UI-ul de atasamente oferta — P1), `POST /admin/credit-packages`, filtrele `entityType/userId` din `GET /admin/audit-logs` (sau expune-le), `POST /webhooks/payment` (pastreaza doar daca vine un PSP), `POST /billing/subscription/purchase` (sau construieste UI-ul — P0)
- [ ] `notifications.service.ts:97-101` `assertOwner()`; `claims.constants.ts:15` `ASSIGN_WARNING_MS`; `event-bus.service.ts:15` tip `'sla.expiring_soon'`; `penalties.service.ts:16` fallback `MASS_SLA_MISS` (+ regula din seed); `company-context.ts:10` `subscriptionId` (setat, necitit); `inspiration.controller.ts:24` `OptionalJwtAuthGuard` pe controller cu o singura ruta `@Public()`; `auth/guards/two-factor.guard.ts` no-op neaplicat (leaga de rute sau marcheaza explicit)
- [ ] `admin.dto.ts:60` `UpdateThresholdDto.creditCost` + `admin.service.ts:203` (camp mort); `system_settings` `employee_penalty_threshold`/`employee_block_months` (`seed.ts:159-160`, 0 consumatori, decizie Sprint 7 — scoate din seed + UI)
- [ ] `studio`: `model.ts:481-485` `nextZoneType()` (doar teste), `model.ts:490` `panelsWithinBounds()` (doar teste → test-utils), `studio.schemas.ts:58` `STUDIO_ROTATIONS`, `flows/index.ts:166-216` bloc de 51 exporturi individuale (0 importuri; `questionnaire/index.ts` re-exporta doar `CURRENT_FLOW_VERSION, FLOW_REGISTRY`)
- [ ] `previews.tsx:53,113,129` `role="img"` + `aria-hidden="true"` contradictoriu

### 5.5 Shared / prisma (A11, lista exacta in anexa)
- [ ] 38 exporturi complet moarte: `updateSettingSchema`, `paymentWebhookSchema`, `ClaimSlaDto`, `companyRejectSchema`, 12 tipuri derivate din `enums.ts` neimportate (sau FOLOSESTE-LE in DTO-uri), `CREDIT_TRANSACTION_TYPES`, `REQUEST_EXCLUSION_REASONS`, `MAX_INSPIRATION_PER_REQUEST`, `inspirationBoardInputSchema`, `ClaimedRequestDto`, `endNegotiationSchema`, `RequestRoomInput`, `RequestContentInput`, `ConfiguratorRoomInput`, `requestEditSchema`, `confirmUploadSchema`, `RO_PHONE_REGEX`/`INTL_PHONE_REGEX` (doar local); + ~25 scheme zod vii doar prin `z.infer` (`admin.schemas.ts` 4, `quote.schemas.ts` 8, `company.schemas.ts` 7, `claims-lifecycle` 4, …) — de sters daca se alege class-validator
- [ ] 11 `ERROR_CODES` niciodata aruncate: `SESSION_SUPERSEDED`, `REQUEST_EXPIRED`, `GATING_NOT_OPEN` (ar trebui ARUNCAT, nu sters), `ASSIGNED_USER_PENALTY_BLOCKED`, `WITHDRAWAL_GRACE_EXPIRED`, `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`, `SLA_ALREADY_BREACHED`, `CREDITS_EXPIRED`, `AUDIT_LOG_IMMUTABLE`, `ADMIN_DECISION_REQUIRED_FIELDS`
- [ ] 9 valori de enum niciodata scrise (marcheaza "rezervat" in docs/04 sau implementeaza, NU `DROP VALUE`): `RequestStatus.IN_EXECUTION`, `SubscriptionStatus.EXPIRED/CANCELLED`, `QuoteStatus.DRAFT`, `AttachmentStatus.PENDING_SCAN`, `PhysicalConsultationInviteStatus.COMPLETED`, `PenaltyScope.EMPLOYEE`
- [ ] Coloane: `users.anonymized_at` (0 referinte — sau GDPR), `project_size_thresholds.credit_cost`; scrise-dar-necitite de documentat: `subscriptions.trial_ends_at`, `mock_billing_orders.payment_source`, `idempotency_keys.response_status`, `companies.suspended_at`, `claim_slots.project_score_snapshot`, `request_versions.snapshot` (istoric fara UI), `company_verification_profiles.decision_note`

### 5.6 Repo / config / docs
- [ ] `.claude/settings.local.json` URMARIT in git (permisiuni personale, cai Windows, o parola de test) → `git rm --cached` + `.gitignore`; `.claude/worktrees/` doar in `.git/info/exclude` → `.gitignore`; worktree stale `.claude/worktrees/unruffled-bardeen-4fff21` + branch `claude/unruffled-bardeen-4fff21` (0 ahead; are o modificare necomisa in `use-fulfillment.ts` — verifica apoi sterge); branch `feat/configurator-atelier-and-sketch-guide` local + origin (0 ahead, 34 behind)
- [ ] `NEXT_PUBLIC_SOCKET_URL` din `apps/frontend/.env.example:2`, `apps/frontend/Dockerfile:18,22`, `Dockerfile.app:26,30` (necitit nicaieri)
- [ ] `Design/uploads/*.docx` — 3 copii identice Product Bible + 2 Continuitate + `Design/.thumbnail`; `Design/*.jsx|css|html` prototip nereferit (pastreaza unul, muta in `docs/design-prototype/` — decizie)
- [ ] `docs/09`, `docs/11` (3.712 linii, intra in contextul agentilor), `docs/12-16` (worksheet-uri executate), `docs/10`, `docs/sprint-0-architecture.md` → `docs/archive/` + index; muta deciziile vii (criptare NU e2e din docs/16, regula creditelor din docs/15, D4/D6 din docs/09) in docs/07; scoate parola din docs/06
- [ ] `README-SETUP.md` → rescrie ca README real sau sterge; docs/08 blocul "Frontend (build args) … apps/frontend/Dockerfile" (serviciu separat inexistent); `dev-infra/docker-compose.prod.yml` + `apps/*/Dockerfile` = al doilea pipeline de deploy (marcheaza deprecated sau sterge — decizie)
- [ ] Comentarii cu "atelier" (cosmetic): `public-header.tsx:21`, `page.tsx:166,207`, `partners-carousel.tsx:12`, `hero-demo.tsx:392`, `notification-bell.tsx:21`, `process-section.tsx`, `admin/inspiration/page.tsx:31`, `inspiration.dto.ts:73,123`; `admin/layout.tsx:72-74` caseta "Plan · panou operational" (filler); `messages/page.tsx:36-37` comentariu fara cod corespunzator
- [ ] `.claude/launch.json` diff necomis (tooling local) — commit sau revert

---

## 6. BINE FACUT — ce e solid si nu trebuie atins

- **Auth**: bcrypt 12 + dummy-compare, tokenuri DOAR in cookie httpOnly/secure/Lax (refresh cu path restrans), rotation cu familie + grace 30s + detectie reuse, o singura sesiune activa cu `auth_expired` pe socket, email verification one-time in Redis, ADMIN neinregistrabil public, secrete JWT `min(16)` fail-fast fara default.
- **Autorizare**: guard-uri globale Throttler → JWT → Roles, `@Public()` explicit, `CompanyApprovedGuard`/`SubscriptionActiveGuard`, ownership verificat in servicii pe toate resursele (cu exceptia IDOR-ului de clarificari), admin 100% `@Roles(ADMIN)` (verificat live: CLIENT → 403 pe toate prefixele), marketplace fara PII pre-claim, DTO client ascunde lat/lng/sizing.
- **Integritate**: claim Serializable + `FOR UPDATE` + indexi partiali unici ca backstop, Idempotency-Key pe toate POST-urile critice (hash include userId), webhook HMAC `timingSafeEqual`, pret din DB, ledger de credite coerent, audit append-only (trigger DB) cu IP hash, `ValidationPipe whitelist+forbidNonWhitelisted`, `MaxLength` peste tot, SQL brut doar parametrizat, HTML escapat in PDF-uri, criptare mesaje AES-256-GCM cu dual-read, unsubscribe HMAC.
- **Storage**: doar presigned PUT 15 min / GET 5 min, chei server-side (fara path traversal), MIME whitelist + size in semnatura, download doar pentru SAFE.
- **Calendar/SLA**: Europe/Bucharest cu DST testat, zile lucratoare + sarbatori + override DB, SLA 3/3/5, grace 12h, expirare 5 zile lucratoare; ceasurile scurte wall-clock (D-v6-9).
- **Business**: masina de stari a ofertelor (max 3 versiuni, extensii max 2, reofertare, consultanta cu expirare, RON/EUR, matrice permisiuni, preturi pe camere), retrageri 4.15 cu validari automate + gratie 30 min, re-publicare dupa SLA in masa cu excluderi, penalizari rolling 180 zile, facturare serie+numar cu TVA/seller snapshot, 7 cozi BullMQ toate cu producer+worker, emailurile existente respecta preferinta + limba + unsubscribe.
- **Frontend**: design system coerent (tokeni, `Button` cva, carduri), `prefers-reduced-motion` global + local, focus vizibil, `aria-*` pe butoane-icon/dialoguri/SVG, `alt` corect peste tot, `rel=noopener` pe externe, zero `dangerouslySetInnerHTML`, toate rutele linkate exista, middleware i18n simplu si corect (RO implicit, EN la alegere), schemele zod partajate FE/BE pentru login/register/configurator, wizard cu persistenta locala + server (draft anonim cu token, dialog de reluare, discard server-side), validare per pas cu interval afisat, overlay de publicare cu seed de cache, emailul contului blocat ca prim contact (FE+BE), upload-uri secventiale cu acumulator, snapshot PNG 3D best-effort, fisa de lucru firma bine structurata, chat cu citit/necitit real + realtime + polling, offer builder cu defalcare pe camere si blocare pret.
- **3D**: three/drei/fiber NU intra in bundle-ul initial (`next/dynamic` + `ssr:false`), `frameloop="demand"`, dispose pe geometrii, cleanup pe listenere, validare identica FE/BE (`.strict()`, plafon bytes inainte de zod, 20 drafturi/user, ownership 404), model parametric pur in shared cu 113 teste, tutorial skip-abil cu `tutorialSeen`, fallback WebGL in configurator si viewere, toate butoanele-icon cu `aria-label`, `/dev/piece-3d` 404 in prod, flow-urile v1/v2 FROZEN corect in `FLOW_REGISTRY`.
- **i18n**: 2.667 chei RO = EN, 0 chei lipsa, 0 placeholder-uri ICU diferite, diacritice ~100% in RO, ton unitar "tu", ghilimele „”, 0 "atelier"/"workshop" in valori, 0 texte netraduse reale, `/dev/piece-3d` gardat.
- **Igiena**: 0 `console.*`, 0 `debugger`, 0 `@ts-ignore`, 0 TODO/FIXME, 0 cod comentat, 0 `any` in productie, toate dependintele FE reale, `public/` fara orfane, niciun `.env` in git/Docker, `.dockerignore` corect, typecheck strict verde, lint FE verde, 39 + 113 teste verzi, migrari == schema (28 foldere conventionale, backfill comentat, rollback documentat), enum-uri shared ↔ Prisma identice, toate `DateTime` Timestamptz, bani pe Decimal, comentarii ~99% romana, CHANGELOG detaliat per sprint.
- **Infra**: validare env Zod fail-fast, health real DB+Redis+S3, pino JSON cu traceId + redact, Docker multi-stage cu openssl/Chromium/pnpm fixat, seed-uri idempotente, gotcha-uri Railway documentate.

---

## 7. DECIZII NECESARE PO (consolidate; detalii per arie in anexe)

1. **Domeniul final** + **provider SMTP** + adresa de contact/suport (intra si in Termeni).
2. **Entitatea juridica** (denumire, CUI, Reg. Com., sediu, IBAN, seria reala de facturi) pentru Termeni/Politica si `seller_*`; brand "Cozy Home" vs "CozyHome".
3. **Plata la lansare**: PSP real sau transfer bancar + confirmare admin (si atunci: instructiuni afisate, referinta, anulare comanda, factura proforma vs fiscala).
4. **Abonamente dupa trial**: cumparare in FE (mock sau real), grant manual de admin, sau fara expirare la lansare; prelungire vs inlocuire; avertizare inainte de expirare; 4.16 credite 3 luni — post-MVP?
5. **Ce ramane din datele demo pe prod** (recomandat: nimic; Mobila Unicat ramane cu CUI/RegCom reale?); conturile `@demo.ro` si parolele lor.
6. **Recenzii/rating**: nimic afisat pana la date reale (recomandat) sau alt semnal; integrarea Google Reviews exista la lansare? specializarea firmei ca camp real?
7. **GDPR**: stergere/anonimizare cont + export in MVP (self-service vs email catre operator) sau amanat explicit + textul Politicii rescris; retentie date (cat tinem cereri/chat/fisiere).
8. **Firme cu claim ACTIV fara oferta cand clientul accepta alta**: refund sau consum (pay-to-play)? **Timeout decizie client** pe oferte (cat, si ce se intampla cu creditele)? **Oferta expirata** fara reofertare: cand se elibereaza slotul si se aplica 3 pct? **Livrare neconfirmata**: auto-COMPLETED dupa N zile? **Clarificare fara raspuns**: SLA reia dupa N zile? **Suspendare**: ridicare automata sau admin?
9. **Retrageri** `CLIENT_CONTACT_INVALID`/`CLIENT_REQUESTED_CANCELLATION`: auto-aprobate fara dovada la lansare?
10. **Dupa acceptare**: ce vede clientul (contact firma cand? contract/avans/masuratori — plata e in afara platformei, confirmati) si partajarea contactului client (4.2, 5 optiuni) — confirmati abandonarea in favoarea "contact complet la claim".
11. **Dispute**: "deschide disputa" independent de recenzie? adminul intra in chat (4.19)? efect RESOLVED vs DISMISSED asupra recenziei/ratingului? recenzia < 3 = disputa automata ramane (cu avertisment)?
12. **Echipa firmei**: invitatie pe email (flux nou) sau "angajatul se inregistreaza, owner-ul il adauga"; cine poate trimite oferte (EMPLOYEE_TRUSTED nu poate niciodata cu defaults); onboarding fara acte ramane? prima locatie auto din adresa (raza 50 km)?
13. **Scopul consolei admin la lansare** (4.19): cereri, claim-uri, credite, abonamente, penalizari, useri, calendar — care intra in MVP; cum e anuntat adminul (email/clopotel).
14. **Clientul poate refuza explicit o oferta?** `IN_EXECUTION` se foloseste sau se scoate? stepper clicabil? `InspirationPicker` intr-un singur loc? "Am proiect" cartonas vs checkbox?
15. **Storage**: MinIO legacy (backup?) vs R2/B2/Railway Object Storage; **planul Railway** (backups Postgres, 1 container vs FE/BE separate); Mailpit se sterge dupa SMTP; **Sentry** (DPA) vs doar uptime; **Google Maps Places** la lansare (cheie + billing + restrictie + mentiune GDPR) sau input text.
16. **Upgrade Next 14 → 15** inainte sau imediat dupa lansare; CI minim (GitHub Actions) — OK?; teste de concurenta (claim/idempotency/SLA) pre sau post-lansare.
17. **Arhitectura shared**: scheme zod ca sursa unica (nestjs-zod) sau reducere la tipuri + 4 scheme FE; FK-uri "soft" vs reale; `request_versions.snapshot` fara UI — pastram?
18. **Curatenie**: arhivam docs/09-16 + Design/ (docx duplicate)? stergem `hero-sheets`/`process-section` + 47 chei Landing? dark mode (paleta exista, fara toggle) — livram sau stergem? flow-urile v1/v2 — exista cereri pe prod pe ele (altfel ~2.900 linii pot fi retrase)? `docker-compose.prod.yml` + `apps/*/Dockerfile` mai sunt o cale suportata?
19. **Terminologie**: "preluare" vs "revendicare"; "Proiectare plătită" vs "Proiectare cu plată inclusă"; "lei" vs "RON"; numele corpurilor traduse in EN (si cu diacritice)?; intervalele de pret din configurator (~75 valori) validate de PO/firme sau marcate "orientativ"?
20. **Drafturi anonime**: cota per IP + curatare la 30 zile (drafturi + fisiere)?; tokenul de draft invalidat la publish?; scanare AV reala la lansare?; lockout de cont dupa N parole gresite?; adaugarea unui membru fara acceptul lui e intentionata?

---

## 8. Ordinea recomandata (plan de lansare)

**Sprint L0 — "deblocare" (fara de care nu exista utilizatori):**
1. Commit separat `next.config.mjs` + commit copy/UI + CHANGELOG → typecheck/lint/test → deploy; verifica websocket pe prod.
2. Decizii PO 1-5 (domeniu, SMTP, entitate juridica, plata/abonament, demo).
3. Backup DB → curatare demo → `seller_*` reale → admin real (`seed-admin.ts`) → roteaza secretele si `admin@demo.ro`.
4. SMTP real + SPF/DKIM/DMARC → test register→verify→login real; sterge Mailpit.
5. `resend-verification` + `forgot/reset/change-password` + `register()` best-effort email.
6. Legal: date reale in Termeni/Politica, checkbox la register, rescriere promisiuni (marketing/stergere), brand unificat; scoate ratingurile mock + frazele despre Google.
7. Fix header public 640–1100 px; `not-found.tsx`/`error.tsx`; `robots`/`sitemap`/`icon`/`metadataBase` + `generateMetadata`.
8. Soft-delete filtrat in marketplace/claim; guard-uri de status in create/accept quote + inchidere sloturi la accept + consum la retragere tarzie + quote la retragere claim.
9. Fix admin settings (`id` in body); abonament: UI sau grant admin; mesaje de blocaj pe `/marketplace`; wallet: TVA + confirmare + instructiuni.
10. `nodemailer` 7 + overrides; `MESSAGE_ENCRYPTION_KEY` obligatorie in prod; IDOR clarificari; `trust proxy` pe hop-uri + throttle register/refresh.
11. Domeniu custom + `FRONTEND_ORIGIN`/`MAIL_FROM`/cheie Maps; `trap` in `start-combined.sh` + `USER node` + `healthcheckPath`; backup automat DB; uptime monitor.
12. Smoke e2e pe prod: client (register → cerere → publish → oferta → accept → livrare → recenzie) + firma (register → aprobare → claim → oferta) + emailuri pentru fiecare pas.

**Sprint L1 — "coerenta fluxurilor" (prima saptamana dupa lansare sau inainte, daca timpul permite):** notificari tintite + emailuri (3.1), fundaturile de stare (3.3), flux client post-acceptare + contact firma + erori upload + confirmari (3.4), flux firma (3.5: isError, claimStatus, relative-time, assign la claim, stare pierdut, permisiuni oferta, locatie/onboarding, invitatii), admin (guard layout, confirmari, setari tipizate, notificari admin), 3D P1 (3.6), i18n P1 (3.7), GDPR (decizie), recenzii reale pe `/partners`.

**Sprint L2 — "curatenie si calitate":** tot §5 (cod mort, chei i18n, docs archive, repo), CI + lint backend/shared + teste de concurenta, Next 15 + dependency refresh, P2-urile din §4, sincronizare docs/03-04-07-08 + README real.

---


---

Anexele detaliate per arie (cale:linie, dovezi, tabele de rute/coduri): `docs/audit-2026-08-19/` (A0 trecere vizuala … A13 porti de calitate).
