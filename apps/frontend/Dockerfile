# Frontend Next.js 14 (output standalone). Build context = RADACINA monorepo-ului.
# docker build -f apps/frontend/Dockerfile .

FROM node:20-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/frontend/package.json apps/frontend/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter frontend... --filter @marketplace/shared...

COPY packages/shared packages/shared
COPY apps/frontend apps/frontend

# NEXT_PUBLIC_* se "coc" in bundle la build; BACKEND_INTERNAL_URL intra in rewrites.
ARG NEXT_PUBLIC_API_URL=/api/v1
ARG NEXT_PUBLIC_SOCKET_URL=
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
ARG BACKEND_INTERNAL_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
    BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL

# public/ e optional in Next; il garantam ca sa existe pentru COPY-ul din stagiul final
RUN mkdir -p apps/frontend/public \
  && pnpm -F @marketplace/shared build \
  && pnpm -F frontend build

FROM node:20-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
# structura standalone pastreaza layoutul monorepo: server.js e sub apps/frontend/
COPY --from=build /app/apps/frontend/.next/standalone ./
COPY --from=build /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build /app/apps/frontend/public ./apps/frontend/public
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
