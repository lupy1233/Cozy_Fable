# Deployment — MVP public pentru feedback

Data: 2026-07-08. Target ales: **Railway** (toate serviciile intr-un singur proiect,
suport Docker + volume + private networking, websockets, fara card pe trial).

## Arhitectura de deploy

```
Browser
  │ https (same-origin)
  ▼
[frontend]  Next.js standalone (Dockerfile) — proxy /api/v1 + /socket.io → backend
  │ https (rewrite server-side)
  ▼
[backend]   NestJS + Prisma (Dockerfile, Chromium pt PDF) — migrate deploy la boot
  │ private networking
  ├── [Postgres]  (plugin Railway)
  ├── [Redis]     (plugin Railway; REDIS_PASSWORD obligatoriu)
  ├── [minio]     bitnami/minio + volum — S3 presigned URLs (domeniu public, port 9000)
  └── [mailpit]   axllent/mailpit — sink SMTP beta (UI public pe 8025)
```

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
