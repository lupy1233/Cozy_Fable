#!/usr/bin/env bash
# Readuce baza la starea salvata (dupa filmari care au creat preluari/oferte/mesaje).
#   ./reset-db.sh          → data/snapshot.dump (starea cosmetizata; ID-urile din DEMO-ENV.md raman valabile)
#   ./reset-db.sh --base   → data/snapshot-base.dump (seed brut + pini + colectii, INAINTE de polish-data.mjs)
#   ./reset-db.sh --reseed → DB nou + setup.sh complet (ID-urile se schimba → ./ids.sh)
# NU rula cat timp alt agent face capturi: backendul se opreste ~10 s si sesiunile salvate se sterg.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
export PGPASSWORD=marketplace
SNAP="$DEMO_DIR/data/snapshot.dump"; TIMEF="$DEMO_DIR/data/snapshot.time"
if [ "${1:-}" = "--base" ]; then SNAP="$DEMO_DIR/data/snapshot-base.dump"; TIMEF="$DEMO_DIR/data/snapshot-base.time"; fi
stop_bg backend 3001        # frontendul ramane pornit (in modul lui)
redis-cli -p 6379 flushall >/dev/null 2>&1 || true   # cozi BullMQ + tokenuri email vechi
su postgres -c "psql -q -c 'DROP DATABASE IF EXISTS marketplace WITH (FORCE)' -c 'CREATE DATABASE marketplace OWNER marketplace'"
if [ "${1:-}" = "--reseed" ] || [ ! -f "$SNAP" ]; then
  echo "  .. fara snapshot → setup complet"
  exec "$DEMO_DIR/setup.sh"
fi
pg_restore -h localhost -U marketplace -d marketplace --no-owner "$SNAP"
# Decaleaza toate coloanele timestamp cu timpul scurs de la snapshot, ca datele sa
# arate ca imediat dupa seed („preluata acum 5 zile”, SLA/expirari/valabilitati in viitor).
# Exceptii: audit_logs (append-only), migrarile Prisma, calendarul de sarbatori.
if [ -f "$TIMEF" ]; then
  DELTA=$(( $(date +%s) - $(cat "$TIMEF") ))
  psql -h localhost -U marketplace -d marketplace -q -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE r record;
BEGIN
  FOR r IN SELECT table_name, column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND data_type LIKE 'timestamp%'
             AND table_name NOT IN ('audit_logs', '_prisma_migrations', 'business_calendar_holidays')
  LOOP
    EXECUTE format('UPDATE %I SET %I = %I + make_interval(secs => $DELTA) WHERE %I IS NOT NULL',
                   r.table_name, r.column_name, r.column_name, r.column_name);
  END LOOP;
END
\$\$;
SQL
  echo "  + date decalate cu ${DELTA}s"
fi
rm -f "$DEMO_DIR/data/auth/"*.json   # sesiunile salvate nu mai exista in DB
echo "  + DB restaurat din $(basename "$SNAP")"
"$DEMO_DIR/start.sh"
