# Raport CB — fluxurile OFFICE v2, BATHROOM v2, HALLWAY v1, PANTRY v2, LAUNDRY v2, BALCONY v2

Metoda: doar citire de cod (fara aplicatie, fara site). Surse: `packages/shared/src/questionnaire/flows/{office.v2,bathroom.v2,hallway,pantry.v2,laundry.v2,balcony.v2,per-piece,common}.ts`, `engine.ts`, `mapping.ts`, `flows/index.ts`, textele din `apps/frontend/src/messages/ro.json` / `en.json` (sectiunile `Configurator.common` r.4006-4192 si `Configurator.flows.<CAMERA>` r.5078-5692, aceleasi linii in en.json), randarea din `apps/frontend/src/components/configurator/{step-renderer.tsx,room-screens.ts,room-spec-card.tsx,dimension-figures.tsx}`. Dump-ul `audit/flows-dump.md` a fost confruntat cu codul (concorda).

## 1. Ce am acoperit

| Flux | Pasi (dump) | Pana unde | Ramuri verificate | Ce NU am acoperit |
|---|---|---|---|---|
| OFFICE v2 | 16 | tot fluxul + deriveRoom + scor | toate 4 piesele; deskShape STRAIGHT/L/U (sloturi) | aspectul vizual (nu am rulat) |
| BATHROOM v2 | 10 | tot | 3 piese, ventilatie NONE (badge) | vizual |
| HALLWAY v1 | 18 | tot | 5 piese; cu/fara piese inalte (slot tavan) | vizual |
| PANTRY v2 | 9 | tot | ONE/L/U × OPEN/CLOSED/MIXED | vizual |
| LAUNDRY v2 | 16 | tot | 3 asezari, 4 piese, ventilatie NONE | vizual |
| BALCONY v2 | 14 | tot | ENCLOSED/OPEN, 4 piese | vizual |

Comun: `pieceConfigSteps` / `buildPerPieceItems` (per-piece.ts), `collectScoreEntries` / `summarizeAnswers` / `validateRoomAnswers` (engine.ts), afisarea pentru firma (room-spec-card.tsx). Nu am verificat backend-ul (SizingService, punctajele din `project_sizing_config`) — impactul in credite e descris doar ca „ce categorie / bucket se schimba”.

## 2. Constatari

### CB-01 · P1 · inconsecventa / defect logic — intrebare obligatorie de „Deschidere” pentru piese fara usi sau sertare (OFFICE, HALLWAY)
- **Unde:** `per-piece.ts:47-57` (`minSelected: 1`, optiuni `MANER/PUSH/GLISANTE`); OFFICE `systemsShelves` (Rafturi perete), `systemsDesk`; HALLWAY `systemsCoatUnit` (Cuier cu panou), `systemsMirror` (Oglinda cu polita), `systemsBench`.
- **Ce se intampla:** pentru „Rafturi perete — Suspendate, deasupra biroului”, „Cuier cu panou — Panou de perete cu agatatori”, „Oglinda cu polita” clientul e obligat sa aleaga cel putin un sistem de deschidere dintre Maner / Push / Glisante, desi piesa nu are fronturi. Subtitlul spune „Pentru usile si sertarele acestei piese” (`ro.json` `common.pieceSystems.subtitle` r.4110). Nu exista optiune „Fara usi / nu e cazul”. Clientul alege ceva la intamplare, iar alegerea ajunge in items (`systems`) si in scorul SYSTEM (engine.ts:367-369) → firma vede si plateste pentru un sistem inexistent.
- **Inconsecventa:** LAUNDRY si BALCONY scot explicit intrebarea pentru piesele fara fronturi (`laundry.v2.ts:57-58` `NO_SYSTEMS_STEPS = systemsCountertop`; `balcony.v2.ts:57-58` `systemsWorktop, systemsShelves`), PANTRY o pune doar la dulapuri (`pantry.v2.ts:95, 123-134`). OFFICE si HALLWAY nu au acest filtru. Cheia orfana `flows.HALLWAY.openingSystems.subtitle` = „Optional — doar pentru corpurile cu usi sau sertare.” (ro.json r.5383) arata ca intentia initiala era optional.
- **Ce ar trebui / propunere:** `NO_SYSTEMS_STEPS` si in office.v2 (`systemsShelves`) si hallway (`systemsCoatUnit`, `systemsMirror`); pentru birou si bancuta (pot avea sau nu sertare) — optiune „Fara usi/sertare” sau `optional: true`. Necesita versiune noua de flux (v3 / v2) ca sa nu rupa cererile publicate.

