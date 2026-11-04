---
name: prisma-migration
description: Use this skill when creating or modifying the Prisma schema, writing or applying migrations, adding tables, columns, enum values, indexes, CHECK constraints, partial unique indexes or triggers, seeding reference/settings rows through a migration, or writing data migrations and backfills ("migration", "schema change", "new table", "new column", "new enum value", "migratie", "schema", "tabel nou", "coloana noua", "enum nou"). Schema mistakes are the most expensive class of error.
---

# Prisma schema and migrations

## When to use
- Any edit to `apps/backend/prisma/schema.prisma` or `apps/backend/prisma/migrations/**`.
- Adding or changing a table, column, relation, enum value, index, constraint, trigger or reference-data row.
- A backfill or one-off data correction that depends on a schema change.
- Applying a migration to production is a separate step that needs explicit approval in the current session (OPS-001) and runs through `release-rollout`. Step 11 lists what that step must respect.

## Read first
- `docs/04-data-model.md` (`<DATA_MODEL_DOC>`): the names you must use verbatim, and its "After a schema change, also update" checklist (SOT-025, SOT-026, SOT-043).
- `docs/02-technical-invariants.md` (`<INVARIANTS_DOC>`): locking, money, soft delete, audit and snapshot rules that the schema must support.
- `docs/07-decisions-log.md` (`<DECISIONS_LOG>`): the deployment topology (single slot or blue/green), which decides how production migrations run, plus any decisions about the entity you're changing. Decisions are final.
- `schema.prisma` around the affected models, including any `SQL-ONLY` sentinel comments.
- The three newest migration folders (`ls apps/backend/prisma/migrations | tail -3`), for the timestamp and recent style.
- If the project keeps a knowledge vault, read the schema-change and enum-value IMPACT playbooks and the data-model note (MEM-020).

## Procedure
1. Declare the scope before you write anything: tables and enums touched, whether a migration is needed, the rollback, and whether the previous release keeps working. If the entity, column or enum value isn't in `<DATA_MODEL_DOC>`, mark it **DECISION NEEDED** and stop. Never invent it.
2. Stop the backend dev server (`nest --watch`) or any other running backend before you generate. On Windows it holds the query-engine DLL and `prisma generate` fails with EPERM. The type files still regenerate, but only a run with the server stopped gives a clean result (ENV-032).
3. Edit `schema.prisma` following the naming rules below, then run `pnpm -F backend exec prisma validate`.
4. Check the newest migration timestamp, then create `prisma/migrations/<YYYYMMDDHHMMSS>_<snake_case_description>/` with a timestamp later than the newest one (OPS-035). Parallel agents and branches have produced identical timestamps; if two collide, rename one when you merge (ENV-031).
5. Generate the SQL. `prisma migrate dev` needs a TTY and fails in agent shells, so use this instead (ENV-030):
   `pnpm -F backend exec prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <SHADOW_DB_URL> --script > prisma/migrations/<folder>/migration.sql`
   Flag names change between Prisma versions, so check them with `prisma migrate diff --help`.
6. Review the SQL by hand:
   - Delete any proposed `DROP` of hand-written objects (partial indexes, CHECKs, triggers) (STK-028).
   - Add the hand-written SQL that Prisma can't model (see Rules).
   - Put the header at the top (OPS-035, OPS-034, OPS-033):
   ```sql
   -- <TASK_OR_DECISION_ID>: <why this migration exists>
   -- Pre-check (must return 0 rows before applying to production):
   --   SELECT <key>, count(*) FROM <table> GROUP BY <key> HAVING count(*) > 1;
   -- Compatibility: <why the previous app image still works with this schema>
   -- Rollback: 1) stop workers and redeploy the previous app  2) <archive pending rows>  3) <DROP ...>
   ```
   Never drop a table or column that still holds undelivered work (OPS-034).
7. Apply it to the **local** database only: `pnpm -F backend exec prisma migrate deploy` (OPS-010). Then run `pnpm -F backend exec prisma generate`.
8. Verify:
   - `prisma migrate status` reports up to date.
   - A `migrate diff` from the database to `schema.prisma` is empty, apart from proposed DROPs of documented SQL-only objects. Never apply those DROPs (STK-028).
