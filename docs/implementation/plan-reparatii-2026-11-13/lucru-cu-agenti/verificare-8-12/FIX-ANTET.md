# Reparație: antetul firmei la 1280 px — pastila „CREDITE” acoperă „Firma mea”

Ești un agent de cod pentru aplicația „Marketplace Mobilier” (repo `E:\Cozy Fable`, ramura `claude/reparatii-etapa-12`). Ai de reparat UN defect de așezare și de dovedit în browser că e reparat. Regulile de lucru ale repo-ului: `E:\Cozy Fable\CLAUDE.md` și `E:\Cozy Fable\apps\frontend\CLAUDE.md`.

## Defectul (găsit la verificarea în browser, raport `…\scratchpad\reparatii\verificare-8-12\v11b\raport.md`, D2; captură `…\v11b\capturi\p5b-antet-Andreea.png`)
- Cont de firmă, ecran lat de 1280 px (și mai lat: conținutul antetului are lățime fixă, `max-w-6xl`): meniul firmei are 6 legături (Panou, Cereri disponibile, Preluări, Mesaje, Portofel, Firma mea), iar în dreapta stau pastila „CREDITE 10”, comutatorul de limbă, clopoțelul și butonul contului (nume + firmă). Cu un nume obișnuit („Andreea Popescu” / „Mobila Unicat SRL”) pastila „CREDITE” acoperă 26 px din „Firma mea”; cu nume mai lungi, până la 70 px. Doar cu nume foarte scurte încape.
- Fișiere: `apps/frontend/src/app/[locale]/_components/app-header.tsx` (grupul din stânga are `min-w-0`, legăturile au `whitespace-nowrap`, deci meniul iese pe sub grupul din dreapta), `apps/frontend/src/app/[locale]/_components/account-menu.tsx` (numele și firma au `max-w-[9.5rem] truncate`, vizibile de la `xl`).

## Ce trebuie să iasă
- La 1280, 1366, 1440 și 1920 px, RO și EN, cont de firmă: nicio legătură din meniu acoperită sau tăiată, cu nume scurte și cu nume lungi (`Alexandra Constantinescu` / `Atelierul de Mobilă Pop SRL` — atenție: „atelier” apare aici doar ca nume de firmă de test, nu ca text al aplicației). Între ultima legătură și pastilă rămâne loc liber (≥ 8 px).
- La 1024–1279 px (unde numele contului e ascuns) și pe telefon antetul rămâne cum e acum: nimic acoperit, meniul „hamburger” sub `lg` neschimbat.
- Antetul clientului și al adminului nu se strică (au alte legături; clientul are butonul „Cerere nouă”). Verifică-le și pe ele la 1280 px.
- Schimbarea e cât mai mică și doar de așezare (clase Tailwind): de exemplu legături puțin mai strânse la `xl`, text mai scurt / limită mai mică la numele contului, eticheta „CREDITE” ascunsă când nu e loc (pastila rămâne cu iconița și numărul). NU schimba lățimea conținutului paginii, NU scoate elemente, NU schimba textele. Alege varianta care păstrează cel mai mult din ce se vede acum.
- Dacă există teste pentru antet / meniul contului (`account-menu.test.tsx` ș.a.), le aduci la zi; adaugă un test doar dacă are sens (așezarea în pixeli nu se poate testa în jsdom).

## Cum verifici (obligatoriu, în browser)
- Stiva locală e DEJA pornită de coordonator: interfața `http://localhost:3000`, API `http://localhost:3001/api/v1`. NU porni / opri servere, NU rula build.
- Playwright din `apps/frontend`, DOAR headless Edge: `channel: 'msedge'`, argumente `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist --enable-webgl`. Modele de scripturi (lansare, login cu sesiune salvată): `…\scratchpad\reparatii\verificare\vc\lib.cjs`, `login.cjs`. Scripturile și capturile tale: `…\scratchpad\reparatii\verificare-8-12\fix-antet\`.
- Conturi: firma — `verif.v11b.owner@example.test` (firma „[VERIF V11B] Firma Test”, aprobată) sau `verif.v11.owner@example.test`; client — `verif.v11.client@example.test`; admin — `admin@demo.ro`. Parola: `DEMO_PASSWORD` din `apps/backend/.env` (admin: `DEMO_ADMIN_PASSWORD` dacă există); nu o tipări și nu o scrie nicăieri. Login-ul e limitat la 5 pe minut: intri o dată pe cont și salvezi sesiunea.
- Numele se pot schimba doar în pagina deschisă (înlocuiește textul în DOM, cum a făcut V11B — fără scrieri în bază). Măsoară cu `getBoundingClientRect()` marginea dreaptă a ultimei legături din meniu față de marginea stângă a primului element din grupul din dreapta, pentru fiecare lățime × limbă × nume (scurt, mediu, lung). Fă capturi înainte și după.
- După reparație rulează DOAR: `pnpm -F frontend exec vitest run "src/app/[locale]/_components/account-menu.test.tsx"` (și alte teste ale fișierelor atinse), apoi `pnpm -F frontend exec eslint "src/app/[locale]/_components/app-header.tsx" "src/app/[locale]/_components/account-menu.tsx"`. Nu rula suitele întregi, typecheck-ul sau build-ul (le rulează coordonatorul).

## Ce NU faci
- Nu comiți, nu schimbi ramura, nu atingi alte fișiere decât cele două (și testele lor). Nu atingi `ro.json` / `en.json`.
- Nicio scriere în baza de date.

## Ce predai
Mesaj scurt, în română: ce ai schimbat (clasele, pe scurt), tabelul măsurătorilor înainte / după (lățime × nume → loc liber în px), testele rulate, capturile (cale). Dacă nu găsești o variantă curată care să încapă cu nume lungi, spune ce compromis ai ales și ce ar mai fi de hotărât.
