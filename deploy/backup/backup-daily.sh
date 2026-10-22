#!/usr/bin/env bash
# Job zilnic (cron Railway): pg_dump criptat cu age + manifest numeric -> bucket off-site,
# copie lunara, oglinda fisierelor cu istoric 30 zile, retentie. Vezi docs/08 „Backup si restaurare".
BACKUP_JOB=backup-daily
JOB_LABEL="backup zilnic"
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

DUMP_FILE=''
SNAPSHOT_PID=''
cleanup() {
  if [[ -n $SNAPSHOT_PID ]]; then
    kill "$SNAPSHOT_PID" 2>/dev/null || true
  fi
  if [[ -n $DUMP_FILE && -f $DUMP_FILE ]]; then
    shred -u "$DUMP_FILE" 2>/dev/null || rm -f "$DUMP_FILE"
  fi
  rm -f "$BACKUP_WORK_DIR"/cozy-*.dump.age "$BACKUP_WORK_DIR"/cozy-*.sha256 "$BACKUP_WORK_DIR"/cozy-*.manifest.json
  return 0
}
install_exit_trap

# 1) Configurare
step config
umask 077
if [[ -n ${BACKUP_AGE_IDENTITY:-} ]]; then
  fail "BACKUP_AGE_IDENTITY e setat pe jobul zilnic: cheia privata nu are ce cauta aici (doar pe restore-test)" 2
fi
# shellcheck disable=SC2046
require_env DATABASE_URL BACKUP_AGE_RECIPIENT \
  OFFSITE_S3_ENDPOINT OFFSITE_S3_ACCESS_KEY OFFSITE_S3_SECRET_KEY OFFSITE_S3_BUCKET \
  SOURCE_S3_ENDPOINT SOURCE_S3_ACCESS_KEY SOURCE_S3_SECRET_KEY SOURCE_S3_BUCKET $(mail_env_names)
if [[ ! $BACKUP_AGE_RECIPIENT =~ ^age1[0-9a-z]+$ ]]; then
  fail "BACKUP_AGE_RECIPIENT nu e o cheie publica age (age1...)" 2
fi
setup_rclone_remotes
SQL_DIR="$(dirname "$0")"
TODAY=$(date -u +%Y%m%d)
STEM="cozy-$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_FILE="$BACKUP_WORK_DIR/$STEM.dump"
AGE_FILE="$BACKUP_WORK_DIR/$STEM.dump.age"
SHA_FILE="$AGE_FILE.sha256"
MANIFEST_FILE="$BACKUP_WORK_DIR/$STEM.manifest.json"
DAILY_DIR="$OFFSITE_ROOT/db/daily"
MONTHLY_DIR="$OFFSITE_ROOT/db/monthly"
log info "start" "\"stem\":\"$STEM\""

