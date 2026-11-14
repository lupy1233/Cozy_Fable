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

_Completata la 2026-11-13 de D-E4-8 (variantele raman toate vizibile, fiecare cu moneda ei; cererile de modificare raman vizibile dupa raspuns) si de D-E4-1 (clientul poate refuza oferta)._

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

_Completata la 2026-11-13 de D-E4-3 … D-E4-6: rubricile noi intra sub cheile existente (TVA, bife, moneda, proiectare → PRICE; termen → DELIVERY_TERM; garantie → WARRANTY); o varianta noua cere acum si DELIVERY_TERM si WARRANTY._

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

_Inlocuita la 2026-11-13 de hotararea PO f3-1 (D-E5-10, implementata in etapa 5): cel mult 5 sesiuni active pe cont; a sasea autentificare o revoca pe cea mai veche, iar `auth_expired` ajunge doar la sesiunile revocate; deconectarea inchide doar sesiunea curenta; schimbarea / resetarea parolei si blocarea contului revoca tot. Invarianta 02 §3.13 adusa la zi. Textul de mai sus ramane doar istoricul deciziei initiale._

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

_Completata la 2026-11-13 de D-E4-6 (PO g0-11): la cererile cu proiectare, pretul proiectarii si „ce include” sunt obligatorii in oferta, pretul mobilierului ramane ca estimare; D-E4-5 (a3-3) pastreaza regula ca firma nu cere tarif de proiectare la celelalte cereri._

### D-v6-12. Moneda ofertei

**Decizie: **Firma alege RON sau EUR; clientul vede ambele prin cursul fix configurabil (1 EUR = 5.2 RON).

**Rationale: **Mulți furnizori de mobilier calculează în EUR; dubla afișare elimină confuzia clientului fără FX real.

**Impact: **quotes.currency; conversie informativă în UI + PDF.

_Completata la 2026-11-13 de D-E4-8: moneda e a variantei (`quote_versions.currency`), aleasa de firma la fiecare varianta; `quotes.currency` = moneda ultimei variante. Cursul ramane `eur_ron_rate`, fara data (D-E4-12)._

### D-v6-13. Ceas nou la re-publicare

**Decizie: **Cererea revenită în marketplace după ratare SLA în masă primește un nou ceas de 5 zile lucrătoare.

**Rationale: **Fără ceas nou, cererea ar putea reveni deja „expirată”; clientul nu trebuie penalizat pentru eșecul firmelor.

**Impact: **Worker-ul de SLA breach total resetează expirarea; nu consumă repost-ul.

_Completata la 2026-11-13 de D-E4-18: acelasi ceas nou de 5 zile lucratoare cand cererea ramane fara niciun loc ocupat dupa refuzul unei oferte._

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

_Completata la 2026-11-13 de D-E4-1 (PO a4-1): si oferta refuzata de client consuma creditele rezervate (pay-to-play), motiv `OFFER_DECLINED`._

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

_Inlocuita partial la 2026-11-14 de D-E5-21 (etapa 5, b7): la campurile de dimensiune din 3D valoarea se corecteaza la limita, cu mesaj („Minimul e 60 cm — am pus 60”); numarul de sertare / polite ramane refuzat cu mesaj, ca mai sus._

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

### D-E4-1. Clientul poate refuza o oferta: refuz definitiv, creditele se consuma (2026-11-13, PO a4-1)

**Decizie: **Clientul poate refuza o oferta trimisa (SENT). Refuzul e definitiv: oferta devine `DECLINED`, locul firmei se inchide, creditele rezervate se consuma, conversatia devine doar-citire, firma e anuntata (clopotel + e-mail). Locul liber poate fi preluat de alta firma cat cererea ramane deschisa (D-E1-1).

**Rationale: **PO: la fel ca „clientul a ales alta firma”; regula coerenta cu restul (pay-to-play, D-L0-3). Pana acum firma ramanea cu locul si creditele blocate pana expira oferta.

**Impact: **Ruta `POST /client/quotes/:id/decline` (Idempotency-Key, FOR UPDATE pe cerere ca la acceptare, decontare unica prin `ClaimSettlementService`, motiv in registru `OFFER_DECLINED`), cod 409 `QUOTE_NOT_DECLINABLE`, eveniment outbox `quote.declined`, mesaj de sistem `QUOTE_DECLINED` in conversatie. Migrarea `20261113180000_quote_decline_structured_versions` (docs/04). docs/03 4.8, 4.13.

### D-E4-2. Motivul refuzului: optional, din lista scurta + text; firma il vede (2026-11-13, PO a4-2)

**Decizie: **Motivul e optional: pret / termen / alta firma / renunt (`PRICE`, `DELIVERY_TERM`, `OTHER_COMPANY`, `GAVE_UP`) plus un text liber optional (max 500 de caractere). Firma le vede pe oferta, in conversatie si in e-mail.

**Rationale: **Clientul refuza dintr-un clic; firmele primesc semnal util cand e dat.

**Impact: **`quotes.decline_reason` / `decline_note` / `declined_at`. Textul ajunge la firma cu datele de contact mascate (`maskFreeText`, locul ei nu mai e ocupant); clientul il vede neschimbat.

### D-E4-3. Rubrica de TVA obligatorie, cu trei variante (2026-11-13, PO a3-1)

**Decizie: **Fiecare varianta noua de oferta spune obligatoriu: pretul include TVA / nu include TVA / firma nu e platitoare de TVA.

**Rationale: **Tabelul calculeaza „Total cu TVA” corect pentru toate; firma mai bifeaza o rubrica.

**Impact: **`quote_versions.vat_mode`; serverul calculeaza `priceWithVat` / `totalWithVat` cu cota `system_settings.vat_rate` (aceeasi sursa ca facturile). Indemnul „intreaba firma daca pretul include TVA” ramane doar pe ofertele vechi.

### D-E4-4. Termenul si garantia devin obligatorii, structurate (2026-11-13, PO a3-2)

**Decizie: **Termenul (numar + unitate: saptamani sau zile lucratoare) si garantia (in luni) sunt obligatorii la orice varianta noua.

**Rationale: **Tabelul e mereu complet; firma nu mai poate trimite o oferta fara termen.

**Impact: **`quote_versions.delivery_term_value` / `delivery_term_unit` / `warranty_months`; textele `delivery_term` / `warranty` se scriu de server din rubrici. Ofertele vechi raman cu textul liber (variante imuabile). Orice varianta noua cere acum si permisiunile DELIVERY_TERM si WARRANTY din matrice (Î5).

### D-E4-5. Doar bifele „inclus in pret: transport / montaj” (2026-11-13, PO a3-3)

**Decizie: **Oferta are doua bife obligatorii (da / nu): transport inclus in pret, montaj inclus in pret. Fara sume separate si fara tarif de proiectare cerut oricand; proiectarea ceruta de firma la o cerere fara proiectare ramane in descriere.

**Rationale: **Recomandarea PO; decizia D-v6-11 ramane neschimbata pentru proiectare (completata doar de D-E4-6).

**Impact: **`quote_versions.includes_transport` / `includes_assembly`; randurile Transport si Montaj in tabel, pe card si in PDF.

### D-E4-6. Proiectarea cu plata: pretul si „ce include” obligatorii in oferta (2026-11-13, PO g0-11)

**Decizie: **La cererile cu proiectare cu plata, pretul proiectarii si „ce include proiectarea” sunt obligatorii in oferta; pretul mobilierului ramane in aceeasi oferta, ca estimare. La celelalte cereri ambele sunt interzise. Drumul in doi pasi (intai oferta doar pentru proiectare) nu se construieste acum.

**Rationale: **Clientul compara firmele dupa proiectare, iar textele spun drumul descris de PO.

**Impact: **Completeaza D-v6-11. `quote_versions.design_includes` (text, 1–1000); 400 `VALIDATION_ERROR` cu `details.fields` cand lipsesc / sunt trimise unde nu au voie. In formular pretul de sus devine „Pret mobilier (estimare)”; pe card „Mobilier (estimare)” + proiectarea separat.

### D-E4-7. Problema 29 (tabelul de comparare) facuta impreuna cu 19 (refuzul si variantele) (2026-11-13, PO g0-5)

**Decizie: **Problemele 19 (`a4`) si 29 (`a3`) se fac impreuna, in etapa 4.

**Rationale: **O singura schimbare a bazei de date (`quote_versions`) si un singur formular nou de oferta pentru firme.

**Impact: **O singura migrare (`20261113180000_quote_decline_structured_versions`).

### D-E4-8. Moneda pe varianta; toate variantele si cererile de modificare raman vizibile (2026-11-13, pasii planului etapei 4 — a4)

**Decizie: **Moneda devine a variantei (`quote_versions.currency`, backfill din oferta); firma o alege la fiecare varianta, iar varianta noua porneste precompletata din ultima. Clientul si firma vad toate variantele, cu diferentele, iar cererile de modificare raman vizibile dupa raspuns (varianta pe care s-au cerut si varianta care le-a raspuns). Cererea de modificare apare ca mesaj de sistem in conversatie si se trimite pe e-mail firmei; o varianta noua se trimite pe e-mail clientului.

**Rationale: **Pana acum varianta 1 disparea cand venea varianta 2, cererea de modificare nu se mai vedea dupa raspuns, iar formularul variantei noi pornea gol, cu moneda fixata pe toata oferta.

**Impact: **Completeaza D-v6-12 si D-v6-11. `quote_change_requests.answered_by_version_id`; `QuoteDto.changeRequests` (`requestedOnVersion`, `answeredByVersion`); `quote.updated` cu `kind` (`CHANGE_REQUESTED` / `NEW_VERSION`).

### D-E4-9. Firma refuzata nu mai poate prelua aceeasi cerere (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **La refuz se scrie un rand `request_company_exclusions` cu motivul `QUOTE_DECLINED`; firma refuzata primeste 403 `COMPANY_EXCLUDED_FROM_REQUEST` la o noua preluare, iar cererea nu-i mai apare in piata.

**Rationale: **Agentul de server a citit „refuz definitiv” (a4-1) asa; altfel firma ar putea prelua din nou (platind iar) si retrimite aceeasi oferta.

**Impact: **Reversibil (stergerea randurilor). Daca PO vrea ca firma sa poata prelua din nou, se scoate scrierea excluderii din `declineQuote`. Textele interfetei nu promit firmei o oferta noua.

### D-E4-10. Starea noua a locului: `OFFER_DECLINED` (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **Locul firmei refuzate trece in starea noua `OFFER_DECLINED` (terminala, nu ocupa loc). Interfata decide „oferta refuzata” doar dupa `quote.status === 'DECLINED'`.

**Rationale: **Starile existente inseamna altceva: `CANCELLED_BY_CLIENT` = cerere stearsa de client, credite returnate; `CANCELLED_REQUEST_ACCEPTED` = clientul a ales alta firma.

**Impact: **Valoare noua in `claim_slot_status` (nu se poate sterge din Postgres). Toate caile de inchidere a locului pleaca doar din ACTIVE / OFFER_SENT, deci un loc refuzat nu se mai deconteaza a doua oara (`ledger-check` consistent). In Admin apare starea bruta si motivul `OFFER_DECLINED` in registru.

### D-E4-11. Campul calculat `totalWithVat` (2026-11-13, adaugat de agenti peste contract, de confirmat de PO)

**Decizie: **Pe fiecare varianta serverul intoarce, pe langa `priceWithVat` (pe pret), si `totalWithVat` = totalul (pret + proiectare) cu aceeasi regula de TVA. Tabelul si cardul folosesc `totalWithVat`, deci arata aceeasi suma.

**Rationale: **La cererile cu proiectare, „Total cu TVA” trebuie sa includa proiectarea; contractul prevedea doar `priceWithVat`.

**Impact: **Fara coloana (calculat la citire); `null` pe variantele vechi.

### D-E4-12. Cursul EUR e setarea `eur_ron_rate`, fara data (2026-11-13, constatare a agentilor, de confirmat de PO)

**Decizie: **Tabelul afiseaza doar cursul folosit („Curs folosit: 1 EUR = … lei.”), fara data cursului ceruta de plan.

**Rationale: **Cursul e o setare fixa din Admin, fara istoric; nu s-a inventat o coloana noua.

**Impact: **Daca PO vrea data, varianta propusa de agentul de server: expunerea `system_settings.updated_at` pentru cheia `eur_ron_rate` pe `QuoteDto`.

### D-E4-13. Insigna „cel mai mic” langa o oferta veche: regula prudenta (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **O oferta veche (fara rubrica de TVA) nu primeste insigna si o blocheaza pe a celorlalte, daca nu se poate dovedi ca e mai scumpa: castigatorul trebuie sa fie strict sub totalul ei scris, adus in lei (totalul scris e o margine de jos a totalului ei cu TVA). Exemplu: 15.000 vechi langa 18.500 nou → nicio insigna; 20.000 vechi langa 18.500 nou → insigna pe 18.500.

**Rationale: **Fara TVA cunoscut nu se poate compara sigur; insigna nu are voie sa minta.

**Impact: **`lib/offer-compare.ts` (`pickLowest`).

### D-E4-14. „Cel mai rapid” pe zile lucratoare (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **„Cel mai rapid” se calculeaza pe termenul adus la zile lucratoare (o saptamana = 5 zile, `deliveryWorkingDays`); fara insigna la egalitate (6 saptamani = 30 de zile lucratoare) sau cand o oferta vie are doar termen scris liber. Inlocuieste regula veche pe data livrarii.

**Rationale: **Termenul liber nu se poate compara; o egalitate nu are castigator.

**Impact: **`lib/offer-compare.ts` (`pickFastest`).

### D-E4-15. Bifele transport / montaj pornesc nebifate (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **In formular bifele pornesc nebifate si se trimit mereu explicit `true` / `false`; nu se cere o alegere activa „da / nu” pentru fiecare.

**Rationale: **Planul nu spunea cum arata alegerea in formular.

**Impact: **O firma care nu bifeaza trimite „nu e inclus”. Se schimba doar in interfata.

### D-E4-16. Varianta noua dintr-o varianta veche nu ghiceste termenul si garantia (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **Cand varianta precedenta e veche (fara rubrici), formularul variantei noi nu incearca sa citeasca termenul sau garantia din textul liber: rubricile raman goale si trebuie completate.

**Rationale: **O ghicire gresita ar intra intr-o oferta contractuala.

**Impact: **Doar interfata (precompletarea din `offer-builder.tsx`).

### D-E4-17. Tabelul arata lei intregi, cardul sume cu bani (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **Tabelul de comparare arata lei intregi („11.500 lei”, ca `formatLei` din etapa 3); cardul ofertei si dialogul de acceptare arata sumele exacte, cu 2 zecimale („11.500,00 lei”), „lei” in ambele limbi.

**Rationale: **Cardul arata sumele contractului; tabelul e pentru comparatie.

**Impact: **Unificarea formatului ramane la problema 54 (`c12`).

### D-E4-18. Fara niciun loc ocupat dupa refuz, cererea revine in piata cu ceas nou (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **Dupa refuz statusul cererii se recalculeaza: daca nu mai ramane niciun loc ocupat (de ex. a fost refuzata singura oferta), cererea revine IN_MARKETPLACE cu ceas nou de expirare de 5 zile lucratoare (ca D-v6-13, fara a consuma repost-ul); daca raman locuri ocupate fara oferta vie, coboara la CLAIMED_PARTIAL / CLAIMED_FULL; altfel ramane in OFFERS_RECEIVED / NEGOTIATION.

**Rationale: **Fara ceas nou cererea ar putea reveni deja expirata; acelasi tipar ca la retragere si la inchiderea ofertelor expirate (`recomputeRequestStatusAfterClaimChange` cu `republishExpiresAt`).

**Impact: **Jobul de expirare se programeaza dupa commit; firmele refuzate nu o mai vad (D-E4-9).

### D-E4-19. Ofertele din datele demo raman „vechi” (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **Seed-urile demo nu au fost aduse la rubricile noi: ofertele demo apar ca variante vechi (text liber, „—” la calcul, fara insigne calculate pe ele).

**Rationale: **Etapa nu atinge datele demo; ofertele vechi trebuie oricum sa se afiseze corect.

**Impact: **Pe local, pentru a vedea rubricile noi trebuie trimisa o oferta noua.

### D-E4-20. Cota de TVA se ingheata pe varianta (2026-11-14, dupa revizuirea de cod — M1 server)

**Decizie: **La trimiterea fiecarei variante noi se salveaza cota de TVA de atunci (`system_settings.vat_rate`) in `quote_versions.vat_rate_percent`; `vatRatePercent`, `priceWithVat`, `totalWithVat` si PDF-ul o folosesc. Variantele dinainte (coloana NULL) folosesc cota curenta.

**Rationale: **„Totalul cu TVA” al unei oferte trimise nu are voie sa se schimbe cand adminul schimba cota.

**Impact: **Migrarea separata `20261113181000_quote_version_vat_rate` (aditiva, fara backfill). Completeaza D-E4-3 si D-E4-11.

### D-E4-21. Refuzul doar pe o oferta in valabilitate (2026-11-14, dupa revizuirea de cod — M3 server; de confirmat de PO)

**Decizie: **Refuzul unei oferte cu `valid_until` depasit raspunde 409 `QUOTE_EXPIRED`, ca acceptarea, fara scrieri si fara credite; verificat inainte de tranzactie si sub blocare.

**Rationale: **Inainte, acelasi refuz consuma sau nu creditele dupa cat intarzia jobul de valabilitate; acum rezultatul nu mai depinde de job.

**Impact: **Oferta expirata ramane pe drumul ei existent (prelungire / reofertare / inchidere automata). Butonul „Refuz oferta” apare oricum doar pe SENT; dialogul arata „Oferta a expirat.”.

### D-E4-22. La o varianta noua, un camp neschimbat nu cere permisiunea lui (2026-11-14, dupa revizuirea de cod — M1 interfata; de confirmat de PO)

**Decizie: **La revizie / varianta peste limita / reofertare, data livrarii, termenul si garantia se socotesc atinse doar daca difera de ultima varianta; PRICE si DESCRIPTION raman mereu cerute. La v1 nimic nu se schimba, deci un membru fara drept pe termen sau garantie nu poate trimite prima varianta (rubricile sunt obligatorii).

**Rationale: **Formularul precompleteaza data livrarii din varianta veche; un angajat fara drept pe „Data livrarii” nu mai putea raspunde clientului.

**Impact: **Completeaza Î5 si D-E4-4. Eroarea `OFFER_FIELD_NOT_EDITABLE` numeste campurile (`details.fields`), iar interfata le arata.

### D-E4-23. Textele clientului se mascheaza pentru firma si in cererile de modificare (2026-11-14, dupa revizuirea de cod — M2 server)

**Decizie: **Nota de refuz si textele cererilor de modificare (`changeRequests[].requestedText`, `versions[].changeRequest.requestedText`) ajung la firma cu contactele mascate pe toate caile firmei (oferta, lista, fisa de lucru in toate vederile, chitantele actiunilor firmei, inclusiv reluarea idempotenta). Clientul vede textele neschimbate.

**Rationale: **Nota de refuz era mascata, dar cererile de modificare ajungeau nemascate, inclusiv dupa refuz.

**Impact: **Aceeasi regula ca D-E4-2; fara schimbare de schema.

