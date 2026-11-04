# Working method

How Claude behaves on every task in this workspace: when to stop and ask, how to spend context, how to run large pieces of work, how to treat git and the working tree, and how to report results honestly.
The kit installer copies this chapter, together with chapters 02-10 (cross-references point there), into the target repo at `docs/workspace-rules/`; then fill in the `<PLACEHOLDERS>` (doc paths, decision owner, working language, settings store) listed in the last section.

## Never guess: the DECISION NEEDED gate

- **WM-001** `MUST NOT` Never guess or invent features, entities, business rules or fields. When critical information is missing, write `DECISION NEEDED`, describe the options, and stop the work that depends on it until <PRODUCT_OWNER> answers. Independent work continues (WM-007); where a default exists that does not set business policy, apply WM-006 instead of stopping. — _why:_ Invented domain facts silently diverge from the owner's intent and cost weeks of refactoring to unwind.
- **WM-002** `MUST NOT` Never invent prices, durations, refund policies, limits or other business numbers that are not already written in <BUSINESS_RULES_DOC> or <DECISIONS_LOG>. The only exception is the conservative placeholder value of a <SETTINGS_STORE> key shipped under WM-006, which carries a `DECISION NEEDED` comment next to it.
- **WM-003** `MUST NOT` Do not invent the specification of a feature the owner has only named. First confirm it does not already exist in the repo or docs, then ask the owner for the definition or explicitly validate your assumption with them. — _why:_ A feature known only by name has no spec Claude can derive; guessing produces work the owner will reject.
- **WM-004** `MUST` When a business rule appears to conflict with a technical invariant in <INVARIANTS_DOC>, stop and ask for clarification. Never resolve the conflict yourself.
- **WM-005** `MUST` Declare every unverified assumption as `assumption: <statement>; confirm by <method>`: in the sprint's "Declared assumptions" list before implementing, in analyses, and as a comment next to any constant whose value the docs do not specify. If an assumption would change the product or a technical invariant, stop and get explicit confirmation before continuing.
- **WM-006** `MUST` When a task hits an undecided product question, first search <BUSINESS_RULES_DOC> and <DECISIONS_LOG> and follow them if they already decide it. Otherwise ship the safest default that does not lock in a business policy (current behaviour, a <SETTINGS_STORE> key with a conservative value, a feature flag left OFF, or fixing the bug while leaving the rule untouched), make it reversible in one line or one admin setting, and record the exact question under `DECISION NEEDED` with the concrete options. Put `DECISION NEEDED` and the item ID in a code comment next to the default; risky automatic state transitions stay behind an admin setting that is OFF until the owner turns it on. — _why:_ Work keeps moving without the AI silently setting product policy, and the owner later triages one list of questions that each already has a safe, flippable default in code.
- **WM-007** `MUST` A genuine source-of-truth conflict pauses only the implementation that depends on it; independent work continues. — _why:_ One open question should not stall a whole program.
- **WM-008** `MUST` Mark operational actions that depend on an undecided product choice (final domain, email/SMS provider, alert recipient, removing the public platform domain from an internal or standby deployment slot, data-retention changes) as `DECISION NEEDED` and do not execute them until the owner explicitly says yes. Document the exact steps as numbered owner steps in <DEPLOYMENT_DOC> (PO-050, OPS-003).

## Context discipline and research

