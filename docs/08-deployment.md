# Deployment — MVP public pentru feedback

> Pentru urmatoarea configuratie de productie Blue/Green, foloseste [ADR-001](architecture/ADR-001-blue-green-releases.md) si [runbook-ul operational](implementation/blue-green-release.md). Nu porni doua containere ale aplicatiei curente pe aceleasi cozi fara modul standby.

> Stare curenta 2026-09-16: Green este activ in productie, release `0b6815f94c051f52ab683bc20973088e56ed3ed4`. Domeniul existent este pastrat de serviciul `backend`, acum gateway; `app-blue` pastreaza build-ul Green precedent ca backup compatibil in standby. Detalii, dovezi de backup/migrare si procedura exacta de rollback: [promovarea in productie](implementation/production-promotion-20260916.md).

> Context istoric: adresele si verificarile de mai jos sunt din 2026-07/08, nu dovada unei verificari curente. Implementarea 2026-09-15 nu a fost publicata. Pentru gate-uri, migratii additive si limitele curente, vezi [ledgerul de verificare](implementation/verification.md). Nu rula seed demo pe productie; foloseste numai mediul separat de test/staging.

> Incident 2026-09-17 (publish 500/P2028): sloturile `app-*` si gateway-ul sunt in EU West, iar Postgres/Redis/MinIO/Mailpit au ramas in regiunea stivei din iulie → ~150 ms per query. Codul a fost intarit (timeout 20 s + query-uri batch, vezi CHANGELOG), dar toate serviciile trebuie aduse in ACEEASI regiune (Railway → serviciu → Settings → Region; muta intai slotul standby, promoveaza-l, apoi celalalt). Verificare dupa mutare: cel mai rapid GET din `railway logs --service app-<activ>` coboara de la ~150 ms la sub 20 ms.