### D-E4-24. Invitatiile la consultanta se inchid la refuz (2026-11-14, dupa revizuirea de cod — M3 interfata)

**Decizie: **La refuz, invitatiile `PENDING_CLIENT` ale ofertei trec in `EXPIRED`; butoanele „Accept / Refuz” ale invitatiilor apar doar pe o oferta SENT in valabilitate.

**Rationale: **Dupa refuz clientul mai vedea butoanele, iar clicul esua fara mesaj.

**Impact: **Stare existenta, fara migrare. Cererile de modificare PENDING raman PENDING (enum-ul nu are o stare potrivita; interfata le arata „Fara raspuns — oferta s-a inchis.”); retragerea aflata la admin ramane in coada — ambele de confirmat de PO.

### D-E4-25. Statistica firmei aduna ofertele in lei (2026-11-14, dupa revizuirea de cod — m8 server; de confirmat de PO)

**Decizie: **Valoarea ofertelor din panoul firmei converteste preturile variantelor in EUR cu `eur_ron_rate` inainte de adunare; totalul e in lei.

**Rationale: **Cu moneda pe varianta, o firma poate amesteca RON si EUR; suma bruta amesteca monede.

**Impact: **`companies.service.ts` (`dashboardStats`); cursul fara data (D-E4-12).

### D-E5-1. „Alta piesa”: dimensiunile vor fi optionale (2026-11-13, PO c10-1)

**Decizie: **La „Alta piesa” dimensiunile (latime, inaltime, adancime in cm) sunt optionale; clientul completeaza ce stie, firma le vede in descrierea piesei. Acum (etapa 5, fara versiune noua de formular) intra doar campul „Detalii” pe fiecare rand (descrierea care exista deja, max 2000) si limita vizibila de 150 la nume; dimensiunile vin in etapa 6, cu versiunea noua a fluxului.

**Rationale: **Fara dimensiuni firma nu poate da pret; obligatorii, l-ar bloca pe clientul care nu a masurat.

**Impact: **`step-renderer.tsx` (`PieceRows`); fara schimbare de date. Dimensiunile ajung la firma ca text in descriere, nu ca numere.

### D-E5-2. Cardurile din cos spun doar ce se poate alege azi (2026-11-13, PO c10-2)

**Decizie: **Descrierile comodei TV, bibliotecii, biroului si pantofarului din cos si subtitlul 3D al pantofarului se rescriu dupa ce ofera configuratorul 3D (fara birou pe colt, perete media, vitrine, pantofar rabatabil cu banca). Listele de pe randul „Alta piesa” arata doar materialele (PAL, MDF infoliat, MDF vopsit, MDF furniruit, Lemn masiv, Altul) si deschiderile (Maner / Push / Usi glisante) oferite azi; validarea accepta in continuare valorile vechi.

**Rationale: **O zi de lucru; clientul nu mai e dezamagit. Readucerea optiunilor ar fi munca in 3D (problema 44).

**Impact: **Doar texte (ro/en) si listele din interfata.

### D-E5-3. Ponderile provizorii ale celor 7 piese noi (2026-11-13, PO d3-1 + g0-10)

**Decizie: **Pana vine estimarea din aplicatia de ofertare, pondere de tip (`ROOM_TYPE`): canapea `PIECE_SOFA` 3, bufet `PIECE_SIDEBOARD` 2, mobilier de baie `PIECE_BATHROOM_VANITY` 2, mobilier de hol `PIECE_ENTRYWAY` 2, corp suspendat `PIECE_WALL_CABINET` 1, fotoliu `PIECE_ARMCHAIR` 1, taburet `PIECE_OTTOMAN` 1. Se schimba oricand din Admin → Marime proiect, fara lansare. Cererile deja publicate nu se recalculeaza.

**Rationale: **Azi valorau 0: o canapea de 3 locuri iesea 4 credite, o pereche de noptiere 5 (acum canapeaua 7). La d3-1 PO a trimis la calculul din aplicatia de ofertare; la g0-10 a ales valorile propuse ca provizorii.

**Impact: **`seed.ts` + migrarea `20261114100000_piece_weights_room_approx_length` (`ON CONFLICT (key, option) DO NOTHING`, pentru ca adminul poate doar edita randuri existente). docs/03 4.5.

### D-E5-4. „Lungime aproximativa” cu proiect propriu (2026-11-13, PO d3-2)

**Decizie: **Cu „Am deja un proiect” ramane un camp optional „lungime aproximativa” (m) pe camera; daca e gol, camera conteaza „sub 2 m”, ca azi.

**Rationale: **O bucatarie in U de 8 m cu proiect tehnic era mai ieftina de preluat decat aceeasi bucatarie descrisa prin formular (recomandarea era „2–4 m” implicit; PO a ales campul).

**Impact: **`request_rooms.approx_length_m NUMERIC(5,2) NULL`; intrarea `approxLengthM` pe camera (publicare, editare, estimare), permisa doar cu `hasOwnProject` (altfel 400 `VALIDATION_ERROR`, `validation.approxLengthWithoutOwnProject`); intra la `ROOM_SIZE` doar cand lungimea derivata din dimensiuni e 0 (`roomSizeLengthM` in shared). Detaliile alese de agenti: D-E5-22.

### D-E5-5. Costul preluarii: minim 1 credit, fara maxim (2026-11-13, PO d3-3)

**Decizie: **Costul unei preluari urmeaza doar punctajul: minim 1 credit, fara maxim (`claim_cost_min = 1`, `claim_cost_max = 0`). Propunerea 3..25 credite nu se aplica.

**Rationale: **Alegerea PO (altfel decat recomandarea 3..25). Risc acceptat: proiectele foarte mari pot costa mai mult decat vor firmele sa plateasca.

**Impact: **Fara cod; inchide DECIZIE NECESARA despre plafon din docs/03 4.5 si 4.8 si docs/04 5.4. Setarile raman editabile din Admin → Setari.

### D-E5-6. Clientul primeste datele persoanei responsabile dupa acceptare (2026-11-13, PO e1-1)

**Decizie: **Dupa acceptare clientul primeste numele, e-mailul si telefonul (daca e completat) persoanei responsabile de cerere, plus numele, CUI-ul si adresa firmei — doar pentru firma cu oferta acceptata.

**Rationale: **Fara schimbari in baza de date (firma nu are telefon / e-mail propriu); clientul vorbeste cu omul care lucreaza la proiect.

**Impact: **`GET /requests/:id/fulfillment` (`ClientFulfillmentDto`), verificare pe server: `company` / `contact` = `null` inainte de acceptare si niciodata pentru alta firma. Regula de alegere a persoanei: D-E5-14. docs/03 4.18.

### D-E5-7. Etape informative dupa acceptare (2026-11-13, PO e1-2)

**Decizie: **Firma castigatoare bifeaza etapele Masuratori, Contract, Productie, Montaj; clientul le vede. Etapele nu blocheaza livrarea si nu schimba starea cererii.

**Rationale: **Clientul vede progresul (recomandarea era „nu acum”; PO a ales etapele).

**Impact: **Enum `ExecutionStage`, tabel `request_execution_stages` (un rand = etapa bifata; debifarea sterge randul); `PUT /company/requests/:id/stages/:stage`, 409 `EXECUTION_STAGE_NOT_EDITABLE` in afara ACCEPTED / IN_EXECUTION / DELIVERED_BY_COMPANY; eveniment `execution.stage_updated`. Migrarea `20261114110000_execution_stages_delivery_min_days`.

### D-E5-8. „Livrat” doar dupa un numar minim de zile de la acceptare (2026-11-13, PO e1-3)

**Decizie: **Firma poate marca proiectul livrat doar dupa `delivery_min_days_after_accept` zile de la acceptarea ofertei (implicit 7; 0 = fara limita; se schimba din Admin → Setari).

**Rationale: **Firma putea apasa „livrat” la un minut dupa acceptare (recomandarea era doar un dialog clar; PO a ales pragul). O firma care livreaza repede trebuie sa astepte.

**Impact: **Setare noua (0–365); `POST /company/requests/:id/deliver` → 409 `DELIVERY_TOO_EARLY` cu `details.earliestDeliveryAt`, verificat sub blocarea cererii; `CompanyCompletionDto.earliestDeliveryAt`. Pragul se socoteste de la `quotes.accepted_at`.

### D-E5-9. Usile dulapului se intreaba o singura data (2026-11-13, PO c3-1)

**Decizie: **„Ce usi are dulapul?” ramane, iar maner / push se intreaba doar la usi batante. Acum (etapa 5, fara versiune noua) intra doar redenumirea optiunii comune „Glisante” in „Uși glisante (culisante)” si scoaterea sertarelor din descrierea ei; intrebarea unica vine in etapa 6.

**Rationale: **Clientul putea raspunde „Batante” si apoi „Glisante”; un ecran mai putin la usile glisante, iar costul tine cont de ele.

**Impact: **Cheia `common.systems.GLISANTE` (toate fluxurile, fisa firmei, Sumar, inspiratie, Admin → Marime proiect). D-E5-20.

_Adusa la zi 2026-11-14 de D-E6-14: intrebarea unica despre usi e in versiunile noi (dulapul din dormitor si, ca intrebare noua, dulapul de hol)._

### D-E5-10. Pana la 5 dispozitive pe cont (2026-11-13, PO f3-1)

**Decizie: **Un cont poate fi folosit in acelasi timp pe pana la 5 dispozitive; al saselea il scoate pe cel mai vechi.

**Rationale: **Telefon si laptop merg impreuna. Inlocuieste Î12 (decizia B, o singura sesiune) si invarianta 02 §3.13 in forma veche.

**Impact: **`MAX_ACTIVE_SESSIONS = 5`; login peste limita revoca cea mai veche familie si trimite `auth_expired` doar ei; logout = doar sesiunea curenta (D-E5-16); schimbarea / resetarea parolei si blocarea contului revoca tot. Partea „paginile care tac” se repara oricum: semnal global → login cu intoarcere (D-E5-17).

### D-E5-11. Clientului i se spune doar cand nu e nicio firma in zona (2026-11-13, PO a6-1)

**Decizie: **Fara numar de firme: doar un avertisment cand nu exista nicio firma care acopera zona cererii.

**Rationale: **Clientul nu e mintit; nu dezvaluim cat de putine firme avem in alte zone.

**Impact: **`RequestVisibilityDto.coverage` (`COVERED` / `NONE` / `UNKNOWN`); `POST /requests/drafts/:token/coverage` pentru Sumar. „Firma care acopera” = aprobata (sau cu suspendarea expirata), abonament activ cu `MARKETPLACE_ACCESS`, o locatie cu raza peste punctul aproximat — aceeasi formula ca piata, fara excluderi. docs/03 4.2.

### D-E5-12. Publicarea fara firma in zona merge, iar echipa e anuntata (2026-11-13, PO a6-2)

**Decizie: **Clientul poate publica si fara nicio firma in zona, cu avertisment; echipa Cozy Home e anuntata sa caute o firma.

**Rationale: **Clientul nu pierde cererea; echipa poate recruta firme acolo unde e cerere.

**Impact: **Eveniment `request.no_coverage` catre administratori (clopotel + e-mail), prin outbox, in tranzactia publicarii. D-E5-19.

### D-E5-13. Cine poate bifa etapele (2026-11-13, aleasa de agenti, de confirmat de PO — nepotrivire server / interfata)

**Decizie: **Serverul foloseste regula existenta a fisei de lucru (`resolveClaimContextAccess`): OWNER, MANAGER si EMPLOYEE_TRUSTED pe orice proiect castigat; EMPLOYEE_MANAGED doar pe preluarea luata de el sau atribuita lui (altfel 403). Interfata arata bifele active doar pentru OWNER / MANAGER si persoana atribuita; ceilalti le vad doar de citit.

**Rationale: **Contractul etapei spunea „OWNER / MANAGER sau angajatul atribuit”; agentul de server a refolosit regula fisei de lucru in loc sa faca una noua. Diferenta (angajatul de incredere neatribuit) ramane de hotarat.

**Impact: **De ales o singura regula si aliniat fie `fulfillment.service.ts` (`setExecutionStage`), fie `marketplace/claims/[claimSlotId]/page.tsx` (`canEditStages`).

_Adusa la zi 2026-11-14, dupa revizuirea de cod: interfata urmeaza acum regula serverului — bifele sunt active cand fisa de lucru e vizibila complet (`FULL`) si preluarea nu e „neatribuita tie” (`canEditExecutionStages`), deci si angajatul de incredere neatribuit si cel care a preluat. Ramane de confirmat de PO doar regula in sine._

### D-E5-14. Contactul aratat clientului si cat timp (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **Persoana de contact = cea atribuita preluarii castigatoare; daca lipseste sau contul ei nu mai e activ → cel care a preluat; daca nici el → proprietarul firmei. „Activ” = nesters, neblocat, neanonimizat si inca membru al firmei castigatoare; daca nimeni nu e activ, `contact = null`. Panoul clientului cu contactul si firma apare doar in ACCEPTED / IN_EXECUTION / DELIVERED_BY_COMPANY (dupa finalizare nu mai apare, desi serverul trimite in continuare datele). Pe fisa firmei etapele apar doar cat se pot bifa.

**Rationale: **Ordinea de rezerva vine din contract; restul = cea mai mica varianta, se poate extinde.

**Impact: **`getFulfillmentForClient`, `client-fulfillment.tsx`, `claim-completion-card.tsx`.

_Adusa la zi 2026-11-14, dupa revizuirea de cod: contactul si datele firmei NU se mai ascund dupa finalizare. Serverul trimite `company` / `contact` / `stages` doar in ACCEPTED, IN_EXECUTION, DELIVERED_BY_COMPANY, COMPLETED si DISPUTED (`CLIENT_CONTACT_STATUSES`), iar in CANCELLED sau alta stare `null` / `[]` (`acceptedAt` ramane); panoul clientului le arata ori de cate ori serverul le trimite (etapele doar de citit). Ordinea de alegere a persoanei si etapele firmei afisate doar cat se pot bifa raman ca mai sus._

### D-E5-15. Bifarea unei etape trimite clopotel clientului (2026-11-13, hotararea coordonatorului, de confirmat de PO)

**Decizie: **La bifare clientul primeste clopotel (fara e-mail); debifarea nu anunta nimic; o etapa debifata si bifata din nou anunta din nou; bifarea dubla a aceleiasi etape nu trimite a doua notificare.

**Rationale: **Clientul afla de progres fara e-mailuri in plus.

**Impact: **`execution.stage_updated` (cheie outbox cu momentul bifarii); nu e in lista de e-mailuri; legatura din clopotel duce clientul la `/requests/:id/offers`.

_Adusa la zi 2026-11-14 de D-E5-26: clientul e anuntat doar la prima bifare a unei etape; re-bifarea dupa debifare nu mai anunta._

### D-E5-16. Deconectarea inchide doar dispozitivul curent (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **„Deconectare” revoca doar sesiunea curenta si deconecteaza doar socketurile ei. Nu exista buton „deconecteaza-ma de peste tot”; ca sa inchizi toate sesiunile, schimbi parola.

**Rationale: **Urmeaza din f3-1: cu mai multe dispozitive, iesirea de pe telefon nu trebuie sa scoata laptopul (inainte logout-ul deconecta socketurile tuturor dispozitivelor).

**Impact: **`revokeByRawToken` intoarce `{ userId, familyId }`; `emitAuthExpired(userId, [familyId])`.

### D-E5-17. Redirect la login doar de pe paginile cu cont (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **La sesiune pierduta, redirectul la `/login?redirect=…&reason=expired` se face doar de pe paginile cu cont, dintr-o lista fixa in cod (`ACCOUNT_PREFIXES`, `lib/session-lost.ts`); pe paginile publice si de autentificare doar se goleste starea contului. „A avut sesiune” = „cine sunt eu” era in cache sau `/auth/me` a raspuns 401. Semnalul se emite cel mult o data la 5 s.

**Rationale: **Fara bucla pe login si fara redirect al vizitatorilor; `PUBLIC_PATHS` din `metadata.ts` nu se poate importa in client.

**Impact: **O pagina noua cu cont trebuie adaugata in `ACCOUNT_PREFIXES`.

### D-E5-18. Limita la verificarea zonei din Sumar (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **`POST /requests/drafts/:token/coverage` primeste cel mult 10 apeluri pe minut (geocodarea e un apel extern); la esecul geocodarii raspunsul e `UNKNOWN`, iar Sumarul nu arata niciun avertisment.

**Rationale: **Valoare mica, usor de schimbat.

**Impact: **`@Throttle` pe ruta; peste limita → 429 `RATE_LIMITED`.

_Adusa la zi 2026-11-14 de D-E5-27: limita de 10/min se tine pe ciorna (peste ea `UNKNOWN`, fara geocodare), iar limita pe IP a rutei e 60/min._

### D-E5-19. Anuntul catre admini doar la publicare (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **`request.no_coverage` se scrie o singura data pe cerere, la publicare; republicarea (repost) si schimbarea adresei la editare nu il retrimit. Acoperirea se calculeaza pentru orice cerere cu coordonate, dar avertismentul se arata clientului doar cat cererea e in piata. In Sumar textul spune ca echipa „va fi anuntata”, pe card ca „a fost anuntata”.

**Rationale: **Sarcina cerea evenimentul doar la publicare.

**Impact: **Cheia outbox `request.no_coverage:<requestId>`.

### D-E5-20. „Sliding doors” si valorile vechi din liste (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **In engleza „Uși glisante (culisante)” devine „Sliding doors” (fara dublet). Explicatia optiunii (titlu + text) nu mai pomeneste sertarele. Pe randul „Alta piesa”, o valoare veche deja salvata (MDF, BUTON_PRESIUNE, GOLA, AVENTOS) ramane afisata si bifata; odata debifata sau schimbata, nu mai poate fi aleasa din nou. Descrierea living-ului („…vitrine”) ramane, pentru ca living-ul are inca vitrina.

**Rationale: **„Doar optiunile de azi” (c10-2), fara sa stricam piesele salvate.

**Impact: **Fragmentele i18n `e5-form`; `PIECE_ROW_MATERIALS` / `PIECE_ROW_SYSTEMS` in `step-renderer.tsx` (copiate local, nu exportate din shared).

### D-E5-21. Campurile de dimensiune din 3D: corectare cu mesaj si citire in metri (2026-11-14, alegere din planul etapei 5 + agenti, de confirmat de PO)

**Decizie: **La latime / inaltime / adancime, latime coloana si inaltime rand (si la piesele din catalog si la mobilier), o valoare in afara limitelor se corecteaza la limita cu mesaj („Minimul e 60 cm — am pus 60”), campul golit pastreaza valoarea veche cu „Am pastrat valoarea anterioara”, iar o valoare sub 10 scrisa cu virgula sau punct se citeste in metri („1,2” → 120 cm, „Am inteles 120 cm”). Ce scoate o regula geometrica revine cand regula nu mai e incalcata, doar in aceeasi sesiune a pasului (se pierde la reincarcare); motivul se afiseaza (inclusiv pentru polite, minim 10 cm intre ele; bara de haine doar la piesele care o pot avea).

**Rationale: **Pasii 1 si 5 ai planului b7 si alegerea marunta din plan („1,2” → 120 cm). Inlocuieste, pentru campurile de dimensiune, refuzul din D-E1-11.

