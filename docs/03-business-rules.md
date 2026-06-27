<!-- Product Bible Master v6 — Reguli business consolidate. Sursa de adevar. Ierarhie la conflict: invariante (02) > decisions log (07) > reguli business (03). Nu ghici: marcheaza DECIZIE NECESARA si opreste-te. -->

# 4. Reguli business consolidate

*Toate deciziile (refinement v5 + finale v6) sunt INTEGRATE direct în reguli. Rationale-ul fiecărei decizii e în Secțiunea 8.*

## 4.1 Formular cerere

Formular generic structurat pe camere și piese. Câmpuri (derivate din categoriile de scoring, 4.5): pentru fiecare cameră — tip (bucătărie/dressing/living/birou/dormitor/baie) + dimensiuni; pentru fiecare piesă — material (PAL/MDF/lemn masiv), sisteme (push/glisante/buton presiune), descriere, cantitate; plus buget orientativ, termen dorit, atașamente (max 10), localitate + adresă (geocoded).

- Opțiunea „Am deja un proiect” — clientul atașează proiectul propriu.

- **Opțiunea „Proiectare contra cost” (D-v6-11): **flag pe cerere (requests.includes_paid_design BOOLEAN DEFAULT FALSE). Firma include în ofertă o linie separată de preț (quote_versions.design_fee, nullable). NU există flux de plată separat în MVP — design fee face parte din oferta acceptată.

- Draft anonim cu token — clientul poate începe fără cont; cererea e nepublicată și recuperabilă.

**CONFIRMAT (D-v6-2): **câmpurile exacte ale formularului se finalizează de către agent în Sprint 0, împreună cu seed-ul de scoring, și se prezintă utilizatorului pentru revizuire. Structura de mai sus e baza obligatorie.

## 4.2 Partajare date contact (CONFIRMAT, D-v6-1)

Clientul alege cum și când se partajează datele de contact către firmele cu claim. Stocat în request_contact_preferences; enforce la nivel API (datele nu sunt servite firmelor decât conform opțiunii alese). Cele 5 opțiuni confirmate:

- (1) Doar chat în aplicație, fără telefon/email.

- (2) Nume + chat, fără telefon/email.

- (3) Telefon + email după ce firma dă claim.

- (4) Telefon + email doar după acceptarea unei oferte.

- (5) Partajare completă imediat la publicare.

## 4.3 Editare cerere

- Maximum 3 edit-uri pre-claim.

- Maximum 1 edit post-claim, dar înainte de primirea ofertei.

- La edit post-claim: scoringul se recalculează (4.5), dar consumul de credite al fiecărui claim rămâne pe snapshot-ul original; firma afectată primește notificare și poate cere refund/anulare (motiv auto-aprobat REQUEST_MODIFIED_POST_CLAIM, 4.15).

- requests.last_edit_at se actualizează la fiecare edit (folosit de validările de anulare).

## 4.4 Expirare și repost

- O cerere publicată fără claim expiră după 5 zile lucrătoare (calendar Europe/Bucharest, 3.3).

- Reminder la clientul cererii la 3 zile lucrătoare.

- Repost permis o singură dată (manual, de către client).

- **Re-publicare după ratare SLA în masă (D-v6-13): **cererea revenită IN_MARKETPLACE primește un NOU ceas de expirare de 5 zile lucrătoare de la re-publicare și NU consumă repost-ul manual al clientului.

## 4.5 Mărimea proiectului — scoring configurabil

Sistemul calculează automat mărimea (SMALL/MEDIUM/LARGE) din alegerile clientului. Fiecare opțiune are puncte; suma cade într-un prag care determină categoria.

- ProjectSizingService.calculate(requestData) → {score, size}, rulat la submit și la fiecare edit pre-claim; salvat pe request (project_score, project_size).

