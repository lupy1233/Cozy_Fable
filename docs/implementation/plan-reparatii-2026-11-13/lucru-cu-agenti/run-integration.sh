#!/bin/bash
# Folosire: run-integration.sh <folder-loguri> [migrate] [test [<tipar>]]
# Ruleaza pe baza locala separata marketplace_test (niciodata pe baza de lucru).
S="/c/Users/Wolf/AppData/Local/Temp/claude/51a4fe9ce30fc601/021e0df7-d6c7-42ac-993b-05ae92e81192/scratchpad/reparatii"
L="$1"; shift
mkdir -p "$L"
cd "/e/Cozy Fable/apps/backend" || exit 1
URL=$(grep -E '^DATABASE_URL=' .env | head -1 | sed -E 's/^DATABASE_URL=//; s/^"//; s/"$//')
[ -z "$URL" ] && { echo "DATABASE_URL lipsa in .env"; exit 1; }
TEST_URL=$(echo "$URL" | sed -E 's#/marketplace(\?|$)#/marketplace_test\1#')
case "$TEST_URL" in *marketplace_test*) ;; *) echo "nu am putut construi adresa bazei de test"; exit 1 ;; esac
case "$TEST_URL" in *localhost*|*127.0.0.1*) ;; *) echo "baza de test nu e locala - ma opresc"; exit 1 ;; esac
export DATABASE_URL="$TEST_URL" TEST_DATABASE_URL="$TEST_URL" TEST_S3_ENDPOINT="http://127.0.0.1:9000" NODE_OPTIONS="--experimental-vm-modules"
while [ $# -gt 0 ]; do
  case "$1" in
    migrate)
      node "$S/low.cjs" pnpm exec prisma migrate deploy > "$L/migrate.log" 2>&1
      echo "migrate: exit=$? $(grep -E 'migrations? (have been|applied)|No pending|Applying migration' "$L/migrate.log" | tr '\n' ';')"
      shift ;;
    test)
      pat="${2:-integration.spec.ts}"
      [ $# -ge 2 ] && shift
      shift
      t0=$(date +%s)
      node "$S/low.cjs" pnpm exec jest --runInBand --ci --testPathPattern="$pat" > "$L/integration.log" 2>&1
      rc=$?
      echo "integration ($pat): exit=$rc ($(( $(date +%s) - t0 ))s) $(grep -E '^(Tests:|Test Suites:)' "$L/integration.log" | tr -s ' ' | tr '\n' ';')"
      ;;
    *) echo "pas necunoscut $1"; shift ;;
  esac
done
echo "GATA"