**Impact: **`explainPieceCleanup`, `columnStepperLimits`, `DESK_TWO_PEDESTALS_MIN_W` (shared); `use-dimension-field.ts`. Numarul de sertare / polite ramane refuzat cu mesaj (D-E1-11). docs/03 4.1.

_Adusa la zi 2026-11-14, dupa revizuirea de cod: citirea in metri se face doar cand valoarea × 100 intra in limitele campului („8,5” la inaltimea randului ramane 8,5 cm si e corectat la minim; inaltimea randului are ca maxim inaltimea interioara a coloanei); pragurile din mesaje vin din constantele reale ale regulilor (de ex. a doua casetiera de la 127,1 cm); numerele de bare / polite / sertare micsorate de geometrie au si ele explicatie („Am lasat 2 sertare: …”); mesajele sunt anuntate cititoarelor de ecran. Fara buton „nu mai pastra” pentru intentie (de confirmat de PO)._

### D-E5-22. Detaliile lungimii aproximative (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **Intre 0,1 si 50 m, cel mult doua zecimale. Campul apare pe ultimul ecran al camerei, doar cand fluxul are un pas de dimensiuni in metri liniari ascuns de proiectul propriu (piesele cu 3D nu il au). Valoarea se salveaza asa cum a dat-o clientul chiar daca exista si dimensiuni (atunci nu conteaza la cost).

**Rationale: **Limitele din sarcina; nu se pierde ce a scris clientul.

**Impact: **`APPROX_LENGTH_MIN_M` / `APPROX_LENGTH_MAX_M` (shared `mapping.ts`); DTO `@Min` / `@Max` / `maxDecimalPlaces: 2`.

_Inlocuita partial la 2026-11-14, dupa revizuirea de cod (constatarea mare M1 configurator): valoarea NU se mai pastreaza cand nu se aplica. Regula `approxLengthApplies(roomType, answers, version)` (shared `engine.ts`) = fluxul camerei are, cu raspunsurile de acum, un pas de dimensiuni in metri liniari SI lungimea derivata din dimensiuni e 0; altfel campul nu apare, formularul goleste valoarea (la schimbarea raspunsurilor, la copierea camerei, la incarcarea ciornei), interfata nu o trimite, serverul nu o salveaza si nu o pune in punctaj (si in previzualizarea din Admin, si in estimarea din piata). Campul nu apare nici cand dimensiunile ramase ascunse de „Am deja un proiect” dau deja o lungime (alegerea agentului, m10). Cel mult 2 zecimale: `APPROX_LENGTH_DECIMALS = 2` + `hasAtMostDecimals` (shared), mesaj `validation.approxLengthTooManyDecimals`, fara rotunjire pe tacute._

### D-E5-23. Cazuri de margine la livrare si etape (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **O oferta acceptata fara `accepted_at` (date vechi) nu are prag (`earliestDeliveryAt = null`). `PUT .../stages/:stage` de la o firma fara oferta acceptata → 409 `EXECUTION_STAGE_NOT_EDITABLE` (nu 404). `autoCompleteAt = null` si cat un caz deschis opreste ceasul. Data finalizarii automate din dialogul de livrare = azi + zilele de finalizare automata (14), pentru ca serverul nu o are inainte de livrare. Insigna „Livrata” e scurtata la „Livrata — asteapta clientul”; textul complet e in celula de termen.

**Rationale: **Varianta cea mai putin restrictiva pentru date vechi; literal din contract la 409.

**Impact: **`fulfillment.service.ts`, `claim-completion-card.tsx`.

### D-E5-24. Bifarea etapelor nu intra in jurnalul de audit (2026-11-13, aleasa de agenti, de confirmat de PO)

**Decizie: **Fara `@Audit` pe `PUT .../stages/:stage`; randul pastreaza cine (`completed_by_user_id`) si cand (`completed_at`) a bifat; la debifare randul se sterge, deci istoricul debifarilor nu se pastreaza.

**Rationale: **Etapele sunt informative si nu misca bani sau stari.

**Impact: **`request_execution_stages`.

_Inlocuita la 2026-11-14 de D-E5-26: bifarea etapelor intra acum in jurnalul de audit._

### D-E5-25. Tinta comuna la login dupa o sesiune pierduta (2026-11-14, dupa revizuirea de cod — M1/M2 interfata cu cont; textul de confirmat de PO)

**Decizie: **Toate cele 20 de garzi ale paginilor cu cont si ascultatorul global folosesc aceeasi tinta (`useLoginRedirect`, `lib/use-login-redirect.ts`): `/login?redirect=<pagina curenta>` plus `&reason=expired` doar daca omul chiar avea o sesiune (ascultatorul a actionat sau pagina a pornit cu indiciul de sesiune). Fereastra de 5 s porneste doar dupa un redirect efectiv; un 401 primit dupa o reimprospatare reusita semnaleaza si el sesiunea pierduta. Pagina cererii la client si detaliul din piata au si plasa „401 + `me.isError` → login”. Textul de pe login ramane „Te-ai autentificat pe alt dispozitiv sau sesiunea a expirat. Intra din nou.” — presupune cauza (serverul nu o spune).

**Rationale: **Revizuirea: doua pagini puteau ramane pe „se incarca” la nesfarsit, iar garda veche ducea la login fara mesaj si fara intoarcere. Vizitatorului fara cont nu i se spune ca „sesiunea a expirat”.

**Impact: **Completeaza D-E5-17. `session-lost.ts` (`loginTarget`, `sessionLostTarget`, `wasSessionLost`), `use-auth.ts` (fanionul se goleste la login / logout).

### D-E5-26. O notificare pe etapa; bifarea in audit si cu limita (2026-11-14, dupa revizuirea de cod — m2/m3 server, m3 interfata)

**Decizie: **Cheia evenimentului e fixa, `execution.stage_updated:<requestId>:<stage>`, deci clientul primeste cel mult o notificare pe etapa (prima bifare; debifarea si re-bifarea nu anunta). Payload-ul are si `companyId` (numele firmei se pune la livrare), iar clopotelul arata „<Firma> a bifat etapa: <etapa>”. Ruta `PUT /company/requests/:id/stages/:stage` are `@Audit('EXECUTION_STAGE_UPDATED', 'request')` (jurnalul retine etapa, nu nume sau texte) si `@Throttle` 30 de apeluri pe minut.

**Rationale: **Bifari / debifari repetate trimiteau clientului notificari in serie; bifarea e o actiune a firmei vizibila clientului, deci intra in audit.

**Impact: **Inlocuieste D-E5-24 si completeaza D-E5-15. `fulfillment.service.ts`, `fulfillment.controller.ts`, `audit-snapshot.ts` (`stage` in `CODES`), `notification-bell.tsx` (`executionStageTitle`).

### D-E5-27. Verificarea zonei nu poate opri publicarea; limita pe ciorna (2026-11-14, dupa revizuirea de cod — m1/m5/m6 server; contorul si enumerarea de confirmat de PO)

**Decizie: **La publicare, acoperirea si lista adminilor se citesc inaintea tranzactiei; o eroare inseamna „nu se trimite nimic”, iar publicarea merge. Anuntul `request.no_coverage` merge doar la adminii activi (nestersi, neblocati, neanonimizati). Limita de 10 verificari pe minut din Sumar se tine pe ciorna (contor in memoria serverului, fereastra fixa de 60 s; peste ea `UNKNOWN`, fara geocodare); limita pe IP a rutei e 60/min, ca frana larga. O eroare a interogarii de acoperire da tot `UNKNOWN`. Ramane posibil sa afli daca o zona e acoperita intreband adrese diferite (urmare a a6-1).

**Rationale: **Pe productie `TRUSTED_CLIENT_IP_HEADER` nu e setat, deci limitele pe IP sunt comune tuturor; throttler-ul proiectului nu poate da o limita pe ciorna diferita de cea pe IP. Geocodarea foloseste deja `geocoding_cache`, deci aceeasi adresa nu se geocodeaza de doua ori.

**Impact: **Completeaza D-E5-12, D-E5-18, D-E5-19. Contorul se goleste la repornire si nu e comun intre instante (azi un singur slot activ).

### D-E5-28. Eticheta comuna „Uși glisante (culisante)” ramane (2026-11-14, constatarea mare M2 configurator, lasata PO)

**Decizie: **Cheia comuna `common.systems.GLISANTE` ramane redenumita, desi eticheta apare si la piese fara usi si pe cererile deja publicate; pretul din explicatie e cel de la dulap (+800–2.000 lei).

**Rationale: **Planul (c3, partea fara versiune noua) cerea redenumirea textului comun; rezolvarea completa (regula unica de deschidere, fara „Glisante” in lista comuna) vine la problema 27 (`c2`).

**Impact: **De confirmat de PO pana la problema 27. Completeaza D-E5-9, D-E5-20.

_Adusa la zi 2026-11-14 de D-E6-2 (etapa 6, problema 27): in versiunile noi ale formularului „Glisante” nu mai e in nicio lista de deschidere (usile glisante sunt tip de usi). Eticheta comuna ramane doar pe cererile si ciornele de pe versiunile vechi._

### D-E6-1. Deschiderea se intreaba doar la piesele cu usi sau sertare (2026-11-13, PO c2-1)

**Decizie: **Pasul de deschidere exista doar la piesele cu fronturi. Fiecare piesa are semnul „are fronturi”: da (pas obligatoriu), nu (fara pas: rafturi, cuier, rafturi de perete, masuta, oglinda, blat, pat fara sertare) sau poate (pas cu optiunea exclusiva „Fara usi sau sertare”: birou, biblioteca, masa de toaleta, banca de hol, banca de balcon, „alta piesa” din living, „Alta piesa”). Patul din dormitor are deschidere doar la depozitare cu sertare; dulapul doar la usi batante. Baia (lavoar, dulap cu oglinda, dulap inalt) si dressingul cu usi batante primesc pasul. La piesele ghidate cu 3D deschiderea vine doar din 3D (ecranul separat de la comoda TV, biblioteca si comoda dispare).

**Rationale: **Azi era obligatorie si la piese fara usi; clientul bifa ceva fals, iar firma platea credite pentru un sistem care nu exista.

**Impact: **Doar in versiunile noi (D-E6-15). Constructorul `flows/piece-finish.ts` (`FinishPieceDef.fronts` / `frontsIf`), `NO_FRONTS` in `flows/finish-sets.ts`; `piece3d/config.ts` `configHasFronts`. docs/03 4.1.

### D-E6-2. Lista unica de deschidere; usile glisante sunt tip de usi (2026-11-13, PO c2-2)

**Decizie: **Peste tot: Maner / Push (fara maner) / Nu stiu — vreau recomandarea firmei. La bucatarie in plus Gola (baza, suspendate, insula) si Aventos (suspendate). Precizarea PO (usi pe pistoane, in sus sau in jos, la anumite corpuri): optiunea „Rabatabila, pe pistoane (in sus sau in jos)” la corpurile suspendate ale bucatariei si la comoda TV din living si dormitor; la piesele ghidate (comoda TV, bufet, corp suspendat) e o bifa pe ecranul materialului (D-E6-17). „Glisante” iese din deschidere si devine tip de usi (dulap dormitor, dulap hol, dressing, dulap 3D).

**Rationale: **Patru liste diferite; „Glisante” amesteca usile culisante cu sertarele pe glisiere.

**Impact: **`openingOptions(kind, { pistons, noFronts })` cu `OpeningSetKind` = `GENERAL` / `KITCHEN_BASE` / `KITCHEN_WALL` / `KITCHEN_ISLAND`. Completeaza D-E5-9 si inchide D-E5-28 pentru versiunile noi. docs/03 4.1.

### D-E6-3. Mai multe feluri de deschidere pe o piesa (2026-11-13, PO c2-3)

**Decizie: **Clientul poate bifa mai multe feluri de deschidere (de ex. maner si push), ca azi; costul ia varianta cea mai scumpa. „Fara usi sau sertare” si „Nu stiu…” se aleg singure.

**Rationale: **Alegerea PO (altfel decat recomandarea „unul singur”): mai flexibil.

**Impact: **`SYSTEM` cu `pick: 'max'` neschimbat; capabilitate noua `ChoiceOption.exclusive` (D-E6-15). docs/03 4.5.

### D-E6-4. „Material pentru fronturi”; corpul e PAL standard (2026-11-13, PO c1-1)

**Decizie: **La corpuri o singura intrebare, „Material pentru fronturi (usi si sertare)”; subtitlul spune ca corpul e din PAL standard, iar firma vede in descrierea piesei „Corp: PAL standard”. Cine vrea alt corp scrie la „Altul” sau in detalii. Precizarea PO (cazuri rare in bai sau pe balcoane, integral din MDF): optiunea „Integral din MDF (corp si fronturi)” la piesele din baie, la banca si dulapul de balcon si la mobilierul de baie din catalog; se puncteaza ca MDF-ul de azi (D-E6-19).

**Rationale: **Firma nu stia daca „MDF vopsit” inseamna fronturi, corp sau tot; zero intrebari in plus.

**Impact: **Setul `BODY` din `materialSetOptions`; nota `BODY_NOTE`; `MDF_INTEGRAL` → `MDF` + `INTEGRAL_MDF_NOTE`. O singura coloana de material pe piesa (fara schimbare de schema). docs/03 4.1, docs/04 5.5.

### D-E6-5. Tapitatele nu mai au intrebare de material (2026-11-13, PO c1-2)

**Decizie: **Canapea, fotoliu, taburet: nicio intrebare de material; cadrul il decide firma. Piesa se salveaza cu `ALTUL` si nota „Cadru: îl alege firma”; pe fisa apare „Recomandarea firmei”.

**Rationale: **Un ecran mai putin; tapiteria se alege deja in 3D; costul ia punctaj mediu, ca la „Altul”.

**Impact: **`guided-pieces/catalog-v2.ts`. Cost +1 fata de PAL (D-E6-34). docs/03 4.5.

### D-E6-6. Seturi proprii la oglinda, masa si pat (2026-11-13, PO c1-3)

**Decizie: **Oglinda: rama (Fara rama / Rama din lemn / Rama din MDF vopsit / Rama metalica / Nu stiu…). Masa si patul: setul de lemn (D-E6-20). Fara pret pe metru liniar.

**Rationale: **Pretul „lei/ml” si lista de fronturi nu au sens la o rama sau la o masa.

**Impact: **Seturile `MIRROR` si `WOOD`; valorile se salveaza pe enum-ul `Material` existent (docs/04 5.5).

### D-E6-7. „Nu stiu — vreau recomandarea firmei” la material, deschidere si blat (2026-11-13, PO c7-1)

**Decizie: **Optiune comuna, fara text obligatoriu, in toate listele de material, de deschidere si la blat. Restul intrebarilor raman cum sunt. Fisa firmei arata „Recomandarea firmei” in locul etichetei „Altul” si „Deschidere: recomandarea firmei” (marcaj recalculat din raspunsuri, nu din text).

**Rationale: **Singura iesire de acest fel era la televizorul comodei TV; clientul alegea la intamplare.

**Impact: **Valoarea `FIRM_DECIDES` in raspunsuri; material → `ALTUL` + `FIRM_MATERIAL_NOTE` (oglinda / blat: nota lor), deschidere → `[]` + `FIRM_OPENING_NOTE`. `firmRecommendations(roomType, answers, version)` (shared) folosita de `room-spec-card.tsx`; `DerivedRoom.firmRecommendations` nu se salveaza.

### D-E6-8. Cat costa „decide firma” (2026-11-13, PO c7-2)

**Decizie: **La material ca „Altul” (2 puncte), la deschidere 0. La blatul bucatariei 0 (ca toate blaturile).

**Rationale: **Nu incurajeaza trisatul si nu pedepseste firma; nu cere setari noi.

**Impact: **Fara randuri noi la material / deschidere; un rand nou `KITCHEN_COUNTERTOP:FIRM_DECIDES` (D-E6-12). docs/03 4.5.

### D-E6-9. Materialul si deschiderea aceleiasi piese pe un singur ecran (2026-11-13, PO c14-1)

**Decizie: **Fiecare piesa are un ecran cu materialul si deschiderea (si, unde e cazul, intrebarea care o precede: tipul usilor la dulap, depozitarea la pat, cate noptiere), cel mult 3 intrebari pe ecran.

**Rationale: **Dormitorul cu toate piesele ajungea la 20 de ecrane; acum 10 (sau 8 cu raspunsul comun).

**Impact: **INLOCUIESTE hotararea PO din 2026-07-13 (material si deschidere pe ecrane separate, `docs/archive/12-feedback-po-formulare-sprints.md` S2) si inchide DECIZIE NECESARA nr. 1 din `docs/implementation/form-redesign-2026-11-10.md`, pentru versiunile noi; versiunile vechi raman cu doua ecrane pe piesa. Grupul de ecran `piece:<VALUE>` (acelasi id de intrebare, alt grup).

### D-E6-10. Intrebarea „Acelasi material si aceeasi deschidere pentru toate piesele?” (2026-11-13, PO c14-2)

**Decizie: **In camerele cu cel putin doua corpuri cu fronturi bifate, pe ecranul listei de piese, fara raspuns preselectat. „Da” → un singur ecran comun la final (material + deschidere), copiat pe fiecare piesa la salvare; „Nu” → cate un ecran pe piesa.

**Rationale: **La bucatarie exista deja o astfel de bifa; in celelalte camere fiecare piesa se intreba separat.

**Impact: **Pasii `sameFinishAll`, `materialAll`, `materialAllOther`, `systemsAll` (grupul `piece:ALL`); `buildFinishItems` copiaza raspunsul comun. Ce piese cuprinde: D-E6-26; debaraua fara: D-E6-32. Afisarea cu doua cartonase Da / Nu: D-E6-42.

### D-E6-11. „Am deja un proiect”: materialul si deschiderea raman obligatorii (2026-11-13, PO c14-3)

**Decizie: **In modul „Am deja un proiect” materialul si deschiderea raman obligatorii, cu „decide firma” printre optiuni. Regula din 2026-07-31 (doar dimensiunile si schitele se sar, CHANGELOG OWN_PROJECT) ramane valabila.

**Rationale: **Alegerea PO (altfel decat recomandarea „optionale”): firma primeste mereu un raspuns pe fisa.

**Impact: **Fara schimbare in `validateRoomAnswers`.

### D-E6-12. Blatul: „decide firma” la bucatarie, setul de blaturi la spalatorie si balcon (2026-11-13, PO c6-1 / c6-2 — partea cu versiune noua)

**Decizie: **Blatul bucatariei ramane obligatoriu si primeste „Nu stiu — vreau recomandarea firmei” (0 puncte). La spalatorie si balcon blatul are setul de blaturi: PAL postformat, HPL, HPL compact (rezistent la apa), cuart, lemn masiv, decide firma; fara „Recomandat”, fara deschidere.

**Rationale: **Clientul care nu stie are o iesire; la spalatorie / balcon setul de fronturi era nepotrivit pentru umezeala.

**Impact: **`kitchenCountertopOptionsV4()`, setul `WORKTOP`; rand nou `project_sizing_config` `KITCHEN_COUNTERTOP` / `FIRM_DECIDES` = 0 in `seed.ts` si in migrarea `20261114120000_kitchen_countertop_firm_decides` (`ON CONFLICT DO NOTHING`). Completeaza D-E1-10.