### CB-02 · P1 · defect de scor — marimea proiectului (ROOM_SIZE, deci creditele) se calculeaza pe baze diferite de la camera la camera
- **Unde:** `mapping.ts:15-19` (bucket UNDER_2M / 2-4 / OVER_4M pe metri liniari), `engine.ts:360`; sloturile `countsTowardLinear` din fiecare flux.
- **Ce se intampla:**
  - OFFICE / BATHROOM / HALLWAY: suma latimilor pieselor alese (office.v2.ts:32-52, bathroom.v2.ts:42-48, hallway.ts:27-36) — corect, masoara mobilierul.
  - LAUNDRY: `runA` = „Lungime perete principal” 0.8–6 m, indiferent ce piese s-au ales (laundry.v2.ts:60-69).
  - BALCONY: `balconyLength` = „Lungime utila” a balconului 0.8–8 m (balcony.v2.ts:65-66) — lungimea balconului, nu a mobilierului.
  - PANTRY: suma laturilor A/B/C (pana la 3 × 5 m = 15 m) indiferent daca e raft sau dulap.
  Exemplu: balcon de 6 m in care clientul vrea doar un raft → OVER_4M, la fel ca un balcon mobilat complet; spalatorie cu perete de 5 m si doar un blat → OVER_4M. Firma plateste credite pe „marime” care nu exista.
- **Ce ar trebui:** aceeasi regula peste tot — latime per piesa aleasa (modelul OFFICE/BATHROOM/HALLWAY); dimensiunile spatiului (perete, adancime balcon) ca sloturi informative fara `countsTowardLinear`.
- **Propunere:** LAUNDRY v3 / BALCONY v3 cu sloturi per piesa; `runA` / `balconyLength` raman ca context.

### CB-03 · P1 · UX / lipsa — BATHROOM nu intreaba deloc sistemul de deschidere si nici tipul de lavoar
- **Unde:** `bathroom.v2.ts:85-103` (doar material + „Altul”), `bathroom.v2.ts:153` (`systems: []` fix).
- **Ce se intampla:** baia e singura camera „per piesa” din felie fara ecranul de deschidere (OFFICE, HALLWAY, LAUNDRY, BALCONY, PANTRY il au). Corpul de lavoar si coloana au usi/sertare, dar firma nu afla maner vs push, iar categoria SYSTEM nu intra niciodata in scor (engine.ts:367). Lipsesc si informatiile care schimba cel mai mult pretul unui corp de lavoar: lavoarul / cuva vine cu corpul sau e deja cumparat, lavoar incastrat vs pe blat, corp suspendat vs pe picioare, pozitia scurgerii, iluminat la dulapul cu oglinda (priza).
- **Propunere:** BATHROOM v3: `systemsVanity/systemsMirror/systemsTall` prin `pieceConfigSteps` + intrebare „Lavoarul” (am deja lavoar / vreau lavoar inclus / decide firma) si „Montaj: suspendat / pe picioare”.

