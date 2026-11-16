# Ghid comun pentru agenții care repară probleme din planul Cozy Home

Lucrezi în `E:\Cozy Fable` (monorepo: `apps/backend` NestJS + Prisma, `apps/frontend` Next.js 14 + next-intl RO/EN, `packages/shared`). Mai mulți agenți lucrează în același timp, în aceeași copie de lucru. Regulile de mai jos există ca să nu vă călcați pe fișiere și ca PC-ul (6 nuclee, 16 GB) să nu se blocheze.

## 1. Ce citești întâi
- Secțiunea problemelor tale din fișierul de etapă indicat în sarcină (pași, „Unde în cod”, „Cum se verifică”, „Întrebări și răspunsuri”). Răspunsurile PO de acolo sunt hotărâri finale: le aplici exact, nu le rediscuți.
- `CLAUDE.md` din rădăcină. La conflict: `docs/02-technical-invariants.md` > `docs/07-decisions-log.md` > `docs/03-business-rules.md`. Citește doar secțiunile care ating problema ta.
- Skill-urile proiectului din `.claude/skills/` care se potrivesc (`nestjs-module`, `ui-component`, `prisma-migration`, `bullmq-worker`): citește `SKILL.md` înainte să scrii cod în zona respectivă.
- Dacă ajută: nota modulului din harta aplicației, `E:\Obsidian cozy\Obsidian\CozyFableObsidian\CozyFableCodex` (foldere `10 Module BE`, `20 Frontend`, `30 Shared`, `50 Impact`). Doar de citit; nu o modifica.
- Numerele de linie din plan sunt de la commitul ef42664 și pot fi ușor decalate: caută după nume, nu după linie.

## 2. Proprietatea pe fișiere (strict)
- Modifici DOAR fișierele din lista „Fișierele tale” din sarcină și fișiere noi pe care le creezi în aceleași foldere (plus testele lor).
- Ai nevoie de o schimbare într-un fișier care nu e al tău? NU îl edita. Scrie în raport, la „De făcut de coordonator”, fișierul, locul și codul exact de pus.
- Fișiere comune mai multor agenți — `packages/shared/src/error-codes.ts`, `packages/shared/src/index.ts`, `packages/shared/src/enums.ts`, `apps/frontend/src/lib/error-messages.ts`: ai voie doar cu Edit punctual (niciodată Write pe tot fișierul), doar ca să ADAUGI rânduri pentru problema ta; nu reformatezi, nu reordonezi, nu ștergi. Citește fișierul chiar înainte de Edit.
- Nu atinge niciodată: `apps/frontend/src/messages/ro.json` și `en.json` (vezi §3), `CHANGELOG.md`, `docs/**`, `package.json`, fișierele de lock, `.claude/**`, `.github/**`.
- Nu rula `git add`, `git commit`, `git stash`, `git checkout`, `git reset`, `git restore`. Poți rula `git diff`, `git status`, `git log`, `git show` (doar citire).

## 3. Texte (i18n) — prin fragmente, nu direct
- Orice text văzut de om are variantă RO și EN. Româna are diacritice. Se spune „firmă”, niciodată „atelier”. Ton: simplu, direct, fără jargon.
- Scrii cheile noi sau textele schimbate în două fișiere, cu aceeași structură imbricată ca `ro.json`:
  `<FOLDER_FRAGMENTE>\<id-agent>.ro.json` și `<FOLDER_FRAGMENTE>\<id-agent>.en.json` (UTF-8, fără BOM; cheile nu conțin punct).
