# Aria: workflow end-to-end

Audit READ-ONLY, 2026-08-19, pe commit afa58e0 (+ modificari necomise pe review-rail). Metoda: urmarire in cod pagina FE → hook → endpoint BE → serviciu → eveniment/email → pagina urmatoare. Nu am rulat aplicatia. Cifre de inventar: 38 pagini FE (`apps/frontend/src/app/[locale]/**/page.tsx`), 18 controllere / 154 endpoint-uri BE, 7 procesoare BullMQ, 26 publicari de evenimente pe EventBus.

Legenda: IMPLEMENTAT / PARTIAL / LIPSA / FUNDATURA (utilizatorul ramane blocat) / NECLAR (se intampla in BE, UI-ul nu arata).

Observatie transversala (sta la baza multor puncte de mai jos): `EventBusService.publish()` (`apps/backend/src/infra/event-bus/event-bus.service.ts`) persista notificari si trimite emailuri DOAR cand evenimentul are `targetUserIds`. Au tinte doar `claim.created`, `quote.created/updated/accepted`, `message.created`. TOATE publicarile de `request.status_changed` si `claim.withdrawn` (14 + 4 locuri) sunt broadcast → `NotificationsProcessor` le ignora (`if (!Array.isArray(targets)) return`) → nicio notificare in clopotel si niciun email pentru: expirare cerere, livrare marcata, livrare confirmata, recenzie/disputa, rezolvare disputa, retragere claim, SLA ratat, re-publicare dupa SLA in masa, auto-anulare neatribuit 1h, stergere cerere de client, editare post-claim, reminder admin withdrawal. Emailuri exista doar pentru 3 evenimente (`notification-emails.service.ts`: `quote.created`, `claim.created`, `message.created`).

---

## HARTA FLUXURILOR

### A. CLIENT

