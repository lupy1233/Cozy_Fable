# Verificare în browser, etapele 8–12 — reguli comune pentru toți verificatorii

Ești un verificator: te porți ca un om care folosește aplicația locală și notezi ce vezi. NU repari nimic.

## Unde ești
- Repo: `E:\Cozy Fable`, ramura `claude/reparatii-etapa-12` (ultima comitere `b4deefb`). Toate cele 12 etape de reparații sunt în cod.
- Stiva locală e DEJA pornită de coordonator: interfața (Next dev) pe `http://localhost:3000`, API-ul pe `http://localhost:3001/api/v1` (interfața îl cheamă same-origin prin `/api/v1`), Postgres + Redis + MinIO + Mailpit în Docker. Mailpit: `http://localhost:8025` (API: `http://localhost:8025/api/v1/messages`, `…/api/v1/message/<ID>`, căutare `…/api/v1/search?query=to:adresa`).
- Ce trebuia să iasă din fiecare etapă: `CHANGELOG.md` (secțiunile de sus, „Reparații după audit — etapa 8 … 12”) și rapoartele autorilor, cu secțiuni „De verificat de mână”: `…\scratchpad\reparatii\etapa-NN\rapoarte\*.md`. Citește doar ce ține de punctele tale (cu Grep, nu fișiere întregi fără motiv).
- Textele așteptate se iau din `apps/frontend/src/messages/ro.json` / `en.json` (caută cheia, nu ghici).

## Ce NU ai voie
- NU modifici nimic în repo, NU comiți, NU schimbi ramura.
- NU pornești / oprești / repornești serverele de dev; NU rulezi build, typecheck, lint, suite de teste, migrări sau seed (PC-ul are 6 fire; mai rulează și alți verificatori).
- NU atingi producția și niciun site în afară de `localhost`. Fără servicii externe (în afară de ce cheamă aplicația singură).
- NU tipărești și NU scrii nicăieri parola demo (nici în raport, nici în fișiere de ieșire, nici în capturi).
- NU te autentifici cu alte conturi decât cele date ție în fișa ta (un cont are o singură sesiune: dacă intri pe contul altui verificator, îl dai afară).

## Unelte
- Playwright din `E:\Cozy Fable\apps\frontend`, cu Edge și placa video. Modele gata făcute, de copiat în folderul TĂU și adaptat: `…\scratchpad\reparatii\verificare\vc\lib.cjs` (lansare, context cu sesiune salvată, capturi, apel API), `login.cjs` (login o dată + salvarea sesiunii), `db.cjs` (acces la baza locală, cu garda „doar localhost”), `pw.config.ts`.
- Browserul: DOAR headless Edge cu `channel: 'msedge'` și argumentele `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist --enable-webgl` (fără ele 3D-ul merge cu ~1 cadru pe secundă). Nu folosi niciodată opțiuni de randare software. Un singur browser deschis odată; închide-l după fiecare script.
- Parola conturilor demo: se citește din `E:\Cozy Fable\apps\backend\.env`, `DEMO_PASSWORD` (admin: `DEMO_ADMIN_PASSWORD` dacă există, altfel aceeași). O folosești doar în `fill()`, pe `localhost`.
- Conturi noi (când fișa îți cere): le creezi prin pagina de înregistrare, cu adrese `verif.<ID-ul tău>.<n>@example.test` și cu aceeași parolă demo citită din `.env`. Confirmarea e-mailului: legătura din Mailpit.
- Login-ul e limitat la 5 încercări pe minut pentru TOȚI verificatorii la un loc (același IP): intri o dată pe fiecare cont, salvezi sesiunea (`storageState`) și o refolosești. La 429 aștepți 70 s și reîncerci (cel mult de 3 ori).
- Baza de date: doar baza locală de lucru `marketplace` de pe `localhost` (niciodată `marketplace_test`). Citirile sunt libere. Scrieri directe doar unde fișa ta le permite sau unde altfel nu poți ajunge la scenariu (de exemplu: mutarea lui `published_at` cu 31 de minute în urmă, fiindcă planurile firmelor întârzie cererile noi; aprobarea firmei tale de test). Fiecare scriere directă se trece în raport. Nu ștergi rânduri pe care nu le-ai creat tu.
- Datele de test: unde poți pune un nume / titlu, începe-l cu `[VERIF <ID>]`.

