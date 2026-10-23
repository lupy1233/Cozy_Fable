# Sprint & delivery protocol

This chapter covers how work is scoped, delivered, documented, committed and handed over, from a single sprint up to a multi-agent improvement program.
Reuse the contracts and checklists as they are. Fill in the `<PLACEHOLDERS>` (doc paths, locales, agent limits, model names, approval page) once for the new project, and record those choices in its `CLAUDE.md`.

## Sources of truth and sprint order

- **DEL-001** `SHOULD` Run sprints in the order defined in `<SPRINT_PLAN_DOC>`, and shape every sprint's output to the output contract defined there (see "Output contract" below).
- **DEL-002** `SHOULD` Write the master prompt in `<SPRINT_PLAN_DOC>` as tagged blocks: `<ROLE>` (senior full-stack architect, product architect, tech lead, database architect and security reviewer), `<NON_NEGOTIABLE_CONTEXT_RULE>`, `<FIRST_ACTION>`, `<WORKING_MODE>`, `<OUTPUT_CONTRACT_FOR_CODE_TASKS>` and `<IMPLEMENTATION_ORDER>`. Paste it as the first message of a fresh agent chat, with the full doc set attached.
- **DEL-003** `MUST` Sprint 0 is design only and contains no code. This is the canonical Sprint 0 deliverable list; other chapters point here. It delivers: the monorepo architecture, with its layering and directory structure; the backend module list, with each module's responsibilities; the frontend areas and their main routes; the full data model, with enums and relation cardinality; an endpoint map grouped by module; the critical flows, step by step; a conceptual ORM schema proposal (pseudo-schema); `STATE_CONVENTIONS.md` (the server-state vs UI-state boundary, with worked examples); `ERROR_CODES.md` (the anticipated error codes); proposed initial seed values for tunable business parameters and the final field list of the main input form, both submitted for owner review; and the technical risks, plus their DECISION NEEDED items. The Sprint 0 answer contains no code, is reviewable in about 30 minutes, and Sprint 1 waits for the owner's review of it (PO-006). — _why:_ a design the owner can review in one sitting gets corrected as a doc edit, before any code depends on it.
- **DEL-004** `SHOULD` Leave open technical choices, such as which PDF library to use, for Sprint 0. Decide each one there and write down the justification.
- **DEL-005** `SHOULD` Order sprints by dependency:
  - Sprint 0 delivers the design (DEL-003).
  - Sprint 1 lays the foundations: monorepo, infra containers, root Docker Compose, env validated fail-fast, module skeleton, health checks and i18n. Observability starts here, not at launch: structured JSON logs with a traceId per request (SEC-056) and the strict health route (OPS-068) ship in Sprint 1, and failed queue jobs are visible in an admin jobs view from the first queue onward (STK-036).
  - Sprint 2 covers auth, sessions, roles, guards and global validation.
  - The domain sprints follow, in dependency order.
  - The last sprint covers admin, the audit viewer, seed data, UI polish, end-to-end demo flows and minimal hardening.

## Before a sprint: declare the scope

- **DEL-006** `MUST` Before each sprint, and before each package inside a sprint, declare its scope:
  - the sprint or task IDs;
  - the modules it touches and who owns which files;
  - the database tables it reads and writes, existing and new;
  - new endpoints, schema or version bumps, and whether any invariant changes;
  - the assumptions made;
  - its dependencies;
  - anything deferred to a named later sprint.

  Write this as a scope block at the top of the sprint doc, runbook or implementation doc, and state negatives explicitly: "no table touched", "no new endpoints", "no schema or version bump", "no invariant changes".

  — _why:_ Making the scope explicit lets the product owner (PO) catch wrong assumptions before any code is written.
- **DEL-007** `MUST` Before implementing, read the SKILL.md of every local skill that matches the layers you will touch. For which doc sections to read, follow SOT-030 and SOT-033.

## Output contract

- **DEL-009** `MUST` Every sprint deliverable follows this fixed, ordered output contract:
  1. sprint objective;
  2. impact on backend, frontend, DB, realtime, security and audit;
  3. files and modules, with paths;
  4. complete, runnable code, with nothing guessed;
  5. schema and migration, when data changes;
  6. DTOs, guards, services, controllers and validation;
  7. components, hooks, queries/mutations and Zod schemas;
  8. manual test plan (API client or browser);
  9. verifiable acceptance checklist;
  10. DECISION NEEDED for every critical gap;
  11. CHANGELOG.md update.

  Write the deliverable concisely: no preamble and no redundant summaries.

  — _why:_ A predictable structure means every sprint is reviewed the same way.

