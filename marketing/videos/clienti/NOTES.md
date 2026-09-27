# Video 1 — CLIENȚI · v2 · note de producție

Fișier final: `out/cozy-home-clienti-9x16.mp4` — 1080×1920, 30 fps, **90,00 s** (2700 cadre), H.264 High (CRF 17)
+ pistă AAC mută. Sursa: `clienti/index.html` (cronologie deterministă, `lib/timeline.js` + motorul de keyframe-uri
din pagină, moștenit din v1). Înlocuiește v1 (40 s, prea rapid — feedback PO 2026-09-26).

```
cd marketing/videos
node render.mjs clienti --out out/cozy-home-clienti-9x16.mp4                 # ~9 min
node render.mjs clienti --stills-only --contact 24                           # planșă de contact
node clienti/_tools/audit-motion.mjs                                         # QA viteze (vezi „Ritm”)
```

## Ce s-a schimbat față de v1

- **Fără landing / mini-configuratorul din hero.** Toate ecranele de produs sunt capturi reale din stack-ul local
  (Playwright, telefon 430×932 @2x, `ro-RO`), prezentate într-un telefon fix (ecran 924 px lățime → scară 2,149:
  textul de 14 px al aplicației ajunge la 30 px). Capturile hero/studio din v1 au fost șterse.
- **Formularul real `/ro/requests/new`** (draft anonim) + **Caietul de idei** (galerie, filtru, lightbox, colecții).
- **Ritm lent:** fiecare titlu stă ≥ 3 s înainte de prima acțiune, o acțiune = 0,6–0,9 s + pauză ≥ 1,0 s,
  tranziții 0,8 s (titlurile nu se mai suprapun: ies în [b−0,4; b], intră în [b; b+0,4]).
- Numele partenerului de test din v1 (formularul white-label) nu mai apare nicăieri — nici în clip, nici în cod.

## Scenele (timpi finali; limitele sunt în `const B` din index.html)

Limite: 0 · 3,6 · 12,2 · 18,5 · 25,5 · 34,5 · 41,5 · 48,3 · 55,3 · 60,7 · 66,5 · 73,5 · 79,5 · 85,5 · 90
(toate la ±0,5 s de PLAN). „Vizibil” = titlul complet vizibil; acțiunile au indicatorul de alamă cu 0,3 s înainte.

