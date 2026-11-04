# <APP_NAME> — global rules

Monorepo: `apps/backend` (<BACKEND_STACK>), `apps/frontend` (<FRONTEND_STACK>), `<SHARED_PKG>` (shared TS types + validation schemas + ERROR_CODES), `<INFRA_DIR>/` (Docker: <LOCAL_SERVICES>).
Decision owner: <PRODUCT_OWNER>. Full rule text, cited by ID: `docs/workspace-rules/01-working-method.md` .. `10-environment-gotchas.md` (WM, SOT, DEL, ENG, QA, SEC, PO, MEM, OPS, ENV) and, with the stack pack, `docs/STACK-RULES.md` (STK); the kit installer copies both.
AGENTS.md is a byte-identical copy of this file (SOT-037). The installer creates it from the unfilled template: after filling the placeholders, re-copy CLAUDE.md to AGENTS.md, and keep the two identical in every later change.

## Sources of truth (read ONLY what the current task needs)
- `docs/02-technical-invariants.md` — NON-NEGOTIABLE, numbered INV-n (concurrency/locking, idempotency, timezone <BUSINESS_TZ> + business calendar, storage, realtime/events, state boundaries, webhooks, audit, error format, observability, soft delete, auth). Read on every change.
- `docs/03-business-rules.md` — product rules + terminology glossary (required/banned terms)
- `docs/04-data-model.md` — entities, columns, enums (used VERBATIM). Read before any schema change.
- `docs/07-decisions-log.md` — decisions are FINAL; never reopen or re-argue them
- `docs/05-master-prompt-and-sprints.md` — sprint order + output contract
- `docs/01-vision-and-stack.md` — scope in/out, actors, fixed stack, doc map · `docs/06-seed-scenarios.md` — named seed actors (mandatory as written)
- `docs/STATE_CONVENTIONS.md` — frontend server state vs UI state · `docs/ERROR_CODES.md` — error-code catalogue · `docs/08-deployment.md` — pipeline + runbooks

## Precedence on conflict
Technical invariants > Decisions log > Business rules > implementation choices. An apparent conflict between a business rule and an invariant is never resolved by order → STOP, mark `DECISION NEEDED`, ask <PRODUCT_OWNER>.
- An owner-approved decision in a feedback-round doc ranks as a decisions-log entry; copy it into the log when the sprint closes.
- Rules come only from the doc set. Memory, the vault and chat history never supply rules; when they disagree, the docs win and the stale note is fixed.
- Docs vs code mismatch with no recorded decision explaining it → edit neither; pin current behaviour with a test and raise `DECISION NEEDED`.
- To change a rule: update the doc first, then the code. The decisions log is append-only (D-<series>-<n>: Decision / Rationale / Impact).

## Mandatory behaviour
- Never guess or invent entities, rules, fields, names or business numbers. Critical gap → write `DECISION NEEDED` with the options and stop the dependent work; independent work continues.
- Undecided product question with a non-policy safe default → ship the conservative, reversible default (current behaviour, setting or flag OFF) with a `DECISION NEEDED` + item ID comment next to it, and record the question.
- State every unverified assumption as `assumption: <statement>; confirm by <method>`.
- Before each sprint/package: declare task IDs, modules, tables read/written, new endpoints, schema or version bumps, invariant changes, assumptions, dependencies, deferrals. State negatives ("no table touched"). Read the SKILL.md of every matching skill first.
- After each sprint: CHANGELOG.md entry at the top covering every working-tree change + an acceptance checklist written as user-observable steps, left unticked for the owner. Then propose the checkpoint commit (message + exact command) without running it.
- Use subagents for codebase research; read only the sections you need; never load large files whole without a reason.
- Outward actions: never `git commit/push/stash/checkout/reset`, deploy, publish or run production commands unless <PRODUCT_OWNER> asks in this session; every deploy or push needs its own approval. Every subagent prompt repeats this ban.
- Preserve unrelated uncommitted work; read the working-tree state of a file, not HEAD, before editing it. Never edit `.env` files.
- Verification is done by a separate agent, never the implementer. Judge subagent work by the diff and test output, not its report. Code that merely exists is not done.
- Report honestly: anything not exercised is `UNVERIFIED` (reason, who checks, what covers it). Label evidence as run / read in code / taken from docs, with date and environment.
- Bugs outside scope → a "pre-existing, found while <activity>" note with root cause; fix small ones, propose a package for large ones.
- Environment blocker (disk, Docker, backend down) → stop and write HANDOFF.md: state, unverified items, exact user action required, what must not be done meanwhile.

