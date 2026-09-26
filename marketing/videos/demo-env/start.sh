#!/usr/bin/env bash
# Porneste TOT mediul demo Cozy Home fara Docker (idempotent: ce ruleaza deja e sarit).
#   ./start.sh            → infra + backend + frontend (in ultimul mod folosit; implicit next dev)
#   FRONTEND_MODE=prod ./start.sh  → frontend din build de productie (next build + next start;
#                                    fara overlay-ul de dev, navigare instant — recomandat la filmare)
#   FRONTEND_MODE=dev ./start.sh   → inapoi la next dev (hot reload)
#   ./start.sh infra      → doar Postgres/Redis/S3/SMTP/Nominatim/pini
set -uo pipefail
source "$(dirname "$0")/lib.sh"
ONLY="${1:-all}"
# modul frontendului: FRONTEND_MODE explicit > ultimul mod folosit (data/frontend-mode) > dev
FRONTEND_MODE="${FRONTEND_MODE:-$(cat "$DEMO_DIR/data/frontend-mode" 2>/dev/null || echo dev)}"

echo "== infra"
if port_open 5432; then echo "  = postgres deja activ pe :5432"; else
  service postgresql start >/dev/null 2>&1 || pg_ctlcluster 16 main start
  wait_port 5432 20 postgres && echo "  + postgres pornit (cluster 16/main)"
fi
if port_open 6379; then echo "  = redis deja activ pe :6379"; else
  redis-server --daemonize yes --port 6379 --dir "$DEMO_DIR/data/redis" \
    --logfile "$LOGS/redis.log" --pidfile "$PIDS/redis.pid" --save "" --appendonly no
  wait_port 6379 10 redis && echo "  + redis pornit"
fi
start_bg s3 9000 node s3.mjs
start_bg smtp 1025 node smtp.mjs
start_bg nominatim 8088 node nominatim.mjs
start_bg pins 8099 node pins-server.mjs
wait_port 9000 15 s3; wait_port 1025 10 smtp; wait_port 8088 10 nominatim; wait_port 8099 10 pins

[ "$ONLY" = "infra" ] && exec "$DEMO_DIR/status.sh"

echo "== backend (:3001)"
if port_open 3001; then echo "  = backend deja activ pe :3001"; else
  cd "$REPO/apps/backend"
  [ -f .env ] || { echo "  !! apps/backend/.env lipseste (vezi DEMO-ENV.md §Setup o singura data)"; exit 1; }
  # build doar daca lipseste dist sau sursele sunt mai noi
  if [ ! -f dist/main.js ] || [ -n "$(find src -newer dist/main.js -name '*.ts' -print -quit)" ]; then
    echo "  .. nest build (log logs/backend-build.log)"
    pnpm build >"$LOGS/backend-build.log" 2>&1 || { echo "  !! build esuat"; tail -20 "$LOGS/backend-build.log"; exit 1; }
  fi
  start_bg backend 3001 bash -c "cd '$REPO/apps/backend' && exec node dist/main.js"
  wait_port 3001 60 backend
fi

echo "== frontend (:3000, mod $FRONTEND_MODE)"
if port_open 3000; then echo "  = frontend deja activ pe :3000"; else
  cd "$REPO/apps/frontend"
  if [ "$FRONTEND_MODE" = "prod" ]; then
    if [ ! -f .next/BUILD_ID ] || [ -n "$(find src public -newer .next/BUILD_ID -type f -print -quit)" ] || [ -f .next/.dev-mode ]; then
      echo "  .. next build (2-4 min, log logs/frontend-build.log)"
      rm -rf .next
      pnpm build >"$LOGS/frontend-build.log" 2>&1 || { echo "  !! next build esuat"; tail -20 "$LOGS/frontend-build.log"; exit 1; }
    fi
    start_bg frontend 3000 bash -c "cd '$REPO/apps/frontend' && exec ./node_modules/.bin/next start -p 3000"
  else
    # un .next de productie ramas nu strica next dev, dar marcam modul ca prod sa rebuild-uiasca
    mkdir -p .next && touch .next/.dev-mode
    start_bg frontend 3000 bash -c "cd '$REPO/apps/frontend' && exec ./node_modules/.bin/next dev -p 3000"
  fi
  wait_port 3000 90 frontend && echo "$FRONTEND_MODE" > "$DEMO_DIR/data/frontend-mode"
fi

exec "$DEMO_DIR/status.sh"