## After a sprint: CHANGELOG, tests and acceptance

- **DEL-010** `MUST` Before any commit, CHANGELOG.md covers every change in the working tree.
- **DEL-011** `MUST` Add each CHANGELOG entry at the top of the file, so the newest entry comes first. Use one of two entry types:
  - **Plan-sprint entry.** Header: `Sprint <N> (plan <date>): <title> (<priority>) — <date>`, with these fixed sections:
    - Objective.
    - Impact per layer: DB migration and its rollback, Backend, Shared, Frontend, i18n parity count, Realtime, Security, Audit and deploy compatibility.
    - Files.
    - Security close.
    - Closure measurements: each gate command with its exit code (shared build, typecheck, lint), suite and test counts per package, and which suites were skipped and why (for example, integration suites with no test DB URL).
    - Manual test plan, in 3-6 steps: curl calls including negative cases, then browser checks per role, in every locale in `<LOCALES>`, on desktop and on mobile.
    - Acceptance checklist.
    - DECISION NEEDED.
    - Remaining, split into (a) code work not done, with reasons, and (b) everything else still open: inputs still expected from the owner, decisions not yet approved, manual QA still owed, non-code production setup (domain and origin env vars, real SMTP with SPF/DKIM, payment keys and webhook, legal identity data, third-party API keys, production scripts to run), and anything waiting on deploy approval.
    - Proposed commit message.
  - **Feedback-round entry.** Header: `Sprints <X>1–<X>n — <date> — PO feedback round <k> (docs/NN): <summary>`, one bullet per delivered item, then `### Acceptance checklist <X>1–<X>n`.

  This "Remaining" list is canonical: every delivery note to the owner, not only the CHANGELOG entry, ends with it.
- **DEL-012** `MUST` In a multi-agent sprint, the closer ticks only the items the independent verifier recorded as pass; everything else stays unticked with its blocker and what covers it instead (WM-029, QA-072).
- **DEL-013** `MUST` A sprint with several packages gets one closure entry at the top that points to the per-package entries below it. Each entry cites the package and finding IDs it implements.
- **DEL-014** `MUST` For work the PO will test, write the acceptance checklist as user-observable steps (where to click, what must appear), one line per delivered item, left unticked for the PO. The sprint doc carries the same list plus a manual test plan with concrete inputs, steps and expected results. — _why:_ The PO can then accept the work by clicking through the product instead of reading code.
- **DEL-016** `SHOULD` For release-bound work, keep a rollout-and-acceptance doc (`<ROLLOUT_DOC>`) that opens by stating it does not authorize deployment (OPS-002). It holds two dated tables: acceptance (`Area | Current evidence | Remaining boundary`) and remaining issues by severity (release blocker / high gap / medium gap / review), with the user impact and next step of each. Never mark a remaining boundary as a completed test.
- **DEL-017** `MUST` After each sprint of an approved plan:
  - review the diffs;
  - run the relevant tests;
  - record manual and visual evidence;
  - update the plan checklist;
  - update the CHANGELOG per DEL-010/DEL-011;
  - refresh the vault notes you touched (MEM-025);
  - mark the package delivered on the approval page (`<APPROVAL_PAGE>`, PO-007);
  - prepare the checkpoint commit command without running it (WM-021/WM-022).

## Commits and releases

- **DEL-018** `MUST NOT` Bundle unrelated changes into one commit. In particular, never mix a production bugfix with a copy or UI rewrite. — _why:_ A bugfix must be deployable and revertable on its own.
- **DEL-043** `MUST` Stage commits explicitly. With each proposed commit, give the user the review-and-stage commands: `git diff`, `git add -p` for hunks, and `git add -- <file>` for each new file. Claude stages only after the owner approves the commit, and only with `git add -- <paths>` naming the intended files: never `git add -A` or `git add .`, and never pre-existing untracked files that are not part of the change. — _why:_ The tree often holds the user's unrelated uncommitted work, and a blanket add commits it under the wrong message.
- **DEL-019** `SHOULD` Give each delivered round its own commit(s) and its own CHANGELOG section. Track its deploy status separately from code completion: either deployed, with the deployment id, or not deployed, with the reason.

Release records (dated promotion record, current-state banner of the deployment doc): see OPS-102.

## Feedback rounds and numbered docs

Feedback-round docs and lettered sprint IDs: see PO-001/PO-002. Open decisions and unapproved ideas: see PO-005/PO-014 (critique cycles: PO-003). Fill-in worksheets for many content decisions: see PO-047.

