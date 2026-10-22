# Triajul celor 86 de intrebari deschise (open-items.json) — 2026-10-18

**Urmatoarea actiune:** raspunde la b5-b9 in pagina de checklist (https://claude.ai/artifact/581ttEfCNctq8oMeQUdgLQ); fiecare are deja un default sigur in cod, deci lipsa raspunsului nu blocheaza nimic. (~20 min)

Stare: 86 intrebari in `open-items.json` (`decisions[]`), fiecare cu default-ul livrat in cod (`def`). Raspunsurile tale din pagina de checklist (2026-10-03): a1 date seller, a2 email = Mailpit deocamdata, a3 Termeni = amanat pana la avocat, a4 curatenie = vrei lista, a5 backup = dump manual, b0 e-Factura = export lunar manual, b1-b4 = „pastreaza default-ul”. b5-b9 si c1-c7 nu au raspuns.

Rezultat: **38 inchise** (35 prin b1-b4 + 3 prin datele tale), **8 cu default sigur fara intrebare in checklist** (nu cer nimic acum), **40 inca deschise** (33 asteapta b5-b9, 7 depind de pasii C10-C18 de lansare).

## 1. Inchise prin b1-b4 („pastreaza default-ul”) — 35, nimic de facut

<details><summary>b1 Pricing si credite — 12 intrebari (E-admin-platform-58, E-admin-platform-14, E-admin-platform-15, E-company-21, E-company-9)</summary>

- E-admin-platform-58: pricing-ul rundei 4 NU e scris in docs/07; planurile sunt date (`subscription_plans` + `subscription_plan_features`), comportamentul = cele 3 planuri de azi. Limitele costului de claim raman `claim_cost_min=1`, `claim_cost_max=0` (fara plafon). Fara billing recurent Stripe (ramane `payment` + 30 zile). Plan gratuit doar prin grant de admin (`POST /admin/subscriptions/grant`). Acces marketplace = flag `MARKETPLACE_ACCESS` per plan (true la SILVER/GOLD/PLATINUM). Unelte (Ofertare Rapida, AI) neinregistrate.
- E-admin-platform-14: `project_size_thresholds.credit_cost` e doar nullable (DROP COLUMN intr-un release ulterior); docs/07 si docs/03 §4.8 raman nemodificate, conflictul e notat in CHANGELOG.
- E-admin-platform-15: portofel „drifted” → fara eliberare partiala; tranzitia slotului se comite, `credit='SKIPPED_WALLET_DRIFT'`, verificarea zilnica a registrului alerteaza adminii.
- E-company-21: creditele NU expira in cod (docs/03 4.16 ramane cu nota DECIZIE NECESARA); costul unui claim = formula de azi.
- E-company-9 (Q1): pagina de reguli nu spune nimic despre valabilitatea creditelor.
</details>

<details><summary>b2 Cererea ramane deschisa dupa prima oferta? — 3 intrebari (E-admin-platform-10)</summary>

- Optiunea B ramane (prima oferta inchide claim-urile; invarianta 3.1 neschimbata). Optiunea A exista sub `system_settings.claims_open_after_first_offer='false'`.
- Fara fereastra protejata pentru claimanti tarzii (fiecare slot isi tine SLA-ul; la accept slotul ACTIVE primeste REFUND).
- Textele de landing („pana la 3 oferte”) raman.
</details>

<details><summary>b3 Proiect anulat dupa acceptare — 6 intrebari (E-admin-platform-3)</summary>

- Creditele castigatorului: doar adminul decide, explicit, REFUND sau CONSUME (`POST /admin/requests/:id/close` + nota obligatorie).
- Anularea de comun acord NU inchide automat; adminul e notificat si inchide.
- Oferte expirate fara decizie: worker-ul exista dar e OPRIT (`expired_offer_autoclose_enabled=false`, `_days=14`, `_credit_outcome=UNSET`).
- Fara penalizare la expirarea valabilitatii ofertei. Fara reminder inainte de expirare (doar notificarea `quote.expired` in momentul expirarii). Fara actiunea „Am inceput executia”.
</details>

<details><summary>b4 Reguli pe partea firmei — 11 intrebari (E-company-1, E-company-2, E-company-3, E-company-6)</summary>

- E-company-1: retragere = OWNER/MANAGER oricand; alt membru doar daca e claimedBy/assignedTo si in cele 30 min de gratie; „marcheaza livrat” = doar OWNER/MANAGER (restul 403). EMPLOYEE_TRUSTED nu primeste drepturi in plus.
- E-company-2: retragerea ofertei cand asignatul are alt claim fara oferta → 409 `ASSIGNED_USER_HAS_ACTIVE_CLAIM`; extend-validity si withdraw dupa SLA raman ca azi.
- E-company-3: contactele se vad la claim (`claim_contact_reveal_policy='ON_CLAIM'`; `AFTER_GRACE` disponibil din Admin); refund pe „cerere modificata” pana cand firma trimite oferta pe versiunea modificata, fara limita de ore; refundul 48h ramane permis si dupa oferta (cu conditia de contactare); retentia contactelor dupa finalizare = `completed_claim_contact_retention_days=0` (fara limita); docs/07 nu e editat.
- E-company-6: dupa retragerea ofertei, SLA-ul se re-armeaza la termenul existent (dialogul spune cat a ramas; dupa termen + 12h cere `acknowledgeSlaBreach:true`); firma NU isi poate anula retragerea in verificare la admin.
</details>

<details><summary>Inchise prin a2 (email = Mailpit deocamdata) — 2 intrebari (E-admin-platform-1 Q3, Q4)</summary>

- Reply-To `SUPPORT_EMAIL` doar pe emailurile de cont/firma/plata (lista opt-in in cod), nu pe chat/oferte/claim; footer-ul de suport apare pe toate cand `SUPPORT_EMAIL` e setat.
- `security.txt`: Contact = `NEXT_PUBLIC_SUPPORT_EMAIL`, Expires = build + 180 zile, fara Policy; 404 cat timp emailul lipseste.
</details>

## 2. Inchise cu datele tale — 3, devin pasii B5 si B6 din checklist

- E-admin-platform-2 Q1+Q2: operatorul = vanzatorul de pe factura = aceeasi firma (CNC HOME SOLUTIONS, platitoare de TVA); datele complete (CUI, J, sediu, IBAN, email de contact) sunt in raspunsul a1 din pagina de checklist, NU in repo (repo-ul e public). Se introduc in Admin → Setari (seller_*, `legal_contact_email`), apoi `legal_identity_published=true`.
- E-admin-platform-4 Q1: e-Factura = **export lunar manual** (`GET /admin/billing/e-invoice-export?month=YYYY-MM` + PATCH pe comanda cu ce a facut contabilul in SPV). Fara SmartBill/ANAF OAuth.

## 3. Default sigur, fara intrebare in checklist — 8, nu cer nimic acum

- E-company-9 Q2: regulile pentru firme NU sunt document versionat (fara re-acceptare).
- E-admin-platform-4 Q2: facturile vechi cu seller placeholder raman; sunt `e_invoice_status=PENDING` in export, contabilul decide storno.
- E-admin-platform-8 Q3+Q4: politica de confidentialitate numeste procesatorii generic („furnizorul nostru de monitorizare a erorilor”); logurile stau doar in Railway, retentia planului (7 zile pe Hobby).
- E-client-9 Q4: `LEGAL_PRIVACY_VERSION` ramane 2026-09-29 (nu a fost inca deployata).
- E-company-19 Q1+Q2: facturile fara `buyer_snapshot` raman pe citire live; statutul de platitor TVA al firmei = auto-declarat (prefix RO + PATCH /companies/me).
- E-company-24: reminder/anulare pentru transfer bancar = `bank_transfer_reminder_days=0`, `bank_transfer_expiry_days=0` (oprite; se pornesc din Admin → Setari cand vrei).

## 4. Deschise — asteapta raspunsul tau la b5-b9 (33); in paranteza, ce se intampla daca nu raspunzi

<details><summary>b5 Confidentialitate client + flux cerere — 9 intrebari</summary>

- E-admin-platform-45: telefon/email in text liber → MASCAT pentru firme (`pre_claim_contact_text_policy=MASK`; alternativa BLOCK = 400 la publish). Admin NU poate marca fals-pozitive (lista read-only).
- E-client-9: distanta in km intregi (`marketplace_distance_display=KM`; BAND disponibil); raza minima de acoperire 2 km (`MIN_COVERAGE_RADIUS_KM`); max 10 locatii/firma si 20 schimbari/24h (`company_locations_max`, `company_location_changes_per_day`).
- E-client-2: bucket implicit de buget `UNDER_5K` si pentru DESIGN_HELP; camerele cu 0 m sunt respinse doar unde dimensiunile sunt obligatorii, altfel „Dimensiuni nespecificate”.
- E-client-3: la logout scenele Studio raman (se sterge doar `accountDraft`); cererea EXPIRED cu repost folosit nu se mai editeaza/duplica (link la cerere noua).
</details>

<details><summary>b6 Oferte — 3 intrebari (E-client-1)</summary>

- Fara campuri TVA/termeni de plata pe oferta (doar hint `Quotes.acceptConfirmVatHint` in dialogul de accept).
- Se accepta DOAR ultima versiune (altfel 409 `QUOTE_VERSION_CHANGED`); `accepted_version_id` e stocat, deci regula se poate relaxa fara migrare.
- Acceptarea ramane permisa cu o cerere de modificare PENDING.
</details>

<details><summary>b7 Furnizori backup / monitorizare — 10 intrebari (E-admin-platform-6, E-admin-platform-8)</summary>

- Backup off-site: cod agnostic (orice S3 via rclone, `OFFSITE_S3_*`); NU ruleaza pana nu alegi furnizorul (C14). Uploads raman pe MinIO. RTO propus 4 h (RPO 24 h). `BACKUP_REPORT_TO` obligatoriu + escrow chei (2 copii) — de completat de tine. Retentie 30 zilnice + 12 lunare, cu regula de re-aplicare a stergerilor dupa restore. Dead-man switch `BACKUP_HEARTBEAT_URL` optional.
- Error tracker: integrare Sentry-protocol OPRITA pana setezi `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (C15). Analytics: `lib/analytics.ts` OPRIT pana setezi `NEXT_PUBLIC_ANALYTICS_*`. Uptime: spec in docs/08 (`/api/v1/health/ready`), contul il creezi tu. Panoul ops admin (cozi/outbox) NU e construit — pachet nou daca il vrei.
</details>

<details><summary>b8 Perimetru productie — 6 intrebari (E-admin-platform-56, E-admin-platform-5, E-admin-platform-6)</summary>

- Domeniile publice ale sloturilor raman (codul merge si fara ele; runbook „Slot domains private” in docs/08) — C17.
- Header IP real: `TRUSTED_CLIENT_IP_HEADER` nesetat (comportamentul de azi; test de spoof + setare pe ambele sloturi = c3).
- Throttler: `THROTTLER_STORE=redis` cu fallback in memorie; poti pune `memory` pana la migrarea in UE (C18).
- Poze inspiratie: CSP larg (`https:`) pana setezi `NEXT_PUBLIC_STORAGE_ORIGIN` + allowlist.
- Branch protection pe main: comanda `gh api` in docs/08, de rulat de tine (repo public → gratuit).
- GitHub secret scanning + push protection: setare in GitHub → Settings → Code security, de pornit de tine.
</details>

<details><summary>b9 Default-uri mici de confirmat — 5 intrebari</summary>

- Admin blocat dupa 5 incercari (restul 10) in 15 min — dezvaluie ca un cont e admin; o constanta daca vrei 10.
- Adminii nu re-accepta Termenii; gate-ul legal e doar in UI (backend-ul doar calculeaza flagul). Oricum, re-acceptarea e OPRITA pentru conturile existente (`legal_reaccept_existing_users=false`) pana la avocat.
- Firma suspendata pierde accesul la proiectele in curs (text neutru pe pagina de reguli).
- Pagina de reguli nu mentioneaza zilele-punte (textul zice doar weekend + sarbatori legale).
</details>

## 5. Deschise — depind de pasii C de lansare (7)

- C10 email real: domeniul + furnizorul UE (E-admin-platform-1 Q1), cutia `SUPPORT_EMAIL` si cine o citeste (Q2), numele furnizorului SMTP in politica de confidentialitate (E-admin-platform-2 Q4; azi text generic).
- C13 Stripe: `STRIPE_ALLOW_TEST_MODE` doar pe staging izolat; comenzile test nu primesc numar de factura (E-admin-platform-4 Q3) — ok ca default, de confirmat cand pui cheile live.
- C16 avocat: revizuirea Termenilor/Politicii + textul despre procesatori/transferuri (E-admin-platform-2 Q5) si a paginii „Reguli pentru firme” (E-company-9 Q3); abia apoi `legal_reaccept_existing_users=true`.
- C18 regiune UE: textul din Politica spune „bazele de date pot fi in afara SEE, cu clauze contractuale standard” (E-admin-platform-2 Q3); se simplifica dupa migrare.

## Cum se inchide o intrebare

1. Bifezi/raspunzi in pagina de checklist (b5-b9) sau imi scrii decizia in chat.
2. Daca schimba o regula: intrare in `docs/07-decisions-log.md` (append-only) + schimbarea valorii in Admin → Setari (majoritatea sunt chei `system_settings`, fara deploy).
3. Daca cere cod nou (ex. panou ops, Optiunea A protejata, campuri TVA pe oferta): pachet nou in plan, nu modificare in zbor.