| Pas | Status | Fisiere / observatii |
|---|---|---|
| Landing → register | IMPLEMENTAT | `[locale]/page.tsx`, `(auth)/register/page.tsx`, `POST /auth/register` (`auth.controller.ts`). Fara bifa de acceptare Termeni/Confidentialitate (paginile `/terms`, `/privacy` exista, dar nu sunt legate de inregistrare). |
| Verify email | PARTIAL / FUNDATURA | `auth.service.ts` `sendVerificationEmail` (token Redis 24h), `(auth)/verify-email/page.tsx`, `POST /auth/verify-email`. Daca nu verifica: login → 403 `EMAIL_NOT_VERIFIED`, NU poate continua. NU exista endpoint/buton de RETRIMITERE; la token expirat pagina spune "invalid sau a expirat" si nu ofera nimic. In plus `register()` face `await sendVerificationEmail()` fara try/catch: daca SMTP pica, userul e creat, inregistrarea raporteaza eroare, retry → `EMAIL_ALREADY_REGISTERED`, login → `EMAIL_NOT_VERIFIED` → cont mort. In prod SMTP-ul e Mailpit (sink intern, `docs/08-deployment.md` L49-69) → niciun utilizator real nu primeste emailul. |
| Forgot / reset password | LIPSA / FUNDATURA | Niciun endpoint (`grep forgot|reset-password` = 0 rezultate in BE/FE/shared), niciun link pe `/login`. Parola uitata = cont pierdut. Nici schimbare parola / editare profil (fara `PATCH /auth/me`). |
| Login → dashboard | IMPLEMENTAT | `(auth)/login/page.tsx`, `dashboard/page.tsx` (`ClientDashboard`: statistici, empty state "noRequests" + buton cerere noua). O singura sesiune activa (3.13) ok. |
| Cerere noua (start mode, camere, 3D/studio, uploads, review) | IMPLEMENTAT | `requests/new/page.tsx` → `components/configurator/configurator-wizard.tsx` (faze start/cart/rooms/uploads/details/review), `studio/page.tsx`, `POST /requests/drafts`, `PATCH /requests/drafts/:token`, atasamente presign/confirm. Draft anonim cu token in localStorage + dialog de reluare. |
| Publicare | IMPLEMENTAT / NECLAR | `review-step.tsx` (login-to-publish cu redirect), `POST /requests/drafts/:token/publish` (`requests.service.ts` L210-296: geocoding, scoring, expiresAt +5 zile lucratoare, job expirare, `request.status_changed` broadcast). Dupa publish → `/requests/:id`. NICIUN email/notificare de confirmare "cererea ta e publicata, urmeaza X"; pagina de detaliu nu explica pasii urmatori. |
| Asteptare (claim-uri, SLA) | PARTIAL | Clientul primeste notificare + email la `claim.created` (`claims.service.ts` L242). Pagina `/requests/[id]` NU arata cate firme au preluat, nici SLA-ul firmelor; doar butonul "viewOffers" cand statusul e de claim. Pe `/requests/[id]/offers` vede firmele (thread-uri) + stadiul. Reminder client la 3 zile lucratoare (4.4): LIPSA (nicio coada). |
| Clarificari de la firma | PARTIAL / NECLAR | `client-clarifications.tsx`, `GET/POST client/clarifications` (`lifecycle.controller.ts`). `clarifications.service.ts` NU publica niciun eveniment → clientul NU afla ca i s-a cerut o clarificare decat daca intra pe pagina de oferte. Daca nu raspunde niciodata, SLA ramane pe pauza la infinit (sla-breach face `return null` la `slaPausedAt`), iar la raspuns nu se reprogrameaza jobul → claim poate ramane ACTIVE fara SLA. |
| Oferte: vizualizare / comparare / acceptare / respingere | PARTIAL | `requests/[id]/offers/page.tsx` + `offer-card.tsx` (mode client): accept, cere modificare, raspuns invitatie consultanta, PDF, RON/EUR. NU exista vedere comparativa (tabel side-by-side), NU exista "respinge oferta" (doar ignorare). Clientul NU vede nimic despre firma in afara de nume (fara profil/portofoliu/rating/locatie) — compara orb. `acceptQuote` (`quotes.service.ts` L550-603): celelalte oferte SENT/EXPIRED → SUPERSEDED, chat read-only, credite consumate (pay-to-play). |
| Dupa acceptare (contact, chat, contract, plata) | PARTIAL / NECLAR | Statusul cererii → ACCEPTED; chat-ul cu castigatoarea ramane activ. Clientul NU primeste datele de contact ale firmei (telefon/email/adresa nu exista in niciun DTO client — doar `companyName`). Niciun ecran "ce urmeaza": contract, avans, masuratori, plata. Termenii (`ro.json` L4097) spun ca contractul se incheie direct intre client si firma, dar UI-ul nu o spune nicaieri in flux. Optiunile 4.2 de partajare contact (5 variante) NU exista in model (`RequestContactPreference` = lista de canale; decizie PO r5/r6 — de confirmat ca e acceptata). |
| Fulfillment (stari, confirmare livrare) | PARTIAL | `client-fulfillment.tsx`: la DELIVERED_BY_COMPANY apare "confirma livrarea" → `POST /requests/:id/confirm-delivery` → COMPLETED + consum credite castigator (`fulfillment.service.ts`). In ACCEPTED clientul nu vede nimic (componenta returneaza null). Daca firma marcheaza "livrat" fara sa livreze, clientul are DOAR "confirma" — nu poate contesta/respinge livrarea → FUNDATURA pentru cazul de litigiu pre-livrare. `IN_EXECUTION` nu e setat niciodata (stare moarta). Clientul NU e notificat la DELIVERED_BY_COMPANY (broadcast). |
| Recenzie | IMPLEMENTAT | Dupa COMPLETED, `POST /requests/:id/review`; <3 stele → `ReviewDispute` OPEN + cerere DISPUTED. |
| Dispute | PARTIAL / NECLAR | Singura cale = recenzie sub 3 stele. Nu exista "deschide disputa" independent (ex. inainte de livrare). Clientul nu e notificat la rezolvare; firma nu e notificata nici la deschidere nici la decizie; rezolvarea (RESOLVED/DISMISSED) nu schimba nimic vizibil (recenzia ramane, ratingul nu e publicat nicaieri). Adminul NU are acces la chat in disputa (4.19) — niciun endpoint admin pe chat. |
| Anulare / expirare cerere | PARTIAL | Stergere: `DELETE /requests/:id` (`deleteForClient`: soft delete, claim-uri → CANCELLED_BY_CLIENT, refund firme) ✓. Expirare: worker `request-expiration.processor.ts` → EXPIRED, client NU notificat. Repost: `POST /requests/drafts/:token/repost` — butonul apare DOAR daca tokenul e in localStorage (`requests/[id]/page.tsx` L22-25, L148); de pe alt device / storage curatat clientul NU poate reposta → FUNDATURA partiala. Cerere revenita IN_MARKETPLACE dupa retrageri (`recomputeRequestStatusAfterClaimChange`) NU primeste job de expirare nou → poate ramane in piata la infinit. Cerere cu oferte pe care clientul nu decide niciodata: fara timeout; creditele firmelor raman REZERVATE pe termen nelimitat. |
| Notificari (clopotel + email) | PARTIAL | `notification-bell.tsx`, `GET /notifications`, preferinta email (checkbox in clopotel), `/unsubscribe` HMAC ✓. Persistate doar 5 tipuri (vezi observatia transversala). Deep-link generic (`/requests/:id/offers`). |
| Stergere cont / GDPR | LIPSA | Niciun endpoint de stergere/anonimizare cont, niciun `UserAnonymizationService` (grep = 0), nicio pagina de profil/setari. Politica de confidentialitate promite drepturi pe care produsul nu le poate onora din UI. |

