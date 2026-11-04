# Plan: migrarea datelor de productie in EU West (aliniere regiuni)

Data planului: 2026-09-17 · Stare: PROPUS (decizie PO: "migrare in EU, mai tarziu") · Executie: fereastra de mentenanta anuntata

## De ce

Incidentul din 2026-09-17 (publish → 500 `INTERNAL_ERROR`, Prisma P2028) a aratat ca sloturile aplicatiei (`app-blue`, `app-green`) si gateway-ul (`backend`, `gateway`) ruleaza in **EU West**, in timp ce stiva de date din iulie (`Postgres`, `Redis`, `minio`, `mailpit`) a ramas in **alta regiune**. Fiecare query plateste ~150 ms (cel mai rapid GET din API = 150 ms; autosave-ul draftului 1,6-2,7 s; RTT masurat din Romania la Postgres ~185 ms, fata de ~80 ms la `green-storage` din EU). Hotfixul de cod (timeout 20 s + scrieri batch) a scos publicarea din zona de esec, dar latenta ramane in fiecare pagina. Clientii si firmele sunt in Romania, deci datele trebuie sa stea in EU West, langa aplicatie.

Alternativa respinsa de PO pentru moment: mutarea celor 4 servicii fara stare in regiunea bazei de date (schimbare de `Region` din dashboard, fara migrare de date) — ar readuce latenta la <5 ms imediat, dar ar tine datele in afara EU.

## Ce exista deja in EU West

| Rol | Serviciu EU (exista) | Serviciu vechi (alta regiune) |
|---|---|---|
| PostgreSQL | `green-postgres` (folosit pentru preview-ul izolat; DB `green_preview`) | `Postgres` (productia, PG 18.6, 38 migrari) |
| Redis (BullMQ + Socket.IO adapter) | `green-redis` | `Redis` |
| Storage S3 (MinIO) | `green-storage` (bucket privat `green-preview`) | `minio` (bucket-ul din `S3_BUCKET`) |
| SMTP sink | `green-mail` (Mailpit, fara UI publica) | `mailpit` (UI publica cu basic auth) |

Serviciile EU au fost create pentru preview-ul scris (docs/implementation/form-studio-acceptance.md) si contin DOAR date sintetice → se **golesc si se refolosesc**; nu se transfera nimic din preview.

## Ce trebuie migrat si ce nu

- **PostgreSQL — DA, integral** (`pg_dump` custom format → `pg_restore` in `green-postgres`). Versiunea Postgres a serviciului EU trebuie sa fie >= cea a sursei (18.6) sau se recreeaza `green-postgres` cu aceeasi imagine; `pg_restore` intre versiuni majore diferite merge doar in sus.
- **Storage — DA, obiectele bucket-ului de productie** (`mc mirror` din `minio` in `green-storage`, in acelasi nume de bucket sau cu `S3_BUCKET` schimbat). Cheile din tabela `attachments.storage_key` (si pozele de inspiratie) raman valabile daca bucket-ul pastreaza structura.
- **Redis — NU se migreaza**. Starea din Redis e reconstruibila: `ReconciliationProcessor` re-inarmeaza la boot toate termenele din DB (expirare cereri, claim-assign, SLA, validitate oferte, consultatii, autocomplete livrare, remindere retrageri — vezi logul "reconciliere: termene re-inarmate"), evenimentele de domeniu sunt in `domain_event_outbox` (DB), idempotenta in `idempotency_keys` (DB). Singura pierdere posibila: joburi `uploads` (scanare) in curs → fisierele raman `PENDING_SCAN`; se verifica dupa migrare (`attachments` cu status `PENDING_SCAN` mai vechi de 10 min → re-trimise la scanare sau confirmate manual).
- **Mail — NU** (Mailpit e sink de test; la SMTP real, doar variabile).
- **Secrete** — NU se copiaza in clar nicaieri; se seteaza direct pe serviciile Railway (`railway variables --set`), ca la promovarea din 2026-09-16.

## Pasi (fereastra de mentenanta ~20-30 min, scrieri oprite)

Pregatire (fara oprire, cu zile inainte):
1. Backup complet al productiei prin serviciul `backup-daily` („Run now", docs/08 „Backup si restaurare"): obiectul nou `cozy-prod/db/daily/<stem>.dump.age` (+ `.sha256`, `.manifest.json`) in bucket-ul off-site UE si oglinda `cozy-prod/uploads/`. Optional, o copie locala suplimentara (dump + SHA-256) in checkpoint-ul protejat `test-results/…`, ca la `cozy-preproduction-20260916.dump`.
2. Verifica versiunea PG a `green-postgres`; daca e mai mica decat sursa, recreeaza serviciul cu aceeasi imagine ca `Postgres`. Goleste `green_preview` (sau creeaza DB `marketplace`).
3. **Tinta storage — DECIZIE NECESARA (PO)**: MinIO oficial (`minio/minio` fixat pe digest, in locul `bitnamilegacy/minio` nementinut) in `green-storage`, conform deciziei 8 din docs/07 (MinIO + S3 API + presigned), SAU un S3 gestionat in UE (R2 / B2 / bucket Railway). Codul aplicatiei cere doar `S3_*` (+ regula CORS explicita `PUT`/`GET` de pe domeniul FE pe un S3 gestionat; pe MinIO CORS e global, `MINIO_API_CORS_ALLOW_ORIGIN`). Pe MinIO: `deploy/storage/setup-minio-uploads.sh` pe tinta (bucket privat, cheie `cozy-app-<bucket>` limitata la bucket, cheie read-only `cozy-bkp-<bucket>` pentru backup, versionare, expirarea versiunilor vechi dupa 30 de zile); pe un S3 gestionat, echivalentul providerului (cheie limitata la bucket + versionare/lifecycle unde exista). **Pre-sincronizare**: `mc mirror --overwrite minio/<bucket> green-storage/<bucket>` (poate rula ore; se repeta incremental).
4. Repetitie completa pe o copie: restore in `green-postgres`, porneste **slotul inactiv** (`app-green`, standby) cu `DATABASE_URL`/`REDIS_*`/`S3_*` spre serviciile EU si `RUN_MIGRATIONS=false`; health `db/redis/storage: up`; citiri (liste, detaliu cerere, download presigned) verificate pe URL-ul direct al slotului. Slotul e in standby, deci nu scrie in copia de repetitie.
5. Anunta fereastra (banner/status) si pregateste comenzile.

