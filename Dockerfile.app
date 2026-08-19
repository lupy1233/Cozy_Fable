# Aplicatia completa (backend NestJS + frontend Next standalone) intr-UN container.
# Motiv: limita de 5 servicii pe planul free Railway — Next oricum proxy-eaza
# /api/v1 si /socket.io, deci backendul poate sta pe 127.0.0.1 in acelasi pod.
# Build context = radacina monorepo-ului: docker build -f Dockerfile.app .

FROM node:22-bookworm-slim AS build
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
ARG NEXT_PUBLIC_SITE_URL=
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
ARG BACKEND_INTERNAL_URL=http://127.0.0.1:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
    BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL

RUN mkdir -p apps/frontend/public \
  && pnpm -F @marketplace/shared build \
  && pnpm -F backend exec prisma generate \
  && pnpm -F backend build \
  && pnpm -F frontend build

FROM node:22-bookworm-slim
# Chromium de sistem pentru Puppeteer (PDF oferte/facturi)
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-dejavu-core openssl \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app
# workspace-ul complet (backend dist + node_modules + prisma CLI pentru migrate deploy)
COPY --from=build --chown=node:node /app ./
# frontend standalone izolat sub /app/web (are node_modules propriu, minimal)
COPY --from=build --chown=node:node /app/apps/frontend/.next/standalone /app/web
COPY --from=build --chown=node:node /app/apps/frontend/.next/static /app/web/apps/frontend/.next/static
COPY --from=build --chown=node:node /app/apps/frontend/public /app/web/apps/frontend/public
COPY --chown=node:node start-combined.sh /app/start-combined.sh
# procesele NU ruleaza ca root (audit 2026-08-19); Chromium merge ca user neprivilegiat
USER node
EXPOSE 3000
CMD ["bash", "/app/start-combined.sh"]