### B. FIRMA

| Pas | Status | Fisiere / observatii |
|---|---|---|
| Landing → register ca firma | IMPLEMENTAT | CTA `/register?role=company` pe landing (`page.tsx` L152/234) → radio COMPANY_USER. `/partners` este lista publica de firme pentru clienti (cu rating MOCK din `lib/mock-partner-meta.ts` — vezi DE MODIFICAT), nu o pagina de recrutare. |
| Onboarding firma (date, acte) | PARTIAL | `company/page.tsx` `OnboardingForm` → `POST /companies` (`companies.service.ts` `onboard`). Cere nume, CUI, J, adresa, judet, oras si **lat/lng numerice tastate manual** (`latHint`: "Coordonata zecimala, ex. 46.7712") — fara geocodare, fara autocomplete (clientul are Google Places, firma nu). Fara upload de acte (CUI/certificat) — doar text. Blocaj 3 luni dupa REJECTED ✓. |
| Angajat care se inregistreaza | FUNDATURA / NECLAR | Un COMPANY_USER nou care NU e owner ajunge pe `/company` si vede formularul "creeaza firma" — nu exista optiunea "astept sa fiu adaugat de firma mea". `addMember` (`companies.service.ts` L397) cere ca invitatul sa fie DEJA inregistrat ca COMPANY_USER si fara firma; NU exista invitatie pe email. Risc: angajatul isi face propria firma din greseala. |
| Asteptare aprobare admin | PARTIAL | `company-dashboard.tsx` arata `pendingNotice`. `adminApprove/adminReject` NU trimit email/notificare → firma afla doar revenind pe pagina. Adminul nu e notificat in-app ca are firme PENDING (doar KPI pe `/admin`). `/marketplace` pentru firma ne-aprobata: `list.isError` nu e tratat (`marketplace/page.tsx`) → pagina goala fara mesaj. |
| Onboarding: profil, echipa, zona, credite | IMPLEMENTAT (cu lipsuri) | `company-dashboard.tsx`: profil, locatii (+raza), membri (fara invitatie), portofoliu (URL imagine, fara upload), matrice permisiuni oferta. Trial Gold 30 zile + 10 credite la approve (`subscriptions.service.ts`). |
| Marketplace (filtre, mascare) | PARTIAL | `marketplace/page.tsx`, `GET /marketplace/requests` (gating per plan, raza Haversine, excluderi ✓). FARA filtre / sortare / paginare (docs 1.5 "marketplace cu filtre"). Contact client servit doar dupa claim, pe slot ocupant ✓. |
| Claim | IMPLEMENTAT | `marketplace/[id]/page.tsx` → `POST /claims` (`claims.service.ts`: lock, max 3, rezervare credite, SLA job, assign job 1h). Un singur click, fara dialog de confirmare si fara afisarea SLA-ului inainte de claim. Warning la +30 min (4.9): `ASSIGN_WARNING_MS` definit dar nefolosit → LIPSA. Auto-cancel 1h → refund ✓ dar fara notificare catre firma. |
| Fisa de lucru | IMPLEMENTAT | `marketplace/claims/[claimSlotId]/page.tsx`: atribuire, card client cu contacte, camere + viewer 3D, fisiere, OfferBuilder, chat, `ClaimLifecyclePanel` (clarificari, retragere). |
| Oferta (trimitere, editare, retragere, expirare) | IMPLEMENTAT | `quotes.controller.ts` (create/revise/extra/reoffer/extend/withdraw/end-negotiation/reject change/consultation invite/PDF) + `quote-validity.processor.ts`, `consultation-expiry.processor.ts`. `createQuote` NU verifica statusul cererii (vezi P1). Dupa `withdrawQuote` slotul redevine ACTIVE fara reprogramarea SLA. |
| Castig / pierdere | PARTIAL / NECLAR | Castig: `quote.accepted` notificat + persistat ✓. Pierdere: oferta → SUPERSEDED, chat read-only, credite consumate (OFFER_LOST) — firma vede statusul pe card, dar NU primeste notificare dedicata "ai pierdut" (primeste `quote.accepted` generic ca participant). Firma cu claim ACTIV fara oferta in momentul acceptarii: slotul ramane ACTIV, SLA curge → la deadline `sla-breach.processor` o penalizeaza (3 puncte) si ii CONSUMA creditele desi cererea e deja ACCEPTED. |
| Fulfillment | PARTIAL | `DeliverButton` pe fisa de lucru → `POST /company/requests/:id/deliver`. Firma NU e notificata la confirmarea livrarii (broadcast). Nicio stare intermediara (IN_EXECUTION nefolosit), fara "actualizari catre client". |
| Recenzie primita | LIPSA | Niciun endpoint/UI prin care firma sa isi vada recenziile; `company.rating` mereu `null` (`companies.service.ts` L106); `computeRiskFlags(reviewCount=0)` hardcodat. Firma nu afla ca a primit recenzie/disputa. |
| Penalizari | PARTIAL | `penalties.service.ts` (SLA_MISS 3p, VOLUNTARY_WITHDRAWAL 2p, prag 12 → SUSPENDED), `GET /penalties/me` afisat pe `/marketplace/wallet`. Fara lista de evenimente in UI, fara contestatie, fara notificare la aplicare. |
| Wallet (credite, cumparare, facturi) | PARTIAL / FUNDATURA | `marketplace/wallet/page.tsx`: sold, abonament, pachete, comenzi, factura PDF ✓. Cumparare credite = comanda PENDING fara instructiuni de plata (mock: adminul confirma in `/admin/payments`); firma nu e notificata la confirmare. **Abonament**: `POST /billing/subscription/purchase` exista in BE, dar NU exista niciun buton/hook in FE (`grep usePurchaseSubscription` = 0). Dupa expirarea trialului (30 zile) `SubscriptionActiveGuard` blocheaza atat claim-ul cat si LISTAREA marketplace-ului → firma ramane fara nicio cale de reinnoire. "Withdrawals" din admin = retrageri de claim, nu retrageri de bani (nu exista payout). |
| Blocare / suspendare cont | PARTIAL | `company-approved.guard.ts` blocheaza SUSPENDED; `suspendedNotice` pe `/company`. Nu exista ridicare automata la `suspendedUntil`, nici endpoint admin de unsuspend (doar `approve` ca workaround), fara notificare la suspendare; claim-urile active ale firmei suspendate nu sunt tratate. |
| Notificari / emailuri | PARTIAL | Vezi observatia transversala; pentru firma emailul pleaca doar la mesaj nou de la client. |

