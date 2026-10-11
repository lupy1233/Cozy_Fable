# Sources of truth & precedence

This chapter defines which documents Claude treats as authoritative and which one wins when two disagree. It also covers how decisions are recorded and protected, how names from the data model stay fixed, and how the docs connect to CLAUDE.md and stay in sync with the code.
To adapt it to a new project, create the numbered doc set below, fill in the placeholders, and copy the pointer and precedence blocks into your root CLAUDE.md.

## Placeholders used in this chapter

| Placeholder | Suggested file | Owns |
|---|---|---|
| `<VISION_DOC>` | `docs/01-vision-and-stack.md` | vision, actors, MVP scope, stack, doc map |
| `<INVARIANTS_DOC>` | `docs/02-technical-invariants.md` | concurrency/locking, idempotency of critical writes, timezone and business calendar, file storage, realtime/event publication, frontend state boundaries, payment webhooks, audit log, error-response format, observability, soft delete/data protection, auth and sessions — one numbered section each |
| `<BUSINESS_RULES_DOC>` | `docs/03-business-rules.md` | product rules |
| `<DATA_MODEL_DOC>` | `docs/04-data-model.md` | entities, tables, columns, enums |
| `<SPRINT_PLAN_DOC>` | `docs/05-master-prompt-and-sprints.md` | master prompt, sprint order, output contract |
| `<SEED_SCENARIOS_DOC>` | `docs/06-seed-scenarios.md` | named seed actors and scenarios |
| `<DECISIONS_LOG>` | `docs/07-decisions-log.md` | final decisions |
| `<DEPLOYMENT_DOC>` | `docs/08-deployment.md` | deploy pipeline, env, runbooks, platform gotchas |
| `<STATE_CONVENTIONS_DOC>` | `docs/STATE_CONVENTIONS.md` | frontend boundary between server state and UI state |
| `<ERROR_CODES_DOC>` | `docs/ERROR_CODES.md` | error-code catalogue |
| `<SHARED_PKG>` | `packages/shared` | shared enums, types, validation schemas |

`<PRODUCT_OWNER>` (the person who owns the business rules and decisions) and `<BUSINESS_TZ>` are defined in 01-working-method.md.

## The doc set

- **SOT-001** `MUST` Keep a single numbered set of source-of-truth docs in `docs/`, one doc per concern: 01 vision/actors/MVP scope/stack, 02 technical invariants, 03 business rules, 04 data model, 05 master prompt and sprint order, 06 seed scenarios, 07 decisions log, 08 deployment, plus a checklist for the humans on the project. At the top of `<VISION_DOC>`, put a map table that says which doc holds what.
- **SOT-002** `MUST` Treat `<INVARIANTS_DOC>` as non-negotiable. It owns concurrency/locking, idempotency of critical writes, timezone (`<BUSINESS_TZ>`) and business calendar, file storage, realtime/event publication, frontend state boundaries, payment webhooks, audit log, error-response format, observability, soft delete/data protection, auth and sessions — one numbered section each.
- **SOT-003** `SHOULD` Start every source-of-truth doc with a one-line header comment. It states the doc's role, repeats the precedence order and repeats "don't guess: mark DECISION NEEDED and stop". For example: `<!-- Source of truth: <ROLE>. Precedence: invariants > decisions log > business rules. Don't guess: mark DECISION NEEDED and stop. -->` — _why:_ whichever doc the agent opens first, it still sees the precedence and the stop rule.
- **SOT-004** `MUST` Normative markers in the spec docs are limited to: plain text = confirmed rule; `MUST` / `NEVER` / `ALWAYS` = strict, no exceptions; `DECISION NEEDED` = a gap found during implementation, so work that depends on it pauses and you ask for an answer. Status labels (Historical, reserved, confirmed by owner, CONFIRMED / RESOLVED) are allowed alongside them. When the doc set is handed over, it contains zero open proposals or DECISION NEEDED items.
- **SOT-005** `SHOULD` In `<VISION_DOC>`, keep a confirmed list of what is in scope and out of scope. Add a mock table with the columns `component | mock in MVP | later replacement`.
- **SOT-007** `SHOULD` Satellite docs (`<STATE_CONVENTIONS_DOC>`, `<ERROR_CODES_DOC>`, mechanism contracts) cite the number of the invariant they implement. Each entry cites the ID of the decision or work package that introduced it. `<STATE_CONVENTIONS_DOC>` and `<ERROR_CODES_DOC>` are created in Sprint 0 (DEL-003).
- **SOT-008** `SHOULD` Give each cross-cutting mechanism (durable events, for example) its own contract doc with the sections Scope, Persistence, Delivery and recovery, Limits, and Migration and rollback. Limits says honestly what can still be duplicated or lost (for example, "delivery is at-least-once; exactly-once is not promised").
- **SOT-009** `MUST` Seed data comes from `<SEED_SCENARIOS_DOC>`. Named entities, counts and status distributions are mandatory exactly as written; only pairings the doc explicitly leaves open may vary (QA-082). Never invent variations.
- **SOT-010** `MUST NOT` Delete or rename a seeded actor unless the same change updates `<SEED_SCENARIOS_DOC>`. — _why:_ the named seed scenarios double as the live acceptance test scripts (QA-072).

