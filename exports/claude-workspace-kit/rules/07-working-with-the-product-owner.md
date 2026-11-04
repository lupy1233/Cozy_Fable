# Working with the product owner

This chapter covers how Claude works with the product owner (PO). It turns feedback into sprint docs, gets approvals before building, decides what to ask and what to decide alone, records decisions, keeps terminology and copy consistent, and presents work.
Reuse the decide-or-ask boundaries as written. Fill in the `<PLACEHOLDERS>` (doc paths, locales, glossary, the PO's preferred report format) once for the new project.

## Feedback rounds become sprint docs

- **PO-001** `MUST` Turn every PO feedback round into a new numbered doc under `docs/`, for example `docs/NN-feedback-po-rN-sprints.md`. This applies whether the feedback arrived as a chat message, verbally or as a voice transcript. The doc opens with the date, the source of the feedback and the docs that came before it. It then restates the PO's requests as a numbered list, verbatim or as a close summary, before any planning starts. — _why:_ This keeps a traceable record of exactly what the PO asked, so each sprint maps back to a request.
- **PO-002** `MUST` Implement the items as sprints with stable lettered ids (for example `R1`, `S3`), each citing the request numbers it covers. Deliver every item in the round, and log each sprint in CHANGELOG (DEL-011, feedback-round entry type). Commits, decisions and memory notes reference the doc and its sections.
- **PO-003** `SHOULD` When the PO asks for critique cycles on design work, run numbered self-critique rounds (r1, r2, ...) before presenting. Each round lists the objections found and what changed, and you stop only when no structural objection remains. Record the rounds in the CHANGELOG entry.
- **PO-004** `MUST` Once the PO approves and the work ships, add a dated UPDATE/STATUS banner at the top of the plan doc. It records:
  - what was approved;
  - which sprints are delivered, with a pointer to `CHANGELOG.md`;
  - any extension beyond the plan, and why;
  - what remains pending, and with whom.

  — _why:_ The plan doc stays the one place where the PO sees both the plan and its outcome.

## Approvals before implementation

- **PO-005** `MUST NOT` Implement anything from a plan, a proposal or a list of improvement ideas before the PO explicitly approves it. Start every plan or proposal doc with a banner saying nothing in it is implemented yet and that sprints start only with the PO's agreement, in the listed order. Give each unapproved idea a decision ID (PO-014) and collect it, together with every other open question from the round, in a single PO review doc, `<PO_REVIEW_DOC>`.
- **PO-006** `MUST` Before any code is written, ask the PO to read the doc set once and to change, in the docs, any decision they dislike. After Sprint 0 (DEL-003), ask them to review the schema, the state conventions, the error-code catalog, the seed of the core business parameters (for example scoring or pricing configuration) and the fields of the main intake form, and to correct them in the docs then, not several sprints later. — _why:_ A correction at Sprint 0 is a doc edit; after several sprints it is a migration and a refactor.
- **PO-007** `MUST` Present a large plan or audit on an interactive approval page, `<APPROVAL_PAGE>`, where the PO approves and annotates each package and finding. Approvals and notes persist in the page's shared database collection, never in `localStorage`. Read them before implementing (DEL-031), and mark items delivered afterwards (DEL-017). — _why:_ The approvals page is the source of truth for scope.
- **PO-008** `SHOULD` Ship a redesign of a key page first as a parallel preview route that is `noindex` and not linked from anywhere, and let the PO test it before deploy. Once the PO approves, move the content to the canonical route, add a 307 redirect from the preview route, and list the components that are left unused.
- **PO-009** `SHOULD` Mark work that is finished but not deployed as "NOT DEPLOYED — awaiting PO OK". After the PO has tested related polish rounds, ship them together in a single deploy.
- **PO-010** `MUST` Get the PO's explicit agreement before loading real third-party data, such as a partner's content, into production.
- **PO-011** `MUST` Change legal pages, and any public page that explains business rules, only with the PO's agreement, plus legal review for material changes. When a business-rule outcome changes, update those pages in the same change. Their numbers come from the server as ICU arguments (ENG-110), never written into the copy.

## Asking vs deciding

Business parameters with no decided value, and behaviour waiting on a PO decision: ship the safe, flippable default described in WM-006 (code comment with `DECISION NEEDED` and the item ID; risky automatic state transitions behind an admin setting that stays OFF).

- **PO-012** `MUST` Before work starts, list the decisions the PO must make as "DECISION NEEDED" items in the plan. Some decisions always belong to the PO: destructive cleanup (for example dropping a column), risky automatic state transitions and changes to legal text.
- **PO-013** `SHOULD` Put risky timing and scope choices to the PO as questions that carry your recommendation, rather than deciding alone. Examples: whether to do a major framework upgrade before or after launch, adding CI, adding tests against a real database, archiving docs.
- **PO-014** `MUST` Put open decisions in a table. Each row has a stable ID in the decision-ID scheme of SOT-019 (`D-<series>-<n>`), the question, and your concrete recommended answer with its reason. The PO then approves or adjusts each row instead of answering open-ended questions. Keep a single table per plan or round, grouped by theme, never scattered across findings (DEL-028 item 7). — _why:_ Concrete proposals make approval fast and leave a record of what was decided.
- **PO-016** `SHOULD` Give every decision or idea row an explicit status, one of:
  - delivered, with the sprint reference and how it was verified;
  - approved for after the MVP;
  - scheduled for the next deploy, with the exact operation;
  - waiting on an input from the PO, such as an API key;
  - left with the PO.
- **PO-017** `SHOULD` In docs written for the PO, keep "decisions and ideas that need your approval" in a separate section from "technical notes: no approval needed, for your information". — _why:_ The PO can see at a glance what actually needs an answer.
- **PO-020** `SHOULD` When an implementation has a business side effect the PO has not decided on, record it as an explicit open business note that states the consequence. Do not silently change behaviour.
- **PO-021** `MUST` When the PO explicitly delegates a choice ("if you think it's OK"), list it under "Declared assumptions" in the relevant section of the sprint doc. Note that the PO delegated it, whether it blocks anything, which option you chose, and why.
- **PO-022** `MUST` Sometimes a delegated request, taken literally, would break a core product capability. In that case implement the safer alternative and document a numbered argument: what the literal option would break, which risks the chosen option covers, and a note that the PO can reopen it as a separate discussion. — _why:_ Delegation is not a licence to diverge silently; the PO must be able to see the reasoning and challenge it.
- **PO-023** `SHOULD` When the PO wants fast iteration, pick sensible design defaults yourself and label them as your defaults. Label every judgment call "(reversible)" or "PO can adjust". Describe the alternative and what it would cause, and record any minor side effect of the option you chose. — _why:_ Iteration stays fast without hiding choices the PO may want to change.
- **PO-024** `MUST` Mark any user-facing name or label you invent as "proposed, awaiting PO OK" until the PO confirms it. Implement it as an i18n key so that renaming it later is cheap.
- **PO-025** `SHOULD` When the PO asks for your honest opinion on a design choice, give one clear recommendation, not a neutral list of options.
- **PO-026** `SHOULD` When the PO asks why something works the way it does, answer with the structural reason and point to the section of the decision doc. An example of a structural reason: a required choice that is mutually exclusive, as opposed to an optional flag that can be combined with others.

## Recording decisions

- **PO-027** `MUST` Record every PO answer, including answers given through AskUserQuestion, as a `<DECISIONS_LOG>` entry under SOT-019 and in memory. Include its date, a "PO" tag, the audit finding or dead end that triggered it, and the PO's own worked example when the decision is a formula. It is then final (SOT-016). — _why:_ These answers cannot be derived from the docs, so they are lost unless recorded.
- **PO-030** `SHOULD` Record every design direction and UI element the PO rejected, with what failed, why, and what was accepted instead. Never reintroduce them. — _why:_ Nothing in the code records a rejection, so a later session will re-propose the same direction unless the rejection and its reason are written down.
- **PO-031** `SHOULD` Run visual design passes with the `frontend-design` skill. Save the resulting visual language, in memory or in a design doc, so later extensions stay consistent with it.

## Terminology and copy

- **PO-032** `MUST` Terminology the PO mandates is a hard rule. Keep a glossary, `<GLOSSARY>`, of required and banned terms. Apply it to every new user-facing string in every locale, including emails, legal pages, page metadata and role badges, and use exactly one name per concept. New code comments use the glossary term too. When you rename a term, change the translation values but keep the i18n key names; existing internal identifiers, CSS names and old comments may keep the legacy term. — _why:_ Audits found two names for the same concept, and a banned legacy term in emails. Adding the rule late meant rewriting thousands of strings.
- **PO-033** `MUST` While the PO is still deciding whether to unify a term, it stays an open PO decision. Do not unify it on your own.
- **PO-034** `MUST` The PO's rules for tone (for example formal or informal address), quotation-mark style and diacritics (complete and correct, in each locale's orthography) are hard rules for every new string, emails included. Keep one consistent tone across the product. The ASCII-only rule (STK-008) applies to code comments, never to UI text.
- **PO-038** `MUST` Pros, cons and comparisons are concrete and honest, not marketing filler.
- **PO-039** `SHOULD` When a layout change moves a control, rewrite any hint copy that refers to its position, for example "the panel on the right" instead of "the bar below".

