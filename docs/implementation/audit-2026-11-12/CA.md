# Raport CA — fluxurile KITCHEN v3, DRESSING v3, LIVING v3, BEDROOM v2 (audit din cod)

Metoda: doar citire de cod (fara aplicatie, fara site). Surse verificate: `packages/shared/src/questionnaire/flows/{kitchen.v3,kitchen.v2,dressing.v3,living.v3,bedroom.v2,common,per-piece}.ts`, `engine.ts`, `mapping.ts`, `types.ts`; frontend `step-renderer.tsx`, `room-screens.ts`, `dimension-figures.tsx`, `room-spec-card.tsx`, `details-step.tsx`; texte `apps/frontend/src/messages/ro.json` / `en.json`; ponderi de scor `apps/backend/prisma/seed.ts`. Inventarul `flows-dump.md` a fost folosit ca reper si comparat cu celelalte 24 de fluxuri.

## 1. Ce am acoperit

| Flux | Pasi (step-uri) | Ecrane (min–max) | Ce am verificat | Ce NU am acoperit |
|---|---|---|---|---|
| KITCHEN v3 | 16 (refoloseste pasii din v2) | 6 (forma+insula · dimensiuni · fronturi · blat · electrocasnice · schita) | toate conditiile, sloturile pe 3 forme × cu/fara insula, deriveRoom, scor, rezumat, texte RO/EN | randarea vizuala (nu am rulat aplicatia) |
| DRESSING v3 | 7 | 6 | conditiile, sloturile pe 4 forme, deriveRoom, scor, rezumat, texte | idem |
| LIVING v3 | 24 | 4–17 (2 ecrane pe piesa) | conditiile, sloturile pe fiecare piesa, LED per corp, deriveRoom, scor, texte | idem |
| BEDROOM v2 | 27 | 4–20 | conditiile, sloturile, salteaua custom, deriveRoom, scor, texte | idem |

Numarul de ecrane vine din `room-screens.ts:31-42` (pasii vizibili consecutivi cu acelasi `screenGroup` = un ecran; restul = cate un ecran). Exemple: Living cu toate cele 6 piese = 1 piese + 1 stil TV + 1 dimensiuni + 12 (material + deschidere pe piesa) + 1 LED + 1 schita = 17; Dormitor cu toate piesele = 20.

## 2. Constatari

### CA-01 · P1 · defect / inconsecventa · BEDROOM v2 — `wardrobeDoorType` nu e folosit nicaieri si contrazice `systemsWardrobe`
- **Unde:** `bedroom.v2.ts:101-122` (intrebarea), `bedroom.v2.ts:220-262` (deriveRoom), `per-piece.ts:47-56` (systemsWardrobe).
- **Ce se intampla:** clientul alege „Ce uși are dulapul?” (Glisante / Batante), apoi, pe un ecran separat, „Deschidere — dulap” (Mâner / Push / Glisante, obligatoriu, min. 1). deriveRoom nu citeste deloc `wardrobeDoorType`; doar `systemsWardrobe` ajunge in item si in scor. Clientul poate raspunde „Batante” si apoi „Glisante”; firma vede pe fisa (`room-spec-card.tsx:166-178` chip „Ce uși are dulapul?: Batante” + `:200-201` badge „Glisante” pe item) doua raspunsuri contradictorii. Daca alege „Glisante” la usi dar „Mâner” la deschidere, scorul ia MANER (1 punct) in loc de GLISANTE (3 puncte, `seed.ts:49-53`).
- **Ce ar trebui:** o singura intrebare despre usi. Comparatie: DRESSING v3 mapeaza `doorType` SLIDING → sistem GLISANTE (`dressing.v3.ts:52-56`); PIECE_WARDROBE are `doorType` ascuns.
- **Propunere:** la dulapul din dormitor, deschiderea sa ofere doar Mâner / Push (fara Glisante) si `wardrobeDoorType = SLIDING` sa adauge GLISANTE in `systems`, ca la dressing.

