<!-- Source of truth: complete data model (entities, tables, columns, enums, relations, settings keys). Precedence: technical invariants (02) > decisions log (07) > business rules (03). Don't guess: mark DECISION NEEDED and stop. -->

# 5. Complete data model

*Every name here (table, column, enum, enum value, settings key) is used VERBATIM in the ORM schema, `<SHARED_PKG>` enums, the API and the UI. Never rename, translate or "improve" a name (SOT-025). A name not defined here is used only after <PRODUCT_OWNER> confirms it; record it as "confirmed by owner on <date>" and add it here in the same change (SOT-027).*

> **Template.** Fill sections 5.1–5.6 in Sprint 0. After that, every schema change adds a dated update note at the top (newest first) and updates the tables below in the same change. Drift between this doc and the schema is a defect (SOT-042). Delete the italic guidance once filled.

## After a schema change, also update (SOT-043)

- [ ] `<SHARED_PKG>` enums and types (then run the shared-vs-DB enum diff check — it must report 0 differences, SOT-029)
- [ ] This doc: a dated update note + sections 5.2–5.6
- [ ] DTOs that expose the field
- [ ] Audit snapshot allowlist — only if the field must appear in audit and passed the sensitivity review (SEC-053)
- [ ] `ERROR_CODES.md` if new refusals exist; `03-business-rules.md` implementation notes
- [ ] Soft-delete model list if the table holds PII (INV-12)
- [ ] Knowledge-vault data-model note, if you keep a vault
- [ ] <PROJECT_SPECIFIC_ITEM>

## Update notes (newest first)

*One paragraph per migration: date, sprint/package ID, migration name, and whether it is strictly additive, expand (blue/green-safe), data-only or destructive. Name every added table/column/enum value with its type, nullability, default, index and FK behaviour, the backfill, and the rollback.*

Update <YYYY-MM-DD> (<sprint / package ID>, migration `<timestamp>_<name>`, strictly additive): <table>.<column> <TYPE> <NULL / NOT NULL DEFAULT ...> — <purpose>. <Index / FK>. Backfill: <none / description>. Rollback: <described in the migration SQL>.

## 5.1 Retained entities

*Entities carried over from an earlier spec version or an existing system, as a comma-separated list of table names. Delete this section for a greenfield project.*

## 5.2 Tables

*One row per table. Key columns only (PK, FKs, status, money, deadline and snapshot columns); the full column list lives in the schema. "Source" = the invariant, business rule or decision that requires the table.*

| **Table** | **Key columns** | **Source** |
| --- | --- | --- |
| idempotency_receipts | key, user_id, endpoint, request_hash, response_body, response_status, expires_at | INV-2 |
| | | |

## 5.3 Added columns

*Columns added to existing tables after the initial model, with type and default.*

| **Table** | **Added columns** | **Source** |
| --- | --- | --- |
| | | |

## 5.4 Settings keys (seed)

*Every key of the settings store (INV-19) with its seeded default, written as `key=value` separated by " · ". New keys are added by migration with `INSERT ... ON CONFLICT (key) DO NOTHING`, defaulting to current behaviour. A key whose value is still an open product question carries `DECISION NEEDED` next to it.*

`<key_one>=<default>` · `<key_two>=<default>`

## 5.5 Enums (values)

*One bullet per enum: `enum_name: VALUE_A, VALUE_B, ...`. Values that nothing writes yet are marked "reserved" — never dropped (PostgreSQL cannot drop an enum value, SOT-028). New values are added with `ALTER TYPE ... ADD VALUE`.*

- `stored_file_status`: AWAITING_UPLOAD, AWAITING_SCAN, CLEAN, QUARANTINED (INV-4)

## 5.6 Main relations

*Cardinality between the main entities, one bullet per cluster. State caps here too (e.g. "max N active").*

- `<parent>` 1—N `<child>` (max `<CAP>` active, INV-1); `<owner>` 1—1 `<per-owner singleton, e.g. a profile row>` (UNIQUE, created lazily on the first write, ENG-081).

## Updates <YYYY-MM-DD> (<sprint ID>)

*Optional per-sprint summary block for a sprint that touched many tables; one bullet per change, each citing its decision ID.*
