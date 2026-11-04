---
name: po-feedback-round
description: Use this skill when the product owner sends a batch of feedback, bug reports, a review round, a voice-note transcript or a list of change requests to turn into work ("feedback", "runda noua", "am testat si", "modificari", "vreau sa schimbi"), asks for a large new feature that needs a multi-sprint proposal first, or when many content choices need the owner's input at once (worksheet).
---

# PO feedback round

The round runs in three phases. **INTAKE** turns the product owner's (PO) input into a numbered round doc with lettered sprints. **DELIVERY** runs each sprint through the sprint-delivery skill. **CLOSE** verifies the round, writes the acceptance list and the prod steps, and records memory. Rule IDs point to the workspace rule chapters: 01 working method (WM), 02 sources of truth (SOT), 03 delivery (DEL), 04 engineering (ENG), 05 quality gates (QA), 06 security (SEC), 07 product owner (PO), 08 memory and vault (MEM), 09 release (OPS).

## When to use
- The PO sends feedback, bugs, a test report or a change list, in chat, as a voice transcript or as call notes (PO-001).
- The PO asks for a large new feature: write a proposal doc first and build nothing yet (DEL-024, PO-005).
- Many items need PO content input at once (copy, order, keep/remove): generate a worksheet (PO-047).
- The PO asks for a redesign of a key page that is risky to change in place (PO-008).
- Not for a single isolated fix (use sprint-delivery directly), and not for read-only audits (audit-to-plan skill; DEL-027).

## Read first
- `docs/02-technical-invariants.md`, always; `docs/03-business-rules.md` and `docs/04-data-model.md`, only the sections the items touch (WM-010).
- `docs/07-decisions-log.md` and earlier approved round docs: an approved decision in a round doc ranks as a log entry (SOT-050). Never reopen it.
- The previous round doc (`docs/NN-feedback-po-rN-sprints.md`) and its STATUS banner, the top of `CHANGELOG.md`, `<MEMORY_DIR>/MEMORY.md` and the previous round's memory, to see what is pending.
- `<PO_REVIEW_DOC>` (open decisions and ideas) and `<GLOSSARY>` (required and banned terms, PO-032).
- The knowledge vault map, the affected module notes and the matching IMPACT playbook (knowledge-vault skill, MEM-024).
- The versioned-definitions registry in `<SHARED_PKG>`, when a persisted form, flow or content schema is touched (ENG-096).

## Procedure

### A. Intake (doc before code)
1. Create `docs/NN-feedback-po-rN-sprints.md` with the next free number. The header gives the date, the source (chat, voice transcript, call, screenshots) and the predecessor docs (PO-001).
2. Restate every request as a numbered list, verbatim or as a close summary, before any planning. Split compound requests so that each number is one testable change.
3. Ground each item in the code (WM-013):
   - find the root cause of each bug before planning its fix (QA-046);
   - before calling a missing value a bug, check it through a role allowed to see it, since DTOs mask fields per role on purpose (QA-048);
   - check whether an existing endpoint or DTO already serves a UI item, and aim for a frontend-only change (WM-015);
   - list every place where the code differs from what the PO assumes.
4. Group the items into lettered sprints `<X>1..<X>n`, using the next unused letter, ordered by dependency: shared contracts and backend before UI. Each sprint cites its item numbers (PO-002). Plan a production bugfix so it ships in its own commit, apart from copy or UI rewrites (DEL-018).
5. Give each sprint a scope line (DEL-006) with the negatives stated ("no table touched", "no new endpoints", "no invariant changes") and, for each versioned definition it touches, "in place" or "new version vN" (ENG-096).
6. Write "Declared assumptions" as a numbered list in the `assumption: <statement>; confirm by <method>` form (WM-005). Mark each choice the PO delegated ("PO delegated: <their words>") with the option chosen, the reason, whether it blocks anything, a "(reversible)" label and the alternative with what it would cause (PO-021, PO-023). If a delegated request, taken literally, would break a core capability, ship the safer option with a numbered argument the PO can reopen (PO-022).
7. Route every gap through the decision-gate skill. Keep one table per round, grouped by theme: `D-<series>-<n>` ID, question, recommendation with its reason, safe default shipped (PO-014, WM-006). Label each name you invent "proposed, awaiting PO OK" and put it behind an i18n key (PO-024). Write each undecided business side effect as an open business note that states the consequence (PO-020).