## Presenting work and status

- **PO-044** `SHOULD` Report program status as one scannable page in the PO's preferred format, `<PO_FORMAT_PREFERENCE>` (for example ADHD-friendly). It shows "try it" steps for each sprint, the open decisions each with its safe default, the remaining work, the ops items and the checkpoint commit command. Keep the approval page and status page links in the memory index (MEM-010).
- **PO-045** `SHOULD` Present plans action-first: the first line is the next action. When presenting the DEL-030 packages to the PO, give each one:
  - an imperative title (DEL-030's headline);
  - a "Do first" step that takes under 30 minutes;
  - 2-5 numbered steps;
  - 1-3 "Done when" checks the PO can verify;
  - a concrete estimate;
  - "Your call first" (DEL-030's decision_needed) when it needs a PO decision.
- **PO-046** `SHOULD` For business-strategy requests (pricing, go-to-market, pitch, MVP scope), use the installed founder commands (`/founder:*`) and format the result in `<PO_FORMAT_PREFERENCE>` (for an ADHD-friendly preference, use the `i-have-adhd` plugin from ENV-002: action first, numbered steps, at most 5 items, no preamble or recap).
- **PO-047** `SHOULD` When many items need PO input (copy, ordering, keep or remove), generate a fill-in worksheet automatically from the current source of truth. It contains:
  - each item's current value, with blank fields for a new order, new text and keep or remove;
  - a how-to header explaining that a blank field means "unchanged";
  - the stable technical IDs, shown as references the PO does not edit;
  - a "new items" block and a "general observations" block for each group;
  - the date it was generated.

  — _why:_ The PO edits only what they want to change, and every answer maps unambiguously to a technical ID.
- **PO-048** `SHOULD` Leave visual QA on a real phone with the PO, as a named checklist item that lists exactly which screens and interactions to check. — _why:_ Touch behaviour and real mobile rendering cannot be fully verified from the dev environment.

## Owner-only actions

- **PO-050** `SHOULD` Do not carry out owner-only actions yourself. Write them up in `<DEPLOYMENT_DOC>` or the runbook as numbered PO steps with exact commands. Owner-only actions include:
  - repository security settings (secret scanning, push protection, branch protection);
  - DNS and domain;
  - SMTP;
  - creating or rotating third-party API keys in provider dashboards (setting an already-issued secret on a service follows SEC-070 and OPS-026);
  - legal and company data;
  - monitors and provider dashboards.

  This is the PO-facing write-up of the owner items that DEL-011 (the "Remaining" part of a sprint entry) and WM-008 collect.

## UX defaults learned from feedback rounds

- **PO-054** `SHOULD` In editor screens with a live visual preview, when the user selects an element, show its edit panel next to the preview, so everything editable is visible without scrolling. On desktop the preview is sticky and the controls sit in a fixed-width rail beside it; on mobile they stack. When nothing is selected, the panel slot shows interaction guidance rather than empty space.
- **PO-056** `SHOULD` Give a related option on the same screen the same visual component as its sibling options, rather than a different widget. That means the same card and the same grid, with a checkbox indicator for multi-select.
- **PO-057** `MUST` When a row's type selector changes (for example from email to phone), clear the value field that depends on it. — _why:_ A value typed for one type must never carry over into a field of another type.
- **PO-058** `SHOULD` Show a value that must always be present as a locked row that is read-only and cannot be removed, with a short hint that explains why. Users can add further entries below it.
- **PO-059** `SHOULD` Users whose role cannot change a value see it as plain read-only text, not as an editable control.
- **PO-060** `SHOULD` After a primary action, take the user straight to the screen where they continue the work. Notifications link to the page where the item is actually handled.
- **PO-061** `SHOULD` On mobile, the list and detail parts of a master-detail screen become successive screens, and the cards most relevant to the user's next action come first.

## Adapting to a new project

- Set the paths for `<DECISIONS_LOG>`, `<PO_REVIEW_DOC>` and `<DEPLOYMENT_DOC>`. Choose a numbering scheme for feedback-round docs and sprint ids (for example `R1`, `S3`); decision ids follow the decision-ID scheme (SOT-019).
- Confirm the locales (`<LOCALES>`, shared with the stack pack) and write a short copy style guide: form of address, tone, quotation marks and diacritics rules.
- Start `<GLOSSARY>` with the PO on day one, with three lists: required terms, banned terms, and terms still under decision.
- Ask the PO for `<PO_FORMAT_PREFERENCE>`, and decide where `<APPROVAL_PAGE>` and the status page live.
- Agree with the PO on which actions are owner-only (security settings, DNS, monitors, keys, legal data) and who receives alerts.
- Treat the UX defaults section as a starting set of preferences, and confirm or drop each one in the first feedback round. Apply PO-054 only if the app has a visual editor.
