# Aria: logica business backend

Audit READ-ONLY, 2026-08-19. Module citite integral: requests, claims (claims/clarifications/withdrawals + 3 procesoare), quotes (+2 procesoare, PDF), marketplace, billing (credits/subscriptions/payments/invoice PDF), penalties, fulfillment, chat, notifications (+emails), geo, sizing, companies, inspiration (public/boards), infra/queues, infra/event-bus, infra/mail, infra/calendar, common/settings, guards, idempotency. Referinte: docs/02, docs/03, docs/04, docs/07, docs/STATE_CONVENTIONS.md. Toate caile sunt relative la `apps/backend/src/` daca nu e specificat altfel.

## BINE FACUT

- Claim tranzactional conform invariantei 3.1: `$transaction` Serializable + `SELECT ... FOR UPDATE` pe `requests`, verificari status/sloturi/excluderi/acoperire Haversine/regula 1-claim in interiorul tranzactiei, snapshot de marime/scor/cost pe slot, SLA materializat la claim (`modules/claims/claims.service.ts:102-207`). Backstop pe indexurile partiale unice mapat la coduri de eroare (`mapUniqueViolation`, :416-438).
- Idempotency-Key pe toate POST-urile critice din 3.2 (claim, quotes create/revise/extra/reoffer, accept, credits/purchase, webhook), cu dedup 24h si 409 la hash diferit (`common/idempotency/idempotency.interceptor.ts`).
- Ledger de credite coerent (balance/reserved + credit_transactions pentru GRANT/RESERVE/REFUND/CONSUME) si folosit consecvent in claim, auto-cancel, withdrawals, SLA breach, accept (pierzatori), COMPLETED (castigator) — `modules/billing/credits.service.ts`. Regula PO "1 credit = 1.000 lei din bugetul minim" implementata in `packages/shared/src/request.schemas.ts:38-41` + `modules/sizing/sizing.service.ts:72`.
- Calendar de business Europe/Bucharest cu DST tratat si testat, weekend + sarbatori fixe + override din DB (`infra/calendar/business-calendar.service.ts`); SLA 3/3/5 zile lucratoare, grace 12h, expirare cerere 5 zile lucratoare, retragere oferta 1 zi lucratoare — toate prin acelasi serviciu.
- Ceasurile scurte sunt wall-clock (1h atribuire, 30 min gratie, 48h reminder admin, 12h grace) — conform D-v6-9.
- Event bus unic (3.5): emisie Socket.IO tintita pe camere `user:{id}` pentru chat/oferte/claim + enqueue in coada `notifications`; controllerele nu emit direct. Notificarile in-app se persista per destinatar; emailuri doar pentru cele 3 evenimente aprobate de PO, cu opt-out si dezabonare HMAC fara login (`modules/notifications/*`).
- Masina de stari a ofertelor: max 3 versiuni non-extra, REJECTED nu consuma slot, aceeasi modificare refuzata nu se poate relua, extensii max 2, a 4-a varianta voluntara, invitatie consultanta cu expirare 7 zile, inchei negocierea = thread read-only, dubla afisare RON/EUR cu curs din settings, matrice permisiuni campuri per rol, defalcare pe camere validata (suma = pret) — `modules/quotes/quotes.service.ts`.
- Retrageri claim (4.15) implementate cu validari automate pentru CLIENT_UNRESPONSIVE_48H (din `chat_threads.last_client_message_at`) si REQUEST_MODIFIED_POST_CLAIM (`last_edit_at > claim.created_at`), gratia de 30 min pentru voluntar (refund vs 2 puncte), CUSTOM → admin + reminder 48h (`modules/claims/withdrawals.service.ts`).
- Re-publicare dupa ratare SLA in masa cu ceas nou de 5 zile lucratoare + `request_company_exclusions` + fara consum de repost (`modules/claims/claims.helpers.ts:47-81`, `sla-breach.processor.ts:120-134`).
- Penalizari cu fereastra rolling 180 zile (expires_at per eveniment), puncte din `penalty_rules` cu fallback, prag firma din settings → SUSPENDED (`modules/penalties/penalties.service.ts`).
- Facturare: numerotare SERIE-NUMAR per serie, TVA snapshot din settings, seller snapshot pe comanda, PDF generat cu Chromium de sistem (Dockerfile.app:41-46), webhook HMAC cu `timingSafeEqual` + Idempotency-Key (`modules/billing/payments.controller.ts:98-131`).
- Marketplace: filtrare in SQL (status claimabil, gating per plan, Haversine <= coverage_radius_km pe cel putin o locatie, excluderi, sloturi < max), firma vede doar "publicata acum X" (`modules/marketplace/marketplace.service.ts:179-212`).
- Cereri: emailul contului e mereu primul canal de contact (server-side), atasamentele din answers sunt verificate ca apartin cererii si nu sunt BLOCKED, pozele de inspiratie validate ca publicate, titlu auto-generat, versiuni snapshot la publish/edit (`modules/requests/requests.service.ts:238-244, 747-790`).
- Chat: autorizare pe participant pentru ambele tipuri de thread (CLAIM/TEAM), criptare at-rest AES-256-GCM cu dual-read, unread intr-o singura interogare, thread read-only la acceptare pentru firmele nealese.
- Zero `console.log`, zero `any`, zero TODO/FIXME in `apps/backend/src` (grep 2026-08-19).

