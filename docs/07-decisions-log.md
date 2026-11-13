<!-- Product Bible Master v6 — Decisions Log — deciziile sunt FINALE. Sursa de adevar. Ierarhie la conflict: invariante (02) > decisions log (07) > reguli business (03). Nu ghici: marcheaza DECIZIE NECESARA si opreste-te. -->

# 8. Decisions Log complet

*Pentru tine peste 6 luni: de ce s-a ales fiecare lucru. Deciziile sunt FINALE.*

## 8.1 Decizii tehnice (din v4)

### 1. Concurrency pe claim

**Decizie: **SELECT FOR UPDATE pe requests în tranzacție Serializable.

**Rationale: **FOR UPDATE e suficient sub 100 RPS și ușor de debug. Advisory locks/optimistic locking adaugă complexitate fără valoare la scala MVP.

### 2. Geocoding

**Decizie: **Nominatim (OSM), write-time, cache 90 zile, Haversine în SQL.

**Rationale: **Listă fixă de localități ar limita filtrul de rază în km. Nominatim public e gratis (rate limit 1 req/s); Google Places rămâne post-MVP.

### 3. Frontend state

**Decizie: **TanStack pentru server state, Zustand doar UI; STATE_CONVENTIONS.md în Sprint 0.

**Rationale: **Duplicarea server state în două store-uri e cea mai comună sursă de bug-uri React/TS.

### 4. Employee managed

**Decizie: **Claim al firmei; claimed_by + assigned_to (nullable); regula 1-claim pe assigned_to.

**Rationale: **Entitate separată de assignment ar fi over-engineering; două coloane acoperă reasignare, recuperare, tracking.

### 5. Ofertă max 3 versiuni

**Decizie: **v1 → modif #1 → v2 → modif #2 → v3; REJECTED nu consumă slot.

**Rationale: **Interpretarea naturală a regulilor; predictibilă și ușor de UX-uit.

### 6. Holidays

**Decizie: **Hibrid: npm date-holidays (fixe) + business_calendar_holidays (Paște + override admin).

**Rationale: **Paștele Ortodox e calculat diferit și nu toate bibliotecile îl au corect.

### 7. Plată mock

**Decizie: **Admin button + webhook HMAC, ambele prin PaymentsService.confirm.

**Rationale: **Webhook + HMAC + Idempotency-Key face integrarea reală ulterioară un simplu schimb de endpoint.

### 8. Storage MinIO

**Decizie: **MinIO în Docker de la Sprint 1, @aws-sdk/client-s3, presigned URLs.

**Rationale: **Local filesystem nu permite deploy multi-user; salvează 1-2 zile de refactor în Sprint 8.

### 9. Seed scenarii numite

**Decizie: **5 clienți + 8 firme + 15 cereri, nume umane, audit preexistent.

**Rationale: **Un demo cu „Test Firma 1” nu convinge; scenariile numite permit demonstrarea fluxurilor specifice.

### 10. Idempotență

**Decizie: **Idempotency-Key pe POST critice, cache 24h.

**Rationale: **Double-submit e cea mai comună sursă de bug-uri financiare; pattern standard (Stripe/AWS).

## 8.2 Decizii business (D1–D6)

### D1. Mărime proiect

**Decizie: **Scoring configurabil; snapshot la claim; seed în Sprint 0.

**Rationale: **Permite ajustare fără deploy; snapshot-ul protejează firmele care au dat claim înainte de un edit.

**Impact: **project_sizing_config + project_size_thresholds + snapshot pe claim_slots.

### D2. Cap manager + atribuire 1h

**Decizie: **Claim-uri neatribuite ≤ angajați liberi; +1h sau auto-cancel + refund.

**Rationale: **Previne acapararea de cereri fără capacitate reală de a le onora.

**Impact: **BullMQ delayed job; warning +30 min; ASSIGNED_USER_HAS_ACTIVE_CLAIM.

### D3. Limită 3 versiuni + consultanță

**Decizie: **După v3: a 4-a voluntară / invitație la sediu / închei online.

**Rationale: **Oferă firmei ieșiri clare fără negociere infinită online.

**Impact: **physical_consultation_invites; quotes.extra_versions_count; chat_threads.negotiation_ended_by_company.

### D4. Reofertare 2 butoane

**Decizie: **A = extinde valid_until (max 2×14 zile); B = versiune nouă.

**Rationale: **Separă reînnoirea simplă de modificarea reală.

**Impact: **quote_validity_extensions.

### D5. Anulare claim

**Decizie: **Auto-aprobare pe listă cu validare; custom → admin (48h).

**Rationale: **Reduce munca adminului pentru cazuri clare, păstrând control pe cele ambigue.

**Impact: **claim_withdrawals cu reason_type + validări automate.

### D6. Clarificări v4

**Decizie: **employee_managed pe assigned_to; max 3 versiuni înlănțuite.

**Rationale: **Reiterare confirmată, fără ambiguitate.

## 8.3 Răspunsuri refinement (Î1–Î20)

### Î1. Self-assign manager

**Decizie: **A — consumă slot personal (1 claim activ fără ofertă).

**Rationale: **Regula e deja pe assigned_to; la self-assign managerul devine assigned_to, zero caz special.

**Impact: **Managerul se numără ca worker disponibil; claim self-assigned e imediat assigned.

### Î2. Gating delay

**Decizie: **A — Platinum +0 / Gold +30 / Silver +60 min, configurabil.

**Rationale: **Spread moderat; un marketplace early-stage e supply-constrained.

**Impact: **subscription_plans.marketplace_gating_delay_minutes.

_Înlocuită la 2026-11-13 de D-E1-2 (PO a1-2): fără întârziere pe plan, 0 la toate planurile._

### Î3. Transparență gating

**Decizie: **C — doar „publicată acum X”, fără mențiuni despre planuri.

**Rationale: **Onest, creează FOMO fără a frustra firmele Silver plătitoare.

_Rămasă fără obiect la 2026-11-13 prin D-E1-2 (nu mai există întârziere de explicat)._

### Î4. Ceas 180 zile

**Decizie: **A — fiecare penalty_event expiră individual la 180 zile de la applied_at.

**Rationale: **Fereastră rolling, indexabilă, fără batch de reset.

**Impact: **expires_at = applied_at + 180d; prag = SUM(points) cu expires_at > now().

### Î5. Permisiuni câmpuri ofertă

**Decizie: **C — matrice configurabilă per firmă, cu default seed.

**Rationale: **Flexibil; default sensibil (trusted tot mai puțin preț, managed read-only).

**Impact: **company_offer_field_permissions; verificare la edit ofertă.

### Î6. Audit preț

**Decizie: **A — versiune nouă + audit log standard, fără aprobare suplimentară.

**Rationale: **Prețul e deja protejat la nivel de rol prin matrice; aprobarea ar fi dublă protecție.

### Î7. Pricing planuri

**Decizie: **B — Silver 149 / Gold 399 / Platinum 899 RON (15/50/120 credite), configurabil.

**Rationale: **Per-credit descrescător = stimulent de upgrade; validare reală post-MVP.

### Î8. Top-up credite

