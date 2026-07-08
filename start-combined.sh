#!/bin/bash
# Porneste backendul (127.0.0.1:3001) si frontendul (PORT-ul public) in acelasi
# container. Daca oricare proces moare, containerul iese si Railway il reporneste.
set -e

PUBLIC_PORT="${PORT:-3000}"

cd /app/apps/backend
./node_modules/.bin/prisma migrate deploy

PORT=3001 node dist/main.js &
BACK_PID=$!

cd /app/web
PORT="$PUBLIC_PORT" HOSTNAME=0.0.0.0 node apps/frontend/server.js &
FRONT_PID=$!

wait -n "$BACK_PID" "$FRONT_PID"
exit 1
