# Etapa 10, valul 1 — reguli comune pentru cei șase agenți (`e10-kd`, `e10-rooms-a`, `e10-rooms-b`, `e10-3d`, `e10-ui`, `e10-seed`)

Lucrați în paralel în aceeași copie de lucru (`E:\Cozy Fable`, ramura `claude/reparatii-etapa-10`). Fundația (valul 0) e comisă în `4d2120d`.

## Ce citești întâi (în ordine)
1. Ghidul comun: `C:\Users\Wolf\AppData\Local\Temp\claude\51a4fe9ce30fc601\021e0df7-d6c7-42ac-993b-05ae92e81192\scratchpad\reparatii\GHID-AGENTI.md`
2. Proiectul etapei — §1–§4 întregi, apoi secțiunile pachetului tău (numite în mesajul tău) și §11 (rândul tău: lista EXACTĂ a fișierelor), §12 (hotărârile E10-N1…N26 — aprobate de coordonator în varianta scrisă; nu le rediscuta): `…\scratchpad\reparatii\etapa-10\DESIGN.md`
3. Raportul fundației, mai ales „API pentru valul 1” și „Diferențe față de proiect”: `…\scratchpad\reparatii\etapa-10\rapoarte\e10-found.md`. Unde raportul fundației și proiectul diferă, are dreptate RAPORTUL (e codul real).
4. Planul: `E:\Cozy Fable\docs\implementation\plan-reparatii-2026-11-13\etapa-10.md` (răspunsurile PO sunt hotărâri finale).

## Valori pentru ghid
- `<FOLDER_FRAGMENTE>` = `C:\Users\Wolf\AppData\Local\Temp\claude\51a4fe9ce30fc601\021e0df7-d6c7-42ac-993b-05ae92e81192\scratchpad\reparatii\etapa-10\i18n`
- `<COMMIT_BAZA>` = `03cb0b6`
- `<FOLDER_RAPOARTE>` = `C:\Users\Wolf\AppData\Local\Temp\claude\51a4fe9ce30fc601\021e0df7-d6c7-42ac-993b-05ae92e81192\scratchpad\reparatii\etapa-10\rapoarte`

## Reguli de fier
- `CURRENT_FLOW_VERSION` NU se schimbă (o comută coordonatorul după voi). Versiunile noi există doar ca înregistrări; testele voastre le cer explicit (cu numărul versiunii sau cu `ETAPA10_FLOW_VERSION`).
- Versiunile vechi și instantaneele `packages/shared/src/questionnaire/__snapshots__/*.json` rămân byte-identice. Scheletele folosesc ACELEAȘI obiecte de pași ca versiunea înghețată: nu modifica pe loc niciun obiect din `steps` al unei versiuni vechi și nicio listă de opțiuni comună — construiește pași / liste NOI în fișierul versiunii noi. La sfârșit: `git status --short packages/shared/src/questionnaire/__snapshots__` trebuie să fie gol, iar `score-invariance.test.ts` și `firm-text.test.ts` trebuie să treacă neschimbate.
- Doar întrebările alese de PO (c9-1) și măsurile hotărâte (c5-1…c5-3). Toate întrebările noi sunt opționale, cu „Nu știu — vreau recomandarea firmei” (opțiunea comună). Nimic în plus.
- Nicio coloană nouă în baza de date. Răspunsurile noi ajung în descrierea piesei pentru firmă (RO + EN, cu diacritice, termenii din `docs/glosar.md`).
- Valorile salvate, id-urile de pași și cheile de text sunt cele din proiect (§5–§7), întocmai: agentul de scor (`e10-seed`), cel de interfață (`e10-ui`) și cei de fluxuri lucrează în paralel pe aceleași nume. Dacă trebuie să te abați de la un nume, scrie-l SUS în raport, la „Abateri de la nume”, ca să-l pot potrivi la ceilalți.
- Proprietate strictă pe fișiere (§11). Ce îți trebuie în fișierul altuia → „De făcut de coordonator”, cu codul exact.
- Comenzi de test / build doar prin `low.cjs` (ghidul §4), țintite. După ce schimbi tipuri sau exporturi în `packages/shared`: `pnpm -F @marketplace/shared build` prin `low.cjs`. Fără suita întreagă, typecheck, lint, servere, Docker, Playwright. Fără comenzi git care schimbă ceva. Nu atingi `ro.json` / `en.json` direct, `CHANGELOG.md`, `docs/**`, `apps/frontend/e2e/**`.
- Scrie fișierul de raport DEVREME (schelet) și adu-l la zi pe parcurs. Raportul final are forma din ghid §6 și, în plus, „Abateri de la nume” și „Ce trebuie să știe coordonatorul la comutare”.
