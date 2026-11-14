# Etapa 11 — contractul dintre agenți (obligatoriu pentru toți agenții etapei)

Trei agenți lucrează în paralel în aceeași copie de lucru (`E:\Cozy Fable`, ramura `claude/reparatii-etapa-11`). Toți citesc secțiunea „## 52.” din `docs/implementation/plan-reparatii-2026-11-13/etapa-11.md` (pași, „Unde în cod”, „Cum se verifică”, răspunsurile PO h1-1 și h1-2 — finale). Dacă un punct de aici ți se pare greșit: respectă-l cât poți și scrie la „DECIZIE NECESARĂ”.

## Cine ce face

| Agent | Partea din problema 52 (`h1`) | Zona lui (fișierele „ale lui”) |
|---|---|---|
| `e11-team` | pasul 1 (permisiuni) + pasul 2 (echipă) | `apps/backend/src/modules/quotes/**` (doar verificarea permisiunilor pe câmpuri), partea de membri și de permisiuni din `companies.service.ts` (+ controller / dto / spec), `apps/backend/prisma/seed-demo.ts`, `apps/backend/src/modules/notifications/**` (doar e-mailul + clopoțelul membrului adăugat), `apps/frontend/src/app/[locale]/company/_components/{team-section,offer-permissions-section}.tsx` |
| `e11-place` | pasul 3 (locații) + pasul 4 (portofoliu) | partea de locații și de portofoliu din `companies.service.ts` (+ controller / dto / spec), `apps/backend/src/modules/uploads/**`, `apps/frontend/src/app/[locale]/company/_components/{locations-section,portfolio-section}.tsx`, `apps/frontend/src/hooks/use-company.ts` |
| `e11-dash` | pasul 5 (panou: cardul „Pregătește-ți firma”, fraza despre proba gratuită) | partea de panou din `companies.service.ts` (`dashboard`) + spec-ul ei, `apps/frontend/src/app/[locale]/company/_components/company-dashboard.tsx`, pagina / componentele panoului firmei din `marketplace` |

## Fișiere comune (doar Edit punctual, recitind fișierul chiar înainte; nu reformatezi, nu reordonezi)
- `apps/backend/src/modules/companies/companies.service.ts`, `companies.controller.ts` — fiecare agent atinge doar metodele părții lui;
- `apps/frontend/src/hooks/use-company.ts` — al lui `e11-place`; ceilalți doar adaugă hook-ul lor;
- `apps/backend/src/infra/event-bus/event-bus.service.ts` (uniunea `DomainEvent`): numele `company.member_added` e deja adăugat de coordonator;
- cele din ghid (`error-codes.ts`, `error-messages.ts`, `schema.prisma` etc.).

## Evenimentul nou
`company.member_added` — emis de `e11-team` la adăugarea unui coleg; țintă: doar colegul adăugat; payload: `companyId`, `companyName`, `memberUserId`, `role`, `actorUserId`. Clopoțel + e-mail („Ai fost adăugat în firma X”, cu legătură spre panoul firmei). Prin outbox, ca restul.

## Hotărârile PO, pe scurt
- h1-1: colegul își face singur cont de tip Firmă; proprietarul îl adaugă după e-mail. Formularul explică asta clar, iar colegul adăugat primește e-mail + clopoțel. FĂRĂ invitație cu link, fără tabele noi.
- h1-2: proprietarul are MEREU toate drepturile pe câmpurile ofertei; coloana lui din matrice devine needitabilă. Firma fără niciun rând de permisiuni primește matricea implicită (aceeași ca la înscriere).
- O singură poză pe lucrare din portofoliu, încărcată din calculator (alegere măruntă din plan).

## Migrări
Etapa nu ar trebui să aibă nevoie de migrări. Dacă un agent crede că are nevoie: nume rezervate `20261115120000_company_onboarding_team` (`e11-team`), `20261115130000_company_onboarding_place` (`e11-place`); scrise de mână, NEaplicate; motivul în raport.

## Securitate (toți)
- Încărcarea pozelor de portofoliu e o cale nouă de fișiere publice: doar prin `StorageService` cu legături presemnate (invarianta 3.4), doar imagini (tip + conținut verificate ca la fișierele cererii), cu limită de mărime, cu curățarea de metadate existentă (`image-sanitizer`), doar pentru membrii firmei cu rol potrivit, doar în spațiul firmei proprii.
- Matricea implicită nu are voie să dea unui angajat mai mult decât dă matricea de la înscriere.
- Nimic nu slăbește gărzile de rol existente.

## Foldere
- Fragmente i18n: `C:\Users\Wolf\AppData\Local\Temp\claude\51a4fe9ce30fc601\021e0df7-d6c7-42ac-993b-05ae92e81192\scratchpad\reparatii\etapa-11\i18n`
- Rapoarte: `…\reparatii\etapa-11\rapoarte\<id-agent>.md` (scrie-l devreme, adu-l la zi pe parcurs).
