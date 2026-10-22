#!/bin/bash
# Porneste backendul (legat DOAR de 127.0.0.1:3001 prin LISTEN_HOST, E-admin-platform-56:
# nu se vede din reteaua privata a proiectului) si frontendul (PORT-ul public) in acelasi
# container; Next ajunge la Nest prin rewrite-ul loopback (BACKEND_INTERNAL_URL). Daca oricare proces moare, containerul iese si Railway il reporneste.
# SIGTERM (redeploy/scale) e trimis mai departe la ambele procese, ca hook-urile de
# shutdown (Prisma/BullMQ/Puppeteer) sa ruleze in loc sa fie SIGKILL-uite (audit 2026-08-19).
set -e

PUBLIC_PORT="${PORT:-3000}"
DEPLOYMENT_MODE="${DEPLOYMENT_MODE:-active}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"

case "$DEPLOYMENT_MODE" in
  active|standby) ;;
  *) echo "start-combined: DEPLOYMENT_MODE trebuie sa fie active sau standby" >&2; exit 1 ;;
esac

case "$RUN_MIGRATIONS" in
  true|false) ;;
  *) echo "start-combined: RUN_MIGRATIONS trebuie sa fie true sau false" >&2; exit 1 ;;
esac

if [ "$DEPLOYMENT_MODE" = "standby" ] && [ "$RUN_MIGRATIONS" != "false" ]; then
  echo "start-combined: un slot standby nu poate rula migratii" >&2
  exit 1
fi

cd /app/apps/backend
if [ "$RUN_MIGRATIONS" = "true" ]; then
  ./node_modules/.bin/prisma migrate deploy
else
  echo "start-combined: migratiile sunt dezactivate pentru acest slot"
fi

LISTEN_HOST=127.0.0.1 PORT=3001 node dist/main.js &
BACK_PID=$!

cd /app/web
PORT="$PUBLIC_PORT" HOSTNAME=0.0.0.0 node apps/frontend/server.js &
FRONT_PID=$!

shutdown() {
  echo "start-combined: semnal primit, opresc procesele..."
  kill -TERM "$BACK_PID" "$FRONT_PID" 2>/dev/null || true
  wait "$BACK_PID" "$FRONT_PID" 2>/dev/null || true
  exit 0
}
trap shutdown TERM INT

# `wait -n` iese la primul proces terminat; `set -e` nu se aplica la `wait`,
# deci verificam explicit si iesim cu cod != 0 ca Railway sa reporneasca.
wait -n "$BACK_PID" "$FRONT_PID"
echo "start-combined: un proces s-a oprit neasteptat, ies"
kill -TERM "$BACK_PID" "$FRONT_PID" 2>/dev/null || true
exit 1
