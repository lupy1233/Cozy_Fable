#!/usr/bin/env bash
# Configureaza bucketul de upload-uri pe MinIO (E-admin-platform-6, OPS1-21):
#  - bucket privat (invarianta 3.4: fara acces anonim, doar presigned URL-uri)
#  - politica limitata la bucket pentru aplicatie + politica read-only pentru backup
#  - cate un service account per rol (cheile se afiseaza O SINGURA DATA)
#  - versionare + expirarea versiunilor vechi dupa NONCURRENT_DAYS zile
# Idempotent: rerularea nu creeaza chei noi si nu dubleaza regula ILM.
#
# Rulare (imaginea minio/mc fixata in dev-infra, are bash):
#   docker compose -f dev-infra/docker-compose.yml run --rm -v "$PWD/deploy/storage:/s" \
#     -e MC_ALIAS_URL=http://minio:9000 -e MC_ROOT_USER=... -e MC_ROOT_PASSWORD=... -e BUCKET=uploads \
#     --entrypoint bash minio-init /s/setup-minio-uploads.sh
# Credentialele root servesc DOAR la configurare; aplicatia primeste cheia limitata.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ALIAS=cozytarget
NONCURRENT_DAYS="${NONCURRENT_DAYS:-30}"

missing=()
for name in MC_ALIAS_URL MC_ROOT_USER MC_ROOT_PASSWORD BUCKET; do
  if [[ -z ${!name:-} ]]; then missing+=("$name"); fi
done
if (( ${#missing[@]} > 0 )); then
  echo "variabile lipsa: ${missing[*]}" >&2
  exit 2
fi
if [[ ! $BUCKET =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]]; then
  echo "BUCKET invalid: $BUCKET" >&2
  exit 2
fi
if [[ ! $NONCURRENT_DAYS =~ ^[1-9][0-9]*$ ]]; then
  echo "NONCURRENT_DAYS trebuie sa fie un numar pozitiv" >&2
  exit 2
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
export MC_CONFIG_DIR="$WORK_DIR/mc"

render_policy() {
  local source=$1 target=$2 line placeholder='${BUCKET}'
  : > "$target"
  while IFS= read -r line || [[ -n $line ]]; do
    printf '%s\n' "${line//"$placeholder"/$BUCKET}" >> "$target"
  done < "$source"
}

json_field() {
  # json_field CHEIE TEXT -> prima valoare string pentru "CHEIE":"..."
  local pattern="\"$1\":\"([^\"]*)\""
  if [[ $2 =~ $pattern ]]; then printf '%s' "${BASH_REMATCH[1]}"; fi
}

mc alias set "$ALIAS" "$MC_ALIAS_URL" "$MC_ROOT_USER" "$MC_ROOT_PASSWORD" > /dev/null
echo "== bucket $BUCKET"
mc mb --ignore-existing "$ALIAS/$BUCKET"
mc anonymous set none "$ALIAS/$BUCKET"

render_policy "$SCRIPT_DIR/policies/uploads-app.json" "$WORK_DIR/app.json"
render_policy "$SCRIPT_DIR/policies/uploads-backup-readonly.json" "$WORK_DIR/backup.json"
mc admin policy create "$ALIAS" "cozy-uploads-app-$BUCKET" "$WORK_DIR/app.json" > /dev/null
mc admin policy create "$ALIAS" "cozy-uploads-backup-ro-$BUCKET" "$WORK_DIR/backup.json" > /dev/null
echo "== politici: cozy-uploads-app-$BUCKET, cozy-uploads-backup-ro-$BUCKET"

ensure_service_account() {
  local role=$1 policy_file=$2 description=$3 name existing access_key output secret_key line
  name="cozy-$role-$BUCKET"
  name=${name:0:32}
  existing=''
  # list nu intoarce numele -> info pe fiecare cheie a userului root
  while IFS= read -r line; do
    access_key=$(json_field accessKey "$line")
    [[ -n $access_key ]] || continue
    if [[ $(json_field name "$(mc admin user svcacct info "$ALIAS" "$access_key" --json 2> /dev/null || true)") == "$name" ]]; then
      existing=$access_key
    fi
  done < <(mc admin user svcacct list "$ALIAS" "$MC_ROOT_USER" --json 2> /dev/null || true)

  if [[ -n $existing ]]; then
    mc admin user svcacct edit --policy "$policy_file" "$ALIAS" "$existing" > /dev/null
    echo "== service account $name exista deja (access key $existing): politica actualizata, secretul NU se reafiseaza."
    echo "   Rotire: mc admin user svcacct rm $ALIAS $existing, apoi rerulare si schimbarea cheii in Railway."
    return 0
  fi
  output=$(mc admin user svcacct add --policy "$policy_file" --name "$name" --description "$description" \
    "$ALIAS" "$MC_ROOT_USER" --json)
  access_key=$(json_field accessKey "$output")
  secret_key=$(json_field secretKey "$output")
  if [[ -z $access_key || -z $secret_key ]]; then
    echo "service account $name: raspuns neasteptat de la mc" >&2
    exit 1
  fi
  echo "== service account NOU $name ($description)"
  echo "   access key: $access_key"
  echo "   secret key: $secret_key"
  echo "   Pune-le DIRECT in Railway; nu le salva in repo, in chat sau in fisiere."
}

ensure_service_account app "$WORK_DIR/app.json" "Cozy app S3_* (bucket $BUCKET)"
ensure_service_account bkp "$WORK_DIR/backup.json" "Backup SOURCE_S3_* read-only (bucket $BUCKET)"

echo "== versionare"
mc version enable "$ALIAS/$BUCKET"

echo "== ILM: versiunile vechi expira dupa $NONCURRENT_DAYS zile"
rules=$(mc ilm rule ls "$ALIAS/$BUCKET" --json 2> /dev/null || true)
if [[ $rules == *"\"NoncurrentDays\":$NONCURRENT_DAYS"* ]]; then
  echo "regula exista deja"
else
  mc ilm rule add --noncurrent-expire-days "$NONCURRENT_DAYS" "$ALIAS/$BUCKET"
fi

echo "== stare finala"
mc version info "$ALIAS/$BUCKET"
mc ilm rule ls "$ALIAS/$BUCKET"
mc anonymous get "$ALIAS/$BUCKET"