# 2) Snapshot comun: manifestul si dump-ul vad aceeasi imagine a bazei. Fara el, o scriere
# intre numarare si pg_dump (ex. audit_logs dintr-un job BullMQ) da un test lunar EȘUAT fals.
# Sesiunea psql din coproc tine tranzactia deschisa pana termina pg_dump.
step snapshot
coproc SNAPSHOT_SESSION { psql "$DATABASE_URL" -X -q -At -v ON_ERROR_STOP=1 2>/dev/null; }
SNAPSHOT_PID=$SNAPSHOT_SESSION_PID
SNAPSHOT_IN=${SNAPSHOT_SESSION[1]}
SNAPSHOT_OUT=${SNAPSHOT_SESSION[0]}
printf '%s\n' 'begin transaction isolation level repeatable read read only;' 'select pg_export_snapshot();' >&"$SNAPSHOT_IN"
snapshot=''
read -r -t 60 snapshot <&"$SNAPSHOT_OUT" || true
if [[ ! $snapshot =~ ^[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+$ ]]; then
  fail "nu am putut exporta snapshot-ul bazei (conexiune sau drepturi)"
fi

# 3) Manifest (numai numere, fara date personale), pe snapshot-ul comun
step manifest
counts=$(run psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -v snapshot="$snapshot" -At -f "$SQL_DIR/row-counts.sql")
pg_dump_version=$(pg_dump --version)
jq -n --argjson counts "$counts" --arg created "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg dumpver "$pg_dump_version" --arg stem "$STEM" \
  '{stem: $stem, created_at: $created, pg_dump_version: $dumpver} + $counts' > "$MANIFEST_FILE"
if [[ $(jq -r '.audit_trigger_present' "$MANIFEST_FILE") != true ]]; then
  fail "triggerul audit_logs_no_update_delete lipseste din baza sursa"
fi

# 4) Dump pe acelasi snapshot + verificare TOC
step pg_dump
run pg_dump "$DATABASE_URL" --snapshot="$snapshot" --format=custom --compress=6 --no-owner --no-acl -f "$DUMP_FILE"
printf 'commit;\n' >&"$SNAPSHOT_IN" || true
eval "exec $SNAPSHOT_IN>&-"
wait "$SNAPSHOT_PID" 2>/dev/null || true
SNAPSHOT_PID=''
toc=$(run pg_restore --list "$DUMP_FILE")
grep -q 'TABLE DATA public _prisma_migrations ' <<< "$toc" || fail "dump fara datele _prisma_migrations"
grep -q 'TRIGGER public audit_logs audit_logs_no_update_delete ' <<< "$toc" || fail "dump fara triggerul audit_logs_no_update_delete"

# 5) Criptare age; dump-ul in clar se sterge imediat
step encrypt
run age -r "$BACKUP_AGE_RECIPIENT" -o "$AGE_FILE" "$DUMP_FILE"
shred -u "$DUMP_FILE" 2>/dev/null || rm -f "$DUMP_FILE"
DUMP_FILE=''
(cd "$BACKUP_WORK_DIR" && sha256sum "$STEM.dump.age") > "$SHA_FILE"
local_sha=$(cut -d' ' -f1 "$SHA_FILE")
size_bytes=$(stat -c %s "$AGE_FILE")

# 6) Upload + verificare prin recitire (DB mic; peste ~1 GB -> rclone check --size-only + ETag)
step upload
for file in "$AGE_FILE" "$SHA_FILE" "$MANIFEST_FILE"; do
  run rclone copyto "$file" "$DAILY_DIR/$(basename "$file")"
done
remote_sha=$(run rclone cat "$DAILY_DIR/$STEM.dump.age" | sha256sum | cut -d' ' -f1)
if [[ $remote_sha != "$local_sha" ]]; then
  fail "sha256 diferit dupa upload"
fi
log info "upload verificat" "\"stem\":\"$STEM\",\"size_bytes\":$size_bytes"

# 7) Copia lunara (luna calendaristica Europe/Bucharest); se auto-vindeca in prima zi reusita a lunii
step monthly
MONTH=$(TZ=Europe/Bucharest date +%Y%m)
monthly_list=$(run rclone lsf --files-only "$MONTHLY_DIR/" 2>/dev/null || true)
if [[ ${BACKUP_FORCE_MONTHLY:-false} == true ]] || ! grep -qx "cozy-$MONTH.dump.age" <<< "$monthly_list"; then
  run rclone copyto "$DAILY_DIR/$STEM.dump.age" "$MONTHLY_DIR/cozy-$MONTH.dump.age"
  run rclone copyto "$DAILY_DIR/$STEM.dump.age.sha256" "$MONTHLY_DIR/cozy-$MONTH.dump.age.sha256"
  run rclone copyto "$DAILY_DIR/$STEM.manifest.json" "$MONTHLY_DIR/cozy-$MONTH.manifest.json"
  log info "copie lunara creata" "\"month\":\"$MONTH\""
else
  log info "copia lunara exista deja" "\"month\":\"$MONTH\""
fi

# 8) Fisiere: oglinda + istoric (obiectele sterse/suprascrise ajung in uploads-history/<azi>/)
step uploads
sync_uploads() {
  run rclone sync "source:$SOURCE_S3_BUCKET" "$OFFSITE_ROOT/uploads" \
    --backup-dir "$OFFSITE_ROOT/uploads-history/$TODAY" \
    --checksum --transfers 8 --s3-no-check-bucket
}
count_objects() {
  run rclone size --json "$1" | jq -r '.count'
}
sync_uploads
source_count=$(count_objects "source:$SOURCE_S3_BUCKET")
mirror_count=$(count_objects "$OFFSITE_ROOT/uploads")
if [[ $source_count != "$mirror_count" ]]; then
  # un upload nou intre sync si numarare -> o singura reincercare
  log warn "numar diferit de obiecte, reiau sync" "\"source\":$source_count,\"mirror\":$mirror_count"
  sync_uploads
  source_count=$(count_objects "source:$SOURCE_S3_BUCKET")
  mirror_count=$(count_objects "$OFFSITE_ROOT/uploads")
  if [[ $source_count != "$mirror_count" ]]; then
    fail "oglinda fisierelor incompleta: sursa $source_count, off-site $mirror_count"
  fi
fi
log info "fisiere sincronizate" "\"uploads_objects\":$source_count"

# 9) Retentie, doar dupa ce pasii 3-8 au reusit
step retention
daily_list=$(run rclone lsf --files-only "$DAILY_DIR/")
daily_prune=$(select_daily_prune "$TODAY" "$BACKUP_DAILY_KEEP_DAYS" <<< "$daily_list")
age_total=$(grep -c '\.dump\.age$' <<< "$daily_list" || true)
age_pruned=$(grep -c '\.dump\.age$' <<< "$daily_prune" || true)
deleted=0
if (( age_total - age_pruned < BACKUP_DAILY_MIN_COPIES )); then
  if [[ -n $daily_prune ]]; then
    log warn "retentie zilnica sarita: ar ramane sub $BACKUP_DAILY_MIN_COPIES copii" "\"remaining\":$((age_total - age_pruned))"
  fi
else
  while IFS= read -r name; do
    [[ -n $name ]] || continue
    run rclone deletefile "$DAILY_DIR/$name"
    deleted=$((deleted + 1))
  done <<< "$daily_prune"
fi

monthly_list=$(run rclone lsf --files-only "$MONTHLY_DIR/")
while IFS= read -r name; do
  [[ -n $name ]] || continue
  run rclone deletefile "$MONTHLY_DIR/$name"
  deleted=$((deleted + 1))
done < <(select_monthly_prune "$BACKUP_MONTHLY_KEEP" <<< "$monthly_list")

history_list=$(run rclone lsf --dirs-only "$OFFSITE_ROOT/uploads-history/" 2>/dev/null || true)
while IFS= read -r name; do
  [[ -n $name ]] || continue
  run rclone purge "$OFFSITE_ROOT/uploads-history/${name%/}"
  deleted=$((deleted + 1))
done < <(select_history_prune "$TODAY" "$BACKUP_HISTORY_KEEP_DAYS" <<< "$history_list")
log info "retentie aplicata" "\"deleted\":$deleted"

# 10) Gata: fara email la succes (doar la esec, prin trap)
step done
heartbeat
log info "backup ok" "\"stem\":\"$STEM\",\"size_bytes\":$size_bytes,\"uploads_objects\":$source_count"
exit 0
