#!/usr/bin/env bash
# Starea serviciilor demo + unde le gasesti.
set -uo pipefail
source "$(dirname "$0")/lib.sh"
row() { # row <nume> <port> <descriere>
  if port_open "$2"; then printf "  %-10s UP    :%-5s %s\n" "$1" "$2" "$3"; else printf "  %-10s DOWN  :%-5s %s\n" "$1" "$2" "$3"; fi
}
echo "== Cozy Home demo-env (loguri: $LOGS)"
row postgres 5432 "postgresql://marketplace:marketplace@localhost:5432/marketplace"
row redis 6379 "redis://localhost:6379"
row s3 9000 "http://localhost:9000 (s3rver, bucket uploads, minioadmin/minioadmin)"
row smtp 1025 "smtp://localhost:1025 (sink → demo-env/data/mail/*.eml, log logs/smtp.log)"
row nominatim 8088 "http://localhost:8088/search (mock geocoding)"
row pins 8099 "http://localhost:8099/ (imagini inspiratie inlocuitoare)"
row backend 3001 "http://localhost:3001/api/v1 (health: /api/v1/health)"
row frontend 3000 "http://localhost:3000/ro"
if port_open 3001; then
  printf "  health: %s\n" "$(curl -s -m 5 http://localhost:3001/api/v1/health)"
fi