### C. ADMIN

| Pas | Status | Fisiere |
|---|---|---|
| Aprobare firme | IMPLEMENTAT | `admin/companies/*`, `admin-companies.controller.ts` (list/get/approve/reject + risk flags). Fara notificare catre firma. |
| Dispute | PARTIAL | `admin/disputes/page.tsx`, `GET/POST admin/disputes` — decizie RESOLVED/DISMISSED cu nota; fara acces la chat, fara notificari, fara efect asupra recenziei. |
| Retrageri claim CUSTOM | IMPLEMENTAT | `admin/withdrawals/page.tsx`, `withdrawals.service.ts adminReview`, reminder 48h (broadcast → adminul nu il vede in-app). |
| Plati mock | IMPLEMENTAT | `admin/payments/page.tsx`, `POST admin/payments/:id/confirm`, webhook HMAC. |
| Setari | IMPLEMENTAT | `admin/settings/page.tsx`: system_settings, penalty_rules, planuri, pachete, praguri. |
| Inspiratie, audit, jobs | IMPLEMENTAT | `admin/inspiration`, `admin/audit`, `admin/jobs` (+retry). |
| Cereri / claim-uri / credite / abonamente / penalizari / useri | LIPSA | 4.19 cere gestionare cereri, claim-uri, credite, abonamente, penalizari. Nu exista pagini sau endpoint-uri admin pentru: lista cereri, vizualizare claim-uri, ajustare/grant credite, activare/prelungire abonament manual, lista penalizari + anulare, unsuspend explicit, useri/clienti. |