### CA-02 · P1 · UX / defect de date · LIVING v3 + BEDROOM v2 — „Deschidere” obligatorie si pentru piese fara usi sau sertare
- **Unde:** `per-piece.ts:47-56` (`minSelected: 1`, fara `optional`), deci `systemsCoffeeTable`, `systemsShelves`, `systemsBookshelf`, `systemsOtherPiece` (Living), `systemsBed` (Dormitor, inclusiv cand `bedStorage = NONE`).
- **Ce se intampla:** subtitlul spune „Pentru ușile și sertarele acestei piese — poți alege mai multe.” (`common.pieceSystems.subtitle`), dar pasul e obligatoriu si pentru rafturi suspendate (descrise chiar in aplicatie ca „Montate pe perete, fără corp jos”), masuta de cafea sau un pat fara depozitare. Optiunile sunt doar Mâner / Push / Glisante, fara „Fără uși / nu e cazul / decide firma”. Clientul e obligat sa dea un raspuns fals. Raspunsul intra in scor (`engine.ts:365-369`, SYSTEM = max dintre sisteme, 1–3 puncte) si apare pe fisa firmei ca badge pe item. Asa, costul in credite creste pentru o piesa care nu are nimic de deschis.
- **Comparatie:** PIECE_TV_UNIT `openingSystems` e **optional** (dump, linia 2034); in kitchen, deschiderea are sens pentru ca exista mereu fronturi.
- **Propunere:** pasul de deschidere sa fie optional (sau sa lipseasca) pentru WALL_SHELVES / COFFEE_TABLE / BOOKSHELF deschisa, iar pentru pat sa apara doar cu `bedStorage ≠ NONE`; plus o optiune „Nu știu — decide firma”.

### CA-03 · P1 · defect / cost · KITCHEN v3 — corpurile suspendate nu se pot exclude
- **Unde:** `kitchen.v3.ts:70` (`openingSystemsWall` fara `visibleIf`, obligatoriu), `kitchen.v3.ts:98-113` (itemul „Corpuri suspendate” e mereu creat).
- **Ce se intampla:** orice bucatarie primeste un item „Corpuri suspendate” cu material + sistem de deschidere, chiar daca clientul nu vrea corpuri sus (geam, nisa, open-space). Pe fisa firmei apare un corp pe care clientul nu l-a cerut. In scor, ITEM_QUANTITY e mereu QTY_2_3 (+2), iar MATERIAL si SYSTEM se adauga pentru un item inexistent (`engine.ts:362-369`). Clientul nu are cum sa spuna „fără corpuri suspendate”.
- **Ce ar trebui / Propunere:** o bifa sau un card „Fără corpuri suspendate” pe ecranul formei (sau o intrebare „Ce zone de corpuri?”). Cand e bifata, ascunde `openingSystemsWall` / `frontMaterialWall` si nu crea itemul. In i18n exista inca `cabinetZones` (ro.json:4281-4302) cu BASE / WALL / TALL / ISLAND, eliminat in v2, si o varianta noua s-ar putea inspira din el. Coloanele inalte lipsesc si ele, desi infobox-ul formei liniare spune ca „coloanele înalte devin aproape obligatorii” (ro.json:4210).

### CA-04 · P1 · text / defect · toate cele 4 fluxuri — fisa publicata arata nume si descrieri brute, fara diacritice si netraduse; la dressing apar coduri interne
- **Unde:** `room-spec-card.tsx:195-206` afiseaza `it.name` si `it.description` exact cum le scrie deriveRoom. Pagini: `requests/[id]`, `marketplace/[id]`, `marketplace/claims/[claimSlotId]`.
- **Ce se intampla:**
  - DRESSING: `dressing.v3.ts:166-167` scrie `Interior: HANGING_RODS, SHELVES, SHOE_RACK` — coduri de enum vazute de firma si de client. Aceleasi module apar o data, traduse, in chip-ul „Ce module interioare?”, si inca o data, ca text brut, in descrierea itemului.
  - Nume fara diacritice: „Corpuri baza”, „Insula bucatarie” (kitchen.v3.ts:100,116), „Comoda TV suspendata”, „Masuta cafea”, „Biblioteca”, „Vitrina” (living.v3.ts:28-34,105-109), „Comoda”, „Masuta toaleta”, „Pat tapitat” (bedroom.v2.ts:33-38,237); descrieri „saltea 160x200, lada rabatabila”, „iluminare LED”, „Cu iluminare LED”.
  - Pe interfata EN, toate acestea raman in romana.