### D-E6-13. „Alta piesa”: dimensiuni in cm si listele dupa regula unica (2026-11-13, PO c10-1 — partea cu versiune noua)

**Decizie: **Fiecare rand are Latime / Inaltime / Adancime optionale, in cm; firma le vede in descrierea piesei. Materialul are „Nu stiu…”; deschiderea urmeaza regula unica (D-E6-29).

**Rationale: **Fara dimensiuni firma nu poate da pret (D-E5-1).

**Impact: **`PiecesStep.rowVersion: 2`, `pieceRowV2Schema` si `derivePieceRowsV2` (`questionnaire/pieces-row.ts`), `pieces.v2.ts`; `request_items` fara coloane noi. Completeaza D-E5-1.

### D-E6-14. Usile dulapului o singura data, si la hol (2026-11-13, PO c3-1 — partea cu versiune noua)

**Decizie: **La dulapul din dormitor „Ce usi are dulapul?” sta pe ecranul dulapului; deschiderea apare doar la batante; glisantele se salveaza direct GLISANTE. Aceeasi regula, ca intrebare noua, la dulapul de hol.

**Rationale: **D-E5-9.

**Impact: **`wardrobeDoorType` + `fixedSystems` in `bedroom.v3.ts` si `hallway.v2.ts` (chei noi `flows.HALLWAY.wardrobeDoorType.*`); un raspuns `systemsWardrobe` la glisante e refuzat (`validation.unknownAnswer`). Completeaza D-E5-9.

### D-E6-15. Versiune noua pentru toate cele 28 de fluxuri; cererile vechi raman pe a lor (2026-11-13, presupunerea planului etapei 6)

**Decizie: **Toate cele 28 de fluxuri au versiune noua (fiecare are o intrebare de material care primeste „decide firma”). Cererile publicate si ciornele in curs raman pe versiunea lor (se rezuma, se editeaza si costa la fel); doar camerele adaugate dupa lansare primesc versiunea noua (si intr-o cerere veche editata: cereri mixte, fiecare camera validata pe versiunea ei). Studio 3D pastreaza versiunea unei piese deja aduse. Nicio schimbare de schema; nicio valoare noua de enum.

**Rationale: **O optiune noua inseamna alta validare, deci alta versiune; versiunile vechi trebuie sa o refuze.

**Impact: **`FLOW_REGISTRY` cu versiunile vechi si noi; `CURRENT_FLOW_VERSION` comutat pe `ETAPA6_FLOW_VERSION` intr-un commit separat (D-E6-36); `FLOW_VERSIONS_BEFORE_ETAPA6` pentru testele de invarianta (instantaneele vechi byte-identice). Capabilitati noi in motor, toate optionale: `Condition` `{ not }` si `in` cu `atLeast`, `ChoiceOption.exclusive` (`validation.exclusiveOption`), `PiecesStep.rowVersion: 2`, `DerivedRoom.firmRecommendations`. `evalCondition` mutat in `questionnaire/condition.ts` (re-exportat din `engine.ts`, ca sa evite un import circular). Costul se schimba doar pentru cererile noi; firmele trebuie anuntate (docs/03 4.5). docs/04 5.5.

### D-E6-16. „Pe pistoane” se salveaza ca Aventos (2026-11-14, N1, aleasa de coordonator, de confirmat de PO)

**Decizie: **Optiunea „Rabatabila, pe pistoane” (`PISTONS`) se salveaza ca `AVENTOS` (3 puncte) cu nota „Uși rabatabile pe pistoane (în sus sau în jos)” in descriere; fisa arata „Aventos” langa nota.

**Rationale: **Acelasi fel de mecanism de ridicare; fara valoare noua de enum. Alternativa `BUTON_PRESIUNE` (1 punct) nu are sens.

**Impact: **`resolveOpening(values, { pistons })`, `PISTONS_NOTE`.

### D-E6-17. Pistoanele la piesele 3D sunt o bifa, nu o optiune in 3D (2026-11-14, N2, de confirmat de PO)

**Decizie: **Comoda TV ghidata, bufetul si corpul suspendat de catalog au pe ecranul materialului bifa „Unele usi se deschid in sus sau in jos, pe pistoane” (`liftUpDoors`) → AVENTOS + nota. Maner / push raman alegerea din 3D.

**Rationale: **Configuratorul 3D are doar Push / Maner; o valoare noua in 3D ar fi munca in 3D.

**Impact: **`liftUpDoorsStep()` in `guided-pieces/v4.ts`, folosit si de `catalog-v2.ts`.

### D-E6-18. Fara „decide firma” la deschiderea pieselor 3D (2026-11-14, N3, de confirmat de PO)

**Decizie: **La piesele ghidate cu 3D deschiderea vine doar din 3D (lista e acolo), fara „decide firma”. 3D fara maner ales = fara sistem, ca la versiunea veche (problema 43 `d2` „Push implicit” ramane a ei).

**Rationale: **O singura sursa (PO c2, pasul 5).

**Impact: **`frontStyleSystemsV4` in `guided-pieces/v4.ts`.

### D-E6-19. „Integral din MDF” se taxeaza ca MDF (2026-11-14, N4, de confirmat de PO)

**Decizie: **`MDF_INTEGRAL` se salveaza ca `MDF` (randul `MATERIAL:MDF` = 2 puncte) cu nota „Corp și fronturi din MDF”, fara nota „Corp: PAL standard”.

**Rationale: **PO: „se puncteaza ca MDF-ul de azi”; alternativa `MDF_VOPSIT` (3) ar fi mai scumpa.

**Impact: **Valoarea legacy `MDF` revine in date prin aceasta optiune (docs/04 5.5).

### D-E6-20. Continutul setului de lemn (2026-11-14, N5, de confirmat de PO)

**Decizie: **Masa si patul: Lemn masiv (`LEMN_MASIV`) / Furnir de lemn natural (`MDF_FURNIR`) / PAL cu decor lemn (`PAL`) / Nu stiu…; fara „Altul” (cine vrea altceva scrie in detalii / schita).

**Rationale: **Varianta mica; tine ecranul patului la cel mult 3 intrebari.

**Impact: **Setul `WOOD` (`WOOD_OPTION_VALUES`).

### D-E6-21. Pretul pe metru liniar ramane la piesele din placi (2026-11-14, N6, de confirmat de PO)

**Decizie: **Rafturile, cuierul, rafturile de perete, banca ghidata si rafturile debaralei au lista de placi (setul `PANEL`: ca la corpuri, fara „Integral din MDF”, fara nota de corp), cu pret pe metru liniar. Pretul dispare doar la lemn, oglinda si blat.

**Rationale: **Sunt tot mobilier din placi.

**Impact: **Pretul vine din optiuni (`priceHintKey`), fara steag nou pe pas.

### D-E6-22. Lista pieselor cu pistoane (2026-11-14, N7, de confirmat de PO)

**Decizie: **Exact lista PO: bucataria (suspendate), corpul suspendat, bufetul, comoda TV (din living, din dormitor si ghidata). Dulapul cu oglinda din baie nu are pistoane (candidat de intrebat).

**Rationale: **PO: „spune daca lista e alta”.

**Impact: **`pistons: true` in `living.v4.ts`, `bedroom.v3.ts`; `liftUpDoors` in `guided-pieces/v4.ts` (comoda TV) si `catalog-v2.ts` (bufet, corp suspendat).

### D-E6-23. Pistoanele la bucatarie doar la suspendate (2026-11-14, N8, de confirmat de PO)

**Decizie: **„Rabatabila, pe pistoane” apare doar la corpurile suspendate (unde e si Aventos), nu la baza si insula.

**Rationale: **Acolo se folosesc mecanismele de ridicare.

**Impact: **`KITCHEN_WALL` in `openingOptions`; `resolveOpening(v, { pistons: true })` doar pe suspendate in `kitchen.v4.ts`.

### D-E6-24. Dressingul deschis nu are intrebare de deschidere (2026-11-14, N9, de confirmat de PO)

**Decizie: **Dressing cu usi glisante → GLISANTE fara intrebare; cu usi batante → deschiderea pe ecranul materialului (fara „Fara usi sau sertare”); fara usi → fara sisteme si fara intrebare, chiar daca are sertare.

**Rationale: **Planul spune „dressingul cu usi batante”.

**Impact: **`dressing.v4.ts` (`openingSystems` pe `materialScreen`, `visibleIf` `doorType = HINGED`).

### D-E6-25. Patul din 3D nu are intrebare de deschidere (2026-11-14, N10, de confirmat de PO)

**Decizie: **Patul ghidat (3D) nu are deschidere, ca azi (3D-ul patului nu are manere); regula „doar la sertare” se aplica patului din dormitor.

**Rationale: **Varianta mica.

**Impact: **`guided-pieces/furniture-v4.ts` (`systems` mereu `[]` la pat, masa, banca).

### D-E6-26. Ce cuprinde intrebarea comuna (2026-11-14, N11, de confirmat de PO)

**Decizie: **Doar corpurile cu fronturi (setul `BODY`, fronturi da / poate). Patul, masuta, oglinda, rafturile, blatul isi pastreaza ecranul. Ecranul comun nu are pistoane (cine vrea pistoane la comoda TV raspunde „Nu”). „Fara usi sau sertare” apare pe ecranul comun doar daca exista o piesa comuna „poate” si nicio piesa „da” bifata (inclusiv dulapul, chiar daca usile lui sunt glisante). Intrebarea apare doar in fluxurile cu intrebare comuna si doar cu cel putin doua piese comune bifate.

**Rationale: **Seturile si regulile difera la celelalte piese.

**Impact: **`isCommonFinishPiece`, `pieceFinishSteps` (`systemsAll`).

### D-E6-27. Campul „Altul” nu se numara la „cel mult 3 intrebari” (2026-11-14, N12, de confirmat de PO)

**Decizie: **Campul text „Altul” (`*Other`) e completarea intrebarii de material: nu primeste numar in contorul ecranului si nu se numara la limita de 3.

**Rationale: **Fara asta dormitorul nu coboara sub 10 ecrane.

**Impact: **`room-flow-runner.tsx` (calculul numerotarii).

### D-E6-28. Bucataria ramane cu ecranul „Fronturi” pe zone (2026-11-14, N16, de confirmat de PO)

**Decizie: **Ecranul „Fronturi” al bucatariei ramane unul singur, cu pana la 9 intrebari, impartit vizual in zone: „Corpuri de baza / Corpuri suspendate / Insula” (aceleasi nume ca piesele de pe fisa firmei). Fara „materiale diferite”, materialul comun si bifa stau sus, iar zonele au doar deschiderea; cu bifa, ea ramane in zona „Corpuri de baza”, sub materialul de baza. Bucataria nu are intrebarea comuna (are deja bifa „materiale diferite pe zone”).

**Rationale: **Impartirea in 3 ecrane ar fi o alta versiune si mai multe ecrane. Zonele se fac din interfata (problema 53, pasul 1), pe id-uri de pas, deci merg pe v3 si pe v4.

**Impact: **`kitchen-front-zones.ts`, `room-flow-runner.tsx`; chei `flows.KITCHEN.v3.zones.{base,wall,island}`.

### D-E6-29. „Alta piesa”: deschiderea obligatorie, fara „Usi glisante” (2026-11-14, N13, de confirmat de PO)

**Decizie: **Pe randul v2 deschiderea e obligatorie: Maner / Push sau una dintre iesirile exclusive „Nu stiu — vreau recomandarea firmei” / „Fara usi sau sertare”. „Usi glisante” iese (regula unica); clientul o scrie in „Detalii”.

**Rationale: **Regula unica de deschidere, cu iesiri.

**Impact: **`pieceRowV2Schema` (`openingChoice`, `PIECE_ROW_V2_SYSTEMS`); mesaje `validation.minOneOption` / `optionInvalid` / `exclusiveOption`. Randurile v1 neschimbate.

### D-E6-30. „Alta piesa”: limitele dimensiunilor si costul (2026-11-14, N14, de confirmat de PO)

**Decizie: **Latime / inaltime / adancime: intregi 1–600 cm, doar in descrierea piesei („Dimensiuni: 120 × 80 × 40 cm (lățime × înălțime × adâncime)” sau doar cele date). Lungimea pentru cost ramane euristica v1 (1 m pe bucata, minim 0,5 m). „Detalii” are limita 1800 (loc pentru note in limita de 2000 a descrierii).

**Rationale: **Schimbarea costului tine de `d3` / `c5`.

**Impact: **`PIECE_ROW_DIM_MIN_CM`, `PIECE_ROW_DIM_MAX_CM`, `PIECE_ROW_DESCRIPTION_MAX`; `validation.dimensionOutOfRange`.

### D-E6-31. Materialul lipsa = „Altul” in versiunile noi (2026-11-14, N15, de confirmat de PO)

**Decizie: **Cand raspunsul de material lipseste (doar in previzualizarea ciornelor; la publicare pasul e obligatoriu), piesa e `ALTUL` peste tot in versiunile noi (inainte: „Altul” la piesele de catalog, PAL la celelalte, CP-30). Debaraua fara stil de depozitare ales are piesa de rezerva „Rafturi debara” cu `ALTUL` (inainte PAL).

**Rationale: **Un singur implicit.

**Impact: **`DEFAULT_MATERIAL_WHEN_MISSING = 'ALTUL'`.

### D-E6-32. Debaraua fara intrebarea comuna (2026-11-14, N17, de confirmat de PO)

**Decizie: **Debaraua are doar doua zone cu seturi diferite (rafturi = placi, fara deschidere; dulapuri = corpuri cu deschidere), deci nu are intrebarea comuna. Materialul si deschiderea dulapurilor stau pe ecranul lor (`piece:CABINETS`).

**Rationale: **Varianta mica.

**Impact: **`pantry.v3.ts` (`common: false`).

### D-E6-33. Insigna „Recomandarea firmei” se potriveste dupa numele piesei (2026-11-14, N18, de confirmat de PO)

**Decizie: **Fisa recalculeaza `firmRecommendations` din raspunsuri si pune insigna pe piesele cu acelasi nume (piesele din baza de date nu au ordine garantata). Doua piese cu acelasi nume in aceeasi camera o primesc amandoua. Insigna e ambra; „Fara usi sau sertare” nu primeste insigna (nu e o recomandare a firmei; nota e deja in descriere). Daca recalcularea esueaza, fisa arata ca azi.

**Rationale: **Fara coloana noua; acceptabil.

**Impact: **`room-spec-card.tsx`; chei `roomSpec.firmRecommendation`, `roomSpec.firmRecommendationOpening`.

### D-E6-34. Tapitatele costa cu 1 punct mai mult (2026-11-14, N19, de confirmat de PO)

**Decizie: **Canapea, fotoliu, taburet: `ALTUL` (2 puncte) + „Cadru: îl alege firma” + insigna „Recomandarea firmei”, deci +1 fata de PAL de azi.

**Rationale: **PO c1-2: „costul ia punctaj mediu, ca azi la „Altul””.

**Impact: **docs/03 4.5 (exemplul E: 7 → 8).

### D-E6-35. Holul: textul intrebarii despre usi (2026-11-14, N20, de confirmat de PO)

**Decizie: **Copie a textului din dormitor, cu chei proprii `flows.HALLWAY.wardrobeDoorType.*`; explicatia usilor glisante e adaptata la hol („alegerea fireasca intr-un hol ingust”).

**Rationale: **Varianta mica.

**Impact: **Doar texte; ilustratiile = pozele usilor de la dormitor.

### D-E6-36. Comutarea pe versiunile noi intr-un commit separat; lansarea = PO (2026-11-14, N21, de confirmat de PO)

**Decizie: **`CURRENT_FLOW_VERSION` trece pe versiunile noi intr-un commit separat al coordonatorului; lansarea pe productie o face PO, cu anunt catre firme (costul se schimba la cererile noi; doua cereri asemanatoare pot costa diferit o vreme).

**Rationale: **Comutarea e reversibila dintr-o linie pe tip de camera; fluxurile noi raman in registru.

**Impact: **`flows/index.ts`. La intoarcerea pe codul dinainte de etapa 6, camerele salvate pe versiunile noi nu se mai pot publica / edita (`CONFIGURATOR_FLOW_VERSION_UNSUPPORTED`).

_Facuta 2026-11-14 (valul 3): `CURRENT_FLOW_VERSION` e pe versiunile noi pentru toate cele 28 de tipuri; instantanee noi `score-v6.json` / `firm-text-v6.json`, cele vechi byte-identice; testul de cost `apps/backend/src/modules/sizing/score-v6.spec.ts` confirma exemplele A–E. Lansarea ramane la PO._

### D-E6-37. Titlurile pe piesa (2026-11-14, aleasa de agenti, de confirmat de PO)

**Decizie: **Fiecare piesa are titlul ei (altfel rezumatul ar repeta acelasi titlu): „Material pentru fronturi — <piesa>” la corpuri, „Material — <piesa>” la lemn, placi si blat, „Rama oglinzii” la oglinda. La bucatarie titlul nou „Material pentru fronturi (usi si sertare)” e doar pe corpurile de baza; suspendatele si insula isi pastreaza titlul pe zona (toate trei primesc subtitlul comun). Deschiderea are titlu nou doar la baie si la dressing („Cum se deschid usile dressingului?”); in rest cheile existente („Deschidere pentru …”). Dressingul are subtitlu propriu: „Corpul se face din PAL standard. La dressingul fara usi, materialul ales e pentru tot dressingul.” Titlurile pieselor ghidate spun „Material pentru fronturile …” si la biblioteca / birou, care pot ramane fara fronturi.

**Rationale: **Abaterile A1, A2 (e6-kd), titlurile alese de e6-rooms-a / e6-rooms-b, P4 (e6-guided).

**Impact: **Chei `flows.<ROOM>.v<N>.<materialStepId>.title`, `flows.BATHROOM.v3.systems*.title`, `flows.DRESSING.v4.material.{title,subtitle}`, `flows.DRESSING.v4.openingSystems.title`, `flows.PIECE_*.v4.material.title`, `flows.PIECE_*.v2.material.title`.

_Adusa la zi 2026-11-14 de D-E6-45: titlul dressingului e acum neutru, „Material — dressing”, iar subtitlul: „Cu uși: materialul e pentru uși și sertare, corpul se face din PAL standard. Fără uși: materialul e pentru tot dressingul.”_

### D-E6-38. Cand apare nota „Corp: PAL standard” (2026-11-14, aleasa de agenti, de confirmat de PO)

**Decizie: **Nota apare la corpurile cu fronturi (da sau poate), si la „Altul” (inaintea notei „Material dorit: …”). Nu apare la „Integral din MDF”, la „decide firma”, cand lipseste raspunsul, la „Alta piesa” (randul v2) si la piesele 3D fara fronturi (biblioteca deschisa, hol cu pantofar deschis — acolo materialul e al intregii piese). La dressing apare doar la usi glisante sau batante; in descrierea dressingului notele vin dupa textul existent (interior, LED).

**Rationale: **Abaterile D5 (e6-found), A3, A4 (e6-kd), P1 (e6-guided); proiectul era ambiguu la „Altul”.

**Impact: **`buildFinishItems`, `kitchen.v4.ts`, `dressing.v4.ts`, `guided-pieces/v4.ts`.

