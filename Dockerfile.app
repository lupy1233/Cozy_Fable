# Aplicatia completa (backend NestJS + frontend Next standalone) intr-UN container.
# Motiv: limita de 5 servicii pe planul free Railway — Next oricum proxy-eaza
# /api/v1 si /socket.io, deci backendul sta pe 127.0.0.1 in acelasi pod
# (LISTEN_HOST=127.0.0.1 in start-combined.sh, E-admin-platform-56).
# Build context = radacina monorepo-ului: docker build -f Dockerfile.app .

FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS build
ENV PUPPETEER_SKIP_DOWNLOAD=1
# openssl INAINTE de install/generate — altfel Prisma descarca engine openssl-1.1.x
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/backend apps/backend
COPY apps/frontend apps/frontend

# NEXT_PUBLIC_* se coc in bundle; backendul e local in container → 127.0.0.1
ARG NEXT_PUBLIC_API_URL=/api/v1
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Adresa de suport publica (security.txt, contact la cont blocat); gol = nepublicata
ARG NEXT_PUBLIC_SUPPORT_EMAIL=
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
ARG BACKEND_INTERNAL_URL=http://127.0.0.1:3001
# E-admin-platform-8: tracker de erori + statistici fara cookie-uri; goale = dezactivate.
# RELEASE_SHA e deja setat per slot in Railway (declarat ca ARG → primit la build).
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG NEXT_PUBLIC_ANALYTICS_PROVIDER=
ARG NEXT_PUBLIC_ANALYTICS_HOST=
ARG NEXT_PUBLIC_ANALYTICS_SITE_ID=
ARG RELEASE_SHA=
# E-admin-platform-56: originile https ale storage-ului (presigned GET/PUT) si hosturi de imagini
# in plus (separate prin virgula) pentru CSP (lib/csp.ts). Goale = img-src/connect-src raman
# largi (https:). Schimbarea lor (ex. migrarea storage-ului in EU) = REBUILD al slotului.
ARG NEXT_PUBLIC_STORAGE_ORIGIN=
ARG NEXT_PUBLIC_CSP_IMG_ORIGINS=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_ANALYTICS_PROVIDER=$NEXT_PUBLIC_ANALYTICS_PROVIDER \
    NEXT_PUBLIC_ANALYTICS_HOST=$NEXT_PUBLIC_ANALYTICS_HOST \
    NEXT_PUBLIC_ANALYTICS_SITE_ID=$NEXT_PUBLIC_ANALYTICS_SITE_ID \
    NEXT_PUBLIC_RELEASE_SHA=$RELEASE_SHA \
    NEXT_PUBLIC_STORAGE_ORIGIN=$NEXT_PUBLIC_STORAGE_ORIGIN \
    NEXT_PUBLIC_CSP_IMG_ORIGINS=$NEXT_PUBLIC_CSP_IMG_ORIGINS \
    BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL

RUN mkdir -p apps/frontend/public \
  && pnpm -F @marketplace/shared build \
  && pnpm -F backend exec prisma generate \
  && pnpm -F backend build \
  && test -f apps/backend/dist/main.js \
  && pnpm -F frontend build

# E-admin-platform-56 (SEC2-14): doar dependintele de PRODUCTIE ale backendului (+ shared) pentru
# runtime — fara vitest/jest/@nestjs/cli/typescript-eslint in imagine. prisma e in dependencies
# (migrate deploy din start-combined.sh), deci clientul se genereaza si aici.
FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS proddeps
ENV PUPPETEER_SKIP_DOWNLOAD=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY packages/shared/package.json packages/shared/
COPY apps/backend/prisma/schema.prisma apps/backend/prisma/schema.prisma
RUN pnpm install --frozen-lockfile --prod --filter backend... \
  && pnpm -F backend exec prisma generate

FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5
# Chromium de sistem pentru Puppeteer (PDF oferte/facturi).
# E-admin-platform-56: `apt-get upgrade` aduce fixurile de securitate Debian intre bump-urile de
# digest (poarta Trivy HIGH/CRITICAL din CI); npm/npx/corepack globale ale imaginii node nu sunt
# folosite in runtime (start-combined.sh ruleaza direct node) si aduceau CVE-uri, deci se sterg.
RUN apt-get update \
  && apt-get -y upgrade \
  && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-dejavu-core openssl \
  && rm -rf /var/lib/apt/lists/* \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app
# Pastram graful pnpm la aceleasi cai: symlink-urile backend/shared si Prisma CLI
# depind de store-ul radacina. Nu copiem sursele sau .next/cache/standalone dublat.
# E-admin-platform-56: node_modules vin din stagiul proddeps (install --prod filtrat pe backend),
# nu din build → fara dependinte de dezvoltare in runtime; dist-urile raman din build.
COPY --from=proddeps --chown=node:node /app/node_modules /app/node_modules
COPY --from=proddeps --chown=node:node /app/apps/backend/node_modules /app/apps/backend/node_modules
COPY --from=build --chown=node:node /app/apps/backend/package.json /app/apps/backend/package.json
COPY --from=build --chown=node:node /app/apps/backend/dist /app/apps/backend/dist
COPY --from=build --chown=node:node /app/apps/backend/prisma/schema.prisma /app/apps/backend/prisma/schema.prisma
COPY --from=build --chown=node:node /app/apps/backend/prisma/migrations /app/apps/backend/prisma/migrations
COPY --from=proddeps --chown=node:node /app/packages/shared/node_modules /app/packages/shared/node_modules
COPY --from=build --chown=node:node /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=build --chown=node:node /app/packages/shared/dist /app/packages/shared/dist
# frontend standalone izolat sub /app/web (are node_modules propriu, minimal)
COPY --from=build --chown=node:node /app/apps/frontend/.next/standalone /app/web
COPY --from=build --chown=node:node /app/apps/frontend/.next/static /app/web/apps/frontend/.next/static
COPY --from=build --chown=node:node /app/apps/frontend/public /app/web/apps/frontend/public
COPY --chown=node:node start-combined.sh /app/start-combined.sh
# procesele NU ruleaza ca root (audit 2026-08-19); Chromium merge ca user neprivilegiat
USER node
# Verificare fara DB/retea: graful pnpm si clientul Prisma generat trebuie sa ramana rezolvabile.
RUN cd /app/apps/backend \
  && test -f dist/main.js \
  && test -x node_modules/.bin/prisma \
  && test -f prisma/migrations/migration_lock.toml \
  && node -e "require.resolve('prisma/package.json'); if (require('@marketplace/shared').PIECE3D_KINDS.length < 10 || !require('@prisma/client').Prisma.dmmf.datamodel.models.some(m => m.name === 'DomainEventOutbox')) process.exit(1)" \
  && test -z "$(ls /app/node_modules/.pnpm | grep -E '^(vitest|vite|jest|@nestjs\+cli|typescript-eslint|@typescript-eslint)@')"
EXPOSE 3000
CMD ["bash", "/app/start-combined.sh"]