**Decizie: **A — 10/100, 50/400, 100/700 RON (discount progresiv).

**Rationale: **Pattern SaaS; gaming exclus de SubscriptionActiveGuard (fără plan nu poți da claim).

### Î9. Trial firme

**Decizie: **A — 1 lună Gold + 10 credite la admin approve, toggleable.

**Rationale: **Onboarding ușor pentru supply; abuz limitat (doar post-approval + toggle).

### Î10. 2FA

**Decizie: **C — dezactivat în MVP, arhitectural pregătit, activat în V1.

**Rationale: **Demo MVP: 2FA obligatoriu ar face fiecare login o ceremonie TOTP.

**Impact: **users.two_factor_*; TwoFactorGuard no-op cât flag e off.

### Î11. Refresh rotation

**Decizie: **C — rotation cu grace period 30s.

**Rationale: **Consistent cu filozofia „construiește-o corect o dată”; rotation atinge core-ul auth.

**Impact: **refresh_tokens cu family_id + replaced_at; reuse după grace → revocă familia.

### Î12. Sesiuni

**Decizie: **B — o singură sesiune activă; alt device deconectat la login nou.

**Rationale: **Cel mai simplu și sigur; se coordonează cu rotation.

**Impact: **La login: revocă refresh_tokens active, emite familie nouă; socket vechi → auth_expired.

### Î13. Limbi

**Decizie: **B — RO + EN complet, switcher, emails/PDF per preferință.

**Rationale: **Acoperire bilingvă din MVP.

**Impact: **users.language_preference; ro.json + en.json.

### Î14. Factură

**Decizie: **D — structură conformă RO; seller configurabil; TVA 21% config; numerotare SERIE-NUMĂR.

**Rationale: **Seller = platforma; date fiscale configurabile pentru go-live fără deploy.

**Impact: **mock_billing_orders.invoice_series/number/vat_rate/seller_snapshot.

### Î15. Audit append-only

**Decizie: **C — hybrid: trigger DB pe audit_logs, app-level restul.

**Rationale: **Respectă invariantul v4 fără complicații de roluri PostgreSQL multiple (incomode cu Prisma).

**Impact: **Trigger BEFORE UPDATE OR DELETE ON audit_logs → RAISE EXCEPTION.

### Î16. Matrice seed

**Decizie: **A — agentul alege, totaluri 15, entitățile numite rămân obligatorii.

**Rationale: **Flexibilitate pe maparea tip↔status în limita acoperirii cerute.

### Î17. Client șterge cererea

**Decizie: **A — soft delete, claim-uri → CANCELLED_BY_CLIENT, refund automat.

**Rationale: **Clientul are dreptul să anuleze; firmele rămân întregi financiar; recuperabil/auditabil.

### Î18. Retragere claim voluntar

**Decizie: **A cu grație 30 min — apoi fără refund + slot eliberat + 2 puncte.

**Rationale: **Protejează sloturile (max 3); grația acoperă misclick/răzgândire rapidă.

**Impact: **reason_type VOLUNTARY_NO_REASON; verifică now() - created_at < 30 min.

### Î19. Chat după acceptare

**Decizie: **A — câștigătoare activ pentru execuție, nealese read-only imediat.

**Rationale: **Fluxul v4; COMPLETED se atinge prin confirmarea de livrare a clientului.

### Î20. Toate 3 ratează SLA

**Decizie: **D — revine în marketplace + client notificat + 3 puncte fiecare firmă.

**Rationale: **Echilibrat: penalizezi firmele, nu clientul; re-publicarea nu consumă repost-ul; firmele ratate excluse de la re-claim.

**Impact: **request_company_exclusions; worker la SLA breach total.

## 8.4 Decizii finale v6 (D-v6-1 … D-v6-14)

*Cele 14 decizii din ultimul refinement, confirmate de utilizator. Toate sunt integrate în Secțiunile 1–7.*

### D-v6-1. Opțiuni partajare contact