## DE MODIFICAT

### P0 — blocante pentru lansare cu bani/utilizatori reali

- `[P0] modules/billing/payments.service.ts:233-287 + payments.controller.ts:98-131` — plata e MOCK: comanda ramane PENDING pana la `POST /admin/payments/:id/confirm` (buton admin) sau webhook HMAC pe care nu-l apeleaza niciun PSP (nu exista integrare Stripe/Netopia/etc.). La lansare firmele nu pot plati online → DECIZIE NECESARA (PSP sau flux "transfer bancar + confirmare admin" asumat explicit).
- `[P0] modules/billing/payments.controller.ts:64-69` — `POST /billing/subscription/purchase` exista in backend dar NU este apelat nicaieri din frontend (grep `subscription/purchase` in `apps/frontend/src` → 0 apeluri in hooks). Adminul nu are nici el ruta de creare/prelungire abonament (`modules/admin/admin.controller.ts` nu are nimic pe subscriptions/credits). Dupa trialul de 30 zile (`subscriptions.service.ts:204-216`) `SubscriptionActiveGuard` blocheaza marketplace + claim → firmele raman fara cale de continuare. → UI de cumparare/renew abonament + ruta admin de grant.
- `[P0] apps/backend/prisma/seed.ts:151-156` — datele de furnizor pe factura sunt placeholder ("Marketplace Mobilier SRL", CUI RO12345678, "Str. Exemplu nr. 1", IBAN RO49AAAA1B31007593840000); `payments.service.ts:244-251` le snapshot-uieste pe fiecare factura emisa. Facturile emise la lansare ar fi invalide fiscal. → set real in `system_settings` (seller_*) inainte de prima confirmare; brandul e "Cozy Home" nu "Marketplace Mobilier".
- `[P0] infra/mail/mail.service.ts + docs/08-deployment.md:49-51,67-68` — in prod SMTP-ul e Mailpit (sink): niciun email (verificare cont, oferta noua, mesaj nou, cerere preluata) nu ajunge la utilizatori reali. Codul suporta SMTP autentificat (`config.schema.ts:22-31`). → SMTP real + SPF/DKIM pentru `MAIL_FROM`.

### P1 — bug-uri de business / fundaturi / securitate

