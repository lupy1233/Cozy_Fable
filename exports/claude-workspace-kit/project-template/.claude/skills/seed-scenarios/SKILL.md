---
name: seed-scenarios
description: Use this skill when writing or changing seed scripts, demo data, fixtures or test personas, or one-off data scripts (cleanup, backfill, recalculation, admin bootstrap), including running them against a shared or production database ("seed", "date demo", "fixtures", "backfill", "curata datele", "ruleaza pe prod").
---

# Seed scenarios and data scripts

Three modes. **SEED**: the dev/demo seed and reference data. **SCRIPT**: a one-off data script (cleanup, backfill, recalculation, admin bootstrap). **PROD RUN**: executing either one against a hosted, shared or production database. Rule IDs in parentheses refer to the workspace rule chapters. Stack-specific snippets are examples; use your stack's equivalent.

## When to use
- Adding or changing a seeded persona, organization, status distribution or reference-data default.
- A new entity, status or enum value that the seed must now cover.
- Renaming or removing a seeded actor.
- Writing a cleanup, backfill, recalculation or admin-bootstrap script.
- Anyone asks to run a seed or data script against a database other than your local disposable one.

## Read first
- `<SEED_SCENARIOS_DOC>` (e.g. `docs/06-seed-scenarios.md`): named personas, organizations, counts and status distributions. Mandatory exactly as written (SOT-009).
- `docs/04-data-model.md`: entities, columns and enums (used verbatim), and which columns are snapshots (ENG-067).
- `docs/02-technical-invariants.md`: the invariants seeded data must satisfy (capacity limits, balanced ledgers, legal state transitions).
- The existing seed and data scripts plus the package scripts in `<BACKEND_PKG>/package.json`. Copy their guards instead of writing new ones.
- PROD RUN only: `<DEPLOYMENT_DOC>` (platform, `<DB_SERVICE>`, backup procedure) and the latest deploy entry in `<MEMORY_DIR>/MEMORY.md`.

## Procedure

### SEED
1. List every required actor and total from `<SEED_SCENARIOS_DOC>` before writing code. If the change needs something the doc lacks (a persona for a new status, a new total), raise DECISION NEEDED and never invent a variation (SOT-009).
2. Cover every status of each main entity, including edge states (pending, rejected, suspended, expired, auto-escalated), with the exact documented totals. Pair dimensions (which category gets which status) freely only where the doc allows it (QA-082).
3. Upsert on natural keys (email, tax ID, slug). Reference-data defaults are inserted only when absent and never updated (e.g. Prisma `upsert` with `update: {}`, SQL `ON CONFLICT DO NOTHING`), so a re-run inserts nothing and never overwrites admin edits (QA-080, OPS-038, ENG-110).
4. Create domain data through the real services where feasible, so locks, ledgers and state transitions hold. Use direct inserts only for history rows (audit entries, notifications, past events), with realistic past timestamps (QA-107).
5. Gate rows that have no natural key behind a sentinel check (e.g. "the seeded history already exists, skip"), so re-runs add no duplicates (QA-080).
6. Hardcode externally derived values (coordinates, lookups, rates). Make no external API calls (QA-081).
7. Preload history: audit entries and in-app notifications (e.g. 50+ and 30+), plus a multi-year public-holiday table including movable holidays when the app has a business calendar (QA-106).
8. Read demo passwords from env (e.g. `DEMO_PASSWORD`). Fail with a clear error when they are missing, and commit no default (SEC-074).
9. Refuse to run in production (e.g. `NODE_ENV=production`) unless `<ALLOW_DEMO_SEED>=1` is set (SEC-074, OPS-077).
10. Print a counts summary at the end (per entity and per status) and compare it with the doc's totals.
11. Update `<SEED_SCENARIOS_DOC>` in the same change whenever an actor is added, renamed, removed or changes state: each named scenario doubles as a live acceptance script, and an unrecorded rename silently breaks them (SOT-010, QA-072).

### SCRIPT
1. Commit the script next to the seeds (e.g. `<BACKEND_PKG>/<scripts-dir>/<name>.ts`) and expose it as a named package script (`cleanup:<x>`, `backfill:<x>`, `seed:admin`) (OPS-073).
2. Default to dry-run: compute and print what would change (counts, plus the rows explicitly kept) and exit. Execute only when `<SCRIPT>_CONFIRM=yes` is set (OPS-076).
3. Print the target DB host only (e.g. `new URL(process.env.DATABASE_URL).host`), never the URL or credentials (OPS-076, SEC-070).
4. Validate every env input up front (presence, format, length). Refuse dangerous implicit changes: an admin bootstrap that finds the email under another role throws instead of promoting it (SEC-015); rotating an existing password needs its own explicit flag and revokes that user's active sessions (SEC-010); the password is never logged.
5. Run destructive work in one transaction with an explicit, generous timeout, deleting in FK order (SEC-075). Delete rows that have no FK (e.g. polymorphic attachments, outbox rows) explicitly, before their parents (ENG-072). Put a leftover check inside the transaction that throws, so an unexpected dependency rolls everything back.
6. Never delete append-only audit rows (ENG-089), reference data and settings (ENG-110), the business calendar, or published definition versions that existing records still depend on (ENG-096). Keep the real data the owner wants retained, through an explicit keep-list printed in the dry-run (OPS-076).
7. Do not delete object-storage files from a DB script. Write their keys to a file for a separate, reviewed storage cleanup, or leave them to the scheduled orphan-upload cleanup (OPS-072).
8. Never rewrite historical snapshot columns or materialized deadlines; a recalculation changes only the records it targets (ENG-067, ENG-038). Before backfilling from a stored derived column, confirm exactly what it includes (weights, surcharges) and reverse the extra parts, or the backfill double-counts (ENG-086).
9. Update the seed in the same change, so fresh environments match the corrected data (OPS-073).
10. End with a read-only verification count printed by the script itself (OPS-074).
11. Prove it locally on a disposable database: dry-run, confirmed run, then a second run that is a no-op.

