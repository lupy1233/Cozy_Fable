# Aliniere si coliziuni intre camere — 2026-09-16

## Obiectiv si impact

Camerele din planul casei se aliniaza cand ajung la maximum 12 cm de un perete vecin, cu aliniere suplimentara la colturi sau centru. Punctele verzi indica alinierea. O propunere care ar suprapune camerele pastreaza ultima pozitie libera. Coordonatele, rotirea si schimbarea dimensiunilor folosesc aceeasi protectie.

Module: geometrie shared, store/persistenta Studio, editorul casei si pagina Studio. Tabele: niciuna. Fara migrari, endpoint-uri, DTO-uri, realtime, autentificare, audit sau reguli de ofertare noi.

Presupuneri: camere dreptunghiulare cu rotatii de 90 grade, conform schemei existente; acelasi nivel existent al casei. Dimensiunile sunt interioare; alinierea respecta peretele comun de 9 cm si toleranta istorica de 6 mm. Preferinta Full walls / Cutaway apartine browserului si nu schimba proiectul salvat, cererea trimisa sau istoricul undo. Camerele vechi nu sunt rearanjate automat.

## Fisiere

- `packages/shared/src/house-room-placement.ts`, `house-room-placement.test.ts`, `studio-house.ts`, `index.ts`: rezolvare determinista, validare comuna si exporturi.
- `apps/frontend/src/stores/studio-store.ts`, `studio-persistence.ts`, `house-placement.test.ts`: mutatii atomice, istoric si preferinta persistata.
- `apps/frontend/src/components/studio/house-editor.tsx`, `studio-page.tsx`: preview, puncte, mesaje de coliziune, anulare gest, focus si selector de pereti.
- `apps/frontend/src/messages/en.json`, `ro.json`: instructiuni si feedback localizat.
- `apps/frontend/e2e/house-placement.spec.ts`, `playwright.green-ui.config.ts`: verificare desktop/mobile locala si pe Green.

## Acceptare si teste

- [x] 279 teste shared trecute, inclusiv 19 cazuri noi pentru laturi, colturi, rotatii, ordinea vecinilor, obstacole multiple si toleranta.
- [x] 184 teste frontend trecute; 12 cazuri noi pentru store, istoric si persistenta. Compatibilitatea proiectelor existente si coliziunile mobilierului raman verzi.
- [x] Build shared, typecheck frontend si lint frontend trecute.
- [x] Browser desktop/mobile: 6 cazuri trecute. Coordonate, rotire si dimensiuni refuzate fara stergerea redo; preview aliniat, commit exact, un undo, anulare repetata; ambele preferinte dupa reload si intre canvasuri. Cele doua cazuri drag au fost extinse si reverificate cu suprapunere directa, feedback vizibil si pastrarea ultimei pozitii libere.
- [x] Deploy Green si health dupa pornirea procesului; toate cele 6 probe browser trec pe release-ul publicat. Inca 4 regresii Studio pentru panouri, anulare, fullscreen, canvas si reload trec desktop/mobile.
- [x] Blue si upstream-ul gateway reverificate dupa deploy: neschimbate.

Plan manual: in Studio creeaza doua camere, intra in Casa / Plan etaj, trage una spre cealalta si verifica punctele verzi; incearca sa o asezi peste vecina. Anuleaza un drag si verifica redo. Deschide uneltele casei, incearca coordonate, rotire si dimensiuni care ar crea suprapunere. Comuta Full walls / Cutaway, reincarca pagina si alterneaza camera/casa 3D.

Dovezi locale: `apps/frontend/test-results/house-placement-final/` si `house-placement-drag-final/` contin capturi pentru focus, aliniere si incercarea de suprapunere. Screenshot-urile desktop/mobile au fost inspectate vizual; mesajul mobil este deasupra barei de unelte. Touch foloseste evenimente native Chromium prin CDP; nu reprezinta o proba pe telefon fizic. Probele browser folosesc proiecte izolate in localStorage si API mock, fara creare de date reale sau actiuni in contul utilizatorului.

## Security close

- PASS: endpoint-uri, autorizare, idempotenta, ownership si audit — nu sunt introduse sau schimbate de acest sprint.
- PASS: upload-uri, cookies si CORS — neschimbate.
- PASS: niciun secret introdus; localStorage salveaza doar o preferinta vizuala booleana, normalizata la citire.
- PASS: coordonatele si rotatiile sunt validate in store; geometria foloseste aceeasi regula de suprapunere ca validarea proiectului. Erorile afisate sunt mesaje RO/EN, fara date interne.

DECIZIE NECESARA: niciuna. Nu s-a facut commit sau push. Dupa selectarea explicita a fisierelor acestui sprint din workspace-ul cu alte modificari, checkpoint propus: `git commit -m "feat(studio): snap rooms and persist wall visibility"`.

## Release Green

Deployment `0ae113f8-5860-4854-8a2c-958c3af4ecbd`, imagine `sha256:9d9d4321ad34dc362622434dd7143da3d54759902b50066275de194e09ab0831`, status Railway SUCCESS. Build-ul de productie si pornirea backendului au trecut; health raporteaza DB, Redis si storage disponibile. Toate cele 10 probe browser trec pe noul release (6 pentru acest sprint + 4 regresii Studio).

Dovezi Green: `apps/frontend/test-results/green-house-placement/` contine capturile desktop/mobile inspectate pentru focus, aliniere si suprapunere blocata. Raportul existentelor probe Studio este in `apps/frontend/test-results/green-studio/`. Comenzi: `pnpm -F frontend exec playwright test --config playwright.green-ui.config.ts house-placement.spec.ts --output test-results/green-house-placement`; pentru celelalte 4 cazuri, `GREEN_STUDIO_AUDIT=1` cu `playwright.config.ts`, `studio.spec.ts` si `studio-panels.spec.ts`.

Blue ramane pe deployment `720549d5-233d-4917-8d85-dc356db0aead`; upstream-ul public ramane `backend.railway.internal:3000`.
