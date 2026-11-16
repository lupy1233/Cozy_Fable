# Sarcina `e9-drafts` — problema 48 (`f6`): ciorne vechi și cererea expirată

Citește secțiunea „## 48.” din `E:\Cozy Fable\docs\implementation\plan-reparatii-2026-11-13\etapa-09.md` (răspunsurile PO f6-1, f6-2, f6-3 sunt finale) și contractul etapei. Skill-uri: `bullmq-worker`, `nestjs-module`, `prisma-migration`.

## Ce ai de făcut — curățarea
1. Job BullMQ zilnic la 03:30 ora României (ca celelalte joburi repetate) care șterge ciornele `DRAFT` neatinse (după `updated_at`): ale vizitatorilor (fără cont) după **7 zile**, ale clienților cu cont după **90 de zile**. Ordinea: fișierele din storage → rândurile din `attachments` → ciorna (și ce mai atârnă de ea: camere, token de ciornă, scene de Studio legate doar de ciornă). Pe loturi mici, cu limită pe rulare, idempotent (o rulare întreruptă se reia fără erori).
2. Același job curăță ciornele deja marcate șterse (`deleted_at`) și fișierele lor rămase.
3. Cele două durate = două setări noi, editabile din Admin, după modelul `delivery_min_days_after_accept` din etapa 5 (migrarea rezervată `20261114170000_draft_retention`, `setting-defaults.ts`, `SETTING_VALUE_RULES`, `audit-snapshot.ts`, `setting-catalog.ts`, `seed.ts`). Propune nume în stilul celor existente; valori 7 și 90; minim 1.
4. `@Throttle` pe ruta de creare a ciornelor (10 pe minut pe IP, în stilul limitelor existente).
5. **Script pentru ciornele de test de pe producție** (f6-3): `apps/backend/scripts/` — ia DOAR ciornele `DRAFT` cu „[TEST AUDIT]” în mesaj; implicit doar LISTEAZĂ (id, dată, câte fișiere) și scrie o copie de rezervă JSON; șterge numai cu un argument explicit (`--delete --yes`). NU îl rula pe nicio bază de date; îl pornește doar PO. Scrie în raport comanda exactă.

## Ce ai de făcut — cererea expirată
6. „Republică cu modificări” (f6-2): pe pagina cererii expirate, buton care deschide formularul precompletat (modul de editare existent); la salvare se aplică modificările ȘI se republică într-un singur pas, în aceeași tranzacție, cu aceeași regulă „o singură dată” (`REPOST_ALREADY_USED` la a doua încercare). NU consumă una dintre cele 3 editări. Republicarea identică existentă rămâne.
7. Pe pagina cererii expirate dispare, la ștergere, mesajul „Preluările active ale firmelor vor fi anulate” (irelevant acolo).

## Reguli de fier (un job de ștergere greșit e cel mai mare risc al etapei)
- Jobul atinge DOAR rânduri cu starea `DRAFT`. Niciodată o cerere publicată, expirată, preluată sau fișierele ei. Filtrul de stare se verifică din nou în aceeași tranzacție cu ștergerea (o ciornă publicată între listare și ștergere NU se șterge).
- Un fișier din storage se șterge doar dacă NU mai e folosit de alt rând (o ciornă continuată / copiată poate împărți chei cu o cerere publicată — verifică în cod cum se copiază atașamentele la „Continuă” și la republicare).
- O ciornă la care omul lucrează acum (atinsă recent) nu se șterge: orice salvare automată a formularului mută `updated_at` — verifică în cod că așa e; dacă nu, scrie la „DECIZIE NECESARĂ”.
- Eșecul ștergerii unui fișier nu lasă rânduri orfane fără urmă: ciorna rămâne pentru rularea următoare și se scrie în jurnal (fără date personale).
- `requests.service.ts` e al tău, dar `e9-notif` și `e9-trace` adaugă în el câte un eveniment: nu rescrie fișierul cu Write; recitește înainte de fiecare Edit.

## Teste
- Unit pe job: șterge doar `DRAFT` mai vechi decât pragul potrivit (7 / 90); nu atinge cererile publicate, nici ciornele recente; cere ștergerea fișierelor din storage; fișier împărțit cu o cerere publicată → păstrat.
- Integrare (`*.integration.spec.ts`, pe care NU îl rulezi): jobul pe date reale; republicare cu modificări `EXPIRED` → `IN_MARKETPLACE` cu datele noi; a doua încercare → `REPOST_ALREADY_USED`; numărul de editări rămâne neschimbat.
- Throttle pe crearea ciornelor.
- Frontend: butonul „Republică cu modificări”, mesajul scos.

## Fișierele tale
`apps/backend/src/modules/requests/requests.service.ts`, `requests.controller.ts`, jobul nou (procesor + înregistrare), `apps/backend/src/infra/storage/**`, scriptul nou, migrarea ta, fișierele de setări (Edit punctual), `apps/frontend/src/app/[locale]/requests/[id]/page.tsx` + modul de editare al formularului (vezi contractul). Texte: fragmentul `e9-drafts`.
