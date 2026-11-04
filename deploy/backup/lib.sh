#!/usr/bin/env bash
# Biblioteca comuna pentru backup-daily.sh si restore-test.sh (se sourseaza, nu se ruleaza direct).
# Reguli: nicio valoare secreta in loguri sau emailuri; orice esec trimite email "ESUAT".
set -Eeuo pipefail

BACKUP_JOB="${BACKUP_JOB:-backup}"
CURRENT_STEP="start"
BACKUP_WORK_DIR="${BACKUP_WORK_DIR:-/tmp}"
BACKUP_LOG_FILE="${BACKUP_LOG_FILE:-$BACKUP_WORK_DIR/$BACKUP_JOB.log}"
REPORT_SENT=false
MAIL_FAILED=false

# Valori implicite din planul aprobat (30 zilnice + 12 lunare + 30 zile istoric fisiere).
BACKUP_DAILY_KEEP_DAYS="${BACKUP_DAILY_KEEP_DAYS:-30}"
BACKUP_MONTHLY_KEEP="${BACKUP_MONTHLY_KEEP:-12}"
BACKUP_HISTORY_KEEP_DAYS="${BACKUP_HISTORY_KEEP_DAYS:-30}"
# Garda de retentie: sub acest numar de copii zilnice nu se sterge nimic.
BACKUP_DAILY_MIN_COPIES="${BACKUP_DAILY_MIN_COPIES:-7}"
OFFSITE_PREFIX="${OFFSITE_PREFIX:-cozy-prod}"

DAILY_RE='^(cozy-([0-9]{8})T[0-9]{6}Z)\.(dump\.age|dump\.age\.sha256|manifest\.json)$'
MONTHLY_RE='^cozy-([0-9]{6})\.(dump\.age|dump\.age\.sha256|manifest\.json)$'
HISTORY_RE='^([0-9]{8})/?$'

: > "$BACKUP_LOG_FILE" 2>/dev/null || BACKUP_LOG_FILE=/dev/null