| # | Timp | Titlu vizibil → prima acțiune | Ce se vede |
|---|---|---|---|
| 1 | 0–3,6 | titlu din cadrul 0 | Titlul „Mobilă la comandă, fără 10 telefoane.” stă pe ivoriu; 4 bilețele + 2 notificări cad rar (cascadă 0,25 s, 0,1–2,35 s); coala de arhitect le mătură (2,2–2,75); tranziție spre telefon. |
| 2 | 3,6–12,2 | 4,0 → 7,0 | Galeria reală `/ro/inspiration` (ana) cu meniul **Culoare** deschis, panoramare lentă 4,0–6,6 · tap **Verde** 7,0 (10 idei) · tap pe pinul „Dormitor cu dulapuri albe pe tot peretele” 8,6 → lightbox cu **Idei asemănătoare** · tap **Salvează** 10,2 → „Salvează în colecția…” cu cele 4 colecții. |
| 3 | 12,2–18,5 | 12,6 → 16,0 | Pasul „Cum pornim cererea?” (panoramare 12,6–15,2 peste cardurile 2 și 3, cu „Proiectare plătită”) · tap „Știu ce vreau, dar nu am proiect” → faza 2 din 6, stepper avansat. |
| 4 | 18,5–25,5 | 18,9 → 21,9 | Coșul cererii (glisare în tranziție) · tap tab **Piese individuale** 21,9 · tap „+” **Dulap** 23,5 → coșul primește „Dulap”. |
| 5 | 25,5–34,5 | 25,9 → 28,9 | Cartonașele foto de material (PAL / MDF înfoliat / **MDF vopsit**…) · tap „i” 28,9 → cartonașul real se întoarce și se ridică (Avantaje ✓ / Dezavantaje – / „Preț mediu: 500–900 lei/ml”) · 30,65 planșa de cote (titlul 2) · 32,45 „tastare” reală 1 → 18 → 180 în „Lățime dulap”: pe schiță apare „A = 180 cm”. |
| 6 | 34,5–41,5 | 34,9 → 37,9 | „Construiește-ți dulapul în 3D” (WebGL real) · glisare pe sliderul real „Lățime” 120 → 150 → 180 cm (corpul trece la 3 coloane; rândul mono L 120 → 180) · tap pe ușă 39,6 → ușile se deschid: polițe + bară de haine. |
| 7 | 41,5–48,3 | 41,9 → 44,9 | Pasul „Ai o schiță a camerei?” cu ghidul compact „Nu ai proiect? O schiță rapidă e de ajuns” · schița pe hârtie urcă în zona de upload 44,9–45,6 · „Se încarcă...” (real) · 46,6 fișierul real `schita-dormitor.jpg 102 KB` + eticheta „verificat”. |
| 8 | 48,3–55,3 | 48,7 → 51,7 | „Estimare orientativă pe baza răspunsurilor tale: 25.000 lei – 75.000 lei.” · glisare pe slider 25.000 → 30.000 lei · tap termen **1–3 luni** 53,3. |
| 9 | 55,3–60,7 | 55,7 → 58,7 | „Verifică și publică” (partea de jos: inspirația cu cele 3 poze atașate, rândul-sumar „2 camere — Dormitor, Dulap · Cluj-Napoca”, **Publică**) · tap 58,7 → overlay-ul real „Publicăm cererea ta…”. |
| 10 | 60,7–66,5 | 61,1 → 64,1 | Cardul real din „Cererile mele” (Dormitor + Dulap — Cluj-Napoca, „În marketplace”) · cascadă 64,1–65,0: slotul 1 „Firmă verificată · ocupat”, notificarea „Cerere preluată de o firmă” + badge pe clopoțel, slotul 2 + „Preluată parțial” + „2 firme”; al treilea rămâne „liber 2/3”. |
| 11 | 66,5–73,5 | 66,9 → 69,9 | Pagina reală de oferte a Elenei: Atelier Nord (Versiunea 2, 9.800 RON ≈ 1.884,62 EUR, 35 zile, 24 luni, Descarcă PDF, Valabilă până la…) · glisare → DesignWood Studio (2.000 EUR ≈ 10.400 RON) · glisare → CasaMea Mobilier (9.200 RON). |
| 12 | 73,5–79,5 | 73,9 → 77,1 | Chatul real cu Atelier Nord („Se poate varianta fără mânere?…”) + „Ce ai vrea modificat în ofertă?” / „Cere modificare”, panoramare 73,9–76,5 până la **Acceptă oferta** · tap 77,1 → sigiliul de alamă „ACCEPTATĂ”. |
| 13 | 79,5–85,5 | 79,9 → 83,2 | „Comandă livrată” + **Confirmă livrarea** (Elena, real) · tap 83,2 → recenzia reală 5★ („Bucătăria a ieșit exact ca în randare…”, Mihai) + eticheta „Recenzie publică”. Rând secundar: „Sub 3 stele? Intervenim noi.” |
| 14 | 85,5–90 | — | Casa se desenează, COZY HOME, tagline, „Începe o cerere — gratuit”, 3 rânduri de încredere (cascadă 0,25 s, ultimul pe ecran ≥ 2,5 s); fade spre ivoriu în ultimele 0,25 s. |

Sus: stația din „Drumul cererii” (1 Cererea S2–S9 · 2 Preluarea S10 · 3 Ofertele S11–S12 · 4 Montajul S13); firul de
alamă din stânga avansează **doar în tranziții** (în pauze nu se mișcă nimic).

## Ritm — verificare

