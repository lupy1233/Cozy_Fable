---
name: audit-to-plan
description: Use this skill when the user asks for a full app audit, a pre-launch readiness check ("is it ready to launch?", "e gata de lansare?"), or a list and plan of improvements they will approve item by item, or asks to implement or resume the approved packages with agents ("audit", "improvement plan", "plan de imbunatatiri", "implement what I approved", "implementeaza ce am aprobat", "resume the program", "continua programul").
---

# Audit -> approved plan -> agent execution

Four phases: AUDIT (read-only) -> PLAN (the owner approves item by item) -> EXECUTE (approved packages only) -> HANDOFF (DEL-025). Nothing moves from PLAN to EXECUTE without owner approval. Rule IDs point to the workspace rule chapters: 01 working method (WM), 03 delivery (DEL), 04 engineering patterns (ENG), 05 quality gates (QA), 06 security (SEC), 07 product owner (PO), 08 memory and vault (MEM), 09 release and operations (OPS), 10 environment (ENV). `<PLACEHOLDERS>` take the values set in CLAUDE.md.

## When to use

- Full audit, "is it ready to launch?", or an improvement list the owner approves item by item.
- Implementing approved packages with agents, or resuming a stopped program from its HANDOFF.md.
- Not for a single feature or bug (use sprint-delivery). If an audit or plan already exists, resume its items instead of re-auditing (WM-014).

## Read first

- `CLAUDE.md`; `docs/02-technical-invariants.md` (always); `docs/07-decisions-log.md` (final decisions); only the sections of `docs/03-business-rules.md` and `docs/04-data-model.md` an area touches (WM-010).
- `<MEMORY_DIR>/MEMORY.md` and the previous audit/program memory; when resuming, `<PROGRAM_DIR>/<program-id>/HANDOFF.md` and the open-items file.
- The vault map and "Observations and limits" note at `<VAULT_PATH>` (knowledge-vault skill). If it is stale (MEM-027), treat it as hints, not evidence.
- The top of `CHANGELOG.md`, the decision-gate and security-close skills.

## Procedure

**A. Audit (read-only)**

1. Record the baseline: date, branch, `git rev-parse HEAD`, count of uncommitted files. Audit the working tree, not HEAD (MEM-028). Open `<VERIFICATION_LEDGER>` (QA-105).
2. Run the gates first and save each raw log with its command and exit code under `<PROGRAM_DIR>/<program-id>/logs/` (DEL-027): build `<SHARED_PKG>`, `<TYPECHECK_CMD>`, `<LINT_CMD>`, each package's tests separately, then the package manager's outdated-dependency and production-advisory audits (e.g. `pnpm outdated -r`, `pnpm audit --prod`). List every package a recursive gate silently skipped (no lint/typecheck/test script) as a finding (QA-004).
3. Follow-up audit: open with the status of the previous blockers (`<fixed>/<total> previous P0 fixed`), re-verified in code, then the ones still open (DEL-029).
4. Split the app into areas: public pages; each role's flow; admin; auth/security; business logic (state machines, money, deadlines, concurrency); infra/deploy; shared package + schema; the end-to-end workflow across roles; i18n/copy (parity, glossary, tone); dead code + dependencies; quality gates/CI/tests.
5. Spawn parallel read-only finders, one per area, never more than `<MAX_AGENTS>` at once (DEL-037). Every finding is `[P0|P1|P2|P3] path:line — problem -> recommendation` or a live reproduction (steps + observed result). Counts (dead code, dead keys) come from reproducible scripts (DEL-027).
6. Optionally add a live walkthrough on localhost as each role, with test accounts taken from seed/fixture files (DEL-026).
7. Run a completeness critic (which areas, roles and flows nobody covered), then a second round of finders on those gaps (DEL-026).
8. Verify every finding adversarially, one verifier per finding; every P0/P1 gets a second independent skeptic (DEL-025). Keep the refuted list with reasons.
9. Dedup across areas (one root cause = one finding carrying all evidence). Classify P0-P3; build the to-delete list, the "done well, do not touch" list, and ONE owner-decision table grouped by theme: ID `D-<series>-<n>`, question, recommended answer with its reason (PO-014).
10. Answer the pre-launch checklist below as pass/fail with evidence.
11. Write the report in DEL-028 order.

**B. Plan**