- **Contra:** sumarul din formular (review) e tradus, fiindca foloseste `summarizeAnswers`.
- **Propunere:** itemii sa poarte chei (ex. `itemKey: 'KITCHEN_BASE'`, `details: [{key, params}]`), iar UI-ul sa le traduca. Minim: diacritice si etichetele modulelor in loc de coduri.

### CA-05 · P2 · defect text · KITCHEN v3 — `countertop` spune „Opțional” dar e obligatoriu
- **Unde:** `kitchen.v2.ts:184-202` (fara `optional`), ro.json:4341 „Opțional — ajută firma să estimeze mai exact.”, en.json „Optional — helps the company estimate more accurately.”
- **Ce se intampla:** clientul citeste ca poate sari, apasa Continua si primeste `validation.answerRequired` (`room-screens.ts:18-20`). Nu exista nici „Nu știu / decide firma”, nici „Altul” (lipsesc lemn masiv, compact, ceramica, inox; cheia `WOOD` exista inca in ro.json:4408 si in seed:80, dar optiunea nu mai e oferita).
- **Propunere:** fie `optional: true` (ponderea in scor e oricum 0, seed.ts:76-83), fie scos „Opțional” din text si adaugat „Nu m-am decis — vreau recomandarea firmei”.

### CA-06 · P2 · UX · BEDROOM v2 (si LIVING) — dimensiuni obligatorii fara rost sau greu de stiut
- **Unde:** `bedroom.v2.ts:62-74`, `living.v3.ts:63-102`, `engine.ts:93-104` (fiecare slot vizibil e obligatoriu: `z.object(shape)` fara `.optional()`), `dimension-figures.tsx:1001` (`rowFigure` intoarce null fara sloturi de latime).
- **Ce se intampla:**
  - Dormitor doar cu „Cadru pat”: ecranul Dimensiuni are un singur camp, „Înălțime tavan”, obligatoriu, fara plansa. Inaltimea tavanului nu ajuta deloc la un pat. Subtitlul „Spațiul disponibil și înălțimea camerei.” nu se potriveste.
  - Living cu toate piesele: 13 campuri obligatorii (latime + inaltime pentru fiecare piesa + tavan). Unele sunt greu de stiut pentru un client obisnuit: „Înălțime măsuță” 0,25–0,6 m, „Înălțime rafturi” 0,2–2,5 m. Nu exista „nu știu / standard”.
- **Propunere:** sloturile de inaltime pe piesa sa fie optionale, cu valoare tipica sugerata; tavanul sa apara doar cand exista piese inalte (dulap, biblioteca, vitrina).

### CA-07 · P2 · inconsecventa / scor · DRESSING v3 — usile batante si „fără uși” sunt identice in date si scor; manerul nu se intreaba
- **Unde:** `dressing.v3.ts:52-56` (`HINGED: []`, `OPEN: []`), `dressing.v3.ts:181`.
- **Ce se intampla:** cu usi batante, itemul nu are niciun sistem: firma nu afla daca se vrea maner sau push, iar scorul e egal cu varianta fara usi (infobox-ul spune „+300–900 lei” pentru batante, ro.json:4554). Dormitorul cere pentru dulap Mâner / Push / Glisante; dressingul nu cere deloc.
- **Propunere:** pentru HINGED, o intrebare scurta Mâner / Push (sau maparea HINGED → MANER implicit).

### CA-08 · P2 · text · DRESSING v3 — subtitlul materialului contrazice optiunile
- **Unde:** `dressing.v3.ts:140-147`, ro.json:4646 „Materialul modulelor interioare.”, en „The material of the interior modules.”
- **Ce se intampla:** optiunile sunt materiale de front (MDF înfoliat = „Folie PVC pe fronturi frezate”, MDF vopsit = „Orice culoare RAL”), iar materialul ales devine materialul intregului item „Dressing” (si al usilor). Clientul care alege usi glisante nu stie daca alege materialul usilor sau al interiorului.
- **Propunere:** subtitlu „Materialul principal (corp și uși)”, ca la PIECE_WARDROBE („Alege materialul principal…”).

