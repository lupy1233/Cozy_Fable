#!/bin/bash
# Porneste backendul (127.0.0.1:3001) si frontendul (PORT-ul public) in acelasi
# container. Daca oricare proces moare, containerul iese si Railway il reporneste.
# SIGTERM (redeploy/scale) e trimis mai departe la ambele procese, ca hook-urile de
# shutdown (Prisma/BullMQ/Puppeteer) sa ruleze in loc sa fie SIGKILL-uite (audit 2026-08-19).
set -e

PUBLIC_PORT="${PORT:-3000}"

cd /app/apps/backend
./node_modules/.bin/prisma migrate deploy

PORT=3001 node dist/main.js &
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