- Chei de șters (din ambele limbi): `<FOLDER_FRAGMENTE>\<id-agent>.remove.json` = listă de căi cu punct, de ex. `["requests.attachments.limitReached"]`.
- După ce ai scris fragmentele, rulezi: `node "C:/Users/Wolf/AppData/Local/Temp/claude/51a4fe9ce30fc601/021e0df7-d6c7-42ac-993b-05ae92e81192/scratchpad/reparatii/merge-i18n.cjs" "<FOLDER_FRAGMENTE>" <COMMIT_BAZA>`. Scriptul reface `ro.json` / `en.json` din commitul de bază + toate fragmentele (e sigur de rulat de mai mulți agenți). Dacă raportează un conflict sau lipsă de paritate la cheile TALE, le repari; dacă e la alt agent, îl menționezi în raport și mergi mai departe.
- Nu redenumi și nu șterge chei folosite de alții. Înainte să schimbi textul unei chei existente, caută unde mai e folosită (Grep pe numele cheii în `apps/frontend/src`).

## 4. Ce ai voie să rulezi (PC-ul are doar 6 fire)
- OBLIGATORIU: orice comandă de test, build de shared sau `prisma generate` o rulezi prin scriptul de coadă, care îi dă prioritate scăzută și lasă să ruleze o singură comandă grea o dată pe tot calculatorul (omul folosește calculatorul în timp ce lucrezi):
  `node "C:/Users/Wolf/AppData/Local/Temp/claude/51a4fe9ce30fc601/021e0df7-d6c7-42ac-993b-05ae92e81192/scratchpad/reparatii/low.cjs" <comanda ta>` — de ex. `node ".../low.cjs" pnpm -F backend exec jest src/cale/fisier.spec.ts`. Dacă scrie „aștept la rând”, e normal: alt agent rulează ceva; nu o opri și nu o relansa. Rulează puține teste și doar pe fișierele tale.
- DA, după ce ai schimbat `apps/backend/prisma/schema.prisma`: `node ".../low.cjs" pnpm -F backend exec prisma generate` (fără el, testele jest nu văd modelele noi).
- DA, cu măsură: un singur test țintit o dată, pe fișierele tale:
  - backend: `pnpm -F backend exec jest src/cale/fisier.spec.ts` (Postgres / Redis NU sunt pornite; testele unit folosesc dependențe simulate — urmează stilul specurilor existente; nu scrie teste care cer bază de date reală decât ca `*.integration.spec.ts`, care se sar singure);
  - frontend: `pnpm -F frontend exec vitest run src/cale/fisier.test.tsx`;
  - shared: `pnpm -F @marketplace/shared exec vitest run src/cale/fisier.test.ts`.
- DA, dacă ai schimbat tipuri sau exporturi în `packages/shared`: `pnpm -F @marketplace/shared build` (durează câteva secunde; testele jest din backend iau TIPURILE shared din `dist`, deci fără build pică la compilare).
- DA, pentru un test `*.integration.spec.ts` al tău (Postgres local e pornit): din `apps/backend`, ia `DATABASE_URL` din `.env`, înlocuiește numele bazei cu `marketplace_test` și rulează cu `DATABASE_URL` și `TEST_DATABASE_URL` puse pe adresa aceea: `pnpm exec jest --runInBand --testPathPattern=<fișier>`. Dacă ai o migrare nouă, aplic-o ÎNTÂI doar pe `marketplace_test` (`pnpm exec prisma migrate deploy` cu același `DATABASE_URL` schimbat). NU atinge baza `marketplace` (cea de lucru).
- NU: suita întreagă de teste, `tsc` / `pnpm typecheck`, `eslint` / `pnpm lint`, `next build`, `nest build`, servere de dev, Docker, `pnpm install`, Playwright, `prisma migrate dev` (nu există terminal interactiv; pentru migrări urmează skill-ul `prisma-migration` și scrie folderul de migrare de mână cu `prisma migrate diff`; NU aplica migrarea pe nicio bază de date). Coordonatorul rulează o singură dată typecheck, lint și toate testele, după ce termină toți.
- Comenzile care pot dura peste 2 minute le rulezi în fundal. În PowerShell nu trimite comenzi native prin `| Select-Object -First N` (iese cu eroare falsă).
- Dacă deschizi vreodată un browser headless: doar cu `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist --enable-webgl` (în mod normal nu ai nevoie).

