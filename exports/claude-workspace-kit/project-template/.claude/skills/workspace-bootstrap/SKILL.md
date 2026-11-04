---
name: workspace-bootstrap
description: Use this skill when starting a new project or adopting this workspace kit on an existing repo, i.e. when installing the kit, filling CLAUDE.md and AGENTS.md, the source-of-truth doc skeletons, the CHANGELOG, .claude settings and launch config, the memory index or the vault skeleton, or when running the design-first "Sprint 0" ("proiect nou", "porneste proiectul", "sprint 0", "seteaza workspace-ul", "bootstrap", "new project", "set up the workspace").
---

# Workspace bootstrap

Installs the working method into a repo, fills it from the owner's brief, then designs the product before any code exists. The kit carries the method only; every product fact comes from the new project's owner. Rule IDs point to the chapters the installer copies to `docs/workspace-rules/`: 01 working method (WM), 02 sources of truth (SOT), 03 delivery (DEL), 04 engineering (ENG), 07 product owner (PO), 08 memory and vault (MEM), 10 environment (ENV).

## When to use
- A new repo, or an existing repo adopting this kit for the first time.
- Recreating a missing CLAUDE.md, doc set, settings, launch config, memory index or vault skeleton.
- Running Sprint 0 (design only), or re-running it after the owner rejects the design.
- Not for later sprints (`sprint-delivery`), for recording an owner answer (`decision-gate`) or for writing module notes once code exists (`knowledge-vault`).

## Read first
- `docs/workspace-rules/`: 01 (WM-001..WM-008, WM-045), 02 (whole chapter, including its placeholder table), 03 (DEL-002..DEL-011), 08 (MEM-001..MEM-022), 10 (ENV-004..ENV-007, ENV-033), plus the "Adapting to a new project" section at the end of every chapter.
- The owner's brief, `<PRODUCT_BRIEF>` (vision, actors, rules, stack). Every domain fact comes from it or from the owner in this session, never from another project, memory or chat (SOT-012, WM-001).
- Existing repo only: `git status`, the README, the root manifests and any existing CLAUDE.md, AGENTS.md and `docs/`, read from the working tree, not HEAD (WM-024, MEM-028).

## Procedure

**A. Install**
1. From the kit folder, preview with `.\install.ps1 -Target <REPO> -WhatIf`, then run it without `-WhatIf`. `-Stack` adds the stack pack (stack skills, per-app CLAUDE.md files, `docs/STACK-RULES.md`), `-Optional` adds the optional skills, and `-UserLevel` writes the machine-wide user settings (ENV-001..ENV-003), only on a new machine and only when the user asks. The installer copies the rule chapters to `docs/workspace-rules/` (with `-Stack`, also `STACK-RULES.md` to `docs/STACK-RULES.md`) and creates AGENTS.md as a copy of the still-unfilled CLAUDE.md. It moves every existing file it replaces into `.claude/kit-backup-<timestamp>/`; merge the user's own content back into the new files by hand (WM-024).
2. Check the installed rules: `docs/workspace-rules/` holds chapters 01-10 and, with `-Stack`, `docs/STACK-RULES.md` holds the STK rules. CLAUDE.md, every skill and every subagent cite rules at these paths, so do not move or rename them, and do not copy rules by hand. The chapters' own placeholders (`<INVARIANTS_DOC>`, `<DECISIONS_LOG>`, ...) map to the installed docs through the placeholder table in chapter 02; edit that table only if your paths differ.
3. List the placeholders: search the installed files outside `docs/workspace-rules/` and `docs/STACK-RULES.md` for `<[A-Z][A-Z0-9_]*>`. Two groups are structure, not placeholders: the master-prompt tags in `docs/05` (`<ROLE>`, `<NON_NEGOTIABLE_CONTEXT_RULE>`, `<FIRST_ACTION>`, `<WORKING_MODE>`, `<OUTPUT_CONTRACT_FOR_CODE_TASKS>`, `<IMPLEMENTATION_ORDER>`) and the entry templates at the bottom of CHANGELOG.md. Fill the rest from the brief, starting with `<PRODUCT_OWNER>`, `<WORKING_LANGUAGE>`, `<LOCALES>`, `<BUSINESS_TZ>`, `<SHARED_PKG>`, `<INFRA_DIR>`, the commands and dev ports, `<MEMORY_DIR>`, `<VAULT_PATH>` and `<PROGRAM_DIR>`. Anything the brief does not give becomes `DECISION NEEDED` with options; never guess (WM-001, WM-002).
4. Existing repo: derive 01, 02 and 04 from the working tree and the existing docs. List every place where code and docs disagree as `DECISION NEEDED` instead of fixing either side (WM-013, SOT-013).