**Istoric, inlocuit la 2026-07-15:** [decizia PO r6 W1](archive/16-feedback-po-r6-sprints.md#w1--context-post-claim-complet-backend) stabileste acces la contactele furnizate doar pentru claim ocupant (`ACTIVE`, `OFFER_SENT`, `COMPLETED`), eliminat la retragere/anulare. Regula curenta este in 03, sectiunea 4.2. Textul urmator ramane doar istoricul deciziei initiale.

**Decizie: **Confirmate cele 5 opțiuni din 4.2 exact cum sunt scrise.

**Rationale: **Acoperă tot spectrul de la anonim total la partajare imediată; nu mai e [PROPUNERE].

### D-v6-2. Câmpuri formular cerere

**Decizie: **Agentul finalizează câmpurile exacte în Sprint 0, împreună cu seed-ul de scoring; utilizatorul revizuiește.

**Rationale: **Câmpurile depind direct de categoriile de scoring; o singură revizuire la Sprint 0 le aliniază pe ambele.

### D-v6-3. Lista MVP exclus

**Decizie: **Confirmată lista din 1.5 exact cum e scrisă.

**Rationale: **Nicio funcționalitate exclusă nu blochează demo-ul; toate au mock sau sunt post-MVP.

### D-v6-4. Mapare SLA

**Decizie: **SMALL = 3 zile, MEDIUM = 3 zile, LARGE = 5 zile lucrătoare.

**Rationale: **Mapare simplă, consistentă cu „3 normal / 5 mari” din v3; MEDIUM nu justifică un al treilea prag în MVP.

**Impact: **claim_slots.sla_deadline_at calculat per project_size_snapshot.

### D-v6-5. Cost claim per mărime

**Decizie: **Seed: SMALL = 1, MEDIUM = 2, LARGE = 4 credite, configurabil din Admin.

**Rationale: **Proporțional cu valoarea cererii; LARGE dublu față de MEDIUM creează economie sănătoasă de credite.

**Impact: **project_size_thresholds.claim_cost_credits.

### D-v6-6. Penalizări — praguri și angajat

**Decizie: **MVP doar cele 3 abateri definite; restul prin penalty_rules din Admin. Angajat la 9 puncte active → blocat 3 luni de la claim/atribuire. Firmă la 12 → SUSPENDED 6 luni.

**Rationale: **Pragul angajatului previne ca un singur angajat neperformant să fie rotit la infinit; pragul e sub cel al firmei, deci angajatul e oprit înainte ca firma să fie suspendată.

**Impact: **penalty_rules; system_settings; eroare ASSIGNED_USER_PENALTY_BLOCKED.

### D-v6-7. Valabilitate default ofertă

**Decizie: **valid_until = trimitere + 14 zile calendaristice (default, configurabil).

**Rationale: **Aliniat cu pasul de extensie de 14 zile din D4; suficient pentru decizia clientului fără a bloca firma.

**Impact: **quote_versions.valid_until; system_settings.quote_validity_default_days.

### D-v6-8. Expirare invitație consultanță

**Decizie: **EXPIRED dacă clientul nu răspunde în 7 zile calendaristice.

**Rationale: **Fără expirare, invitațiile ar rămâne PENDING_CLIENT la infinit și ar bloca UX-ul firmei.

**Impact: **physical_consultation_invites.expires_at; BullMQ job; consultation_invite_expiry_days=7.

### D-v6-9. Ceasuri calendaristice

**Decizie: **Toate ceasurile scurte (30 min, 1h, 12h, 48h) sunt wall-clock; doar SLA ofertă și expirare cerere folosesc zile lucrătoare.

**Rationale: **Ceasurile operaționale scurte trebuie să fie predictibile și simple; doar termenele de business justifică calendar lucrător.

**Impact: **Clarificare integrată în 3.3.

### D-v6-10. Arie de acoperire firmă

**Decizie: **coverage_radius_km pe fiecare company_location (default 50); cererea e eligibilă dacă e în raza a cel puțin unei locații.

**Rationale: **Per-locație (nu per-firmă) acoperă firmele cu mai multe ateliere; Haversine în SQL conform 3.8.

**Impact: **company_locations.coverage_radius_km; filtru în query-ul de marketplace + validare la claim.

### D-v6-11. Proiectare contra cost

**Decizie: **Flag pe cerere + linie design_fee în ofertă; FĂRĂ flux de plată separat în MVP.

**Rationale: **Plata trece prin acceptarea ofertei; un flux separat ar dubla complexitatea de plată mock fără valoare demo.

**Impact: **requests.includes_paid_design; quote_versions.design_fee.

_Inlocuita la 2026-11-13 de D-E2-1 (PO g0-8): proiectarea nu mai e o bifa pe cerere, ci consecinta ajutorului cerut pe cel putin o camera; linia `design_fee` din oferta ramane._

### D-v6-12. Moneda ofertei

**Decizie: **Firma alege RON sau EUR; clientul vede ambele prin cursul fix configurabil (1 EUR = 5.2 RON).

**Rationale: **Mulți furnizori de mobilier calculează în EUR; dubla afișare elimină confuzia clientului fără FX real.

**Impact: **quotes.currency; conversie informativă în UI + PDF.

### D-v6-13. Ceas nou la re-publicare

**Decizie: **Cererea revenită în marketplace după ratare SLA în masă primește un nou ceas de 5 zile lucrătoare.

**Rationale: **Fără ceas nou, cererea ar putea reveni deja „expirată”; clientul nu trebuie penalizat pentru eșecul firmelor.

**Impact: **Worker-ul de SLA breach total resetează expirarea; nu consumă repost-ul.

### D-v6-14. Monorepo

**Decizie: **Un singur monorepo: apps/backend + apps/frontend + packages/shared, separabil ulterior. Actualizează strategia „2 repo-uri” din v4/v5.

**Rationale: **Implementarea de către un agent AI e mult mai eficientă într-un workspace unic: migrații, tipuri partajate și testare end-to-end fără sincronizare cross-repo.

**Impact: **Secțiunea 2.1; Docker Compose în rădăcină; Sprint 1 actualizat.

### D-L0-1. Plati reale prin Stripe (2026-08-19, PO)

**Decizie: **Creditele si abonamentele se platesc online prin Stripe Checkout (pagina hosted, RON) + webhook semnat `POST /webhooks/stripe`. Calea A din 3.7 (confirmare manuala de admin) RAMANE ca fallback pentru transfer bancar; calea B mock (HMAC `PAYMENT_WEBHOOK_SECRET`) este inlocuita de webhook-ul Stripe. Facturile raman generate de platforma (serie + numar, TVA), cu datele fiscale reale din Admin → Setari.

**Rationale: **Lansare publica cu bani reali; mock-ul lasa comenzile PENDING la infinit si firmele blocate.

**Impact: **Invarianta 3.7 (webhook) si 4.17 (facturare) — actualizate prin aceasta decizie; `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` in env; lipsa lor = plata online dezactivata (doar transfer + confirmare admin).

### D-L0-2. Abonamentul dupa trial (2026-08-19, PO)

**Decizie: **Firma isi cumpara/prelungeste abonamentul din portofel (acelasi flux Stripe) si adminul poate acorda/prelungi manual (`POST /admin/subscriptions/grant`, auditat). Cumpararea in timpul unui abonament activ PRELUNGESTE (zilele ramase nu se pierd). Avertizare in UI cu 7 zile inainte de expirare.

**Rationale: **Dupa 30 de zile de trial firma ramanea blocata definitiv (nu exista nicio cale de reinnoire).

### D-L0-3. Claim-uri active fara oferta la acceptarea altei oferte (2026-08-19, PO)

**Decizie: **La `acceptQuote`, sloturile ACTIVE (fara oferta) ale celorlalte firme se inchid cu REFUND al creditelor rezervate si chat read-only; firmele care au ofertat si au pierdut raman pe pay-to-play (consum, D anterioara). Jobul de SLA nu mai penalizeaza sloturi ale unei cereri deja ACCEPTED.

**Rationale: **Firma care nu a apucat sa oferteze nu a avut sansa; penalizarea SLA + consumul pe o cerere deja atribuita erau nedrepte.

### D-L0-4. Date demo pe productie (2026-08-19, PO)

**Decizie: **Se sterg toate datele demo de pe prod (useri `@demo.ro` inclusiv `admin@demo.ro`, firmele si cererile lor, facturile mock) — `prisma/cleanup-demo.ts` cu backup inainte; se pastreaza firma reala Mobila Unicat (CUI/RegCom de completat), galeria de inspiratie si config-ul din `seed.ts`. Adminul real se creeaza cu `prisma/seed-admin.ts` din env. `seed-demo.ts` refuza sa ruleze in productie fara `ALLOW_DEMO_SEED=1` si nu mai are parola implicita.

_Completata la 2026-11-13 de D-E2-6 (PO k1-1): pana la lansare firmele demo sunt doar ascunse din lista publica de parteneri; stergerea ramane pas al lansarii._

### D-L0-5. Retrageri cu motiv "client" fara dovada (2026-08-19)

**Decizie: **`CLIENT_CONTACT_INVALID` si `CLIENT_REQUESTED_CANCELLATION` nu se mai auto-aproba (nu exista bounce-log / confirmare in chat) → PENDING_ADMIN_REVIEW ca motivele CUSTOM, pana la implementarea validarii automate din 4.15.

### D-L1-1. Livrare neconfirmata → auto-COMPLETED la 14 zile (2026-08-23, PO)

**Decizie: **Daca clientul nu confirma livrarea in 14 zile CALENDARISTICE de la momentul in care firma a marcat-o (`requests.delivered_at`), cererea trece automat in COMPLETED: creditele castigatorului se consuma, recenzia devine posibila, clientul si firma sunt notificati (delivery.autocompleted / delivery.confirmed cu autoCompleted). Worker `delivery-autocomplete` + plasa de reconciliere orara.

**Rationale: **DELIVERED_BY_COMPANY era fundatura (audit 2026-08-23, F1): fara actiunea clientului creditele ramaneau RESERVED pe veci si firma nu putea primi recenzie.

_Completata la 2026-11-13 de D-E1-5 (PO e2-1): un caz de proiect OPEN opreste finalizarea automata._

### D-L1-2. Blocarea conturilor de catre admin (2026-08-23, PO)

**Decizie: **Blocarea = camp nou `users.blocked_at` (reversibil). La blocare: sesiunile se revoca imediat, userul primeste email explicativ (transactional, ignora opt-out-ul de notificari), iar login/refresh/me refuza cu `ACCOUNT_BLOCKED`. Adminii nu pot fi blocati. UI: /admin/users (cautare + filtru rol + blocare/deblocare cu confirmare), actiuni auditate (USER_BLOCKED/USER_UNBLOCKED).

### D-L1-3. Disputa DISMISSED sterge recenzia (2026-08-23, PO)

**Decizie: **La solutionarea unei dispute: RESOLVED = recenzia ramane inregistrata; DISMISSED = recenzia se STERGE (randul din reviews dispare, disputa dispare in cascada; trail-ul ramane in audit_logs). Partile sunt notificate (`dispute.decided`). Consecinta asumata: dupa stergere clientul poate lasa o recenzie noua (unicitatea e per cerere).

### D-E1-1. Cererea ramane deschisa pana la 3 locuri, si dupa prima oferta (2026-11-13, PO a1-1)

**Decizie: **O cerere poate fi preluata si dupa prima oferta (OFFERS_RECEIVED, NEGOTIATION — deci si dupa o cerere de modificare), pana se ocupa cele 3 locuri sau clientul accepta o oferta. Firma care preia tarziu si nu a apucat sa oferteze cand clientul accepta primeste creditele inapoi (D-L0-3). Implicitul `claims_open_after_first_offer` devine `true` (cod + seed); comutatorul din Admin ramane si poate reveni la regula veche.

**Rationale: **Clientul are sansa la trei oferte, cum promite prima pagina („Trei firme. Trei oferte.”); riscul firmei care preia tarziu e spus in dialogul de preluare si in regulile publice.

**Impact: **Amendeaza invarianta 3.1 (lista starilor preluabile) si completeaza nota E-admin-platform-10 din docs/04; docs/03 4.8. Cod nou 409 `REQUEST_NO_LONGER_CLAIMABLE` cu motivul inchiderii pentru firma care acopera cererea pe raza; acelasi motiv pe cardul „Cine vede cererea” al clientului. Pe productie setarea se porneste din Admin (randul existent ramane `false`).

### D-E1-2. Fara intarziere pe plan (2026-11-13, PO a1-2)

**Decizie: **Toate planurile vad cererile imediat ce apar („vreau sa nu mai existe acest gatekeep de minute, toate tier-urile sa primeasca ofertele imediat cum apar.”). Intarzierea pe plan e 0 la toate planurile; coloana `subscription_plans.marketplace_gating_delay_minutes` si setarea din Admin raman, daca se vrea vreodata inapoi.

**Impact: **Inlocuieste Î2; Î3 ramane fara obiect. docs/03 4.10. Seed: 0 la SILVER/GOLD/PLATINUM. Pe productie valorile se pun la 0 din Admin la lansare (dupa ce se noteaza cele gasite).

### D-E1-3. Responsabilul implicit e cel care preia (2026-11-13, PO a5-1)

**Decizie: **La preluare, cel care preia devine responsabil (fara ceasul de atribuire de 1h). Proprietarul si managerul pot alege in dialog un coleg sau „Atribui mai tarziu” (atunci ramane regula de atribuire in 1h, D2). Angajatul cu acces complet preia mereu pentru el. Regula „o preluare fara oferta de persoana” ramane; dialogul o spune inainte de confirmare.

**Rationale: **Cazul obisnuit merge dintr-un clic; conducerea poate inca prelua pentru echipa.

**Impact: **docs/03 4.9. API: lipsa `assignToUserId` inseamna in continuare „fara responsabil” pentru proprietar/manager (asa e implementat „Atribui mai tarziu”); interfata trimite implicit id-ul celui care preia; pentru EMPLOYEE_TRUSTED backendul pune singur responsabilul = el.

### D-E1-4. Permisiunea de firma CLAIMS_CREATE (2026-11-13, etapa 1 — a5)

**Decizie: **Permisiune noua `CLAIMS_CREATE` in matricea din `packages/shared/src/company-permissions.ts`: OWNER, MANAGER, EMPLOYEE_TRUSTED (EMPLOYEE_MANAGED nu poate prelua). Fara `CLAIMS_ASSIGN` (doar OWNER/MANAGER) preluarea se face doar pentru sine.

**Rationale: **Echivalent cu verificarea veche „EMPLOYEE_MANAGED nu poate prelua”, scrisa acum in matrice, ca regula de la D-E1-3 sa aiba un loc unic.

**Impact: **Apare si in `CompanyDto.permissions`. Frontend-ul nu depinde de ea (foloseste doar `CLAIMS_ASSIGN`), deci un slot blue/green vechi nu se strica.

### D-E1-5. Raportul de problema in starea livrata opreste finalizarea automata (2026-11-13, PO e2-1)

**Decizie: **Clientul poate deschide raportul de proiect („Am o problema”) si in DELIVERED_BY_COMPANY (firma nu). Cat timp proiectul are un caz OPEN (inclusiv unul deschis inainte de livrare), finalizarea automata de la 14 zile nu ruleaza, pana cand echipa Cozy Home inchide cazul. Clientul poate confirma oricand manual livrarea, si cu raport deschis.

**Rationale: **Clientul e protejat; firma nu-si consuma creditele pe un proiect cu problema nerezolvata. Adminul trebuie sa raspunda la rapoarte.

**Impact: **Completeaza D-L1-1. Alegere de implementare (nu e in raspunsul PO, se poate schimba): dupa inchiderea cazului, termenul de 14 zile reporneste de la `resolved_at` (job nou `auto-complete-<id>-<resolvedAt>`; sweep-ul de reconciliere ramane plasa de siguranta). Cat e un raport deschis, panoul clientului nu mai arata termenul de confirmare automata.

### D-E1-6. Raportarea unei probleme dupa finalizare, in garantie (2026-11-13, PO e2-2 + g0-13)

**Decizie: **Dupa finalizare clientul are butonul „Raporteaza o problema” cat tine garantia scrisa in oferta acceptata, dar cel putin 24 de luni de la finalizare (g0-13; 24 de luni = garantia legala de conformitate). Raportul devine caz de proiect la admin; nu schimba starea proiectului si nici creditele; firma e notificata.

**Rationale: **Pana acum singura cale dupa finalizare era o recenzie sub 3 stele (disputa automata). Fiecare comanda are termenul ei.

**Impact: **Regula noua in docs/03 4.18. Implementare: valoare noua `project_case_reason.WARRANTY_CLAIM` (nu coloana noua; foloseste indexul „un singur caz OPEN per cerere”), coloana `requests.completed_at` (migrarea `20261113120000_project_case_warranty`, aditiva), rute `GET/POST /requests/:id/project-case/warranty`, cod 409 `WARRANTY_REPORT_WINDOW_CLOSED`. Garantia se citeste din textul liber al ofertei („24 luni”, „2 ani”, „5 years”…; mai multe durate → cea mai lunga; plafon 600 luni); daca nu se poate citi, 24 de luni. La cererile finalizate inainte de migrare baza ferestrei e `delivered_at`. Adminul inchide reclamatia cu „Inchide cazul fara anulare” (DISMISSED); firma nu poate raspunde „confirm anularea / contest” la ea. DISPUTED e tratat ca finalizat pentru garantie.

### D-E1-7. Firma cu abonament expirat isi termina preluarile in curs (2026-11-13, PO h2-1)

**Decizie: **Fara abonament activ firma vede lista preluarilor, atribuie, trimite oferte, scrie in conversatie si livreaza. Doar preluarea unei cereri noi (si lista/detaliul din marketplace) cere abonament activ.

**Rationale: **Clientii care asteapta nu sunt afectati de abonamentul firmei.

**Impact: **`SubscriptionActiveGuard` doar pe `POST /claims` (nu pe `GET /claims/mine` si `POST /claims/:id/assign`). `SUBSCRIPTION_INACTIVE.details.lastExpired` + `EntitlementsDto.lastExpired`; un singur mesaj de stare pe paginile firmei.

### D-E1-8. Creditele raman in cont fara termen (2026-11-13, PO h2-2)

**Decizie: **Creditele nu expira dupa abonament; se folosesc dupa reactivare. Regula „valabile 3 luni” se scoate din docs/03 4.16.

**Rationale: **Asa functioneaza deja codul; textul spune adevarul.

**Impact: **Inchide DECIZIA NECESARA din nota E-company-21 (docs/03 4.16).

### D-E1-9. Fara pachete de credite fara abonament activ (2026-11-13, PO h2-3)

**Decizie: **Fara abonament activ pachetele de credite sunt dezactivate, cu butonul „Reactiveaza abonamentul” alaturi; serverul refuza cu 403 `CREDITS_REQUIRE_ACTIVE_SUBSCRIPTION` (si „Continua plata” pe o comanda de credite).

**Rationale: **Fara plati fara folos si fara cereri de rambursare.

**Impact: **Abonamentul se cumpara in continuare; comenzile prin transfer deja plasate se pot confirma de admin. Verificarea foloseste predicatul „abonament activ”, nu si functia `MARKETPLACE_ACCESS` a planului.

### D-E1-10. Blatul: fara „Optional” si fara „Recomandat” (2026-11-13, PO c6-1 / c6-2 — partea de text)

**Decizie: **Acum, fara versiune noua de flux: subtitlul blatului de la bucatarie nu mai spune „Optional” (intrebarea ramane obligatorie, c6-1), iar pasii de blat `materialCountertop` (laundry.v2) si `materialWorktop` (balcony.v2) nu mai primesc eticheta „Recomandat” (doar afisare, ca regula din docs/12 §4).

**Impact: **„Nu stiu — decide firma” la blat (c6-1) si setul de blaturi la spalatorie / balcon (c6-2: PAL postformat, HPL, HPL compact, cuart, lemn masiv, decide firma) vin cu versiunea noua a formularului, in etapa 6.

### D-E1-11. Dimensiune peste limita in 3D: refuz cu mesaj (2026-11-13, alegere marunta b1, fara PO)

**Decizie: **In configuratorul 3D o valoare in afara intervalului piesei e refuzata cu mesaj langa camp („Valoarea trebuie sa fie intre …. Am pastrat valoarea de dinainte.”) si ramane valoarea veche; nu se mai taie pe tacute la limita. La fel numarul de sertare/polite (zecimala sau peste maxim → refuz cu mesaj) si 0 la dimensiunile cu lacat.

**Rationale: **Clientul vede limita si corecteaza singur; nicio valoare nu se schimba fara stirea lui.

**Impact: **Se poate schimba (varianta: ajustare la limita cu mesaj vizibil). docs/03 4.1.

### D-E2-1. Ajutorul la proiectare se cere pe camera (2026-11-13, PO g0-8 + b8-1)

**Decizie: **Fiecare camera din cos are bifa „La camera asta am nevoie de ajutor”. Camera bifata sare intrebarile. Cererea e „cu proiectare” cand macar o camera e bifata; bifa „Include proiectare cu plata” de la Date generale dispare. „Am nevoie de ajutor” de la pornire le bifeaza pe toate. In „Am deja un proiect” bifa nu exista (serverul refuza proiect propriu + camera bifata: 400 `VALIDATION_ERROR`, `validation.designHelpWithOwnProject`).

**Rationale: **PO b8-1: „o sa existe cazuri in care clientul stie in mare ce doreste dar pentru o singura camera are nevoie de ajutor din partea firmelor”.

**Impact: **Inlocuieste D-v6-11 ca bifa pe cerere. Coloana noua `request_rooms.needs_design_help` (migrarea `20261113140000_request_room_needs_design_help`); `requests.includes_paid_design` devine derivat de server (docs/04). Serverul relaxeaza verificarea doar pentru camerele bifate (optiunea `designBrief` ramane doar la estimare). Costul in credite neschimbat: camera bifata conteaza ca o camera fara raspunsuri (schimbarea costului — etapa 3). docs/03 4.1.

_Completata la 2026-11-13 de D-E3-4 (PO d1-1): camera bifata nu mai primeste piese puse din oficiu, deci costa mai putin._

### D-E2-2. O singura sursa pentru mod: „Mod: … · Schimba” in cos (2026-11-13, PO b8-2)

**Decizie: **Bifa „Am deja un proiect pentru toata locuinta” din cos se scoate; in cos ramane linia „Mod: … · Schimba”. Modul se schimba doar intr-un loc; alegerea lui seteaza impreuna „am proiect” si bifele camerelor.

**Rationale: **Clientul vede mereu ce a ales; cele doua alegeri nu se mai pot contrazice.

**Impact: **La editare modul se citeste din cerere (`hasOwnProject` + `rooms[].needsDesignHelp`), fara coloana `requests.start_mode`. Sumarul are un singur rand „Cum ai pornit cererea”. Fazele deja trecute din bara de sus sunt butoane.

### D-E2-3. Raspunsurile unei camere bifate nu pleaca la firme (2026-11-13, PO b8-3)

**Decizie: **Cand clientul trece pe ajutor (pe toata cererea sau pe o camera) dupa ce a raspuns, raspunsurile nu pleaca; raman in ciorna daca revine in „Stiu ce vreau”. Clientul e avertizat la schimbare (dialog). Camera bifata pleaca doar cu tipul, schitele ei si mesajul.

**Rationale: **Firma primeste un brief curat.

**Impact: **Serverul pastreaza dintr-o camera bifata doar fisierele pasilor de incarcare vizibili (schitele); `snapshot3d` se arunca, iar fisierele aruncate se sterg de pe cerere dupa publicare / editare (best-effort). Pe cardul camerei firma vede „Clientul cere ajutor la proiectare pentru aceasta camera”.

### D-E2-4. Problema 18 facuta prima in etapa 2 (2026-11-13, PO g0-4)

**Decizie: **Problema 18 (editarea unei cereri publicate strica ciorna) se face inaintea problemelor 9, 10 si 11.

**Rationale: **Memoria ciornei se desparte o singura data de cea a editarii; restul se construiesc peste ea.

**Impact: **Editarea are memoria ei in sessionStorage, pe cheie per cerere (invarianta 3.6, docs/02).

### D-E2-5. Doar un cont de client publica o cerere (2026-11-13, etapa 2 — f2)

**Decizie: **Publicarea dintr-un cont de firma sau de admin e refuzata cu 403 `REQUEST_PUBLISH_CLIENT_ONLY`; o ciorna anonima se leaga doar de un cont de client (`createDraft`, `patchDraft`). Firma / adminul vede pe `/requests/new` si in Sumar nota „Cererile se publica dintr-un cont de client.” cu „Iesi din cont”.

**Rationale: **O firma isi putea publica singura o cerere si o putea prelua.

**Impact: **Invarianta 3.13 (docs/02). Testele de publicare se fac cu un cont de client. Datele dinaintea reparatiei (ciorne legate de firme, eventuale cereri publicate de alte conturi decat clienti) raman: interogarea doar citire se ruleaza pe productie la lansare.

### D-E2-6. Firmele demo: ascunse acum, sterse la lansare (2026-11-13, PO k1-1)

**Decizie: **Firmele demo se ascund acum de pe paginile publice si se sterg la lansare. Firma demo = macar un membru cu e-mail @demo.ro, cu exceptia „Mobila Unicat” (aceeasi regula ca `prisma/cleanup-demo.ts`; constanta comuna in `apps/backend/src/modules/companies/demo-companies.ts`).

**Rationale: **Vizitatorii nu le mai vad; verificarile cu conturile demo merg in continuare; stergerea ramane un pas al lansarii.

**Impact: **Completeaza D-L0-4. Filtrul e doar pe lista publica `/companies/partners` (pagina „Firme partenere” si caruselul de pe prima pagina); login, piata si preluarile merg normal. Risc acceptat: o firma reala cu un membru @demo.ro pus din greseala ar fi ascunsa (si stearsa de script).

### D-E2-7. `safeRedirect` pentru adresa de intoarcere (2026-11-13, etapa 2 — f1)

**Decizie: **Parametrul `?redirect=` se citeste doar prin `safeRedirect` (`apps/frontend/src/lib/safe-redirect.ts`): doar cai interne cu un singur „/” (fara `//`, `\`, `.` / `..` in cale, inclusiv in formele decodate; fara scheme, adrese absolute, caractere de control; maximum 512 caractere), altfel `/dashboard`. Formularele de cont au `method="post"` si butonul dezactivat pana la incarcare.

**Rationale: **Parola putea ajunge in adresa paginii, iar dupa login se accepta si „//alt-site” (redirect deschis).

**Impact: **Invarianta 3.13 (docs/02). Folosit la login, inregistrare si confirmarea e-mailului.

### D-E2-8. Intoarcerea la ciorna dupa confirmarea e-mailului (2026-11-13, etapa 2 — b4)

**Decizie: **La inregistrare se trimite `returnTo`; serverul il pune in linkul de confirmare doar daca e exact in lista permisa `VERIFY_EMAIL_RETURN_PATHS`, altfel il ignora fara eroare. Lista permisa = doar `/requests/new` (aleasa de coordonator, de confirmat de PO; `/studio` si `/inspiration` se pot adauga in `auth.constants.ts`). Rezerva pe acelasi dispozitiv: ciorna nepublicata din browser (pagina de confirmare + cardul de pe Panou).

**Rationale: **Clientul nou ajungea pe un Panou gol dupa confirmare.

**Impact: **Retrimiterea e-mailului de confirmare nu poarta intoarcerea (ramane rezerva de pe acelasi dispozitiv). Ciorna pe alt dispozitiv — problema 32.

### D-E2-9. Confirmare la scoaterea unei camere cu raspunsuri (2026-11-13, etapa 2 — b6)

**Decizie: **Camera cu raspunsuri sau schite se scoate doar dupa confirmare („Pastreaza” implicit); camera goala se scoate pe loc; „−” scoate intai o camera goala. Schitele camerei scoase se sterg de pe ciorna (la editare, dupa „Salveaza modificarile”).

**Rationale: **O camera completata disparea la un clic, iar schitele ei plecau la firme ca fisiere ale proiectului.

**Impact: **docs/03 4.1.

### D-E2-10. Editarea unei cereri vechi „cu proiectare” fara camere bifate (2026-11-13, alesa de coordonator, de confirmat de PO)

**Decizie: **O cerere existenta cu `includes_paid_design = true` si nicio camera cu `needs_design_help` isi pastreaza proiectarea la editare pana cand clientul bifeaza o camera; daca editarea bifeaza macar o camera, se aplica derivarea normala.

**Rationale: **Varianta fara pierderi: altfel prima editare (de ex. adresa) ar scoate pe tacute proiectarea, scorul `PAID_DESIGN` si posibilitatea firmelor de a pune `design_fee`.

**Impact: **Exceptie de la regula „derivat = macar o camera bifata” (D-E2-1). Inainte de lansare, numaratoarea doar citire a acestor cereri pe productie.

### D-E2-11. Formular deschis dinainte de lansare (interfata veche) (2026-11-13, aleasa de coordonator, de confirmat de PO)

**Decizie: **Cand nicio camera nu trimite `needsDesignHelp`, vine `includesPaidDesign: true` si cererea nu are proiect propriu, se bifeaza doar camerele care nu trec validarea stricta; camerele complete raman nebifate, cu raspunsurile lor, iar `includesPaidDesign` ramane `true`. Cu proiect propriu, bifa veche e ignorata.

**Rationale: **Interfata veche nu trebuie sa piarda raspunsurile complete ale clientului si nici sa primeasca eroarea pentru proiect propriu + ajutor.

**Impact: **Cat timp ruleaza slotul vechi in lansarea blue/green.

### D-E2-12. Piesele din Studio 3D nu cer ajutor la proiectare (2026-11-13, aleasa de coordonator, de confirmat de PO)

**Decizie: **O piesa adusa din Studio 3D nu poate fi bifata „am nevoie de ajutor”; o cerere cu astfel de piese nu poate fi in modul „Am nevoie de ajutor”. Serverul refuza piesa din Studio bifata cu 400 `VALIDATION_ERROR` (`validation.designHelpWithStudioPiece`, `details[].roomIndex`).

**Rationale: **Piesa e deja configurata, iar configuratia ei pleaca oricum la firme prin scena Studio.

**Impact: **„Din Studio” = `sourceLocalId`-ul camerei apare in `requestEntryIds` al unei scene; in compatibilitatea cu interfata veche o piesa din Studio nu se bifeaza niciodata.

### D-E2-13. Backfill-ul nu bifeaza camerele formularului vechi (2026-11-13, ales de coordonator, de confirmat de PO)

**Decizie: **Backfill-ul migrarii `20261113140000` nu bifeaza camerele cu `answers` SQL NULL (cererile facute cu formularul vechi, cu articole).

**Rationale: **Firma ar vedea „cere ajutor” langa articolele scrise de client.

**Impact: **Sunt bifate doar camerele din cereri cu proiectare care au `answers` JSON `null` sau doar chei de fisiere (`sketch` / `snapshot3d`).

### D-E2-14. Galeria publica de inspiratie nu se filtreaza dupa firmele demo (2026-11-13, aleasa de coordonator, de confirmat de PO)

**Decizie: **Filtrul pentru firmele demo (D-E2-6) nu se aplica si galeriei publice de inspiratie.

**Rationale: **Pe productie galeria are doar poze ale firmei reale (verificat fara cont pe 2026-11-13: 70 de poze, toate „Mobila Unicat”; lista publica de parteneri avea atunci 5 firme demo + firma reala).

**Impact: **Daca apar poze atribuite firmelor demo inainte de stergere, se aplica acelasi `NOT: demoCompanyWhere` si in `inspiration.service.ts`.

### D-E3-1. Bugetul il alege clientul: o suma sau „Prefer sa nu spun” (2026-11-13, PO b11-1 + g0-9)

**Decizie: **Formularul nu mai pune nicio suma din oficiu (nici minimul estimarii, nici „Sub 5.000” in modul „Am nevoie de ajutor”). Glisorul porneste fara cursor („Alege suma”); „Continua la sumar” cere o suma sau „Prefer sa nu spun”. Firma nu mai vede o suma pe care clientul n-a ales-o: „Bugetul declarat de client” doar cand a ales-o, „Buget nedeclarat” altfel (inclusiv cererile de dinainte, vezi D-E3-8). Estimarea de azi ramane doar reper (pe glisor si, la firma, „Estimare din raspunsuri”).

**Rationale: **PO b11-1: estimarea se va face „bazat pe dimesniuni si materiale … cu ajutorul aplicatiei de ofertare pe care o sa o implementam ulterior”; PO g0-9: pana atunci se repara partea mica (recomandarea).

**Impact: **Coloana noua `requests.budget_declared` (migrarea `20261113160000_request_budget_declared`, docs/04). Ciornele vechi cu buget pus de formular cer alegerea din nou. Estimarea adevarata (aplicatia de ofertare) e in afara planului de reparatii. docs/03 4.1.

### D-E3-2. Glisorul coboara pana la o treime din estimare, cu avertisment (2026-11-13, PO b11-2)

**Decizie: **Scara glisorului merge de la o treime din estimarea minima (rotunjit la 500 lei) pana la plafonul estimarii (de 3 ori minimul). Sub estimare clientul vede nota: „Suma aleasa e sub estimarea din raspunsurile tale. Sunt sanse mici ca mobilierul sa se incadreze in acest buget, iar firmele vor ocoli mai probabil cererea.” Firma vede pe detaliul din piata „Sub estimarea din raspunsuri”.

**Rationale: **Clientul isi spune bugetul real; firma vede ca e sub estimare. Precizarea PO: pe baza estimarii realiste „o sa si anuntam clientul ca sunt sanse mici pentru a ne incadra in bugetul dat de catre client si firmele sun mai probabil sa nu accepte acea cerere”.

**Impact: **Functiile `budgetSliderBounds` / `isBudgetBelowEstimate` in shared (`request.schemas.ts`). docs/03 4.1.

### D-E3-3. Fara trepte de buget pe ecrane; firmele filtreaza cu un glisor de suma (2026-11-13, PO b11-3)

**Decizie: **Sumarul, pagina cererii, lista si detaliul din piata si fisa de lucru arata suma in lei sau „Buget nedeclarat”, niciodata treapta. Firmele filtreaza piata cu glisorul „Buget minim” (filtrat pe server, `GET /marketplace/requests?minBudgetRon=`).

**Rationale: **PO b11-3: „nu punem trepte ci lasam firmele sa aleaga dintr-un slider suma”.

**Impact: **`budget_range` ramane doar intern, pentru punctaj (treapta folosita la marime: D-E3-13); punctajul si costul in credite nu se schimba (acoperit de teste). Treptele raman vizibile doar in Admin → Marime proiect (ponderi). Scara glisorului firmei: D-E3-7. docs/03 4.1, 4.5; docs/04.

### D-E3-4. Camerele cu „am nevoie de ajutor” nu primesc piese din oficiu; costul scade (2026-11-13, PO d1-1)

**Decizie: **O camera cu `needs_design_help` pleaca la firme fara piese, materiale si dimensiuni (zero `request_items`, dimensiuni 0); firma vede „Detaliile se stabilesc cu firma.”. Din punctaj dispar punctele pieselor puse din oficiu, deci costul de preluare scade (exemplul din docs/03 4.1: doua camere bifate 19 → 14 credite; una din doua 25 → 21; fara bife 32 neschimbat).

**Rationale: **PO a ales „Costul scade” (altfel decat recomandarea „Costul ramane ca azi”): cererile de proiectare devin mai ieftine de preluat; costul reflecta doar ce a spus clientul.

**Impact: **Completeaza D-E2-1. Previzualizarea costurilor din Admin → Marime proiect aplica aceeasi regula. Ce puncte pastreaza camera bifata: D-E3-11. Cererile deja publicate nu se recalculeaza.

### D-E3-5. Textele pieselor pentru firma raman in romana si in interfata in engleza (2026-11-13, alegere marunta d1, fara PO)

**Decizie: **Numele si descrierile pieselor generate pentru firma sunt in romana corecta (diacritice, „×” la dimensiuni, fara coduri interne) si raman in romana si cand firma foloseste interfata in engleza.

**Rationale: **Repararea diacriticelor si a codurilor intra in etapa; traducerea textelor generate ar fi o lucrare separata.

**Impact: **Se poate schimba. Textele se scriu la publicare in `request_items`, deci cererile deja publicate isi pastreaza textul vechi. Antetul camerei (traductibil) arata „Mobilier: ~X m liniari” / „Tavan: Y m”, nu „L × l × H”; exceptie: camerele din formularul manual (`answers` NULL) pastreaza „L × l × H m” cu dimensiunile scrise de client (revizuirea, m4).

### D-E3-6. Scara glisorului fara estimare: 1.000–100.000 lei, pas 500 (2026-11-13, aleasa de agenti / coordonator, de confirmat de PO)

**Decizie: **Cand nu exista estimare (modul „Am nevoie de ajutor”, scor 0), glisorul clientului are scara fixa 1.000–100.000 lei, pas 500 (`BUDGET_SLIDER_FALLBACK` in shared).

**Rationale: **Planul nu spunea ce scara are glisorul fara estimare.

**Impact: **O constanta in shared; se schimba fara migrare.

### D-E3-7. Glisorul „Buget minim” al firmei: 0–200.000 lei, pas 1.000 (2026-11-13, ales de agenti / coordonator, de confirmat de PO)

**Decizie: **Glisorul firmei merge de la 0 („Oricare”) la 200.000 lei, pas 1.000 (`MARKETPLACE_MIN_BUDGET_MAX_RON`, `MARKETPLACE_MIN_BUDGET_STEP_RON`). Cu un minim ales, cererile fara suma declarata („Buget nedeclarat”, inclusiv cererile de dinainte — D-E3-8) nu mai apar in lista.

**Rationale: **PO a cerut glisorul (D-E3-3), fara scara; o cerere fara suma nu se poate compara cu minimul.

**Impact: **Firma vede sub glisor „Cu un minim ales, cererile fara buget declarat nu mai apar.”

### D-E3-8. Cererile publicate inainte de etapa 3: firma vede „Buget nedeclarat” (2026-11-13, hotarat de coordonator dupa revizuire, in spiritul g0-9; de confirmat de PO)

**Decizie: **Firma nu vede nicio suma nealeasa de client. Pentru cererile cu `budget_declared = false` (toate cele dinaintea lansarii, fara backfill) serverul nu trimite suma: firma vede „Buget nedeclarat”, fara estimare si fara „Sub estimarea din raspunsuri”, iar filtrul „Buget minim” ia in calcul doar sumele declarate. La fel si cererile vechi doar cu treapta, fara suma. Clientul isi vede in continuare suma salvata pe pagina propriei cereri (eticheta neutra „Buget”).

**Rationale: **Inainte de etapa 3 formularul punea singur minimul estimarii, deci la majoritatea cererilor vechi suma nu e a clientului (revizuirea, M2); criteriul etapei: „Bugetul apare la firma doar daca l-a ales clientul”. Inlocuieste varianta initiala „Buget orientativ: X lei”, scoasa dupa revizuire. Treapta fara suma era de regula pusa automat (in formularul de dinainte de F5 o alegea clientul — revizuirea, m5).

**Impact: **La editare, o cerere veche (`budget_declared = false`) pierde suma si cere alegerea din nou; „Prefer sa nu spun” ramane. Adminul nu are azi un afisaj al bugetului. Cererile din piata expira in 5 zile lucratoare, deci efectul la firma e trecator.

### D-E3-9. Estimarea se arata firmei doar pe detaliul din piata (2026-11-13, aleasa de agenti / coordonator, de confirmat de PO)

**Decizie: **„Estimare din raspunsuri” si „Sub estimarea din raspunsuri” apar doar pe detaliul din piata, doar langa o suma declarata; estimarea se calculeaza la citire (formula clientului, ponderile de azi) si nu se salveaza. Nu apare in lista si nici pe fisa de lucru.

**Rationale: **Fara a doua coloana noua neaprobata.

**Impact: **Daca PO o vrea si in lista / pe fisa de lucru, varianta curata e o coloana `budget_estimate_min_ron` scrisa la publicare.

### D-E3-10. „lei” si in interfata in engleza (2026-11-13, aleasa de agenti / coordonator, de confirmat de PO)

**Decizie: **Sumele de buget se scriu cu „lei” si in engleza („12,000 lei”); textele treptelor din Admin → Marime proiect au si ele „lei” in loc de „RON”.

**Rationale: **Acelasi format al sumei peste tot (b11 pasul 3).

**Impact: **Doar texte (`ro.json` / `en.json`).

### D-E3-11. Camera cu ajutor pastreaza punctele de camera (2026-11-13, aleasa de agenti / coordonator, de confirmat de PO)

**Decizie: **O camera bifata pastreaza cele trei intrari de camera din punctaj: tipul, marimea („sub 2 m”, 1 punct) si cantitatea („1”, 0 puncte); dispar doar punctele pieselor puse din oficiu.

**Rationale: **D-E3-4 cere sa dispara piesele inventate; planul nu spunea nimic despre punctele de camera.

**Impact: **Daca PO vrea sa dispara si punctul de marime (nicio dimensiune data), e o linie in `collectScoreEntries`: inca −1 credit pe camera bifata.

### D-E3-12. Piesele poarta numele din chestionar (2026-11-13, aleasa de agenti / coordonator, de confirmat de PO)

**Decizie: **Piesele generate pentru firma au fost redenumite dupa etichetele din chestionar: „Insula” (fost „Insula bucatarie”), „Banca cu lada” (fost „Banca cu depozitare”), „Corp cu cuva” (fost „Corp cuva tehnica”), „Dulap de hol”, „Bancuta cu lada”, „Cu canal pentru cabluri” (fost „Cu management de cabluri”). In configuratorul 3D zona deschisa = „compartiment deschis (fara usa)”; la lavoar si la pantofarul de hol = „polite deschise (fara usi)”.

**Rationale: **Firma vede aceleasi cuvinte ca clientul; nu s-au inventat denumiri noi.

**Impact: **Doar textele noi pentru firma (in romana, cu diacritice in aplicatie); interfata clientului nu e atinsa; punctajul neschimbat (instantaneu pe 336 de combinatii).

### D-E3-13. Marimea proiectului nu scade cand bugetul declarat e sub estimare (2026-11-13, aleasa de coordonator dupa revizuire, de confirmat de PO)

**Decizie: **Treapta folosita la marimea proiectului (si salvata in `budget_range`) se deriva din max(suma declarata, minimul estimarii din raspunsuri = scorul de baza × 1.000 lei). „Prefer sa nu spun” ramane UNDISCLOSED; fara suma (interfata veche) ramane treapta trimisa. Suma clientului ramane in `budget_estimate_ron`. Costul in credite neschimbat (scorul de baza).

**Rationale: **Revizuirea (M3): marimea (S/M/L → termenul firmei, filtrul de marime) include ponderea treptei; cu glisorul care coboara la o treime din estimare (D-E3-2), clientul ar fi putut micsora marimea alegand suma minima. Inainte treapta venea din minimul estimarii, pus din oficiu.

**Impact: **`sizingBudgetRange` (shared) si `sizeWithBudgetFloor` (`publish-rules.ts`), la publicare si la editare; a doua trecere prin calculul marimii doar cand treapta se schimba. Salvarea treptei folosite la marime tine marimea identica si la recalcularile care citesc `budget_range` (previzualizarea din Admin → Marime proiect). docs/03 4.5; docs/04.

# 9. Checklist uman: ce faci acum

- Citește integral acest document o dată. Verifică Decisions Log (Secțiunea 8, inclusiv 8.4). Dacă o decizie te deranjează, schimb-o ACUM în document, înainte ca agentul să scrie cod.

- Nu mai există [PROPUNERE] sau [DECIZIE NECESARĂ] deschise — documentul e complet.

- Creează monorepo-ul (D-v6-14) și commit-uiește: docs/PRODUCT_BIBLE_MASTER_V6.docx.

- Deschide chat nou cu coding agentul (Claude Code). Copiază MASTER PROMPT (Secțiunea 6) ca prim mesaj, cu acest document atașat.

- Așteaptă Sprint 0 (fără cod). Revizuiește schema, STATE_CONVENTIONS.md, ERROR_CODES.md, seed-ul de scoring ȘI câmpurile formularului de cerere. Corectează aici, nu după Sprint 5.

- La fiecare sprint, verifică manual checklistul de acceptare folosind seed scenarios ca scripturi de test live.

- Dacă vrei să schimbi o regulă, schimb-o în acest document, apoi spune agentului „citește din nou, secțiunea X s-a schimbat”. Nu da instrucțiuni de schimbare direct în chat fără update.

*Succes la build. Un document master coerent valorează săptămâni de refactor și de neînțelegeri evitate.*