- `[P1] modules/requests/requests.service.ts:524-543 + modules/marketplace/marketplace.service.ts:179-212 + modules/claims/claims.service.ts:107-109` — stergerea cererii de catre client seteaza DOAR `deleted_at` (statusul ramane IN_MARKETPLACE/CLAIMED_*). Query-ul marketplace (raw SQL) si lock-ul de claim nu filtreaza `deleted_at IS NULL` si nu exista middleware Prisma de soft-delete (`infra/prisma/prisma.service.ts` e gol, contrar 3.12). Rezultat: o cerere stearsa ramane vizibila si claimabila de firme. → `AND r.deleted_at IS NULL` in ambele query-uri (sau status terminal la delete).
- `[P1] modules/quotes/quotes.service.ts:550-603 (acceptQuote) + :96-161 (createQuote)` — acceptarea nu verifica statusul cererii si nu ia lock; createQuote verifica doar `slot.status === 'ACTIVE'`, nu statusul cererii. Scenarii reale: (a) dupa ACCEPTED, o a treia firma cu claim ACTIVE (fara oferta) poate trimite oferta (SENT) si clientul o poate accepta → doua oferte ACCEPTED pe aceeasi cerere; (b) doua accept-uri concurente pe oferte diferite → ambele trec. → in tranzactie: `FOR UPDATE` pe request, refuz daca `request.status ∉ {OFFERS_RECEIVED, NEGOTIATION}`; createQuote refuza daca request ∉ {CLAIMED_*, OFFERS_RECEIVED, NEGOTIATION}.
- `[P1] modules/quotes/quotes.service.ts:572-583 + modules/claims/sla-breach.processor.ts:96-118` — la acceptare se inchid doar ofertele celorlalti; claim-urile ACTIVE fara oferta raman ACTIVE, chatul lor ramane deschis (contrar 4.14 "read-only IMEDIAT"), iar jobul de SLA le marcheaza ulterior SLA_EXPIRED + 3 puncte penalizare + consum credite desi cererea era deja atribuita. → la accept: toate sloturile ACTIVE/OFFER_SENT nealese → status terminal (ex. SUPERSEDED/CANCELLED) + thread read-only; SLA processor verifica si statusul cererii.
- `[P1] modules/claims/withdrawals.service.ts:50,109-134,228-253` — retragerea unui claim OFFER_SENT (auto-aprobat sau admin) nu atinge oferta: `quotes.status` ramane SENT, clientul o vede si o poate accepta (`acceptQuote` verifica doar `quote.status`). → la retragere: quote → WITHDRAWN/SUPERSEDED + thread read-only.
- `[P1] modules/claims/withdrawals.service.ts:106` — CLIENT_CONTACT_INVALID si CLIENT_REQUESTED_CANCELLATION sunt "mock auto-aprobate" fara nicio validare (docs 4.15 cer bounce/dovada, respectiv confirmare client in chat). Orice firma poate ocoli regula "voluntar fara refund" alegand unul din aceste motive → refund integral, 0 penalizare. → DECIZIE NECESARA (macar PENDING_ADMIN_REVIEW pentru ele).
- `[P1] modules/claims/lifecycle.controller.ts:40-43 + clarifications.service.ts:210-216` — `GET /claims/:id/clarifications` nu verifica apartenenta claim-ului la firma (spre deosebire de `listWithdrawals`): orice firma APPROVED citeste intrebarile/raspunsurile (continut client) de pe claim-urile altor firme (IDOR). → `slot.companyId === ctx.companyId`.
- `[P1] modules/claims/clarifications.service.ts:157-171 + sla-breach.processor.ts:99` — clarificarea pune `sla_paused_at` si processorul returneaza `null` cat timp e pauza; daca clientul nu raspunde niciodata, claim-ul nu expira niciodata si slotul ramane ocupat pe termen nelimitat (fundatura). In plus nu se publica niciun eveniment/notificare catre client la cererea de clarificare (clientul afla doar daca deschide pagina). → plafon de pauza (ex. reia SLA automat dupa N zile) + notificare tintita.
- `[P1] modules/claims/claims.helpers.ts:19-39 + withdrawals.service.ts + claim-assign.processor.ts + modules/requests/request-expiration.processor.ts:26-28` — cand ultimul claim se retrage/anuleaza, cererea revine IN_MARKETPLACE cu `expires_at` vechi (posibil trecut) si fara job de expirare (jobul initial a rulat deja ca no-op cand cererea era CLAIMED_*). Doar ramura de SLA breach reseteaza ceasul. Rezultat: cereri IN_MARKETPLACE care nu expira niciodata. → `recomputeRequestStatusAfterClaimChange` sa reprogrameze expirarea cand revine IN_MARKETPLACE (sau sweep periodic).
- `[P1] modules/quotes/quote-validity.processor.ts:25-46` — la expirarea valabilitatii oferta trece EXPIRED, dar slotul ramane OFFER_SENT (ocupant), cererea ramane OFFERS_RECEIVED; daca firma nu extinde/reoferteaza, slotul e blocat la nesfarsit si clientul ramane cu o cerere fara iesire. Docs 4.12 listeaza "Oferta expirata / SLA ratat" ca abatere (3 pct) — nu se aplica nicio penalizare la expirarea ofertei. → DECIZIE NECESARA: dupa N zile de la EXPIRED fara actiune → slot eliberat (+/- penalizare) si cererea re-intra in marketplace.
- `[P1] modules/fulfillment/fulfillment.service.ts:118-145` — dupa DELIVERED_BY_COMPANY singura iesire e confirmarea clientului; daca nu confirma, cererea ramane blocata, creditele castigatorului nu se consuma niciodata (consum doar la COMPLETED, :139) si review-ul nu se poate lasa. Nu exista "nu am primit" / auto-confirm. → DECIZIE NECESARA (auto-COMPLETED dupa N zile calendaristice + notificare).
- `[P1] modules/penalties/penalties.service.ts:70-85 + common/guards/company-approved.guard.ts:42-47` — la prag firma devine SUSPENDED cu `suspended_until`, dar nimic nu o readuce la APPROVED dupa cele 6 luni (niciun job, guard-ul nu compara `suspended_until < now()`, adminul nu are ruta de unsuspend in `admin.controller.ts`). → guard: daca SUSPENDED si `suspended_until < now()` → trateaza ca APPROVED (sau job de ridicare).
- `[P1] modules/requests/requests.controller.ts:80-83 + apps/frontend/src/app/[locale]/requests/[id]/page.tsx:22-25,148` — repost-ul exista doar pe ruta cu token (`POST /requests/drafts/:token/repost`) si FE-ul il arata doar daca tokenul e in localStorage-ul acelui browser; proprietarul autentificat de pe alt device nu poate reposta (4.4 "repost manual de catre client"). → `POST /requests/:id/repost` pe ownership, ca la `/:id/edit`.
- `[P1] modules/requests/request-expiration.processor.ts` — reminderul catre client la 3 zile lucratoare (4.4) nu exista (coada are doar jobul `expire`; grep "reminder" in modules/requests → 0).
- `[P1] modules/notifications/notifications.processor.ts:25` — evenimentele fara `__targets` (broadcast) NU se persista si nu trimit email. Sunt broadcast deci invizibile ca notificari: `request.status_changed` (expirare cerere, editare post-claim, livrare, dispute, re-publicare), `claim.withdrawn` (auto-cancel 1h, SLA breach, retragere), `withdrawal.reminder` (admin). Lipsesc astfel notificarile cerute explicit de docs: 4.3 firma notificata la edit post-claim, 4.9 firma la auto-cancel, 4.11 clientul la re-publicare + firma la ratare SLA, 4.15 reminder admin 48h, 4.4 expirare. → publish tintit (ca la `claim.created`) pentru fiecare din ele.
- `[P1] modules/notifications/notification-emails.service.ts:141,152` — "Atelierul <firma> ti-a trimis o oferta" / "Atelierul ... a preluat cererea" — PO cere "firma" (regula permanenta). Plus `:129-131,141-171` — `requestTitle`/`companyName`/`user.name` se interpoleaza in HTML fara escape (titlul cererii e input de utilizator) → injectie HTML in email.
- `[P1] modules/geo/geo.service.ts:140-191 + config/config.schema.ts:43-51` — geocodarea Nominatim public ruleaza inline la publish/edit, fara coada dedicata de 1 req/s (3.8) — doar `sleep(1100)` intre treptele de fallback ale ACELEIASI cereri; publish-uri concurente incalca politica Nominatim (risc de 429/ban → GEOCODING_FAILED pentru toti). User-agent-ul implicit are contact placeholder `dev@marketplace.local` (docs/08 nu seteaza `NOMINATIM_USER_AGENT`). → coada BullMQ cu concurrency 1 + limiter, UA cu contact real (sau self-host).
- `[P1] infra/queues (global)` — toate termenele (expirare cerere, atribuire 1h, SLA + grace, valabilitate oferta, invitatie, reminder admin) traiesc EXCLUSIV ca delayed jobs in Redis; nu exista niciun job repetabil/cron de reconciliere (grep `repeat|cron` → 0). Daca Redis pierde datele (restart fara persistenta, flush, migrare), nicio cerere nu mai expira si niciun SLA nu se mai aplica, fara alarma. → sweep periodic (ex. la 10 min) pe `expires_at/sla_deadline_at/valid_until < now()`.