9. Sync everything that depends on the schema, in the same change (SOT-042, SOT-043):
   - The shared enums and types in `<SHARED_PKG>`. Run the enum parity check, which must report 0 differences (SOT-029).
   - The DTOs that expose the field, and any dedicated contract doc.
   - `<DATA_MODEL_DOC>`: its update notes and tables. A new or changed status value is a state-machine change, so also record it in `<BUSINESS_RULES_DOC>` and, if kept, the vault's state-machine note (SOT-044).
   - The audit-snapshot allowlist, only after a sensitivity review. The allowlist is deny-by-default (SEC-053).
   - The soft-delete model list and its spec, for a new `deleted_at` (ENG-076).
   - The vault's data-model note, if the project keeps a vault (MEM-025).
   - The CHANGELOG entry and the proposed commit message, both with the rollback note (OPS-034).
10. Run the gates in this order (QA-002): build `<SHARED_PKG>`, typecheck backend and frontend, lint, then unit tests and the integration specs, run serially against a real PostgreSQL (QA-037).
11. Production is a separate, approved step (OPS-001), run through `release-rollout`. Back up first, then follow the decided topology:
    - Single slot: `prisma migrate deploy` at boot, gated by `RUN_MIGRATIONS` (OPS-039).
    - Blue/green: `RUN_MIGRATIONS=false` on both slots. Apply the migration as one explicit, serialized step, once, before the matching app goes active, after a backup and a rehearsal against a restored copy of production (OPS-041).

    Run seeds and backfills only after `migrate status` confirms the migration is applied (OPS-040).

## Rules
- **MUST** use names from `<DATA_MODEL_DOC>` verbatim (SOT-025), with the Prisma naming conventions (STK-023):
  - Models are PascalCase with `@@map("snake_case_plural")`.
  - Fields are camelCase with `@map("snake_case")`.
  - Enums are PascalCase with `@@map`, and their values are UPPER_SNAKE.
- **MUST** follow the column conventions (STK-023, ENG-063):
  - Ids are `String @id @default(uuid())`.
  - Every `DateTime` is `@db.Timestamptz()`, `createdAt` uses `@default(now())` and `updatedAt` uses `@updatedAt`.
  - Money and any internal currency are `Int` minor units or `Decimal @db.Decimal(12,2)` (NUMERIC). **MUST NOT** use `Float` for them.
- **MUST NOT** edit a migration that has already been applied anywhere. Every change is a new migration (STK-025).
- **MUST** keep changes expand-only (STK-027, OPS-033):
  - New columns on populated tables are nullable or have a default.
  - Prefer leaving old rows NULL and handling NULL in code. Backfill only when necessary, and only in the same migration.
  - DROP, RENAME and destructive cleanup go in a later contract release, once no deployment slot runs the old image.
  - A column that is no longer used stays as legacy: stop reading it and document what replaces it (ENG-085).
- **MUST** give each SQL-only object a sentinel comment next to its model in `schema.prisma`, e.g. `// SQL-ONLY (migration <folder>): partial unique index <name> WHERE <cond>. Do not drop.` (STK-028). The objects are written like this:
  - Partial unique indexes use `CREATE UNIQUE INDEX IF NOT EXISTS ... WHERE ...`.
  - A CHECK on a populated table is added `NOT VALID`. `VALIDATE CONSTRAINT` comes in a later migration, after the pre-check returns 0 rows and a backup is taken (STK-029, OPS-037).
  - The append-only audit table gets a `BEFORE UPDATE OR DELETE` trigger that raises an exception (ENG-089).
  - Reference-data and settings rows go in with `INSERT ... ON CONFLICT (key) DO NOTHING`, so they never overwrite admin edits (OPS-038).
- **MUST** follow the enum rules (STK-030, STK-031, SOT-028):
  - Each `ALTER TYPE ... ADD VALUE` goes in its own migration, because the new value can't be used in the same transaction.
  - **MUST NOT** drop an enum value. Mark dead values "reserved" in `<DATA_MODEL_DOC>`.
  - Grep for the neighbouring values in frontend and backend to find hard-coded lists: tab filters, badge tones, `status in [...]` checks, service constants and job/sweep filters. A job that closes records with a status-conditional `updateMany` must include or exclude the new value explicitly, or records in that state are never processed, or processed wrongly.
  - Add the i18n keys in every namespace that translates the enum.