## 5. Cum scrii codul
- Convenții: snake_case în baza de date, camelCase în TS, PascalCase la clase și componente. Cod și endpoint-uri în engleză. Comentarii în română fără diacritice, doar unde ajută.
- Nu ghici și nu inventa entități, coloane, enum-uri sau reguli. Numele din `docs/04-data-model.md` se folosesc întocmai. Dacă lipsește o hotărâre de produs pe care planul nu o acoperă: alegi varianta cea mai mică și reversibilă, o notezi în raport la „DECIZIE NECESARĂ”, și NU extinzi singur produsul.
- Fluxurile de chestionar din `packages/shared/src/questionnaire/flows` sunt versionate și înghețate: nu schimbi ce se salvează într-o versiune existentă decât dacă sarcina o spune explicit.
- Coduri de eroare: `packages/shared` (ERROR_CODES) + `docs/ERROR_CODES.md` (pe acesta îl actualizează coordonatorul — spune-i în raport ce cod ai adăugat).
- Fiecare reparație are teste: cele din „Cum se verifică” care se pot automatiza. Potrivește-te cu stilul testelor vecine.
- Nu refactoriza în afara problemei. Schimbarea cea mai mică ce rezolvă complet problema.
- Lecții din etapa 1 (greșeli găsite la revizuire — nu le repeta):
  - Datele și numerele afișate se formatează după limba APLICAȚIEI (next-intl; vezi `apps/frontend/src/app/[locale]/_components/use-long-date.ts`, `useSlaDateFormat`), cu fusul orar al României, nu după limba browserului (`toLocaleDateString()` fără locale e greșit). În română zecimalele au virgulă.
  - Ce vede omul e ce se trimite: un câmp cu text nevalid nu lasă în spate o valoare veche.
  - Un endpoint care poate răspunde cu corp gol: în hook normalizezi cu `?? null` (TanStack Query respinge `undefined`).
  - Orice cod de eroare pe care îl poate întoarce un flux are text RO + EN (`apiErrors`).
  - O regulă nouă pe server (de ex. „doar cu abonament activ”, „doar clienți”) strică fixture-urile testelor vechi, inclusiv ale celor de integrare: caută specurile care trec prin același serviciu și adu-le la zi.
  - Două tranzacții care trebuie să se excludă: cea care doar citește sub `FOR UPDATE` nu oprește o tranzacție Serializable pornită înainte; e nevoie de o scriere pe rândul blocat.
- Testele Playwright din `apps/frontend/e2e/**` le aduce la zi un agent separat, la sfârșitul etapei. Nu le edita. Dacă schimbi un text, un rol ARIA sau un pas pe care un test e2e îl folosește (caută în `apps/frontend/e2e`), scrie în raport la „E2E de adus la zi” ce s-a schimbat.
- Securitate: nu slăbi gărzile, verificările de rol sau mascarea datelor clientului față de firme înainte de preluare.

## 6. Raportul final (ultimul tău mesaj; scurt, fără cod lung)
Scrie-l și într-un fișier: `<FOLDER_RAPOARTE>\<id-agent>.md`, apoi întoarce același text.
1. **Ce am făcut** — câte un rând pe problemă: rezolvat complet / parțial (ce lipsește).
2. **Fișiere** — listă: modificate / noi / șterse.
3. **Schimbări de comportament** — ce vede altfel clientul, firma, adminul.
4. **Teste** — ce ai adăugat, ce ai rulat și rezultatul exact (trecut / picat, cu mesajul). Dacă n-ai rulat ceva, spune.
5. **De făcut de coordonator** — editări în fișiere care nu erau ale tale (fișier, loc, cod exact).
6. **Documente** — ce trebuie scris în `docs/02`, `docs/03`, `docs/04`, `docs/07`, `docs/ERROR_CODES.md` (textul propus, pe scurt).
7. **DECIZIE NECESARĂ / presupuneri** — orice ai ales fără acoperire în plan.
8. **De verificat de mână** — pași scurți pentru verificarea în browser.
Raportează cinstit: dacă un test pică sau un pas a rămas nefăcut, scrie asta clar.