- Titlu vizibil ≥ 3,0 s înainte de prima acțiune în toate scenele 2–13 (tabelul de mai sus).
- Acțiuni 0,6–0,85 s; pauze după acțiuni 1,0–1,5 s (câteva pauze de final de scenă ajung la 1,5–1,65 s).
- Panoramări (S2, S3, S5, S12): profil trapezoidal, maximum 27 / 59 / 49 / 59 px/s; se termină cu ≥ 0,3 s înainte
  de indicatorul de tap. `_tools/audit-motion.mjs` confirmă: peste 60 px/s se mișcă doar rezultatul unei acțiuni
  (S2 7,1–7,6; glisările S11) și glisarea din tranziția S3→S4 (1,0 s).
- Titlurile și rândurile secundare stau 4–8 s; notificarea din S10 2,55 s; eticheta „Recenzie publică” 2,6 s.
  Excepție: eticheta „verificat” din S7 stă 2,1 s (un singur cuvânt, în rândul fișierului).
- Lizibilitate: titluri Marcellus 88 px (S11: 84 px, altfel nu încape „structurate, negru pe alb.”), rânduri
  secundare 44 px, UI în telefon 14 px × 2,149 = 30 px. Mai mici rămân doar textele mono de 10–12 px ale aplicației
  (etichete „FAZA 2 DIN 6”, „A = 180 cm” ≈ 26 px) — sunt așa în aplicație; spatele cartonașului din S5 e mărit ×1,15
  cât stă întors (textul lui ajunge la ~30 px).
- Zona sigură: nimic esențial deasupra y 250 (stația începe la 252) sau sub y 1600 (ultimul tap: „Publică”, y≈1555).

## Real vs. recreat

**Capturi reale** (`assets/shots/clienti/`, 43 fișiere PNG, 3,3 MB — decupate exact pe zona arătată în telefon):
- S2 `s2-a…d` + antetul anei — `/ro/inspiration` ca ana.popescu@demo.ro: meniul Culoare, filtrul Verde, lightbox,
  alegerea colecției (lightbox-ul și picker-ul la viewport 430×760, ca să încapă în fereastra telefonului).
- S3–S9 `s3-a`, `s4-*`, `s5-*`, `s6-*`, `s7-*`, `s8-*`, `s9-a/b` — wizard-ul real, draft anonim; login ioana doar
  pentru publicare. Overlay-ul „Publicăm cererea ta…” e real (cererea de publish a fost întârziată 4 s în Playwright
  ca să poată fi fotografiat; viewport 430×640).
- S5 flip: fața și spatele cartonașului sunt decupaje din captura dinainte/după tap-ul pe „i”; rotația + ridicarea
  sunt animate în pagină (imită animația reală de flip).
- S6: randări WebGL reale ale dulapului (120/2 col., 150/2, 180/3, uși deschise) + decupajul real al rândului
  „Lățime” (slider + valoare) din același pas, **andocat sub model** (în aplicație e mai jos, sub textul de ajutor).
  Conturul portocaliu al zonei selectate a fost scos doar din captură (resetând starea React a zonei, ca în v1).
- S7 `s7-a/b/c` — upload real în S3 mock al unei schițe (`_tools/paper-sketch.svg` → JPEG); „Se încarcă...” prins
  întârziind PUT-ul spre S3.
- S10 `s10-a` — „Cererile mele” (ioana) cu cererea tocmai publicată.
- S11–S13 — paginile reale ale Elenei (oferte + chat, livrare) și ale lui Mihai (recenzia 5★), fără nicio acțiune.

**Recreări** (etichete din `ro.json`, stil copiat din componente):
- S1: bilețelele, notificările și coala de arhitect (recuzită, ca în v1).
- S7: fotografia schiței care „urcă” (recuzită; același desen ca fișierul urcat real) și eticheta **„verificat”**
  (`Configurator.uploads.status.SAFE`) — clientul nu mai vede statusul SAFE în aplicație (doar „se verifică...” cât
  durează scanarea, iar mock-ul de scanare e instant), dar PLAN cere momentul.
- S10: sloturile (stilul „MomentClaim” din `process-band.tsx`: „Firmă verificată”, „ocupat”, „liber”, „2/3”),
  statusul „Preluată parțial”, „2 firme”, notificarea „Cerere preluată de o firmă” și badge-ul de pe clopoțel —
  peste cardul real (nicio firmă n-a preluat de fapt cererea; preluarea ar consuma credite din contul unei firme).