### P2 — calitate / consistenta / deviatii minore

- `[P2] modules/claims/claims.service.ts:102-207,258-260 + common/filters/all-exceptions.filter.ts:233` — sub Serializable, al doilea claim concurent pe aceeasi cerere primeste de la Postgres 40001 (Prisma P2034) dupa ce se deblocheaza `FOR UPDATE`; nu e retry-uit si nici mapat → 500 INTERNAL_ERROR in loc de 409 CLAIM_SLOTS_FULL. → retry 1-2x pe P2034 sau mapare la 409.
- `[P2] modules/claims/withdrawals.service.ts:114-131,141-167,228-253; claim-assign.processor.ts:30-48; sla-breach.processor.ts:96-124; quotes.service.ts:453-463` — operatiile care schimba numarul de sloturi active NU folosesc lock-ul `FOR UPDATE` pe request (invarianta 3.1 ultimul paragraf); `recomputeRequestStatusAfterClaimChange` poate citi un count stale in concurenta cu un claim nou.
- `[P2] modules/requests/requests.service.ts:287-291; claims.service.ts:211-255; quotes.service.ts:158-159` — enqueue-urile/publish-urile ruleaza dupa commit fara try/catch: daca Redis e picat, clientul primeste 500 desi operatia s-a facut (claim/publish reusit, job neprogramat). → izoleaza side-effects (log + job de reconciliere).
- `[P2] modules/claims/claims.constants.ts:15 (ASSIGN_WARNING_MS) + infra/event-bus/event-bus.service.ts:15 ('sla.expiring_soon')` — warning-ul la +30 min pentru atribuire (4.9/D2) si evenimentul `sla.expiring_soon` (3.5 "evenimente minime") nu sunt implementate: constanta si tipul exista, nimeni nu le foloseste.
- `[P2] modules/penalties/penalties.service.ts:14-18 + sla-breach.processor.ts:115-118` — `MASS_SLA_MISS` nu e aplicat niciodata (ratarea in masa foloseste tot `SLA_MISS`); valorile coincid (3), dar regula din `penalty_rules` e moarta.
- `[P2] modules/billing/payments.service.ts:253-259` — numarul de factura = `MAX+1` in tranzactie fara lock/secventa dedicata (docs 4.17 cere "secventa dedicata per serie"); doua confirmari simultane → P2002 → 500 (nemapat).
- `[P2] modules/billing/payments.service.ts:275-278` — abonamentul cumparat porneste de la `now()` pentru 30 zile, nu de la `expires_at` al celui activ (renew pierde zilele ramase; `getActive` ia pe cel cu expirarea cea mai tarzie).
- `[P2] modules/billing (global)` — regula 4.16 "creditele raman valabile 3 luni dupa expirarea abonamentului" nu e implementata (nicio expirare a creditelor); `subscriptions.status` nu trece niciodata EXPIRED (se filtreaza doar pe `expires_at`).
- `[P2] modules/companies/companies.service.ts:188 vs modules/billing/credits.service.ts:160` — dashboardul firmei calculeaza `available = balance - reserved`, iar wallet-ul `available = balance` (balance deja exclude rezervarile) → dashboardul subraporteaza creditele disponibile.
- `[P2] modules/companies/companies.service.ts:49-55,546,568,589` — risk flags: `reviewCount` e mereu 0 ("Reviews nu exista inca") desi tabelul `reviews` e populat de fulfillment → INSUFFICIENT_REVIEWS permanent, RATING_LOW niciodata; `listPartners` rating `null` (:106).
- `[P2] modules/companies/companies.service.ts:235-246,349-377` — lat/lng pentru firma/locatii vin din client (nu se geocodeaza server-side la scriere cum cere 3.8); o firma isi poate pune locatia oriunde si acopera orice cerere.
- `[P2] modules/sizing/sizing.service.ts:72 + modules/admin/admin.service.ts:195-205` — `project_size_thresholds.claim_cost_credits` e editabil din admin dar ignorat complet (costul = `creditCostFromBaseScore`): configuratie moarta si inselatoare pentru admin.
- `[P2] modules/marketplace/marketplace.service.ts:167` — `maxClaims: 3` hardcodat in DTO, desi query-ul foloseste `max_claims_per_request` din settings (:78).
- `[P2] modules/quotes/dto/quote.dto.ts:73-75` — `validityDays` max 365 hardcodat; docs 4.13 "in limitele permise de Admin" — nu exista setting.
- `[P2] modules/quotes/quote-pdf.service.ts:117-173` — PDF-ul ofertei e doar RO (4.20 cere limba per `users.language_preference`), afiseaza statusul ca enum brut (`SENT`, :135) si are footer "Document generat automat (mock MVP)" (:171); `modules/billing/invoice-pdf.service.ts:210` "Document mock (MVP)".
- `[P2] modules/quotes/quotes.service.ts:745-766,1050-1108` — N+1: `listQuotesForCompany/Client` → `getQuoteDto` per oferta → `loadQuoteFull` + `listForEntity` (presigned URL) per versiune; `modules/chat/chat.service.ts:207-219,328-351` — `listMessages` fara paginare (STATE_CONVENTIONS ex. 4 cere infinite query) + `listForEntity` per mesaj.
- `[P2] modules/chat/chat.service.ts:223-236` — threadul ramane scriibil dupa retragerea/anularea/expirarea claim-ului (read-only se seteaza doar la accept/end-negotiation); firma retrasa poate continua sa scrie clientului; threadurile cererilor sterse raman listate.
- `[P2] modules/requests/requests.controller.ts:39-44` — `POST /requests/drafts` e public si fara `@Throttle` dedicat (doar 100/min global per IP) → se pot genera drafturi la nesfarsit in DB.
- `[P2] modules/inspiration/inspiration.controller.ts:107-145` — `@Audit(...)` pe rutele admin de inspiratie FARA `@UseInterceptors(AuditInterceptor)` (AuditModule nu il inregistreaza global; `admin.controller.ts:31` il pune explicit) → auditul acestor actiuni nu se scrie. In plus niciun `@Audit` pe claim/accept/withdraw/deliver (doar actiuni admin + payment confirm).
- `[P2] infra/calendar/business-calendar.service.ts:10-21 + prisma/seed.ts:126-139` — `FIXED_HOLIDAYS` nu contine 6 si 7 ianuarie (zile libere legale in RO din 2024); seed-ul de sarbatori mobile are doar "a doua zi de Paste"/Rusalii, fara Vinerea Mare (libera legal din 2018) → SLA/expirari calculate gresit in jurul acestor zile. Adminul nu are ruta pentru `business_calendar_holidays` ("override admin" din 3.3).
- `[P2] modules/quotes/quotes.service.ts:436-466 (withdrawQuote)` — slotul revine ACTIVE cu `sla_deadline_at` neschimbat; daca jobul de breach a rulat deja (no-op pe OFFER_SENT), claim-ul ACTIVE nu mai are niciun job de SLA.
- `[P2] modules/requests/requests.service.ts:359-363` — editarea post-claim publica doar broadcast `request.status_changed` (vezi P1 notificari) si nu emite nimic tintit firmelor afectate.
- `[P2] docs 4.2 vs modules/quotes/quotes.service.ts:660-661,711-720 + prisma (request_contact_preferences = channel/value)` — cele 5 optiuni de partajare a contactului (D-v6-1) nu exista: toate contactele se arata oricarei firme cu slot ocupant imediat dupa claim (echivalent optiunea 5). docs/04 mentioneaza doar eliminarea `priority` la overhaul-ul 2026-07; nu am gasit decizie care sa anuleze 4.2 → de confirmat cu PO.