- **WM-010** `MUST` Read <INVARIANTS_DOC> on every change, plus only the business-rules, data-model and decision sections the task touches; never load the whole doc set (SOT-030). — _why:_ Keeps context focused on what the task actually touches, while the invariants apply to every change.
- **WM-011** `AVOID` Loading large files whole without a reason; read the specific range or section you need.
- **WM-012** `SHOULD` Delegate codebase research (finding usages, mapping modules) to subagents and keep the main context for decisions and edits.
- **WM-013** `MUST` Base strategy and business analyses on the actual code and the project knowledge base, not only on docs, and list explicitly every place where implemented behaviour differs from what the docs or the owner assume. — _why:_ Grounding runs have found rules computed differently in code than everyone believed, and documented rules that were never implemented.
- **WM-014** `MUST` Treat earlier audit results, test counts and advisory numbers as dated baseline evidence: revalidate the key findings before acting on them and record corrections explicitly. When an audit or plan already exists, resume its items instead of re-auditing. — _why:_ Old findings drift (some were wrong or already fixed), and re-auditing wastes work that was already verified.
- **WM-015** `SHOULD` Before writing new backend code for a UI feature, check whether an existing endpoint or DTO already returns the data, and aim for a frontend-only change when it does.

## Planning and large tasks

- **WM-017** `SHOULD` When a change is large, propose the structure (modules, files, schema, flow) and get it reviewed before writing code.
- **WM-018** `SHOULD` Bound open-ended investigation with 30-60 minute checkpoints. Size tasks S/M/L as relative effort, not elapsed-time promises; re-estimate after the baseline and keep about 25% for integration and debugging. — _why:_ Avoids unbounded research and false schedule promises.
- **WM-019** `SHOULD` Run high-stakes decision analyses (pricing, strategy) as a multi-agent workflow: parallel research agents, several independent proposals, judge agents, adversarial verifiers and a finalizer, with the full result saved as JSON. If the owner changes the scope, rerun it as a new numbered round and update the same published page (same URL, retitled) instead of creating a new one. — _why:_ Independent proposals plus adversarial checks expose outlier conclusions that a single pass would ship.

## Working tree, git and outward actions

- **WM-021** `MUST NOT` Never run `git commit`, `push`, `stash`, `checkout` or `reset`, deploy, or publish anything unless <PRODUCT_OWNER> explicitly asks for it in the current session. A commit authorization may cover the current execution phase; every deploy, push to a shared remote, or publication needs its own approval (OPS-001). Propose the exact commit message or command instead. A planning or "help me think about it" request never implies an outward action. — _why:_ The working tree may hold uncommitted product work, and outward actions are separate decisions of the owner.
- **WM-022** `MUST` Close every sprint by proposing its checkpoint commit(s), with the message and exact command, split per DEL-018 when the sprint mixes unrelated changes, and only after reviewing that the staged set is exactly the intended files (DEL-043). Never let delivered work pile up uncommitted: an uncommitted fix counts as not delivered, and after a long program the next proposed step is a checkpoint commit. Running the commit follows WM-021. — _why:_ One checkpoint per sprint keeps work recoverable and reviewable; uncommitted fixes are invisible to audits, reviewers and deploys.
- **WM-024** `MUST NOT` Never delete or rewrite files you did not need to touch, and preserve unrelated uncommitted user work. Before editing a file that earlier sprints touched, read its current working-tree state instead of assuming the HEAD version. — _why:_ Many sprints can be stacked uncommitted in one tree, so HEAD is stale.
- **WM-027** `MUST` Treat the local stack as shared with parallel sessions: do not run live checks that lock shared test accounts or write into a build-output directory a running dev server uses (ENV-034). Undo your changes with targeted reverts of exactly the rows and settings you changed, never by restoring a whole-database backup (ENV-022), and list leftover test state under "Remaining".

## Verification and faithful reporting

