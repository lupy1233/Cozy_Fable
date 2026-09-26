#!/usr/bin/env bash
# Salveaza starea curenta a DB-ului demo in data/snapshot.dump (+ momentul, pentru
# ca reset-db.sh sa decaleze datele calendaristice la restaurare).
set -euo pipefail
source "$(dirname "$0")/lib.sh"
export PGPASSWORD=marketplace
pg_dump -h localhost -U marketplace -d marketplace -Fc -f "$DEMO_DIR/data/snapshot.dump"
date +%s > "$DEMO_DIR/data/snapshot.time"
echo "  + data/snapshot.dump ($(du -h "$DEMO_DIR/data/snapshot.dump" | cut -f1), $(date -Is))"
