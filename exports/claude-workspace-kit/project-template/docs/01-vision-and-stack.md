<!-- Source of truth: vision, actors, MVP scope, stack, doc map. Precedence: technical invariants (02) > decisions log (07) > business rules (03). Don't guess: mark DECISION NEEDED and stop. -->

# <APP_NAME> — Vision and stack

> **Template.** Purpose: tell the agent how to use the doc set, what the product is, who uses it, what the MVP includes, and which stack is fixed. Replace every `<PLACEHOLDER>`, delete the italic guidance once a section is filled, and clear every `DECISION NEEDED` before the first coding sprint (SOT-004).

# 0. Instructions for the AI agent (read first)

*This section defines HOW the doc set is used. It applies before anything else.*

## 0.1 Status and authority

- The numbered docs in `docs/` are the SINGLE source of truth for <APP_NAME>. They replace every earlier spec, brief or chat summary.
- Do not take rules from other files, conversations, memory or archived docs. Those help you navigate; they never supply rules (SOT-012).
- Do not invent features, entities, business rules, fields or business numbers. Mark any critical gap explicitly and stop (see 0.3).

## 0.2 Precedence on conflict

When two rules seem to contradict each other, apply this order:

1. TECHNICAL INVARIANTS (`02-technical-invariants.md`) — highest level; never violated.
2. DECISIONS LOG (`07-decisions-log.md`) — decisions are FINAL and carry a rationale.
3. BUSINESS RULES (`03-business-rules.md`).
4. Implementation preferences / details left to the agent.

**MANDATORY STOP:** if a business rule appears to conflict with a technical invariant, STOP and ask <PRODUCT_OWNER>. Do not resolve the conflict yourself.

## 0.3 Mandatory behaviour rules

- **Don't guess:** if critical information is missing, write `DECISION NEEDED`, describe the options and STOP the work that depends on it.
- **Don't bring back old rules:** if a decision in the decisions log contradicts an older rule, the decision wins.
- **Use names exactly:** enums, values, thresholds and field names from the docs are used verbatim.
- **Before each sprint:** declare the sprint, the modules and tables affected, and the assumptions. If an assumption changes the product or an invariant, stop and ask for confirmation.
- **No code in the first answer:** the first answer is Sprint 0 (architecture + schema), reviewable in about 30 minutes.

## 0.4 Marking conventions

| **Marker** | **Meaning** | **What you do** |
| --- | --- | --- |
| (plain text) | Confirmed, mandatory rule. | Implement it as written. |
| DECISION NEEDED | Critical gap found during implementation. | Do NOT proceed with the dependent work. Ask for an answer. |
| MUST / NEVER / ALWAYS | Strict normative language. | No exceptions. |

*Status labels (Historical, reserved, confirmed by owner on <date>, CONFIRMED / RESOLVED) may appear next to these markers.*

## 0.5 How to start

1. Read this doc once, then the doc map below.
2. Read `02-technical-invariants.md` in full; it applies to every change.
3. For a task, read only the sections of 03 / 04 / 07 it touches (never the whole set without a reason).
4. Your first answer is Sprint 0 as defined in `05-master-prompt-and-sprints.md` (design only, no code).

## 0.6 Document map

| **Doc** | **Content** |
| --- | --- |
| `01-vision-and-stack.md` | Agent instructions (meta), vision, actors, end-to-end flow, MVP definition, fixed stack, repo strategy. |
| `02-technical-invariants.md` | Technical invariants INV-1..INV-n — non-negotiable. |
| `03-business-rules.md` | Consolidated business rules (all decisions integrated) + terminology glossary. |
| `04-data-model.md` | Full data model: entities, tables, columns, enums, relations, settings keys. |
| `05-master-prompt-and-sprints.md` | Master prompt (copy-paste block), output contract, sprint order. |
| `06-seed-scenarios.md` | Named seed actors and scenarios (double as live acceptance scripts). |
| `07-decisions-log.md` | Final decisions with rationale + the human checklist. |
| `08-deployment.md` | Current-state banner, environments, services, deploy pipeline, runbooks, platform gotchas (fill before the first deploy). |
| `STATE_CONVENTIONS.md` | Frontend boundary between server state and UI state (INV-6). |
| `ERROR_CODES.md` | Error-code catalogue (INV-10). |