12. Group findings into packages (DEL-030): `id`, imperative headline, steps, `done_when` (checks the owner can verify), `decision_needed` with a safe reversible default (WM-006), and `findings[]` each with priority, id, description, proposed fix and evidence. Give every package and finding a task ID with a tracked state (DEL-032).
13. Order packages by severity into phased sprints with relative estimates (keep ~25% for integration, WM-018) and mark the launch cut-line (DEL-031). Present action-first: line one is the next action; each package shows a "Do first" step under 30 minutes, 2-5 steps, 1-3 "Done when" checks, an estimate and "Your call first" when it needs a decision (PO-045).
14. Publish an interactive approval page `<APPROVAL_PAGE>`: an Approve toggle and a note per package and per finding, persisted in the page's shared database collection (e.g. `approvals`, doc id = package/finding id, `{approved, note, updatedAt}`), never in localStorage (PO-007). Banner: nothing here is implemented yet; sprints start only with the owner's agreement, in the listed order (PO-005).
15. Save the raw JSON (findings, verifications, refuted, dedup map, plan) and the generator/workflow scripts in `<PROGRAM_DIR>/<program-id>/` (MEM-010). Write a memory entry linking the folder and the page (MEM-005, PO-044). Stop and wait for approvals.

**C. Execute (approved packages only)**

16. Read the approvals from the page database and write `approved-plan.json` containing only approved packages, in the approved order (PO-005, PO-007).
17. Run sprints sequentially. Run packages in parallel only when their file sets are disjoint. While the main tree holds uncommitted work, stay in that single tree with explicit file ownership (DEL-037); give each package its own worktree only after a checkpoint commit (DEL-038). Migrations, shared contracts, central stores, locale catalogs, manifests and the lockfile have one owner at a time.
18. Start every agent prompt with the shared preamble (DEL-035) and these HARD RULES: no git commit/push/stash/checkout/reset; no deploy, production or platform CLI, and never a runnable deploy command anywhere in the prompt, not even quoted as an example (OPS-005); no `.env` edits; no deleting or rewriting files outside the brief; decisions-log entries are final; no invented business numbers (WM-002); test accounts on localhost only. Add: repo layout, running local services, sources of truth, skills and vault notes to read, the plan-file path, task IDs and exact files, the result schema and stop conditions.
19. Pipeline per package, each step a separate agent returning a structured result (DEL-033, DEL-034):
    - planner (`<STRONG_MODEL>`): modules, tables, files, migration_needed, assumptions, decisions (question / resolved_by_docs / chosen_default / why_safe / needs_owner), ordered brief, concrete verification commands, skipped findings with reasons;
    - implementer: `<STRONG_MODEL>` for money, state machines, security and migrations; `<FAST_MODEL>` for mechanical UI from the planner's brief (DEL-036). Returns changed files, migrations, locale keys, tests added, items not done with reasons, decisions needed;
    - independent verifier (`<STRONG_MODEL>`): full gates, then every `done_when` checked against the local stack via curl with a cookie jar and DB reads, each recorded pass/fail/not-testable with how (QA-045); fixes small issues, reports larger ones;
    - sprint closer: `<SECURITY_CHECKLIST>` over the sprint diff, locale parity script (QA-067), CHANGELOG entry (DEL-011), proposed commit message (not run).
20. After each sprint (DEL-017) persist the sprint report, open items (decisions, remaining issues, not-done items with reasons) and the program summary to `<PROGRAM_DIR>`; list the vault notes the sprint affected in its CHANGELOG entry plus an unticked "refresh vault notes" item (MEM-025); mark packages delivered on the approval page; refresh the owner status page (PO-044): try-it steps, open decisions with their defaults, remaining work, ops items, checkpoint-commit command.
21. On stop or finish write `HANDOFF.md` (DEL-042): verified state (gates, where migrations were applied, uncommitted files), remaining packages with estimates and dependencies, numbered resume steps, rules still in force, durable files, then the post-program steps in order: (1) triage the open items with the owner (every DECISION NEEDED, verifier-reported issues, not-done items); (2) propose the checkpoint commit; (3) refresh the vault notes the program touched (MEM-025); (4) deploy only after owner approval and any blocking external data (OPS-001). Close the program only when every item is DONE with evidence or deferred with a reason and its user-visible impact (DEL-041). Update the memory entry.

