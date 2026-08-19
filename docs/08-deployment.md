# Deployment — MVP public pentru feedback

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
- **Email in beta**: Mailpit ca sink SMTP cu UI public — verificarile de email se fac
  din UI-ul Mailpit. Pentru trecerea la SMTP real: seteaza `SMTP_HOST/PORT/USER/PASS`
  si `SMTP_SECURE=true` (suport adaugat in `MailService`) — zero schimbari de cod.
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
SMTP_HOST=${{mailpit.RAILWAY_PRIVATE_DOMAIN}}
SMTP_PORT=1025
MAIL_FROM=no-reply@cozyfable.app
JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / PAYMENT_WEBHOOK_SECRET / IP_HASH_SALT  (openssl rand -hex 32)
RAILWAY_DOCKERFILE_PATH=apps/backend/Dockerfile
```

Frontend (build args, injectate automat de Railway in ARG-urile din Dockerfile):
```
NEXT_PUBLIC_API_URL=/api/v1
BACKEND_INTERNAL_URL=https://<backend-domain>
RAILWAY_DOCKERFILE_PATH=apps/frontend/Dockerfile
```

## Stripe (plati credite + abonamente — decizie PO 2026-08-19, sprint L0-D)

Plata online = Stripe Checkout hosted (mode `payment`, moneda `ron`, suma = total CU TVA in
bani, sesiune expira in 30 min) + webhook semnat. Calea "confirmare admin"
(`POST /admin/payments/:id/confirm`) ramane fallback pentru transfer bancar; adminul poate si
acorda/prelungi abonamente manual (`POST /admin/subscriptions/grant`).

Variabile backend (optionale — lipsa lor = Stripe dezactivat: butoanele "Plateste" plaseaza
comanda PENDING si afiseaza datele de transfer bancar din `system_settings.seller_*`):
```
STRIPE_SECRET_KEY=sk_live_...        # sau sk_test_... (se seteaza IMPREUNA cu webhook secret)
STRIPE_WEBHOOK_SECRET=whsec_...      # din endpoint-ul creat in dashboard / `stripe listen`
STRIPE_PUBLISHABLE_KEY=pk_live_...   # optional, nefolosit de backend (Checkout e hosted)
FRONTEND_ORIGIN=https://<frontend>   # baza pentru success/cancel URL: /{ro|en}/marketplace/wallet?payment=...
```

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
Datele fiscale reale (`seller_name/cui/reg_com/address/iban`, `invoice_series`) trebuie setate
in Admin → Settings INAINTE de prima confirmare — snapshot-ul intra pe factura.

## Seed initial (o singura data, de pe masina locala)

```bash
cd apps/backend
DATABASE_URL=<DATABASE_PUBLIC_URL> pnpm prisma db seed          # config scoring + system settings
DATABASE_URL=<DATABASE_PUBLIC_URL> DEMO_PASSWORD=... DEMO_ADMIN_PASSWORD=... pnpm exec tsx prisma/seed-demo.ts
DATABASE_URL=<DATABASE_PUBLIC_URL> pnpm exec tsx prisma/seed-inspiration.ts
```

## Alternativa self-host

`dev-infra/docker-compose.prod.yml` ridica tot stackul (build din surse) pe un VPS
sau local: `docker compose -f dev-infra/docker-compose.prod.yml up -d --build` →
frontend pe :8080. Secretele se dau prin env la rulare.

## Verificare post-deploy

1. `GET https://<backend>/api/v1/health` → `{ status: "ok", checks: { db, redis, storage: "up" } }`
2. Frontend: landing se incarca, register → email vizibil in Mailpit UI → verify → login.
3. Configurator: creare cerere completa (inclusiv upload schita → presigned MinIO).
4. Cont firma demo: claim cerere + oferta; PDF oferta (Puppeteer/Chromium in container).
