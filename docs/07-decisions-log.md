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

### Î3. Transparență gating

**Decizie: **C — doar „publicată acum X”, fără mențiuni despre planuri.

**Rationale: **Onest, creează FOMO fără a frustra firmele Silver plătitoare.

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

# 9. Checklist uman: ce faci acum

- Citește integral acest document o dată. Verifică Decisions Log (Secțiunea 8, inclusiv 8.4). Dacă o decizie te deranjează, schimb-o ACUM în document, înainte ca agentul să scrie cod.

- Nu mai există [PROPUNERE] sau [DECIZIE NECESARĂ] deschise — documentul e complet.

- Creează monorepo-ul (D-v6-14) și commit-uiește: docs/PRODUCT_BIBLE_MASTER_V6.docx.

- Deschide chat nou cu coding agentul (Claude Code). Copiază MASTER PROMPT (Secțiunea 6) ca prim mesaj, cu acest document atașat.

- Așteaptă Sprint 0 (fără cod). Revizuiește schema, STATE_CONVENTIONS.md, ERROR_CODES.md, seed-ul de scoring ȘI câmpurile formularului de cerere. Corectează aici, nu după Sprint 5.

- La fiecare sprint, verifică manual checklistul de acceptare folosind seed scenarios ca scripturi de test live.

- Dacă vrei să schimbi o regulă, schimb-o în acest document, apoi spune agentului „citește din nou, secțiunea X s-a schimbat”. Nu da instrucțiuni de schimbare direct în chat fără update.

*Succes la build. Un document master coerent valorează săptămâni de refactor și de neînțelegeri evitate.*