### CB-04 · P2 · inconsecventa — blatul de lucru (LAUNDRY, BALCONY) primeste materialele de corp, nu materialele de blat
- **Unde:** `laundry.v2.ts:41-47` (`materialCountertop`), `balcony.v2.ts:41-47` (`materialWorktop`) → `materialOptions(OFFERED_MATERIALS)` = PAL / MDF infoliat / MDF vopsit / MDF furniruit / Lemn masiv / Altul.
- **Ce se intampla:** la bucatarie blatul are set propriu PAL / HPL / Cuart / Granit (dump `KITCHEN.countertop`, r.432-441). La spalatorie si balcon (zone umede / exterioare) clientul poate alege „MDF vopsit” sau „MDF furniruit” pentru blat, iar descrierea cardului spune „Folie PVC pe fronturi frezate” (common.materials.MDF_INFOLIAT.description, ro.json r.4045). Mai mult, cand spalatoria nu e ventilata, „MDF infoliat” primeste badge-ul „Recomandat” si pe blat (`withRecommendedMaterial` se aplica tuturor pasilor `material*`, per-piece.ts:69-82; laundry.v2.ts:125-129) — recomandam un blat MDF infoliat intr-o spalatorie umeda.
- **Propunere:** pentru blaturi folositi setul de la bucatarie (PAL postformat / HPL / compact / cuart / lemn masiv) si excludeti blatul din `withRecommendedMaterial`.

### CB-05 · P2 · inconsecventa / defect de continut — balcon deschis: textul spune ca PAL/MDF nu rezista, dar formularul le ofera fara avertisment
- **Unde:** BALCONY `enclosed` (subtitlu „Mobilierul de interior rezista doar intr-un balcon inchis.”, ro.json r.5606; OPEN.info.cons1 „PAL-ul si MDF-ul nu rezista aici, nici infoliate”, r.5631); `balcony.v2.ts:79-80, 117-121` (doar badge „Recomandat” pe LEMN_MASIV).
- **Ce se intampla:** cu `enclosed = OPEN` clientul poate alege PAL pe toate piesele si publica; nimic nu-l opreste sau nu-l avertizeaza pe ecranul de material. Raspunsul `enclosed` nu intra nici in `deriveRoom` (balcony.v2.ts:131-141) — firma il vede doar ca rand in rezumat.
- **Propunere:** la OPEN, optiunile PAL / MDF_* cu un avertisment vizibil (nu doar lipsa badge-ului) sau ascunse; adaugati in descrierea itemului „balcon deschis — exterior”.

### CB-06 · P2 · UX — nicio intrebare obligatorie nu are „Nu stiu / decide firma”
- **Unde:** materiale (toate `material*`, doar „Altul” cu text), sisteme (`systems*`), `deskShape`, `wallsUsed`, `storageStyle`, `applianceSetup`, `enclosed`, `ventilation`.
- **Ce se intampla:** un client obisnuit nu stie diferenta MDF infoliat / vopsit / furniruit, dar e obligat sa aleaga; la fel la sistemele de deschidere (obligatorii, minim 1). Aceeasi situatie in toate cele 28 de fluxuri din dump.
- **Propunere:** optiune „Las firma sa recomande” la material si deschidere (punctata ca PAL / fara sistem pentru scor) — reduce abandonul si raspunsurile aleatorii care umfla scorul.

### CB-07 · P2 · inconsecventa — ce inseamna „material”: structura, fronturi sau tot?
- **Unde:** titluri `Material — birou` (OFFICE/HALLWAY), `Ce material pentru corpul de lavoar?` (BATHROOM), `Material pentru dulapul de incastrare` (LAUNDRY/BALCONY/PANTRY) vs piesele individuale „Ce material doresti pentru structura?” (dump PIECE_*.material) si bucataria „Ce material vrei pentru fronturi?” (KITCHEN.frontMaterialBase).
- **Ce se intampla:** descrierile cardurilor vorbesc de fronturi („Folie PVC pe fronturi frezate”, „Fronturi MDF vopsite...”, ro.json r.4045-4062), dar intrebarea camerelor nu spune ce parte a piesei. In practica „MDF vopsit” = fronturi vopsite + corp PAL; firma nu stie ce oferteaza.
- **Propunere:** acelasi titlu peste tot, explicit: „Material pentru fronturi” (corpul implicit PAL) sau doua intrebari (corp / fronturi) unde conteaza.

### CB-08 · P2 · text — „Glisante” amesteca usi glisante cu glisierele de sertar
- **Unde:** `common.systems.GLISANTE` — descriere „Usi sau sertare pe sine”, info „Usile gliseaza lateral pe sine, iar sertarele ies in fata pe glisiere” (ro.json r.4126-4136).
- **Ce se intampla:** orice sertar are glisiere; un client cu sertare va bifa „Glisante” crezand ca e obligatoriu, desi optiunea inseamna usi culisante (pret +80–200 lei/set). Firma primeste un semnal gresit, iar scorul SYSTEM ia max-ul.
- **Propunere:** „Usi glisante (culisante)” cu descriere doar despre usi; sertarele nu sunt un sistem de deschidere.

