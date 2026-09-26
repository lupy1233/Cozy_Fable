#!/usr/bin/env bash
# Setup O SINGURA DATA (idempotent) al bazei demo: rol+DB Postgres, apps/backend/.env,
# prisma generate + migrate deploy, seed-uri (config, demo, inspiratie), rescrierea
# pozelor de inspiratie catre pins/ locale, colectii demo, snapshot pentru reset rapid.
#   ./setup.sh           → sare peste ce exista deja
# Parola conturilor demo: DEMO_PASSWORD (implicit DemoCozy2026!).
set -euo pipefail
source "$(dirname "$0")/lib.sh"
export DEMO_PASSWORD="${DEMO_PASSWORD:-DemoCozy2026!}"
export PGPASSWORD=marketplace
BACKEND="$REPO/apps/backend"

"$DEMO_DIR/start.sh" infra >/dev/null

echo "== Postgres: rol + baza marketplace"
su postgres -c "psql -tAc \"select 1 from pg_roles where rolname='marketplace'\"" | grep -q 1 \
  || su postgres -c "psql -c \"CREATE ROLE marketplace LOGIN PASSWORD 'marketplace' CREATEDB\""
su postgres -c "psql -tAc \"select 1 from pg_database where datname='marketplace'\"" | grep -q 1 \
  || su postgres -c "psql -c \"CREATE DATABASE marketplace OWNER marketplace\""

echo "== apps/backend/.env (git-ignored)"
if [ ! -f "$BACKEND/.env" ]; then
  sed -e "s|^MESSAGE_ENCRYPTION_KEY=.*|MESSAGE_ENCRYPTION_KEY=$(openssl rand -hex 32)|" \
      -e "s|^NOMINATIM_BASE_URL=.*|NOMINATIM_BASE_URL=http://localhost:8088|" \
      -e "s|^NOMINATIM_USER_AGENT=.*|NOMINATIM_USER_AGENT=cozy-home-demo/1.0 (contact: dev@localhost)|" \
      -E -e 's/^(STRIPE_[A-Z_]+=)$/# \1   (gol = invalid la Zod; comentat = Stripe dezactivat)/' \
      "$BACKEND/.env.example" > "$BACKEND/.env"
  echo "  + creat"
else echo "  = exista"; fi

echo "== prisma generate + migrate deploy"
(cd "$REPO" && pnpm -F backend prisma:generate >/dev/null && pnpm -F backend exec prisma migrate deploy | tail -1)

echo "== seed-uri"
(cd "$REPO" && pnpm -F backend prisma:seed 2>&1 | grep -E "^Seed:" || true)
(cd "$REPO" && pnpm -F backend exec tsx prisma/seed-demo.ts 2>&1 | tail -1)
(cd "$REPO" && pnpm -F backend seed:inspiration 2>&1 | tail -1)

echo "== inspiratie → imagini locale (pins/)"
node "$DEMO_DIR/tools/rewrite-inspiration.mjs"

echo "== backend + colectii demo"
"$DEMO_DIR/start.sh" >/dev/null
node "$DEMO_DIR/tools/seed-boards.mjs"

echo "== snapshot (reset rapid cu ./reset-db.sh, pastreaza ID-urile)"
"$DEMO_DIR/snapshot.sh"
"$DEMO_DIR/ids.sh"
