#!/usr/bin/env bash
# Opreste mediul demo. ./stop.sh → tot; ./stop.sh app → doar backend+frontend (infra ramane).
set -uo pipefail
source "$(dirname "$0")/lib.sh"
ONLY="${1:-all}"
stop_bg frontend 3000
stop_bg backend 3001
[ "$ONLY" = "app" ] && exit 0
stop_bg pins 8099
stop_bg nominatim 8088
stop_bg smtp 1025
stop_bg s3 9000
if port_open 6379; then redis-cli -p 6379 shutdown nosave >/dev/null 2>&1; sleep 1; fi
port_open 6379 && echo "  !! redis inca activ" || echo "  - redis oprit"
if port_open 5432; then service postgresql stop >/dev/null 2>&1 || pg_ctlcluster 16 main stop; fi
port_open 5432 && echo "  !! postgres inca activ" || echo "  - postgres oprit (datele raman in cluster 16/main)"
