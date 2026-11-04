# Configurator 3D pentru piese individuale (stil Tylko) — plan de sprinturi

Cerinta PO (2026-07-12): la crearea unei piese individuale, clientul sa vada un
**render 3D al corpului de mobilier** pe care il modifica liber — inaltime,
latime, adancime, compartimentare — iar **modelul 3D se actualizeaza live** din
inputuri, ca in configuratorul Tylko.

Acesta e planul de executie. NIMIC de aici nu e implementat inca — sprinturile
R1–R6 se pornesc doar cu acordul tau, in ordinea de mai jos.

> **UPDATE 2026-07-12 — PO a aprobat planul; R1–R5 sunt LIVRATE** (vezi
> CHANGELOG, sprinturile R1+R2 si R3+R4+R5). Deciziile D-3D-1..4 executate pe
> propunerile de mai jos, cu doua extensii: (a) configuratorul acopera din
> prima TOATE cele 7 piese-carcasa (nu doar biblioteca+dulap — regulile per
> piesa erau oricum necesare la R5); (b) pe langa cele 4 tipuri de zona au fost
> adaugate HANGING (bara de haine, dulap) si TILT_OUT (fronturi rabatabile,
> pantofar), altfel inlocuirea lui interiorModules pierdea informatie. R6
> (compuneri, pret orientativ, AR) ramane la decizia PO, dupa feedback.

---

## 1. Cum functioneaza Tylko (ce copiem, pe scurt)

- Un **model parametric**: mobila nu e un fisier 3D desenat de cineva, ci e
  GENERATA din parametri — carcasa din panouri, coloane impartite automat,
  polite/sertare/usi per zona. Cand misti sliderul de latime, algoritmul
  recalculeaza panourile si modelul se redeseneaza instant.
- **Controale putine si directe**: slidere pentru gabarit, click pe o zona din
  model ca sa ii schimbi tipul (raft deschis / usa / sertare), paleta mica de
  culori/materiale.
- **Randare in browser** (WebGL), cu umbre soft si material mat — fara server
  de randare.

## 2. Arhitectura propusa (aliniata la stack-ul nostru)

- **Tehnologie**: `three.js` prin `@react-three/fiber` + `@react-three/drei`
  (componente React declarative peste three). Rulare exclusiv client-side
  (`next/dynamic` cu `ssr: false`); niciun asset extern — geometria e 100%
  procedurala (BoxGeometry pentru panouri), zero fisiere GLTF in MVP.
  Cost bundle: ~150–180 KB gzip, incarcat DOAR pe pasul de configurare 3D.
- **Model parametric** (`piece-model.ts`, pur, testabil): functie
  `buildPanels(config) → Panel[]` care intoarce lista de panouri (pozitie +
  dimensiuni + rol) din config: carcasa (2 laterale, sus, jos, spate), soclu,
  despartitoare verticale (coloane de max ~90cm), polite/sertare/usi per zona,
  gap de 2mm intre fronturi. Componenta 3D doar deseneaza panourile.
- **Config serializabil** (Zod in `packages/shared`):
  `{ widthM, heightM, depthM, columns: [{ zones: [{ type: OPEN|SHELVES|DRAWERS|DOOR, count? }] }], material, finish }`
  — intra in `answers` ca orice raspuns de step (invarianta 3.6: starea
  formularului in RHF/local, nimic duplicat in Zustand).
- **Step nou in engine**: tip `configurator-3d` in `questionnaire/types.ts`,
  validat identic FE/BE (limite dimensiuni, max coloane/zone). Flow-urile care
  il folosesc primesc **versiune noua** (ex. `piece-bookcase.v3.ts`) — regula
  FROZEN ramane intacta; cererile vechi raman pe v1/v2.
- **Derivare**: `deriveRoom` transforma config-ul in `request_items` existente
  (dimensiuni exacte + descriere generata: „Biblioteca 240×220×35, 4 coloane,
  2 usi jos, 12 polite”) — atelierele vad EXACT aceeasi structura de cerere ca
  azi, deci nimic nu se schimba in marketplace/oferte/scoring.
- **Snapshot la publish**: canvas-ul exporta un PNG (toDataURL) care urca prin
  fluxul presigned existent (3.4) si se ataseaza cererii — firmele vad poza
  exacta a corpului configurat, plus config-ul JSON afisat in RoomSpecCard.
- **Fallback**: fara WebGL (device vechi) → flow-ul actual v2 cu planse 2D.
  Flow-urile v2 raman functionale permanent.

## 3. Sprinturile

### R1 — Fundatia 3D (scena + carcasa parametrica)
- Dependinte: `three`, `@react-three/fiber`, `@react-three/drei` in frontend.
- `PieceCanvas` (client-only): camera cu orbita limitata (nu vezi sub podea),
  lumini soft (ambient + directional cu umbra), podea discreta, dpr limitat si
  `frameloop="demand"` pentru mobil.