### D. Evenimente de timp

| Eveniment | Worker | Efect | Notificare |
|---|---|---|---|
| Expirare cerere 5 zile lucr. | `request-expiration.processor.ts` ✓ | EXPIRED ✓ | broadcast → NU (client neinformat) |
| Reminder client 3 zile lucr. (4.4) | LIPSA | — | — |
| Atribuire 1h / warning 30 min | `claim-assign.processor.ts` ✓ / warning LIPSA | CANCELLED_UNASSIGNED + refund ✓ | NU |
| SLA ratat + grace 12h | `sla-breach.processor.ts` ✓ | SLA_EXPIRED, consum, 3p, republish + excluderi ✓ | NU (nici firma, nici clientul la republish) |
| Valabilitate oferta 14 zile | `quote-validity.processor.ts` ✓ | EXPIRED ✓ | `quote.updated` persistat ✓, fara email |
| Invitatie consultanta 7 zile | `consultation-expiry.processor.ts` ✓ | EXPIRED ✓ | `quote.updated` ✓ |
| Reminder admin withdrawal 48h | `withdrawal-reminder.processor.ts` ✓ | log | broadcast → NU |
| Expirare abonament / trial | fara worker (guard la citire) ✓ | blocheaza | NU (fara avertizare inainte de expirare) |
| Credite valabile 3 luni dupa abonament (4.16) | LIPSA | — | — |
| Ridicare suspendare la `suspendedUntil` | LIPSA | — | — |
| Expirare penalizari 180 zile | la citire (SUM cu expires_at) ✓ | — | — |
| Re-expirare cerere revenita IN_MARKETPLACE dupa retrageri | LIPSA (doar la mass-SLA-breach) | zombie in piata | — |
| Timeout decizie client pe oferte | LIPSA | credite rezervate nelimitat | — |

---

## BINE FACUT

- Configuratorul de cerere: draft anonim cu token + reluare, login-to-publish cu returnUrl, upload-uri per camera, Studio 3D, scoring/geocodare server-side, publicare atomica cu job de expirare.
- Claim-ul: tranzactie cu lock, max 3, rezervare credite, snapshot marime/cost, SLA materializat, excluderi la re-claim, 1-claim-fara-oferta, cap manager, auto-cancel 1h cu refund.
- Ofertare: v1→v3, extra, reofertare (extindere vs versiune noua), retragere in fereastra, end-negotiation, invitatie consultanta cu expirare, PDF, RON/EUR, matrice permisiuni campuri, preturi pe camere.
- Chat: thread auto la claim, read-only pentru pierzatori imediat la acceptare, criptare at-rest, chat echipa, atasamente cu presign/scan.
- Fulfillment happy-path: ACCEPTED → DELIVERED_BY_COMPANY → COMPLETED (+ consum credite castigator) → review → disputa automata <3 stele → decizie admin.
- Billing mock coerent: comanda → confirmare admin/webhook HMAC → factura serie+numar + TVA snapshot + credite/abonament; trial la approve.
- Retrageri claim cu motive auto/custom + reminder admin, stergere cerere de client cu refund firme.
- Emailurile existente (cerere preluata / oferta noua / mesaj nou) respecta preferinta + unsubscribe HMAC + limba userului.

---

## DE MODIFICAT

P0 (utilizator blocat sau pierde bani/date):