- **DEL-024** `SHOULD` Structure a feature-design proposal modelled on a reference product in this order:
  0. one opening line with the decision or approval you need from the PO (PO-045);
  1. how the reference product works (what we copy);
  2. the proposed architecture, aligned with the existing stack;
  3. the sprints, each with its own acceptance criterion;
  4. the decisions needed before sprint 1;
  5. risks and known limits.

  State what the feature explicitly does not promise, and move extras into an optional "after feedback" sprint. For execution plans and package lists, use the action-first format of PO-045 instead.

## Large improvement programs: from audit to plan

- **DEL-025** `MUST` Run a large improvement program as a pipeline:
  1. a read-only multi-agent audit, split by area;
  2. adversarial one-to-one verification of every finding, with every P0/P1 finding verified twice by independent skeptics;
  3. cross-area dedup;
  4. work packages;
  5. sprints grouped into phases, with effort estimates;
  6. owner approval;
  7. execution of approved packages only;
  8. per-sprint reports and a status page;
  9. a handoff.

  — _why:_ Verification and dedup turn hundreds of raw findings into a plan the owner can approve item by item.
- **DEL-026** `SHOULD` Staff the audit with:
  - area finders;
  - a completeness critic;
  - second-round finders;
  - one adversarial verifier per finding, plus a second skeptic for every P0/P1 (required by DEL-025);
  - a cross-area dedup pass;
  - synthesizers;
  - a planner.

  Add a live walkthrough on localhost as each user role.
- **DEL-027** `MUST` Keep audits strictly read-only: they produce findings, a verdict and a checklist, and never fixes. Every statement cites code (`path:line`) or a live reproduction. Counts, such as dead code, come from reproducible scripts. Record the repo commit and each exact command with its exit code, and save the raw logs next to the report.
- **DEL-028** `MUST` Structure the audit report in this order:
  1. verdict and executive summary;
  2. P0 launch-blocker checklist;
  3. P1;
  4. P2 polish;
  5. to-delete list;
  6. "done well, do not touch" list;
  7. one consolidated list of questions and decisions for the owner;
  8. recommended sprint order.

  Write each finding as `[P0|P1|P2] path:line — problem → recommendation`.
- **DEL-029** `MUST` A follow-up audit starts with the status of the previous audit's blockers (for example `<fixed>/<total> previous P0 fixed`), then lists the remaining ones.
- **DEL-030** `MUST` Give each plan package an id, a headline, steps, "done when" acceptance checks and a decision_needed field. Attach its findings, each with a priority, ID, description, proposed fix and evidence.
- **DEL-031** `SHOULD` Rank packages by severity and mark a recommended launch cut-line in the sprint plan. After approval (PO-007), implement in sprint order, one package per deliverable, checked against its "done when" list.
- **DEL-032** `MUST` Give every user requirement and audit item a task ID, keep a table that maps each requirement to its tasks, and end each phase with an explicit gate. Track each task with one of these states: TODO, IN_PROGRESS, BLOCKED (with a reason), READY_FOR_REVIEW, DONE (with evidence). Record its owner, files, dependencies, evidence and remaining risk. Nothing is DONE until integration passes.

## Multi-agent execution

- **DEL-033** `MUST` Implement each package in three steps: plan, implement, then verify independently. Use a separate agent for each step, and never let the implementer verify its own work. Close each sprint with a closer agent that runs `<SECURITY_CHECKLIST>` and typecheck/lint, writes the CHANGELOG entry, and proposes the commit without running it. The verifier may fix small problems itself (typecheck/lint failures, missing locale keys, obvious bugs), then re-runs the gates and reports larger problems as remaining issues. The closer fixes what the security checklist finds and lists the rest. No agent ever commits.
- **DEL-034** `MUST` Agents return structured results.
  - The planner returns: modules, tables, files, migration_needed, assumptions, decisions (question, resolved_by_docs, chosen_default, why_safe, needs_po), an ordered brief for the implementer, concrete verification commands, and skipped findings with reasons.
  - The implementer returns: changed files (repo-relative), migrations, locale keys added, tests added, what works now, items not done with reasons, and decisions needed.
  - The verifier returns: typecheck, lint and test results; each done-when check as pass, fail or not-testable, with how it was checked; fixes made; remaining issues; changed files.
  - The closer returns: security findings, fixes made, whether the CHANGELOG entry was added, the proposed commit message, and decisions needed.

  — _why:_ With structured outputs, the verifier, the closer and the owner reports can use the results mechanically.
