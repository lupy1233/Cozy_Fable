# Etapa 12 — reguli comune pentru agenții etapei („Mărunțișuri: texte, formate, curățenie”, problemele 54–63)

Lucrați în paralel în aceeași copie de lucru (`E:\Cozy Fable`, ramura `claude/reparatii-etapa-12`), în aplicația Cozy Home (marketplace de mobilă la comandă: `apps/backend` NestJS + Prisma, `apps/frontend` Next.js 14 + next-intl RO / EN, `packages/shared` cu fluxurile de chestionar versionate). Răspunsurile și rapoartele sunt în română.

## Ce citești întâi (în ordine)
1. Ghidul comun (proprietate pe fișiere, i18n prin fragmente, ce ai voie să rulezi, forma raportului): `C:\Users\Wolf\AppData\Local\Temp\claude\51a4fe9ce30fc601\021e0df7-d6c7-42ac-993b-05ae92e81192\scratchpad\reparatii\GHID-AGENTI.md`
2. Contractul etapei — TOT, inclusiv „Reguli pentru texte” și „Adaos”: `C:\Users\Wolf\AppData\Local\Temp\claude\51a4fe9ce30fc601\021e0df7-d6c7-42ac-993b-05ae92e81192\scratchpad\reparatii\etapa-12\CONTRACT.md`
3. Secțiunile tale din plan (numite în mesajul tău): `E:\Cozy Fable\docs\implementation\plan-reparatii-2026-11-13\etapa-12.md` — pașii, „Unde în cod” (numerele de linie sunt vechi: caută după text / nume de cheie), „Cum se verifică”, răspunsurile PO și „Alegeri mărunte” (toate finale).
4. `E:\Cozy Fable\docs\glosar.md` (termenii aplicației) și testul lui `apps/frontend/src/messages/glossary.test.ts`.

## Valori pentru ghid
- `<FOLDER_FRAGMENTE>` = `C:\Users\Wolf\AppData\Local\Temp\claude\51a4fe9ce30fc601\021e0df7-d6c7-42ac-993b-05ae92e81192\scratchpad\reparatii\etapa-12\i18n`
- `<COMMIT_BAZA>` = `4f0fa40`
- `<FOLDER_RAPOARTE>` = `C:\Users\Wolf\AppData\Local\Temp\claude\51a4fe9ce30fc601\021e0df7-d6c7-42ac-993b-05ae92e81192\scratchpad\reparatii\etapa-12\rapoarte`

## Reguli pe care nu ai voie să le uiți
- Textele se schimbă DOAR prin fragmentul tău i18n (`<id-agent>.ro.json` / `.en.json`), niciodată direct în `ro.json` / `en.json`. Șapte agenți scriu texte în același timp: respectă împărțirea pe chei din contract; dacă scriptul de îmbinare refuză o cheie pentru că alt agent a scris-o cu altă valoare, NU o forța — scrie cheia în raport la „De făcut de coordonator” și las-o proprietarului din tabel.
- Cheile NU se redenumesc și NU se șterg (curățenia e a agentului din valul 2). Textele noi rămân adevărate pe TOATE versiunile de formular care citesc cheia (și cele vechi, înghețate).
- Instantaneele `packages/shared/src/questionnaire/__snapshots__/*.json` rămân byte-identice (singura excepție permisă e descrisă în „Adaos”, pentru `e12-hints`). La sfârșit: `git status --short packages/shared/src/questionnaire/__snapshots__`.
- Comenzi de test / build doar prin `low.cjs` (ghidul §4), țintite. Fără suita întreagă, typecheck, lint, servere, Docker, Playwright. Testele de integrare (`*.integration.spec.ts`) le scrii, dar NU le rulezi. Migrările NU se aplică.
- Fără comenzi git care schimbă ceva. Nu atingi `CHANGELOG.md`, `docs/**`, `apps/frontend/e2e/**`.
- În fișierele comune (cele din ghid și din contract) lucrează și alți agenți chiar acum: doar Edit punctual, recitind fișierul chiar înainte; niciodată Write pe tot fișierul.
- Scrie fișierul de raport DEVREME (schelet) și adu-l la zi pe parcurs. Raportul final are forma din ghid §6; la texte adaugă un tabel „cheie — text vechi → text nou” (RO și EN) doar pentru schimbările reprezentative și numărul total de chei schimbate.
- Româna cu diacritice, ton simplu, „firmă” nu „atelier”; engleza britanică (metre, colour).