- **WM-028** `MUST` Verification is done by a separate agent or an adversarial review, never by the implementer (DEL-033). Fix every confirmed finding inside the change's scope before closing and record it as "fix at verification"; confirmed pre-existing issues outside the scope follow WM-036. An adversarial review is mandatory for complex interactive state: native/overlay sync, gestures, keyboard and modal interplay, scroll locks. — _why:_ Independent reviews keep finding real bugs that the implementation pass missed.
- **WM-029** `MUST` Judge every subagent deliverable against the actual diff and test output, never against its completion report alone. Finish every step of a brief, or list each unfinished item with its precise reason. — _why:_ Agents over-report success; unfinished items must stay visible rather than being silently declared complete.
- **WM-031** `MUST` Report anything you could not verify (a visual check the tool cannot perform such as canvas/WebGL rendering, scroll-driven animation or screenshots in an embedded preview; a flow you could not reach; a script the local shell cannot syntax-check) explicitly as `UNVERIFIED`, with the reason, who has to check it, and what covers it instead (unit tests, reuse of already-validated logic). Never present an unexercised path as verified. — _why:_ Some checks cannot run in the embedded browser and must be left to a manual walkthrough.
- **WM-032** `MUST` Label every piece of evidence with how it was established (observed by running, read from code, or taken from docs/changelog), when, and in which environment. Say explicitly when nothing was run. Never accept repository config as evidence of live state. When the environment degrades, mark earlier passing results as historical, and never report a surviving partial view (e.g. a guest-only page that still loads) as full app health; see QA-076 for what each kind of evidence covers. — _why:_ Test counts and production state copied from docs are not direct observation.
- **WM-035** `AVOID` Refactoring based on theory during verification; record measured problems as targeted follow-ups. — _why:_ Keeps verification passes from changing scope.
- **WM-036** `SHOULD` Report every bug found outside the planned scope (during verification or by newly added tests) in a separate "pre-existing, found while <activity>" note with its root cause and fix. Fix it in place when it is small; if it is larger, pin the current behaviour in a test and propose a separate work package.

## Code comments

- **WM-043** `SHOULD` Give non-obvious code a short comment explaining why, citing the decision, audit or feedback ID with its date (SOT-049), written in <WORKING_LANGUAGE> (STK-008). — _why:_ Future sessions can trace a constraint back to its decision without guessing.

## Compaction and handoff

- **WM-045** `MUST` On context compaction (and in every DEL-042 handoff) always retain: the current sprint/phase and active task IDs; completed tasks with their evidence; the list of files you modified, kept separate from user-owned unrelated changes; agent ownership and file locks; decision states, including every open `DECISION NEEDED` item; pending checks; and the next runnable task. — _why:_ These are what is needed to resume work correctly after compaction.
- **WM-046** `MUST` When an environment problem blocks you (disk full, Docker or backend down), stop and write a handoff covering the current state, what is still unverified, the exact action the user must take, and what must not be done in the meantime. Write it as HANDOFF.md in the DEL-042 format, adding two sections: "Exact user action required" and "Must not be done meanwhile".

## Adapting to a new project

- Fill in the source-of-truth paths (<INVARIANTS_DOC>, <BUSINESS_RULES_DOC>, <DECISIONS_LOG>) and adopt the fixed precedence of SOT-011, so WM-004 and WM-006 have something concrete to search and cite.
- Name <PRODUCT_OWNER>: the one person whose explicit "yes" closes a `DECISION NEEDED` item and authorizes commits, deploys and publication (WM-008, WM-021).
- Point <DEPLOYMENT_DOC> at the runbook where owner-only operational steps are written as numbered steps (WM-008, PO-050).
- Choose the fixed marker strings (`DECISION NEEDED`, `UNVERIFIED`, "Remaining", "fix at verification", "pre-existing, found while"), translated if the team works in another language, and use them verbatim everywhere so open items stay greppable.
- Define <SETTINGS_STORE> and the feature-flag mechanism used for safe, reversible defaults (WM-002, WM-006).
- Decide the unit of work (sprint, package), where the CHANGELOG and acceptance checklist live, and the checkpoint-commit convention (WM-022).
- Set <WORKING_LANGUAGE> (shared with STK-008) and the decision-ID scheme that code comments cite (WM-043).
- List the shared local resources that live checks must not disturb (test accounts, dev-server build output, seeded data) (WM-027); durable workflow outputs and scripts go to <PROGRAM_DIR> (MEM-010).
- Copy the compaction list (WM-045) into the new project's CLAUDE.md so it survives every compaction.