## DE STERS

- `modules/notifications/notifications.service.ts:97-101` — `assertOwner()` nu e apelat nicaieri (grep → doar definitia).
- `modules/claims/claims.constants.ts:15` — `ASSIGN_WARNING_MS` neutilizat (vezi P2).
- `infra/event-bus/event-bus.service.ts:15` — tipul `'sla.expiring_soon'` nu e publicat de nimeni (grep in backend+frontend → doar definitia); fie se implementeaza, fie se scoate.
- `modules/penalties/penalties.service.ts:16` — fallback `MASS_SLA_MISS` (si regula din seed) neaplicat nicaieri.
- `modules/quotes/quotes.controller.ts:71-74 (GET /quotes/:id) si :195-198 (GET /client/quotes/:id)` — niciun apel din FE (grep `api<QuoteDto>(\`/quotes/${` si `/client/quotes/${...}\`` → 0; FE foloseste `/quotes/mine`, `/quotes/by-claim/:id`, `/client/quotes/request/:id`).
- `modules/quotes/quotes.controller.ts:157-175 (POST /quotes/claims/:claimSlotId/attachments + /confirm)` — niciun apel din FE (grep `quotes/claims` → 0); `attachmentIds` apare in FE doar in `chat-panel.tsx`. Atasamentele pe oferta (3.4 "5 fisiere/oferta") nu au UI → fie UI, fie rute interne nefolosite.
- `modules/billing/payments.controller.ts:98-131 (POST /webhooks/payment)` — fara apelant (nu exista PSP); de pastrat doar daca se integreaza un PSP (vezi P0).
- `modules/admin/admin.service.ts:195-205` — campul `creditCost` pe thresholds (config moarta, vezi P2) — de scos din UI admin sau de refolosit.
- `common/company-context/company-context.ts:10` — `subscriptionId` e setat de `SubscriptionActiveGuard` (:35) dar nu e citit nicaieri.

