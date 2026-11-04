---
name: sprint-delivery
description: Use this skill when planning, implementing or closing a sprint or work package, or when the user says "sprint", "implementeaza", "implementeaza sprintul", "inchide sprintul", "livreaza pachetul", "close the sprint", or asks for sprint deliverables, a CHANGELOG entry, a manual test plan or an acceptance checklist. Enforces the declare -> implement -> gate -> verify -> close output contract.
---

# Sprint delivery

One protocol for every unit of work (sprint, package, feedback item). Rule IDs point to the workspace rule chapters: 01 working method (WM), 02 sources of truth (SOT), 03 delivery (DEL), 05 quality gates (QA), 06 security (SEC), 07 product owner (PO), 08 memory and vault (MEM), 09 release and operations (OPS), 10 environment (ENV). `<PLACEHOLDERS>` take the values set in CLAUDE.md.

## When to use

- Starting, planning, implementing or closing a sprint or package, including each sprint of a feedback round (the po-feedback-round skill writes the round doc first).
- Writing a CHANGELOG entry, manual test plan, acceptance checklist or checkpoint-commit proposal.
- Resuming an interrupted sprint: rebuild the scope from the ledger and the latest CHANGELOG entry first.
- Not for read-only audits (audit-to-plan skill; DEL-027: findings only, no fixes) or deploys (release-rollout skill; own approval, OPS-001).

## Read first

Read only what the sprint touches; never load the whole doc set (WM-010, SOT-030).

- `docs/02-technical-invariants.md`: always, on every change.
- `docs/03-business-rules.md`: only the subsections the sprint touches.
- `docs/04-data-model.md`: the touched entities; mandatory before any schema change (SOT-026).
- `docs/07-decisions-log.md`: entries on the touched area. Planners always read it.
- `docs/05-master-prompt-and-sprints.md`: sprint order and output contract (DEL-001, DEL-009).
- Frontend work: the state-boundary invariant plus `docs/STATE_CONVENTIONS.md`. New or changed errors: `docs/ERROR_CODES.md`.
- The SKILL.md of every layer skill you will touch (DEL-007).
- Knowledge vault (knowledge-vault skill): the map note, each affected module note (at least "If you change this, check" and "Known pitfalls") and the matching IMPACT playbook (MEM-024).
- The working-tree state of every file earlier sprints touched, not HEAD (WM-024).
- The top of `CHANGELOG.md` and `<VERIFICATION_LEDGER>` for the last verified state.
- Inside an approved plan: the package's "done when" checks and the owner's notes on `<APPROVAL_PAGE>` (PO-007, DEL-031).

## Procedure

**Before**

1. Open `<VERIFICATION_LEDGER>` with the base SHA and the pre-existing uncommitted changes (QA-105). Track the files you modify separately from user-owned changes (WM-024, WM-045).
2. Write the scope block at the top of the sprint or implementation doc (DEL-006): sprint/package IDs; modules and file ownership; tables read and written (existing and new); new endpoints, schema or version bumps; invariant changes; dependencies; anything deferred to a named later sprint. State negatives explicitly: "no table touched", "no new endpoints", "no schema or version bump", "no invariant changes".
3. List assumptions as `assumption: <statement>; confirm by <method>` (WM-005). One that changes the product or an invariant: stop and ask.
4. Large change: propose the structure (modules, files, schema, flow) and get it reviewed before writing code (WM-017).
5. Route every gap or conflict through the decision-gate skill. If the docs decide it, follow them. Otherwise ship the safest reversible default with `DECISION NEEDED <id>` in a code comment next to it (WM-006), or stop only the dependent part (WM-001, WM-007). Business rule vs invariant conflict: stop and ask (WM-004).

**During**

