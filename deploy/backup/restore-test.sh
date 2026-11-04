#!/usr/bin/env bash
# Job lunar (cron Railway): restaureaza cel mai nou backup zilnic intr-un cluster PG temporar,
# verifica migratiile, triggerul de audit si numarul de randuri, apoi trimite raportul pe email adminului.
BACKUP_JOB=backup-restore-test
JOB_LABEL="test lunar de restaurare"
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

PGR_DIR="$BACKUP_WORK_DIR/pgr"
PGR_PORT="${RESTORE_PG_PORT:-55432}"
ID_FILE="$BACKUP_WORK_DIR/id.txt"
MAX_BACKUP_AGE_HOURS="${RESTORE_MAX_BACKUP_AGE_HOURS:-36}"
# Tabele care se schimba intre numarare (manifest) si dump: diferentele sunt doar informative.
VOLATILE_TABLES=" refresh_tokens idempotency_keys domain_event_outbox notifications "

cleanup() {
  if [[ -f $PGR_DIR/postmaster.pid ]]; then
    pg_ctl -D "$PGR_DIR" -m fast -w stop > /dev/null 2>&1 || true
  fi
  rm -rf "$PGR_DIR" "$ID_FILE" "$BACKUP_WORK_DIR"/cozy-*.dump "$BACKUP_WORK_DIR"/cozy-*.dump.age \
    "$BACKUP_WORK_DIR"/cozy-*.sha256 "$BACKUP_WORK_DIR"/cozy-*.manifest.json "$BACKUP_WORK_DIR"/pgr.log
  return 0
}
install_exit_trap

problems=()
notes=()
add_problem() {
  problems+=("$1")
  log warn "problema: $1"
}

# 1) Configurare
step config
umask 077
# shellcheck disable=SC2046
require_env BACKUP_AGE_IDENTITY OFFSITE_S3_ENDPOINT OFFSITE_S3_ACCESS_KEY OFFSITE_S3_SECRET_KEY OFFSITE_S3_BUCKET $(mail_env_names)
setup_rclone_remotes
SQL_DIR="$(dirname "$0")"
DAILY_DIR="$OFFSITE_ROOT/db/daily"
MONTHLY_DIR="$OFFSITE_ROOT/db/monthly"

# 2) Cel mai nou backup zilnic + sha256 + varsta
step select_backup
daily_list=$(run rclone lsf --files-only "$DAILY_DIR/")
latest=$(grep -E '^cozy-[0-9]{8}T[0-9]{6}Z\.dump\.age$' <<< "$daily_list" | sort | tail -n 1 || true)
if [[ -z $latest ]]; then
  fail "niciun backup zilnic in $OFFSITE_PREFIX/db/daily"
fi
STEM=${latest%.dump.age}
daily_copies=$(grep -c '\.dump\.age$' <<< "$daily_list" || true)
monthly_copies=$(run rclone lsf --files-only "$MONTHLY_DIR/" 2>/dev/null | grep -c '\.dump\.age$' || true)
AGE_FILE="$BACKUP_WORK_DIR/$STEM.dump.age"
DUMP_FILE="$BACKUP_WORK_DIR/$STEM.dump"
MANIFEST_FILE="$BACKUP_WORK_DIR/$STEM.manifest.json"
run rclone copyto "$DAILY_DIR/$STEM.dump.age" "$AGE_FILE"
run rclone copyto "$DAILY_DIR/$STEM.dump.age.sha256" "$AGE_FILE.sha256"
run rclone copyto "$DAILY_DIR/$STEM.manifest.json" "$MANIFEST_FILE"
expected_sha=$(cut -d' ' -f1 "$AGE_FILE.sha256")
actual_sha=$(sha256sum "$AGE_FILE" | cut -d' ' -f1)
if [[ $expected_sha != "$actual_sha" ]]; then
  fail "sha256 diferit pentru $STEM.dump.age"