## INTREBARI PENTRU PO / DECIZIE NECESARA

1. Plata la lansare: integram un PSP (care?) sau lansam cu "transfer bancar + confirmare admin" (fluxul actual)? Daca mock, facturile trebuie emise la confirmare cu date fiscale reale (seller_* in settings) si textul "Document mock (MVP)" scos.
2. Abonamente dupa trial: cine si cum prelungeste (UI firma cu plata / ruta admin)? Azi nu exista nicio cale.
3. Motivele de retragere CLIENT_CONTACT_INVALID / CLIENT_REQUESTED_CANCELLATION: auto-aprobate fara dovada (ca acum) sau trec la admin pana avem bounce-log/confirmare in chat?
4. Oferta expirata fara reofertare: dupa cate zile eliberam slotul si re-publicam cererea? Se aplica cele 3 puncte din tabelul 4.12 ("Oferta expirata") sau doar la SLA ratat?
5. Livrare neconfirmata de client: auto-COMPLETED dupa N zile (si consum credite castigator) sau ramane manual/admin?
6. Clarificare fara raspuns de la client: SLA-ul sta pe pauza la nesfarsit sau se reia automat dupa N zile lucratoare?
7. Ridicarea suspendarii la 6 luni: automat (guard/job) sau manual de admin (nu exista ruta)?
8. Partajarea contactului (docs 4.2, 5 optiuni): confirmati ca a fost abandonata in favoarea "contact complet la claim" (comportamentul actual)?
9. Emailuri suplimentare: dorim email la oferta acceptata (firma castigatoare), claim anulat/expirat, cerere expirata/reminder 3 zile, clarificare noua? Azi doar 3 tipuri.
10. Nominatim: ramanem pe instanta publica (cu coada 1 req/s + UA cu contact real) sau self-host / Google la lansare?
11. Geocodarea locatiilor firmei: ramane pe coordonate din client (Places UI-only, conform memoriei PO) sau verificam server-side?
12. Sarbatori legale: confirmati adaugarea 6-7 ianuarie si Vinerea Mare in calendar si cine administreaza `business_calendar_holidays` (nu exista UI admin).

## ANEXA: tabel rute (modul, metoda, path, apelata din FE: da/nu + fisierul)

Prefix global `/api/v1`. "FE" = fisier din `apps/frontend/src/` care apeleaza ruta.