### PROD RUN
1. Run only on the user's explicit request for that exact operation, in this session. Approval for one run does not cover the next (OPS-001, OPS-073).
2. First deploy the release that carries the migrations the script needs, then check the migration status against the target (e.g. `prisma migrate status`) (OPS-040).
3. Take a fresh backup before anything destructive (OPS-076, SEC-075).
4. Run through the platform's run command so credentials never enter the context (OPS-074, SEC-070). Commit a small wrapper that switches to the public DB URL inside the child process and calls the package script, e.g. a `.ps1` setting `$env:DATABASE_URL = $env:DATABASE_PUBLIC_URL`, run as `<PLATFORM_CLI> run --service <DB_SERVICE> -- powershell -File <script.ps1>` (bash form: `-- bash -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" pnpm -F <BACKEND_PKG> <script>'`).
5. Sequence: dry-run -> show the counts to the user -> confirmed run -> read-only verification query. If the dry-run counts differ from what the user expects, stop and ask.
6. Report the counts and record them in memory with the date, operation and target (MEM-005). Never record passwords, URLs or other secrets (MEM-030).

## Rules
- MUST use the named personas and organizations of `<SEED_SCENARIOS_DOC>` and its exact totals; MUST NOT invent variations or "Test User 1" actors (SOT-009, QA-082).
- MUST keep every seed idempotent: upserts on natural keys, insert-if-absent for defaults, sentinels for history rows (QA-080, OPS-038).
- MUST NOT put password literals in seeds, scripts, docs or memory; demo passwords come only from env (SEC-074, MEM-030).
- MUST NOT run the demo seed in production without the explicit ALLOW flag, and MUST NOT leave demo data or demo accounts in production at launch (OPS-077, SEC-075, OPS-078).
- MUST NOT call external APIs from seeds (QA-081).
- MUST ship every data correction as a committed, named package script that is dry-run by default and executes only with an explicit confirm env var; MUST NOT correct shared or production data with ad-hoc write SQL (OPS-073, OPS-076).
- MUST take a fresh backup before any destructive step on a shared or production database (OPS-073, OPS-076).
- MUST NOT print, echo or paste a database URL or credential; print the host only (SEC-070).
- MUST NOT promote roles, rotate passwords or overwrite admin-edited settings as a side effect (SEC-015, OPS-038).
- MUST NOT rewrite snapshot columns or delete append-only audit rows (ENG-067, ENG-089).
- MUST run against production only on an explicit user request for that exact operation, after its migrations are deployed (OPS-001, OPS-040).
- MUST NOT bypass a permission-classifier refusal by rephrasing, splitting or re-issuing the command; report it and ask (OPS-100).

## Done checklist
- [ ] Seeded actors and totals match `<SEED_SCENARIOS_DOC>`; every status, including edge states, is covered.
- [ ] Running the seed twice creates no duplicates and overwrites no admin edits.
- [ ] Domain rows come from the real services; direct inserts are history only, with past timestamps.
- [ ] No password literals; the missing-env error and the production guard work.
- [ ] `<SEED_SCENARIOS_DOC>` updated in the same change for any actor change.
- [ ] Data script: committed, named package script, dry-run default, confirm flag, prints the host only, validates inputs.
- [ ] Destructive script: one transaction, FK order, FK-less rows handled, leftover check, keep-list, storage keys exported, audit rows untouched.
- [ ] Seed updated to match any data correction.
- [ ] PROD RUN: explicit request, migrations deployed, backup taken, run via the platform run command, dry-run counts shown, verification query run, counts recorded in memory.

## Pitfalls
- The platform run command executes on your machine, so the injected private `DATABASE_URL` (e.g. `*.internal` hosts) is unreachable; switch to the public URL inside the child process (OPS-075).
- Auto mode refuses to read secrets out of `.env` files and refuses commands that would print credentials. Ask the user for a local demo password or pass it as a process-level env override; never edit `.env` yourself (ENV-007, OPS-100).
- The local database is shared with parallel sessions. Never reset or restore it to re-run a seed; use a disposable database for destructive tests (ENV-022, WM-027).
- Integration-test fixtures are not seed data: they use their own label prefix and `@example.invalid` emails, are deleted by id, and never touch seeded rows (QA-030).
- If direct transaction calls are banned outside one helper (ENG-003), seeds are exempt. That is not a licence to write domain state around the services.
- Seeds never run at container boot; a boot-time seed would re-run on every deploy (OPS-039).