### CB-09 · P2 · lipsa — LAUNDRY: datele electrocasnicelor nu sunt cerute si nici folosite
- **Unde:** `applianceSetup` (laundry.v2.ts:79-100); `deriveRoom` (laundry.v2.ts:139-144) nu il citeste.
- **Ce se intampla:** raspunsul apare doar in rezumat. Nu se intreaba: incarcare frontala vs verticala (masina cu incarcare de sus nu intra sub blat), dimensiunile / modelul aparatelor (rafturile de coloana depind de ele), „masina de spalat cu uscator” (combo) sau „doar uscator”, „aparatele sunt deja cumparate?”. Nu exista nicio verificare intre `SIDE_BY_SIDE` (info: „Cere ~130 cm liniari”, ro.json r.5425) si `runA` (min 0.8 m).
- **Propunere:** intrebare „Tip incarcare” + „Dimensiuni aparate (optional)”; la SIDE_BY_SIDE, minimul lui `runA` = 1.3 m sau avertisment.

### CB-10 · P2 · UX — OFFICE „Lungime totala rafturi” e ambigua si umfla metrii liniari
- **Unde:** `office.v2.ts:49-51` slot `shelvesTotal` 0.4–6 m, `countsTowardLinear`; eticheta „Lungime totala rafturi” (ro.json r.5159).
- **Ce se intampla:** clientul poate intelege „suma tuturor politelor” (ex. 4 polite × 1.2 m = 4.8 m) sau „latimea zonei de perete”. Valoarea intra direct in ROOM_SIZE → bucket mai mare → mai multe credite.
- **Propunere:** „Latimea zonei cu rafturi” + „Cate polite?” (numar) separat.

### CB-11 · P2 · text / date — numele pieselor si „Material dorit:” ajung la firma fara diacritice si doar in romana
- **Unde:** `itemName` in cod: „Biblioteca”, „Dulap oglinda”, „Coloana baie”, „Bancuta hol”, „Oglinda cu polita”, „Dulap incastrare electrocasnice”, „Corp cuva tehnica”, „Banca cu depozitare”, fallback „Mobilier spalatorie” (office.v2.ts:27, bathroom.v2.ts:36-38, hallway.ts:23-24, laundry.v2.ts:30-51, balcony.v2.ts:30, 143); descrierea `Material dorit: …` (per-piece.ts:104, bathroom.v2.ts:157, pantry.v2.ts:150).
- **Ce se intampla:** `room-spec-card.tsx:197, 205` afiseaza `it.name` / `it.description` brut — firma vede „Dulap oglinda” (fara diacritice) si in interfata EN. Regula proiectului cere diacritice in textele UI.
- **Propunere:** numele itemelor derivate din cheia i18n a optiunii (`flows.X.piecesNeeded.options.<VALUE>.label`) la afisare, sau scrise cu diacritice.

### CB-12 · P2 · UX — BALCONY, LAUNDRY, PANTRY nu cer latimea pieselor; OFFICE/BATHROOM/HALLWAY o cer
- **Unde:** dimensiunile din cele 6 fluxuri (vezi tabelul de la sectiunea 3).
- **Ce se intampla:** la balcon clientul alege „Banca cu lada + Dulap inalt + Rafturi”, dar firma primeste doar lungimea si adancimea balconului — nu stie cat de lata vrea fiecare piesa. La spalatorie: doar peretele principal (nu exista forma in L). La debara MIXED: nu se stie cat din lungime e raft si cat dulap.
- **Propunere:** acelasi model ca OFFICE (latime per piesa aleasa) + dimensiunile spatiului ca informatie.