**B. Root CLAUDE.md and AGENTS.md**
5. Fill the installed CLAUDE.md in place and keep its sections in their order. It stays an index of pointers, precedence, mandatory behaviour, commands, conventions and the compaction list (SOT-034, WM-045); rule text and layer details belong in `docs/` and the per-app CLAUDE.md files (SOT-036). Write each command exactly as it runs in this repo. Delete the lines that point at things not installed: without `-Stack`, the `docs/STACK-RULES.md` (STK) pointer and the stack-pack skills line.
6. After filling the placeholders, re-copy CLAUDE.md byte for byte to AGENTS.md (for example `Copy-Item CLAUDE.md AGENTS.md -Force`): the installer created AGENTS.md from the unfilled template. Mirror each per-app CLAUDE.md to an AGENTS.md beside it the same way, and keep every pair identical in every later change. Confirm with `cmp CLAUDE.md AGENTS.md` (SOT-037).

**C. Doc set in `docs/`** (SOT-001)
7. Fill the installed skeletons. Each one already starts with the SOT-003 header comment: keep it unchanged, and delete the "Template" note and the italic guidance once a section is filled.
   - `01-vision-and-stack.md`: vision, actors, the end-to-end flow, in and out of scope, the `component | mock in MVP | later replacement` table (SOT-005) and the fixed stack. Keep the doc map current.
   - `02-technical-invariants.md`: write it first. Every section is a default carried over from the ENG, SEC and OPS rules: keep it, adapt it, or delete it when the product has no such concern, and log each adaptation or deletion as a `D-T-<n>` entry in 07. Sections are cited as INV-n.
   - `03-business-rules.md`: the owner's rules only. Every number comes from the owner or a decision ID, or is a settings key (WM-002). Start the glossary of required, banned and still-undecided terms (PO-032).
   - `04-data-model.md`: entities, tables, columns and enums, used verbatim everywhere (SOT-025). Adapt the "After a schema change, also update" checklist at the top to your stack (SOT-043).
   - `05-master-prompt-and-sprints.md`: fill the one-line product description, the critical flows and the domain sprints. Keep the tagged blocks (DEL-002), the sprint order (DEL-005) and the 11-part output contract (DEL-009).
   - `06-seed-scenarios.md`: named actors, counts and status distributions, before any seed script exists (SOT-009).
   - `07-decisions-log.md`: `D-<series>-<n>` entries with Decision / Rationale / Impact (SOT-019), opening with the stack and repo-layout decisions. Each rationale gives the reason, the rejected alternatives and the scale assumption (SOT-020). Keep its closing "Human checklist" section (PO-006, SOT-038).
   - `STATE_CONVENTIONS.md` and `ERROR_CODES.md`: leave them as installed; Sprint 0 fills them (SOT-007).
   - `08-deployment.md`: installed as a skeleton. Leave it until the first deploy approaches, then fill the current-state banner, environments, services and env-var names (OPS-102, `release-rollout`).

**D. Workspace files**
8. Narrow the installed `.claude/settings.local.json` (ENV-004, ENV-005). It ships with broad entries: remove whole-CLI wildcards (`PowerShell(pnpm *)`), file dumps (`PowerShell(Get-Content *)`) and the state-changing `docker exec` and `docker stop`, and fix the hard-coded ports and paths. Keep only the gate command families, for each shell in use: the shared build, typecheck, lint, per-package tests, `docker compose`, `docker ps`, curl health checks on the dev ports and `Skill(run)`. Add a `deny` list: the package manager's publish and remote-exec commands (for example `pnpm publish*`, `pnpm dlx*`), destructive schema commands (for example `prisma migrate reset`, `prisma db push`), `gh repo delete`, `gh auth token` and `Read(./**/.env)`.
9. Create `.claude/settings.json` with `permissions.deny` Read rules for dependencies, build output, coverage, the lockfile, generated clients, PDF and DOCX files, `<INFRA_DIR>/data` and `.env` (ENV-006). Adjust the `.claudeignore` globs to the repo layout; it is documentation only.
10. Edit `.claude/launch.json`: one configuration per dev server, with the real command and port (it installs with a backend entry on 3001 and a frontend entry on 3000). If a port is busy, add an alternate-port entry instead of killing the other project's server (ENV-033).
11. Keep the installed CHANGELOG.md as it is: the newest-first note and the two DEL-011 entry templates, with no entries until Sprint 0.
12. Create `<MEMORY_DIR>/MEMORY.md`: an index with one line per topic file (link plus a one-line hook with absolute dates, a status flag and the key gotcha); every topic file gets the MEM-002 frontmatter (MEM-001..MEM-003). Record where secrets live, never their values (MEM-030).
13. Create the vault at `<VAULT_PATH>` with the numbered folders `00 Map` to `60 Audits`, dropping zones the stack lacks (MEM-014). Add:
   - a map note with the value-chain diagram and an empty "Observations and limits" note (MEM-018, MEM-022);
   - the module-note template (Role, Key files, Exposes, Depends on, Used by, Tables touched, Events, "If you change this, check", Known pitfalls) and the frontmatter schema (`type`, `zone`, `updated`), as files (MEM-015, MEM-016);
   - one IMPACT playbook stub per risky change type, for example schema, endpoint, status enum, event, UI text, money flow, env and deploy (MEM-020).
   Module notes come once code exists (`knowledge-vault`).