## Precedence on conflict

- **SOT-011** `MUST` Resolve conflicts in this fixed order: technical invariants > decisions log > business rules > implementation choices left to the agent. Exception: an apparent conflict between a business rule and a technical invariant is never resolved by order. Stop, mark DECISION NEEDED and ask `<PRODUCT_OWNER>` (WM-004).
- **SOT-050** `MUST` An owner-approved decision recorded in a feedback-round doc ranks as a decisions-log entry and beats older business-rule text. Copy it into `<DECISIONS_LOG>` when the sprint closes (SOT-039). Satellite docs (`<STATE_CONVENTIONS_DOC>`, `<ERROR_CODES_DOC>`, mechanism contracts, `<DEPLOYMENT_DOC>`) implement invariants and never override them.
- **SOT-012** `MUST` Rules come only from the source-of-truth doc set. Memory, the knowledge vault, chat history and archived or older doc versions help you navigate and track status, but they never supply rules. When one of them disagrees with the doc set, the doc set wins and the stale note is corrected.
- **SOT-013** `MUST NOT` Silently resolve a contradiction between the docs and the code. Decision test: if the code follows a later decision that is recorded and approved (a `<DECISIONS_LOG>` entry or an approved feedback-round doc), reconcile the stale doc per SOT-040 and link that decision. If no recorded decision explains the difference, edit neither the docs nor the log: pin the current behaviour with tests and raise DECISION NEEDED for `<PRODUCT_OWNER>`. — _why:_ decisions are final and belong to the product owner.
- **SOT-014** `MUST` When `<PRODUCT_OWNER>` descopes a documented business rule, add a new `<DECISIONS_LOG>` entry (and a memory note). The entry names the business-rule section and any earlier decision it supersedes (SOT-022/SOT-023), and lists exactly which columns, checks and events are NOT to be built. Never bring the descoped behaviour back without fresh confirmation. — _why:_ the owner owns the business rules; without a written record, a later session re-implements the rule from the docs.
- **SOT-015** `SHOULD` When a feature is descoped, keep its columns and enums in the schema exactly as `<DATA_MODEL_DOC>` defines them, and only stop producing the descoped values. — _why:_ the schema stays faithful to the doc, and the feature can come back without a migration.

## Decisions are final

- **SOT-016** `MUST` Treat every entry in `<DECISIONS_LOG>` as final: never reopen, re-argue or propose changing one. Only `<PRODUCT_OWNER>` can supersede a decision, and only through SOT-022/SOT-023. A decision beats any older conflicting rule.
- **SOT-017** `MUST NOT` Edit, rewrite or delete an existing entry in `<DECISIONS_LOG>`. The only allowed change to an existing entry is the SOT-022 history prefix plus a link, made after `<PRODUCT_OWNER>` has explicitly superseded it (SOT-023). Every new decision is appended as a new entry.
- **SOT-019** `MUST` Give each log entry an ID `D-<series>-<n>` (series = technical, business, release or owner-round; the same scheme as PO-014) and three labelled parts: **Decision**, **Rationale** and **Impact**. Impact names the tables, columns, settings, jobs and error codes the decision touches. Register a decision before relying on it. — _why:_ the log tells whoever reads it six months later why each choice was made.
- **SOT-051** `SHOULD` A plan may keep a dated register of planning boundaries with the columns `ID | question or boundary | state | resolving doc | action`. It is not a source of product rules; any entry that sets a product rule is also appended to `<DECISIONS_LOG>`.
- **SOT-020** `SHOULD` Write rationales that give the reason, the heavier alternatives that were rejected, and the scale or assumption the choice depends on. For example: "a row lock (SELECT ... FOR UPDATE) is enough below ~100 RPS and easy to debug; advisory locks or optimistic locking add complexity without value at this scale". — _why:_ the stated assumption tells a later reader when the decision should be revisited.
- **SOT-021** `MUST` When a new decision changes a technical invariant or a business rule, its Impact names the exact sections it updates, and the same change updates those sections.
- **SOT-022** `MUST` When a decision is superseded, keep its text as history with the prefix "Historical, replaced on <date>". Link the newer decision or archived sprint doc, and say where the current rule now lives.
- **SOT-023** `MUST` When a new request from the owner supersedes an earlier logged decision, the sprint doc says which decision it replaces and that the owner explicitly asked for the change. Never quietly depart from a logged decision. — _why:_ logged decisions are final unless explicitly replaced, and the replacement itself must be traceable.
- **SOT-024** `SHOULD` When a decision closes an open question from an earlier sprint, record which question it closes, the sprint it was made in and the business-rule section it agrees with.