_Adusa la zi 2026-11-14 de D-E6-41: nota nu mai apare nici la o piesa aleasa „Fara usi sau sertare” (pe ecranul piesei sau pe cel comun)._

### D-E6-39. Pistoane si maner la piesele 3D fara fronturi (2026-11-14, aleasa de agenti, de confirmat de PO — al doilea punct de reparat sau de acceptat)

**Decizie: **Bifa de pistoane da AVENTOS chiar daca piesa 3D nu are fronturi (proiectul, literal). La bufetul / corpul suspendat de catalog manerul din 3D (`frontStyle`) se ia ca la versiunea veche, fara verificarea `configHasFronts`, deci un bufet complet deschis poate primi Maner; corpurile ghidate (v4) verifica fronturile.

**Rationale: **Abaterile P2, P3 (e6-guided): „ca la v1”. Neconcordanta intre corpurile ghidate si catalog.

**Impact: **`guided-pieces/v4.ts`, `catalog-v2.ts`. De semnalat si: `describePieceConfig` (piece3d, inghetat) scrie „fronturi cu maner” si la piese fara fronturi.

_Inlocuita la 2026-11-14, dupa revizuirea de cod (m2 / m3 fluxuri): o piesa 3D fara fronturi (`configHasFronts` fals) nu primeste nici maner / push din `frontStyle`, nici AVENTOS si nota de pistoane din bifa `liftUpDoors` — atat corpurile ghidate v4 (comoda TV), cat si bufetul / corpul suspendat de catalog v2 (`finishPieceItem`, `catalog-v2.ts`). Bufetul complet deschis ramane cu `systems: []`, fara puncte de sistem. Textul „fronturi cu maner” din descrierea 3D ramane (D-E6-46)._

### D-E6-40. Alegeri marunte ale agentilor (2026-11-14, de confirmat de PO)

**Decizie: **(1) La pat, masa si banca ghidate fluxul vechi primeste raspunsurile fara material, ca „Material dorit” sa nu apara de doua ori. (2) Un pas care precede piesa (tipul usilor, depozitarea, cate noptiere) fara conditie proprie apare doar cand piesa e bifata. (3) Randul „Alta piesa” v2: un camp de dimensiune golit dispare din raspuns; cel mult 4 cifre; valorile din afara 1–600 raman in raspuns ca sa le refuze validarea. (4) Pe „Alta piesa” v1 randul nu e strict: chei in plus (de ex. `widthCm`) trec validarea si raman in raspunsurile salvate, dar sunt ignorate la derivare (asa era si inainte).

**Rationale: **Rapoartele e6-guided (P5), e6-found (D7, D8), e6-ui, e6-kd / e6-seed.

**Impact: **Fara efect pe cost.

_Punctul (3) inlocuit la 2026-11-14 de D-E6-43: valorile cu zecimale sau litere raman in camp si blocheaza pasul._

### D-E6-41. Fara „Corp: PAL standard” la piesele alese „Fara usi sau sertare” (2026-11-14, dupa revizuirea de cod — M1 fluxuri; de confirmat de PO)

**Decizie: **Cand deschiderea unei piese se rezolva la „Fara usi sau sertare” (pe ecranul piesei sau pe ecranul comun), descrierea nu mai primeste „Corp: PAL standard”; ramane doar „Fără uși sau sertare” (plus „Material dorit: …” la „Altul”). Materialul ales ramane cel salvat si punctat.

**Rationale: **Firma citea „corp din PAL, fara fronturi, material MDF vopsit” si nu intelegea pe ce se pune materialul. Acum regula e aceeasi ca la piesele 3D fara fronturi (D-E6-38). Schimba randul „banca Fara usi sau sertare” din tabelul proiectului (§6.1).

**Impact: **`flows/piece-finish.ts` (`buildFinishItems`: nota corpului doar fara `NO_FRONTS_NOTE`); teste in `piece-finish.test.ts`, `rooms-a.v6.test.ts`, `rooms-b.v6.test.ts`. Completeaza D-E6-38.

### D-E6-42. Intrebarile da / nu obligatorii de pe un ecran cu alte intrebari au doua cartonase (2026-11-14, dupa revizuirea de cod — M1 interfata; de confirmat de PO)

**Decizie: **O intrebare da / nu obligatorie aflata pe acelasi ecran cu alte intrebari se arata ca doua cartonase, „Da” si „Nu”, fara nimic ales; „Nu” se poate alege direct. Se aplica la „Acelasi material si aceeasi deschidere pentru toate piesele?” (cele 7 fluxuri cu intrebare comuna) si la „Pat tapitat?” din dormitorul nou. Bifele optionale de pe acelasi ecran (insula, LED, pistoane) raman un singur cartonas.

**Rationale: **Inainte aparea doar cartonasul „Da”; „Nu” se obtinea doar apasand de doua ori, iar starea „Nu” arata ca „neatins” (PO c14-2 cerea Da / Nu fara raspuns preselectat).

**Impact: **`step-renderer.tsx` (grup cu `aria-label` = titlul intrebarii, `aria-pressed`); nicio versiune veche nu are o asemenea intrebare. Completeaza D-E6-10.

### D-E6-43. „Alta piesa”: dimensiunile cu zecimale sau litere blocheaza pasul (2026-11-14, dupa revizuirea de cod — m1 interfata; hotararea coordonatorului, de confirmat de PO)

**Decizie: **Campurile in cm accepta doar numere intregi. Un text ca „12,5”, „60.5” sau cu litere ramane in camp, cu eroarea „Scrie un număr întreg de centimetri.”, si blocheaza „Continua”; nu se rotunjeste si nu se lipesc cifrele. Un intreg se salveaza ca numar; campul golit scoate dimensiunea.

**Rationale: **Inainte virgula disparea pe tacute („12,5” devenea 125 cm in descrierea pentru firma).

**Impact: **`step-renderer.tsx` (textul gresit se salveaza ca text, pe care `pieceRowV2Schema` il respinge cu `validation.dimensionOutOfRange`; serverul il respinge la fel); cheia `Configurator.pieces.errors.wholeCm`. Inlocuieste punctul (3) din D-E6-40.

### D-E6-44. „Alta piesa”: erorile langa camp, tinte de atingere mai mari (2026-11-14, dupa revizuirea de cod — m2 / m6 interfata)

**Decizie: **Dupa un „Continua” respins, fiecare rand gresit are chenar rosu si eroarea langa campul ei (nume, deschidere sub „Cum se deschide”, dimensiune, material, cantitate, detalii); eroarea generala de sus apare doar pentru erori de pas. Un rand nou nu arata erori inainte de „Continua”. Etichetele bifelor au cel putin 44 px inaltime, iar „Sterge” e scos din grupul „Cum se deschide”.

**Rationale: **Deschiderea a devenit obligatorie pe rand (D-E6-29), deci eroarea apare mai des; clientul nu stia ce rand sa repare.

**Impact: **`step-renderer.tsx` (`PieceRowsV2`, erorile din `pieceRowV2Schema`); chei `Configurator.pieces.errors.{name,opening,wholeCm}`.

### D-E6-45. Texte aliniate dupa revizuire (2026-11-14, dupa revizuirea de cod — m4 interfata, m3 interfata)

**Decizie: **(1) La piesele cu „Integral din MDF” (si pe ecranul comun cand o piesa comuna il are) subtitlul de material nu mai spune ca piesa e din PAL: „Pentru uși și sertare. De obicei corpul se face din PAL standard; dacă vrei și corpul din MDF, alege „Integral din MDF”.” (2) Descrierea optiunii „Fara usi sau sertare”: „Piesa nu are nici uși, nici sertare.” (3) Titlul dressingului: „Material — dressing” (D-E6-37). (4) Titlurile de zona ale bucatariei apar doar pe ecranul unic „Fronturi” (v3 / v4), nu si pe ecranul de deschidere al bucatariei v2.

**Rationale: **Textele contraziceau optiunile de pe acelasi ecran; zona aparea pe o versiune veche, nedeclarat.

**Impact: **Cheia noua `common.finish.frontMaterial.subtitleIntegral` (`frontMaterialSubtitleKey`, `finish-sets.ts`; folosita de constructor si de lavoarul de catalog); `common.finish.opening.NO_FRONTS.description`; `flows.DRESSING.v4.material.title`; `kitchen-front-zones.ts` (`isKitchenFrontsScreen` cere si `separateFrontMaterials`).

### D-E6-46. Lasate asa dupa revizuire (2026-11-14, constatari ale revizuirii de cod; de confirmat de PO)

**Decizie: **(1) Descrierea din 3D scrie „fronturi cu maner” si la o piesa fara fronturi (`describePieceConfig`, cod inghetat, comun cu versiunile vechi; sistemele si costul sunt corecte). (2) Pe ecranul comun o banca (sau alta piesa „poate”) nu poate fi „Fara usi sau sertare” cand e bifat si un corp care are sigur usi: primeste deschiderea celorlalte (de ex. Maner, +1 punct); iesirea e raspunsul „Nu”. (3) Daca dupa „Da” lista scade sub 2 piese comune, raspunsul comun dispare si clientul raspunde din nou pe piesa ramasa (nimic gresit nu se salveaza).

**Rationale: **(1) Fisierul e inghetat; filtrul ar trebui pus separat in fluxurile noi. (2) E regula D-E6-26. (3) Impact mic; ar cere copierea raspunsului in interfata.

**Impact: **Constatarile m4, m6, m1 ale revizorului de fluxuri. Completeaza D-E6-26, D-E6-39.

### D-E7-1. Firma vede suma estimata de client inainte de preluare (2026-11-13, PO a7-1)

**Decizie: **Da, firma vede suma estimata (nu e data de contact) inainte sa plateasca preluarea; panoul de preluare spune de unde vine costul: „Costul vine din bugetul minim estimat de client (X lei; 1 credit = Y lei)”.

**Rationale: **Firma decide mai bine daca merita creditele; clientul nu pierde nimic personal. Costul in credite se calculeaza chiar din aceasta suma (4.8).

**Impact: **Suma era deja livrata la b11 (etapa 3). Randul nou: `claim-panel-notes.tsx`; `FirmRulesDto…claimCost.creditValueRon` (shared `legal.ts`, `LegalService`). docs/03 4.8.

### D-E7-2. Lista de tari a adresei ramane (2026-11-13, PO b12-1)

**Decizie: **Adresa de montaj poate fi in oricare din cele 23 de tari de azi; nu se reduce la Romania. Cum ajunge la firme o cerere din alta tara se hotaraste la intrebarea g0-12 (deschisa, neinceputa in etapa 7).

**Rationale: **Raspunsul PO: „exista firme care lucreaza cu clienti si din alte tari, si invers clienti care cauta firme romanesti pentru un montaj in afara tarii”.

**Impact: **`details-step.tsx` neschimbat la lista; tara apare la afisare doar cand nu e Romania (`formatDisplayAddress`). docs/04 `requests.country`.

### D-E7-3. Fila „Ciorne” in „Cererile mele” (2026-11-13, PO d5-1)

**Decizie: **„Cererile mele” are o fila „Ciorne” cu „Continua” si „Sterge”, doar pentru ciornele legate de cont.

**Rationale: **Clientul isi reia ciorna de pe orice dispozitiv; pana acum singurul loc era dialogul „Ai o cerere inceputa” din acelasi browser.

**Impact: **`GET /requests/my-drafts`, `POST /requests/:id/draft-token` (docs/04); `my-drafts-list.tsx`, `use-requests.ts` (`useMyDrafts`, `useContinueDraft`). Detalii: D-E7-11, D-E7-12.

### D-E7-4. Imaginea 3D a piesei e vizibila clientului (2026-11-13, PO d4-1)

**Decizie: **Clientul vede imaginea 3D a piesei ca miniatura in Sumar si pe pagina cererii — exact ce primesc firmele. Inlocuieste partea „invizibil pentru client” din D-3D-4 (`archive/10-tylko-3d-configurator-sprints.md`); imaginea ramane automata.

**Rationale: **Clientul vede ce primesc firmele; imaginea nu se mai pierde in tacere (urca pe ciorna, nu la publicare).

**Impact: **`review-room-card.tsx`, `snapshot3d-sync.tsx`, `piece3d/snapshot3d-renderer.tsx`, `stores/snapshot3d.ts`, `configurator-store.ts`; pagina cererii foloseste `RoomSpecCard` cu atasamentele (audience `client`). Detalii: D-E7-14. docs/03 4.17 (nota imaginii 3D).

### D-E7-5. Clientul e anuntat cand o firma renunta (2026-11-13, alegere marunta din plan, fara PO — se poate schimba)

**Decizie: **Cand o firma renunta la preluare (voluntar, motiv validat automat sau retragere aprobata de admin), clientul primeste clopotel + e-mail „O firma a renuntat; cererea e din nou disponibila pentru alte firme”, o singura data pe preluare, fara numele firmei. Inchiderile automate (termen depasit, neatribuire) nu trimit mesajul.

**Rationale: **Clientul afla imediat ca cererea e din nou deschisa; fara mesaje in rafala la expirari.

**Impact: **Eveniment nou `request.company_withdrew` (cheie outbox pe slot), `withdrawals.service.ts` (`notifyClientCompanyWithdrew`), `notification-emails.service.ts`, `notification-bell.tsx` (link spre pagina cererii), `use-socket.ts`. docs/02 3.5, docs/03 4.15.

### D-E7-6. Cod propriu pentru preluarea interzisa rolului (2026-11-14, pasii planului etapei 7 — a7)

**Decizie: **Angajatul fara acces complet (`EMPLOYEE_MANAGED`, fara `CLAIMS_CREATE`) primeste 403 `CLAIM_ROLE_NOT_ALLOWED` la preluare, nu `FORBIDDEN`; in interfata butonul e dezactivat, cu „Preluarea o face proprietarul, un manager sau un angajat cu acces complet”. Permisiunea `CLAIMS_CREATE` exista deja (OWNER, MANAGER, EMPLOYEE_TRUSTED — D-E1-4).

**Rationale: **`FORBIDDEN` ajungea la om ca mesajul despre atribuire („Doar proprietarul sau un manager poate atribui preluarea.”).

**Impact: **`claims.service.ts`, shared `error-codes.ts`, `marketplace/[id]/page.tsx`, texte RO/EN. docs/ERROR_CODES.md.

### D-E7-7. Garda comuna `useRequireAuth(rol)`; rol gresit = ecran, nu redirect tacut (2026-11-14, pasii planului f4 + agent; butonul „Intra cu alt cont” de confirmat de PO)

**Decizie: **Toate paginile cu cont folosesc `useRequireAuth(rol?)` (`lib/require-auth.tsx`; stari `loading` / `ok` / `wrongRole`): fara sesiune → `/login?redirect=<cale + query>` (prin `safeRedirect`, D-E2-7; cu `reason=expired` la sesiunea pierduta, D-E5-25); rol gresit → `RoleOnlyScreen` „Pagina e doar pentru clienti / firme / administratori”, cu „Mergi la Panou” si „Intra cu alt cont” (deconectare, apoi login cu intoarcere pe aceeasi pagina). Pe detaliu 403/404 → „Cererea nu exista sau nu e a ta” / „Preluarea nu exista sau nu e a firmei tale”; alta eroare → „Reincearca”.

**Rationale: **Fiecare pagina isi facea singura verificarea, fara adresa de intoarcere; unele nu verificau deloc si aratau „Nu am putut incarca datele”. Butonul „Intra cu alt cont” a fost adaugat de agent (planul cerea doar butonul spre Panou).

**Impact: **Paginile `marketplace`, `marketplace/claims`, `marketplace/claims/[claimSlotId]`, `marketplace/[id]`, `requests/[id]`, `requests/[id]/offers`, `admin/{page, companies, disputes, inspiration, payments, requests, requests/[id], withdrawals}`, `marketplace/{messages, wallet}`, `company`. Regulile mai fine decat rolul raman (cumpararea din portofel `BILLING_MANAGE`, contoarele adminului, conversatia echipei). docs/02 3.6.

### D-E7-8. „Cine sunt eu” nu se reia singur dupa o eroare; pagina cu cont nu monteaza componente cu cont cat el nu e gata (2026-11-14, reparatia defectului D1 din verificarea etapelor 4–6)

**Decizie: **`useMe` are `retryOnMount: false`: dupa un `/auth/me` esuat, interogarea se reface doar explicit (login, logout, semnalul de sesiune pierduta, socketul, refetch). O pagina cu cont arata scheletul cat „cine sunt eu” e in incarcare SAU in eroare (pana la redirect) si nu monteaza componente care cer cont (de ex. `SubscriptionStatusNotice`). Ascultatorul de sesiune pierduta (`resetQueries`) ramane: reia o singura data interogarile active, pentru formularul public.

**Rationale: **Pe „Piata” si „Preluari”, montarea mesajului de abonament relua `/auth/me` → „pending” → scheletul il demonta → eroare → il monta iar: mii de cereri, garda de login rechemata la fiecare ciclu. `resetQueries` nu era cauza.

**Impact: **`hooks/use-auth.ts`, `marketplace/page.tsx`, `marketplace/claims/page.tsx`; test `session-lost-loop.test.tsx`. docs/02 3.6.

### D-E7-9. Blocul si apartamentul intr-un camp separat (2026-11-14, aleasa de agent, de confirmat de PO)

**Decizie: **„Bloc, scara, apartament” se salveaza in coloana proprie `requests.address_details` (max 100), nu lipit la `address_text`; pasul planului „se adauga la adresa salvata” se aplica la afisare. Regula de acces e a strazii (doar cu acces la contacte). Nu se trimite la geocodare si nu intra in audit.

**Rationale: **Asa supravietuieste editarii si alegerii unei sugestii, iar geocodarea primeste adresa curata. Planul nu prevedea coloana; migrarea a fost planificata in contractul etapei.

**Impact: **Migrarea `20261114140000_request_address_details`; DTO-uri, `requests.service.ts`, `quotes.service.ts` (fisa de lucru), shared `request.schemas.ts` / `quote.schemas.ts`, `address-autocomplete.tsx`, `details-step.tsx`, `review-step.tsx`, `configurator-wizard.tsx`. docs/04, docs/03 4.2, docs/02 3.8.

### D-E7-10. Mutarea fragmentelor de adresa si regula dublurilor la afisare (2026-11-14, aleasa de agent, de confirmat de PO)

**Decizie: **(1) Fragmentele „bl. / sc. / ap. / et. / interfon” tastate in adresa trec singure in campul nou la alegerea unei sugestii, doar daca acesta e gol. (2) La afisare (`formatDisplayAddress`) orasul se sare doar cand e egal cu judetul sau apare in adresa ca segment intreg intre virgule („Strada Cluj 3, Cluj” ramane intreg); tara apare doar cand nu e Romania, cu numele ei in limba aplicatiei. (3) „Completeaza orasul.” (`cityRequired`) doar la oras; judetul si adresa goale raman la b9.

**Rationale: **Sa nu se suprascrie ce a scris clientul; sa nu se taie nume de strazi care contin numele orasului.

**Impact: **`address-autocomplete.tsx`, shared `address-format.ts`, `use-display-address.ts`.

### D-E7-11. „Continua” pe o ciorna emite un acces nou (2026-11-14, aleasa de agent, de confirmat de PO)