6. Build the deliverable in the output-contract order (DEL-009): objective; impact per layer; files with paths; complete runnable code, nothing guessed; schema + migration when data changes; backend pieces (DTOs, guards, services, controllers, validation); frontend pieces (components, hooks, queries/mutations, validation schemas); manual test plan; acceptance checklist; DECISION NEEDED items; CHANGELOG.
7. Use entity, table, column and enum names verbatim from the data model (SOT-025). A name the doc does not define needs owner confirmation and a data-model entry in the same change (SOT-027).
8. Update in the same change: the data-model doc, the error-code doc and the business-rules implementation notes (SOT-042); after a schema change also the shared enums/types, DTOs and contract docs (SOT-043). Rule changes go into the doc first, then the code (SOT-038).
9. Comment non-obvious code with the why and the decision or package ID (WM-043).
10. Touch only files in scope; never delete or rewrite unrelated work (WM-024). Parallel packages share one tree with disjoint files; shared contracts, migrations, locale catalogs, manifests and the lockfile have one owner at a time (DEL-037).

**Gates** (in this order; after any fix, re-run from step 11, QA-002)

11. Build `<SHARED_PKG>`.
12. `<TYPECHECK_CMD>`.
13. `<LINT_CMD>`, with every package actually linted (QA-004).
14. Unit tests per package (backend, frontend, shared). Record suite and test counts per package (QA-003).
15. Integration tests against the isolated local database whenever the change touches transactions, idempotency, soft delete or uploads (QA-014); concurrency and money fixes are proven with real concurrent calls (QA-032, QA-033). The suites are env-gated and host-guarded (QA-026, QA-027). Record each skipped suite with its reason (QA-075).

**Verify**

16. Independent diff review, untracked files included (WM-028). Check every done-when item against the running stack as pass / fail / not-testable, with the method (QA-045). Fix confirmed in-scope findings and record them as "fix at verification"; out-of-scope bugs follow WM-036.
17. Run the security-close skill over the diff. A FAIL blocks closure until patched; then re-run the gates (SEC-001, SEC-002, QA-002).
18. Locale parity script over every catalog in `<LOCALES>`: each parses, equal key counts, 0 missing keys, owner-banned terms at 0; record the counts (QA-066, QA-067).
19. UI changes: run the ui-browser-verify skill at desktop (~1280 px) and 375 px in every locale: 0 horizontal overflow, 0 console errors, fresh screenshots reviewed (QA-051, QA-055). Anything the tools cannot check is reported as `UNVERIFIED` with the reason, who must check it and what covers it instead (WM-031).
20. Restore test data with targeted reverts of exactly the rows and settings you changed, never a whole-database restore (WM-027, ENV-022). List leftovers under Remaining.
21. Append every run to the ledger: exact command, exit code, scope, checks still remaining (QA-105).

**Close**

22. Add the CHANGELOG entry at the top of the file (DEL-011). Before any commit it must cover every working-tree change (DEL-010). A multi-package sprint gets one closure entry that points to the per-package entries below it, each citing its package and finding IDs (DEL-013). Feedback-round sprints use the feedback-round entry type (po-feedback-round skill).
23. Inside an approved plan: update the plan checklist and mark the package delivered on `<APPROVAL_PAGE>` (DEL-017, PO-007).
24. Propose one checkpoint commit per sprint: message written to a file, `git commit -F <message file>` (ENV-011), staged set exactly the intended files, unrelated changes split (DEL-018, WM-022). Do not run it unless the owner asks in this session (WM-021).
25. List the vault notes and memory entries to update (MEM-025), with absolute dates (MEM-003); save root-cause bugs as "do not reintroduce" gotchas (MEM-011). Update them now, or add an unticked "refresh vault notes: <list>" acceptance item.

CHANGELOG entry template (plan-sprint type, DEL-011):

```
## Sprint <ID> (plan <plan date>): <title> (<priority>) — <YYYY-MM-DD>
### Objective
### Impact — DB (migration + rollback) / backend / shared / frontend / i18n parity count / realtime / security / audit / deploy compatibility
### Files
### Security close — PASS/FAIL per check, evidence, scope, residual limits
### Closure measurements — each gate command + exit code; suites/tests per package; skipped suites + reason
### Manual test plan — 3-6 steps: API calls incl. negative cases, then browser per role, every locale, desktop + mobile
### Acceptance checklist — user-observable steps; [x] only with verifier evidence in parentheses
### DECISION NEEDED — question, options, default shipped, where to flip it
### Remaining — (a) code not done + reason; (b) owner/production actions; deploy status (NOT DEPLOYED + reason, or deployment id); leftover test state
### Proposed commit message
```