### CB-13 · P2 · lipsa — ce ar intreba o firma si nu se intreaba (toate cele 6)
- Acces la montaj (etaj, lift, latimea usii — ex. dulap inalt de balcon, coloana de spalatorie), tip perete (beton / BCA / rigips — conteaza la piese suspendate: rafturi perete, cuier, dulap oglinda, rafturi balcon), iluminat LED (exista la LIVING `ledPieces` si DRESSING, lipseste la dulapul cu oglinda, rafturi birou, hol), culoare / decor (nicaieri in felie; „MDF vopsit — orice culoare RAL” fara loc unde sa spui culoarea — doar prin „Altul”), adancimea dorita (hol: intrebarea `depthProfile` a fost eliminata, `hallway.ts:13-15`, adancime fixa 0.5 m, desi un hol ingust cere pantofar slim 25–35 cm — textul eliminat din ro.json r.5308-5339 o explica chiar el), pozitia instalatiilor (doar mentionata in subtitlul upload-ului optional la LAUNDRY / OFFICE).
- **Propunere:** un pas comun optional „Detalii pentru montaj” (acces, perete, prize / instalatii, culoare) la toate camerele; pentru hol reintroducerea adancimii doar daca PO redeschide decizia F4 item 14 (o semnalez, nu o redeschid).

### CB-14 · P3 · text — subtitluri care contrazic sau omit
- HALLWAY `dimensions.subtitle` „Latimea fiecarei piese alese.” dar cand e ales dulap sau cuier apare si „Inaltime tavan” (hallway.ts:49; ro.json r.5342).
- PANTRY `wallsUsed` subtitlu „Configuratia rafturilor in debara”, optiuni „Rafturi pe o singura latura / doua / trei laturi” (ro.json r.5514-5530), intrebate INAINTE de `storageStyle` — daca clientul alege apoi „Dulapuri inchise”, textul de la pasul anterior vorbea doar de rafturi.
- PANTRY `wallsUsed.title` „Pe cati pereti montam?” / „How many walls do we use?” — vocea „noi” sugereaza ca platforma monteaza; montajul il face firma.
- BATHROOM `ventilation.info.body`: „recomandam MDF” (ro.json r.5249), dar badge-ul e doar pe MDF infoliat (bathroom.v2.ts:77-83); cheia orfana `BATHROOM.material.info` spune „MDF vopsit sau infoliat”.
- PANTRY `storageStyle.MIXED` „Rafturi sus, dulapuri jos” impune o combinatie fixa.

### CB-15 · P3 · inconsecventa de formulare intre fluxuri (titluri, termeni)
- „Ce piese iti trebuie?” (OFFICE, BATHROOM) / „De ce piese ai nevoie?” (HALLWAY, BALCONY) / „Ce mobilier iti trebuie?” (LAUNDRY); PANTRY nu are alegere de piese, ci `storageStyle`.
- Trei stiluri de titlu pentru material: „Material — birou” / „Ce material pentru corpul de lavoar?” / „Material pentru dulapul de incastrare”. La fel pentru deschidere: „Deschidere — dulap” / „Deschidere pentru dulapurile de depozitare”.
- Doar BATHROOM are subtitlu pe ecranele de material; restul nu au.
- Ventilatie BATHROOM vs LAUNDRY: „Aerisire naturala / mecanica” vs „Ventilatie naturala / mecanica”; EN „Extractor fan” vs „Fan” (ro.json r.5234-5244 vs 5460-5471).
- EN OFFICE: optiunea „Bookshelf” vs titlul „Material — bookcase”; „Material — storage” vs RO „Material — dulap”.
- HALLWAY „Material — oglinda” cu optiuni PAL/MDF — oglinda e sticla; e vorba de rama / polita (BATHROOM spune corect „dulapul cu oglinda”).
- Ordinea: BATHROOM piese → dimensiuni → ventilatie; LAUNDRY asezare → piese → ventilatie → dimensiuni. Intrebarea de context (ventilatie / inchis) e cand inainte, cand dupa dimensiuni.