- S12: sigiliul „ACCEPTATĂ” (oferta Elenei NU a fost acceptată în aplicație — ar fi schimbat starea pentru ceilalți agenți).
- S13: eticheta „Recenzie publică” (`LandingV2.m4Review`); „Confirmă livrarea” NU a fost apăsat în aplicație.
- S14: CTA-ul (ca în v1).

## Abateri de la PLAN (și de ce)

1. **Scena 4:** PLAN zice „tap Dormitor, tap Dulap”. Fereastra telefonului (≈ 410 px CSS utili sub antet) nu poate
   arăta în același cadru coșul, tab-urile și rândul „Dormitor” (al 4-lea în listă), iar ritmul permite 2 acțiuni în
   7 s. Am filmat **tab „Piese individuale” → „+ Dulap”** (coșul se umple). Dormitorul e adăugat în captura reală
   (apare în S5/S9: „2 camere — Dormitor, Dulap”), dar tap-ul lui nu se vede.
2. **Scena 5:** ordinea din PLAN (cartonașe, apoi cote) e inversă față de wizard (cotele sunt pasul 04/09, materialul
   05/09) — am păstrat ordinea din PLAN; contorul „04/09” nu intră în cadru. Se tastează doar „Lățime dulap” (180);
   o singură acțiune de tastare încape după al doilea titlu. Spatele cartonașului real nu are titlurile
   „Avantaje/Dezavantaje” (doar ✓ / –) — e arătat exact cum e.
3. **Scena 6:** finisajul nu se mai schimbă în cadru (nu încape a treia acțiune); lățimea se schimbă prin sliderul
   real andocat sub model (vezi mai sus). Trecerea la 3 coloane e în captura de 180 cm (în aplicație e un „+” separat).
4. **Scena 7:** stările reale sunt „Se încarcă...” → rândul fișierului; „se scanează… → verificat” din PLAN e
   reprodus doar prin eticheta „verificat”. Ghidul e cel din pasul de schiță al camerei (pasul global „Adaugă poze
   sau planuri” nu are ghid).
5. **Scena 8:** estimarea reală e **25.000 – 75.000 lei** (sliderul real merge de la estimare la 3× estimare; răspunsurile
   „Dormitor (dulap 180 + noptiere) + Dulap 3D” dau 25.000), nu 8.500 – 12.000 din PLAN. Adresa (fără cheie Google
   Maps local → inputuri simple, fără autocompletare) și inspirația nu încap în scenă: adresa e completată în captură
   (Cluj-Napoca apare în S9/S10), iar inspirația atașată apare în S9 — de aceea rândul „ideile salvate merg cu
   cererea” e mutat din S8 în S9.
6. **Scena 9:** se vede partea de jos a „Verifică și publică” (inspirație + sumar + Publică); nodurile salvie ale
   „firului de semnătură” sunt mai sus în pagină și nu încap împreună cu butonul.
7. **Scena 11:** „glisarea” între firme e o glisare scurtă (100 px) + înlocuirea conținutului, nu un scroll de
   ~2.000 px prin pagină (ar fi fost un vârtej de text).
8. **Scena 12:** „Cere modificare → Versiunea 2” e arătată prin conversația reală (clienta cere varianta fără mânere)
   și câmpul „Ce ai vrea modificat în ofertă?” / „Cere modificare”; „celelalte conversații — doar pentru citire” nu
   mai încape (o singură acțiune în 6 s).
9. **Scena 13:** livrarea confirmată (Elena, dulap Timișoara) și recenzia (Mihai, bucătărie Cluj) sunt două cereri
   diferite — confirmarea reală ar fi schimbat starea demo; stelele nu „se umplu” (recenzia reală are deja 5★ și
   formularul real pornește oricum cu 5 stele selectate).