fi
size_bytes=$(stat -c %s "$AGE_FILE")
ts=${STEM#cozy-}
backup_epoch=$(date -u -d "${ts:0:4}-${ts:4:2}-${ts:6:2} ${ts:9:2}:${ts:11:2}:${ts:13:2}" +%s)
age_hours=$(( ($(date -u +%s) - backup_epoch) / 3600 ))
if (( age_hours > MAX_BACKUP_AGE_HOURS )); then
  add_problem "cel mai nou backup are $age_hours h (limita $MAX_BACKUP_AGE_HOURS h): jobul zilnic nu a mers"
fi
log info "backup ales" "\"stem\":\"$STEM\",\"size_bytes\":$size_bytes,\"age_hours\":$age_hours"

# 3) Decriptare (identitatea exista pe disc doar cat ruleaza age)
step decrypt
printf '%s\n' "$BACKUP_AGE_IDENTITY" > "$ID_FILE"
chmod 600 "$ID_FILE"
run age -d -i "$ID_FILE" -o "$DUMP_FILE" "$AGE_FILE"
rm -f "$ID_FILE" "$AGE_FILE"

# 4) Cluster temporar + restaurare cronometrata
step restore
run initdb -D "$PGR_DIR" -U restore --auth=trust -E UTF8 --locale=C.UTF-8 > /dev/null
run pg_ctl -D "$PGR_DIR" -o "-p $PGR_PORT -k $BACKUP_WORK_DIR -c listen_addresses=''" \
  -l "$BACKUP_WORK_DIR/pgr.log" -w start > /dev/null
run createdb -h "$BACKUP_WORK_DIR" -p "$PGR_PORT" -U restore cozy_restore
t0=$(date +%s%3N)
run pg_restore --no-owner --no-acl --exit-on-error -h "$BACKUP_WORK_DIR" -p "$PGR_PORT" -U restore \
  -d cozy_restore "$DUMP_FILE"
restore_ms=$(( $(date +%s%3N) - t0 ))
restore_seconds=$(printf '%d.%01d' $((restore_ms / 1000)) $(((restore_ms % 1000) / 100)))
rm -f "$DUMP_FILE"
log info "restaurare terminata" "\"restore_ms\":$restore_ms"

# 5) Verificari pe copia restaurata
step verify
manifest=$(cat "$MANIFEST_FILE")
restored=$(run psql -h "$BACKUP_WORK_DIR" -p "$PGR_PORT" -U restore -d cozy_restore \
  -X -q -v ON_ERROR_STOP=1 -At -f "$SQL_DIR/row-counts.sql")
live='{}'
live_label='—'
if [[ -n ${DATABASE_URL:-} ]]; then
  if live=$(run psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -At -f "$SQL_DIR/row-counts.sql"); then
    live_label='live acum'
  else
    live='{}'
    notes+=("baza live nu a putut fi citita (coloana „live acum” lipsește)")
  fi
fi

field() { jq -r "$2" <<< "$1"; }
m_migrations=$(field "$manifest" '.migrations_finished')
r_migrations=$(field "$restored" '.migrations_finished')
m_last=$(field "$manifest" '.last_migration')
r_last=$(field "$restored" '.last_migration')
r_trigger=$(field "$restored" '.audit_trigger_present')
r_users=$(field "$restored" '.row_counts.users // 0')
if [[ $m_migrations != "$r_migrations" ]]; then
  add_problem "migratii: manifest $m_migrations, restaurat $r_migrations"
fi
if [[ $m_last != "$r_last" ]]; then
  add_problem "ultima migratie: manifest $m_last, restaurat $r_last"
fi
if [[ $r_trigger != true ]]; then
  add_problem "triggerul audit_logs_no_update_delete lipseste din copia restaurata"
fi
if (( r_users <= 0 )); then
  add_problem "tabela users e goala in copia restaurata"
fi

table_lines=$(jq -r -n --argjson m "$manifest" --argjson r "$restored" --argjson l "$live" '
  ((($m.row_counts // {}) | keys) + (($r.row_counts // {}) | keys) | unique)[] as $t
  | [$t, ($m.row_counts[$t] // "-" | tostring), ($r.row_counts[$t] // "-" | tostring), ($l.row_counts[$t] // "-" | tostring)]
  | @tsv')
table_report=$(printf '%-34s %12s %12s %12s\n' 'tabel' 'backup' 'restaurat' "$live_label")
table_report+=$'\n'$(printf '%s\n' "$(printf '%.0s-' {1..73})")
diff_tables=0
while IFS=$'\t' read -r table backup_n restored_n live_n; do
  [[ -n $table ]] || continue
  table_report+=$'\n'$(printf '%-34s %12s %12s %12s' "$table" "$backup_n" "$restored_n" "$live_n")
  if [[ $backup_n != "$restored_n" ]]; then
    diff_tables=$((diff_tables + 1))
    if [[ $VOLATILE_TABLES == *" $table "* ]]; then
      notes+=("$table: $backup_n în manifest, $restored_n restaurate (tabel volatil, informativ)")
    else
      add_problem "randuri diferite in $table: manifest $backup_n, restaurat $restored_n"
    fi
  fi
done <<< "$table_lines"

# 6) Fisiere off-site (informativ)
step uploads
uploads_json=$(run rclone size --json "$OFFSITE_ROOT/uploads" 2>/dev/null || printf '{"count":0,"bytes":0}')
uploads_count=$(field "$uploads_json" '.count')
uploads_bytes=$(field "$uploads_json" '.bytes')
newest_upload=$(run rclone lsf -R --files-only --format t "$OFFSITE_ROOT/uploads" 2>/dev/null | sort | tail -n 1 || true)
history_days=$(run rclone lsf --dirs-only "$OFFSITE_ROOT/uploads-history/" 2>/dev/null | grep -c . || true)

# 7) Raport (doar numere si nume de tabele, fara date personale)
step report
status=OK
status_label=OK
if (( ${#problems[@]} > 0 )); then
  status=ESUAT
  status_label=EȘUAT
fi
if [[ $r_trigger == true ]]; then trigger_label=prezent; else trigger_label=LIPSĂ; fi
report=$(mktemp "$BACKUP_WORK_DIR/report.XXXXXX")
{
  printf 'Test lunar de restaurare a backupului — Cozy Home\n'
  printf 'Rezultat: %s\n' "$status_label"
  printf 'Data testului (UTC): %s\n\n' "$(date -u '+%Y-%m-%d %H:%M')"
  printf 'Backup folosit: %s.dump.age\n' "$STEM"
  printf 'Vârsta backupului: %s ore (limită %s ore)\n' "$age_hours" "$MAX_BACKUP_AGE_HOURS"
  printf 'Mărime (criptat): %s octeți\n' "$size_bytes"
  printf 'Verificare sha256: OK\n'
  printf 'Durata restaurării (pg_restore): %s s — componenta măsurată a RTO\n' "$restore_seconds"
  printf 'PostgreSQL sursă: %s; restaurare: %s; %s\n\n' "$(field "$manifest" '.pg_server_version')" \
    "$(field "$restored" '.pg_server_version')" "$(field "$manifest" '.pg_dump_version')"
  printf 'Migrații terminate: %s în backup, %s în copia restaurată\n' "$m_migrations" "$r_migrations"
  printf 'Ultima migrație: %s\n' "$r_last"
  printf 'Trigger audit (audit_logs_no_update_delete): %s\n' "$trigger_label"
  printf 'Tabele cu diferențe: %s\n\n' "$diff_tables"
  printf 'Rânduri per tabel:\n%s\n\n' "$table_report"
  printf 'Fișiere off-site (uploads/): %s obiecte, %s octeți\n' "$uploads_count" "$uploads_bytes"
  printf 'Cel mai nou fișier în oglindă: %s\n' "${newest_upload:-—}"
  printf 'Istoric fișiere (uploads-history): %s directoare zilnice\n' "$history_days"
  printf 'Copii în bucketul off-site: %s zilnice, %s lunare\n\n' "$daily_copies" "$monthly_copies"
  printf 'Probleme:\n'
  if (( ${#problems[@]} == 0 )); then
    printf -- '- niciuna\n'
  else
    printf -- '- %s\n' "${problems[@]}"
  fi
  if (( ${#notes[@]} > 0 )); then
    printf '\nNote:\n'
    printf -- '- %s\n' "${notes[@]}"
  fi
  printf '\nProcedura de restaurare manuală: docs/08-deployment.md, secțiunea „Backup și restaurare”.\n'
} > "$report"
send_mail "[Cozy Home] Test lunar de restaurare backup — $status_label" "$report"
REPORT_SENT=true
rm -f "$report"

# 8) Final
step done
if [[ $MAIL_FAILED == true ]]; then
  fail "raportul nu a putut fi trimis pe email"
fi
if [[ $status == OK ]]; then
  heartbeat
  log info "restore-test ok" "\"stem\":\"$STEM\",\"restore_ms\":$restore_ms,\"tables\":$(field "$restored" '.row_counts | length')"
  exit 0
fi
log error "restore-test esuat" "\"problems\":${#problems[@]}"
exit 1