### B. Intake variants
8. **Worksheet** (PO-047): generate it with a script from the current source of truth, never by hand. It holds:
   - a how-to header: a blank field means unchanged;
   - for each item, its current value plus blank fields for new order, new text and keep/remove;
   - the stable technical IDs, shown as references the PO does not edit;
   - a "new items" block and a "general observations" block per group;
   - the date it was generated.

   When the PO returns it, convert the answers into a round doc keyed by those IDs. Route each ambiguous answer through decision-gate.
9. **Proposal for a large feature** (DEL-024), sections in this order:
   - a banner: "nothing here is implemented; sprints start only with PO agreement, in the listed order" (PO-005);
   - an opening line with the decision you need;
   - how the reference product works, if there is one;
   - an architecture aligned with the existing stack;
   - sprints, each with its own acceptance criterion, measurable for interactive or visual work (QA-088);
   - DECISIONS NEEDED before sprint 1;
   - risks and known limits;
   - what the feature does not promise, with extras moved into an optional "after feedback" sprint.

   Stop until the PO approves.
10. **Risky redesign** (PO-008): build it on a parallel preview route (`/<page>-v2`) that is `noindex` and linked from nowhere, and let the PO test it. Promote it only after the PO approves: move the content to the canonical route, add a 307 redirect from the preview route, and list the components left unused.

### C. Delivery
11. Run each sprint through the sprint-delivery skill and propose one checkpoint commit per sprint (WM-022). For the CHANGELOG, use the feedback-round entry type instead of the plan-sprint template: one entry at the top for the whole round, headed `Sprints <X>1–<X>n — <date> — PO feedback round <k> (docs/NN): <summary>`, one bullet per delivered item, then `### Acceptance checklist <X>1–<X>n`. Extend it as each sprint closes (DEL-011, DEL-019).
12. Prefer additive, optional fields, so old data validates with no migration and no version bump (ENG-098, OPS-033).
13. Evolve persisted definitions safely (ENG-096, ENG-097, ENG-099, ENG-100):
    - **Presentational changes** (order, grouping, illustrations, copy): edit in place, keeping the field IDs.
    - **Breaking changes** (a removed step, a new required field): create a new frozen version, register it and bump the current-version constant. Old records keep validating and rendering with their own version.
    - **A moved input**: keep the old step hidden and optional, and derive the value from the new location with the legacy answer as fallback.
    - **Retired enum values**: keep them in the enum and add a normalizer that maps old shapes on read.
14. Enforce each new constraint in three places, each unit-tested (ENG-105):
    - a shared normalizer that silently corrects stored, legacy or client state;
    - a shared validation schema that checks the fully resolved values at the API boundary (e.g. Zod `superRefine`);
    - UI gating that hides impossible options and caps inputs live, in every input mode.

    The server re-applies the constraint on create and on edit, before format validation (ENG-107).
15. Apply `<GLOSSARY>` to every new string in every locale (PO-032). Handle out-of-scope bugs with WM-036.

### D. Close
16. Add a "Verification" section before the owner items (QA-078):
    - gate exit codes, plus suite and test counts per package (shared, backend, frontend);
    - the production build result;
    - one end-to-end run per changed flow, driven through the API with a test account, with what was observed;
    - visibility checks: another tenant gets 404, a wrong role gets 403, and role-masked fields stay masked (SEC-003, SEC-031, SEC-032).

    Mark as `UNVERIFIED` anything the tools could not check, with the reason (WM-031). Leave real-phone QA to the PO as a named item that lists the exact screens and interactions to check (PO-048).
17. Write the acceptance checklist as user-observable steps (where to click, what must appear), one line per item, left unticked for the PO, plus a manual test plan with concrete inputs, steps and expected results (DEL-014).
18. Write "Prod steps (after owner agreement)" as numbered steps in execution order, and run none of them (OPS-001, OPS-003, WM-021):
    - new env vars and secrets, set on every deployment slot first (OPS-026);
    - the deploy, or the explicit migration step;
    - seeds and data scripts last, only once that release's migrations are applied (OPS-040).