- La claim: snapshot înghețat pe claim_slot (project_score_snapshot, project_size_snapshot, claim_cost_credits_snapshot). Firmele care au dat claim înainte de un edit nu sunt afectate de recategorisire.

- Praguri + cost claim în credite per mărime: project_size_thresholds (configurabil din Admin, fără deploy).

**Seed cost claim (D-v6-5): **SMALL = 1 credit, MEDIUM = 2 credite, LARGE = 4 credite. Valorile sunt seed inițial în project_size_thresholds.claim_cost_credits, ajustabile din Admin.

**Sprint 0: **Agentul propune un seed inițial de categorii + puncte (camera × dimensiune, material PAL/MDF/lemn masiv, sisteme push/glisante/buton presiune etc.), pe care utilizatorul îl revizuiește. Punctele se ajustează ulterior din Admin Settings.

## 4.6 Verificare firmă și risk flags

- La onboarding firma completează profilul (date firmă: denumire, CUI, J Reg.Com., adresă, portofoliu).

- Risk flags calculate automat: rating sub prag, număr mic de reviews, lipsă portofoliu. Adminul vede flag-urile dar poate aproba manual oricum.

- Status firmă: PENDING_VERIFICATION → APPROVED / REJECTED. Firmele neverificate (ne-APPROVED) NU văd cereri.

- La REJECTED: blocaj 3 luni pe CUI și email înainte de reaplicare.

- Firmă APPROVED poate fi SUSPENDED automat la atingerea pragului de penalizare (4.12).

## 4.7 Echipă și roluri

- company_members leagă useri de firmă cu rol: OWNER, MANAGER, EMPLOYEE_TRUSTED, EMPLOYEE_MANAGED.

- EMPLOYEE_MANAGED NU face claim direct. Owner/manager/trusted dă claim și opțional îl atribuie unui managed.

- Claim-ul e tehnic al firmei (creditele aparțin firmei); atribuirea e o relație separată, reasignabilă: claim_slots.claimed_by_user_id (cine a apăsat) + assigned_to_user_id (cine lucrează acum, nullable).

## 4.8 Claim, credite și arie de acoperire

- Maximum 3 firme pot da claim unei cereri (enforce cu lock-ul din 3.1).

- La claim se rezervă credite (credit_transaction RESERVE), cost = claim_cost_credits per mărimea proiectului (snapshot, 4.5; seed 1/2/4).

- Refund la editare cerere post-claim sau la anulări valide (4.15). Creditele se consumă definitiv conform regulilor de anulare/finalizare.

- Eligibilitate la claim: firmă APPROVED + abonament activ (SubscriptionActiveGuard) + credite suficiente + arie de acoperire îndeplinită + gating-ul planului (4.10) deja deschis + firma NU e în request_company_exclusions pentru cererea respectivă.

**Arie de acoperire (D-v6-10): **fiecare company_location are coverage_radius_km (NUMERIC, default seed 50). O cerere este eligibilă pentru firmă dacă distanța Haversine dintre adresa cererii și cel puțin O locație a firmei ≤ coverage_radius_km al acelei locații. Filtrul rulează în SQL (3.8).

## 4.9 Regula „1 claim activ fără ofertă” + manager

- Regula se aplică pe assigned_to_user_id dacă există, altfel pe claimed_by_user_id: o persoană nu poate avea simultan 2 claim-uri active fără ofertă trimisă. Constraint UNIQUE WHERE status='ACTIVE' AND quote_id IS NULL pe assigned_to_user_id.

- **Cap manager: **managerul poate avea claim-uri neatribuite simultan ≤ numărul de angajați liberi. Validare: count(activeUnassignedClaimsByManager) + 1 ≤ count(workersWithoutActiveUnofferedClaim). Managerul se numără și el ca worker disponibil.

- **Atribuire în 1h (oră calendaristică, 3.3): **BullMQ delayed job la +1h; dacă assigned_to = NULL → auto-cancel (status CANCELLED_UNASSIGNED) + refund + notificare. Warning la +30 min.