> Stare curenta 2026-09-17 (dupa hotfix): **Blue este activ** in productie — `app-blue` (URL direct https://app-green-production-7958.up.railway.app), release `d64437387c57c4396ce7451834a1c215a52fb9d9` (tag `release/2026-09-17-publish-fix`, branch `codex/release-20260917-publish-fix`, worktree `F:\Cozy-Fable-releases\20260917-publish-fix`); `backend.ACTIVE_UPSTREAM=app-blue.railway.internal:3000`. `app-green` (…-1223) ramane standby cu release-ul anterior `0b6815f9…` = rollback compatibil (schema neschimbata; aceleasi cozi). Rollback = inversul pasilor 1-3 din runbook (green active, blue standby, `ACTIVE_UPSTREAM=app-green.railway.internal:3000`). Urmatorul candidat se deployeaza pe `app-green` (slotul inactiv).

## Observabilitate (E-admin-platform-8, 2026-09-29)

**Trei rute de health** (toate GET, `@Public`, merg si pe slotul standby):

| Ruta | Ce verifica | Raspuns | Cine o foloseste |
|---|---|---|---|
| `/api/v1/health` | DB + Redis + storage, fiecare cu timeout 1,5 s | 503 daca ORICARE e jos (strict, invarianta 3.11) | poarta de deploy Railway (`railway.json` al app-ului si al gateway-ului), `tools/release/verify-slot.mjs`, smoke-ul containerului |
| `/api/v1/health/live` | doar procesul (fara I/O) | 200 `{status:'ok'}` (cu `X-Health-Token`: + `release`) | rutarea gateway-ului Caddy (dupa comutarea `HEALTH_URI`, vezi mai jos) |
| `/api/v1/health/ready` | DB + Redis + storage, timeout 1,5 s fiecare | 503 DOAR cand DB-ul e jos; Redis/storage jos → 200 `status:'degraded'` | monitorul de uptime |

**Comutarea gateway-ului pe `/live` (`HEALTH_URI`)** — Caddyfile foloseste `health_uri {$HEALTH_URI:/api/v1/health}`, deci fara variabila nimic nu se schimba.
1. Deployeaza release-ul care contine `/health/live` pe AMBELE sloturi (blue si green).
2. `node tools/release/verify-slot.mjs --url <slot> --slot <blue|green> --mode <active|standby>` pe fiecare slot → rezultatul trebuie sa arate `"live": 200` pe AMBELE.
3. Abia atunci: `railway variables --service backend --set HEALTH_URI=/api/v1/health/live` (gateway-ul se redeployeaza).
4. Rollback spre un slot FARA `/live`: sterge INTAI variabila (`railway variables --service backend --unset HEALTH_URI` sau din UI) — altfel singurul upstream primeste 404 la health si site-ul cade.
Deploy gating-ul (`railway.json`) ramane pe `/api/v1/health` strict; nu il muta.

> E-admin-platform-56: corpul PUBLIC al celor trei rute e doar `{"status":"ok"}` (sau `"degraded"` pe `/ready`); detaliile (`checks`, `release`, `client`, `timestamp`) cer headerul `X-Health-Token` — vezi „Health public si token" mai jos. Railway, Caddy si monitorul de uptime citesc doar codul HTTP (si `degraded`), deci nu sunt afectate.

**Monitor de uptime (il creeaza PO, nu implementatorul)**: `GET https://<host public>/api/v1/health/ready`, la 1-5 minute, dintr-o locatie din UE; alerta la orice raspuns non-200 sau cand `"status":"degraded"` persista peste 5 minute. Destinatarul alertelor: decizie PO.

**Variabile noi** (setate pe AMBELE sloturi, `app-blue` si `app-green`; toate optionale, lipsa = dezactivat):
- Backend (runtime): `LOG_LEVEL` (implicit `info`; `fatal|error|warn|info|debug|trace|silent`), `SENTRY_DSN` (gol = tracker dezactivat; DSN Sentry EU sau GlitchTip dupa decizia PO + DPA semnat), `SENTRY_ENVIRONMENT` (implicit `NODE_ENV`).
- Frontend (build args `NEXT_PUBLIC_*` → REBUILD al slotului la schimbare): `NEXT_PUBLIC_SENTRY_DSN` (evenimentele trec prin tunelul same-origin `/monitoring`), `NEXT_PUBLIC_ANALYTICS_PROVIDER` (`umami` | `plausible`), `NEXT_PUBLIC_ANALYTICS_HOST` (origine https), `NEXT_PUBLIC_ANALYTICS_SITE_ID`; `RELEASE_SHA` (deja setat per slot) → `NEXT_PUBLIC_RELEASE_SHA`.
- Gateway: `HEALTH_URI` (vezi mai sus).

**Ce primeste trackerul**: tipul exceptiei + `kind=… code=… status=…` (nu mesajul), cadrele (fisier, functie, linie, coloana) fara cod sursa si fara variabile, tag-urile `traceId`, `route` (pattern), `slot`, `mode` si release-ul. Nimic din request, cookie-uri, user, breadcrumbs. In browser: mesaj mascat (emailuri, id-uri, tokenuri, cifre), URL redus la cale mascata, fara breadcrumbs. Statistici: doar `wizard_start` si `request_published`, URL fix, fara cookie-uri, respecta Do Not Track.

**Loguri**: productia tine logurile DOAR in Railway, cu retentia planului Railway (Hobby: 7 zile — de confirmat in UI), acces = membrii proiectului Railway (restrangerea lor = actiune PO). Sondele de health reusite nu mai sunt logate; esecurile lor (4xx/5xx) raman la warn/error cu `routePattern`. Orice 500 neasteptat logheaza `kind=… route=<pattern> frame=<fisier:linie> traceId=<uuid>`. Interogarile peste 300 ms apar ca WARN `slow query model=… action=… ms=…` (fara argumente).

**Eroare de test**: Admin → Setari → „Monitorizarea erorilor": „Eroare de test pe server" (`GET /api/v1/admin/monitoring/test-error`, admin, 3/min → 500 capturat, tip `MonitoringTestError`) si „Eroare de test în browser" (ecranul de eroare + raportare). Eroarea trebuie sa apara in tracker in cel mult un minut; fara DSN apare doar in loguri.

## IP client si rate limit (E-admin-platform-5, 2026-09-30)

**Problema (SEC2-3)**: lantul de productie e client → edge Railway → gateway Caddy (fara `trusted_proxies`) → slot Next `:3000` → rewrite loopback → Nest `:3001`. Caddy rescrie `X-Forwarded-For` cu adresa conexiunii directe, deci `req.ip` e adresa edge-ului/proxy-ului, aceeasi pentru toti userii: limitele per IP (login 5/min, global 100/min, invarianta 3.13) devin globale, iar `audit_logs.ip_hash` colapseaza.

**Ce face codul** (`apps/backend/src/common/http/client-ip.ts`): un singur rezolvator pentru throttler, audit si health. Headerul edge-ului (ex. `x-real-ip`) e crezut DOAR daca `TRUSTED_CLIENT_IP_HEADER` e setat SI peer-ul socketului e loopback (cererea a venit prin rewrite-ul Next). `x-forwarded-for` e refuzat la boot. Nesetat = comportamentul vechi (`req.ip`) + un WARN la boot in productie. IPv6 se limiteaza pe prefixul /64. Contorul throttlerului sta in Redis (`throttle:*`, o comanda EVAL per request, timeout 1 s, fallback in memorie), deci e partajat intre procese/sloturi.

**Variabile backend** (pe AMBELE sloturi, `app-blue` si `app-green`; ambele release-uri pornesc cu sau fara ele):
- `TRUSTED_CLIENT_IP_HEADER` — valoarea asteptata `x-real-ip`; se seteaza DOAR dupa testul de spoofing de mai jos.
- `THROTTLER_STORE` — `redis` (implicit) | `memory`. Cat timp Redis e in alta regiune (~150 ms per comanda) fiecare request API plateste un round trip; `memory` pe ambele sloturi pana la mutarea Redis in EU West, daca PO decide asa (DECIZIE NECESARA). Blocarea per email (`login-fail:*`, `login-lock:*`) foloseste Redis oricum (doar la login).

**Procedura inainte de a seta variabila** (operator, pe slotul standby):
1. Deployeaza release-ul pe slotul standby, seteaza `TRUSTED_CLIENT_IP_HEADER=x-real-ip` DOAR pe el si asteapta redeploy-ul.
2. `node tools/release/verify-slot.mjs --url <URL public al slotului> --slot <slot> --mode standby` → rezultatul trebuie sa contina `rateLimit.spoofProbe: "same-bucket"` si `rateLimit.clientScope: "public"`. Sonda face 3 GET-uri pe `/api/v1/health` (`x-ratelimit-remaining` trebuie sa scada strict) si un al 4-lea cu `X-Real-IP`/`X-Forwarded-For: 203.0.113.77` care trebuie sa ramana in ACELASI bucket.
3. Daca sonda de spoofing pica („Forwarded client IP header is spoofable") → edge-ul NU suprascrie headerul: sterge variabila imediat si nu promova cu ea.
4. Daca trece: seteaza aceeasi variabila si pe slotul activ, apoi continua runbook-ul blue/green.

Fara variabila, verify-slot pica pe release-urile noi cu „Rate-limit key is a private address" (health raporteaza `client.scope` al cheii de rate limit, fara IP). `--rate-limit-check off` sare sonda: de folosit la release-urile mai vechi decat E-admin-platform-5 (rollback) sau, temporar, pana la testul de spoofing.

**Dupa deploy** (read-only, prin `railway run --service Postgres` sau consola):
```sql
SELECT count(DISTINCT ip_hash), count(*) FROM audit_logs WHERE created_at > now() - interval '1 day';
```
Cu headerul corect trebuie sa apara multe hash-uri distincte (nu 1-2 pentru tot traficul).

**Blocare per email (SEC1-21)**: 10 parole gresite in 15 min pe acelasi email (5 pentru conturile ADMIN — DECIZIE NECESARA PO) → 15 min de pauza cu `429 LOGIN_COOLDOWN`, identic pentru conturi existente si inexistente; titularul primeste un singur email de alerta si apare un rand `LOGIN_COOLDOWN_STARTED` in audit. Resetarea parolei ridica pauza. Deblocare manuala (incident): sterge cheile `login-lock:<sha256(email)>` din Redis.

## Health public si token (E-admin-platform-56, 2026-09-30)

**Ce s-a schimbat (SEC2-9)**: `/api/v1/health`, `/health/live` si `/health/ready` raspund public DOAR cu `{"status":"ok"}` (`/ready` poate da `{"status":"degraded"}`; 503 raman ca inainte). Slotul, modul, SHA-ul release-ului, starea fiecarei dependinte si diagnosticul `client` se dau DOAR cand cererea are headerul `X-Health-Token` egal cu `HEALTH_DETAILS_TOKEN` (comparatie in timp constant; headerul e redactat in logurile pino). Variabila nesetata = detaliile nu se dau niciodata.

**Variabila backend** (pe AMBELE sloturi, `app-blue` si `app-green`):
- `HEALTH_DETAILS_TOKEN` — minim 32 de caractere (`openssl rand -hex 32`), optionala si in productie (un slot fara ea porneste, dar verify-slot nu mai vede detaliile). Se pune in escrow ca orice secret.
- Ordine: `railway variables --service app-blue --set HEALTH_DETAILS_TOKEN=<token> --skip-deploys` si la fel pe `app-green`, INAINTE de deploy-ul release-ului care contine E-admin-platform-56 (acelasi token pe ambele sloturi).

**Verificarea slotului** (din worktree-ul release-ului, NU din `F:\Cozy Fable`, care e legat de `green-mail`): tokenul se citeste DOAR din env (niciodata ca argument, ca sa nu ramana in istoricul shell-ului), iar `railway run` il injecteaza din variabilele slotului (ruleaza local, deci URL-ul trebuie sa fie HTTP public: domeniul slotului azi sau un domeniu temporar dupa decizia PO):
```powershell
railway run --service app-green node tools/release/verify-slot.mjs --url https://<domeniul slotului sau temporar> --slot green --mode standby --sha <full-sha>
```
Fara token, pe un release nou, verify-slot pica explicit („Health details hidden: run with HEALTH_DETAILS_TOKEN …"). Release-urile vechi (rollback) dau inca tot corpul si fara token — verify-slot le accepta.

**Dupa deploy** (pe domeniul public):
```bash
curl -s https://<host public>/api/v1/health            # exact {"status":"ok"}
curl -sI https://<host public>/ro | grep -i x-robots-tag  # NU trebuie sa afiseze nimic
```
Un `X-Robots-Tag` pe hostul public inseamna ca imaginea a fost construita cu un `NEXT_PUBLIC_SITE_URL` gresit → productia iese din index: reconstruieste slotul cu URL-ul canonic.

**Loopback (SEC2-20)**: in containerul combinat Nest asculta doar pe `127.0.0.1:3001` (`LISTEN_HOST=127.0.0.1` in `start-combined.sh`); Next ajunge la el prin rewrite-ul loopback. `LISTEN_HOST` nesetat = toate interfetele (dev, compose); accepta doar adrese IP.

### Domeniile sloturilor private (DECIZIE NECESARA PO — NU se executa pana la „da" de la PO)

Azi `app-blue`, `app-green` si aliasul vechi `gateway-production-92ac` au domenii Railway publice. Codul functioneaza in ambele variante: health-ul public nu mai arata SHA-ul, iar orice host diferit de `NEXT_PUBLIC_SITE_URL` primeste `X-Robots-Tag: noindex, nofollow` (fara duplicat SEO). Dupa acordul PO, operatorul:
1. genereaza un domeniu Railway TEMPORAR pe slotul inactiv (Railway → serviciu → Settings → Networking → Generate Domain);
2. ruleaza `railway run --service app-<slot> node tools/release/verify-slot.mjs --url https://<domeniul temporar> ...` (plus Playwright green-ui, daca e cazul);
3. sterge domeniul temporar;
4. dupa ce domeniile ambelor sloturi si aliasul gateway-ului sunt sterse, scoate `FRONTEND_PREVIEW_ORIGINS` de pe ambele sloturi (`--skip-deploys`, apoi redeploy coordonat);
5. `playwright.green-ui.config.ts` se ruleaza de atunci doar cu domeniul temporar al pasului 1.

## CSP cu nonce, COOP, noindex (E-admin-platform-56)

- **CSP (SEC2-8)**: construita per cerere in `apps/frontend/src/middleware.ts` (`lib/csp.ts`): nonce nou la fiecare cerere, `script-src 'self' 'nonce-…' 'strict-dynamic'` (fara `'unsafe-inline'` pe scripturi; Google Maps e incarcat de un script de incredere), `style-src` pastreaza `'unsafe-inline'` (styled-jsx), raportare `report-uri /csp-report` + `Reporting-Endpoints`. Doar in productie. Consecinta asumata: paginile `[locale]` se randeaza dinamic (landing-ul nu mai e static) — TTFB masurat in CHANGELOG.
- **Rapoarte CSP**: ruta same-origin `/csp-report` scrie o linie `{"evt":"csp_violation","directive":…,"blocked":<origine>,"page":<cale mascata>}` in logurile Railway (max 16 KB per raport, 60 rapoarte/min per proces, raspuns mereu 204). Fara furnizor extern, fara URL-uri complete, query-uri sau IP-uri.
- **img-src / connect-src**: raman largi (`https:`) cat timp build arg-ul `NEXT_PUBLIC_STORAGE_ORIGIN` e gol. Setarea lui (origini https separate prin virgula, ex. endpointul S3 public) le restrange la: `'self'`, `data:`, `blob:`, storage, Google Maps/Places, CDN-ul Webflow al caietului de idei si `NEXT_PUBLIC_CSP_IMG_ORIGINS`. DECIZIE NECESARA PO: allowlist pentru hosturile imaginilor de inspiratie (azi orice URL https acceptat de admin). Inainte ca operatorul sa seteze arg-ul, ruleaza read-only (`railway run --service Postgres` sau consola):
  ```sql
  SELECT DISTINCT substring(image_url from '^https?://[^/]+') AS host, count(*)
  FROM inspiration_photos WHERE image_url IS NOT NULL AND deleted_at IS NULL GROUP BY 1;
  ```
  si pune FIECARE host gasit in `NEXT_PUBLIC_CSP_IMG_ORIGINS`. Schimbarea storage-ului (ex. migrarea in EU) = REBUILD al ambelor sloturi cu noua origine.
- **COOP**: `Cross-Origin-Opener-Policy: same-origin` in productie (nu folosim `window.open`/opener).
- **noindex**: `X-Robots-Tag: noindex, nofollow` pe orice host diferit de hostul din `NEXT_PUBLIC_SITE_URL` (gateway-ul Caddy trimite Host-ul public mai departe). Verificare dupa deploy: vezi „Health public si token".
- **SHA in bundle**: `NEXT_PUBLIC_RELEASE_SHA` ajunge in bundle-ul browserului doar cand `NEXT_PUBLIC_SENTRY_DSN` e setat.
- Orice script, host de imagini, conexiune sau embed extern NOU se adauga in `lib/csp.ts`, altfel e blocat DOAR in productie.

## Lant de aprovizionare (E-admin-platform-56)

- CI: `permissions: contents: read`, toate actiunile fixate prin SHA de commit (comentariul = versiunea; Dependabot `github-actions` le urca), `pnpm audit --prod --audit-level high` + `pnpm audit --audit-level high` (si lantul de dezvoltare), scanare Trivy a imaginii `cozy-app:ci` (imagine `aquasec/trivy` fixata prin digest; HIGH/CRITICAL cu fix disponibil → CI rosu). Exceptii DOAR in `.trivyignore.yaml`, fiecare cu `statement` + `expired_at` la cel mult 90 de zile.
- Workflow nou `.github/workflows/codeql.yml` (JavaScript/TypeScript, fara build; push main, PR, saptamanal).
- **Actiune PO**: GitHub → Settings → Code security → Secret scanning + Push protection (setari de repository, nu se pot pune din fisiere).
- Imaginea de productie (`Dockerfile.app`) are stagiul `proddeps`: runtime-ul primeste doar dependintele de productie ale backendului (`pnpm install --prod --filter backend...`); `prisma` e in `dependencies` (migrate deploy). Auto-verificarea imaginii pica daca apar `vitest`/`vite`/`jest`/`@nestjs/cli`/`typescript-eslint` in runtime. Runtime-ul face `apt-get -y upgrade` (fixuri Debian intre bump-urile de digest) si sterge npm/npx/corepack globale ale imaginii node (nefolosite; erau sursa CVE-urilor Node din Trivy).
- Gateway: `caddy:2.10.2-alpine` fixat prin digest in `deploy/gateway/Dockerfile`.
- Backend pe NestJS 11 / Express 5 (parser de query `simple`: `a[b]=` / `a[]=` nu se mai parseaza in obiecte; niciun DTO nu le foloseste). Deploy-ul acestui release merge INTAI pe slotul standby (verify-slot + smoke), apoi switch-ul normal.

Data: 2026-07-08. Target: **Railway**, proiect `cozy-fable` (ID e31aa697-8f65-4a9a-81e0-1f6ce09a9903).

## LIVE (deploy 2026-07-08, verificat e2e)

- **Aplicatia**: https://backend-production-2813.up.railway.app (frontend + backend, un container)
- **Mailpit** (emailurile beta, cu basic auth): https://mailpit-production-74ad.up.railway.app
- **MinIO S3** (doar API presigned, nu se acceseaza direct): https://minio-production-9159.up.railway.app
- Secrete/parole: variabilele serviciului `backend` in dashboardul Railway (inclusiv `DEMO_ADMIN_PASSWORD`).

## Arhitectura de deploy

```
Browser
  │ https (same-origin)
  ▼
[backend service = UN container, Dockerfile.app]     ← limita 5 servicii pe planul free
  ├─ Next.js standalone :$PORT — proxy /api/v1 + /socket.io → 127.0.0.1:3001
  └─ NestJS + Prisma :3001 (Chromium pt PDF) — migrate deploy la boot (start-combined.sh)
  │ private networking
  ├── [Postgres]  (plugin Railway)
  ├── [Redis]     (plugin Railway; REDIS_PASSWORD + family:0)
  ├── [minio]     bitnamilegacy/minio + volum /bitnami/minio/data — presigned URLs pe domeniul public :9000
  │               backup: vezi sectiunea „Backup si restaurare" (serviciile cron backup-daily / backup-restore-test → bucket off-site UE)
  └── [mailpit]   axllent/mailpit — SMTP intern :1025; UI public :8025 cu MP_UI_AUTH
```

Gotcha-uri Railway invatate la deploy (NU le redescoperi):
- Planul free = max 5 servicii → frontend+backend combinate in `Dockerfile.app` (al 6-lea serviciu e refuzat cu "Free plan resource provision limit exceeded").
- Railway injecteaza `PORT` (ex. 8080) in containere; domeniul tintea 3000 → 502. Fix: variabila explicita `PORT=3000` pe serviciu.
- `bitnami/minio` nu se mai poate trage de pe Docker Hub (deploy FAILED fara loguri) → `bitnamilegacy/minio` + `RAILWAY_RUN_UID=0`(pt volum) + `MINIO_DEFAULT_BUCKETS=uploads`.
- In Git Bash, caile `-m /bitnami/...` sunt stricate de MSYS path conversion → `MSYS_NO_PATHCONV=1`.
- Dupa redeployul unui serviciu, DNS-ul privat propaga in ~1 min: SMTP "Connection timeout" tranzitoriu, se remediaza singur.

Decizii cheie (de ce asa):
- **Cookies `SameSite=Lax`** raman neschimbate: API-ul e proxied prin Next
  (`rewrites` in `next.config.mjs`, activat de `BACKEND_INTERNAL_URL`), deci browserul
  vede totul same-origin. Fara CORS cross-site, fara cookies third-party (Safari ok).
- **Socket.IO** trece prin acelasi proxy — upgrade-ul websocket poate esua prin
  rewrite si clientul ramane pe long-polling: functional, suficient pentru beta.
- **`trust proxy`** setat in `main.ts` — altfel throttlingul per-IP (login 5/min)
  ar pune toti utilizatorii in acelasi bucket (IP-ul proxy-ului).
- **Prisma pe bookworm-slim**: `openssl` instalat INAINTE de `pnpm install`/`generate`,
  altfel se descarca engine-uri `openssl-1.1.x` si containerul crapa la runtime.
- **Puppeteer**: Chromium de sistem (`PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`,
  `PUPPETEER_SKIP_DOWNLOAD=1` la install). Launch args `--no-sandbox` existau deja.
- **Migratiile** ruleaza la bootul containerului backend (`prisma migrate deploy`) —
  idempotent; seed-urile se ruleaza manual o singura data (vezi mai jos).
- **Email**: ~~Mailpit ca sink SMTP in productie~~ — din E-admin-platform-1 (2026-09-29)
  backendul NU mai porneste in productie pe un SMTP de captura (Mailpit/green-mail/`*.internal`,
  port 1025/8025), fara SMTP autentificat, fara `MAIL_FROM` cu nume afisat sau fara
  `SUPPORT_EMAIL`. Trecerea pe provider real + domeniu final: sectiunea
  „Trecerea pe domeniul final + email real" de mai jos.
- **Parole demo**: `seed-demo.ts` citeste `DEMO_PASSWORD` si `DEMO_ADMIN_PASSWORD`
  din env — adminul NU mai are parola cunoscuta din repo pe instante publice.

## Variabile backend (Railway)

```
NODE_ENV=production
PORT=3001
FRONTEND_ORIGIN=https://<frontend-domain>
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_HOST=${{Redis.RAILWAY_PRIVATE_DOMAIN}}
REDIS_PORT=6379
REDIS_PASSWORD=${{Redis.REDISPASSWORD}}
S3_ENDPOINT=https://<minio-domain>
S3_ACCESS_KEY / S3_SECRET_KEY / S3_BUCKET=uploads / S3_REGION=us-east-1
# Email (E-admin-platform-1). SMTP_HOST=${{mailpit.RAILWAY_PRIVATE_DOMAIN}} + SMTP_PORT=1025
# sunt OBSOLETE si refuzate la boot in productie (fara SMTP_ALLOW_DEV_HOST=true).
SMTP_HOST=<host SMTP al providerului UE, ex. smtp-relay.brevo.com / smtp.postmarkapp.com / email-smtp.eu-central-1.amazonaws.com>
SMTP_PORT=587            # sau 465 cu SMTP_SECURE=true
SMTP_SECURE=false        # 587 → STARTTLS impus automat in productie; 465 → true
SMTP_USER=<user SMTP>    # obligatoriu in productie
SMTP_PASS=<parola/cheie SMTP>  # obligatoriu in productie
MAIL_FROM="Cozy Home" <notificari@<domeniu-final>>   # nume afisat obligatoriu; domeniu autentificat SPF/DKIM
SUPPORT_EMAIL=suport@<domeniu-final>                 # casuta MONITORIZATA (nu no-reply); Reply-To + subsol emailuri
# SMTP_ALLOW_DEV_HOST=true  → DOAR pe previzualizarea izolata cu captura (green-mail) / stack local prod-like
JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / PAYMENT_WEBHOOK_SECRET / IP_HASH_SALT  (openssl rand -hex 32)
# IP client + rate limit (E-admin-platform-5) — vezi sectiunea "IP client si rate limit"
# TRUSTED_CLIENT_IP_HEADER=x-real-ip   # DOAR dupa ce sonda de spoofing din verify-slot trece; AMBELE sloturi
# THROTTLER_STORE=redis                # implicit; memory = per proces (ex. pana cand Redis e in EU West, daca PO decide)
# HEALTH_DETAILS_TOKEN=<openssl rand -hex 32>  # E-admin-platform-56; AMBELE sloturi, --skip-deploys, INAINTE de deploy
# LISTEN_HOST                                  # nu se seteaza in Railway: start-combined.sh pune 127.0.0.1
RAILWAY_DOCKERFILE_PATH=apps/backend/Dockerfile
```

Frontend (build args, injectate automat de Railway in ARG-urile din Dockerfile):
```
NEXT_PUBLIC_API_URL=/api/v1
NEXT_PUBLIC_SITE_URL=https://<domeniu-final>
NEXT_PUBLIC_SUPPORT_EMAIL=suport@<domeniu-final>   # = SUPPORT_EMAIL din backend; gol → fara security.txt
# NEXT_PUBLIC_STORAGE_ORIGIN=https://<storage>     # E-admin-platform-56; gol = img/connect-src largi; schimbare = REBUILD
# NEXT_PUBLIC_CSP_IMG_ORIGINS=https://<host1>,...  # hosturile imaginilor de inspiratie (query-ul read-only de mai sus)
BACKEND_INTERNAL_URL=https://<backend-domain>
RAILWAY_DOCKERFILE_PATH=apps/frontend/Dockerfile
```

Gateway `backend` (Caddy, deploy/gateway/Caddyfile):
```
ACTIVE_UPSTREAM=<slotul activ>
CANONICAL_HOST=<domeniu-final>                                # tinta redirectului 301
LEGACY_HOSTS=backend-production-2813.up.railway.app           # hosturi vechi, separate prin spatiu
```
Fara `CANONICAL_HOST`/`LEGACY_HOSTS` matcherul tinteste un host rezervat (`legacy.invalid`) → niciun redirect.

## Trecerea pe domeniul final + email real (E-admin-platform-1)

Codul e agnostic de provider si domeniu (totul prin env). Pasii de mai jos ii executa PO/ops
DUPA ce PO alege domeniul si providerul (DECIZIE NECESARA — nu exista in docs/07).

**Ordinea e obligatorie: variabilele pe AMBELE sloturi (`app-blue` si `app-green`) INAINTE
de deploy-ul release-ului care contine E-admin-platform-1** — altfel slotul nu porneste
(`Config invalid — boot abort`: SMTP_HOST / SMTP_PORT / SMTP_USER / MAIL_FROM / SUPPORT_EMAIL).

1. PO alege domeniul final si providerul SMTP din UE: Brevo, Postmark (EU) sau Amazon SES `eu-central-1`.
2. DNS la registrar, dupa instructiunile providerului: SPF (`include:` al providerului), DKIM
   (CNAME/TXT), DMARC la inceput `v=DMARC1; p=none; rua=mailto:<SUPPORT_EMAIL>`; dupa 2–4
   saptamani de rapoarte curate → `p=quarantine`.
3. Casuta pentru `SUPPORT_EMAIL` (ex. `suport@<domeniu>`) — cineva o citeste; aici ajung
   raspunsurile la emailurile de cont, blocare, facturare si dispute.
4. Railway: custom domain pe serviciul gateway `backend`; pe gateway
   `CANONICAL_HOST=<domeniu>` si `LEGACY_HOSTS=backend-production-2813.up.railway.app`
   (hosturile vechi primesc 301 spre domeniu; healthcheck-ul Railway foloseste alt host si nu e afectat).
5. Pe AMBELE sloturi (`railway variables --service app-<slot> --skip-deploys --set ...` pentru pregatire):
   `FRONTEND_ORIGIN=https://<domeniu>`, `SMTP_HOST/PORT/USER/PASS/SECURE`, `MAIL_FROM`,
   `SUPPORT_EMAIL`. Build args: `NEXT_PUBLIC_SITE_URL=https://<domeniu>` si
   `NEXT_PUBLIC_SUPPORT_EMAIL=<SUPPORT_EMAIL>` — sunt coapte in bundle, deci ambele sloturi se RECONSTRUIESC.
6. Stripe dashboard: endpoint webhook nou `https://<domeniu>/api/v1/webhooks/stripe`. Endpoint nou
   = `whsec_` nou → actualizeaza `STRIPE_WEBHOOK_SECRET` pe ambele sloturi. URL-urile de
   succes/anulare urmeaza automat `FRONTEND_ORIGIN`.
7. Userii sunt delogati o data (cookie-urile sunt host-only pe hostul vechi).
8. Admin → Setari → „Trimite email de test" → in Gmail „Show original": SPF/DKIM/DMARC = PASS,
   expeditor „Cozy Home". Raspunde la emailul de test → trebuie sa ajunga in casuta `SUPPORT_EMAIL`.
   Logul de boot trebuie sa arate `SMTP verify ok host=...` (verificarea e doar log, nu opreste boot-ul).
9. Sterge serviciul public Mailpit si domeniul lui (inboxul contine linkuri reale de resetare parola).
10. Optional: `NOMINATIM_USER_AGENT` cu adresa de suport ca contact.
11. Previzualizarea izolata Green pe `green-mail`: seteaza `SMTP_ALLOW_DEV_HOST=true` acolo, altfel nu porneste.

## Stripe (plati credite + abonamente — decizie PO 2026-08-19, sprint L0-D)

Plata online = Stripe Checkout hosted (mode `payment`, moneda `ron`, suma = total CU TVA in
bani, sesiune expira in 30 min) + webhook semnat. Calea "confirmare admin"
(`POST /admin/payments/:id/confirm`) ramane fallback pentru transfer bancar; adminul poate si
acorda/prelungi abonamente manual (`POST /admin/subscriptions/grant`).

Variabile backend (optionale — lipsa lor = Stripe dezactivat: butoanele "Plateste" plaseaza
comanda PENDING si afiseaza datele de transfer bancar din `system_settings.seller_*`):
```
STRIPE_SECRET_KEY=sk_live_...        # productie: DOAR sk_live_/rk_live_ (se seteaza IMPREUNA cu webhook secret)
STRIPE_WEBHOOK_SECRET=whsec_...      # din endpoint-ul creat in dashboard / `stripe listen`
STRIPE_PUBLISHABLE_KEY=pk_live_...   # optional, nefolosit de backend (Checkout e hosted)
# STRIPE_ALLOW_TEST_MODE=false       # doar staging izolat; productia refuza sk_test_ fara acest flag
FRONTEND_ORIGIN=https://<frontend>   # baza pentru success/cancel URL: /{ro|en}/marketplace/wallet?payment=...
```

E-admin-platform-4 — reguli de siguranta:
- **Chei live in productie.** Cu `NODE_ENV=production`, boot-ul se opreste daca `STRIPE_SECRET_KEY`
  nu e `sk_live_`/`rk_live_` (un card de test nu poate cumpara pe productie). Supapa
  `STRIPE_ALLOW_TEST_MODE=true` exista DOAR pentru un staging izolat. Formatul necunoscut al cheii
  (nici `sk_`/`rk_` + `live_`/`test_`) opreste boot-ul in orice mediu. Seteaza cheile live pe
  AMBELE sloturi (blue + green) inainte de deploy, altfel slotul fara chei valide nu porneste.
- **Mod test vizibil.** Cu o cheie de test, comenzile se creeaza cu `test_mode=true`: beneficiul se
  acorda (fluxurile de staging merg), dar NU primesc serie/numar fiscal si au
  `e_invoice_status=NOT_REQUIRED`. Adminul si firma vad bannerul „MOD TEST". Evenimentele
  webhook cu `livemode` diferit de cheie → 400 si nu se inregistreaza in `stripe_events`.
- **Date fiscale reale obligatorii.** `seller_*` goale, cu valorile de exemplu din seed, CUI cu cifra
  de control gresita sau IBAN invalid → toate cumpararile (`/billing/credits/purchase`,
  `/billing/subscription/purchase`, `/billing/orders/:id/checkout`) si orice confirmare (admin,
  webhook) raspund 503 `BILLING_NOT_CONFIGURED`; wallet-ul nu mai afiseaza IBAN-ul, iar fiecare
  pagina /admin arata bannerul rosu. Webhook-ul primeste 503 (neinregistrat) si Stripe il
  reincearca pana la 3 zile — beneficiul se livreaza dupa completarea datelor.
  Completarea: Admin → Setari → Date fiscale (`PUT /admin/billing/seller`, auditat
  `SELLER_DETAILS_UPDATED` fara valori).

### e-Factura (ruta manuala pana la decizia PO)
Fiecare factura fiscala (comanda CONFIRMED, non-test) are `e_invoice_status`: PENDING („de
raportat") → UPLOADED / VALIDATED / REJECTED. Lunar, adminul descarca din Admin → Plati registrul
CSV (`GET /admin/billing/e-invoice-export?month=YYYY-MM`, luna calendaristica Europe/Bucharest pe
`confirmed_at`) si PDF-urile (`GET /admin/payments/:id/invoice`); contabilul le incarca in SPV si
adminul inregistreaza indexul de incarcare prin „Actualizeaza" (`PATCH /admin/payments/:id/e-invoice`,
auditat `E_INVOICE_STATUS_UPDATED`). Termenul legal de 5 zile lucratoare pentru transmitere este
responsabilitatea contabilului; bannerul din /admin arata cate facturi asteapta raportarea.

Endpoint webhook: `POST https://<backend>/api/v1/webhooks/stripe` (public, semnatura verificata
pe `req.rawBody` cu `STRIPE_WEBHOOK_SECRET`, dedup pe `event.id` in tabelul `stripe_events`,
raspuns 200 rapid; eroare de procesare → 500 si Stripe reincearca). In dashboard Stripe →
Developers → Webhooks → Add endpoint, evenimente de abonat:
- `checkout.session.completed` (payment_status=paid → `PaymentsService.confirm(orderId,'stripe')`:
  factura + credite/abonament; audit `PAYMENT_CONFIRMED`)
- `checkout.session.async_payment_succeeded` (metode de plata asincrone — tratat identic)
- `checkout.session.expired` (comanda PENDING → CANCELLED, daca sesiunea e inca cea curenta)

`orderId` circula in `metadata.orderId` + `client_reference_id`; `mock_billing_orders` tine
`stripe_session_id` (unic, re-creat la "Continua plata"), `stripe_payment_intent_id`, `paid_at`.

Test local:
```bash
stripe login
stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe   # afiseaza whsec_... → STRIPE_WEBHOOK_SECRET in apps/backend/.env
# card test: 4242 4242 4242 4242, orice data viitoare / CVC; declin: 4000 0000 0000 0002
stripe trigger checkout.session.completed                          # eveniment sintetic (fara orderId → "no_order", 200)
```
Dupa deploy: `railway variables --set STRIPE_SECRET_KEY=... --set STRIPE_WEBHOOK_SECRET=...`
inainte de `railway up`; verifica in dashboard ca endpoint-ul primeste 200 la primul eveniment.
Datele fiscale reale (`seller_name/cui/reg_com/address/iban`) se seteaza in Admin → Setari → Date
fiscale (`invoice_series` in lista generica) INAINTE de prima confirmare — snapshot-ul intra pe
factura; pana atunci garda de facturare raspunde 503 `BILLING_NOT_CONFIGURED`.

## Seed initial (o singura data, de pe masina locala)

```bash
cd apps/backend
DATABASE_URL=<DATABASE_PUBLIC_URL> pnpm prisma db seed          # config scoring + system settings
DATABASE_URL=<DATABASE_PUBLIC_URL> DEMO_PASSWORD=... DEMO_ADMIN_PASSWORD=... pnpm exec tsx prisma/seed-demo.ts
DATABASE_URL=<DATABASE_PUBLIC_URL> pnpm exec tsx prisma/seed-inspiration.ts
```

## Publicare pe GitHub (O DATA, executa PO)

Stare la 2026-09-29: `origin/main` = `3056c0a` (2026-08-19); commiturile de dupa, ambele branch-uri de
release, tag-urile si working tree-ul exista doar pe discul PO. Pasii de mai jos ii ruleaza PO, in ordine,
din `F:\Cozy Fable` (Git Bash sau PowerShell):

1. `node tools/release/scan-secrets.mjs` → trebuie sa se termine cu `0 gasiri, 0 fisiere interzise`
   (exit 0). O gasire = NU publica; roteste cheia si scoate-o din arbore (DECIZIE NECESARA / rotire cheie).
2. Branch de publicare si PR:
   ```bash
   git switch -c chore/publish-working-tree
   git add -A
   git status            # revizuire: fara .env, dump-uri, test-results/, chei (.gitignore le exclude)
   git commit -m "Sprint 4 E-admin-platform-6: backup zilnic criptat off-site, test lunar de restaurare, gate CI pe tag, scanare secrete, politici storage"
   git push -u origin chore/publish-working-tree
   ```
   Deschide PR spre `main` pe GitHub (CI ruleaza pe `pull_request`); merge doar cand jobul `verify` e verde.
3. `git switch main && git pull --ff-only` (sau `git push origin main` daca main local e deja la zi).
4. `git push origin codex/release-20260916-green codex/release-20260917-publish-fix`
5. `git push origin refs/tags/release/2026-09-16-green refs/tags/release/2026-09-17-publish-fix`
   (nume explicite, NU `--tags`).
6. Verificare: `git ls-remote --heads --tags origin` → `main`, ambele branch-uri `codex/release-*` si ambele tag-uri.
7. Protectie `main` (DECIZIE NECESARA: pe un repo PRIVAT, branch protection / rulesets cer GitHub Pro/Team):
   ```bash
   gh api -X PUT repos/lupy1233/Cozy_Fable/branches/main/protection --input - <<'JSON'
   {
     "required_status_checks": { "strict": false, "contexts": ["verify"] },
     "enforce_admins": false,
     "required_pull_request_reviews": null,
     "restrictions": null,
     "allow_force_pushes": false,
     "allow_deletions": false
   }
   JSON
   ```
   Fara plan platit, gate-ul ramane cel din runbook: `tools/release/require-green-ci.mjs` inainte de orice `railway up`.
8. Nota: tag-urile vechi (`d644373`, `0b6815f`) contin un `ci.yml` fara trigger pe tag, deci nu primesc CI
   retroactiv pe SHA-ul exact. Primul release nou (tag `release/*` impins) va avea CI verde pe SHA-ul lui.
   Minute Actions: o rulare CI ~45 min; planul free pentru repo privat = 2.000 min/luna — de urmarit.

Gate de release (din acest pachet): CI ruleaza pe push `main`, pe tag-uri `release/*`, pe PR si manual
(`workflow_dispatch`); rularile pe tag nu se anuleaza. Inainte de deploy:
`node tools/release/require-green-ci.mjs --sha <sha complet de 40 caractere>` (token din `GITHUB_TOKEN`/`GH_TOKEN`
sau `gh auth token`) — trece doar cu o rulare `ci.yml` `push`/`workflow_dispatch` terminata `success` pe
exact acel SHA; o rulare `pull_request` nu ajunge.

## Backup si restaurare (E-admin-platform-6)

```
Postgres (prod) ──pg_dump -Fc──┐
                               ├─▶ [backup-daily]  cron 30 1 * * * (UTC) ── age ──▶ bucket off-site UE (privat)
minio / bucket uploads ─rclone─┘                                                    cozy-prod/db/daily/
                                                                                     cozy-prod/db/monthly/
                                                                                     cozy-prod/uploads/
                                                                                     cozy-prod/uploads-history/YYYYMMDD/
bucket off-site ──▶ [backup-restore-test] cron 0 4 2 * * (UTC) ── age -d ── PG18 temporar ── raport email admin
```

Imaginea: `deploy/backup/` (bazata pe `postgres:18-bookworm` fixat pe digest, + age, rclone, curl, jq, tzdata;
ruleaza ca `postgres`, fara secrete in imagine). Doua servicii Railway din acelasi director, fiecare cu propriul
config-as-code: `deploy/backup/railway.daily.json` si `deploy/backup/railway.restore-test.json`
(`restartPolicyType: NEVER`, fara healthcheck; cron-urile Railway sunt in UTC).

Ce face jobul zilnic (`backup-daily.sh`): manifest numeric (versiune PG, migratii terminate + ultima, trigger
`audit_logs_no_update_delete`, numar de randuri pe TOATE tabelele din `public`) → `pg_dump --format=custom` →
verificare TOC (`_prisma_migrations` + trigger) → criptare `age` (dump-ul in clar se sterge imediat) → upload
`.dump.age` + `.sha256` + `.manifest.json` → recitire si comparare sha256 → copie lunara `cozy-YYYYMM` (prima
rulare reusita din luna, luna Europe/Bucharest) → `rclone sync` al bucket-ului de upload-uri cu
`--backup-dir uploads-history/<azi>` (obiectele sterse/suprascrise raman 30 de zile, independent de provider) →
numar de obiecte sursa == oglinda → retentie. La esec: email „[Cozy Home] Backup EȘUAT — …" cu pasul si ultimele
40 de linii de log (redactate). La succes: fara email, doar heartbeat optional.

Testul lunar (`restore-test.sh`): cel mai nou backup zilnic → sha256 → varsta (> 36 h = problema) → decriptare →
`initdb` + `pg_restore --exit-on-error` intr-un cluster temporar (cronometrat) → migratii/ultima migratie/trigger/
`users > 0`/randuri per tabel fata de manifest (diferentele pe `refresh_tokens`, `idempotency_keys`,
`domain_event_outbox`, `notifications` sunt doar informative) → oglinda fisierelor (numar, marime, cel mai nou) →
email „[Cozy Home] Test lunar de restaurare backup — OK / EȘUAT" (doar numere si nume de tabele, fara date personale).

### Variabile per serviciu

| Variabila | backup-daily | backup-restore-test | Nota |
|---|---|---|---|
| `DATABASE_URL` | obligatorie | optionala (coloana „live acum") | rolul `backup_reader` (mai jos); ex. referinta `${{Postgres.DATABASE_URL}}` doar pana creezi rolul |
| `BACKUP_AGE_RECIPIENT` | obligatorie (`age1…`) | — | cheia PUBLICA |
| `BACKUP_AGE_IDENTITY` | **INTERZISA** (exit 2) | obligatorie | cheia PRIVATA, EXCLUSIV pe restore-test |
| `OFFSITE_S3_PROVIDER` / `ENDPOINT` / `REGION` / `BUCKET` | obligatorii (provider implicit `Other`) | la fel | provider rclone: `Cloudflare`, `B2`, `Scaleway`, `AWS`, `Minio`, `Other` |
| `OFFSITE_S3_ACCESS_KEY` / `OFFSITE_S3_SECRET_KEY` | cheia de scriere | cheia de citire | chei separate pe rol |
| `OFFSITE_PREFIX` | implicit `cozy-prod` | la fel | |
| `SOURCE_S3_ENDPOINT` / `ACCESS_KEY` / `SECRET_KEY` / `BUCKET` | obligatorii | — | cheia read-only din `setup-minio-uploads.sh`; endpoint intern (ex. `http://${{minio.RAILWAY_PRIVATE_DOMAIN}}:9000`) |
| `BACKUP_REPORT_TO` | obligatorie | obligatorie | casuta MONITORIZATA (DECIZIE PO; recomandat adresa reala a adminului); mai multe adrese separate prin virgula |
| `BACKUP_MAIL_FROM` | obligatorie | obligatorie | ex. `"Cozy Home" <backup@<domeniu-final>>` (domeniu autentificat SPF/DKIM) |
| `BACKUP_SMTP_HOST` / `PORT` / `USER` / `PASS` / `SECURE` | obligatorii | obligatorii | aceleasi valori ca slotul activ, ex. `${{app-blue.SMTP_HOST}}`; `SECURE=true` → `smtps://` (465), altfel STARTTLS impus |
| `BACKUP_SMTP_ALLOW_INSECURE` | DOAR local (Mailpit) | la fel | fara TLS si fara auth; niciodata in productie |
| `BACKUP_HEARTBEAT_URL` | optional | optional | dead-man switch (DECIZIE PO: healthchecks.io / Better Stack / monitorizarea din E-admin-platform-8); gol = oprit |
| `BACKUP_DAILY_KEEP_DAYS` / `BACKUP_MONTHLY_KEEP` / `BACKUP_HISTORY_KEEP_DAYS` | implicit 30 / 12 / 30 | — | nu le schimba fara decizie |
| `BACKUP_FORCE_MONTHLY` | DOAR test local | — | rescrie copia lunii curente |

### Pasii PO (o singura data)

1. **Provider off-site UE** (DECIZIE NECESARA): Cloudflare R2 cu jurisdictie EU, Backblaze B2 `eu-central`,
   Hetzner Object Storage, Scaleway `fr-par` sau AWS S3 `eu-central-1`. Codul e agnostic (orice endpoint S3 prin rclone).
2. Bucket PRIVAT in regiune UE, fara acces public, fara URL public.
3. Trei chei:
   - zilnic: Put/Get/List/Delete DOAR pe prefixul `cozy-prod/` al bucket-ului off-site;
   - restore-test: Get/List pe acelasi prefix (read-only);
   - sursa: cheia read-only `cozy-bkp-<bucket>` creata de `deploy/storage/setup-minio-uploads.sh` (sectiunea Storage).
4. Chei age pe PC-ul PO (nu pe server, nu in repo): `age-keygen -o age-identity-cozy.txt` → linia
   `# public key: age1…` = `BACKUP_AGE_RECIPIENT`; linia `AGE-SECRET-KEY-1…` = escrow (mai jos) + `BACKUP_AGE_IDENTITY`
   pe restore-test. Apoi sterge fisierul local dupa ce ai cele 2 copii de escrow (`.gitignore` exclude `age-identity*.txt`).
5. Rol de citire pentru backup (PG14+):
   ```bash
   railway connect Postgres        # psql interactiv pe baza de productie (cere psql local)
   -- in psql:
   CREATE ROLE backup_reader LOGIN PASSWORD '<parola generata: openssl rand -hex 24>';
   GRANT pg_read_all_data TO backup_reader;
   ```
   `DATABASE_URL` pe `backup-daily` = aceeasi gazda privata, user `backup_reader` si parola de mai sus.
6. Railway → New Service → GitHub repo (dupa publicare) sau `railway up` din `deploy/backup`:
   serviciul `backup-daily` cu Root Directory `deploy/backup` si Config Path `deploy/backup/railway.daily.json`;
   serviciul `backup-restore-test` cu acelasi Root Directory si Config Path `deploy/backup/railway.restore-test.json`.
   Regiune: EU West (aceeasi cu sloturile). Seteaza variabilele din tabel (`--skip-deploys` la pregatire).
7. Primul „Run now" pe `backup-daily` → in bucket trebuie sa apara `cozy-prod/db/daily/cozy-<data>.dump.age`
   (+ `.sha256`, `.manifest.json`), `cozy-prod/db/monthly/cozy-<YYYYMM>.dump.age` si `cozy-prod/uploads/`.
   Apoi „Run now" pe `backup-restore-test` → emailul „— OK" la `BACKUP_REPORT_TO`.

Structura bucket-ului: `cozy-prod/db/daily/` (30 de zile), `cozy-prod/db/monthly/` (12 luni),
`cozy-prod/uploads/` (oglinda curenta), `cozy-prod/uploads-history/YYYYMMDD/` (30 de zile). Retentia ruleaza
doar dupa un backup reusit; daca ar ramane sub 7 copii zilnice, nu sterge nimic. Baza e mica (dump-ul din
2026-09-16 = 221 KB), deci verificarea se face prin recitire completa; peste ~1 GB → `rclone check --size-only` + ETag.

### Restaurare manuala (incident)

1. Descarca backup-ul: `rclone copyto offsite:<bucket>/cozy-prod/db/daily/<stem>.dump.age .` (sau din `db/monthly/`)
   si verifica `sha256sum -c <stem>.dump.age.sha256`.
2. Decripteaza pe un PC de incredere: `age -d -i age-identity-cozy.txt -o restore.dump <stem>.dump.age`.
3. Restaureaza intr-o baza NOUA (niciodata peste productia live): `createdb <baza_noua>` →
   `pg_restore --no-owner --no-acl --exit-on-error -d <baza_noua> restore.dump`; compara cu `<stem>.manifest.json`
   (migratii, trigger, randuri).
4. Fisiere: `rclone sync offsite:<bucket>/cozy-prod/uploads source:<bucket-uploads>` (sau `uploads-history/<zi>/`
   pentru obiecte sterse intre timp).
5. Aplicatia: indreapta slotul inactiv spre baza noua in `standby`, apoi verificarile din
   `docs/implementation/blue-green-release.md` (health, login, draft, upload SAFE, PDF, Socket.IO) inainte de switch.
6. GDPR: dupa restaurare re-aplica stergerile si anonimizarile facute DUPA data backup-ului (din `audit_logs`).
   Copiile lunare pastreaza pana la 12 luni date sterse intre timp — DECIZIE NECESARA PO/avocat daca politica de
   confidentialitate trebuie sa mentioneze asta (textele legale nu au fost schimbate).
7. Sterge `restore.dump` si fisierul cu identitatea de pe PC dupa incident.

## RPO / RTO

- **RPO = 24 h** pentru baza de date si pentru fisiere (consecinta programului zilnic aprobat).
- **RTO: tinta propusa 4 h — DECIZIE PO.** Componenta masurata: durata `pg_restore` din raportul lunar
  (local, 2026-09-29: ~2 s pentru ~280 KB criptat); restul sunt pasii manuali de mai sus (descarcare, decriptare,
  sync fisiere, repunere slot + verificari).

## Escrow chei

Doua copii independente pentru fiecare (manager de parole + copie offline, ex. stick criptat / hartie in seif);
titularii = DECIZIE PO (completeaza aici numele, fara valori):

| Cheie | De ce trebuie pastrata | Titulari |
|---|---|---|
| identitatea age a backup-ului (`AGE-SECRET-KEY-1…`) | fara ea toate backup-urile sunt ilizibile | _PO_ |
| `MESSAGE_ENCRYPTION_KEY` | fara ea mesajele de chat `enc.v1` din orice restaurare sunt ilizibile | _PO_ |
| `IP_HASH_SALT` | hash-urile IP din `audit_logs` raman comparabile dupa restaurare | _PO_ |
| cheile off-site (scriere / citire) | acces la bucket-ul de backup | _PO_ |

NU se pun in escrow: `JWT_*` (se regenereaza; userii se reautentifica), cheile Stripe si SMTP (sunt la provider).

## Storage: cheie limitata si versionare

`deploy/storage/setup-minio-uploads.sh` (ruleaza in imaginea `minio/mc` fixata in `dev-infra`, idempotent):
bucket privat (`mc anonymous set none`, invarianta 3.4), politicile `deploy/storage/policies/uploads-app.json`
(Get/Put/Delete pe obiecte + ListBucket/GetBucketLocation pe bucket = exact ce foloseste `StorageService`:
PUT presemnat, GET presemnat, HeadObject, CopyObject pentru sigilare, DeleteObject, HeadBucket in health) si
`uploads-backup-readonly.json` (Get + List), cate un service account per rol (cheile se afiseaza O SINGURA DATA),
versionare activa si expirarea versiunilor vechi dupa 30 de zile (`mc ilm rule add --noncurrent-expire-days 30`).
Cu versionare, `deleteObject` lasa un delete marker, iar sigilarea (`CopySourceIfMatch`) ramane valida (testul
`storage.integration.spec.ts` trece pe un bucket versionat cu cheia limitata).

```bash
# prin reteaua privata Railway sau local; credentialele root DOAR pentru configurare
docker run --rm -v "$PWD/deploy/storage:/s" -e MC_ALIAS_URL=https://<minio-api> \
  -e MC_ROOT_USER=<root> -e MC_ROOT_PASSWORD=<root-pass> -e BUCKET=uploads \
  --entrypoint bash minio/mc@sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727 /s/setup-minio-uploads.sh
```

1. Pune cheia `cozy-app-<bucket>` pe AMBELE sloturi cu `railway variables --service app-<slot> --skip-deploys
   --set S3_ACCESS_KEY=… --set S3_SECRET_KEY=…`, apoi redeploy coordonat (intai standby, verificat, apoi activ).
2. Verificare: health `storage: up` pe ambele sloturi + un upload ajuns `SAFE` + download presemnat.
3. Cheia `cozy-bkp-<bucket>` → `SOURCE_S3_*` pe `backup-daily`.
4. Consola MinIO (`:9001`) sa NU fie publica. CORS: pe MinIO e global (`MINIO_API_CORS_ALLOW_ORIGIN` = domeniul FE);
   pe un S3 gestionat trebuie regula CORS explicita `PUT`/`GET` de pe domeniul FE (vezi migrarea EU).

La boot, in productie, `StorageService` logheaza un AVERTISMENT (fara valori) daca `S3_*` sunt credentialele
implicite MinIO (`minioadmin` etc.). Devine abort dupa migrarea EU si rotirea cheii (CHANGELOG, „Ramas").

## Alternativa self-host

`dev-infra/docker-compose.prod.yml` ridica tot stackul (build din surse) pe un VPS
sau local: `docker compose -f dev-infra/docker-compose.prod.yml up -d --build` →
frontend pe :8080. Secretele se dau prin env la rulare.

## Verificare post-deploy

Pentru implementarea showroom/casa din 2026-09-15, urmeaza si `implementation/rollout-and-acceptance.md`: migratii additive inainte de aplicatie, restart coordonat workeri, compatibilitate proiecte si checkpoint-uri Stripe. Dovezile locale sunt in `implementation/container-verification.md`; acestea nu reprezinta un deploy nou in productie. Seed-urile demo de mai sus sunt exclusiv pentru medii izolate, niciodata pentru productie.

1. `GET https://<backend>/api/v1/health` → exact `{"status":"ok"}` (detaliile `checks`/`release` doar cu `X-Health-Token`, vezi „Health public si token"); `curl -sI https://<host public>/ro | grep -i x-robots-tag` → nimic
2. Frontend: landing se incarca, register → email primit in inboxul real (dupa trecerea pe provider; in medii izolate: UI-ul de captura) → verify → login.
3. Configurator: creare cerere completa (inclusiv upload schita → presigned MinIO).
4. Cont firma demo: claim cerere + oferta; PDF oferta (Puppeteer/Chromium in container).
