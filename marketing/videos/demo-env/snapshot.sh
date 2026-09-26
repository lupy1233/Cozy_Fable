#!/usr/bin/env bash
# Salveaza starea curenta a DB-ului demo in data/snapshot.dump (+ momentul, pentru
# ca reset-db.sh sa decaleze datele calendaristice la restaurare).
set -euo pipefail
source "$(dirname "$0")/lib.sh"
export PGPASSWORD=marketplace
# ./snapshot.sh → data/snapshot.dump ; ./snapshot.sh base → data/snapshot-base.dump (inainte de polish)
NAME="snapshot"; [ "${1:-}" = "base" ] && NAME="snapshot-base"
pg_dump -h localhost -U marketplace -d marketplace -Fc -f "$DEMO_DIR/data/$NAME.dump"
date +%s > "$DEMO_DIR/data/$NAME.time"
echo "  + data/$NAME.dump ($(du -h "$DEMO_DIR/data/$NAME.dump" | cut -f1), $(date -Is))"
