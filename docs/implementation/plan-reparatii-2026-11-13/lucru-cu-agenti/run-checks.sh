#!/bin/bash
# Folosire: run-checks.sh <folder-loguri> <pas> [<pas> ...]
# Fiecare pas trece prin low.cjs (prioritate scazuta + coada). Scrie o linie de rezumat pe pas.
S="/c/Users/Wolf/AppData/Local/Temp/claude/51a4fe9ce30fc601/021e0df7-d6c7-42ac-993b-05ae92e81192/scratchpad/reparatii"
L="$1"; shift
mkdir -p "$L"
cd "/e/Cozy Fable" || exit 1
for step in "$@"; do
  case "$step" in
    shared-build) cmd="pnpm -F @marketplace/shared build" ;;
    prisma-generate) cmd="pnpm -F backend exec prisma generate" ;;
    be-typecheck) cmd="pnpm -F backend typecheck" ;;
    be-lint) cmd="pnpm -F backend lint" ;;
    be-test) cmd="pnpm -F backend exec jest --maxWorkers=${W:-2} --silent" ;;
    fe-typecheck) cmd="pnpm -F frontend typecheck" ;;
    fe-lint) cmd="pnpm -F frontend lint" ;;
    fe-test) cmd="pnpm -F frontend exec vitest run --maxWorkers=${W:-2}" ;;
    shared-test) cmd="pnpm -F @marketplace/shared test" ;;
    shared-typecheck) cmd="pnpm -F @marketplace/shared typecheck" ;;
    *) echo "PAS NECUNOSCUT $step"; continue ;;
  esac
  t0=$(date +%s)
  node "$S/low.cjs" $cmd > "$L/$step.log" 2>&1
  rc=$?
  t1=$(date +%s)
  echo "$step: exit=$rc ($((t1-t0))s) $(grep -E '^(Tests:|Test Suites:| Test Files | +Tests )' "$L/$step.log" | tr -s ' ' | tr '\n' ';')"
done
echo "GATA"
