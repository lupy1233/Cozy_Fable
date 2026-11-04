---
name: knowledge-vault
description: Use this skill when you are about to modify code in a module (impact check), when declaring or closing a sprint or package, after a multi-sprint program or whenever the vault looks stale (full refresh), or when something worth keeping across sessions happens - a delivery, an owner decision or preference, an incident, a root-cause bug or a tooling gotcha ("read the vault", "update the vault", "citeste vault-ul", "actualizeaza vault-ul", "vault", "tine minte", "noteaza in memorie", "remember this"). Keeps the technical knowledge vault and Claude's auto-memory in sync with the code.
---

# Knowledge vault and memory

Two stores outlive the session: the technical knowledge vault at <VAULT_PATH> (map, module notes, concepts, IMPACT playbooks, audits) and Claude's memory at <MEMORY_DIR> (an index plus one topic per file). Read the vault before a change; update both after it. Neither store is a source of rules (SOT-012). Rule IDs point to the workspace rule chapters: 01 working method (WM), 02 sources of truth (SOT), 03 delivery (DEL), 07 product owner (PO), 08 memory and vault (MEM). `<PLACEHOLDERS>` take the values set in CLAUDE.md.

## When to use

- Impact check: before editing code in any module, and while writing a sprint's scope block (MEM-024, DEL-006).
- Update: when closing a sprint that changed architecture, flows, enums or dependencies (MEM-025, DEL-017).
- Full refresh: the vault is stale (MEM-027), or as the post-program step after a multi-sprint program (DEL-042 step 3).
- Memory entry: a delivery, decision, incident, root-cause bug, tooling gotcha or lasting owner preference worth keeping.
- An owner answer, new rule or descoped rule goes to the decisions log first (decision-gate skill), then to memory (PO-027, SOT-014); memory alone never makes it a rule (SOT-012).
- Not for the owner's personal notes vault; only its single project-status note may be touched (MEM-023).

## Read first

- `<VAULT_PATH>/00 Map/`: the map note (value chain, tight-coupling list) and "Observations and limits" (latest refresh date, what is still open).
- The affected notes in the module zones (`10 Backend modules`, `20 Frontend`, `30 Shared`, or the zones this vault uses, MEM-014), plus the matching `40 Concepts` and `50 Impact playbooks` notes. Read the `.md` files directly; the Obsidian app is not needed.
- `CHANGELOG.md` (top entries) and `git log`/`git status`: to decide whether the vault is stale and what changed.
- `<MEMORY_DIR>/MEMORY.md`: before writing any memory, to find the existing topic.
- `<INVARIANTS_DOC>` when a playbook step touches an invariant.

## Procedure

**A. Impact check (before a change)**

1. Staleness test: if the CHANGELOG or git log shows sprints that touched modules after the latest dated entry in "Observations and limits", run procedure C first (MEM-027).
2. Open the map note. Locate every touched module in the value chain (browser -> gateway -> guards -> services -> DB -> same-transaction side effects -> workers -> external services, MEM-018) and in the tight-coupling list (MEM-021).
3. For each module, read its note in full; at minimum "If you change this, check" and "Known pitfalls" (MEM-024).
4. Pick the IMPACT playbooks that match the change type (for example new endpoint, schema change, enum/status value, new event, UI text, env var/deploy, money flow) and their concept notes (MEM-019, MEM-020). Copy their numbered steps into the sprint's scope block or plan (DEL-006), and read the repo skill each playbook points to (DEL-007).
5. Navigate by file name. A cited line number is valid only on the date it was written (MEM-017).
6. When a note contradicts the working tree, trust the code, list the contradiction in the sprint's open items and fix the note in procedure B (WM-013). When a note contradicts the doc set, the docs win (SOT-012).
7. When delegating, put <VAULT_PATH> (on Windows in both native and POSIX form) and the names of the matching playbooks in every subagent's shared preamble (MEM-024, DEL-035).

**B. Update (after the sprint)**

8. From the diff (`git status` including untracked files, `git diff --stat`) and the sprint's CHANGELOG entry, list the touched modules, concepts and procedures (playbooks).
9. Inside a multi-sprint automated program: list the notes in that sprint's CHANGELOG entry, add an unchecked acceptance item `refresh vault notes: <list>`, and refresh them all in the post-program step (MEM-025 b, DEL-042). Otherwise continue now.
10. In each affected note: bump frontmatter `updated: YYYY-MM-DD`, rewrite the first line `Updated <date>: <what changed>`, add a dated section titled with the package id, and refresh "If you change this, check" and "Known pitfalls" (MEM-016).
11. New module: create its note from the template: Role, Key files, Exposes, Depends on, Used by, Tables touched, Events, If you change this, check, Known pitfalls (MEM-015). Link it from the map and from its neighbours' "Depends on"/"Used by".
12. New coupling tighter than the import graph shows (cross-module file import, a guard reading another domain's tables, a sweep job re-arming other modules' deadlines): add it to the coupling list (MEM-021).
13. Append a dated line to "Observations and limits": source snapshot (working tree, not HEAD), what changed, and each statement labelled `verified-by-running`, `read-from-code` or `taken-from-docs` (MEM-022, MEM-028, WM-032).
14. Tell <PRODUCT_OWNER> which notes changed (MEM-025). If the project state changed (sprint delivered, decision made), update only <PERSONAL_VAULT_STATUS_NOTE> in their personal vault (MEM-023).

**C. Full refresh**