- `piece-model.ts`: carcasa + soclu + spate din W/H/D; slidere de gabarit
  legate direct de model (fara re-mount, doar re-render geometrie).
- Pagina de lucru `/dev/piece-3d` (doar in dev) pentru iterat vizual.
- **Acceptanta**: misti sliderele → modelul se modifica fluid (60fps desktop,
  ≥30fps mobil mediu); typecheck/lint verzi.

### R2 — Compartimentare interactiva (inima Tylko)
- Algoritm de impartire: numar de coloane derivat din latime (max ~90cm/coloana,
  ajustabil ±1 de utilizator); fiecare coloana are 1–4 zone pe verticala.
- Interactiune: click/tap pe o zona in 3D → ciclu intre Deschis → Polite →
  Sertare → Usa (highlight la hover, contur pe zona activa); butoane +/- pentru
  polite in zona.
- Schema Zod `pieceConfig3dSchema` in shared + limite (min/max zone, coloane).
- **Acceptanta**: poti reproduce in 3D o biblioteca Tylko tipica in <1 min;
  config-ul rezultat e JSON valid contra schemei.

### R3 — Integrarea in flow-ul cererii
- Tip de step `configurator-3d` in engine (types + validare + summary entry).
- `piece-bookcase.v3.ts` si `piece-wardrobe.v3.ts`: step-ul 3D inlocuieste
  `dimensions` + `interiorModules`; raman intrebarile de material („Altul” cu
  text liber inclusiv) si upload-ul de schita.
- `deriveRoom` → `request_items` cu dimensiuni exacte + descriere generata.
- Backend: validarea config-ului la publish (aceeasi schema shared).
- **Acceptanta e2e**: creezi cerere cu biblioteca configurata 3D → publish →
  atelier o vede in marketplace cu toate datele corecte.

### R4 — Materiale, snapshot si prezentare
- Paleta de finisaje legata de materialele existente (PAL/MDF/lemn — culoare +
  rugozitate; fara texturi in MVP ca sa nu creasca bundle-ul).
- Snapshot PNG la publish prin fluxul presigned; afisat in RoomSpecCard
  (client + marketplace firma) langa chips-urile de config.
- **Acceptanta**: firma vede poza corpului + „4 coloane · 2 usi · 12 polite”.

### R5 — Restul pieselor + QA mobil
- Extindere la: comoda TV, pantofar, comoda, noptiera, birou (fiecare cu
  reguli proprii de compartimentare — ex. pantofar cu fronturi rabatabile).
- Performanta mobil (geometrie instanced la polite multe), fallback non-WebGL
  testat, tastatura/accesibilitate pe controale.
- **Acceptanta**: toate piesele ghidate au varianta 3D; QA vizual pe telefon.

### R6 — (optional, dupa feedback) Compuneri si extensii
- Dressing/hol compuse din mai multe corpuri asezate pe un perete (echivalentul
  „sirurilor” Tylko), drag intre corpuri.
- Pret orientativ live per config (are nevoie de model de pret per ml/materiale
  — vezi Decizia D-3D-3).
- Export/AR (`model-viewer` cu USDZ/GLB) — doar daca aduce valoare reala.

## 4. DECIZII NECESARE inainte de R1

| # | Decizie | Propunerea mea |
|---|---------|----------------|
| D-3D-1 | Cu ce piese pornim? | Biblioteca + dulap (cel mai aproape de Tylko, cel mai mare impact vizual). |
| D-3D-2 | 3D inlocuieste flow-ul de intrebari sau coexista? | Coexista: in flow-ul piesei, pasul de dimensiuni ofera „Configureaza in 3D” (implicit pe desktop) si varianta clasica cu campuri (fallback + preferinta utilizator). |
| D-3D-3 | Aratam pret orientativ pe config? | NU in MVP — marketplace-ul e pe oferte de la ateliere; un pret afisat de noi ancoreaza gresit negocierea. Reevaluam la R6. |
| D-3D-4 | Snapshot-ul PNG e obligatoriu la publish? | Da, automat si invizibil pentru client (o poza ajuta enorm atelierele). |

## 5. Riscuri si limitari cunoscute

- **Bundle**: three.js e mare; il incarcam doar la pasul 3D (dynamic import) si
  restul aplicatiei nu e afectat.
- **Device-uri slabe**: fallback la flow-ul clasic; detectam WebGL la mount.
- **Scopul NU e CAD**: nu promitem cote de productie la milimetru — atelierul
  ramane cel care valideaza tehnic (acelasi contract ca azi).
- **Testare**: `piece-model.ts` (generarea panourilor) e pur si primeste teste
  unitare; interactiunea 3D se testeaza vizual (QA pe device).