- **Atribuire eșuată: **dacă angajatul țintă are deja claim activ fără ofertă → eroare ASSIGNED_USER_HAS_ACTIVE_CLAIM.

- **Self-assign manager: **managerul poate face claim pentru el însuși; devine assigned_to și consumă slotul lui personal (1 claim activ fără ofertă, ca orice angajat). Un claim self-assigned e imediat assigned, deci nu consumă bugetul de claim-uri neatribuite.

## 4.10 Gating per plan abonament

- La publicarea cererii, vizibilitatea per firmă = published_at + delay-ul planului: Platinum +0 min, Gold +30 min, Silver +60 min. Stocat configurabil în subscription_plans.marketplace_gating_delay_minutes.

- Transparență: firma vede DOAR timpul scurs de la publicare („publicată acum X”), fără mențiuni despre alte planuri. CTA-ul de upgrade stă pe dashboard/pagina de prețuri, nu pe cardul cererii.

## 4.11 SLA (mapare CONFIRMATĂ, D-v6-4)

- **Durată SLA: **SMALL = 3 zile lucrătoare; MEDIUM = 3 zile lucrătoare; LARGE = 5 zile lucrătoare. Materializat în claim_slots.sla_deadline_at la momentul claim-ului.

- Grace period 12h (calendaristice) peste deadline înainte de penalizare.

- O clarificare cerută firmei (clarification_requests) pune SLA pe pauză și adaugă +1 zi lucrătoare (sla_paused_at + recalcul via worker).

- **Ratare SLA individuală: **oferta/claim-ul expiră, firma primește penalizare (4.12).

- **Toate cele 3 firme ratează SLA: **claim-urile expiră, fiecare firmă primește 3 puncte penalizare, cererea revine IN_MARKETPLACE pentru alte firme cu un nou ceas de expirare de 5 zile lucrătoare (D-v6-13), clientul e notificat. Cele 3 firme care au ratat sunt EXCLUSE de la re-claim pe această cerere (request_company_exclusions). Re-publicarea NU consumă repost-ul clientului.

## 4.12 Penalizări (praguri CONFIRMATE, D-v6-6)

- Puncte de penalizare se aplică atât per angajat (scope EMPLOYEE), cât și per firmă (scope COMPANY).

- Fiecare penalty_event expiră INDIVIDUAL la 180 zile de la applied_at (fereastră rolling). Pragurile se evaluează ca SUM(points) cu expires_at > now().

| **Abatere** | **Puncte** |
| --- | --- |
| Ofertă expirată / SLA ratat individual | 3 |
| Toate cele 3 firme ratează SLA | 3 (fiecare firmă) |
| Retragere claim voluntară fără motiv (după grația de 30 min) | 2 |

**MVP conține DOAR cele 3 abateri de mai sus. **Alte tipuri de abateri se adaugă post-MVP exclusiv din Admin Settings (tabel penalty_rules configurabil: rule_key, points, is_active), fără deploy.

- **Prag firmă: **12 puncte active (scope COMPANY) → firma devine SUSPENDED 6 luni. Configurabil în system_settings (company_penalty_threshold=12, company_suspension_months=6).

- **Prag angajat (NOU): **9 puncte active (scope EMPLOYEE) → angajatul e BLOCAT 3 luni de la claim și de la atribuire (nu poate fi assigned_to). Firma rămâne funcțională. Configurabil în system_settings (employee_penalty_threshold=9, employee_block_months=3). Eroare la atribuire către angajat blocat: ASSIGNED_USER_PENALTY_BLOCKED.

## 4.13 Ofertă și versiuni

- Hard limit 3 versiuni înlănțuite: v1 = ofertă inițială; v2 = răspuns la modificarea #1; v3 = răspuns la modificarea #2. O modificare consumă slot DOAR dacă firma răspunde cu versiune nouă.