Fereastra:
6. `app-blue` (activ) → `DEPLOYMENT_MODE=standby` (scrierile primesc 503 `DEPLOYMENT_STANDBY`; citirile merg). Asteapta ~60 s (draining) si confirma ca nu mai exista tranzactii in `pg_stat_activity` in afara de cele idle.
7. Dump final `Postgres` → restore in `green-postgres` (baza goala). Verifica: `_prisma_migrations` = 38, numar utilizatori/cereri/atasamente/notificari identic cu sursa, triggerul append-only pe `audit_logs` prezent.
8. `mc mirror` final (delta) storage; compara numarul de obiecte si un esantion de hash-uri (tinta aleasa la pasul 3).
9. Seteaza pe `app-green` (inactiv) variabilele spre EU: `DATABASE_URL` (green-postgres, privat `railway.internal`), `REDIS_HOST/PORT/PASSWORD` (green-redis), `S3_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET/REGION` (green-storage; `S3_ACCESS_KEY/S3_SECRET_KEY` = cheia limitata `cozy-app-<bucket>`, NU root — boot-ul avertizeaza la credentiale implicite), `SMTP_HOST/PORT` (green-mail sau SMTP real), `RELEASE_SHA` = SHA-ul curent activ (acelasi cod ca Blue). `DEPLOYMENT_MODE=active`, `RUN_MIGRATIONS=false` → redeploy; asteapta `green/active`, health `up` pe toate 3, logul de reconciliere ("termene re-inarmate") prezent.
10. `backend.ACTIVE_UPSTREAM=app-green.railway.internal:3000` → verifica health public (`green/active`), pagina RO, login + refresh, un draft anonim POST/DELETE, un download presigned al unui atasament existent, Socket.IO reconectat.
11. **Masoara**: cel mai rapid GET din `railway logs --service app-green` trebuie sa coboare de la ~150 ms la <20 ms; autosave-ul draftului sub 300 ms.

Dupa (in zilele urmatoare):
12. Seteaza si `app-blue` pe serviciile EU (in standby) ca sa ramana rollback compatibil; **nu** lasa un slot indreptat spre baza veche — doua baze "de productie" sunt o sursa de pierderi de date. In aceeasi fereastra muta si serviciile de backup: `DATABASE_URL` (rolul `backup_reader` recreat pe `green-postgres`) si `SOURCE_S3_*` (cheia read-only a noului storage) pe `backup-daily`, apoi „Run now".
13. Pastreaza `Postgres`/`minio` vechi 7-14 zile ca backup rece (fara trafic), apoi sterge-le impreuna cu `Redis`/`mailpit` vechi (elibereaza si limita de servicii Railway) — DOAR dupa ce exista un backup off-site reusit din baza EU (`backup-daily`) si un test de restaurare OK (`backup-restore-test`, „Run now", email „— OK").
14. Actualizeaza docs/08 (adrese, "stare curenta"), memoria de deploy si `.railway`/runbook-ul cu noile identitati.

## Rollback in fereastra

Cat timp `app-blue` e in standby spre baza VECHE si nu s-a scris nimic in cea noua (sau scrierile de dupa pasul 10 sunt acceptabil de pierdut/re-jucat), rollback = `app-green` → standby, `app-blue` → active, `ACTIVE_UPSTREAM=app-blue.railway.internal:3000`. Dupa ce productia a scris in baza EU, rollback-ul inseamna migrare inversa — de aceea verificarile din pasul 10 se fac INAINTE de a redeschide trafic mare.

## Riscuri / decizii necesare

- **DECIZIE NECESARA**: tinta storage — MinIO oficial fixat pe digest (decizia 8 din docs/07 ramane neschimbata) vs S3 gestionat in UE; uneltele (`deploy/storage/`, `deploy/backup/`) merg cu ambele, se schimba doar env.
- **DECIZIE NECESARA**: versiunea PG a `green-postgres` si numele bucket-ului (pastram `S3_BUCKET` sau trecem pe `green-preview`?). Pastrarea numelui evita orice rescriere de chei.
- Presigned URL-urile emise inainte de switch (max 15 min valabilitate) expira natural; nu e nevoie de compatibilitate cu vechiul endpoint.
- Stripe: webhook-ul `POST /api/v1/webhooks/stripe` ramane pe domeniul public (gateway), nemodificat; comenzile in curs stau in DB (`mock_billing_orders.stripe_checkout_attempt`) si se recupereaza dupa restore.
- Emailurile catre useri reali: daca la momentul migrarii SMTP-ul e inca Mailpit, nimic nu se pierde pentru utilizatori (nu primeau oricum).
