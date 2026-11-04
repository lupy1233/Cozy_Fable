<!-- Source of truth: named seed actors and scenarios. Precedence: technical invariants (02) > decisions log (07) > business rules (03). Don't guess: mark DECISION NEEDED and stop. -->

# 7. Seed scenarios (Sprint <N>)

*Named entities, counts and status distributions written here are MANDATORY exactly as written; only pairings this doc explicitly leaves open may vary (SOT-009). The scenarios double as the live acceptance scripts for every sprint (QA-072), so deleting or renaming a seeded actor requires updating this doc in the same change (SOT-010).*

> **Template.** Name every actor and scenario here before writing any seed script. Delete the italic guidance once filled.

Seed rules:

- Passwords come from env (`<SEED_PASSWORD_ENV>`, optional `<SEED_ADMIN_PASSWORD_ENV>`); there is no default password in the repo, docs or memory. The demo seed refuses to run in production unless `<ALLOW_DEMO_SEED>=1`.
- Seeds are idempotent: they upsert on natural keys (email, registration number), so a re-run creates no duplicates (QA-080).
- Seeds never call external APIs; values such as coordinates are hardcoded (QA-081).
- Personas are named and realistic, never "Test User 1"; seed emails use a reserved domain (`example.test`) (QA-082).
- The real admin account is never seeded with demo data; it comes from a dedicated admin seed script that reads its credentials from env (SEC-015).

## 7.1 Users and organizations

*One row per persona. Together the personas cover every role and every organization state, including edge states (pending, rejected, suspended, blocked).*

| **Persona** | **Email** | **Role** | **Organization** (and its state) | **Notable state** | **Used by scenarios** |
| --- | --- | --- | --- | --- | --- |
| Platform admin | `admin@example.test` | ADMIN | — | active, 2FA off | S-01 |
| | | | | | |

## 7.2 Main entities and status coverage

*Every status of each main entity appears at least once, including edge states (expired, auto-escalated, disputed). Where counts are given they are mandatory; say explicitly which pairings are left to the agent.*

| **Entity** | **Status** | **Count** | **Owner persona** | **Notes** |
| --- | --- | --- | --- | --- |
| | | | | |

## 7.3 Audit, notifications and calendar

*Minimum history so admin screens look realistic, and the calendar data the business-day logic needs.*

- Minimum `<N>` audit entries + `<M>` in-app notifications for a realistic history.
- Holiday calendar seeded for `<YEARS>` (movable holidays included); the admin can add more (INV-3).

## 7.4 Scenarios as acceptance scripts

*One row per scenario. Each one is a script a human can click through to accept a sprint.*

| **ID** | **Scenario** | **Personas** | **Steps** | **Expected result** |
| --- | --- | --- | --- | --- |
| S-01 | Admin reviews the audit trail | Platform admin | Log in → open the audit-log viewer → filter by today | Entries from the seed are listed; no PII, no tokens; entries cannot be edited or deleted |
| | | | | |