| Modul | Metoda | Path | FE |
|---|---|---|---|
| requests | POST | /requests/estimate | da — hooks/use-requests.ts |
| requests | POST | /requests/drafts | da — hooks/use-requests.ts |
| requests | GET | /requests/drafts/:token | da — hooks/use-requests.ts |
| requests | PATCH | /requests/drafts/:token | da — hooks/use-requests.ts |
| requests | DELETE | /requests/drafts/:token | da — hooks/use-requests.ts:73 |
| requests | POST | /requests/drafts/:token/publish | da — hooks/use-requests.ts |
| requests | POST | /requests/drafts/:token/edit | da — hooks/use-requests.ts |
| requests | POST | /requests/drafts/:token/repost | da — hooks/use-requests.ts:116 (doar cu token in localStorage) |
| requests | POST | /requests/drafts/:token/attachments | da — hooks/use-requests.ts:30 |
| requests | POST | /requests/drafts/:token/attachments/:attachmentId/confirm | da — hooks/use-requests.ts:146 |
| requests | DELETE | /requests/drafts/:token/attachments/:attachmentId | da — hooks/use-requests.ts:156 |
| requests | GET | /requests | da — hooks/use-requests.ts |
| requests | GET | /requests/dashboard-stats | da — hooks/use-requests.ts |
| requests | GET | /requests/:id | da — hooks/use-requests.ts |
| requests | POST | /requests/:id/edit | da — hooks/use-requests.ts |
| requests | POST | /requests/:id/attachments (+/:attachmentId/confirm, DELETE) | da — hooks/use-requests.ts:30,146,156 |
| requests | DELETE | /requests/:id | da — hooks/use-requests.ts:205 |
| fulfillment | POST | /company/requests/:id/deliver | da — hooks/use-fulfillment.ts |
| fulfillment | POST | /requests/:id/confirm-delivery | da — hooks/use-fulfillment.ts |
| fulfillment | POST/GET | /requests/:id/review | da — hooks/use-fulfillment.ts:36,46 |
| fulfillment | GET | /admin/disputes | da — hooks/use-fulfillment.ts:55 |
| fulfillment | POST | /admin/disputes/:id/resolve | da — hooks/use-fulfillment.ts:64 |
| marketplace | GET | /marketplace/requests | da — hooks/use-marketplace.ts |
| marketplace | GET | /marketplace/requests/:id | da — hooks/use-marketplace.ts |
| claims | POST | /claims | da — hooks/use-marketplace.ts |
| claims | GET | /claims/mine | da — hooks/use-marketplace.ts:73 |
| claims | POST | /claims/:id/assign | da — hooks/use-marketplace.ts |
| claims | POST/GET | /claims/:id/clarifications | da — hooks/use-claims-lifecycle.ts:26,45 |
| claims | POST | /claims/:id/withdraw | da — hooks/use-claims-lifecycle.ts |
| claims | GET | /claims/:id/withdrawals | da — hooks/use-claims-lifecycle.ts:69 |
| claims | GET | /client/clarifications/request/:requestId | da — hooks/use-claims-lifecycle.ts |
| claims | POST | /client/clarifications/:id/answer | da — hooks/use-claims-lifecycle.ts |
| claims | GET | /admin/withdrawals | da — hooks/use-claims-lifecycle.ts:91 |
| claims | POST | /admin/withdrawals/:id/review | da — hooks/use-claims-lifecycle.ts:100 |
| quotes | POST | /quotes | da — hooks/use-quotes.ts:48 |
| quotes | GET | /quotes/mine | da — hooks/use-quotes.ts:30 |
| quotes | GET | /quotes/by-claim/:claimSlotId | da — hooks/use-quotes.ts:38 |
| quotes | GET | /quotes/:id | NU |
| quotes | GET | /quotes/:id/pdf | da — (link direct `${API}/quotes/${quote.id}/pdf`) |
| quotes | POST | /quotes/:id/revise | da — hooks/use-quotes.ts:57 |
| quotes | POST | /quotes/:id/extra | da — hooks/use-quotes.ts:70 |
| quotes | POST | /quotes/:id/reoffer | da — hooks/use-quotes.ts:92 |
| quotes | POST | /quotes/:id/extend-validity | da — hooks/use-quotes.ts:105 |
| quotes | POST | /quotes/:id/withdraw | da — hooks/use-quotes.ts:116 |
| quotes | POST | /quotes/:id/end-negotiation | da — hooks/use-quotes.ts:124 |
| quotes | POST | /quotes/:id/changes/:changeId/reject | da — hooks/use-quotes.ts:83 |
| quotes | POST | /quotes/:id/consultation-invites | da — hooks/use-quotes.ts:133 |
| quotes | POST | /quotes/claims/:claimSlotId/attachments | NU |
| quotes | POST | /quotes/claims/:claimSlotId/attachments/:attachmentId/confirm | NU |
| quotes | GET | /client/quotes/request/:requestId | da — hooks/use-quotes.ts |
| quotes | GET | /client/quotes/:id | NU |
| quotes | GET | /client/quotes/:id/pdf | da — (link direct `${API}/client/quotes/${quote.id}/pdf`) |
| quotes | POST | /client/quotes/changes | da — hooks/use-quotes.ts |
| quotes | POST | /client/quotes/:id/accept | da — hooks/use-quotes.ts:164 |
| quotes | POST | /client/quotes/consultation-invites/:inviteId/respond | da — hooks/use-quotes.ts |
| billing | GET | /billing/wallet | da — hooks/use-marketplace.ts |
| billing | GET | /billing/subscription | da — hooks/use-marketplace.ts:89 |
| billing | GET | /billing/credit-packages | da — hooks/use-billing.ts:16 |
| billing | GET | /billing/orders | da — hooks/use-billing.ts:24 |
| billing | POST | /billing/credits/purchase | da — hooks/use-billing.ts:33 |
| billing | POST | /billing/subscription/purchase | NU (vezi P0) |
| billing | GET | /billing/orders/:id/invoice | da — (link direct `${API}/billing/orders/${o.id}/invoice`) |
| billing | GET | /admin/payments | da — hooks/use-billing.ts:46 |
| billing | POST | /admin/payments/:id/confirm | da — hooks/use-billing.ts:55 |
| billing | POST | /webhooks/payment | NU (extern; niciun PSP) |
| penalties | GET | /penalties/me | da — hooks/use-penalties.ts:10 |
| chat | GET | /chat/threads, /chat/threads/:id/messages | da — hooks/use-chat.ts:25,44 |
| chat | POST | /chat/threads/:id/read, /messages, /attachments, /attachments/:attachmentId/confirm | da — hooks/use-chat.ts:56,65,83,93 |
| chat | GET | /company/chat/threads, /company/chat/team, /company/chat/threads/:id/messages | da — hooks/use-chat.ts (prefix) |
| chat | POST | /company/chat/threads/:id/read, /messages, /attachments, /attachments/:attachmentId/confirm | da — hooks/use-chat.ts (prefix) |
| notifications | GET | /notifications, /notifications/unread-count, /notifications/email-preference | da — hooks/use-notifications.ts |
| notifications | PATCH | /notifications/email-preference | da — hooks/use-notifications.ts:52 |
| notifications | POST | /notifications/unsubscribe | da — app/[locale]/unsubscribe/page.tsx |
| notifications | POST | /notifications/:id/read, /notifications/read-all | da — hooks/use-notifications.ts |
| companies | GET | /companies/partners | da — hooks/use-company.ts:36 |
| companies | POST | /companies | da — hooks/use-company.ts:63 |
| companies | GET | /companies/me, /companies/me/dashboard-stats | da — hooks/use-company.ts:26,45 |
| companies | PATCH | /companies/me | da — hooks/use-company.ts:69 |
| companies | POST/PUT/DELETE | /companies/me/locations(/:id) | da — hooks/use-company.ts:75,81,90 |
| companies | POST/PATCH/DELETE | /companies/me/members(/:id) | da — hooks/use-company.ts:96,102,111 |
| companies | POST/DELETE | /companies/me/portfolio(/:id) | da — hooks/use-company.ts:117,123 |
| companies | PUT | /companies/me/offer-permissions | da — hooks/use-company.ts:129 |
| companies | GET | /admin/companies, /admin/companies/:id | da — hooks/use-company.ts:141,150 |
| companies | POST | /admin/companies/:id/approve, /reject | da — hooks/use-company.ts:159,168 |
| inspiration | GET | /inspiration | da — hooks/use-inspiration.ts |
| inspiration | GET/POST | /inspiration/boards, /inspiration/boards/saved, /inspiration/boards/:id | da — hooks/use-inspiration-boards.ts |
| inspiration | PATCH/DELETE | /inspiration/boards/:id | da — hooks/use-inspiration-boards.ts |
| inspiration | POST/DELETE | /inspiration/boards/:id/items(/:photoId), /move | da — hooks/use-inspiration-boards.ts |
| inspiration (admin) | GET/POST/PATCH/DELETE | /admin/inspiration(/:id), /:id/image/presign, /:id/image/confirm | da — hooks/use-admin-inspiration.ts |