10. **Titlul S11** e la 84 px (restul 88 px), altfel „structurate, negru pe alb.” nu încape pe lățime.
11. **Cifre în titluri** („10”, „3D”, „3”) în DM Sans, ca în v1 (în Marcellus „10” se citește „IO”). Stația „1” rămâne
    în Marcellus (arată ca „I” roman — consecvent cu ghidul de schiță al aplicației).

## Conturi, rute și modificări în DB-ul local

- `ana.popescu@demo.ro` — `/ro/inspiration`. Pinul „Dormitor cu dulapuri albe pe tot peretele” e scos temporar din
  colecția „Dormitor matrimonial” (prin API-ul aplicației) și **salvat la loc în aceeași colecție** chiar în captură
  (starea finală = cea inițială, doar `created_at` al rândului e nou).
- Vizitator — `/ro/requests/new`: 5 ciorne anonime noi din rulările de explorare/captură (DRAFT, fără client;
  dispar la `reset-db.sh`).
- `ioana.marinescu@demo.ro` — 1 login prin formular, **o cerere publicată**: „Dormitor + Dulap — Cluj-Napoca”,
  id `989e0761-25d7-485a-a253-39f390688f82`, IN_MARKETPLACE, adresă „Str. Observatorului 34, ap. 7, Cluj-Napoca, Cluj”,
  contact suplimentar fictiv `ioana.m@example.com` (nu apare în cadru). Conform DEMO-ENV (oraș Cluj-Napoca).
- `elena.dumitru@demo.ro` — doar citire: `/ro/requests/1d02bcae-ce2d-4ce6-9793-40f2652b146c/offers`,
  `/ro/requests/c95f9758-bf1c-45e8-af43-6969793c4c44/offers`.
- `mihai.ionescu@demo.ro` — doar citire: `/ro/requests/5dcd35ab-79e9-4455-859f-5bbea0ff1981/offers`.
- Niciun e-mail `@demo.ro` nu apare în cadre (antetele și ferestrele alese nu conțin date de contact).

## Unelte (`clienti/_tools/`)

- `cap-inspiration.mjs` (S2), `cap-wizard.mjs` (S3–S10; `PHASE=0..4`, profil de browser persistent în `PROFILE`,
  `SKETCH=` fișierul de urcat), `cap-requests.mjs` (S11–S13), `cap-lib.mjs` (comun), `make-sketch.mjs` +
  `paper-sketch.svg` (schița urcată). Capturile brute (@2x, ~12 MB) merg în `RAW` (implicit `<tmp>/cozy-clienti-raw`,
  în afara repo-ului); `prep-v2.py` le decupează în `assets/shots/clienti/` și scrie `shots-manifest.json`;
  `inline-manifest.py` copiază manifestul în `index.html`.
- Ordine: `node _tools/cap-inspiration.mjs` · `PHASE=0 PROFILE=/tmp/p0 node _tools/cap-wizard.mjs` ·
  `PHASE=1..4 PROFILE=/tmp/p1 SKETCH=… node _tools/cap-wizard.mjs` (4 = publică!) · `node _tools/cap-requests.mjs` ·
  `python3 _tools/prep-v2.py && python3 _tools/inline-manifest.py` (toate din `marketing/videos`).
- QA: `audit-motion.mjs` (viteze), `measure.mjs` (lățimi de text), `sheet.sh` (stills alăturate), `strip.sh`
  (cadre din MP4), `rawsheet.py` (planșe din capturile brute), `explore*.mjs` (explorare interactivă).

## Decizii necesare / întrebări deschise

1. **DECIZIE NECESARĂ — domeniul la CTA:** `const SITE_URL = ''` (prima linie din script). Gol = doar wordmark.
2. **Estimarea din S8** (25.000 – 75.000 lei) e cea reală pentru răspunsurile filmate; dacă PO vrea un interval mai
   mic în clip, se refilmează cu mai puține piese (de ex. doar „Dulap”) — scriptul e reproductibil.
3. **Eticheta „verificat”** (S7) nu mai există în UI-ul clientului; dacă nu e dorită, se scoate (`#verif`).
4. **Cererea publicată de ioana** (`989e0761-…`) rămâne în DB până la următorul `./reset-db.sh`.
