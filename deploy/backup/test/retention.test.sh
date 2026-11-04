#!/usr/bin/env bash
# Test pur bash (fara retea) pentru selectia de retentie: 30 zilnice, 12 lunare, 30 zile istoric.
# Rulare: docker run --rm --entrypoint bash cozy-backup:local /opt/backup/test/retention.test.sh
set -Eeuo pipefail
export BACKUP_JOB=retention-test
export BACKUP_LOG_FILE=/dev/null
LIB="$(cd "$(dirname "$0")/.." && pwd)/lib.sh"
# shellcheck source=../lib.sh
source "$LIB"

failures=0
TODAY=20260929

expect_equal() {
  local label=$1 expected=$2 actual=$3
  if [[ $expected == "$actual" ]]; then
    printf 'ok - %s\n' "$label"
  else
    printf 'not ok - %s\n--- asteptat\n%s\n--- primit\n%s\n' "$label" "$expected" "$actual"
    failures=$((failures + 1))
  fi
}

# 45 de zile de backup zilnic (azi inclusiv), cate 3 fisiere per stem + 3 nume straine.
daily_names=''
expected_daily=''
for offset in $(seq 0 44); do
  day=$(date -u -d "$TODAY - $offset days" +%Y%m%d)
  stem="cozy-${day}T013000Z"
  for suffix in .dump.age .dump.age.sha256 .manifest.json; do
    daily_names+="$stem$suffix"$'\n'
    if (( offset >= 30 )); then expected_daily+="$stem$suffix"$'\n'; fi
  done
done
daily_names+=$'README.txt\ncozy-2025.dump.age\nnotes/\n'
actual_daily=$(select_daily_prune "$TODAY" 30 <<< "$daily_names" | sort)
expect_equal "zilnic: pastreaza 30 de zile, sterge cele 15 mai vechi, ignora numele straine" \
  "$(printf '%s' "$expected_daily" | sort)" "$actual_daily"
expect_equal "zilnic: 45 de fisiere sterse (15 zile x 3)" 45 "$(grep -c . <<< "$actual_daily")"

# Cel mai nou stem nu se sterge niciodata, chiar daca e vechi (jobul a stat oprit).
old_only=$'cozy-20250101T013000Z.dump.age\ncozy-20250101T013000Z.dump.age.sha256\ncozy-20250102T013000Z.dump.age\n'
expect_equal "zilnic: cel mai nou stem ramane chiar daca e in afara ferestrei" \
  $'cozy-20250101T013000Z.dump.age\ncozy-20250101T013000Z.dump.age.sha256' \
  "$(select_daily_prune "$TODAY" 30 <<< "$old_only" | sort)"

# Doua rulari in aceeasi zi: nimic de sters sub 30 de zile.
same_day=$'cozy-20260929T013000Z.dump.age\ncozy-20260929T090000Z.dump.age\n'
expect_equal "zilnic: rulari multiple in aceeasi zi nu sterg nimic" '' "$(select_daily_prune "$TODAY" 30 <<< "$same_day")"

# 15 luni de copii lunare -> se sterg cele mai vechi 3 luni.
monthly_names=''
expected_monthly=''
for offset in $(seq 0 14); do
  month=$(date -u -d "2026-09-01 - $offset months" +%Y%m)
  for suffix in .dump.age .dump.age.sha256 .manifest.json; do
    monthly_names+="cozy-$month$suffix"$'\n'
    if (( offset >= 12 )); then expected_monthly+="cozy-$month$suffix"$'\n'; fi
  done
done
monthly_names+=$'cozy-20260929T013000Z.dump.age\nrandom.bin\n'
expect_equal "lunar: pastreaza 12 luni, sterge cele mai vechi 3" \
  "$(printf '%s' "$expected_monthly" | sort)" "$(select_monthly_prune 12 <<< "$monthly_names" | sort)"
expect_equal "lunar: sub 12 luni nu sterge nimic" '' "$(select_monthly_prune 12 <<< $'cozy-202609.dump.age\ncozy-202608.dump.age')"

# Istoric fisiere: directoare YYYYMMDD/ mai vechi de 30 de zile.
history_names=$'20260929/\n20260831/\n20260830/\n20260701/\nnot-a-date/\n'
expect_equal "istoric: sterge directoarele mai vechi de 30 de zile" \
  $'20260701/\n20260830/' "$(select_history_prune "$TODAY" 30 <<< "$history_names" | sort)"

# Redactarea secretelor din log/email.
# parola sintetica tinuta separat, ca scan-secrets sa nu vada un URL cu parola
pw='S3cretPassw0rd'
export DATABASE_URL="postgresql://backup_reader:$pw@db.internal:5432/app"
export OFFSITE_S3_SECRET_KEY='offsite-secret-value'
expect_equal "redact: parola din DATABASE_URL si cheile off-site nu apar" \
  'eroare *** si ***' "$(redact 'eroare S3cretPassw0rd si offsite-secret-value')"
unset DATABASE_URL OFFSITE_S3_SECRET_KEY

# Subiect RFC 2047: cuvinte codate de max 75 de caractere.
subject=$(encode_subject '[Cozy Home] Test lunar de restaurare backup — EȘUAT')
longest=$(tr -d '\r' <<< "$subject" | awk '{ for (i = 1; i <= NF; i++) if (length($i) > max) max = length($i) } END { print max }')
if (( longest <= 75 )); then printf 'ok - subiect codat pe cuvinte scurte\n'; else printf 'not ok - cuvant codat de %s caractere\n' "$longest"; failures=$((failures + 1)); fi

if (( failures > 0 )); then
  printf '%s teste esuate\n' "$failures"
  exit 1
fi
printf 'toate testele de retentie au trecut\n'
