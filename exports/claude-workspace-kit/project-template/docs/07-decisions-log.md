<!-- Source of truth: decisions log — decisions are FINAL. Precedence: technical invariants (02) > decisions log (07) > business rules (03). Don't guess: mark DECISION NEEDED and stop. -->

# 8. Decisions log

*For you in six months: why each thing was chosen. Decisions are FINAL — never reopened or re-argued; only <PRODUCT_OWNER> can supersede one, through a new entry (SOT-016).*

> **Template.** Keep the two generic technical decisions below if you keep the reference stack; otherwise replace them. Fill the log with your initial stack and architecture decisions before Sprint 1. Delete the italic guidance once filled.

## How entries are written

- **Append-only.** Never edit, rewrite or delete an existing entry. The only allowed change is the "Historical" prefix + link once the owner has explicitly superseded it (SOT-017, SOT-022).
- **ID scheme:** `D-<series>-<n>` (SOT-019). Series: `T` technical · `B` business · `R` release/operations · `PO<k>` owner feedback round `k`. Answers to refinement questions use `Q-<n>`. Code comments, changelog entries and checklists cite these IDs.
- **Three labelled parts:** **Decision**, **Rationale** (the reason, the heavier alternatives rejected, the scale or assumption it depends on — SOT-020) and **Impact** (the tables, columns, settings keys, jobs, error codes and doc sections it touches — SOT-021). Register a decision before relying on it.
- **Owner decisions** carry the date, a `PO` tag, what triggered them (audit finding, dead end, feedback item) and the owner's own worked example when the decision is a formula (PO-027).
- **Open questions do not live here.** They live as `DECISION NEEDED` rows in the sprint or round doc, in a table `ID | Question | Recommended answer | Reason | Owner answer` (PO-014). Once answered, append the decision here and update the affected sections of `03` / `04` in the same change (SOT-039).
- **Superseding:** add a new entry that names the entry it replaces and says the owner explicitly asked for the change (SOT-023); prefix the old entry's heading with `Historical, replaced on <YYYY-MM-DD> by <new ID> —` and say where the current rule lives.
- **Descoping:** a new entry that names the business-rule section, the decision it supersedes, and exactly which columns, checks and events are NOT to be built (SOT-014).

Entry template:

```markdown
### D-<series>-<n>. <Short title> (<YYYY-MM-DD>[, PO])

**Decision:** <what was decided, precisely enough to implement>.

**Rationale:** <why; rejected alternatives; the scale or assumption it depends on>.

**Impact:** <tables / columns / settings keys / jobs / error codes / doc sections updated in the same change>.
```

## 8.1 Technical decisions

### D-T-001. Row lock for capacity-limited operations

**Decision:** Capacity-limited operations lock the parent row with `SELECT ... FOR UPDATE` inside a SERIALIZABLE transaction with an explicit timeout (INV-1).

**Rationale:** A row lock is enough below ~100 RPS on a single parent and is easy to debug. Advisory locks or optimistic locking add complexity without value at MVP scale. Revisit if sustained contention on one parent exceeds that.

**Impact:** INV-1; one reference implementation that every capacity-changing path (including jobs) reuses; "capacity full" and "concurrent update" codes in `ERROR_CODES.md`; no table change.

### D-T-002. Monorepo

**Decision:** One pnpm monorepo: `apps/backend`, `apps/frontend`, `<SHARED_PKG>`.

**Rationale:** An AI agent is far more effective in one workspace: migrations, shared types and end-to-end tests change together without cross-repo synchronisation. The `apps/*` layout can be split into separate repos later without a refactor.

**Impact:** `01-vision-and-stack.md` §2.1; root workspace scripts for dev/build/test; `<SHARED_PKG>` is the single source of enums, types and schemas (SOT-029).

## 8.2 Business decisions

*Product rules the owner settled before or during Sprint 0, as `D-B-<n>`.*

## 8.3 Refinement answers

*Answers to the clarification round before implementation, as `Q-<n>. <topic>` with **Question** / **Answer** / **Impact**.*

## 8.4 Release and operations decisions

*Deploy topology, environments, production data, provider choices, as `D-R-<n>`.*

## 8.5 Owner-round decisions

*Decisions from each owner feedback round, copied here when the round's sprint closes, as `D-PO<k>-<n>` (SOT-050).*

# 9. Human checklist: what to do now

- Read the whole doc set once. Check this decisions log. If a decision bothers you, change it NOW in the docs, before the agent writes any code.
- Make sure no open proposal or `DECISION NEEDED` remains (SOT-004).
- Create the monorepo (D-T-002) and commit the doc set.
- Open a fresh chat with the coding agent. Paste the MASTER PROMPT (`05-master-prompt-and-sprints.md`) as the first message, with the doc set attached.
- Wait for Sprint 0 (no code). Review the schema, `STATE_CONVENTIONS.md`, `ERROR_CODES.md`, the proposed seed values AND the main form fields. Correct them here, not five sprints later.
- At every sprint, check the acceptance checklist by hand, using the seed scenarios (`06-seed-scenarios.md`) as live test scripts.
- To change a rule, change it in the doc first, then tell the agent "re-read section X, it changed". Never give change instructions only in chat (SOT-038).

*A coherent doc set is worth weeks of avoided refactoring and misunderstandings.*
