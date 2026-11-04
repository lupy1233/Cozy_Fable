# CHANGELOG

> **Template.** Newest entry at the TOP, directly under this note (DEL-011). Before any commit, the changelog covers every change in the working tree (DEL-010). Use one of the two entry types defined in "Entry templates" at the bottom of this file, cite invariants, rules and decisions by ID (INV-n, §4.n, D-…; SOT-049), and say explicitly when the decisions log was left untouched. A sprint with several packages gets one closure entry at the top that points to the per-package entries below it (DEL-013). Delete this note once the first real entry exists.

_No entries yet — the first entry is Sprint 0._

---

## Entry templates (keep at the bottom)

### Plan-sprint entry

```markdown
## Sprint <N> (plan <YYYY-MM-DD>): <title> (<priority>) — <YYYY-MM-DD>
- **Objective**: <one paragraph: the package/finding IDs implemented and the user-visible outcome>.
- **Impact**:
  - DB: migration `<timestamp>_<name>` (<strictly additive / expand / data-only / destructive>): <what>. Rollback: <described in the migration SQL>.
  - Backend: <endpoints added or changed, guards, jobs>.
  - Shared: <constants, schemas, types>.
  - Frontend: <pages, components, hooks>. Fixes made at verification: <...>.
  - i18n: +<n> keys, −<m> dead keys; parity <x>/<x> across <LOCALES>.
  - Realtime: <events added / none>.
  - Deploy compatibility: <old image vs new schema; new bundle vs old API; accepted losses>.
  - Business rules: <unchanged / §4.n updated>. Decisions log: <untouched / D-… appended>.
- **Files**: <main paths; full list in the implementation report entry below when there is one>.
- **Security close** (security checklist over the sprint diff, re-run at closure) — each item PASS / FAIL / N/A with its evidence and scope:
  - Authz on new endpoints (guards, ownership → 404 for another tenant's resource, role → 403).
  - Input validation (DTO limits, shared Zod schema, DB constraint).
  - Idempotency / audit on critical mutations.
  - PII and secrets in logs, storage and seeds.
  - Invariants touched (INV-n) and how they hold.
  - Soft delete on new reads.
  - Cookies / CORS / headers.
  - i18n parity and terminology glossary (§4.22).
  - Security patches needed at closure: <none / list>.
- **Closure measurements**: `<shared build> && <typecheck>` → exit 0; `<lint>` → exit 0; backend <n> suites / <m> tests (<k> integration suites skipped without `<TEST_DB_URL_ENV>`); frontend <n> files / <m> tests; shared <n> files / <m> tests. Skipped suites are never counted as passes (QA-075).
- **Manual test plan** (3–6 steps):
  - API (curl with cookie; test accounts on localhost only): <positive case → expected>; <negative cases → expected codes>.
  - Browser: <per role>, in every locale of <LOCALES>, on desktop and at 375 px.
- **Acceptance checklist** (user-observable steps; tick only what an independent verifier recorded as pass, with the evidence in parentheses — DEL-012, DEL-014):
  - [x] <item> (<test file / curl / browser observation>)
  - [ ] <item> — <blocker / UNVERIFIED: reason, who checks it>
- **DECISION NEEDED (PO)** — default implemented, reversible in one line:
  - <ID>: <default shipped>. Alternative: <option and where it would change>.
- **Remaining**:
  - (a) Code not done: <item — reason>.
  - (b) Owner / production: <env vars and origins, real SMTP with SPF/DKIM, payment keys and webhook, legal identity data, third-party API keys, production scripts to run>.
- **Deploy status**: not deployed — <reason> / deployed — <deployment ID> (DEL-019).
- **Proposed commit message** (no `git commit` — the owner decides): `<message>`
```

### Feedback-round entry

```markdown
## Sprints <X>1–<X>n — <YYYY-MM-DD> — PO feedback round <k> (docs/<NN>): <summary>
- **<X>1** <item title>: <what changed, files, decision IDs>.
- **<X>2** <item title>: <...>.
- Verification: typecheck / lint / tests with counts, production build result, end-to-end run of each changed flow with what was observed (QA-078).
- Deploy status: <not deployed — reason / deployed — deployment ID>.

### Acceptance checklist <X>1–<X>n
- [ ] <X>1 — <where to click, what must appear>
- [ ] <X>2 — <...>
```