**Decizie: **„Continua” din fila „Ciorne” cere `POST /requests/:id/draft-token`, care emite un token nou (tokenul ciornei e pastrat doar ca hash, deci cel vechi nu se poate reda). Browserul vechi nu mai deschide ciorna din tokenul lui: acolo formularul porneste o ciorna noua, iar ciorna ramane in lista contului.

**Rationale: **Singurul mod de a deschide ciorna pe alt dispozitiv fara a pastra tokenul in clar.

**Impact: **`requests.service.ts` (`reissueDraftTokenForClient`, scriere conditionata pe DRAFT; altfel 400 `REQUEST_NOT_EDITABLE`), `requests.controller.ts`.

_Adusa la zi 2026-11-14 de D-E7-26: browserul vechi nu mai porneste o ciorna noua; arata „Ciorna a fost continuata pe alt dispozitiv…” si opreste salvarile._

### D-E7-12. Fila „Ciorne” ascunde ciornele fara nicio camera (2026-11-14, aleasa de agent, de confirmat de PO)

**Decizie: **Lista arata doar ciornele legate de cont care au macar o camera in starea formularului; ciornele create din oficiu la deschiderea formularului nu apar.

**Rationale: **N-au nimic de continuat; ar umple lista.

**Impact: **`requests.service.ts` (`listDraftsForClient`), `draft-list.ts` (`draftRoomTypes`, `draftCity`).

### D-E7-13. Istoricul „O firma a avut acces la datele tale pana pe …” (2026-11-14, aleasa de agent, de confirmat de PO)

**Decizie: **Cardul „Cine vede cererea” arata, fara numele firmei, fiecare preluare inchisa in care firma vedea deja contactele in clipa inchiderii (inclusiv firmele neselectate dupa acceptare), evaluata cu aceeasi functie ca fisa de lucru si cu politica de dezvaluire de azi; data = `claim_slots.withdrawn_at`, altfel `updated_at` (dupa revizuire, m2 server).

_Limitare lasata PO dupa revizuire (m1 server): daca adminul schimba `claim_contact_reveal_policy` (`ON_CLAIM` ↔ `AFTER_GRACE`), istoricul preluarilor inchise inainte poate fi inexact (o firma care a vazut datele lipseste, sau una care nu le-a vazut apare). Reparatia sigura = o coloana noua pe slot cu momentul din care firma a putut vedea datele — DECIZIE NECESARA PO._

**Rationale: **Clientul afla ca o firma i-a vazut datele, chiar daca acum nu le mai are; inainte vedea „Nicio firma inca”.

**Impact: **`RequestVisibilityDto.pastContactAccess`, `requests.service.ts` (`getVisibilityForClient`), `request-visibility-card.tsx`.

### D-E7-14. Cand urca imaginea 3D si cand pleaca (2026-11-14, aleasa de agent, de confirmat de PO)

**Decizie: **(1) Imaginea urca pe ciorna la iesirea de pe ecranul 3D si la ~2,5 s dupa ultima schimbare, prin incarcarea existenta de atasamente (presign → confirm), fara server nou; fisierul vechi se sterge la inlocuire (daca stergerea esueaza, se sterge inainte de publicare). (2) `roomInstances[].snapshot3dKey` tine minte configuratia; o imagine cu alta cheie e „mai veche” si nu pleaca la publicare (se scoate din raspunsuri, fisierul se sterge). (3) La Sumar, imaginea lipsa / veche se deseneaza ascuns, piesa cu piesa (1,5 s + incercari la 0,5 s, cel mult ~7 s; peste 15 s = esec); un PNG sub ~8.000 de caractere = „doar fundal” = esec; esecul se spune pe card, publicarea merge. (4) La editarea unei cereri publicate nimic nu urca inainte de „Salveaza” (abatere mica de la pasul 1, doar la editare); imaginea veche se sterge dupa salvare.

**Rationale: **Imaginea nu se mai pierde la reincarcare; firmele nu vad un fisier nou pe o cerere nesalvata; o imagine veche nu mai pleaca dupa o publicare esuata.

**Impact: **Fara migrare (camp optional in starea ciornei). Ramane nereparat (bug mai vechi): `copyRoomAnswers` pierde referintele la fisierele camerei tinta.

### D-E7-15. Limitele conversatiei aratate pe ecran (2026-11-14, pasii planului g3 + agent; contorul de confirmat de PO)

**Decizie: **Contorul „n / 5.000” apare de la 4.000 de caractere (80% din limita), nu tot timpul; limita se numara pe textul fara spatiile de la capete (ca pe server); campul nu are `maxLength` (un text lipit nu se taie, primeste explicatia). `MESSAGE_MAX_LENGTH = 5000` e o constanta locala in `chat-panel.tsx`, fixata de un test pe server (`@MaxLength(5000)`). Selectorul de fisiere foloseste `ATTACHMENT_ACCEPT` si `checkAttachmentFile` din formularul de cerere.

**Rationale: **Contorul tot timpul ar fi zgomot; taierea in tacere ar pierde text.

**Impact: **`chat-panel.tsx`, `chat/dto/chat.dto.spec.ts`. docs/03 4.14.

### D-E7-16. Comanda tine minte cand proforma a plecat pe e-mail (2026-11-14, ceruta de pasul 3 al g4; migrarea aprobata de coordonator, de confirmat de PO)

**Decizie: **Coloana noua `mock_billing_orders.proforma_emailed_at` (TIMESTAMPTZ, NULL) se scrie o singura data, dupa ce un e-mail de transfer a plecat cu proforma atasata. Portofelul spune „ti-am trimis proforma” doar cand e completata; altfel „Factura proforma o poti descarca oricand de aici.” (text schimbat dupa revizuire, m11 interfata: nu mai pomeneste e-mailul, deci e corect si la comenzile vechi). Marcajul doar pentru e-mailul catre OWNER / MANAGER: D-E7-23. Un esec la scrierea marcajului nu retrimite e-mailul.

**Rationale: **E-mailul pleaca si fara proforma (randare esuata, comanda de test, date fiscale neconfigurate), iar textul o promitea mereu. Agentul s-a oprit la migrare (contractul etapei); coordonatorul a aprobat-o.

**Impact: **Migrarea `20261114150000_billing_order_proforma_emailed_at`; `billing-documents.service.ts` (`markProformaEmailed`), `notification-emails.service.ts`, `payments.service.ts`, `BillingOrderDto.proformaEmailedAt`, `bank-transfer-panel.tsx`.

### D-E7-17. PDF-urile: eroare clara, alerta adminilor, browser local doar in dezvoltare (2026-11-14, pasii planului g4 + agent)

**Decizie: **(1) Rutele PDF ale ofertei pun tipul si numele fisierului doar pe raspunsul reusit (`quotePdfFile`, ca la factura); orice randare esuata (oferta, proforma, factura) raspunde 503 `DOCUMENT_RENDER_FAILED` (JSON). (2) „Descarca PDF” la oferta descarca prin aplicatie si arata mesajul la eroare. (3) Randarea esuata scrie un avertisment in jurnal si clopotelul `documents.pdf_failed` catre adminii activi, o data pe zi (cheia are data zilei, Europe/Bucharest), fara e-mail. (4) Daca Chrome-ul versiunii puppeteer lipseste, doar in afara productiei si fara `PUPPETEER_EXECUTABLE_PATH` se foloseste un Chrome / Edge instalat; pe productie nu se ghiceste nimic (`Dockerfile.app` neschimbat).

**Rationale: **Cauza locala: puppeteer 25.1.0 cauta Chrome 149.0.7827.22, iar in `~/.cache/puppeteer` era doar 156.0.8078.47 — orice PDF dadea 500, iar ruta ofertei trimitea eroarea ca „PDF” stricat.

**Impact: **Nou `billing/pdf-browser.ts`; `quote-pdf.service.ts`, `invoice-pdf.service.ts`, `quotes.controller.ts`, `offer-pdf-button.tsx`, `notification-bell.tsx`, `use-socket.ts`. Pe productie: cele doua butoane de apasat o data dupa lansare (presupunerea etapei).

### D-E7-18. Dialogul de retragere a ofertei: termenul de pe fisa, penalizarea la conditional (2026-11-14, pasii planului a7; detaliul cu regulile neincarcate ales de agent)

**Decizie: **Dialogul arata termenul de pe fisa (fara cele 12 ore de gratie), gratia pe un rand separat („termenul e 17 nov., 23:59; mai ai 12 ore de gratie”), iar pierderea preluarii si penalizarea la conditional („daca nu trimiti o oferta noua pana atunci”). Datele de pe cardul firmei sunt in ora Romaniei. Dupa revizuire (m6 interfata): termenul vine din `slaDeadlineAt` al preluarii (aceeasi sursa ca fisa), iar orele de gratie = momentul ratarii minus termen, ambele de la server — nu se mai calculeaza din regulile de azi (`withdrawSlaDeadline` scos). Confirmarea de preluare e o notificare pornita inainte de navigare (pagina fisei neschimbata).

**Rationale: **Dialogul arata termenul plus gratia, iar fisa termenul fara gratie; penalizarea era spusa ca sigura.

**Impact: **`offer-card.tsx`, `marketplace/[id]/page.tsx`; test `offer-card-withdraw.test.tsx`.

### D-E7-19. Reparatiile din verificarea in browser a etapelor 4–6 (2026-11-14, hotararea coordonatorului)

**Decizie: **(1) Cardul „Acordul vostru”: datele in limba aplicatiei si in ora Romaniei, sumele cu „lei”, moneda variantei confirmate, „azi” in ora Romaniei. (2) `/requests/<id>/edit` pe o cerere needitabila nu deschide editorul (aceeasi regula ca butonul „Editeaza”, `request-editability.ts`; serverul refuza oricum salvarea). (3) In randul „Alta piesa” v2 optiunea de material are eticheta scurta „Decide firma” (`pieces.firmDecidesShort`), cu textul lung sub lista cand e aleasa. (4) „Băncuță” cu diacritice in textele holului. (5) Bucla de la sesiunea pierduta: D-E7-8.

**Rationale: **Defectele D1 / D2 ale verificatorului A (oferte / cont, 9 din 10 puncte trecute) si D1 / D2 / D3 ale verificatorului B (formularul nou, 9 din 9 puncte trecute).

**Impact: **`agreement-card.tsx`, `requests/[id]/edit/page.tsx`, `step-renderer.tsx`, `ro.json` / `en.json` (prin fragmente). Fara efect pe cost sau pe date.

### D-E7-20. Blocul se ascunde la afisare doar cand e deja intocmai in strada; mutarea automata prinde formele lipite (2026-11-14, dupa revizuirea de cod — M1 server, m10 interfata; de confirmat de PO)

**Decizie: **`formatDisplayAddress` sare „Bloc, scara, apartament” doar cand fiecare bucata a lui (intre virgule) e un segment intreg al strazii, identic dupa normalizare (cu numere): „4” langa „Str. Lalelelor 14” / „… 14, 077190 Voluntari” si „B” langa „Strada București 5” raman afisate; „Str. X 10, bl. A2, ap. 14” + „bl. A2, ap. 14” nu se repeta. O adresa veche cu blocul lipit in strada fara virgula („Str. X 10 bl. A2”) il poate arata de doua ori — lasat asa. Mutarea automata (regex cu `u`, fara litera / cifra inainte) recunoaste „bl12”, „blA2”, „sc2”, „ap3”, „et4” si „bl. Ă2”, fara sa atinga „Aprodul”, „Blaj”, „Școlii”, „Scării”, „Apeductului”, „Etajului”.

**Rationale: **Comparatia pe subsir ascundea apartamentul (salvat corect) din Sumar, de pe pagina cererii si de pe fisa firmei. Un bloc afisat de doua ori e mai putin grav decat un apartament pierdut.

**Impact: **shared `address-format.ts`, `address-autocomplete.tsx`; teste `address-format.test.ts`, `address-autocomplete.test.tsx`. Completeaza D-E7-10.

### D-E7-21. „Cine sunt eu” se verifica o data la revenirea in tab, doar cat e in eroare (2026-11-14, dupa revizuirea de cod — M1 interfata)

**Decizie: **`useMe` are, pe langa `retryOnMount: false` (D-E7-8), `refetchOnWindowFocus: (query) => query.state.status === 'error'`: un tab ramas „vizitator” reface `/auth/me` la revenirea in tab, o singura cerere (`retry: false`). Cu sesiunea buna revenirea nu cere nimic; restul aplicatiei ramane cu `refetchOnWindowFocus: false` (`providers.tsx`). `/requests` („Cererile mele”) trece si ea pe `useRequireAuth('CLIENT')` + `RoleOnlyScreen` (m8 interfata).

**Rationale: **Dupa reparatia buclei, un tab deschis ca vizitator nu afla de login-ul facut in alt tab (cazul tipic: confirmarea e-mailului, b4) si paginile cu cont il trimiteau la login.

**Impact: **`hooks/use-auth.ts`, `requests/page.tsx`; `session-lost-loop.test.tsx` (+4 cazuri; cu `refetchOnWindowFocus: false` cazurile noi pica). docs/02 3.6. Completeaza D-E7-7, D-E7-8.

### D-E7-22. La editare, cel mult o imagine 3D pe piesa (2026-11-14, dupa revizuirea de cod — M2, m1, m2, m3 interfata; de confirmat de PO)

**Decizie: **(1) Editarea unei cereri publicate tine minte, pe cerere, in localStorage (`stores/edit-snapshot-files.ts`), fisierele 3D urcate si nesalvate (`uploads`) si imaginile salvate pe care le-a inlocuit (`replaced`). Dupa o salvare reusita se sterg toate cele nefolosite de cererea salvata (si cele de la o incercare esuata de dinainte); la aruncarea editarii (abandon, fereastra expirata) se sterg cele urcate; la urmatoarea intrare in editare construita din cerere se sterge tot ce cererea salvata nu foloseste. (2) „Publica” / „Salveaza” asteapta desenarea ascunsa in curs (cel mult 15 s; dupa limita piesa e marcata esuata si publicarea merge) si stergerile imaginilor inlocuite de pe ciorna (cel mult 10 s; esecul ajunge in `discardedFiles`). (3) Verificarea WebGL se face o data pe pagina, cu contextul de proba inchis imediat; desenarea ascunsa ruleaza cate una si elibereaza contextul (`WEBGL_lose_context`) dupa fiecare piesa.

**Rationale: **O salvare esuata urmata de una reusita lasa imaginea veche pe cerere, iar o editare abandonata o lasa pe cea noua — fisiere nelegate de nicio camera, aratate la „Atasamente” si trimise firmelor.

**Impact: **`snapshot3d-sync.tsx`, `review-step.tsx`, nou `stores/edit-snapshot-files.ts`. Completeaza D-E7-14.

### D-E7-23. Proforma e „trimisa” doar cand e-mailul a ajuns la proprietar sau manager (2026-11-14, dupa revizuirea de cod — m5 server)

**Decizie: **`markProformaEmailed` se cheama doar din `sendForEvent` (e-mailul catre OWNER / MANAGER); copia catre adresa de facturare a firmei (contabil) nu mai marcheaza `proforma_emailed_at`.

**Rationale: **Cand toti OWNER / MANAGER au e-mailurile oprite, portofelul ii spunea proprietarului „ti-am trimis proforma”, desi o primise doar contabilul.

**Impact: **`notification-emails.service.ts` (+ test). Completeaza D-E7-16.

### D-E7-24. PDF-ul ofertei se salveaza cu nume propriu; alerta si browserul de PDF mai cuminti (2026-11-14, dupa revizuirea de cod — m7 interfata, m6 / m7 server; numele de confirmat de PO)

**Decizie: **(1) „Descarca PDF” salveaza fisierul ca `oferta-<firma>-v<versiune>.pdf` (`offerPdfFileName`: fara diacritice si caractere nepermise, firma cel mult 40 de caractere; acelasi nume si in engleza). (2) Alerta `documents.pdf_failed` incearca cel mult o data pe zi pe proces (frana in memorie), deci un GET ratat nu mai deschide o tranzactie la fiecare cerere; pe slotul standby (`DEPLOYMENT_MODE=standby`) doar jurnal, nicio scriere in baza. (3) `PdfBrowserHolder` (in `pdf-browser.ts`, folosit de `quote-pdf` si `invoice-pdf`): o singura pornire comuna la cereri simultane, o pornire ratata nu ramane tinuta minte, iar dupa o randare ratata browserul se inchide si se uita.

**Rationale: **Trei oferte descarcate deveneau `oferta.pdf`, `oferta (1).pdf`…; Chromium cazut pe productie insemna o scriere la fiecare descarcare (si pe standby); un Chrome agatat dar „conectat” dadea 503 pana la repornire, iar doua cereri la pornire lansau doua procese.

**Impact: **`offer-pdf-button.tsx`, `pdf-browser.ts`, `quote-pdf.service.ts`, `invoice-pdf.service.ts` (+ teste). Completeaza D-E7-17.

### D-E7-25. Lista de ciorne: cel mult 20, filtrata in SQL (2026-11-14, dupa revizuirea de cod — m4 server; limita de confirmat de PO)

**Decizie: **`GET /requests/my-drafts` face o singura interogare SQL cu `LIMIT 20` (cele mai recente dupa `updated_at`); ciornele fara camere se filtreaza in SQL (cu `CASE`, ca sa nu crape pe un JSON care nu e lista); din `configurator_state` se citesc doar tipurile de camera (cel mult 20) si orasul.

**Rationale: **Un cont cu multe ciorne create din oficiu citea la fiecare deschidere a filei toate JSON-urile intregi.

**Impact: **`requests.service.ts` (`listDraftsForClient`), `draft-list.ts`; integrare scrisa `requests.drafts-list.integration.spec.ts`. Completeaza D-E7-12.

### D-E7-26. „Continua” intreaba inainte sa inlocuiasca; celalalt dispozitiv afla (2026-11-14, dupa revizuirea de cod — m4 / m9 interfata, m3 server; de confirmat de PO)

**Decizie: **(1) Daca browserul are o cerere inceputa (`hasUnpublishedLocalDraft`), „Continua” din lista intreaba o singura data; fara acord nu se goleste nimic. Dupa „Continua”, un semn in sessionStorage (`draft-continue.ts`) face formularul sa sara o data peste „Continui sau incepi din nou?” (altfel „Incepe una noua” ar fi sters chiar ciorna aleasa). (2) Pe celalalt dispozitiv, o salvare care primeste 404 (`DRAFT_TOKEN_INVALID`, tokenul a fost inlocuit) opreste salvarile automate si reincercarile si arata „Ciorna a fost continuata pe alt dispozitiv… Deschide-o din «Cererile mele» → «Ciorne»”; ce e pe ecran ramane, nu se porneste alta ciorna. (3) Butoanele „Continua” / „Sterge” au nume accesibile distincte (de ex. „Continua ciorna: Bucatarie, Baie · salvata acum 1 ora”).

**Rationale: **Modificarile netrimise din browser se pierdeau fara avertisment; pe celalalt dispozitiv un 404 arata „Ciorna salvata doar pe acest dispozitiv” si se reincerca la fiecare schimbare; cititorul de ecran auzea „Continua, Sterge, Continua…”.

**Impact: **`my-drafts-list.tsx`, nou `components/configurator/draft-continue.ts`, `configurator-wizard.tsx` (`sendDraft`); cheile `Requests.drafts.*`, `Configurator.draft.continuedElsewhere` / `openMyDrafts`. Completeaza D-E7-11.