## Capcane cunoscute
- `next dev` compilează fiecare pagină la prima deschidere (10–60 s): timeout de navigare 120 s. O navigare pierdută imediat după compilare e o instabilitate cunoscută — reîncearcă o dată înainte s-o numești defect.
- Firma A (GOLD) vede cererile noi abia după 30 de minute; alte planuri pot avea alte întârzieri.
- Local nu există cheie Google: adresa nu are sugestii; se tastează de mână.
- Dacă un server nu răspunde mai mult de 2 minute: te oprești și raportezi (nu-l repornești tu).
- Capturile de ecran pe pagini cu 3D pot dura; așteaptă scena (`canvas`) înainte.

## Ce predai
- Folderul tău: cel din fișă (scripturi, ieșiri `out-*.json`, `capturi\`).
- `raport.md` în folderul tău, scris pe parcurs (după fiecare bloc), în formatul din `…\verificare\vc\raport.md`:
  1. antet (data, ce stivă, ce conturi, ce cereri / firme de test ai creat);
  2. tabel `# | Punct | Verdict | Ce am văzut | Captură`, cu verdict TRECUT / PICAT / NEVERIFICAT (de ce) / OBSERVAȚIE;
  3. „Defecte”: pentru fiecare PICAT sau observație — pașii, ce ai văzut, ce trebuia (cu sursa: rândul din CHANGELOG / raport), captura, cât de sigur ești că e defect de produs și nu de mediu, fișierul bănuit dacă e evident (ai voie să citești codul);
  4. scrierile directe în baza locală;
  5. datele rămase în baza locală.
- Mesajul final către coordonator: scurt — câte TRECUT / PICAT / NEVERIFICAT, lista defectelor într-un rând fiecare, calea raportului.
- Timp: țintește 60–75 de minute. Ia punctele în ordinea din fișă; ce nu apuci marchezi NEVERIFICAT, cu motivul.
- La sfârșit: toate browserele tale închise; profilurile / datele temporare mari șterse (capturile rămân).

## Adăugiri
- Limitele pe minut (toți verificatorii la un loc): login 5, înregistrare 5, „am uitat parola” 3, retrimiterea confirmării 3. La 429 aștepți 70 s și reîncerci (cel mult de 3 ori); nu e defect.
- Titlul cererii: formularul nu are câmp de titlu. Dacă vrei titlul `[VERIF …]`, pune-l în corpul `POST …/publish` prin rutare Playwright (model în `…\verificare\vc\form.vc.ts`). Dacă nu iese din prima, nu pierde timp: lasă titlul dat de aplicație și notează id-ul cererii.
- Dacă o pagină rămâne pe „Se pregătește...” / schelet mai mult de 2 minute: reîncarcă o dată (blocaj cunoscut al `next dev`), apoi notează.

## Adăugiri după primul val (2026-11-14 seara)
- Local, întârzierea planului e 0: firmele văd cererile noi imediat (nu e nevoie de mutarea lui `published_at`).
- Codul are acum o comitere în plus, `7aa1a48` (reparații după primul val). Serverele au fost repornite; sesiunile salvate de alți verificatori pot fi expirate.
- Unele conturi demo nu au parola demo locală (de exemplu `trusted1.a@demo.ro`): nu le schimba; folosește doar conturile din fișa ta. Dacă un cont din fișa ta nu se autentifică, îl poți readuce la parola demo prin „Am uitat parola” + legătura din Mailpit (nu prin scriere în bază) și notezi asta.
- Sesiuni: salvează `storageState` la SFÂRȘITUL fiecărui script și refolosește-l; nu închide browserul în timp ce pagina își reîmprospătează sesiunea (jetonul rotit se pierde și contul e dat afară).
- Fișierele cu diacritice (scripturi, texte de test) se scriu cu unealta de scris fișiere, în UTF-8 — nu prin shell (ies stricate).
- Primii verificatori au pierdut mult timp când PC-ul era încărcat. Scrie raportul pe parcurs și ia punctele în ordinea din fișă; la 75 de minute încheie cu ce ai.
