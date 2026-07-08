# Backend NestJS + Prisma. Build context = RADACINA monorepo-ului (pnpm workspace).
# docker build -f apps/backend/Dockerfile .

FROM node:20-bookworm-slim AS build
ENV PUPPETEER_SKIP_DOWNLOAD=1
# openssl e necesar INAINTE de install/generate: fara el Prisma nu detecteaza
# platforma si descarca engine-uri openssl-1.1.x (crash pe bookworm la runtime)
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter backend... --filter @marketplace/shared...

COPY packages/shared packages/shared
COPY apps/backend apps/backend
RUN pnpm -F @marketplace/shared build \
  && pnpm -F backend exec prisma generate \
  && pnpm -F backend build

FROM node:20-bookworm-slim
# Chromium de sistem pentru Puppeteer (PDF oferte/facturi) + fonturi
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-dejavu-core openssl \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app
COPY --from=build /app ./
WORKDIR /app/apps/backend
EXPOSE 3001
# Migratiile ruleaza la boot (idempotent), apoi porneste API-ul
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