### D-E8-1. Comutatorul m / cm / mm ramane; clientul vede unitatea lui, firma mereu centimetri (2026-11-13, PO c4-1)

**Decizie: **Comutatorul m / cm / mm din campurile camerelor ramane. Formularul, Fisa cererii, Sumarul si pagina cererii ii arata clientului unitatea aleasa de el; firma (piata, detaliul, fisa de lucru) vede mereu centimetri. Un singur formatator: `apps/frontend/src/lib/dimension-format.ts` (`formatDimension`, `formatDimensions`, `formatDimensionRange`; intrare in metri, virgula in romana, punct in engleza, „×” intre valori, fara zecimale inutile, `NaN` → „—”; precizia: D-E8-35).

**Rationale: **Raspunsul PO (altfel decat recomandarea „doar centimetri”): clientul vede unitatea aleasa peste tot; firma vede tot cm, ca sa compare cererile usor. Valorile se salvau deja in metri, deci e doar afisare.

**Impact: **`room-answer-summary.tsx`, `review-rail.tsx`, `room-spec-card.tsx` (`audience` → `'cm'` la firma), `step-renderer.tsx` (legenda, valorile de pe schita, intervalul), `piece3d/config-chips.ts`. Cererile vechi se afiseaza corect fara migrare. Detalii: D-E8-9, D-E8-10. docs/03 4.1.

### D-E8-2. Un singur nume: „Proiectare cu plata”, cu drumul descris de PO (2026-11-13, PO i1-1)

**Decizie: **Numele ramane „Proiectare cu plata” / „Paid design” (fara „Proiectare platita”, „Proiectare cu plata inclusa”, „Include proiectare cu plata”, „Ajutor la proiectare”, „contra cost”); textele spun drumul: „Firmele iti trimit intai pretul proiectarii si ce include; apoi alegi firma cu care proiectezi piesele.” „cu proiectantul” → „cu firma”.

**Rationale: **Raspunsul PO: „fiecare firma o sa vina mai intai cu un raspuns legat de pretul proiectarii si ce include dupa care clientul alege cu ce firma merge mai departe”. Textul trebuie sa fie adevarat azi (D-E8-16).

**Impact: **`Configurator.start.DESIGN_HELP.*`, `cart.designHelp*`, `review.designHelp*`, `review.facts.helpRooms`, `sheet.withDesigner`, `Requests.designHelpIncluded*`, `Marketplace.includesPaidDesign` (fragmentul `e8-words`). `docs/glosar.md`.

### D-E8-3. Ecranul firmei se numeste „Cereri disponibile” (2026-11-13, PO i1-2)

**Decizie: **Firmele: „Cereri disponibile” / „Available requests” (meniu, titlul paginii, e-mailuri — CTA „Vezi cererile disponibile”); clientul: „cererea ajunge la firmele din zona” (nu „trimiti cererea in marketplace”). Adresa `/marketplace` si cheile raman.

**Rationale: **Raspunsul PO (recomandarea): fara englezisme; meniul firmei se schimba.

**Impact: **`Nav.marketplace`, `Marketplace.title`, `Configurator.review.subtitle`, `review.loginToPublishHint`, `notification-emails.service.ts`. Eticheta starii: D-E8-17.

### D-E8-4. „Cerere” pana la acceptare, „comanda” dupa; „plata” la platile firmei (2026-11-13, PO i1-3)

**Decizie: **„cerere” / „request” pana la acceptarea unei oferte (niciodata „comanda” inainte); „comanda” / „order” dupa acceptare (in locul lui „lucrare” / „proiect” pentru acelasi lucru — de ex. „Comanda livrata”, starea `CANCELLED` afisata „Comanda anulata”); in portofel si facturare „plata” / „payment” in locul lui „comanda” („Plati si facturi”, butonul „Primeste datele de transfer”, e-mailul „Plata {ref}…”).

**Rationale: **Raspunsul PO (recomandarea): clar pentru client — a acceptat, deci a comandat; la platile firmei „comanda” ar fi amestecat doua lucruri.

**Impact: **`Fulfillment.*`, `Lifecycle.*`, `Requests.statusValue.*`, `Billing.*`, `Marketplace.wallet.*`, e-mailurile de livrare si de transfer. Exceptie: D-E8-14 (referinta „Comanda {ref}”), D-E8-22.

### D-E8-5. Firma vede „Dimensiuni orientative” cand clientul n-a schimbat dimensiunile 3D (2026-11-13, PO d2-1)

**Decizie: **Clientul nu are pas in plus. Pe fisa firmei, langa pilulele piesei 3D, insigna „Dimensiuni orientative — clientul nu le-a modificat” (`config3d.dimsOrientative`), doar pentru firma (`audience="company"`). Cum se calculeaza: D-E8-11.

**Rationale: **Raspunsul PO (recomandarea „marcam orientativ la firma”): firma nu mai ia dulapul de 240 × 240 × 60 cm de pornire drept alegerea clientului.

**Impact: **`piece3d/config-chips.ts` (`config3dDimsUntouched`), `room-spec-card.tsx` (`data-config3d-dims-orientative`).

### D-E8-6. Dulapul porneste cu usi, comoda TV cu sertare (2026-11-13, PO d2-2)

**Decizie: **Piesele noi (si „De la capat”) pornesc dintr-o configuratie noua, `initialPieceConfig(kind)` (shared `piece3d/config.ts`): dulapul cu usi batante pe toate zonele, comoda TV cu un rand de sertare; „Push” scris cand piesa are fronturi. `defaultPieceConfig` ramane neschimbat (il folosesc fixturile si instantaneele). Interpretarea exacta: D-E8-12.

**Rationale: **Raspunsul PO (recomandarea): ce vede clientul corespunde cu ce ajunge la firma (inainte dulapul pornea fara nicio usa, dar cu „Batante” aprins; comoda TV doar cu zone deschise).

**Impact: **`configurator3d-step.tsx` (montarea fara raspuns si `config3d.reset`), test nou `piece3d/initial-config.test.ts` (curatarea nu scoate nimic, `defaultPieceConfig` neschimbat). Ciornele existente isi pastreaza configuratia.

### D-E8-7. „Push” lasat pe implicit se salveaza si se puncteaza (2026-11-13, PO d2-3)

**Decizie: **O piesa 3D cu fronturi (usi sau sertare) pentru care clientul n-a ales deschiderea primeste in configuratia salvata `frontStyle: 'PUSH'`; firma vede „deschidere push” si sistemul PUSH, care intra in costul in credite (2 puncte de sistem, adica pana la 2 credite in plus). O piesa fara fronturi nu salveaza nicio deschidere. Cum se aplica ciornelor: D-E8-13.

**Rationale: **Raspunsul PO (recomandarea): ce vede firma si ce plateste se potrivesc; piesele cu fronturi devin cu 1–2 credite mai scumpe.

**Impact: **Nou `piece3d/front-style.ts` (`withFrontStyleRule`), aplicat dupa `normalizePieceConfig` in `configurator3d-step.tsx`. Codul de derivare din fluxuri (v3, v4, catalog) NEATINS: derivau deja PUSH din `frontStyle: 'PUSH'`. docs/03 4.1, docs/04.

### D-E8-8. Pe telefon, „Publica cererea” sta in bara lipita jos (2026-11-13, alegere marunta din plan, fara PO — se poate schimba)

**Decizie: **Pe telefon, in Sumar, butonul „Publica cererea” sta intr-o bara lipita jos, nu urca cardul de publicare inaintea raspunsurilor. Aceeasi bara (`StickyActionBar`, sub `lg`; de la `lg` ca inainte) si pe ecranele de intrebari, in cos, la fisiere si la Date generale.

**Rationale: **Butonul e mereu la indemana, iar clientul vede raspunsurile inainte sa publice. Bara e `sticky`, nu `fixed` (cardul e intr-un container cu `transform`), si nu acopera finalul paginii.

**Impact: **Nou `components/configurator/sticky-action-bar.tsx` (atributul `data-sticky-action-bar`); `room-flow-runner.tsx`, `room-cart-step.tsx`, `uploads-step.tsx`, `details-step.tsx`, `review-step.tsx`. Felul in care se randeaza un singur buton: D-E8-23.

### D-E8-9. Unitatea clientului pe pagina cererii vine din browser (2026-11-14, D1 din proiectul etapei, aprobata de coordonator; de confirmat de PO)

**Decizie: **Unitatea nu se salveaza pe cerere. Preferinta sta in `localStorage['cozy.dimensionUnit']` (`lib/dimension-unit.ts`: `useDimensionUnitPreference`, `rememberDimensionUnit`; implicit `'cm'`, tot `'cm'` pe server si la hidratare); comutatorul o scrie si in store, si in browser; dupa revizuire si unitatea din formular (inclusiv cea tinuta in ciorna) se scrie ca preferinta (D-E8-36). Pe alt dispozitiv clientul vede cm.

**Rationale: **Varianta mica; varianta mare (coloana pe cerere) cere migrare si nu era in plan.

**Impact: **`RoomSpecCard audience="client"` pe pagina cererii. docs/04 (fara coloana noua).

### D-E8-10. Ce ramane in metri; 3D-ul ramane in centimetri (2026-11-14, D2 din proiectul etapei; de confirmat de PO)

**Decizie: **(a) Metrii liniari de mobilier (`roomSpec.furnitureLinear`), lungimea aproximativa (`approxLength.*`, scrisa in m in formular) si preturile „lei pe metru liniar” raman in metri, si la firma — sunt lungimi de mobilier, nu dimensiuni. (b) Pasul 3D ramane mereu in cm (intervalele si pasii lui sunt in cm), nu urmeaza comutatorul.

**Rationale: **Schimbarea lor ar schimba numerele pe care firmele le folosesc la pret si ar cere alte intervale in 3D.

**Impact: **`room-spec-card.tsx`, `piece3d/dimension-control.tsx`. Completeaza D-E8-1.

### D-E8-11. „Dimensiuni orientative” calculat la afisare, fara coloana noua (2026-11-14, D3 din proiectul etapei; de confirmat de PO)

**Decizie: **Insigna apare cand latimea, inaltimea si adancimea piesei sunt exact cele de pornire — fie din `initialPieceConfig`, fie din `defaultPieceConfig` (ca sa prinda si cererile vechi). Nimic nu se salveaza; serverul nu se schimba.

**Rationale: **Varianta mica. Cost: un client care alege intentionat exact dimensiunile de pornire e marcat „orientativ”. Varianta cu marcaj salvat cere camp nou in payload si o nota in `request_items.description` — doar daca PO o vrea.

**Impact: **`config3dDimsUntouched(kind, config)` in `piece3d/config-chips.ts`. Completeaza D-E8-5.

### D-E8-12. Pornirea dulapului si a comodei TV — interpretare (2026-11-14, D4 din proiectul etapei; de confirmat de PO)

**Decizie: **Dulap: zonele `OPEN` devin `DOOR` cu aceeasi umplutura; sertarele raman. Comoda TV: fiecare coloana `[{ type: 'DRAWERS', count: 1 }]`. Doar pentru piesele noi, nu pentru ciorne. (b) „Batante” apare ales doar cand piesa are cel putin o usa (`configHasDoors`); fara usi, niciuna din „Batante / Glisante” nu e aleasa.

**Rationale: **Cea mai mica schimbare care face piesa sa arate ce i se spune clientului, fara sa piarda interiorul ales.

**Impact: **`initialPieceConfig` (shared), `piece3d/front-style.ts` (`configHasDoors`), `configurator3d-step.tsx`. Completeaza D-E8-6; abaterea la butonul „Batante”: D-E8-25. Studio 3D NU foloseste `initialPieceConfig` (D-E8-40).

### D-E8-13. „Push” scris de interfata, si la ciornele redeschise (2026-11-14, D5 din proiectul etapei; de confirmat de PO)

**Decizie: **Regula din D-E8-7 se aplica la fiecare schimbare facuta de om in pasul 3D si, pe CIORNE, la deschiderea pasului pe o configuratie salvata care o incalca (ciornele vechi, toate versiunile) — costul acestor ciorne urca cu 1–2 credite. La editarea unei cereri publicate corectia automata la deschidere NU ruleaza (D-E8-34). Alegerea clientului („Cu maner”) se pastreaza in intentia pasului si revine cand fronturile revin. Cererile PUBLICATE nu se recalculeaza; la ele doar Sumarul / pagina cererii / fisa afiseaza „Push” cand lipseste si piesa are fronturi.

**Rationale: **Fara sa atingem fluxurile inghetate, singurul loc sigur e configuratia scrisa de interfata; recalcularea cererilor publicate ar schimba costul unor preluari deja platite.

**Impact: **`withFrontStyleRule(kind, cleaned, intent)`; `config3dChipItems` (lipsa = Push la afisare). Completeaza D-E8-7. Efect cunoscut, lasat asa dupa revizuire (de confirmat de PO): pe cererile publicate inainte de etapa 8, firma vede pe pilule „Deschidere: Push”, dar descrierea salvata a piesei nu pomeneste deschiderea, iar costul n-a inclus sistemul PUSH.

### D-E8-14. Referinta de plata „Comanda {ref}” ramane (2026-11-14, D6 din proiectul etapei; de confirmat de PO)

**Decizie: **Referinta din datele de transfer bancar (`Billing.bankTransfer.referenceValue` = „Comanda {ref}” / „Order {ref}”, si in e-mail) ramane neschimbata; restul textelor de plata spun „plata”.

**Rationale: **Adminul o cauta in extrasul bancii; firmele care au platit deja au folosit-o.

**Impact: **Exceptie in `glossary.test.ts`. Completeaza D-E8-4. Nefacut dupa revizuire (de confirmat de PO): pe panoul de transfer „Plata #{ref}” sta langa „Comanda {ref}”; o nota scurta langa referinta („scrie exact acest text in ordinul de plata”) ar lamuri, dar cere o cheie noua si cod.

### D-E8-15. Ecranele de administrare raman in afara glosarului (2026-11-14, D7 din proiectul etapei; de confirmat de PO)

**Decizie: **Textele `Admin*` nu au trecut prin glosar („SLA” si celelalte raman acolo); anglicismele de la admin sunt la problema 55 (`i2`).

**Rationale: **Texte interne, citite doar de admin; problema 42 era despre client si firma.

**Impact: **Exceptie in `glossary.test.ts`; `docs/glosar.md`.

### D-E8-16. Textul proiectarii cu plata spune doar ce e adevarat azi (2026-11-14, D8 din proiectul etapei; de confirmat de PO)

**Decizie: **Textele spun: oferta firmei are pretul proiectarii si ce include (pe randuri separate), iar clientul alege firma. Nu promit un pas separat in care firmele raspund doar cu pretul proiectarii inainte de oferta — acest pas nu exista azi; cat din drumul PO se construieste ramane intrebare deschisa.

**Rationale: **Un text care promite un pas inexistent ar insela clientul.

**Impact: **Cheile din D-E8-2.

### D-E8-17. Eticheta starii `IN_MARKETPLACE`: „Disponibila firmelor” (2026-11-14, D9 din proiectul etapei; de confirmat de PO)

**Decizie: **`Requests.statusValue.IN_MARKETPLACE` se afiseaza „Disponibila firmelor” / „Open to companies” (inainte „In marketplace”). Doar eticheta; valoarea din date (`requests.status`) ramane `IN_MARKETPLACE`.

**Rationale: **Alegere mica, aliniata cu D-E8-3.

**Impact: **`ro.json` / `en.json`. docs/03 4.20.

### D-E8-18. „lei” si in engleza (2026-11-14, D10 din proiectul etapei; de confirmat de PO)

**Decizie: **In texte se scrie „lei”, si in interfata in engleza (aliniat cu `formatLei`); „RON” ramane doar in codurile de moneda. Daca PO prefera „RON” in engleza, se schimba doar EN.

**Rationale: **O singura forma; sumele afisate cu `formatLei` scriau deja „lei” in engleza (etapa 3).

**Impact: **~36 de chei EN schimbate (`e8-words`, numarate aproximativ de agent). Dupa revizuire `LandingV2.materialsScaleMax` = „{max} lei/m liniar” / „{max} lei/linear m” (inainte „lei/ml” / „RON/lm”).

### D-E8-19. Plafoanele afisate sunt cele existente (2026-11-14, D11 din proiectul etapei; de confirmat de PO)

**Decizie: **„Alta piesa”: cantitatea ≤ 999 (limita din `requestItemSchema`; „Cel mult 999 de bucati.”, plural ICU dupa revizuire), cel mult 10 piese (`maxPieces`; „Adauga piesa” dezactivat, „Cel mult 10 piese.”); „Mesaj pentru firme” ≤ 5.000 (`maxLength` pe camp + contor). Nicio limita noua; doar se arata cele care existau.

**Rationale: **Clientul afla limita inainte sa fie refuzat.

**Impact: **`step-renderer.tsx` (`PieceRows`, `PieceRowsV2`), `details-step.tsx`; chei `Configurator.pieces.maxReached`, `pieces.quantityMax`, `Requests.messageCounter`, `Requests.messageHint`.

### D-E8-20. Lista scurta din Sumar (2026-11-14, D12 din proiectul etapei; de confirmat de PO)

**Decizie: **Cardul camerei din Sumar arata scurt: piesele, materialele, deschiderile, configuratia 3D, dimensiunile si pasii primului ecran (`importance: 'main'` in `buildSummaryRows`); „Vezi toate raspunsurile” adauga doar restul (`'extra'`) si nu apare cand n-ar ascunde nimic. Lista exacta de pasi „main”: D-E8-29.

**Rationale: **Inainte lista extinsa repeta tot ce era deasupra, iar materialele si deschiderile apareau doar in lista completa. Daca PO vrea dimensiunile doar in lista completa, se muta dintr-o lista.

**Impact: **`summary-rows.ts`, `review-room-card.tsx` (`data-review-room-more`), `room-answer-summary.tsx` (prop `only`).

### D-E8-21. „Piese individuale” vs „Alta piesa” — neliniate (2026-11-14, R5 din proiectul etapei; de confirmat de PO)

**Decizie: **Tipul de camera `Requests.roomType.PIECES` („Piese individuale”) si „Alta piesa” din configurator raman cu nume diferite; alinierea la „Alta piesa” nu s-a facut (nu era in plan si n-a fost confirmata de coordonator).

**Rationale: **Titlul generat pe server foloseste numele; schimbarea doar in interfata ar fi partiala.

**Impact: **Niciunul in etapa 8. De hotarat de PO.

### D-E8-22. Exceptiile glosarului; textele juridice `Legal.*` neschimbate (2026-11-14, aleasa de agentul glosarului, de confirmat de PO)

**Decizie: **Raman neschimbate: (1) textele juridice `Legal.*` (Termeni — „Cozy Home este un marketplace…”, „detaliile proiectului”; Reguli pentru firme — „revine in marketplace”; EN „slot”); (2) „la comanda” cu sensul „facut pe masura” („Mobilier la comanda”); (3) cheile si codurile (`IN_MARKETPLACE`, `SLA_*`, `/marketplace`); (4) „lucrare” cu alt sens (`Quotes.workSubtotal` — subtotalul manoperei; „montajul e o lucrare in sine”); (5) EN „in this order” (`Configurator.cart.basketNext`); (6) „proiect” unde inseamna continutul cererii („Camerele proiectului”) sau proiectul tehnic („Am deja un proiect”); (7) textele generate in `packages/shared` pentru firma (inghetate; nu contin termenii interzisi).