- **MUST** handle sensitive and historical data:
  - Tables holding PII get a nullable `deleted_at` (plus `anonymized_at` where relevant), and the model joins the global soft-delete list (ENG-075, ENG-076).
  - Snapshot columns are written once, when the event happens, and never updated (ENG-067).
  - Deadlines are materialized into `<x>_deadline_at` columns when the triggering event happens (ENG-038).
- **MUST** enforce caps and "at most one open X per parent" in the database and inside the locking transaction, backed by a partial unique index where it fits. App code alone is not enough (ENG-001, ENG-007, ENG-008, ENG-073).
- **MUST** protect financial tables (ENG-072):
  - Foreign keys use `onDelete: Restrict`. **MUST NOT** use `Cascade` on financial data.
  - Balance columns get `CHECK (>= 0)`.
  - Polymorphic attachment rows and outbox rows carry ids only, with no foreign keys.
- **MUST** index (STK-026):
  - foreign keys used in filters
  - geo-coordinate columns, if the app runs radius queries
  - deadline/expiry columns that jobs scan
  - the idempotency store, on `(key, endpoint)`
- **MUST** treat JSON columns as a stored format (ENG-098, OPS-055). New fields are optional and additive, so old rows validate unchanged. Any other shape change needs a reader that still accepts old rows, plus a backward-reader test before release. Keep PII out of JSON columns unless there is a documented reason.
- **MUST NOT** run `prisma db push`, `migrate reset` or a schema-generated baseline on any shared database:
  - `db push` and a baseline built from `schema.prisma` omit the SQL-only objects (STK-028).
  - `migrate reset` wipes every row, including what parallel sessions wrote (WM-027, ENV-022).
  - Keep both commands on the permission deny list (ENV-004).

## Done checklist
- [ ] Scope declared. Every name exists verbatim in `<DATA_MODEL_DOC>`, or a DECISION NEEDED is open and the work has stopped.
- [ ] Migration folder name is unique and later than the newest one. The header has the ID, pre-check, compatibility note and `-- Rollback:`.
- [ ] No generated DROP of SQL-only objects. Each SQL-only object has its sentinel comment.
- [ ] `migrate deploy` (local), `migrate status` and `generate` all pass. The DB-to-schema diff is empty.
- [ ] Shared enums and types, the parity check, DTOs, `<DATA_MODEL_DOC>`, the audit allowlist (if reviewed), the soft-delete list, the vault note (if kept) and the CHANGELOG are all updated.
- [ ] Shared build, backend and frontend typecheck, lint, unit tests and integration tests are green. Test counts are recorded.
- [ ] Nothing applied to production. If production is still pending, the work is marked NOT DEPLOYED and the exact command still to run is recorded (OPS-001).

## Pitfalls
- `--from-schema-datasource` against the dev database pulls local drift into the migration. Prefer `--from-migrations` with a shadow database, unless `migrate status` shows the dev database matches exactly (ENV-030).
- A migration that hasn't been applied locally leaves the generated client out of sync with the database, so run `migrate deploy` and `generate` again after pulling (ENV-028).
- If Jest maps `<SHARED_PKG>` to its `src`, passing unit tests don't prove that typecheck sees the new types. Build the shared package first (ENV-027).
- The soft-delete middleware doesn't filter relations, includes or raw SQL, so filter those explicitly (ENG-076).
- Raw SQL traps (STK-034):
  - A Prisma `String @id` column is TEXT, so don't cast with `::uuid`.
  - Cast enum columns to `::text` when comparing them with joined text parameters (`Prisma.join`).
  - Raw queries return snake_case column names. Alias them where the code expects camelCase.
  - On a partial unique index, P2002 `meta.target` lists the index's columns, not its name.
- Before backfilling from a stored derived column, confirm exactly what it already includes. Write the backfill as a dedicated script (ENG-086).
- When migrations run at boot, keep `prisma` in `dependencies` and copy `schema.prisma` plus the full migrations folder, including `migration_lock.toml`, into the runtime image (STK-118).