### CA-09 · P2 · UX · KITCHEN v3 — ecranul „Fronturi” e foarte incarcat; textele raman „pentru toată bucătăria” si dupa bifa
- **Unde:** `kitchen.v3.ts:55-71` (toti pasii au `screenGroup: 'fronts'`), ro.json:4455-4464.
- **Ce se intampla:**
  - Cu insula si bifa „materiale diferite”, un singur ecran are 3 grile de material (18 carduri), 3 grile de deschidere (10 carduri), pana la 3 campuri text si o bifa.
  - Dupa bifa, prima intrebare ramane „Ce material vrei pentru fronturi?” cu subtitlul „Îl folosim la toată bucătăria”, desi acum se refera doar la corpurile de jos.
  - Eticheta bifei pomeneste insula („…corpurile de jos, de sus și insulă”) si cand nu exista insula.
- **Propunere:** dupa bifa, titlul sa devina „…corpurile de jos”; eticheta bifei sa se schimbe dupa `hasIsland`; deschiderile pe un ecran separat (cum era in v2).

### CA-10 · P2 · lipsa · KITCHEN v3 — electrocasnicele nu acopera chiuveta si nu intra nicaieri in date
- **Unde:** `kitchen.v2.ts:203-217`.
- **Ce se intampla:** lista: Cuptor, Plită, Hotă, Mașină de spălat vase, Frigider, Cuptor cu microunde. Lipsesc chiuveta / cuva (decupaj in blat, corp sub chiuveta), masina de spalat rufe si distinctia frigider incorporabil / independent. Fara „Altul”. Raspunsul apare doar in chip-uri, nu in itemi si nu in scor, desi subtitlul promite ca „firmele pregătesc decupajele și nișele pe modelele tale” — nu exista niciun camp pentru model.
- **Propunere:** adauga Chiuvetă (cu tip: inox / granit / sub blat) si „Frigider incorporabil / independent”; optional, un camp text „modele / dimensiuni electrocasnice”.

### CA-11 · P2 · scor · toate 4 — „am proiect propriu” sare peste dimensiuni, deci camera intra in scor ca „sub 2 m”
- **Unde:** `room-screens.ts:53-63` (dimensiunile sunt sarite cu proiect propriu), `engine.ts:141-168` (devin optionale), `mapping.ts:38-44` + `engine.ts:360` (lengthM = 0 → `UNDER_2M`, 1 punct fata de 5 la OVER_4M).
- **Ce se intampla:** o bucatarie in U de 8 m, cu proiect tehnic incarcat, costa firmele mai putine credite decat aceeasi bucatarie descrisa prin formular. Exceptie partiala: la dormitor, latimea patului se adauga oricum (`bedroom.v2.ts:250-257`).
- **De verificat:** daca PO a acceptat explicit efectul asupra costului (decizia 2026-07-31 vorbeste doar de obligativitate).

### CA-12 · P2 · lipsa „nu știu” · toate 4 — intrebari obligatorii fara iesire
- **Unde:** dump: `layout` (K, D), `doorType` (D), `interiorModules` (D, min 1), `countertop` (K), `openingSystems*` (K), `tvStyle` (L), `wardrobeDoorType`, `bedStorage`, `bedUpholstered`, `nightstandsCount` (B), toate `material*` si `systems*`.
- **Ce se intampla:** niciuna nu are „Nu știu / vreau recomandarea firmei”. In alte fluxuri exista: PIECE_TV_UNIT `tvSetup` are `UNDECIDED` „Nu m-am decis” (dump, linia 2010).
- **Propunere:** optiune comuna „Decide firma” pentru material, deschidere si blat (cu pondere medie in scor), cel putin pentru clientii care au ales „am nevoie de ajutor”.

### CA-13 · P2 · lipsa · BEDROOM v2 — patul tapitat pastreaza intrebarile de pal / MDF; lipsesc dimensiuni de baza
- **Unde:** `bedroom.v2.ts:181-192, 236-238`.
- **Ce se intampla:** `bedUpholstered = Da` schimba doar numele itemului in „Pat tapitat”. Urmeaza tot „Material — pat” cu PAL / MDF / lemn si „Deschidere — pat” obligatorie (vezi CA-02). Nu se intreaba stofa / piele ecologica (infobox-ul spune ca „țesătura exactă o alegi împreună cu firma”, ok) si nici inaltimea tabliei. La dulap nu se cer inaltimea si adancimea (doar latimea), desi „până în tavan” a fost scos (11.1) si tavanul se cere separat. Pentru dressing, in schimb, se cere `wardrobeHeight`.
- **Propunere:** pentru pat tapitat, material = „structura (ascunsă)” sau sarit; la dulap, slot de inaltime ca la dressing.