- Dacă firma refuză modificarea (quote_change_requests REJECTED), slotul nu se consumă, dar clientul nu poate cere aceeași modificare din nou.

- Retragerea unei oferte: permisă în 1 zi (lucrătoare).

- **Valabilitate ofertă (D-v6-7): **fiecare quote_version are valid_until = trimitere + 14 zile calendaristice (default, configurabil în system_settings: quote_validity_default_days=14). Firma poate seta explicit o valoare diferită la trimitere, în limitele permise de Admin.

- **Moneda ofertei (D-v6-12): **firma alege moneda ofertei: RON sau EUR (quotes.currency ENUM, default RON). Clientul vede AMBELE valori, conversia folosind cursul fix configurabil (1 EUR = 5.2 RON). Suma contractuală rămâne cea în moneda aleasă de firmă; conversia e doar informativă în UI și PDF.

**După v3 (block UI cu 3 opțiuni): **(a) a 4-a variantă voluntară, peste limită (tracking quotes.extra_versions_count); (b) invitație la sediu pentru consultanță fizică (physical_consultation_invites); (c) „închei negocierea online”.

- **Expirare invitație consultanță (D-v6-8): **dacă clientul nu răspunde în 7 zile calendaristice de la creare → status EXPIRED (physical_consultation_invites.expires_at = created_at + 7d; BullMQ job; configurabil: consultation_invite_expiry_days=7). Firma e notificată la expirare și poate retrimite o invitație nouă.

**„Închei negocierea online”: **chat read-only pentru firmă ȘI client (chat_threads.negotiation_ended_by_company=TRUE). Clientul poate totuși accepta o ofertă existentă sau cere invitație la sediu (revine un buton).

**Mesaj client la limită: **„Firma a trimis deja 3 variante. Nu are obligația să-ți mai trimită alte variante online. Poți accepta una din variantele existente sau o invitație la sediul firmei pentru consultanță fizică.”

**Reofertare la expirare — 2 butoane: **Buton A „Păstrez aceleași date” extinde valid_until cu N zile (default 14, configurabil), NU e versiune nouă, NU consumă slot, audit în quote_validity_extensions; max 2 extensii × 14 zile = +28 zile maxim. Buton B „Modifică” = versiune nouă, consumă slot; dacă sunt deja 3 → block-ul de mai sus.

**Permisiuni câmpuri ofertă: **matrice configurabilă per firmă (company_offer_field_permissions: company_id, role, field_key, can_edit). Câmpuri: PRICE, DELIVERY_TERM, DELIVERY_DATE, WARRANTY, DESCRIPTION. Default seed la onboarding firmă: owner/manager pot orice; trusted poate orice mai puțin PRICE; managed read-only. Owner-ul ajustează matricea.

**Audit preț: **modificarea prețului e o versiune nouă cu audit log standard, FĂRĂ workflow suplimentar de aprobare (prețul e deja protejat la nivel de rol prin matrice).

## 4.14 Chat și upload

- Chat-ul există DOAR după claim (thread auto-creat la claim).

- După acceptarea unei oferte: chat-ul cu firma câștigătoare rămâne ACTIVE pentru execuție; chat-urile cu firmele nealese devin read-only IMEDIAT.

- Upload în chat conform flow-ului din 3.4 (presigned, scan, limite).

## 4.15 Anulare și retragere claim

Anularea cu refund se auto-aprobă dacă motivul e în lista predefinită (cu validare automată). Motive custom → aprobare admin (SLA 48h calendaristice, fără auto-decizie). Tabel: claim_withdrawals. Toate ceasurile de mai jos sunt ore calendaristice (3.3).

