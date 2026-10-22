# Marketplace Mobilier — reguli globale

Monorepo: `apps/backend` (NestJS + Prisma + PostgreSQL), `apps/frontend` (Next.js 14 App Router), `packages/shared` (tipuri TS + Zod + ERROR_CODES), `dev-infra/` (Docker: Postgres, Redis, MinIO, Mailpit).

## Sursa de adevar (citeste DOAR ce e relevant pentru taskul curent)
- `docs/02-technical-invariants.md` — NON-NEGOCIABILE (concurrency claim, idempotenta, timezone, storage, state boundaries, auth)
- `docs/03-business-rules.md` — reguli produs (claim, SLA, penalizari, oferte, credite)
- `docs/04-data-model.md` — entitati, coloane, enum-uri (folosite VERBATIM)
- `docs/07-decisions-log.md` — deciziile sunt FINALE; nu le redeschide
- `docs/05-master-prompt-and-sprints.md` — ordinea sprinturilor + output contract

## Ierarhie la conflict
Invariante tehnice > Decisions Log > Reguli business. Conflict aparent intre business si invarianta → OPRESTE-TE si cere clarificare.

## Comportament obligatoriu
- NU ghici si NU inventa entitati/reguli/campuri. Lipsa critica → marcheaza "DECIZIE NECESARA" si opreste-te.
- Inainte de fiecare sprint: declara modulele, tabelele afectate si presupunerile.
- Dupa fiecare sprint: actualizeaza CHANGELOG.md + checklist de acceptare.
- Pentru research in codebase foloseste subagenti; nu incarca fisiere mari intregi fara motiv.

## Comenzi
- Backend: `pnpm -F backend dev` · test: `pnpm -F backend test` · migratii: `pnpm -F backend prisma migrate dev`
- Frontend: `pnpm -F frontend dev` · lint global: `pnpm lint` · typecheck: `pnpm typecheck`
- Infra: `docker compose -f dev-infra/docker-compose.yml up -d`

## Conventii
snake_case DB · camelCase TS · PascalCase clase/componente. UI: RO+EN via next-intl. Cod/endpoint-uri in engleza. Comentarii: romana fara diacritice, doar unde ajuta.

La compactare pastreaza intotdeauna: sprintul curent, lista fisierelor modificate, deciziile DECIZIE NECESARA deschise.