# 1. Product vision and goal

## 1.1 What we are building

*Two to four sentences: the problem, who has it, what the product does about it, and what "demonstrable MVP" means here. No feature lists.*

<VISION_STATEMENT>

## 1.2 Actors

*One bullet per actor: name, what they do, how they start (anonymous draft, invite, self-signup), and their internal roles if any. Role and enum names written here are used verbatim everywhere.*

- **<ACTOR_1>:** <what they do; how they start>.
- **<ACTOR_2>:** <what they do>. Member roles: <ROLE_A>, <ROLE_B>, ...
- **Admin:** <single ADMIN role or several>; manages <list of admin responsibilities>.

## 1.3 End-to-end flow

*The main happy path as numbered steps, from first contact to the terminal state, naming the actor and the resulting status at each step. Edge paths (expiry, cancellation, dispute) are listed after it in one line each, with a pointer to the business rule that governs them.*

1. <Actor> <action> → <ENTITY> status `<STATUS>`.
2. ...

## 1.4 MVP definition and what is mocked

*Every external integration that is mocked in the MVP sits behind its final interface and data model, so replacing it needs no structural refactor (ENG-114). Mocks are labelled in the UI and listed as launch blockers (ENG-115).*

| **Component** | **Mock in MVP** | **Later replacement** |
| --- | --- | --- |
| File scanning | Job that marks a file clean after a short delay (blocked if the name contains a test marker). | Real antivirus scanner or external scanning API. |
| | | |

## 1.5 In scope / out of scope (CONFIRMED)

*Two confirmed lists. Anything not on the "in scope" list is out of scope until a decision adds it. Cite the decision that confirmed each list.*

**In scope:** <comma-separated capabilities>.

**Out of scope (mock or post-MVP):** <comma-separated capabilities>. List confirmed by <DECISION_ID>.

# 2. Tech stack and repo strategy (fixed — does not change)

*Fixed technology choices. Changing one needs a decisions-log entry. The list below is the reference stack the workspace rules are written for; replace any line that differs and translate the mechanisms (see the engineering-patterns chapter, "Adapting to a new project").*

- Backend: NestJS. ORM: Prisma. DB: PostgreSQL <VERSION>+.
- Frontend: Next.js (App Router), React. UI: <UI_KIT>. Forms: React Hook Form + Zod. Runtime minimum: Node <NODE_VERSION>; exact versions live in the lockfile and `.node-version`.
- Server state: TanStack Query v5. UI/global state: Zustand. i18n: <I18N_LIB> (<LOCALES>).
- Realtime: Socket.IO with Redis adapter. Queues/jobs: BullMQ + Redis.
- Auth: access token + refresh token in httpOnly cookies (Secure, SameSite=Lax).
- API: REST under `/api/v1` for business operations; WebSocket only for realtime.
- Storage: MinIO in Docker Compose (dev), S3-compatible in production.
- Email in dev: Mailpit. PDF: <PDF_LIB> (decide in Sprint 0 with a justification).

## 2.1 Repo strategy: MONOREPO (<DECISION_ID>)

**Final decision:** one monorepo with `apps/backend` + `apps/frontend` + `<SHARED_PKG>` (shared TS types, common Zod schemas, error-code constants). Tooling: pnpm workspaces + root scripts for dev/build/test.

- Rationale: an AI agent works far more efficiently in one workspace — migrations, shared types and end-to-end testing without cross-repo synchronisation.
- Separable later: the `apps/*` layout allows extraction into separate repos without a refactor.
- Docker: `<INFRA_DIR>/docker-compose.yml` with PostgreSQL, Redis, MinIO, Mailpit. Backend and frontend run locally for hot reload.

Naming: snake_case for the DB, camelCase for TS, PascalCase for classes/components. UI in <LOCALES>; code, tables and endpoints in English; comments in <WORKING_LANGUAGE> (ASCII only), only where they help.