| **reason_type** | **Validare automată / efect** |
| --- | --- |
| CLIENT_UNRESPONSIVE_48H | messages.last_client_message_at > 48h → AUTO_APPROVED + refund. |
| REQUEST_MODIFIED_POST_CLAIM | requests.last_edit_at > claim_slots.created_at → AUTO_APPROVED + refund. |
| CLIENT_CONTACT_INVALID | log bounce email automat sau upload dovadă → AUTO_APPROVED + refund. |
| CLIENT_REQUESTED_CANCELLATION | confirmare client în chat (quick reply) → AUTO_APPROVED + refund. |
| VOLUNTARY_NO_REASON | < 30 min de la claim: refund integral + 0 penalizare; ≥ 30 min: fără refund + slot eliberat + 2 puncte. |
| CUSTOM | PENDING_ADMIN_REVIEW; slot rămâne ocupat; reminder la 48h; ADMIN_APPROVED (refund) / ADMIN_REJECTED. |

**Client șterge cererea în timpul claim-ului: **soft delete cerere (deleted_at); claim-urile → CANCELLED_BY_CLIENT; refund automat la firme; eveniment + notificare.

## 4.16 Abonamente, credite, trial

- Planuri Silver / Gold / Platinum. Seed configurabil: Silver 149 RON / 15 credite; Gold 399 RON / 50 credite; Platinum 899 RON / 120 credite. Stocat în subscription_plans (price_ron, included_credits).

- Top-up credite: credit_packages — 10 credite = 100 RON, 50 = 400 RON, 100 = 700 RON (discount progresiv). POST /credits/purchase cu Idempotency-Key.

- Creditele rămân valabile 3 luni după expirarea abonamentului.

- Trial firme noi: 1 lună Gold gratuit + 10 credite, activat la admin approve, toggleable din Admin (subscriptions.is_trial + trial_ends_at; system_settings: trial_enabled, trial_plan, trial_duration_days, trial_bonus_credits).

## 4.17 Facturare (mock, conformă RO)

Factura mock generată local (PDF), cu structură conformă Codului Fiscal RO. Seller-ul este platforma (facturezi firmele pentru abonamente/credite).

- Date furnizor (seller) configurabile în Admin: denumire, CUI/CIF, J Reg.Com., sediu, IBAN (snapshot pe mock_billing_orders.seller_snapshot).

- Numerotare secvențială SERIE-NUMĂR (serie continuă, obligatoriu legal): mock_billing_orders.invoice_series + invoice_number, prin secvență dedicată per serie.

- TVA standard RO = 21% (din 1 aug 2025), stocat configurabil în system_settings (snapshot vat_rate pe factură). Câmpuri: bază impozabilă + valoare TVA + total, monedă RON.

- Conținut: serie+număr, dată, furnizor, client, descriere serviciu, baza+TVA+total.

## 4.18 Review și dispute

- Review-ul e posibil DOAR după livrare confirmată de client (COMPLETED).

- Review sub 3 stele → automat DISPUTED (review_disputes), gestionat de admin.

- Tranziția spre COMPLETED: firma marchează DELIVERED_BY_COMPANY → clientul confirmă → COMPLETED → review activ.

## 4.19 Admin

- Un singur rol ADMIN (fără sub-roluri în MVP).

- Adminul intră în chat DOAR în dispute (nu în chat-urile normale client-firmă).

- Gestionează: firme, verificări (approve/reject + risk flags), cereri, claim-uri, credite, abonamente, penalizări (inclusiv penalty_rules), dispute, audit log viewer, settings, jobs.

## 4.20 Limbă și i18n

- RO + EN complet: switcher în UI, string-uri key-based prin next-intl (ambele locale populate: ro.json + en.json).

- Emails și PDF urmează users.language_preference (ENUM RO/EN, default RO).

- Errors: coduri mapate la mesaje în ambele locale; UI nu folosește message direct decât ca fallback.

## 4.21 GDPR și audit

- Soft delete pe PII (3.12), anonimizare via UserAnonymizationService.

- Audit log append-only enforced prin trigger DB pe audit_logs (3.9); restul entităților application-level.