### CB-16 · P3 · UX — inaltimea tavanului ceruta inconsecvent
- OFFICE, BATHROOM, PANTRY, LAUNDRY, BALCONY: mereu obligatorie (ex. OFFICE doar cu birou — tavanul nu conteaza). HALLWAY: doar daca exista dulap sau cuier (hallway.ts:38-50) — singurul flux din felie cu regula „doar pentru corpuri inalte”.
- **Propunere:** regula HALLWAY peste tot (tavan doar pentru piese inalte: dulap, biblioteca, coloana, dulap inalt, coloana de electrocasnice).

### CB-17 · P3 · UX — pasul de 10 cm pentru latimi (de verificat in browser)
- `common.ts:112-126` `linearSlot` are `step: 0.1` m; in `step-renderer.tsx:419` devine `step=10` in cm si `step=100` in mm. Sagetile campului sar din 10 in 10 cm; o valoare ca 85 cm poate fi marcata `:invalid` de browser (Zod nu verifica pasul, engine.ts:93-104, deci nu blocheaza publicarea). De verificat vizual daca stilul nativ de invalid apare.

### CB-18 · P3 · cod / text — chei i18n orfane in fluxurile din felie
- `flows.OFFICE.material`, `.openingSystems` („Optional — pentru usi si sertare”), `.notes`, `.cableManagement`; `flows.BATHROOM.material`, `.notes`; `flows.HALLWAY.depthProfile`, `.openingSystems`; `flows.LAUNDRY.material`, `flows.PANTRY.material`, `flows.BALCONY.material` (ro.json r.5140-5172, 5252-5279, 5308-5339, 5381-5384, 5481-5484, 5585-5588, 5666-5669). Unele pot fi folosite de v1 inghetate (OFFICE/PANTRY/LAUNDRY/BALCONY v1 — de verificat); HALLWAY are doar v1, deci `depthProfile` si `openingSystems` sunt sigur orfane. Textele lor (ex. PANTRY „PAL-ul da aici cel mai bun raport calitate-pret”, BALCONY „vezi mai sus”) nu mai apar nicaieri, desi ar ajuta pe ecranele de material actuale.

### CB-19 · P3 · rezumat — materialul apare de doua ori pentru firma
- `summarizeAnswers` (engine.ts:233-343) pune fiecare `material*` ca rand intrebare→raspuns, iar `room-spec-card.tsx:180-213` afiseaza in plus lista de corpuri cu materialul fiecaruia. Aceeasi informatie de doua ori; in schimb `deskShape`, `applianceSetup`, `enclosed`, `ventilation` nu apar pe corpuri (doar ca rand).

### HALLWAY v1 vs fluxurile v2 (punctul 6 din cerere)
HALLWAY e construit deja pe modelul v2 (aceleasi `pieceConfigSteps` / `buildPerPieceItems`, set de materiale nou, upload schita) — „v1” doar pentru ca a aparut direct in forma noua (git: introdus in afc96be, 2026-07-08). Diferente fata de v2: (a) nicio intrebare de context (v2 au ventilatie / balcon inchis / asezare electrocasnice / forma); (b) tavan doar pentru piese inalte (CB-16); (c) adancime fixa 0.5 m in `deriveRoom` vs 0.6 m (`STANDARD_CABINET_DEPTH`) in restul (hallway.ts:80); (d) nu filtreaza deschiderea la piesele fara fronturi (CB-01); (e) chei orfane `depthProfile` / `openingSystems` (CB-18).

## 3. Tabel de consecventa