- **DEL-035** `MUST` Start every subagent prompt with a shared preamble: repo layout and stack, the local services running, hard rules, sources of truth, the skills and knowledge notes to read, and where the plan file is (`<PLAN_FILE>`). The hard rules are, at minimum: never run git commit/push/stash/checkout/reset or any deploy or production CLI (OPS-005); never edit env files; never delete or rewrite files outside the brief; never reopen final decisions; never invent business numbers that are not in the docs; use test accounts on localhost only. Then add the task IDs, exact scope and files, dependencies, required checks, the result schema and explicit stop conditions. The prompt itself never contains a runnable deploy command, not even quoted as an example (OPS-005).
- **DEL-036** `SHOULD` Route models by risk. Planning, verification, sprint close, and any code that touches money, state machines, security or migrations go to `<STRONG_MODEL>`. Mechanical, well-specified UI work can go to `<FAST_MODEL>`, working from a brief the strong model wrote; the strong model then verifies the result.
- **DEL-037** `MUST` Run sprints one after another. While the main working tree holds uncommitted work, do not use worktrees: a worktree starts from HEAD and would miss that work. Run parallel packages inside the single shared tree, and only when their files do not overlap. Only one owner at a time may change shared contracts, migrations, central stores, locale catalogs, package manifests or the lockfile. Cap concurrent agents by host CPU with `<MAX_AGENTS>` (for example, 6 cores allow 4 agents: the root plus 3). Never run package installation or production builds concurrently in the shared checkout; a checker waits until all writers finish. Ownership of a locked file moves only through an explicit handoff, which the root publishes before the next agent writes that file. — _why:_ Shared modules and a single local stack make parallel writers collide.
- **DEL-038** `SHOULD` Only once the shared baseline is committed (a checkpoint commit, with the shared groundwork such as dependencies, app bootstrap and config schema committed first) may you give each parallel agent its own worktree and a disjoint file set. Expect merge conflicts only in central registries such as error codes, and in migrations created with the same timestamp, which you rename at merge. — _why:_ This setup worked well in practice.
- **DEL-039** `MUST` When several agents or worktrees change i18n in parallel, each returns locale fragments (`{<locale>: {...}}`) and one integrator deep-merges them. Never edit the locale JSON files from several worktrees at once.
- **DEL-040** `MUST` When parallel packages need the same named resources (queue or job names, event names, settings or locale keys), the package that lands first owns the canonical names, and the others reuse them instead of creating variants.

## Closing a program and handing off

- **DEL-041** `MUST` Close a program only when every item is either DONE with evidence or explicitly deferred, with a reason and its user-visible impact. Unresolved critical or high correctness or security failures block release readiness. Recording evidence does not certify a release.
- **DEL-042** `MUST` When a program stops, write `HANDOFF.md` with these sections:
  - the verified state: checks, migrations and uncommitted files;
  - the remaining packages, with estimates and dependencies;
  - numbered steps to resume the work;
  - the rules still in force;
  - the durable files in the folder.

  End it with the post-program steps, in order:
  1. triage the open-items list with the owner: every DECISION NEEDED question (each already has a conservative, reversible default in code), the remaining issues reported by verifiers, and the items not done with their reasons;
  2. propose a checkpoint commit, which also unblocks per-package worktrees (DEL-038);
  3. refresh the knowledge notes the program touched and append a dated line to the vault's observations note (MEM-022);
  4. deploy, but only after the owner supplies any blocking external data.

## Adapting to a new project

- Write `<SPRINT_PLAN_DOC>`: the master prompt in tagged blocks (DEL-002), the output contract and the implementation order. Run Sprint 0 before writing any code.
- Fix the source-of-truth doc set and its paths (`<INVARIANTS_DOC>`, `<DECISIONS_LOG>`, `<BUSINESS_RULES_DOC>`, `<DATA_MODEL_DOC>`, `<DEPLOYMENT_DOC>`, `<ROLLOUT_DOC>`), and choose a numbering scheme for `docs/NN-<slug>.md`.
- List the `<LOCALES>` that i18n parity counts and manual test plans must cover.
- Set `<MAX_AGENTS>` from the host's CPU count, and choose `<STRONG_MODEL>` and `<FAST_MODEL>` for risk-based routing.
- Decide where `<PLAN_FILE>`, the status page and `<APPROVAL_PAGE>` live, and how the approvals are saved.
- Write `<SECURITY_CHECKLIST>` for the closer agent, plus a production-handoff list for your stack (env vars, mail, payments, legal data, third-party keys).
- Create a CHANGELOG.md template with both entry types from DEL-011, and a `HANDOFF.md` template with the sections from DEL-042.
