<!-- Source of truth: consolidated business rules. Precedence: technical invariants (02) > decisions log (07) > business rules (03). Don't guess: mark DECISION NEEDED and stop. -->

# 4. Consolidated business rules

*Every decision is INTEGRATED directly into the rules below. The rationale for each decision lives in `07-decisions-log.md`; this doc states the rule and cites the decision ID.*

> **Template.** The sections below are the rule areas most products need. Rename, reorder or delete them so the numbering matches your domain, then keep the numbers stable (code, changelog and checklists cite them as "§4.n"). Delete the italic guidance once a section is filled.

## How rules are written here

- One subsection per rule area, numbered `4.n`. Each rule is plain text (confirmed) or carries `MUST` / `NEVER` / `ALWAYS` (strict) or `DECISION NEEDED` (open gap — work that depends on it pauses).
- Every number (limit, duration, threshold, price) either comes from a decision ID or is a key in the settings store (INV-19). Never write a business number without its source (WM-002).
- Mark a confirmed rule as **CONFIRMED (<DECISION_ID>):** in bold at the start of the paragraph.
- When a later sprint changes a rule, append a dated line instead of silently rewriting history: `Update <YYYY-MM-DD> (<package or sprint ID>): <what changed>; replaces <old rule or decision ID>.` Copy the decision into `07-decisions-log.md` in the same change (SOT-039).
- Implementation notes that the code must honour (which endpoint enforces it, which error code it returns, whether anything is written on refusal) are allowed in one short line per rule.

## 4.1 <Primary entity>: creation and input

*What the user submits to create the main entity: required fields, optional fields, uploaded files, anonymous drafts (token-based, recoverable), alternative entry modes. The exact final field list is proposed in Sprint 0 and reviewed by <PRODUCT_OWNER>.*

## 4.2 Visibility of personal and contact data

*Who sees which personal data, in which state, and when access is revoked. State that checks happen in the API, not only by hiding UI. List any settings toggles that change the policy.*

## 4.3 Editing rules

*What can be edited in which state, edit limits (with their settings keys), and what an edit triggers (versioning, notifications, re-review).*

## 4.4 Expiry and re-publication

*How long the entity stays active, what happens at expiry, whether it can be re-published, and whether re-publication starts a new clock.*

## 4.5 Tunable scoring and parameters

*Any score, size class or computed tier: its inputs, the formula, the seed values (proposed in Sprint 0), and which settings keys tune it. The formula is computed server-side (INV-16) and lives as a pure function in `<SHARED_PKG>` (INV-18).*

## 4.6 Accounts, organizations and verification

*Sign-up paths, verification of organizations/tenants (documents, approval, rejection, re-application cool-down), risk flags.*

## 4.7 Teams and roles

*Member roles inside an organization and what each may do. Role names are used verbatim from `04-data-model.md`. Permissions are a frozen role → permission matrix in `<SHARED_PKG>` (INV-19).*

## 4.8 Core transaction rules

*The rule set of the product's central operation: eligibility, capacity caps, per-actor limits, exclusions, cost. Capacity-limited operations follow INV-1; critical POSTs follow INV-2.*

## 4.9 Assignment and internal workflow

*How work is assigned inside an organization (self-assign, manager assignment, caps), and the timers that apply.*

## 4.10 Plans and entitlements

*Plans, what each unlocks, trial rules, what happens at expiry or downgrade. Entitlements are data (INV-19).*

## 4.11 Deadlines and timers

*Every timer in the product, classified as wall-clock or business days (INV-3). A deadline is materialized in a column and re-armed by the reconciliation sweep (INV-15).*

| **Timer** | **Clock** (wall-clock / business days) | **Duration** (value or settings key) | **Starts when** | **Exit when it fires** | **Decision** |
| --- | --- | --- | --- | --- | --- |
| Inactive anonymous draft cleanup | wall-clock | settings key `<draft_retention_days>` | Last save of an anonymous draft | Draft is soft-deleted; its token stops working (ENG-078) | <DECISION_ID> |

## 4.12 Consequences and enforcement

*Strikes, holds, suspensions or other consequences: what triggers them, rolling windows (event rows with `expires_at`, never batch resets — ENG-041), thresholds (settings keys), and how they are lifted.*

## 4.13 State machines

*One table per main entity. Every non-terminal state has an exit users can see (INV-14). Coupled machines list the transitions they force on each other.*

| **State** | **Allowed next states** | **Who / what triggers it** | **Exit if nothing happens** | **Deadline column** | **Forces on coupled machines** |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## 4.14 Communication and files

*Messaging between parties, when it opens and closes, upload limits per entity (INV-4), read markers.*

## 4.15 Cancellation and withdrawal

*Who may cancel or withdraw, in which state, with which reasons, what needs admin review, and what each path settles (refund vs consume — one settlement path, INV-14).*

## 4.16 Payments and purchases

*What is bought, how payment is confirmed (provider webhook and/or admin confirmation, INV-7), what is granted on confirmation, and refunds.*

## 4.17 Invoicing

*Delete if the product issues no fiscal documents. Jurisdiction, required fields, series and numbering (INV-16), tax rate (settings key), language of the document.*

## 4.18 Reviews, disputes and moderation

*Who can review whom and when, how disputes are opened and decided, what each decision does to the review, and how moderation is audited.*

## 4.19 Admin

*Everything the admin area can do, which actions need a reason, which are audited (all critical ones, INV-9), and which settings are editable without a deploy.*

## 4.20 Language and i18n

*Supported locales (<LOCALES>), default locale, how a user's language is chosen and stored, which content is translated (UI, emails, documents), tone and address form (PO-034).*

## 4.21 Data protection and audit

*Retention, deletion and anonymization rules (INV-12), what users can export or delete, what the audit trail keeps (INV-9).*

## 4.22 Terminology glossary

*<PRODUCT_OWNER>-mandated terminology is a hard rule (PO-032): apply it to every new user-facing string in every locale — UI, emails, legal pages, page metadata, role badges — with exactly one name per concept. When a term is renamed, change translation values but keep i18n key names. A term the owner is still deciding stays an open decision (PO-033).*

| **Concept** | **Required term** (per locale) | **Banned terms** | **Since** (decision ID / date) |
| --- | --- | --- | --- |
| | | | |
