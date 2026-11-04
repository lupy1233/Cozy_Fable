# Handoff: planul de imbunatatiri 2026-09-28

## Final (2026-10-01)
Toate cele 17 sprinturi (32 pachete) sunt livrate in working tree, NECOMISE. typecheck 0, lint 0, jest backend 1.272 / vitest frontend 408 / shared 401. Sinteza pentru PO: program-summary.json din acest folder + pagina https://claude.ai/artifact/7AhUKXu1USf7KocY55UVmS (Cozy Home Delivery Status).


Stare la 2026-09-30: sprinturile 1-8, 19-23, 73 si 74 din planul aprobat sunt implementate in working tree (NECOMISE). Raman **Sprint 75** si **Sprint 76**. Oprit la cererea PO inainte de restartul calculatorului.

## Ce ramane

| Sprint | Pachet | Ce face | Estimare |
|---|---|---|---|
| 75 | `E-admin-platform-57` | Primitive de design comune (Card, StatCard, EmptyState, Skeleton, PageHeader, filter chips, wrappere Radix), header randat din sesiune, scala tipografica + curatenie tokeni | ~7,5 zile-dev |
| 76 | `E-client-34` | Colectii intregi atasate la cerere, cu note si camera; firma le vede grupate pe camere; salvare in mai multe colectii | ~4 zile-dev |

Detaliile complete (pasi, „done when", findings cu dovezi si fixuri propuse): `remaining-sprints-75-76.json` din acest folder. Niciunul nu are decizie PO deschisa.

Dependinte de retinut:
- Sprint 75 atinge dashboard, wallet, admin, marketplace si headerul — adica fisiere modificate deja de sprinturile 6, 19, 23 si 74. Citeste starea curenta a fisierelor, nu presupune varianta din `HEAD`.
- Sprint 76 cere migrare Prisma (note + camera pe `board items` si pe pozele de inspiratie ale cererii). `prisma migrate dev` nu are TTY: folder manual + `migrate diff` + `pnpm -F backend prisma migrate deploy` + `prisma generate`.
- Sprint 76 vine DUPA 75 (pickerul din configurator foloseste primitivele noi).

## Cum se reia (pasi)

1. Porneste Docker Desktop, apoi `docker compose -f dev-infra/docker-compose.yml up -d`.
2. Porneste backend (`pnpm -F backend dev`, port 3001) si frontend (`pnpm -F frontend dev`, port 3000).
3. Verifica `curl http://localhost:3001/api/v1/health` → `status: ok`.
4. Intr-o sesiune Claude Code noua in `F:\Cozy Fable`, cere: „continua planul de imbunatatiri: Sprint 75 apoi Sprint 76, din `docs/implementation/improvement-plan-2026-09-28/HANDOFF.md`".
5. Per pachet: plan → implementare → verificare (typecheck, lint, jest, „done when" prin API local) → inchidere sprint (security-close + CHANGELOG + mesaj de commit propus).

Reguli valabile (aceleasi ca la sprinturile 1-74):
- Fara `git commit` pana nu cere PO; mesajele de commit se propun.
- Nu se modifica `apps/backend/.env`, nu se redeschid deciziile din `docs/07`.
- Conturi demo doar pe localhost: `ana.popescu@demo.ro` (client), `owner.a@demo.ro` (firma, GOLD activ), `admin@demo.ro`; parola e in `apps/backend/.env` la `DEMO_PASSWORD`.
- RO/EN in paritate, „firma" nu „atelier", comentarii in romana fara diacritice.
- Modele folosite: planificare + verificare + inchidere = Opus 5.5; implementarea acestor doua pachete (UI mecanic, bine specificat) = Sonnet 5.

## Fisiere in acest folder

- `approved-plan.json` — toate cele 32 pachete aprobate (pasi, „done when", decizii, findings).
- `remaining-sprints-75-76.json` — doar cele doua pachete ramase.
- `implement-workflow.original.js` — scriptul de orchestrare folosit (lista `SPRINTS` se reduce la 75 si 76 la reluare).
- `plan-sprint-75.md`, `plan-sprint-76.md` — planurile detaliate de implementare (fisiere, API componente, migrare, chei i18n, teste, pasi numerotati), scrise de planificatori Opus pe starea curenta a codului. Implementarea porneste direct din ele.
- `sprint-reports.json` — rapoartele per pachet si per sprint ale rularii (fisiere schimbate, ce merge, ce a ramas, DECIZIE NECESARA, mesaj de commit propus). Se adauga la oprirea rularii.

## Stare verificata la oprire (2026-09-30)

- 15 sprinturi inchise (1-8, 19-23, 73, 74), 30 din 32 pachete livrate. Rularea a fost oprita imediat dupa inchiderea Sprintului 74; planificatorul Sprintului 75 (doar citire) a fost intrerupt, nu a modificat nimic.
- `pnpm typecheck` = exit 0 si `pnpm lint` = exit 0 pe arborele final. Backend jest la ultima verificare: 101 suite, 1.236 teste trecute.
- 20 de migrari noi (38 → 58), toate aplicate pe baza locala. Pe productie NU s-a aplicat nimic si nu s-a facut deploy.
- 606 fisiere modificate/noi in `git status`, nimic comis. Mesajele de commit propuse per sprint sunt in `sprint-reports.json` (campul `close.commit_message`).

## Dupa Sprint 76 (de facut, in ordine)

1. Triaj cu PO pe `open-items.json`: 86 intrebari DECIZIE NECESARA (fiecare are deja un default conservator in cod, de regula o cheie `system_settings` oprita), 169 probleme ramase raportate de verificatori, 131 puncte nefacute cu motiv.
2. Commit de checkpoint (propus, la cererea PO) — deblocheaza lucrul in worktree-uri paralele.
3. Reimprospatarea notelor Codex atinse de sprinturile 1-76 (module: claims, quotes, requests, billing, companies, notifications, marketplace, auth, admin, health, outbox + FE) si o linie in `Observatii si limite`.
4. Deploy: abia dupa deciziile PO pentru email, date legale si e-Factura (Sprinturile 2-3 au codul pregatit, dar valorile reale lipsesc).

## Alte locuri

- Aprobarile PO: https://claude.ai/artifact/PatiTYb9dX5SVw4pAvZMp8 (colectia `approvals`).
- Harta tehnica: `E:\CozyFableObsidian\CozyFableCodex` (nota `60 Audituri/Audit imbunatatiri 2026-09-28`).
- Jurnalul sprinturilor livrate: intrarile „Sprint N (plan 2026-09-28)" din `CHANGELOG.md`.