## Names are used verbatim

- **SOT-025** `MUST` Use entity, table, column, field and enum names, enum values and thresholds exactly as `<DATA_MODEL_DOC>` and the other docs spell them. This applies in the ORM schema, the shared enums, the API and the UI. Never rename, translate, paraphrase or "improve" them.
- **SOT-026** `MUST` Read `<DATA_MODEL_DOC>` before any schema change. — _why:_ schema mistakes are the most expensive kind of error.
- **SOT-027** `MUST` A name that `<DATA_MODEL_DOC>` does not define is used only after `<PRODUCT_OWNER>` confirms it in the session. Record it as "confirmed by owner on <date>" and add it to `<DATA_MODEL_DOC>` in the same change. Otherwise mark it DECISION NEEDED and stop. Never confirm a name yourself.
- **SOT-028** `MUST NOT` Drop enum values just because nothing writes them yet. Mark them "reserved" in `<DATA_MODEL_DOC>` or implement them. — _why:_ PostgreSQL cannot drop an enum value (no `ALTER TYPE ... DROP VALUE`); removing one means recreating the type and migrating every column that uses it. Add new values with `ALTER TYPE ... ADD VALUE` in a new migration.
- **SOT-029** `MUST` `<SHARED_PKG>` is the single source of enums, types and schemas for both tiers (conventions: STK-040). After every enum change, run a repeatable check (script or test) that diffs the shared status constants against the database enums. It must report 0 differences.

## What to read, and when

- **SOT-030** `MUST` Before planning or coding, read only what the work package touches. Backend: all of `<INVARIANTS_DOC>` plus the relevant `<BUSINESS_RULES_DOC>` and `<DATA_MODEL_DOC>` subsections. Frontend: the state-boundary invariant plus `<STATE_CONVENTIONS_DOC>` (produced in Sprint 0, DEL-003). Planners (human or sub-agent) also read `<DECISIONS_LOG>`. Never load the whole spec (see DEL-007). — _why:_ it keeps the context small while every change still sees the constraints that apply to its layer.
- **SOT-033** `SHOULD` Use skills to capture the layering and conventions taken from the spec, so code follows them without re-reading the large docs. Each skill cites the exact doc and section it captures. — _why:_ this saves context, and every skill can still be traced back to its source.
- **SOT-052** `SHOULD` Write each project skill's description as a trigger ("Use this skill whenever ...") that names the code areas, artifacts and the user's own phrases, in the user's language, that should activate it. — _why:_ precise triggers make Claude load the right convention set automatically.

## Wiring the docs into CLAUDE.md

- **SOT-034** `SHOULD` Keep the root CLAUDE.md a short index of about 30 lines with these sections: a one-line stack summary, pointers to the source-of-truth docs, conflict precedence, mandatory behaviours, commands, conventions and a note on what to keep when the context is compacted. Put the details in `docs/` and in per-app CLAUDE.md files.
- **SOT-035** `SHOULD` List each source-of-truth doc in CLAUDE.md with a one-line description of what it covers. — _why:_ the one-line scope lets Claude pick only the doc the task needs.
- **SOT-036** `SHOULD` Add a CLAUDE.md inside each app folder (for example `apps/backend`, `apps/frontend`) with that layer's local rules. It lists which invariant sections and convention docs to read first, plus the local stack rules (for a frontend: state, forms, auth, i18n, UI). Each rule cites the invariant it enforces by number, for example "(INV-1)". — _why:_ the app gets its own constraints without loading the whole doc set.
- **SOT-037** `SHOULD` Keep AGENTS.md as a byte-identical copy of CLAUDE.md so that coding agents other than Claude follow the same rules. Mirror every scoped CLAUDE.md the same way (e.g. `apps/backend/AGENTS.md`), and update both files in the same change; a `cmp CLAUDE.md AGENTS.md` check in CI keeps them byte-identical.

Skeleton for the source-of-truth block of the root CLAUDE.md:

```markdown
## Sources of truth (read ONLY what the current task needs)
- `<INVARIANTS_DOC>` — NON-NEGOTIABLE (concurrency, idempotency, timezone/calendar, storage, realtime, state boundaries, webhooks, audit, error format, observability, soft delete, auth)
- `<BUSINESS_RULES_DOC>` — product rules
- `<DATA_MODEL_DOC>` — entities, columns, enums (used VERBATIM)
- `<DECISIONS_LOG>` — decisions are FINAL; do not reopen them
- `<SPRINT_PLAN_DOC>` — sprint order + output contract
- `<STATE_CONVENTIONS_DOC>` — frontend server vs UI state
- `<ERROR_CODES_DOC>` — error-code catalogue
- `<SEED_SCENARIOS_DOC>` — named seed actors (mandatory)
- `<DEPLOYMENT_DOC>` — deploy pipeline and gotchas
- `<VISION_DOC>` — scope and doc map

## Precedence on conflict
Technical invariants > Decisions log > Business rules > implementation choices. An apparent conflict between a business rule and an invariant → STOP and ask for clarification.
```

## Keeping docs in sync with the code

- **SOT-038** `MUST` To change a rule, edit the doc first, then tell the agent "re-read section X, it changed". Never give change instructions only in chat without updating the doc. — _why:_ changes made only in chat drift away from the source of truth.
- **SOT-039** `MUST` When each feedback sprint closes, copy every decision it made into `<DECISIONS_LOG>` and update the affected `<BUSINESS_RULES_DOC>` and `<DATA_MODEL_DOC>` sections in the same change. — _why:_ otherwise a new agent that reads only those docs will implement outdated rules.
- **SOT-040** `MUST` Change invariant or contract docs only to reflect an implementation that has been validated or an explicit decision. When the canonical docs drift from a later approved decision, bring them back in line and link the decision history. Do not bring back the superseded behaviour.
- **SOT-042** `MUST` Update `<DATA_MODEL_DOC>`, `<ERROR_CODES_DOC>` and the implementation notes in `<BUSINESS_RULES_DOC>` in the same change as the code. Say explicitly (for example in the changelog) when the decisions log was left untouched. Treat any drift between `<DATA_MODEL_DOC>` and the schema as a defect.
- **SOT-043** `MUST` After a schema change, the same change also updates: the shared enums and types, `<DATA_MODEL_DOC>` (its update notes and tables), any dedicated contract doc, the DTOs that expose the field, the audit-snapshot allowlist, only if the field must appear in audit logs and has passed the sensitivity review in SEC-053 (the allowlist is deny-by-default, so new fields stay out until added), and the matching data-model note in your external knowledge base if you keep one.
- **SOT-044** `SHOULD` Record every change to a state transition in the state-machine concept note in the knowledge vault (MEM-019), if you keep one, and in `<DATA_MODEL_DOC>` and `<BUSINESS_RULES_DOC>`. `<STATE_CONVENTIONS_DOC>` covers where the frontend splits server state from UI state, not the enums, so touch it only when caching or optimistic-update flows change.
- **SOT-045** `SHOULD` Keep `<DEPLOYMENT_DOC>` in line with the real deploy pipeline (env files: see SEC-069).
- **SOT-046** `SHOULD` Keep the setup README accurate: the infra command, ports, env-file steps, migrate, seed, and the required build order (for example, build the shared package before typecheck). Remove references to documents that no longer exist.
- **SOT-048** `SHOULD` With the product owner's approval, move executed worksheets and delivered feedback-sprint docs to `docs/archive/` with a short index. — _why:_ large outdated docs end up in agents' context and mislead them.

## Traceability

- **SOT-049** `MUST` Cite invariants, rules and decisions by section number or ID in the changelog and acceptance checklists (for example INV-4, a decision ID or an audit item ID). For code comments, see WM-043.

## Adapting to a new project

- Create the numbered doc set (01–08 plus `<STATE_CONVENTIONS_DOC>` and `<ERROR_CODES_DOC>`), fill in the placeholder table above, and put the doc map table at the top of `<VISION_DOC>`.
- Write `<INVARIANTS_DOC>` first. Decide your non-negotiables — concurrency/locking, idempotency of critical writes, timezone and business calendar (`<BUSINESS_TZ>`), file storage, realtime/event publication, frontend state boundaries, payment webhooks, audit log, error-response format, observability, soft delete/data protection, auth and sessions — one numbered section each. Number them INV-1..INV-n so that code, skills, changelogs and per-app CLAUDE.md files can cite them.
- Choose the ID prefixes for decision series and adopt the Decision / Rationale / Impact template. Fill the log with your initial stack and architecture decisions.
- Name the seed actors and scenarios in `<SEED_SCENARIOS_DOC>` before writing any seed script.
- Paste the CLAUDE.md skeleton into the root CLAUDE.md, add a CLAUDE.md to each app folder, and mirror each of them to an AGENTS.md next to it.
- Decide what a schema change has to update in your stack: shared package, DTOs, audit allowlist, external knowledge base. Put that list at the top of `<DATA_MODEL_DOC>` as an "After a schema change, also update" checklist (SOT-043).
- Clear every open proposal and every DECISION NEEDED before the first coding sprint starts.