## Rules

- MUST NOT guess or invent entities, rules, fields or business numbers (WM-001, WM-002).
- MUST NOT reopen, re-argue or edit a logged decision (SOT-016, SOT-017).
- MUST NOT verify your own implementation; verification is a separate agent or adversarial review (WM-028, DEL-033).
- MUST judge subagent work against the actual diff and test output, never its completion report (WM-029).
- MUST start every subagent prompt with the shared preamble and its hard rules, including the ban on git commit/push and on any deploy or production command; never put a runnable deploy command in a prompt, even as an example (DEL-035, OPS-005).
- MUST write the acceptance checklist as user-observable steps left for the owner to click through (DEL-014); tick an item only with verifier evidence in parentheses, the rest stay unticked with their blocker (DEL-012, QA-072). Existing code is not done (QA-074).
- MUST report test totals faithfully: gated suites listed separately, skipped is not passed, overlapping runs never summed (QA-075).
- MUST label each piece of evidence with how, when and where it was established; say so when nothing was run (WM-032).
- MUST cite invariant, rule, decision or package IDs in the CHANGELOG and checklists (SOT-049).
- MUST NOT commit, push, stash, checkout, reset, deploy or publish unless the owner asks in the current session (WM-021, OPS-001).
- MUST stop on an environment blocker (disk full, Docker or backend down) and write HANDOFF.md with the exact user action required and what must not be done meanwhile (WM-046).
- MUST NOT write passwords, tokens or keys into the CHANGELOG, memory or vault notes (MEM-030).
- Style: concise, no preamble, no redundant summaries.

## Done checklist

- [ ] Ledger opened; scope block and assumptions declared before any code
- [ ] Structure proposed and reviewed (large changes only)
- [ ] Deliverable in output-contract order; names verbatim; data-model / error-code / business-rule docs updated, or "no doc change" stated
- [ ] Shared build -> typecheck -> lint -> unit -> guarded integration all green, counts recorded
- [ ] Independent diff review done; in-scope findings fixed
- [ ] security-close PASS
- [ ] Locale parity: 0 missing keys, banned terms 0
- [ ] UI verified at desktop + 375 px in every locale, or `UNVERIFIED` stated with reason
- [ ] Test data restored; leftovers listed
- [ ] Every DECISION NEEDED has a reversible default and a code comment
- [ ] CHANGELOG entry at the top with all sections, deploy status included
- [ ] Approved plan only: plan checklist and approval page updated
- [ ] Checkpoint commit proposed (not run); vault notes and memory entries listed

## Pitfalls

- Typechecking before building the shared package gives false errors against a stale build (QA-002).
- A recursive lint that skips packages without a lint script (e.g. `pnpm -r --if-present lint`) can report green while whole packages were never linted (QA-004).
- With sprints stacked uncommitted, HEAD is stale: read the working tree. Worktrees start from HEAD and miss that work (WM-024, DEL-037).
- Calling the API before a watch-mode dev server finishes restarting tests the old build; poll the log for the boot marker (QA-042).
- Changing UI copy breaks browser tests that select by literal label; update them in the same commit (QA-067).
- `git commit -m` with PowerShell here-strings or backticked prose gets corrupted or runs substitutions; use `-F` (ENV-011).
- Locale JSON with fixed line endings: write with the index endings, check with `git ls-files --eol` (ENV-015).
- A DTO may hide fields per role on purpose; check through an allowed role before calling it a bug (QA-048).
- Fix the root cause of a UI symptom, not the visible effect (QA-046).
- A production bugfix mixed with a copy or UI rewrite cannot be reverted on its own (DEL-018).