Apeluri FE catre rute inexistente in backend: nu am gasit (toate path-urile din `hooks/*.ts` si link-urile directe au handler).

### Anexa B — joburi BullMQ (producer → worker)

| Coada | Job | Enqueue | Worker | Observatii |
|---|---|---|---|---|
| notifications | <event name> | EventBusService.publish | NotificationsProcessor | persista doar cu `__targets` (vezi P1) |
| request-expiration | expire | RequestsService.publish/repost, SlaBreachProcessor | RequestExpirationProcessor | fara reminder 3 zile; neprogramat la revenirea IN_MARKETPLACE dupa retragere |
| claim-assign | assign-deadline | ClaimsService.create (daca neatribuit) | ClaimAssignProcessor | fara warning +30 min |
| sla-breach | breach | ClaimsService.create, ClarificationsService.request | SlaBreachProcessor | no-op cat `sla_paused_at` e setat (fundatura) |
| quote-validity | expire | QuotesService (create/revise/extra/reoffer/extend) | QuoteValidityProcessor | oferta EXPIRED, slot ramane ocupat |
| consultation-expiry | expire | QuotesService.createConsultationInvite | ConsultationExpiryProcessor | ok |
| withdrawal-reminder | remind | WithdrawalsService.handleCustom | WithdrawalReminderProcessor | publica broadcast → nu ajunge la admin |

Toate cozile sunt inregistrate in `QueuesModule` (global) si re-inregistrate in modulele care le folosesc; numele producer/worker coincid. Niciun job repetabil/cron; niciun job definit fara worker; niciun worker fara producer.