**Rationale: **Textele juridice sunt versionate si acceptate de utilizatori; o schimbare cere o versiune noua a documentelor si o noua acceptare — hotararea de a le schimba la versiunea urmatoare e a PO.

**Impact: **Lista de exceptii pe chei in `apps/frontend/src/messages/glossary.test.ts`; `docs/glosar.md` (sectiunea „Exceptii”).

### D-E8-23. Un singur buton „Publica” si un singur fel de comparare, alese dupa latimea ecranului (2026-11-14, abatere a agentului de la proiectul etapei, aprobata de coordonator; de confirmat de PO)

**Decizie: **In loc de doua butoane „Publica cererea” (unul ascuns cu CSS pe telefon, altul pe desktop) si de tabel + carduri amandoua in pagina, se randeaza UN singur element, ales cu `useMediaQuery` (`components/ui/use-media-query.ts`: `BELOW_LG` = `(max-width: 1023.98px)` pentru Sumar, `BELOW_SM` = `(max-width: 639.98px)` pentru comparare; pe server si la hidratare = desktop).

**Rationale: **Doua elemente cu acelasi nume in pagina strica testele (`getByRole` / `getByText`, in jsdom ambele sunt „vizibile”) si e2e-urile care cauta `exact`. Pretul: la prima incarcare pe telefon apare o clipa asezarea de desktop.

**Impact: **`review-step.tsx`, `app/[locale]/_components/offers-comparison.tsx` (`data-compare-rubric`). Completeaza D-E8-8.

### D-E8-24. Pe telefon, in Sumar, si „Inapoi” sta in bara (2026-11-14, aleasa de agent, de confirmat de PO)

**Decizie: **Pe telefon „Inapoi” se muta din coloana din stanga in bara lipita, langa „Publica cererea”. Un cont de firma sau de admin (care nu poate publica) are in bara doar „Inapoi”; nota „Cererile se publica dintr-un cont de client” ramane in card. La fisiere cu proiect propriu, „Nu am proiectul la indemana” sta pe primul rand al barei, pe toata latimea. In `Tabs` cu `scrollable`, fila aleasa e adusa in vedere doar pe orizontala.

**Rationale: **Pe telefon coloana din stanga vine dupa toate camerele; „Inapoi” ar fi fost la capatul paginii.

**Impact: **`review-step.tsx`, `uploads-step.tsx`, `components/ui/tabs.tsx`.

### D-E8-25. „Batante” apasat pe un dulap fara usi pune usi (2026-11-14, aleasa de agent, de confirmat de PO)

**Decizie: **Daca piesa nu are nicio usa, apasarea pe „Batante” transforma zonele deschise in usi batante, cu acelasi interior (`withHingedDoors`), ca la pornirea dulapului.

**Rationale: **Altfel butonul n-ar face nimic vizibil (doar ar schimba felul usilor, fara usi).

**Impact: **`piece3d/front-style.ts`, `configurator3d-step.tsx`. Completeaza D-E8-12.

### D-E8-26. Totalul de ecrane apare doar cand e sigur (2026-11-14, aleasa de agent, de confirmat de PO)

**Decizie: **Antetul arata „Ecranul {current} din {total}” (`nav.screenOf`) doar cand totalul nu se mai poate schimba, altfel „Ecranul {current}” (`nav.screenOnly`) si fara bara de progres. Regula (`screenTotalKnown` in `dimension-check.ts`): o intrebare fara raspuns conteaza doar daca poate adauga sau scoate un ECRAN; un pas dependent care sta in acelasi ecran (`screenGroup`) cu un pas vizibil, neconditionat de intrebari fara raspuns, nu conteaza. Raspuns „gol” = `undefined`, `''` sau `[]`. Efect: bucataria si dulapul au totalul de la inceput, dormitorul dupa ecranul pieselor.

**Rationale: **Regula din proiect luata literal („orice pas de care depind altii are raspuns”) facea ca si „Altul” → campul text sa ascunda totalul de la inceput, contrar rezultatului cerut. Numaratoarea nu mai sare („07/20” → „07/22”).

**Impact: **`room-flow-runner.tsx` (`data-screen-counter`). In Fisa se numara altceva, cu eticheta: „{done} din {total} raspunsuri obligatorii” (`sheet.progress`); camera pliata „cateva intrebari” (`sheet.someQuestions`, si in cos); cheile `sheet.sections`, `sheet.progressLabel` scoase.

### D-E8-27. „Adresa montajului” ca titlu de sectiune si ca eticheta de camp (2026-11-14, aleasa de agentul glosarului — INLOCUITA dupa revizuire de D-E8-37)

**Decizie: **`Requests.sectionAddress` si `Requests.field.addressText` sunt ambele „Adresa montajului” / „Installation address”; in Date generale acelasi text apare de doua ori (titlul sectiunii si eticheta campului).

**Rationale: **Asa cere glosarul (un nume pentru un lucru); e2e-urile cauta campul dupa eticheta, care ramane unica intre campuri.

**Impact: **`ro.json` / `en.json`. Dupa revizuire campul din formular are eticheta proprie „Strada si numar” (D-E8-37); `Requests.field.addressText` = „Adresa montajului” ramane pe pagina cererii.

### D-E8-28. Mesajele de validare: cazurile nescrise in plan (2026-11-14, alese de agenti, de confirmat de PO)

**Decizie: **(1) Mesajul de raspuns lipsa dupa tip (`requiredMessageKey` in `room-screens.ts`): alegere / da-nu → `validation.chooseOne`, mai multe → `validation.minOneOption`, piese → `validation.minPieces`, text si NUMAR → `validation.fillThisField`, dimensiuni → `validation.dimensionsMissing` (cu `{count}`; pe fiecare camp `validation.fillField` cu `{field}` — dupa revizuire „Completează câmpul „{field}”.”, ca sa nu iasa dezacordat), 3D / fisiere → `validation.answerRequired` (ramane). (2) Doar valori in afara intervalului → rezumatul de jos e textul existent `validation.dimensionOutOfRange`. (3) In lista problemelor de la Sumar (`roomIssue`), o camera fara dimensiuni spune `validation.dimensionRequired`, fara numar. (4) „Alta piesa” v1: mesajele fara prefix ale randului devin `validation.pieceRow.{name|quantity|dimension}` cu `{row}` (inainte „Raspunsul nu are formatul asteptat”). (5) Date generale: email / telefon gol (schema da `contactEmailInvalid` / `contactPhoneInvalid`) → `Requests.validation.contactRequired`; adresa / judetul goale → `addressRequired` / `countyRequired`; orasul gol foloseste cheia existenta `cityRequired` (etapa 7). (6) Sesiunea expirata la publicare: `UNAUTHORIZED`, `SESSION_SUPERSEDED` sau 401 → `review.sessionExpired` + „Intra in cont” spre `/login?redirect=<pagina>&reason=expired`.

**Rationale: **Planul numea doar cazurile principale; fiecare caz ramas avea nevoie de un text care spune ce lipseste.

**Impact: **`room-screens.ts` (`validateStepIssue`, `StepIssue`), `step-renderer.tsx`, `details-step.tsx`, `review-step.tsx`. docs/ERROR_CODES.md.

### D-E8-29. Ce pasi intra in lista scurta din Sumar (2026-11-14, aleasa de agent, de confirmat de PO)

**Decizie: **„main” = `pieces`, `configurator-3d`, `dimension-group`, pasii primului ecran al camerei si id-urile `material*`, `frontMaterial*`, `separateFrontMaterials`, `openingSystems*`, `systems*`, `sameFinish*`, `liftUp*`, `doorType`, `wardrobeDoorType`; pasii de fisiere intra la „extra”. Etichetele scurte au ca rezerva titlul intrebarii; cheile `common.finish.*.summaryLabel` si `common.otherMaterial.summaryLabel` stau sub `common.*`.

**Rationale: **Materialul si deschiderea sunt ce cauta firma intai; testul pe tot `FLOW_REGISTRY` verifica `main ∪ extra` = tot, disjuncte, si etichete ≤ 40 de caractere.

**Impact: **`summary-rows.ts` (+`.test.ts`). Completeaza D-E8-20.

### D-E8-30. Mobilierul 3D nu primeste regula „Push” (2026-11-14, aleasa de agent, de confirmat de PO)

**Decizie: **Patul, masa, canapeaua, lavoarul si mobilierul de hol din 3D (`isFurnitureKind`) nu primesc si nu pierd `frontStyle`: au deschiderea lor sau deloc.

**Rationale: **Regula „are fronturi → Push” e definita pentru corpuri (zone cu usi / sertare).

**Impact: **`withFrontStyleRule` (iesire timpurie). Completeaza D-E8-7.

### D-E8-31. Unitatea clientului si pe antetul vechi; fisierele numarate fara imaginile 3D (2026-11-14, alese de agent, de confirmat de PO)

**Decizie: **(1) Pe pagina cererii, unitatea clientului se aplica si antetului vechi „L × l × H” (camerele din formularul manual) si tavanului (`roomSpec.ceiling` = „Tavan: {value}”, in locul lui `roomSpec.ceilingHeight`). (2) Randul „Fisiere” din Fisa numara fisierele cererii fara imaginile 3D generate; la 0: „optional” fara proiect propriu, „obligatoriu” cu proiect propriu.

**Rationale: **Aceeasi regula ca restul dimensiunilor clientului; imaginile 3D nu sunt fisiere urcate de client.

**Impact: **`room-spec-card.tsx`, `review-rail.tsx` (prop `filesCount`, `data-sheet-files`), `configurator-wizard.tsx`.

### D-E8-32. Imaginea 3D o singura data pe pagina cererii (2026-11-14, reparatia observatiei O4 din verificarea in browser a etapei 7)

**Decizie: **Pe pagina cererii (client), imaginea 3D a piesei apare doar in cardul piesei, nu si ca miniatura in „Atasamente” — aceeasi regula ca in cardul din Sumar, mutata in `room-snapshot.ts`. Fisierul ramane unul singur pe cerere.

**Rationale: **Verificarea a vazut acelasi fisier de doua ori; „o singura imagine pe piesa” (D-E7-22) inseamna si ce vede omul.

**Impact: **Nou `components/configurator/room-snapshot.ts`; `app/[locale]/requests/[id]/page.tsx` (+test).

### D-E8-33. Motorul spune „Completeaza toate dimensiunile” pentru un slot lipsa (2026-11-14, pasii planului b9 + proiectul etapei)

**Decizie: **In `engine.ts` (`stepAnswerSchema`, cazul `dimension-group`) slotul lipsa da `validation.dimensionRequired` („Completează toate dimensiunile.”); tipul gresit / `NaN` si valorile in afara intervalului dau, ca inainte, `validation.dimensionOutOfRange`. Singura schimbare in motor; scorul si textele pentru firma nu depind de ea (instantaneele neschimbate).

**Rationale: **Un camp gol primea acelasi mesaj ca o valoare prea mare.

**Impact: **Ajunge si in `CONFIGURATOR_ANSWERS_INVALID.details[].messageKey` la publicare / editare. Verificarea separata din `configurator.service.ts` (camera cu dimensiune derivata 0) ramane `validation.dimensionOutOfRange`. docs/ERROR_CODES.md.

### D-E8-34. „Push” automat doar pe ciorne; la editare doar cand omul schimba piesa (2026-11-14, dupa revizuirea de cod — M1 cod)

**Decizie: **Corectia automata de la deschiderea pasului 3D (`withFrontStyleRule` la montare) ruleaza doar pe ciorne. La editarea unei cereri publicate configuratia ramane cea publicata; „Push” se scrie abia cand omul schimba ceva la piesa (prin `apply`). Semnul vine din store (`isInEditSession()`), fara prop nou.

**Rationale: **Editarea reface calculul de marime la salvare: o cerere publicata cu un bufet lasat pe implicit, editata doar la material, ar fi urcat 1–2 credite (si si-ar fi refacut imaginea 3D si descrierea), chiar si la editarea de dupa preluare, cand firma platise deja dupa costul vechi.

**Impact: **`piece3d/configurator3d-step.tsx` (`fixSavedConfig`); test nou `configurator3d-step-edit.test.tsx` (editare fara atingere: `onChange` neapelat, imaginea „fresh”; editare cu schimbare: Push aplicat; ciorna: imaginea devine „stale” si se reface). Schimba D-E8-13. docs/03 4.1.

### D-E8-35. Precizia afisarii = precizia campului din formular (2026-11-14, dupa revizuirea de cod — m1 cod)

**Decizie: **`DIMENSION_DECIMALS` = `{ m: 4, cm: 4, mm: 4 }` (cat accepta campul, `useDecimalField`), zerourile de la coada taiate: „45,55 cm” arata la fel in camp, in Fisa, in Sumar si la firma; o valoare peste limita se vede exacta („600,04 cm — de corectat”); „1234,5 mm” ramane. 3D-ul lucreaza la 0,1 cm si pilulele lui raman cu o zecimala.

**Rationale: **Cu o zecimala, „600,04 cm” aparea „600 cm — de corectat”, desi intervalul spunea „…–600 cm”.

**Impact: **`lib/dimension-format.ts` (+ test). Doar afisare; nimic rotunjit nu se scrie inapoi. Completeaza D-E8-1.

### D-E8-36. Unitatea din formular e si preferinta pentru pagina cererii (2026-11-14, dupa revizuirea de cod — m2 cod)

**Decizie: **Runner-ul scrie unitatea din store (inclusiv cea tinuta in ciorna sau aleasa inainte de etapa 8) ca preferinta (`rememberDimensionUnit`), doar cand difera de `readDimensionUnit()`. Pagina cererii arata aceeasi unitate ca Fisa si Sumarul.

**Rationale: **Cheia `cozy.dimensionUnit` se scria doar la clic pe comutator; un client care alesese „m” in iulie vedea „m” in formular si „cm” pe pagina cererii.

**Impact: **`room-flow-runner.tsx` (+2 teste). Completeaza D-E8-9.

### D-E8-37. Campul de adresa se numeste „Strada si numar” (2026-11-14, dupa revizuirea textelor — m2 texte)

**Decizie: **In Date generale campul de adresa are eticheta „Stradă și număr” / „Street and number” (cheie noua `Requests.field.street`); titlul sectiunii ramane „Adresa montajului” (`Requests.sectionAddress`), iar `Requests.field.addressText` = „Adresa montajului” ramane eticheta adresei intregi pe pagina cererii.

**Rationale: **Titlul sectiunii si campul de imediat sub el aveau acelasi text.

**Impact: **`address-autocomplete.tsx` (`label={t('field.street')}`); de adus la zi e2e-urile care cauta campul dupa `field.addressText` cu `exact: true` (`helpers/guided-request.ts`, `etapa7.spec.ts`). Inlocuieste D-E8-27.

### D-E8-38. La editare ultimul pas se numeste „Verifica si salveaza” (2026-11-14, dupa revizuirea textelor — m5 texte)

**Decizie: **In modul de editare, in bara de pasi (wizard si Fisa), pasul `review` se numeste „Verifică și salvează” / „Review and save” (cheie noua `Configurator.edit.phaseReview`); la o cerere noua ramane „Verifică și publică”. `edit.saveHint` = „Nimic nu se schimbă până nu apeși „Salvează modificările”, la ultimul pas.”

**Rationale: **La editare nu se publica nimic; butonul de acolo salveaza.

**Impact: **`configurator-wizard.tsx`, `review-rail.tsx` (`isInEditSession()`). `docs/glosar.md`.

### D-E8-39. „Proiectare cu plata” si in dialoguri, validari si bifa din cos; exceptia titlului de pornire (2026-11-14, dupa revizuirea textelor — M1 texte)

**Decizie: **Variantele „ajutor” ramase pentru proiectarea cu plata sunt inlocuite: dialogul de comutare (`designHelpSwitch.{titleAll,titleRoom,confirm,kept,body}` — „Da, cer proiectare cu plată”, iar corpul spune si drumul platit), `validation.designHelpWithOwnProject` / `designHelpWithStudioPiece`, `cart.legacyPaidDesign`, bifa din cos `cart.designHelpRoom` = „Proiectare cu plată pentru camera asta”. Exceptie: titlul cartonasului de pornire `Configurator.start.DESIGN_HELP.title` („Nu știu exact ce vreau — am nevoie de ajutor”) ramane — descrie situatia clientului, iar insigna de sub el spune „Proiectare cu plată”. Testul glosarului prinde acum si tiparele RO `cer(i) ajutor`, „bifa de ajutor”, „debifezi ajutorul” si EN „ask for help”, „help box”, „untick the help”, plus „proiect / project” in cheile de dupa acceptare (de ex. `Marketplace.apiErrors.PROJECT_*` → „comandă”).

**Rationale: **Clientul putea confirma „Da, cer ajutor” fara sa vada ca serviciul e platit (PO i1-1: un singur nume).

**Impact: **Fragmentul `e8-words`, `glossary.test.ts`, `docs/glosar.md`. Completeaza D-E8-2, D-E8-4, D-E8-22.

### D-E8-40. Studio 3D porneste in continuare piesele din configuratia veche (2026-11-14, constatare a revizuirii de cod — m4; lasata asa, de confirmat de PO)

**Decizie: **Studio (`components/studio/studio-page.tsx`) foloseste in continuare `defaultPieceConfig`: un dulap adaugat din Studio porneste cu zone deschise (fara usi, „Batante” neales), comoda TV fara sertare — spre deosebire de configurator (D-E8-6). „Push” se scrie totusi la montarea pasului 3D, deci costul ramane coerent cu ce se vede.

**Rationale: **Studio nu era in lista de fisiere a etapei 8; schimbarea (`initialPieceConfig` la alegerea tipului) e mica, dar ramane hotararea PO.

**Impact: **Niciunul in etapa 8. Completeaza D-E8-12.

# 9. Checklist uman: ce faci acum

- Citește integral acest document o dată. Verifică Decisions Log (Secțiunea 8, inclusiv 8.4). Dacă o decizie te deranjează, schimb-o ACUM în document, înainte ca agentul să scrie cod.

- Nu mai există [PROPUNERE] sau [DECIZIE NECESARĂ] deschise — documentul e complet.

- Creează monorepo-ul (D-v6-14) și commit-uiește: docs/PRODUCT_BIBLE_MASTER_V6.docx.

- Deschide chat nou cu coding agentul (Claude Code). Copiază MASTER PROMPT (Secțiunea 6) ca prim mesaj, cu acest document atașat.

- Așteaptă Sprint 0 (fără cod). Revizuiește schema, STATE_CONVENTIONS.md, ERROR_CODES.md, seed-ul de scoring ȘI câmpurile formularului de cerere. Corectează aici, nu după Sprint 5.

- La fiecare sprint, verifică manual checklistul de acceptare folosind seed scenarios ca scripturi de test live.

- Dacă vrei să schimbi o regulă, schimb-o în acest document, apoi spune agentului „citește din nou, secțiunea X s-a schimbat”. Nu da instrucțiuni de schimbare direct în chat fără update.

*Succes la build. Un document master coerent valorează săptămâni de refactor și de neînțelegeri evitate.*