### CA-14 · P3 · text · LIVING v3 — subtitlul schitei vorbeste mereu de televizor
- **Unde:** ro.json:5075 „Opțional — peretele cu televizorul, cu dimensiuni și prize marcate.” (en: „the TV wall…”), pas `sketch`, mereu vizibil.
- **Ce se intampla:** apare si cand clientul a ales doar biblioteca sau masuta. Dormitorul are aceeasi problema: „cu poziția patului și a dulapului” (ro.json:4902), indiferent de piese.
- **Propunere:** subtitlu neutru („peretele / zona cu mobilierul, dimensiuni și prize marcate”).

### CA-15 · P3 · text · LIVING v3 — aceeasi piesa are trei nume
- **Unde:** piesa „Comodă TV” (piecesNeeded), „Material — zonă TV”, „Deschidere — zonă TV”, slot „Lățime zonă TV” (ro.json:4949, 5020-5023); EN: „TV unit” / „TV area”. Biblioteca: EN „Bookshelf” la piese, dar „Material — bookcase”, „Bookcase width”.
- **Propunere:** un singur termen pe piesa, in RO si in EN (dormitorul spune corect „Material — comodă TV”, ro.json:4889).

### CA-16 · P3 · inconsecventa · dimensiuni — limite si reguli diferite pentru acelasi lucru
- Latura B / C la bucatarie si dressing: min 1 m (`kitchen.v2.ts:60`, `dressing.v3.ts:31`). Un retur de L de 0,6–0,9 m (corp de colt) nu se poate introduce.
- WALK_IN = doar 2 laturi (A, B) (`dressing.v3.ts:18`, `dimension-figures.tsx:945`), desi o camera walk-in are de obicei 3 pereti, iar in scor walk-in = U (3 puncte, seed.ts:69-70). Formularul cere mai putine dimensiuni pentru cazul cel mai mare.
- Comoda TV: latime 1–5 m in living, 0,8–4 m in dormitor (`living.v3.ts:65`, `bedroom.v2.ts:55`).
- Masuta de cafea: lungimea ei intra in „metri liniari de mobilier” (`living.v3.ts:77`, `linearSlot` → `countsTowardLinear`), deci creste ROOM_SIZE ca un corp pe perete. La noptiere se aduna o singura latime, desi cantitatea implicita e 2 (`bedroom.v2.ts:35,58-59`).
- Gabaritul afisat pe fisa („L × W × H”, `room-spec-card.tsx:112-114`) foloseste `widthM` = 0,6 m fix, sau adancimea insulei la bucatarie (`kitchen.v3.ts:80-83`). Nu e latimea camerei, dar e prezentat ca atare.

### CA-17 · P3 · inconsecventa · piese oferite — Living are „Altceva”, Dormitorul nu
- **Unde:** `living.v3.ts:34` (OTHER + `piecesOtherText`) vs `bedroom.v2.ts:32-39` (fara OTHER, fara birou, fara tablie separata, fara oglinda).
- **Propunere:** „Altceva” in toate fluxurile cu lista de piese (dormitor, birou, hol).

### CA-18 · P3 · lipsa · BEDROOM v2 — dimensiuni de saltea
- **Unde:** `bedroom.v2.ts:135-149`.
- **Ce se intampla:** lipsesc 120×200 (frecvent in Romania, „pat de o persoană și jumătate”) si lungimea de 190 cm. Exista „Dimensiuni custom”, dar e anglicism („personalizate”). Intrebarile `bedStorage`, `bedUpholstered` si `nightstandsCount` nu au subtitlu, spre deosebire de restul pasilor.

### CA-19 · P3 · text · anglicisme si termeni neexplicati pe carduri
- „Walk-in” (dressing), „Push”, „Gola”, „Aventos” (Aventos = marca Blum), „Dimensiuni custom”, „King”. Infobox-urile exista, dar eticheta cardului ramane criptica pentru un client obisnuit.
- Tonul e consecvent „tu” in toate cele 4 fluxuri. Nu am gasit „atelier” in textele acestor fluxuri.