## Memory and knowledge vault
- Before editing code: read the vault map note at `<VAULT_PATH>`, each affected module note ("If you change this, check", "Known pitfalls") and the matching IMPACT playbook.
- After a sprint that changes architecture, flows, enums or dependencies: update those notes + a dated line in "Observations and limits". Build notes from the working tree, never HEAD.
- Memory: `<MEMORY_DIR>/MEMORY.md` index + one fact per file, absolute dates (YYYY-MM-DD), updated in place. Save every root-cause bug as a "do not reintroduce" gotcha.
- Never write passwords, tokens or keys into memory, vault or this file; name where they live instead. Durable program outputs go to `<PROGRAM_DIR>`, never only the scratchpad.

## Commands
- Backend: `<BACKEND_DEV_CMD>` · test: `<BACKEND_TEST_CMD>` · migrations: `<MIGRATE_DEV_CMD>`
- Frontend: `<FRONTEND_DEV_CMD>` · lint: `<LINT_CMD>` · typecheck: `<TYPECHECK_CMD>`
- Infra: `<INFRA_UP_CMD>` (e.g. `docker compose -f <INFRA_DIR>/docker-compose.yml up -d`)
- Gate order: build `<SHARED_PKG>` → typecheck → lint → tests; all green before acceptance; re-run the whole sequence after any fix during closure.

## Conventions
snake_case DB · camelCase code · PascalCase classes/components. UI: <LOCALES> via <I18N_LIB>; every visible string is a key in every locale. Code and endpoints in English. Comments in <WORKING_LANGUAGE>, only where they help: explain why and cite the decision/audit ID.
- Data-model names are used verbatim in schema, shared enums, API and UI; never rename or translate them. Never drop enum values; mark them "reserved".
- Owner-mandated terminology is a hard rule: apply the glossary to every new string in every locale.
- One concern per commit: never mix a bugfix with a copy or UI rewrite.

## Skills (`.claude/skills/`; read the matching SKILL.md before working)
- `workspace-bootstrap` — new project / adopting this kit, Sprint 0 (design only, no code)
- `decision-gate` — missing, ambiguous or conflicting requirement; recording an owner decision
- `sprint-delivery` — plan, implement, gate, verify and close a sprint or package
- `security-close` — PASS/FAIL checklist over the diff before closing or committing
- `ui-browser-verify` — any UI/copy change before it is reported done (desktop + phone, every locale)
- `knowledge-vault` — impact check before a change, vault/memory updates after it
- `po-feedback-round` — owner feedback batch → numbered round doc + lettered sprints
- `audit-to-plan` — read-only audit → owner-approved packages → agent execution → handoff
- `seed-scenarios` — seed data, fixtures, one-off data scripts, runs against shared/production DBs
- `release-rollout` — deploy, promote, rollback, production config (only on explicit request)
- Stack pack: `nestjs-module` · `prisma-migration` · `bullmq-worker` (queues, deadlines, time-based logic) · `ui-component` · `i18n-copy-change`

## On compaction ALWAYS keep
Current sprint/phase + active task IDs · completed tasks with evidence · files you modified (separate from the user's unrelated changes) · agent ownership and file locks · every open `DECISION NEEDED` item · pending checks · the next runnable task.