| Concept | OFFICE v2 | BATHROOM v2 | HALLWAY v1 | PANTRY v2 | LAUNDRY v2 | BALCONY v2 |
|---|---|---|---|---|---|---|
| Alegere piese | `piecesNeeded` „Ce piese iti trebuie?” 4 opt. | idem, 3 opt. | „De ce piese ai nevoie?” 5 opt. | fara; `storageStyle` OPEN/CLOSED/MIXED | „Ce mobilier iti trebuie?” 4 opt. | „De ce piese ai nevoie?” 4 opt. |
| Intrebare de context | `deskShape` (doar cu birou) | `ventilation` (dupa dimensiuni) | — | `wallsUsed` | `applianceSetup` + `ventilation` (inainte de dimensiuni) | `enclosed` |
| Dimensiuni (m, pas 0.1; tavan pas 0.05) | deskWidthA 0.8–3, B/C 0.6–2.5 (L/U), bookshelfWidth 0.4–4, storageWidth 0.5–3, shelvesTotal 0.4–6, tavan 2–4 | vanityWidth 0.4–3, mirrorWidth 0.3–2, tallStorageWidth 0.3–1.5, tavan 2–4 | shoeCabinet 0.4–2.5, coatUnit 0.5–2.5, wardrobe 0.5–3, bench 0.5–2, mirror 0.4–1.5, tavan doar cu dulap/cuier | runA (+B, +C pentru L/U) 0.5–5, tavan 2–4 | runA perete 0.8–6, tavan 2–4 (fix, nu depinde de piese) | balconyLength 0.8–8, balconyDepth 0.4–2.5 (pas 0.05, nu intra in ml), tavan 2–4 |
| Baza ROOM_SIZE | suma latimilor pieselor | suma latimilor pieselor | suma latimilor pieselor | suma laturilor | lungimea peretelui | lungimea balconului |
| Adancime in deriveRoom | 0.6 | 0.6 | 0.5 | 0.6 | 0.6 | min(adancime balcon, 0.6) |
| Material | per piesa, titlu „Material — X” | per piesa, titlu-intrebare + subtitlu; badge MDF infoliat daca neventilat | per piesa, „Material — X” | per zona (rafturi / dulapuri), „Material pentru …” | per piesa, „Material pentru …”; badge MDF infoliat daca neventilat (inclusiv pe blat) | per piesa, „Material pentru …”; badge lemn masiv daca deschis |
| Material blat | — | — | — | — | set de corp (PAL/MDF…) | set de corp (PAL/MDF…) — bucataria are PAL/HPL/Cuart/Granit |
| Deschidere | per piesa, obligatorie la TOATE (inclusiv rafturi perete) | lipseste complet | per piesa, obligatorie la TOATE (inclusiv cuier, oglinda) | doar la dulapuri | per piesa, fara blat | per piesa, fara blat si rafturi |
| „Nu stiu / decide firma” | nu | nu | nu | nu | nu | nu |
| Iluminat / LED | nu | nu (nici la dulapul cu oglinda) | nu | nu | nu | nu — (LIVING are `ledPieces`) |
| Culoare / decor | doar prin „Altul” | idem | idem | idem | idem | idem |
| Observatii libere | nu (doar upload) | nu | nu | nu | nu | nu |
| Upload schita | „Ai o schita a camerei?” | „Incarca proiectul sau schita ta” | „Ai o schita a holului?” | „Ai o schita a debaralei?” | „Ai o schita a spatiului?” | „Ai o schita a balconului?” |

## 4. Top 10 de schimbat (in ordinea impactului)

1. Scoateti / faceti optionala „Deschidere” pentru piesele fara fronturi in OFFICE (rafturi perete) si HALLWAY (cuier, oglinda), ca in LAUNDRY/BALCONY (CB-01).
2. Aceeasi baza pentru marimea proiectului: latime per piesa aleasa; lungimea peretelui / balconului doar ca informatie (CB-02, CB-12).
3. BATHROOM v3: deschidere per piesa + tip lavoar (inclus / existent) + montaj suspendat (CB-03).
4. Optiune „Las firma sa recomande” la material si deschidere (CB-06).
5. Set de materiale de blat pentru blaturile de spalatorie si balcon, fara badge MDF infoliat pe blat (CB-04).
6. Balcon deschis: avertisment real pe PAL/MDF, nu doar badge pe lemn masiv (CB-05).
7. Precizati „material pentru fronturi / corp” la toate camerele si redenumiti „Glisante” in „Usi glisante” (CB-07, CB-08).
8. Spalatorie: tip incarcare + dimensiuni aparate, verificare SIDE_BY_SIDE vs lungimea peretelui (CB-09).
9. Nume de piese pentru firma din i18n, cu diacritice si in limba utilizatorului (CB-11).
10. Uniformizare texte: titluri piese / material / deschidere, ventilatie, tavan doar pentru piese inalte, subtitluri care contrazic (CB-14, CB-15, CB-16).