### CA-20 · P3 · scor · raspunsuri cu pret declarat care nu schimba costul
- Fara efect in scor, desi infobox-urile dau preturi:
  - Dressing: `interiorModules` (sertare „+250–450 lei / sertar”, LED „+400–1.200 lei”, ro.json:4603, 4639).
  - Living: `ledPieces` („+400–1.500 lei”).
  - Dormitor: `bedUpholstered`, `wardrobeDoorType`.
  - Bucatarie: `appliances`; `countertop` are pondere 0 in seed (seed.ts:76-83), desi diferenta PAL → granit e de 150 → 1.400 lei/ml.
- **Idee:** e o decizie de produs, dar merita aratata PO-ului — firmele platesc la fel pentru o bucatarie cu blat PAL si una cu granit.

### CA-21 · P3 · idee · ce ar intreba o firma si lipseste in toate 4
- Culoarea / decorul (MDF vopsit promite „orice culoare RAL”, dar nu se cere nicaieri culoarea).
- Materialul corpului vs al fronturilor (cerut doar la bucatarie, si acolo doar fronturile).
- Pozitia prizelor si a instalatiilor (apa, gaz, hota) la bucatarie.
- Corpurile suspendate pana in tavan (tavanul se cere, dar nu se leaga de nimic).
- Iluminare LED sub corpurile suspendate la bucatarie (living si dressing o au, bucataria nu).
- Accesul la montaj (etaj, lift) si starea spatiului (renovare / gata).
- Pasul „Date generale” (`details-step.tsx`) are mesaj, buget, termen si adresa, dar nu acces / etaj (de verificat de agentul care acopera pasul 5).

## 3. Tabel de consecventa

| Concept | KITCHEN v3 | DRESSING v3 | LIVING v3 | BEDROOM v2 | Alte fluxuri (reper) |
|---|---|---|---|---|---|
| Forma / piese | `layout` STRAIGHT/L/U + insula (bifa) | `layout` LINEAR/L/U/WALK_IN | `piecesNeeded` 6 optiuni, cu OTHER | `piecesNeeded` 6 optiuni, fara OTHER | Office / Hallway: fara OTHER |
| Material | o intrebare pentru fronturi + bifa „diferite pe zone” (3 zone) | o intrebare, „modulele interioare” | o intrebare pe piesa, ecran separat | o intrebare pe piesa, ecran separat | PIECE_*: una, „materialul principal” |
| Deschidere | 3 multi-choice obligatorii (Gola / Aventos doar aici) | dedusa din `doorType` (doar Glisante) | multi obligatoriu pe piesa (si la rafturi / masuta) | multi obligatoriu pe piesa + `wardrobeDoorType` nefolosit | PIECE_TV_UNIT / BOOKCASE: optional |
| Usi | — | `doorType` Glisante / Batante / Fara usi | — | `wardrobeDoorType` Glisante / Batante | PIECE_WARDROBE: `doorType` ascuns |
| Iluminat LED | lipseste | optiune in `interiorModules` | `ledPieces` multi, optional, pe corp | lipseste | — |
| Dimensiuni | laturi A–C (1–10 m) + tavan (2–4 m) + insula L (0,8–4) / D (0,6–1,5) | laturi A–C (1–10 m) + inaltime dressing H (1,8–3,2 m) | latime + inaltime pe piesa + tavan | doar latimi pe piesa + tavan; salteaua custom 0,7–2,2 × 1,6–2,4 m | Laundry: „Lungime perete principal”; Pantry: „Lungime latura A” (formulari diferite) |
| Unitate | m (comutator m / cm / mm in UI) | idem | idem | idem | idem |
| Blat | single obligatoriu, text „Opțional” | — | — | — | Laundry / Balcony: „Material pentru blatul de lucru” (din lista de materiale de mobilier) |
| Electrocasnice | multi optional, fara chiuveta | — | — | — | Laundry: `applianceSetup` |
| Culoare / finisaj | nu | nu | nu | nu | nu (doar finisaj vizual in 3D) |
| Observatii | nu (doar mesajul general la pasul 5) | nu | doar textul piesei OTHER | nu | la fel peste tot |
| „Nu stiu” | nu | nu | nu | nu | PIECE_TV_UNIT `tvSetup` UNDECIDED |
| Schita (upload) | optional, max 7 | optional, max 7 | optional, text despre TV | optional, text despre pat + dulap | la fel |