15. Partition every note into groups of related notes; diff the full note list against the assignment so no note is left out.
16. Run one read-only agent per group plus one map agent that rewrites the `00 Map` notes from their reports (MEM-027). Agents read the working tree, CHANGELOG.md and the implementation docs, never HEAD (MEM-028). Run them in the main tree: a worktree starts from HEAD and misses uncommitted work (DEL-037). Cap concurrency at <MAX_AGENTS>.
17. Each agent returns structured JSON: notes updated, notes created, open questions as `{note, question, evidence_path, suspected_defect}` (DEL-034).
18. Spot-check the code wherever reports contradict each other (MEM-027). Agents never fix code during a refresh.
19. Collect the open questions into one JSON file and add them to the triage backlog (MEM-027); verify each adversarially before it enters a plan (DEL-025 step 2, DEL-042 step 1).
20. Add an "Update <date>" section to "Observations and limits": the changes since the last refresh, the source snapshot, the "still open" list; mark older audit annexes historical (MEM-022).
21. Save the refresh script and the questions JSON in `<PROGRAM_DIR>/<program-id>/`, never only in the scratchpad (MEM-010). Write a memory entry for the refresh (procedure D).

**D. Memory entry**

22. Search MEMORY.md for the topic. If it exists, update in place with dated `UPDATE <date>:` lines; start a new file only for a new delivery round or program, linked to the previous one (MEM-003, MEM-029).
23. New file: one topic. Frontmatter: `name`, `description` (one line a future session can judge relevance from; for deliveries include the outcome and deploy status), `type` (`project` | `feedback` | `reference`) (MEM-002).
24. Body: the fact with absolute dates (YYYY-MM-DD). For delivery or program memories follow MEM-005: state and dates; commit hashes, test counts and deploy status with the deployment id, or `NOT DEPLOYED` with the reason; where results live; "What to know next time" (MEM-008); open items and what you are waiting on from the owner. Then **Why:**, **How to apply:** and `[[wiki-links]]` to related memories.
25. Record each root-cause bug as a "do not reintroduce" gotcha with a concrete check to run before deep-debugging similar code (MEM-011), and each tooling gotcha with the workaround that works, cross-linked to earlier gotchas with the same root cause (MEM-012). Record incidents right away: impact verified read-only plus the rule that prevents a repeat (MEM-009).
26. Superseded memory: mark it historical and link the replacement. Resolved item: mark it inline `[RESOLVED <date>]`, never delete it (MEM-004).
27. Add or refresh one MEMORY.md index line: link plus a one-line hook with the date, status flags (`LIVE` / `DEPLOYED` / `NOT DEPLOYED` / `UNCOMMITTED`), the commit hash and the key gotcha (MEM-001).
28. Infrastructure change: update the deploy memory together with <DEPLOYMENT_DOC> and <RUNBOOK>; link the doc's "do not rediscover" list instead of copying it (MEM-013).

## Rules

- MUST read the map, the affected module notes and the matching playbooks before editing code (MEM-024).
- MUST NOT rely on a stale vault; refresh it first (MEM-027).
- MUST build and refresh notes from the working tree, never HEAD, and record the source snapshot (MEM-028).
- MUST trust the code over a note and flag the note; MUST NOT edit code to match a note (WM-013).
- MUST NOT take a rule from memory or the vault; rules come only from the doc set (SOT-012).
- MUST NOT rewrite a note silently: frontmatter date, first-line summary and a dated section every time (MEM-016).
- MUST use absolute dates in notes and memory; never "yesterday" or "last week" (MEM-003).
- MUST label evidence by how it was established; test counts and production state copied from the CHANGELOG are `taken-from-docs`, not observations (MEM-022, WM-032).
- MUST NOT write passwords, tokens, keys or demo/test passwords into memory, the index or vault notes; name where they live instead (MEM-030).
- MUST NOT write technical notes into the owner's personal vault (MEM-023).
- MUST NOT leave refresh scripts, question lists or program outputs only in the session scratchpad; label any remaining scratchpad pointer "may be deleted" (MEM-010).
- MUST keep refresh agents read-only; defects they find go to triage, not into fixes (MEM-027).

## Done checklist

- [ ] Impact check done: module notes and playbooks read, playbook steps copied into the scope block
- [ ] Note/code contradictions listed as open items
- [ ] Every affected note: `updated` bumped, first line rewritten, dated section with package id, check and pitfall sections refreshed
- [ ] New modules have notes from the template; new couplings added to the map
- [ ] "Observations and limits" has a dated line with source snapshot and evidence labels
- [ ] Or (inside a program): `refresh vault notes: <list>` left unchecked in the acceptance checklist
- [ ] Owner told which notes changed
- [ ] Memory entry written or updated; index line has date, status flags, commit hash, key gotcha
- [ ] Owner decisions logged in the decisions log, not only in memory
- [ ] Root-cause bugs saved as "do not reintroduce" with a check
- [ ] No secrets in memory or vault; durable outputs in <PROGRAM_DIR>

## Pitfalls

- A vault left untouched while many sprints landed states wrong things with authority; it is worse than no vault (MEM-025, MEM-027).
- With sprints stacked uncommitted, HEAD lags far behind the code on disk, and a worktree starts from HEAD (MEM-028, DEL-037).
- Line numbers drift after the next edit; file names stay stable (MEM-017).
- An audit annex written before a fix sprint describes bugs that are already fixed; read it as historical (MEM-022).
- Couplings outside the import graph are the ones that break: file-level imports across modules, guards reading other domains' tables, one sweep job re-arming every module's deadlines (MEM-021).
- A vault outside the repo is invisible to subagents unless its absolute path is in their preamble (MEM-014, MEM-024).
- Duplicate memory files for the same topic split the history; update in place (MEM-003).
- Several environment traps share one root cause; without the cross-link the next session rediscovers it (MEM-012).
