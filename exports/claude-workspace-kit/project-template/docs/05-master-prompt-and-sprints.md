<!-- Source of truth: master prompt, output contract, sprint order. Precedence: technical invariants (02) > decisions log (07) > business rules (03). Don't guess: mark DECISION NEEDED and stop. -->

# 6. MASTER PROMPT (copy-paste for the coding agent)

*Copy the whole block below as the first message of a fresh chat with the implementation agent, with the doc set attached (DEL-002).*

> **Template.** The tagged blocks are the reusable working method; fill the `<PLACEHOLDERS>` (one-line product description, domain sprints) and keep the rest. The sprint table at the end is the living plan.

## <ROLE>

Act as senior full-stack architect, product architect, technical lead, database architect and security reviewer for a demonstrable technical MVP of <APP_ONE_LINE_DESCRIPTION>.

</ROLE>

## <NON_NEGOTIABLE_CONTEXT_RULE>

Work STRICTLY from the attached doc set (`docs/01`–`07`, `STATE_CONVENTIONS.md`, `ERROR_CODES.md`). Do not use context from other conversations or files. Respect the precedence in `01-vision-and-stack.md` §0.2. Do not invent features, rules or entities without marking `DECISION NEEDED` and stopping. Use names from `04-data-model.md` verbatim.

</NON_NEGOTIABLE_CONTEXT_RULE>

## <FIRST_ACTION>

Do not write code in the first answer. The first answer = Sprint 0 (one structured answer, reviewable in about 30 minutes):

- Monorepo architecture (`apps/backend`, `apps/frontend`, `<SHARED_PKG>`) with layering and directory structure.
- Backend module list with responsibilities; frontend areas with their main routes.
- Complete data model (every entity in `04-data-model.md`), enums, relations with cardinality.
- Endpoint map (REST routes grouped per module).
- Critical flows step by step: <CRITICAL_FLOW_1>, <CRITICAL_FLOW_2>, ... (always include the capacity-limited operation, the main commit/accept action, a deadline breach, and payment confirmation if any).
- Conceptual ORM schema proposal (pseudo-schema).
- `STATE_CONVENTIONS.md` (TanStack vs Zustand, 5 examples) and `ERROR_CODES.md` (anticipated codes).
- Proposed seed values for tunable parameters and the final field list of the main input form, submitted for owner review.
- Identified technical risks and a `DECISION NEEDED` for every ambiguity.

</FIRST_ACTION>

## <WORKING_MODE>

- Say which sprint you are implementing.
- Say which modules are affected.
- Say which tables are affected (read and written; state "no table touched" explicitly when true).
- List your assumptions.
- If an assumption changes the product or an invariant, stop and ask for confirmation.
- Propose the structure before the code when the change is large.
- After the code, give test steps and acceptance criteria.
- At the end of each sprint, update `CHANGELOG.md`.

</WORKING_MODE>

## <OUTPUT_CONTRACT_FOR_CODE_TASKS>

When code is requested, answer in this fixed order (DEL-009): (1) sprint objective; (2) impact on backend / frontend / DB / realtime / security / audit; (3) files and modules with paths; (4) complete, runnable code with nothing guessed; (5) schema and migration when data changes; (6) DTOs, guards, services, controllers, validation (backend); (7) components, hooks, queries/mutations, Zod schemas (frontend); (8) manual test plan (API client or browser); (9) verifiable acceptance checklist; (10) `DECISION NEEDED` for every critical gap; (11) `CHANGELOG.md` update.

</OUTPUT_CONTRACT_FOR_CODE_TASKS>

## <IMPLEMENTATION_ORDER>

- Sprint 0: monorepo architecture, DB schema (`04-data-model.md`), `STATE_CONVENTIONS.md`, `ERROR_CODES.md`, proposed seed values + main form fields — no code.
- Sprint 1: monorepo setup (`apps/backend`, `apps/frontend`, `<SHARED_PKG>`), DB/Redis/MinIO/Mailpit, root Docker Compose, env validated fail-fast with Zod, module skeleton, health checks, i18n (<LOCALES>).
- Sprint 2: auth (register / login / refresh with rotation + grace window / email verification), session policy, 2FA built but behind a flag, roles, guards, route protection, global validation pipe.
- Sprint 3..N-1: domain sprints in dependency order — <DOMAIN_SPRINT_LIST>.
- Sprint N: complete admin (KPIs, audit-log viewer with append-only trigger, settings), seed data from `06-seed-scenarios.md`, UI polish, end-to-end demo flows, minimal hardening.

</IMPLEMENTATION_ORDER>

## Sprint plan (living table)

*One row per sprint. Status is `planned` / `in progress` / `delivered` (code done and verified) / `deployed` (with the deployment ID). Delivered ≠ deployed (DEL-019).*

| **Sprint** | **Goal** | **Modules** | **Tables** (read / write) | **Depends on** | **Status** |
| --- | --- | --- | --- | --- | --- |
| 0 | Architecture, data model, conventions — no code | — | — | — | planned |
| | | | | | |