14. Re-run the placeholder search from step 3. Every placeholder still unfilled is listed as `DECISION NEEDED`.

**E. Sprint 0: design only, no code** (DEL-003)
15. Run Sprint 0 as the `<FIRST_ACTION>` block in `docs/05` defines it, preferably in a fresh session whose first message is the master prompt with the doc set attached (DEL-002). Write the result to `docs/sprint-0-architecture.md`, using only the doc set:
   1. architecture: layering and directory structure;
   2. backend modules and their responsibilities;
   3. frontend areas and main routes;
   4. the full data model: every entity, its enums, relations with cardinality, and a conceptual ORM pseudo-schema;
   5. an endpoint map grouped by module;
   6. the critical flows, step by step, each citing the invariant it relies on;
   7. `STATE_CONVENTIONS.md` with 5 worked examples separating server state, UI state and form state (ENG-123);
   8. `ERROR_CODES.md`: one error envelope, codes per domain plus the general set (ENG-090..ENG-092);
   9. proposed initial values for the tunable business parameters and the final field list of the main input form, both marked for owner review (ENG-110);
   10. the technical choices left open (DEL-004), each with its reason, the rejected alternatives and the scale assumption (SOT-020);
   11. risks, and a `DECISION NEEDED` list with options and a recommendation.
16. Stop. Present the design for the owner's review (PO-006) and do not start Sprint 1.
17. Resolve every open item with the owner through `decision-gate`. Answers go into 07 and the affected docs in the same change (SOT-038, SOT-039). Sprint 1 starts only when zero items are open (SOT-004).
18. Propose the checkpoint commit: write the message to a file and give `git commit -F <file>`, after checking that the staged set is exactly the intended files. Do not run it unless the owner asks (WM-021, WM-022, ENV-011).

## Rules
- MUST NOT port business rules, names, numbers, decisions or terminology from another project, memory or chat; rules come only from this project's doc set (SOT-012).
- MUST NOT guess or invent entities, rules, fields, numbers or feature specs: mark `DECISION NEEDED` and stop the dependent work (WM-001..WM-003).
- MUST NOT write application code, schema files or migrations during Sprint 0 (DEL-003).
- MUST NOT overwrite or delete existing user files without a backup and a merge-back (WM-024).
- MUST state the precedence identically in CLAUDE.md, AGENTS.md and every doc header (SOT-003, SOT-011).
- MUST use names from `docs/04-data-model.md` verbatim; a new name needs owner confirmation, recorded in 04 in the same change (SOT-025, SOT-027).
- MUST NOT put secrets in CLAUDE.md, settings, memory or vault notes, and MUST NOT edit `.env` files (MEM-030, ENV-007).
- MUST NOT commit, push or deploy unless the owner asks in the current session (WM-021).

## Done checklist
- [ ] Kit installed (preview first); backed-up user content merged back in
- [ ] Rule chapters present in `docs/workspace-rules/` (and `docs/STACK-RULES.md` with `-Stack`), not moved or renamed
- [ ] Placeholders filled; every missing one listed as `DECISION NEEDED`
- [ ] Root CLAUDE.md filled and still an index; lines for uninstalled parts removed; AGENTS.md re-copied after filling, and every AGENTS.md mirror passes `cmp`
- [ ] Docs 01-07 filled with their headers intact; STATE_CONVENTIONS and ERROR_CODES left for Sprint 0; 08-deployment left for before the first deploy
- [ ] settings.local.json narrowed with a deny list; settings.json Read denies; `.claudeignore` and launch.json adjusted
- [ ] CHANGELOG template kept; memory index and vault skeleton created
- [ ] `docs/sprint-0-architecture.md` covers all 11 parts; no code written
- [ ] Owner reviewed Sprint 0; zero open `DECISION NEEDED` items; decisions logged in 07
- [ ] Checkpoint commit proposed, not run

## Pitfalls
- Claude Code does not read `.claudeignore`. Only `permissions.deny` Read rules exclude files, and even they do not stop `grep -r`, `cat` or scripts run through the shell (ENV-006).
- Deny rules match by prefix, so reordered variants (`pnpm -F <pkg> publish`, `docker compose -f <file> down -v`) slip past them; keep the allow list narrow (ENV-004).
- Approving one-off literal commands (PIDs, temp paths, test emails) fills the allowlist with entries that never match again (ENV-005).
- On Windows, `localhost` can resolve to `::1` and hang against Docker services. Use `127.0.0.1`, set as a process-level override rather than in `.env` (ENV-023, ENV-007).
- PostgreSQL cannot drop an enum value, so design enums carefully in Sprint 0 and mark unused values "reserved" (SOT-028).
- Moving, renaming or deleting `docs/workspace-rules/` leaves every rule ID cited in CLAUDE.md and the skills pointing nowhere.
- AGENTS.md starts as a copy of the unfilled template; if it is not re-copied after filling CLAUDE.md, other agents read placeholders.
- A Sprint 0 left only in chat is lost at compaction; write it into `docs/`.
- A vault outside the repo is invisible to subagents unless every preamble gives its absolute path (MEM-014, MEM-024).