## Pre-launch checklist (every audit answers each item)

- Legal pages: no bracketed placeholders; the operator's identity is filled in (SEC-114).
- No demo data, demo accounts or fictitious business identity in production; real admin from the dedicated seed (SEC-075, OPS-078).
- Every mock or placeholder (payments, generated documents, integrations, invented ratings or stats on public pages) lives in a named module, is labelled in the UI and is listed as a launch blocker; invented ratings or stats are never shown as real (ENG-115, SEC-049, SEC-119).
- Real SMTP with SPF/DKIM/DMARC, no mail sink in production; register -> inbox -> verify -> login tested (OPS-091, SEC-066).
- Config validated fail-fast at boot; production aborts on dev values (SEC-064, SEC-066).
- Account recovery: rate-limited verification resend and password reset (SEC-013, SEC-014).
- Scheduled off-site backups plus a restore test (OPS-079, OPS-082); error tracking, uptime alerting, health endpoint (OPS-069).
- No HIGH/CRITICAL CVEs in the web framework or mail library (SEC-101).

## Rules

- `MUST` keep the audit read-only; every statement cites `path:line` or a live reproduction (DEL-027).
- `MUST NOT` implement anything the owner has not approved, or change the approved order (PO-005).
- `MUST NOT` commit, push, deploy or publish without explicit owner approval in the session (WM-021, OPS-001).
- `MUST` judge every agent deliverable against the actual diff and test output, not its report (WM-029); the closer ticks only verifier-passed items (DEL-012).
- `MUST` report test totals faithfully: regular vs gated suites, skipped is not passed (QA-075); unverifiable checks are `UNVERIFIED` with a reason (WM-031).
- `MUST` save every output in `<PROGRAM_DIR>` or on the approval page, never only in the session scratchpad, which can disappear (MEM-010).
- `MUST NOT` write secrets or test-account credentials into reports, pages or memory; name where they live instead (MEM-030).
- `MUST NOT` exceed `<MAX_AGENTS>` concurrent agents (set from the host CPU count, e.g. 6 cores -> 4 agents including the root), or run installs or production builds concurrently in a shared checkout (DEL-037).
- `MUST` record undecided product questions as `DECISION NEEDED` with a safe default in code (WM-006).

## Done checklist

- [ ] Baseline SHA, tree state and raw gate logs saved; skipped packages listed.
- [ ] Previous blockers' status reported first (follow-up audits).
- [ ] Critic + second round run; every finding verified (P0/P1 twice); refuted list kept.
- [ ] Deduped, classified P0-P3; to-delete, done-well lists and one owner-decision table present.
- [ ] Pre-launch checklist answered with evidence.
- [ ] Packages with id/steps/done_when/decision_needed/findings; phased sprints, estimates, cut-line.
- [ ] Approval page live with persisted approvals; raw JSON durable; memory entry written.
- [ ] Execution: only approved packages; every sprint has report, CHANGELOG entry, proposed commit.
- [ ] HANDOFF.md written with post-program steps in order; status page and approval page current.

## Pitfalls

- A recursive lint that skips packages without a lint script (e.g. `pnpm -r --if-present lint`) can report green while whole packages were never linted (QA-004).
- A test runner that ignores paths containing `.claude` finds 0 tests in worktrees under `.claude/` (Jest: pass an explicit `--testMatch`) (ENV-041).
- A dev server started in a worktree locks it: confirm the PID's command line and working directory, stop only your own process, then remove the worktree (ENV-041).
- Parallel packages create migrations with identical timestamps: check the newest one first, rename at merge (ENV-031).
- Parallel i18n edits collide: agents return locale fragments `{<locale>: {...}}` and one integrator deep-merges them (DEL-039). The first package to land owns shared names (queues, events, settings, keys) (DEL-040).
- A deploy command inside a backticked string once started a real deployment from an agent shell: ban platform CLIs by name in every prompt and never link the main checkout to a production service (OPS-005, OPS-101).
- A curl login can end the browser session when the app allows one session per account (ENV-059).
- Dev-mode first-visit route compilation (Next.js: 5-10 s) is not a latency finding; measure the API directly (ENV-036).
- Old audit annexes and a stale vault state wrong things with authority: revalidate before acting (WM-014, MEM-027).