19. Set the round doc banner to `NOT DEPLOYED — awaiting PO OK` until the PO has tested (PO-009). After the work ships, add a dated STATUS banner listing what was approved, delivered and extended, and what is still pending (PO-004).
20. Collect your improvement ideas as numbered rows in the round doc and `<PO_REVIEW_DOC>`, each with a decision ID and needing its own explicit OK, kept apart from the technical notes. Implement none of them before approval (PO-005, PO-017).
21. Record the PO's answers with decision-gate RECORD (PO-027), and log every rejected direction with what failed and what was accepted instead (PO-030).
22. Write the round's memory entry, a new file linked to the previous round's memory (MEM-005, MEM-029):
    - the dates and commits;
    - the test counts;
    - the deploy status;
    - what was delivered, per sprint, and where the results live (MEM-010);
    - the root-cause bugs not to reintroduce, each with a check (MEM-011);
    - "What to know next time" (MEM-008);
    - what you are waiting on from the PO.

    Add or update its index line with a status flag (MEM-001).

### Round doc skeleton
```markdown
# PO feedback round <k> — <YYYY-MM-DD> (sprints <X>1–<X>n)
> STATUS: NOT DEPLOYED — awaiting PO OK
Source: <chat | voice transcript | call notes>. Follows: docs/<NN-1>-..., docs/<NN-2>-...
## PO requests (verbatim / close summary)   1. ... 2. ...
## Declared assumptions                     (PO delegated: yes/no · blocks: yes/no · reversible)
## Sprints
### <X>1 — <title> (items 1, 4)
Scope: modules · DB: no table touched | <migration> · Endpoints · Definitions: in place | vN · Invariants
## DECISION NEEDED                          | ID | question | recommendation | safe default |
## Verification · Manual test plan · Acceptance checklist (PO)
## Prod steps (after owner agreement)
## Improvement ideas (each needs your explicit OK)
## Technical notes (no approval needed, for your information)
```

## Rules
- MUST write the round doc, with the numbered requests, before any code (PO-001).
- MUST NOT invent business numbers, entities or feature specs to fill gaps (WM-001, WM-003). Use decision-gate.
- MUST NOT implement a proposal, plan or idea that the PO has not explicitly approved (PO-005).
- MUST NOT edit a frozen definition version in a breaking way, or change a stable field ID (ENG-096, ENG-097).
- MUST enforce a new constraint in the normalizer, the schema and the UI, never in the UI alone (ENG-105).
- MUST NOT mix a production bugfix with a copy or UI rewrite in one commit (DEL-018).
- MUST NOT deploy, run prod steps, commit or push unless the PO asks in the current session (WM-021, OPS-001).
- MUST NOT write passwords, tokens or test credentials into the round doc, the CHANGELOG or memory (MEM-030).
- MUST keep PO-approval items and "for your information" technical notes in separate sections (PO-017).

## Done checklist
- [ ] Round doc: date, source, predecessors and numbered requests; every item is mapped to a sprint or explicitly deferred.
- [ ] Each sprint has a scope line, including the negatives; assumptions declared and delegated ones marked.
- [ ] Open questions are in one table with recommendations and safe defaults.
- [ ] One checkpoint commit proposed per sprint; one feedback-round CHANGELOG entry with a bullet per item and the acceptance checklist.
- [ ] Definition changes are classified in place or new version; each new constraint is enforced in 3 tested places.
- [ ] Verification: gate counts per package, production build, e2e API runs, cross-tenant/role checks, UNVERIFIED items.
- [ ] Acceptance checklist is user-observable and unticked; prod steps are in order and none were run.
- [ ] Banner reads `NOT DEPLOYED — awaiting PO OK`; ideas are listed, numbered and not implemented.
- [ ] Memory entry and index line written; root-cause gotchas saved; vault notes refreshed or listed (MEM-025).

## Pitfalls
- If you plan straight from the chat message without restating it, items get lost or merged, and the acceptance list cannot be traced back to a request (PO-001).
- Removing a step or adding a required field in place breaks validation and rendering of old records and saved drafts (ENG-096).
- A UI-only limit is bypassed through the API, and a server-only limit leaves users stuck in an invalid state (ENG-105).
- Hand-written worksheets drift from the real definitions. If the PO edits a technical ID, the answer can no longer be mapped. Generate the sheet and lock the IDs (PO-047).
- Deploying a feature before the secret it needs is set makes it silently degrade; running a seed before its migrations are applied makes the seed fail (OPS-026, OPS-040).
- Deploying each polish round separately while the PO is still testing creates churn. Batch the tested rounds into one deploy (PO-009).
- Executed worksheets and delivered round docs left in `docs/` mislead later agents. Archive them with the PO's OK (SOT-048).