json_escape() {
  local value=$1
  value=${value//\\/\\\\}
  value=${value//\"/\\\"}
  value=${value//$'\n'/\\n}
  value=${value//$'\r'/}
  value=${value//$'\t'/\\t}
  printf '%s' "$value"
}

# Lista valorilor care nu au voie sa apara in log/email (inlocuite cu ***).
secret_values() {
  local name value
  for name in DATABASE_URL BACKUP_AGE_IDENTITY OFFSITE_S3_ACCESS_KEY OFFSITE_S3_SECRET_KEY \
    SOURCE_S3_ACCESS_KEY SOURCE_S3_SECRET_KEY BACKUP_SMTP_USER BACKUP_SMTP_PASS BACKUP_HEARTBEAT_URL; do
    value="${!name:-}"
    if [[ ${#value} -ge 4 ]]; then printf '%s\n' "$value"; fi
  done
  if [[ ${DATABASE_URL:-} =~ ^[a-z]+://[^:/@]+:([^@]+)@ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
  fi
  return 0
}

redact() {
  local text=$1 secret
  while IFS= read -r secret; do
    if [[ -n $secret ]]; then text=${text//"$secret"/***}; fi
  done < <(secret_values)
  printf '%s' "$text"
}

# log NIVEL MESAJ [FRAGMENT_JSON_EXTRA]
log() {
  local level=$1 msg=$2 extra=${3:-} line
  line=$(printf '{"ts":"%s","level":"%s","job":"%s","step":"%s","msg":"%s"%s}' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$level" "$BACKUP_JOB" "$(json_escape "$CURRENT_STEP")" \
    "$(json_escape "$(redact "$msg")")" "${extra:+,$extra}")
  printf '%s\n' "$line"
  printf '%s\n' "$line" >> "$BACKUP_LOG_FILE"
}

step() {
  CURRENT_STEP=$1
  log info "pas: $1"
}

# run CMD...: stdout neatins (pentru pipe-uri), stderr redactat in log + pe stderr.
run() {
  local err rc=0 text
  err=$(mktemp "$BACKUP_WORK_DIR/stderr.XXXXXX")
  "$@" 2> "$err" || rc=$?
  if [[ -s $err ]]; then
    text=$(redact "$(tail -c 8000 "$err")")
    printf '%s\n' "$text" >&2
    printf '%s\n' "$text" >> "$BACKUP_LOG_FILE"
  fi
  rm -f "$err"
  return "$rc"
}

fail() {
  log error "$1"
  exit "${2:-1}"
}

require_env() {
  local missing=() name
  for name in "$@"; do
    [[ -n ${!name:-} ]] || missing+=("$name")
  done
  if (( ${#missing[@]} > 0 )); then
    CURRENT_STEP="config"
    fail "variabile lipsa: ${missing[*]}" 2
  fi
}

# Variabilele SMTP obligatorii (user/parola doar in afara modului local fara TLS).
mail_env_names() {
  printf '%s ' BACKUP_REPORT_TO BACKUP_MAIL_FROM BACKUP_SMTP_HOST BACKUP_SMTP_PORT
  if [[ ${BACKUP_SMTP_ALLOW_INSECURE:-false} != true ]]; then
    printf '%s ' BACKUP_SMTP_USER BACKUP_SMTP_PASS
  fi
}

setup_rclone_remotes() {
  export RCLONE_CONFIG_OFFSITE_TYPE=s3
  export RCLONE_CONFIG_OFFSITE_PROVIDER="${OFFSITE_S3_PROVIDER:-Other}"
  export RCLONE_CONFIG_OFFSITE_ENV_AUTH=false
  export RCLONE_CONFIG_OFFSITE_ENDPOINT="${OFFSITE_S3_ENDPOINT:-}"
  export RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID="${OFFSITE_S3_ACCESS_KEY:-}"
  export RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY="${OFFSITE_S3_SECRET_KEY:-}"
  export RCLONE_CONFIG_OFFSITE_NO_CHECK_BUCKET=true
  if [[ -n ${OFFSITE_S3_REGION:-} ]]; then export RCLONE_CONFIG_OFFSITE_REGION="$OFFSITE_S3_REGION"; fi

  export RCLONE_CONFIG_SOURCE_TYPE=s3
  export RCLONE_CONFIG_SOURCE_PROVIDER="${SOURCE_S3_PROVIDER:-Minio}"
  export RCLONE_CONFIG_SOURCE_ENV_AUTH=false
  export RCLONE_CONFIG_SOURCE_ENDPOINT="${SOURCE_S3_ENDPOINT:-}"
  export RCLONE_CONFIG_SOURCE_ACCESS_KEY_ID="${SOURCE_S3_ACCESS_KEY:-}"
  export RCLONE_CONFIG_SOURCE_SECRET_ACCESS_KEY="${SOURCE_S3_SECRET_KEY:-}"
  export RCLONE_CONFIG_SOURCE_FORCE_PATH_STYLE=true
  export RCLONE_CONFIG_SOURCE_NO_CHECK_BUCKET=true
  if [[ -n ${SOURCE_S3_REGION:-} ]]; then export RCLONE_CONFIG_SOURCE_REGION="$SOURCE_S3_REGION"; fi

  # fara fisier de config pe disc, fara progres/verbose (nu vrem headere in log)
  export RCLONE_CONFIG=/dev/null
  OFFSITE_ROOT="offsite:${OFFSITE_S3_BUCKET:-}/$OFFSITE_PREFIX"
  export OFFSITE_ROOT
  return 0
}

mail_address() {
  local value=$1
  if [[ $value =~ \<([^>]+)\> ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
  else
    printf '%s' "$value"
  fi
}

# Subiect RFC 2047: cuvinte codate scurte (max 12 caractere fiecare), separate prin folding.
encode_subject() {
  local subject=$1 out='' chunk index=0 length=${#1}
  while (( index < length )); do
    chunk=${subject:index:12}
    out+="${out:+$'\r\n' }=?UTF-8?B?$(printf '%s' "$chunk" | base64 -w0)?="
    index=$((index + 12))
  done
  printf '%s' "$out"
}

# send_mail SUBIECT FISIER_CORP — nu schimba codul de iesire al jobului.
send_mail() {
  local subject=$1 body=$2 eml curl_cfg from_addr domain scheme=smtp recipient rc=0
  local -a args
  if [[ -z ${BACKUP_REPORT_TO:-} || -z ${BACKUP_MAIL_FROM:-} || -z ${BACKUP_SMTP_HOST:-} || -z ${BACKUP_SMTP_PORT:-} ]]; then
    MAIL_FAILED=true
    log warn "email netrimis: configurarea SMTP e incompleta"
    return 0
  fi
  from_addr=$(mail_address "$BACKUP_MAIL_FROM")
  domain=${from_addr#*@}
  eml=$(mktemp "$BACKUP_WORK_DIR/mail.XXXXXX")
  curl_cfg=$(mktemp "$BACKUP_WORK_DIR/curl.XXXXXX")
  chmod 600 "$curl_cfg"
  {
    printf 'From: %s\r\n' "$BACKUP_MAIL_FROM"
    printf 'To: %s\r\n' "$BACKUP_REPORT_TO"
    printf 'Subject: %s\r\n' "$(encode_subject "$subject")"
    printf 'Date: %s\r\n' "$(LC_ALL=C date -u -R)"
    printf 'Message-ID: <%s.%s.%s@%s>\r\n' "$BACKUP_JOB" "$(date -u +%Y%m%dT%H%M%S)" "$RANDOM$RANDOM" "$domain"
    printf 'MIME-Version: 1.0\r\n'
    printf 'Content-Type: text/plain; charset=UTF-8\r\n'
    printf 'Content-Transfer-Encoding: 8bit\r\n'
    printf 'Auto-Submitted: auto-generated\r\n'
    printf '\r\n'
    sed 's/$/\r/' "$body"
  } > "$eml"

  args=(--silent --show-error --max-time 60 --mail-from "$from_addr" --upload-file "$eml")
  IFS=',' read -r -a recipients <<< "$BACKUP_REPORT_TO"
  for recipient in "${recipients[@]}"; do
    recipient=$(mail_address "${recipient//[[:space:]]/}")
    if [[ -n $recipient ]]; then args+=(--mail-rcpt "$recipient"); fi
  done
  if [[ ${BACKUP_SMTP_SECURE:-false} == true ]]; then scheme=smtps; fi
  if [[ ${BACKUP_SMTP_ALLOW_INSECURE:-false} != true ]]; then
    # credentialele stau in fisierul de config curl (0600), nu in linia de comanda
    local user=${BACKUP_SMTP_USER:-} pass=${BACKUP_SMTP_PASS:-}
    user=${user//\\/\\\\}; user=${user//\"/\\\"}
    pass=${pass//\\/\\\\}; pass=${pass//\"/\\\"}
    printf 'user = "%s:%s"\n' "$user" "$pass" > "$curl_cfg"
    args+=(--ssl-reqd --config "$curl_cfg")
  fi
  run curl "${args[@]}" --url "$scheme://$BACKUP_SMTP_HOST:$BACKUP_SMTP_PORT" || rc=$?
  rm -f "$eml" "$curl_cfg"
  if (( rc != 0 )); then
    MAIL_FAILED=true
    log error "email netrimis (curl $rc)"
  else
    log info "email trimis: $subject"
  fi
  return 0
}

heartbeat() {
  [[ -n ${BACKUP_HEARTBEAT_URL:-} ]] || return 0
  if ! curl -fsS -m 10 --retry 3 "$BACKUP_HEARTBEAT_URL" > /dev/null 2>&1; then
    log warn "heartbeat esuat"
  fi
  return 0
}

# Hook-uri definite de joburi (curatenie si eticheta din subiect).
cleanup() { :; }
JOB_LABEL="${JOB_LABEL:-$BACKUP_JOB}"

on_exit() {
  local rc=$1 body
  trap - EXIT
  set +e
  cleanup
  if (( rc != 0 )) && [[ $REPORT_SENT != true ]]; then
    body=$(mktemp "$BACKUP_WORK_DIR/failure.XXXXXX")
    {
      printf 'Jobul „%s” a eșuat (cod de ieșire %s).\n\n' "$JOB_LABEL" "$rc"
      printf 'Pas curent: %s\n' "$CURRENT_STEP"
      printf 'Data (UTC): %s\n\n' "$(date -u '+%Y-%m-%d %H:%M:%S')"
      printf 'Ultimele linii din log (fără secrete):\n\n'
      redact "$(tail -n 40 "$BACKUP_LOG_FILE" 2>/dev/null)"
      printf '\n\nVezi docs/08-deployment.md, secțiunea „Backup și restaurare”.\n'
    } > "$body"
    send_mail "[Cozy Home] Backup EȘUAT — $JOB_LABEL — $(date -u +%Y-%m-%d)" "$body"
    rm -f "$body"
  fi
  exit "$rc"
}

install_exit_trap() {
  trap 'on_exit $?' EXIT
}

date_minus_days() {
  date -u -d "$1 - $2 days" +%Y%m%d
}

# select_daily_prune AZI(YYYYMMDD) ZILE: citeste nume pe stdin, scrie pe stdout ce se sterge.
# Pastreaza ultimele ZILE zile calendaristice (inclusiv azi); cel mai nou stem nu se sterge niciodata.
select_daily_prune() {
  local today=$1 keep=$2 cutoff name newest=''
  local -a names=()
  cutoff=$(date_minus_days "$today" "$((keep - 1))")
  while IFS= read -r name; do
    [[ $name =~ $DAILY_RE ]] || continue
    names+=("$name")
    if [[ ${BASH_REMATCH[1]} > $newest ]]; then newest=${BASH_REMATCH[1]}; fi
  done
  for name in "${names[@]}"; do
    [[ $name =~ $DAILY_RE ]]
    if [[ ${BASH_REMATCH[1]} == "$newest" ]]; then continue; fi
    if [[ ${BASH_REMATCH[2]} < $cutoff ]]; then printf '%s\n' "$name"; fi
  done
  return 0
}

# select_monthly_prune PASTREAZA: pastreaza cele mai noi PASTREAZA luni.
select_monthly_prune() {
  local keep=$1 name month
  local -a names=() months=()
  while IFS= read -r name; do
    [[ $name =~ $MONTHLY_RE ]] || continue
    names+=("$name")
    months+=("${BASH_REMATCH[1]}")
  done
  (( ${#names[@]} > 0 )) || return 0
  local kept
  kept=$(printf '%s\n' "${months[@]}" | sort -u -r | head -n "$keep")
  for name in "${names[@]}"; do
    [[ $name =~ $MONTHLY_RE ]]
    month=${BASH_REMATCH[1]}
    grep -qx "$month" <<< "$kept" || printf '%s\n' "$name"
  done
  return 0
}

# select_history_prune AZI ZILE: directoare uploads-history/YYYYMMDD/ mai vechi de ZILE zile.
select_history_prune() {
  local today=$1 keep=$2 cutoff name
  cutoff=$(date_minus_days "$today" "$((keep - 1))")
  while IFS= read -r name; do
    [[ $name =~ $HISTORY_RE ]] || continue
    if [[ ${BASH_REMATCH[1]} < $cutoff ]]; then printf '%s\n' "$name"; fi
  done
  return 0
}