- `[P0] A.verify-email — in prod emailurile merg in Mailpit (sink), deci niciun utilizator real nu poate verifica contul si nu poate face login (docs/08-deployment.md L49-69, apps/backend/src/infra/mail/mail.service.ts) → SMTP real (SMTP_HOST/USER/PASS/SECURE) inainte de lansare + test e2e register→mail→verify.`
- `[P0] A.verify-email — nu exista retrimitere email de verificare; token 24h; register() arunca daca SMTP pica dupa crearea userului (apps/backend/src/modules/auth/auth.service.ts L62-78, 96-118; (auth)/verify-email/page.tsx) → endpoint POST /auth/resend-verification (rate-limited) + buton pe /login la EMAIL_NOT_VERIFIED si pe pagina verify la eroare; trimiterea emailului best-effort (try/catch + log).`
- `[P0] A.forgot-password — nu exista resetare parola (0 rezultate grep in BE/FE/shared; (auth)/login/page.tsx fara link) → POST /auth/forgot-password + POST /auth/reset-password (token hash Redis, TTL scurt) + pagini FE.`
- `[P0] B.wallet/abonament — dupa expirarea trialului firma nu are UI de cumparare abonament (BE are POST /billing/subscription/purchase, FE nu are hook/buton: apps/frontend/src/app/[locale]/marketplace/wallet/page.tsx; grep usePurchaseSubscription = 0), iar SubscriptionActiveGuard blocheaza si GET /marketplace/requests → firma platitoare potential ramane blocata definitiv → sectiune "Abonament" cu planurile + buton cumpara + mesaj clar cand SUBSCRIPTION_INACTIVE / COMPANY_NOT_APPROVED pe /marketplace (acum list.isError nu e randat).`
- `[P0] B.castig/pierdere — la acceptarea unei oferte, claim-urile ACTIVE fara oferta ale altor firme raman ACTIVE; sla-breach.processor le marcheaza SLA_EXPIRED, consuma creditele si aplica 3 puncte penalizare pentru o cerere deja ACCEPTED (apps/backend/src/modules/quotes/quotes.service.ts acceptQuote L564-584 trateaza doar quote SENT/EXPIRED; sla-breach.processor.ts L43 verifica doar claim.status) → in acceptQuote: sloturile ACTIVE ale altor firme → status terminal (ex. SUPERSEDED/CANCELLED_REQUEST_ACCEPTED) + refund (sau consum, decizie PO) + chat read-only; sla-breach sa verifice si statusul cererii.`
- `[P0] B.credite — retragere voluntara dupa gratie: "fara refund" dar nici CONSUME → creditele raman RESERVED la infinit in wallet (withdrawals.service.ts handleVoluntary L139-150 vs credits.service.ts) → apeleaza credits.consume(... 'WITHDRAWAL_VOLUNTARY_LATE').`
- `[P0] A/B.oferte — createQuote nu verifica statusul cererii; o firma cu slot ACTIV poate trimite oferta pe cerere ACCEPTED/DELIVERED, oferta devine SENT si acceptQuote (verifica doar quote.status) permite a DOUA acceptare (quotes.service.ts L96-160, L550-562) → guard pe request.status in {CLAIMED_*, OFFERS_RECEIVED, NEGOTIATION} la create/revise/accept.`
- `[P0] legal — /terms contine placeholdere "[DENUMIRE LEGALĂ FIRMĂ]", "[CUI]", "[ADRESĂ]" (apps/frontend/src/messages/ro.json L4097) si register nu cere acceptarea termenilor → completeaza datele + checkbox obligatoriu la register (stocare termsAcceptedAt).`

P1:

- `[P1] notificari — toate request.status_changed / claim.withdrawn sunt broadcast (fara tinte) → zero notificari persistate/emailuri pentru: cerere expirata, livrare marcata, livrare confirmata, recenzie/disputa, decizie disputa, retragere claim, SLA ratat, republish dupa SLA, auto-cancel 1h, stergere cerere, edit post-claim (event-bus.service.ts + notifications.processor.ts L24) → publica cu targetUserIds (client / membri firma / admini) si adauga tipuri distincte + continut email pentru: request.expired, request.delivered, request.completed, review.received, dispute.opened/resolved, claim.sla_expired, claim.cancelled, request.republished.`
- `[P1] A.repost — butonul apare doar daca tokenul e in localStorage-ul device-ului; POST /requests/drafts/:token/repost e singurul endpoint (requests/[id]/page.tsx L22-25, L148; requests.controller.ts L88) → POST /requests/:id/repost autentificat pe proprietar.`
- `[P1] A.dupa acceptare — clientul nu primeste datele de contact/profilul firmei castigatoare si nu exista ecran "pasii urmatori" (contract direct, avans, masuratori) → card firma (telefon/email/adresa/portofoliu) vizibil la ACCEPTED + text explicativ; decizie PO cand se dezvaluie contactul firmei.`
- `[P1] A.oferte — clientul compara oferte fara profil de firma (fara portofoliu/rating/locatii; doar companyName in QuoteDto/ChatThreadDto) si fara vedere comparativa → pagina publica /companies/:id (sau drawer) + tabel comparativ pret/termen/garantie/design fee.`
- `[P1] A.fulfillment — clientul nu poate contesta "livrat" (doar confirma) si nu poate deschide disputa inainte de recenzie (client-fulfillment.tsx; fulfillment.controller.ts) → buton "nu am primit / problema" care deschide disputa sau readuce in ACCEPTED cu notificare firma + admin.`
- `[P1] B.echipa — fara invitatie pe email; angajatul nou vede formularul de creare firma (company/page.tsx L35-37; companies.service.ts addMember L397-419) → invitatie pe email cu token + ecran "asteapta sa fii adaugat / accepta invitatia"; avertisment pe onboarding "daca esti angajat, nu crea firma".`
- `[P1] B.onboarding — lat/lng tastate manual, obligatorii (company/page.tsx L101-104; company.schemas.ts L29-30) → geocodare server-side din adresa (GeoService exista pentru cereri) + optional autocomplete; lat/lng optionale.`
- `[P1] B.aprobare — fara email/notificare la APPROVED/REJECTED (companies.service.ts adminApprove/adminReject) si adminul nu e anuntat de firme PENDING → evenimente company.approved/rejected cu tinta owner + email; notificare admin la onboarding nou.`
- `[P1] B.retrageri — CLIENT_CONTACT_INVALID si CLIENT_REQUESTED_CANCELLATION sunt auto-aprobate FARA nicio validare (withdrawals.service.ts L104-106 comentariu "mock") → firmele pot obtine refund oricand; cel putin: cere dovada/confirmare client in chat (quick reply), sau trece-le la PENDING_ADMIN_REVIEW pana la implementare.`
- `[P1] A/B.cereri zombie — cerere revenita IN_MARKETPLACE dupa retrageri nu primeste job nou de expirare (claims.helpers.ts recomputeRequestStatusAfterClaimChange) → reprogrameaza expirarea (ceas nou sau ramas) cand revine la 0 claim-uri; cereri cu oferte fara decizie la infinit (credite rezervate) → timeout de decizie client (ex. valid_until + N zile → EXPIRED + refund/consum conform deciziei PO).`
- `[P1] B.recenzii — firma nu isi vede recenziile/ratingul nicaieri; company.rating = null hardcodat; riscFlags cu reviewCount=0 (companies.service.ts L49-53, L106) → GET /companies/me/reviews + agregare rating + afisare pe /partners in locul valorilor MOCK.`
- `[P1] public — /partners si caruselul de pe landing afiseaza ratinguri si numar de recenzii FABRICATE deterministic (lib/mock-partner-meta.ts: 4.6–5.0, 38–218 recenzii) → la lansare: ascunde ratingul pana exista recenzii reale sau eticheteaza explicit.`
- `[P1] B.suspendare — fara ridicare automata la suspendedUntil, fara unsuspend admin explicit, fara notificare, claim-urile active raman (company-approved.guard.ts L42; penalties.service.ts L69-84) → guard sa verifice suspendedUntil < now (sau job), endpoint admin unsuspend, email la suspendare.`
- `[P1] C.admin — lipsesc gestionarea cererilor, claim-urilor, creditelor (grant/ajustare), abonamentelor, penalizarilor (lista + anulare) si a userilor (4.19) → minim: lista cereri cu status + claim-uri, grant credite manual, lista penalizari cu stergere, activare abonament manual.`
- `[P1] A.clarificari — fara notificare la cerere/raspuns; SLA pe pauza nelimitat daca clientul nu raspunde; la raspuns nu se reprogrameaza sla-breach (clarifications.service.ts) → publica claim.clarification_requested/answered cu tinte; timeout clarificare (ex. 48h) + reprogramare job la answer.`
- `[P1] A.GDPR — fara stergere/anonimizare cont, fara editare profil/parola/limba (auth.controller.ts) → DELETE /auth/me (soft delete + anonimizare PII per 4.21) + PATCH /auth/me + pagina /settings.`

P2:

- `[P2] B.claim — un click, fara confirmare si fara a arata SLA-ul (3/5 zile lucr.) si costul final inainte (marketplace/[id]/page.tsx L118-139) → dialog de confirmare cu cost, SLA, regula 1h atribuire.`
- `[P2] B.claim — warning la +30 min neimplementat (ASSIGN_WARNING_MS nefolosit, claims.constants.ts L14) si sla.expiring_soon niciodata publicat (event-bus.service.ts tip declarat) → job warning + eveniment cu tinte firma.`
- `[P2] B.marketplace — fara filtre/sortare/paginare (use-marketplace.ts, marketplace.controller.ts) → query params judet/marime/buget/sort.`
- `[P2] A.detaliu cerere — nu arata numarul de firme care au preluat / SLA-ul lor / "ce urmeaza" (requests/[id]/page.tsx) → banda de progres (publicata → X firme → oferte → acceptata → livrata) + counter claim-uri.`
- `[P2] B.wallet — comanda de credite ramane PENDING fara instructiuni de plata si fara notificare la confirmare (wallet/page.tsx L80-118; payments.service.ts confirm) → text "plata mock: adminul confirma" sau instructiuni reale + notificare billing.order_confirmed.`
- `[P2] A/B.reminders — reminder client la 3 zile lucratoare (4.4) si avertizare expirare abonament/trial lipsesc → joburi BullMQ.`
- `[P2] B.oferte — dupa withdrawQuote slotul revine ACTIVE fara reprogramarea SLA (quotes.service.ts L453-463) → recalculeaza/reprogrameaza deadline.`
- `[P2] B.fulfillment — IN_EXECUTION nu e setat niciodata; stare moarta in enum/taburi (requests/page.tsx L39) → fie seteaza la acceptare, fie elimina.`
- `[P2] A.limba — languagePreference se seteaza doar la register; comutatorul RO/EN din UI nu o actualizeaza, emailurile pot veni in alta limba → PATCH /auth/me la schimbare limba (dupa login).`
- `[P2] B.portofoliu — doar URL de imagine, fara upload (company-dashboard.tsx L350) → presign upload ca la cereri.`
- `[P2] C.admin — reminder withdrawal 48h si disputele nu ajung in clopotelul adminului (broadcast) → tinte = userii ADMIN.`

---

## DE STERS

- Stare `IN_EXECUTION` (packages/shared/src/enums.ts L80, requests.service.ts L60, requests/page.tsx L39) — niciodata setata; fie implementata, fie scoasa.
- `sla.expiring_soon` din `DomainEvent` (event-bus.service.ts) — declarat, niciodata publicat.
- `ASSIGN_WARNING_MS` (claims.constants.ts) — constanta moarta.
- `lib/mock-partner-meta.ts` (rating/recenzii fabricate) — de eliminat la lansare sau inlocuit cu date reale.
- Rutele `2fa/setup` / `2fa/verify` (auth.controller.ts) — functionale dar flag OFF in MVP; de pastrat doar daca V1 le activeaza (nu expune in UI).
- `/dev/piece-3d` si `/landing-v2` (noindex) — pagini de dezvoltare; de exclus din build-ul de productie.

---

## INTREBARI PENTRU PO / DECIZIE NECESARA

1. Plata intre client si firma: se face integral in afara platformei (Termenii spun da). Confirmati si ce text/ecran apare clientului dupa acceptare (contract, avans, masuratori) — acum nu exista nimic.
2. Cand si ce date de contact ale FIRMEI vede clientul (acum: niciodata; doar numele + chat)? Si optiunile 4.2 de partajare contact client (5 variante) — confirmati ca au fost inlocuite definitiv de "email cont mereu primul + canale alese" (PO r5/r6)?
3. Firme cu claim ACTIV (fara oferta) cand clientul accepta alta oferta: refund sau consum (pay-to-play)? Acum: raman active si ajung la penalizare SLA.
4. Timeout pentru decizia clientului cand are oferte: cat (ex. 14 zile de la ultima oferta valida)? Ce se intampla cu creditele rezervate (refund vs consum)?
5. Abonamente: ramane mock (comanda + confirmare admin) la lansare sau se integreaza gateway real? Cine confirma platile in timp util si cum afla firma?
6. Retrageri CLIENT_CONTACT_INVALID / CLIENT_REQUESTED_CANCELLATION: acceptam auto-aprobarea fara dovada la lansare?
7. Disputa: vrem "deschide disputa" independent de recenzie (inainte de livrare)? Are adminul acces la chat (4.19 spune da)? Ce efect are RESOLVED vs DISMISSED asupra recenziei/ratingului?
8. Recenzii si rating public: se afiseaza pe /partners si in comparatia de oferte? Pana atunci, eliminam ratingurile MOCK?
9. Echipa firmei: invitatie pe email (necesita flux nou) sau ramane "angajatul se inregistreaza, owner-ul il adauga dupa email"?
10. Stergere cont (GDPR): fluxul de self-service sau cerere pe email catre operator? Cine e operatorul (placeholdere in Termeni)?
11. SMTP real la lansare (furnizor, domeniu, SPF/DKIM) — cine il configureaza? Blocant pentru verificare email.
12. Lista de emailuri obligatorii la lansare (propunere minima): confirmare publicare, cerere expirata, livrare marcata/confirmata, recenzie primita, aprobare/respingere firma, suspendare, abonament expira in 3 zile, confirmare plata.