**Dimensiuni enumerate pe variante** (toate in m, toate obligatorii daca sunt vizibile, `engine.ts:93-104`):

- **KITCHEN** (`kitchen.v2.ts:56-74`):
  - STRAIGHT: runA 1–10 (pas 0,1) + ceilingHeight 2–4 (pas 0,05);
  - L: + runB 1–10;
  - U: + runC 1–10;
  - cu insula: + islandLength 0,8–4 (pas 0,1, intra in metri liniari) + islandDepth 0,6–1,5 (pas 0,05).
- **DRESSING** (`dressing.v3.ts:28-42`):
  - LINEAR: runA;
  - L: runA, runB;
  - U: runA, runB, runC;
  - WALK_IN: runA, runB;
  - laturile au toate 1–10, pas 0,1; mereu wardrobeHeight 1,8–3,2, pas 0,05.
- **LIVING** (`living.v3.ts:63-88`):
  - TV: 1–5 / H 0,2–2,8;
  - Biblioteca: 0,4–4 / H 0,6–3;
  - Vitrina: 0,4–2,5 / H 0,8–2,8;
  - Masuta: L 0,5–1,5 / H 0,25–0,6;
  - Rafturi: total 0,4–6 / H 0,2–2,5;
  - Altceva: 0,3–6 / H 0,2–3;
  - plus tavan 2–4.
- **BEDROOM** (`bedroom.v2.ts:49-60, 77-87`):
  - Dulap: 0,6–6;
  - Comoda: 0,6–2,5;
  - Comoda TV: 0,8–4;
  - Masuta toaleta: 0,6–1,8;
  - Noptiera: 0,35–0,8;
  - plus tavan 2–4;
  - pat: fara slot (latimea saltelei se adauga in metri liniari), iar cu CUSTOM: 0,7–2,2 × 1,6–2,4.

**Ce schimba costul in credite** (scorul de baza al camerei, `engine.ts:350-391`, ponderi in `seed.ts`):

- KITCHEN: suma laturilor + lungimea insulei; ITEM_QUANTITY mereu 2–3; MATERIAL + SYSTEM pentru baza, suspendate si insula; KITCHEN_LAYOUT; KITCHEN_ISLAND; countertop cu pondere 0.
- DRESSING: suma laturilor; un item; MATERIAL; SYSTEM doar la glisante; DRESSING_LAYOUT.
- LIVING: suma latimilor (inclusiv masuta); numarul de piese; MATERIAL + SYSTEM pe piesa; TV_MEDIA_WALL la ansamblu.
- BEDROOM: suma latimilor + latimea patului; numarul de piese (noptiere 1 / 2); MATERIAL + SYSTEM pe piesa; BED_STORAGE.

## 4. Top 10 de schimbat (dupa impact)

1. **CA-02:** deschiderea optionala / ascunsa pentru piese fara usi (rafturi, masuta, biblioteca deschisa, pat fara depozitare), cu „Nu e cazul”. Acum scorul e umflat si datele sunt false.
2. **CA-01:** o singura intrebare despre usile dulapului din dormitor, legata de `systems` (ca la dressing).
3. **CA-03:** optiune „Fără corpuri suspendate” (si, eventual, coloane) la bucatarie.
4. **CA-04:** itemii derivati traduși si cu diacritice; la dressing, fara coduri `HANGING_RODS` pe fisa firmei.
5. **CA-05:** blatul — fie optional, fie scos „Opțional” din text; plus „Decide firma”.
6. **CA-12:** optiunea comuna „Nu știu / decide firma” la material, deschidere si blat.
7. **CA-06:** sloturile de inaltime optionale; fara tavan obligatoriu cand e ales doar patul.
8. **CA-10:** chiuveta si frigider incorporabil / independent la electrocasnice.
9. **CA-09:** ecranul de fronturi la bucatarie spart in doua, cu titluri care se schimba dupa bifa.
10. **CA-07 / CA-08:** la dressing, maner / push la usile batante si subtitlul materialului corectat.
