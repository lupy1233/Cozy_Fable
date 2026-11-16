# Raport CP — cele 18 fluxuri de piese individuale (audit doar din cod)

Agent: CP · data: 2026-11-12 · metoda: citire de cod (fara rulare, fara site). Repo nemodificat.
Surse principale: `packages/shared/src/questionnaire/flows/guided-pieces/*`, `flows/pieces.ts`, `piece3d/config.ts`,
`piece3d/furniture-config.ts`, `piece3d/catalog-config.ts`, `apps/frontend/src/components/configurator/*`
(cos, configurator 3D, rezumat), `apps/frontend/src/messages/ro.json`, `apps/backend/prisma/seed.ts`,
`apps/backend/src/modules/sizing/sizing.service.ts`, `requests.service.ts`.

## 1. Ce am acoperit

| Flux | Versiune curenta | Pasi vizibili | Ce e in 3D | Ce e intrebat clasic | Acoperire |
|---|---|---|---|---|---|
| PIECE_WARDROBE | v3 (`v3.ts:161`) | config3d, material(+Altul), schita | latime/inaltime/adancime, coloane, zone (deschis/sertare/usa) + interior (polite/bara), maner/push, batante/glisante, culoare | — (`doorType` ascuns) | complet din cod |
| PIECE_TV_UNIT | v3 (`v3.ts:202`) | config3d, tvSetup, material, openingSystems, schita | gabarit, coloane (max 2 zone), maner/push, culoare | unde sta TV-ul, sisteme de deschidere | complet |
| PIECE_BOOKCASE | v3 (`v3.ts:139`) | config3d, material, openingSystems, schita | gabarit, coloane (max 4 zone), maner/push, culoare | sisteme de deschidere | complet |
| PIECE_DESK | v3 (`v3.ts:268`) | config3d, cableManagement, material, schita | blat, 0–2 casetiere (42 cm fixe), maner/push, culoare | canal cabluri | complet |
| PIECE_BED | v3 (`furniture-v3.ts:58`) | config3d, material, schita | saltea (4 marimi), depozitare, tapitat, culoare | — | complet |
| PIECE_DRESSER | v3 (`v3.ts:234`) | config3d, material, openingSystems, schita | gabarit, coloane, maner/push, soclu/picioare, culoare | sisteme de deschidere | complet |
| PIECE_TABLE | v3 (`furniture-v3.ts:59`) | config3d, material, schita | tip, forma, locuri, lungime/latime, culoare | — | complet |
| PIECE_SHOE_CABINET | v3 (`v3.ts:228`) | config3d, material, schita | gabarit, max 3 coloane x 3 zone, maner/push, culoare | — | complet |
| PIECE_NIGHTSTAND | v3 (`v3.ts:245`) | config3d, count, material, schita | gabarit, 1 coloana, maner/push, culoare | cate (1/2) | complet |
| PIECE_BENCH | v3 (`furniture-v3.ts:60`) | config3d, material, schita | stil, sezut tapitat, latime, culoare | — | complet |
| PIECE_SIDEBOARD | catalog v1 (`catalog-v1.ts`) | config3d, material, schita | ca un corp (coloane/zone), maner/push, soclu/picioare | — | complet |
| PIECE_WALL_CABINET | catalog v1 | config3d, material, schita | corp (usa/deschis), cota de montaj, maner/push | — | complet |
| PIECE_BATHROOM_VANITY | catalog v1 | config3d, material, schita | montaj, 1/2 lavoare, compartimentare, manere, blat deschis/inchis | — | complet |
| PIECE_ENTRYWAY | catalog v1 | config3d, material, schita | cuiere, oglinda, polita, sezut tapitat, pantofar | — | complet |
| PIECE_SOFA | catalog v1 | config3d, material, schita | locuri 2–4, forma (dreapta/sezlong), brate, perne, adancimi, tapiterie (textura, culoare hex, fermitate, picioare) | material „structura” | complet |
| PIECE_ARMCHAIR | catalog v1 | idem | brate, tapiterie | material | complet |
| PIECE_OTTOMAN | catalog v1 | idem | forma, depozitare, tapiterie | material | complet |
| PIECES („Alta piesa”) | v1 (`pieces.ts`) | lista de piese (denumire, material, cantitate, sisteme), schita | — | tot | complet |

Nu am acoperit: comportamentul real in browser (nimic rulat), valorile din tabelul `project_sizing_config` din
productie (am citit doar `seed.ts` — vezi CP-03), vizualul redarilor 3D si al atlaselor.

## 2. Constatari

### CP-01 · P1 · defect / text · Cosul promite optiuni care nu exista in configuratorul pieselor
- **Unde**: `apps/frontend/src/messages/ro.json:3658–3664` (`Configurator.rooms.desc.*`) + `piece3d/config.ts:216–325`.
- **Ce se intampla**: descrierile cartonaselor din cos promit lucruri pe care fluxul v3 nu le mai ofera:
  - Birou: „Drept sau pe colț” — configuratorul DESK are doar blat drept (latime 80–240 cm, 0–2 casetiere); nu exista forma in L/U (`config.ts:313–324`).
  - Comodă TV: „Comodă joasă sau perete media” — inaltimea maxima e 90 cm (`config.ts:266`); intrebarea „perete media” (`LOW_UNIT/MEDIA_WALL`) exista doar in v1 si nu mai e afisata.
  - Bibliotecă: „Rafturi, vitrine, corpuri închise” — nu exista usi de sticla / vitrina (zone: OPEN/DRAWERS/DOOR).
  - Pantofar: „Slim rabatabil sau cu băncuță” — frontul rabatabil (`TILT_OUT`) a fost scos in R5.3 (`config.ts:26–29`), iar banca nu exista in pantofar. Si subtitlul pasului 3D spune „fronturile: rabatabile, sertare sau uși” (dump: `PIECE_SHOE_CABINET.config3d`), desi rabatabilul nu se poate alege.
- **Ce ar trebui**: textul cartonasului si al pasului = ce poate face clientul in pas.
- **Dovada**: `ro.json:3660` „Drept sau pe colț”; `config.ts:280` `zoneTypes: ['DOOR', 'DRAWERS', 'OPEN']`.
- **Propunere**: rescrie cele 4 descrieri (ex. „Blat drept, cu sau fără casetiere”) sau readu optiunile (birou in L, perete media, usi cu sticla, front rabatabil la pantofar). Acelasi lucru in `en.json:3658–3664`.

### CP-02 · P1 · defect · „Alta piesa” nu are camp de descriere, dimensiuni sau „alt material”
- **Unde**: `PIECES.pieces`, `apps/frontend/src/components/configurator/step-renderer.tsx:523–600`.
- **Ce se intampla**: cartonasul spune „Orice altă piesă — o descrii liber” (`ro.json:3652`), dar formularul are doar Denumire (max 150), Material, Cantitate si casute de sisteme. `description` se initializeaza cu `''` si nu are input; nu exista dimensiuni. La material apar 7 valori, inclusiv „MDF” simplu (legacy) si „Altul” fara camp de text; la sisteme apar 6 casute fara explicatii, inclusiv „Buton presiune” (legacy, dublura pentru push), „Gola” si „Aventos” (specifice bucatariei).
- **Ce ar trebui**: descriere libera + dimensiuni (L x H x A) per piesa; aceleasi materiale si sisteme ca restul fluxurilor (`OFFERED_MATERIALS`, `GENERAL_SYSTEMS`) si text pentru „Altul”.
- **Dovada**: `step-renderer.tsx:527` `{ name: '', material: 'PAL', systems: [], quantity: 1, description: '' }`; `step-renderer.tsx:546` foloseste `MATERIALS` (cu `MDF`), `:563` foloseste `ITEM_SYSTEMS` (toate 6).
- **Propunere**: adauga `Textarea` pentru descriere (exista deja in schema, max 2000) si 3 campuri de dimensiuni; filtreaza materialele / sistemele la cele oferite.

### CP-03 · P1 · defect (de verificat pe prod) · Cele 7 piese de catalog nu au pondere ROOM_TYPE → estimare si cost in credite prea mici
- **Unde**: `apps/backend/prisma/seed.ts:10–34`; `sizing.service.ts:55` (`?? 0`); `catalog-v1.ts:17` (config3d fara `scoreEntries`).
- **Ce se intampla**: seed-ul are ponderi `ROOM_TYPE` pentru cele 10 piese v3, dar NU pentru SIDEBOARD, WALL_CABINET, BATHROOM_VANITY, ENTRYWAY, SOFA, ARMCHAIR, OTTOMAN (migrarea `20261002160000_furniture_catalog_seven` doar adauga valorile de enum). Lipsa = 0. Cu ponderile din seed (1 punct = 1.000 lei de buget minim, `request.schemas.ts:31`):
  - canapea 3 locuri 220 cm, PAL: 0 + ROOM_SIZE 3 + QTY 0 + PAL 1 = **4 puncte → 4.000 lei, 4 credite**;
  - fotoliu / taburet: 0 + 1 + 0 + 1 = **2 puncte → 2.000 lei**;
  - pereche de noptiere PAL (2 x 45 cm): 1 + 1 + QTY_2_3 2 + 1 = **5 puncte** — mai mult decat o canapea.
  Si „materialul structurii” (PAL / MDF...) e singurul lucru care misca scorul la tapitate (vezi CP-05).
- **Ce ar trebui**: fiecare tip are pondere; tapitatele puncteaza dupa locuri / sezlong / tesatura.
- **Dovada**: `seed.ts:25–34` (doar cele 10 PIECE_* v3); niciun `PIECE_SOFA` in `apps/backend` in afara de enum si titlu.
- **Propunere**: verifica in Admin → Marime proiect daca exista randuri pentru cele 7; daca nu, adauga-le (ex. SOFA 3, ARMCHAIR 1, OTTOMAN 1, SIDEBOARD 2, WALL_CABINET 1, VANITY 2, ENTRYWAY 2) si `scoreEntries` (ex. sezlong, 4 locuri, catifea).

### CP-04 · P2 · defect · Firma vede coduri brute in descrierea piesei („SIX locuri”, „TV: TV_ON_WALL”)
- **Unde**: `piece-table.ts:126` (folosit de masa v3 prin `furniture-v3.ts:46` + `:16`); `v3.ts:223` (comoda TV).
- **Ce se intampla**: descrierea itemului derivat (afisata firmei si clientului in `room-spec-card.tsx:203–206`) contine valoarea enum: masa → „SIX locuri” / „EIGHT_PLUS locuri”; comoda TV → „TV: TV_ON_WALL”, „TV: UNDECIDED”.
- **Ce ar trebui**: „6 locuri”, „8+ locuri”, „TV pe perete / pe comodă / nedecis”.
- **Dovada**: `details.push(\`${answers.seats} locuri\`)`; `extraDescription: \`TV: ${answerString(answers, 'tvSetup', 'UNDECIDED')}\``.
- **Propunere**: mapare RO in `deriveRoom` (ca `STORAGE_LABEL` de la pat). Nota: un flux v3 nou nu e necesar daca se schimba doar textul derivat (de verificat cu regula FROZEN — descrierea e calculata la publicare, nu reinterpretata).

### CP-05 · P2 · inconsecventa / UX · Tapitatele (canapea, fotoliu, taburet) intreaba „materialul structurii” cu optiunile de PAL / MDF
- **Unde**: `catalog-v1.ts:18` → `pieceMaterialStep` cu `OFFERED_MATERIALS`; dump `PIECE_SOFA.material`.
- **Ce se intampla**: la canapea clientul e obligat sa aleaga intre PAL, MDF înfoliat, MDF vopsit, MDF furniruit, lemn masiv — descrierile vorbesc de „fronturi frezate”, „orice culoare RAL”. Cadrul unei canapele e lemn de fag / pin / placaj; clientul obisnuit nu stie ce sa aleaga, iar alegerea schimba scorul (PAL 1 … lemn masiv 4). Subtitlul „preferințele pentru tapițerie se salvează separat” e jargon.
- **Ce ar trebui**: la tapitate, intrebarea de material sa fie despre cadru (lemn masiv / placaj / „decide firma”) sau sa lipseasca; tapiteria e deja in 3D.
- **Propunere**: material dedicat tapitatelor + optiune „Nu știu, recomandă firma”; subtitlu: „Tapițeria (stofa, culoarea) ai ales-o la pasul 3D.”

### CP-06 · P2 · inconsecventa · Pat, bancuta si sezutul de hol „tapitate” nu au stofa / culoare; canapeaua are
- **Unde**: `furniture-config.ts:13–26` (pat: doar `upholstered: boolean`; bancuta: `upholsteredSeat`), `catalog-config.ts:21–22` (ENTRYWAY `upholsteredSeat`), vs `catalog-config.ts:9–12` (`upholsterySchema` doar pentru SOFA/ARMCHAIR/OTTOMAN).
- **Ce se intampla**: la canapea / fotoliu / taburet clientul alege textura (tesatura, bouclé, catifea), culoarea, fermitatea si picioarele; la pat, bancuta si mobilierul de hol doar bifeaza „tapițat”. Textul de la pat spune „Țesătura și culoarea le alegi împreună cu firma” (`ro.json:6038`). In plus, la piesele cu tapiterie descrierea nu mai contine finisajul lemnului (`config.ts:976`), dar la patul tapitat apare „finisaj stejar”.
- **Propunere**: reutilizeaza blocul de tapiterie (textura + culoare) oriunde exista „tapitat”.

### CP-07 · P2 · defect · Doua intrebari pentru acelasi lucru: maner / push in 3D si „Sisteme de deschidere” separat
- **Unde**: `v3.ts:105` (`withSystems` doar la TV, biblioteca, comoda), `v3.ts:121` (uneste `openingSystems` cu `frontStyle`), UI `configurator3d-step.tsx:789–799`.
- **Ce se intampla**: la comoda TV, biblioteca si comoda clientul alege „Push / Cu mâner” in 3D si apoi, pe alt ecran, „Mâner / Push / Glisante”. Raspunsurile contradictorii se aduna (ex. 3D cu maner + ecran push → itemul are MANER si PUSH, iar scorul ia maximul). La dulap, birou, noptiera, pantofar si la toate cele 7 piese de catalog al doilea ecran lipseste. „Glisante” apare la biblioteca / comoda, unde 3D-ul nu are usi glisante. Comentariul din cod recunoaste ca diferenta e istorica („doar unde exista chei i18n v1”, `v3.ts:83`).
- **Ce ar trebui**: o singura sursa (3D), la fel la toate piesele.
- **Propunere**: in v4 scoate `openingSystems` de la cele 3 piese; daca se pastreaza, preumple-l din 3D.

### CP-08 · P2 · defect · „Push” apare selectat in 3D dar nu ajunge la firma daca clientul nu apasa
- **Unde**: `configurator3d-step.tsx:795` (`value={config.frontStyle ?? 'PUSH'}`), `config.ts:162` (lipsa = PUSH), `v3.ts:136–137`, `config.ts:974–975`, `catalog-v1.ts:24–26`.
- **Ce se intampla**: configul implicit nu are `frontStyle`. UI-ul arata „Push” activ, modelul 3D deseneaza fronturi fara maner, dar derivarea adauga sistemul PUSH doar daca `frontStyle === 'PUSH'` explicit, iar descrierea nu scrie „deschidere push”. Clientul care accepta implicitul trimite o piesa fara sistem de deschidere (si cu scor SYSTEM 0).
- **Propunere**: trateaza lipsa ca PUSH la derivare / descriere, sau seteaza `frontStyle: 'PUSH'` in `defaultPieceConfig`. Selectorul de front ar trebui ascuns cand piesa nu are nicio usa / sertar.

### CP-09 · P2 · UX · Configul 3D implicit se salveaza singur → pasul obligatoriu trece fara nicio alegere
- **Unde**: `configurator3d-step.tsx:356–358`, `furniture-controls.tsx:47`.
- **Ce se intampla**: la intrarea pe pas, configul implicit e scris ca raspuns. Clientul poate apasa „Continuă” fara sa atinga nimic, iar firma primeste un dulap 240 x 240 x 60 cm, un pat 160 x 200, o masa 140 x 80 pentru 6 persoane etc. ca si cum ar fi fost alese. Nimic nu marcheaza „dimensiuni neconfirmate”.
- **Propunere**: cere o confirmare (ex. „Dimensiunile sunt orientative / le-am măsurat”), sau marcheaza in rezumatul firmei ca valorile sunt implicite.

### CP-10 · P2 · defect · Pe acelasi card firma vede doua seturi de dimensiuni care nu se potrivesc (m vs cm)
- **Unde**: `room-spec-card.tsx:112–114` (antet `lengthM × widthM × heightM m`) vs `:137` (chips din config, „{w} × {h} × {d} cm”) si descrierea „Configurat 3D: … cm”.
- **Ce se intampla**: antetul foloseste valorile din `deriveRoom`, care la unele piese nu sunt gabaritul piesei:
  - pat: antet „1.6 × 2 × 1 m” (latimea saltelei, `piece-bed.ts:88–91`) vs chips „173 × 100 × 220 cm”;
  - noptiere pereche: antet „0.9 × …” (latimea x 2, `v3.ts:114`) vs chips „45 × 55 × 40 cm”;
  - ordinea difera: antet L × A × H, chips L × H × A.
- **Propunere**: la piesele 3D antetul sa arate gabaritul din config, in cm, in aceeasi ordine; `lengthM` derivat poate ramane doar pentru scor.

### CP-11 · P2 · defect · Instantaneul PNG din 3D se pierde la reincarcare / continuarea ciornei
- **Unde**: `stores/configurator-store.ts:585–597` (`partialize` nu include `snapshots3d`), `review-step.tsx:188–203`.
- **Ce se intampla**: PNG-ul se tine doar in memorie. Daca clientul configureaza piesa, inchide pagina si publica mai tarziu (sau de pe alt dispozitiv), cererea pleaca fara imagine — fara avertisment. La fel daca a lucrat in modul „Câmpuri clasice” (PNG doar in modul 3D, `configurator3d-step.tsx:367`). Posibil si invers: un `snapshot3d` urcat la o publicare esuata ramane in raspunsuri chiar daca configul se schimba dupa (de verificat).
- **Propunere**: genereaza PNG-ul la publicare dintr-o scena randata din config, sau persista-l; arata in Sumar daca lipseste.

### CP-12 · P2 · inconsecventa · Pat ca piesa vs pat in Dormitor
- **Unde**: `furniture-config.ts:5`, `piece3d/config.ts:218–224` vs dump `BEDROOM.bedSize`, `bedCustomSize`.
- **Ce se intampla**: Dormitorul ofera 5 marimi, inclusiv „Dimensiuni custom” (latime 0,7–2,2 m, lungime 1,6–2,4 m); patul ca piesa are doar 4 marimi, toate cu lungime 200 (fara 120, 200 x 200, 90 x 190, saltele lungi). Inaltimea e fixa 100 cm, adancimea fixa 220 cm; nu se intreaba tablia (inaltime / tip), inaltimea somierei sau daca salteaua se cumpara.
- **Propunere**: adauga CUSTOM si inaltimea tabliei la piesa; aliniaza cu Dormitorul.

### CP-13 · P2 · inconsecventa · Comoda TV ca piesa nu poate fi suspendata; Living-ul intreaba asta
- **Unde**: `config.ts:264–275` (TV_UNIT `hasPlinth: true`, fara `legsOption`, fara cota de montaj) vs dump `LIVING.tvStyle` (`FLOATING` / `ON_FLOOR` / `COMPLEX_UNIT`).
- **Ce se intampla**: cea mai ceruta comoda TV (suspendata) nu se poate configura ca piesa; in Living e prima intrebare. Living permite inaltime 0,2–2,8 m si latime 1–5 m, piesa 25–90 cm si 100–360 cm. Corpul suspendat (WALL_CABINET) are cota de montaj, lavoarul la fel — comoda TV nu.
- **Propunere**: optiune „suspendată” cu cota de montaj (ca la WALL_CABINET) + picioare.

### CP-14 · P2 · inconsecventa · Birou ca piesa vs camera Birou
- **Unde**: `config.ts:313–324`, `v3.ts:268–292` vs dump `OFFICE.deskShape`, `OFFICE.dimensions`.
- **Ce se intampla**: camera Birou intreaba forma (drept / L / U) si latimi A 0,8–3 m, B/C 0,6–2,5 m, plus material si deschidere obligatorie; piesa are doar blat drept 80–240 cm, adancime 50–80, si nu intreaba deschiderea. „Canal pentru cabluri” exista doar la piesa. In cos si in titlul cererii ambele se numesc „Birou” (`ro.json:3619` si `:3630`; `requests.service.ts:952` si `:963`) — o cerere cu ambele devine „Birou + Birou — Oras”.
- **Propunere**: forma L in 3D; numele piesei „Birou (piesă)” peste tot (asa cum e deja in `Requests.roomType`, `ro.json:1186`).

### CP-15 · P2 · inconsecventa · Dulap ca piesa vs Dressing / dulapul din Dormitor / dulapul de hol
- **Unde**: `config.ts:251–263`, `v3.ts:161–200` vs dump `DRESSING.*`, `BEDROOM.wardrobeDoorType`, `HALLWAY` (`wardrobeWidth` 0,5–3 m).
- **Ce se intampla**:
  - inaltime piesa 180–280 cm; dressing 1,8–3,2 m → in apartamente vechi (tavan 3 m+) dulapul pana in tavan nu se poate configura;
  - usile glisante doar la 2–3 coloane, coloana max 100 cm (`config.ts:116–118`, `:347`) → un dulap glisant mai lat de ~3,07 m e imposibil, desi dulapurile glisante de 3,6 m (3 usi x 1,2 m) sunt uzuale;
  - fara usi (`OPEN` la Dressing) nu exista ca alegere globala; nici LED, pantalonar, sertare interioare (dressing `interiorModules`) — piesa nu are accesorii;
  - „Dulap până în tavan (tip dressing)” si punctul `WARDROBE_TO_CEILING` se deduc din inaltime ≥ 2,5 m (`v3.ts:188–192`), fara sa se stie inaltimea tavanului (nu se intreaba la piese).
- **Propunere**: inaltime pana la 3,2 m, glisante pana la 4 usi / 1,2 m, intrebare „Merge până în tavan?” sau inaltimea tavanului, accesorii ca la Dressing.

### CP-16 · P2 · inconsecventa · Mobilier lavoar ca piesa vs Baie: fara ventilatie, fara recomandare de material, gabarit nerealist
- **Unde**: `catalog-config.ts:44`, `:76–81`; dump `BATHROOM.ventilation`, `BATHROOM.materialVanity` (MDF înfoliat „recomandat” la baie neventilata).
- **Ce se intampla**: piesa nu intreaba ventilatia si nu recomanda nimic la material (PAL e primul, fara avertisment de umezeala). Cota de montaj suspendat 10–60 cm + inaltime corp 50–95 cm permite blatul la 155 cm; nu se verifica inaltimea de lucru (~85–90 cm). Tipul de lavoar (pe blat / incastrat / integrat) si cine aduce lavoarul si bateria nu se intreaba (doar nota „Pozitia instalatiilor se confirma la masuratori”). Blatul are doar „Deschis / Închis”.
- **Propunere**: ventilatie + recomandare ca la Baie; limiteaza cota + inaltimea la un blat de 75–95 cm; intrebare de lavoar.

### CP-17 · P2 · inconsecventa · Pantofar / bancuta / mobilier hol ca piese vs Hol
- **Unde**: `config.ts:276–287`, `catalog-config.ts:45`, `furniture-config.ts:92–93` vs dump `HALLWAY`.
- **Ce se intampla**: pantofar piesa 50–160 cm latime, Hol 0,4–2,5 m; bancuta piesa 60–200 cm, Hol 0,5–2 m; bancuta are inaltime (45 cm) si adancime (40 cm) fixe; „Mobilier hol” (cuiere 2–6, oglinda) duplica in parte „Cuier cu panou” + „Oglindă cu poliță” din Hol, dar cu alta denumire. In Hol se scrie „Bancuță” (fara ă: dump `HALLWAY.piecesNeeded`, `materialBench` „Material — bancuță”), la piesa „Băncuță”. Hol cere „Deschidere” obligatoriu la fiecare piesa; la piese nu se intreaba deloc (pantofar) sau se deduce: mobilierul de hol cu usi devine automat „MANER” fara ca clientul sa fi ales (`catalog-v1.ts:25`).
- **Propunere**: aceleasi limite si aceleasi denumiri; diacritice „Băncuță”; maner/push intrebat si la mobilierul de hol.

### CP-18 · P2 · UX · Masa: locurile nu sunt legate de lungime; extensibila fara lungimea extinsa; fara picioare / baza
- **Unde**: `furniture-config.ts:35–38`, `:82–90`; `furniture-controls.tsx:80–87`; `ro.json:6228`.
- **Ce se intampla**: textul de ajutor spune „8+ → peste 200 cm”, dar 8+ locuri se pot alege la 120 cm; implicitul e 6 locuri la 140 cm (textul spune 160–180). La extensibila nu se intreaba lungimea deschisa. Inaltimea e fixa per tip (75 / 45 / 80) — nu exista masa de bar sau consola de 90 cm. Tipul de picioare / baza (central, 4 picioare, cadru) nu se intreaba, desi e decisiv la masa. Lungimea se numeste „Lățime” in 3D (`furniture-controls.tsx:84`, `config3d.width`) desi pasul clasic v1 o numea „Lungime”.
- **Propunere**: avertizare / minim de lungime dupa locuri; lungime extinsa; baza mesei; eticheta „Lungime”.

### CP-19 · P2 · UX · Canapeaua nu intreaba ce intreaba orice firma: extensibila, colt in U / dublu, husa detasabila, mecanism
- **Unde**: `catalog-config.ts:8`, `:13–15`.
- **Ce se intampla**: doar 2–4 locuri, dreapta sau cu sezlong stanga/dreapta. Lipsesc: canapea extensibila (pat), colt in L cu doua laturi lungi / in U, husa detasabila, recliner, lada de depozitare. Culoarea tapiteriei ajunge la firma ca cod hex („Tapiterie: tesatura, #a69d8e”, `catalog-config.ts:121`).
- **Propunere**: adauga „Extensibilă (se face pat)?” si „Husă detașabilă?”; nume aproximativ al culorii langa hex.

### CP-20 · P2 · UX · Culoarea: „Finisaj (vizual)” e ambigua — e cerinta sau doar previzualizare?
- **Unde**: `config.ts:8–9` („`finish` de aici e doar paleta vizuala”), `ro.json:3803` „Finisaj (vizual)”, `:3895` „Finisaj vizual”, dar `config.ts:976–980` trimite firmei „finisaj stejar” / „finisaj personalizat (#b08d57)”.
- **Ce se intampla**: clientului i se spune ca e „vizual”, firma o primeste ca specificatie. Nicio camera nu intreaba culoarea / decorul, deci piesele sunt singurul loc unde apare — si acolo e ambigua. Implicitul „stejar” pleaca la firma si daca clientul nu a ales nimic (CP-09).
- **Propunere**: decide (PO) daca e cerinta; daca da, eticheta „Culoare / decor dorit” + „Nu știu încă”; daca nu, nu o trimite in descriere.

### CP-21 · P2 · UX · Corpul suspendat: fara usi rabatabile (sus), cota de montaj fara verificare de tavan
- **Unde**: `catalog-config.ts:41–43`, `config.ts:604`.
- **Ce se intampla**: zonele permise sunt doar usa si deschis — frontul rabatabil in sus (cel mai comun la corpuri suspendate) nu exista. Cota de montaj 30–220 cm + inaltime pana la 120 cm → partea de sus poate ajunge la 340 cm; nu se intreaba tavanul.
- **Propunere**: front rabatabil sus (AVENTOS exista deja in sisteme) si o limita / avertizare cota + inaltime ≤ tavan.

### CP-22 · P2 · inconsecventa · Unitati: piesele 3D doar in cm, camerele in m (cu comutator m/cm)
- **Unde**: `step-renderer.tsx:341–395` (camere: `dimensionUnit` m/cm), `configurator3d-step.tsx:78–144`, `furniture-controls.tsx:23–34` (doar cm), `room-spec-card.tsx:218` (dimensiunile camerelor afisate in m).
- **Ce se intampla**: clientul care a ales cm la o camera vede m in alta camera si cm la piese; firma vede m la camere si cm la piese pe acelasi rezumat.
- **Propunere**: piesele sa respecte `dimensionUnit` sau sa se treaca peste tot la cm.

### CP-23 · P3 · inconsecventa · Cantitatea: doar noptiera o intreaba
- **Unde**: `v3.ts:245–266` vs toate celelalte (cantitate 1 fixa; `catalog-v1.ts:30`).
- **Ce se intampla**: 2 fotolii identice, 6 corpuri suspendate etc. cer adaugarea a 2 / 6 instante si completarea fluxului de mai multe ori; noptiera are „Una / Pereche”. Numele tipului in cos si in titlu e „Noptiere” si la una singura (`ro.json:3635`, `requests.service.ts:967`: `one: 'Noptiere'`); doua instante „pereche” = titlul „2 Noptiere” pentru 4 noptiere.
- **Propunere**: cantitate (1–10) pe toate piesele; „Noptieră” la singular.

### CP-24 · P3 · inconsecventa · Sisteme de deschidere: obligatorii la camere, optionale / absente la piese
- **Unde**: `per-piece.ts:47–57` (`minSelected: 1`) vs `builder.ts:37–46` (`optional: true`).
- **Ce se intampla**: acelasi concept, alta regula. La piese clientul poate trimite fara nicio informatie despre deschidere (vezi si CP-08).

### CP-25 · P3 · text · Descrierea pentru firma e in romana fara diacritice si cu termeni amestecati
- **Unde**: `config.ts:937–982`, `catalog-config.ts:114–130`, `piece-bed.ts:18–21`.
- **Ce se intampla**: textul derivat („Configurat 3D: 240 x 240 x 60 cm, 3 coloane, 1 bara de haine, deschidere push”) apare la fel si in interfata EN; e fara diacritice, desi regula UI e „limba RO cu diacritice”. In etichetele catalogului, „deschis” inseamna si „deschis (fara usi)” si „deschis (culoare)”: „Depozitare: deschis”, „Blat: deschis”, „Pantofar: deschis” (`catalog-config.ts:119`). Comentariul vorbeste de „atelierele” (`config.ts:938`) — doar in cod, nu in UI.
- **Propunere**: mapare cu diacritice, „Polițe deschise” vs „Culoare deschisă”; varianta EN la randare din config (chips-urile o fac deja).

### CP-26 · P3 · text · Denumiri diferite pentru acelasi tip
- **Unde**: `ro.json:1178` vs `:3622`; `:1186` vs `:3630`; `en.json:1178` vs `:3622`; `requests.service.ts:954`, `:971`.
- **Ce se intampla**: „Alta piesa” se numeste „Piese individuale” in `Requests.roomType` si in titlul generat al cererii (`requests.service.ts:954`), dar „Altă piesă” in cos (EN: „Individual pieces” vs „Something else”). „Birou (piesă)” vs „Birou”. „Mobilier lavoar” la singular, „Corpuri lavoar” la plural; „Mobilier hol” / „Piese pentru hol”. Tab-ul din cos se numeste „Piese individuale” — acelasi nume cu tipul PIECES din alte ecrane.
- **Propunere**: un singur set de nume, folosit si de backend la titlu.

### CP-27 · P3 · UX · Imaginile din cos se repeta intre camere si piese
- **Unde**: `cart-visual.tsx:42–43` vs `:59–60`.
- **Ce se intampla**: „Baie” si „Mobilier lavoar” folosesc aceeasi celula de atlas (`vanity-sink`); „Hol / Intrare” si „Mobilier hol” aceeasi (`coat-unit`). In tab-uri diferite, dar in cosul din dreapta (ambele grupuri vizibile) apar identice. „Bufet” foloseste `mixed-storage`. Toate cele 28 de tipuri au imagine (fara lipsuri); doar „Altă piesă” e schita.
- **Propunere**: redari proprii pentru lavoar si mobilier hol (ca la canapea / fotoliu / taburet).

### CP-28 · P3 · UX · Limite si reguli discutabile in configuratorul de corpuri
- **Unde**: `config.ts:216–325`, `:80–118`, `:346–347`.
- **Ce se intampla**:
  - coloana pana la 100 cm cu polite de PAL 18 mm la biblioteca (`COLUMN_W_MAX 1.0`) — politele se curbeaza peste ~80 cm (subtitlul materialului avertizeaza, configuratorul permite);
  - comoda TV cu inaltime 25 cm: interior ~15 cm (soclu 6 + 2 x 1,8) — abia incape un sertar de 15 cm;
  - pantofar adancime minima 20 cm, dar fara front rabatabil (singurul care face 17–25 cm util; CP-01);
  - noptiera fara picioare / montaj suspendat (comoda si bufetul au picioare);
  - sertare interzise peste 160 cm — corect; bara de haine 55 cm adancime si 80 cm per bara — corect;
  - biroul: doua casetiere doar de la ~128 cm, latimea casetierei fixa 42 cm.
- **Propunere**: coloana max 80 cm la biblioteca (sau polita intarita); picioare la noptiera; inaltime minima comoda TV 35 cm.

### CP-29 · P3 · text · Comentarii vechi in registru (risc de confuzie la mentenanta)
- **Unde**: `flows/index.ts:159–160` („pat/masa/bancuta … raman pe v2”) si `v3.ts:25` — in realitate pornesc pe v3 (`index.ts:165–170`, `furniture-v3.ts`).

### CP-30 · P3 · inconsecventa · Fallback de material diferit la derivare
- **Unde**: `v3.ts:120` si `piece-*.ts` (`?? 'PAL'`) vs `catalog-v1.ts:30` (`?? 'ALTUL'`).
- **Ce se intampla**: daca materialul lipseste (draft vechi), piesele v3 devin PAL (scor 1), cele de catalog „Altul” (scor 2). In practica pasul e obligatoriu, deci impact mic; doar o nealiniere.

### CP-31 · P3 · UX · Lipsa „Nu știu / decide firma” la material in toate fluxurile de piese
- **Unde**: `builder.ts:24–33` (`OFFERED_MATERIALS`, obligatoriu).
- **Ce se intampla**: clientul care nu stie diferenta PAL / MDF trebuie sa ghiceasca; alegerea schimba estimarea (PAL 1 … lemn masiv 4 puncte = 3.000 lei diferenta de buget minim).
- **Propunere**: optiune „Recomandă firma” (scor mediu).

## 3. Tabel de consecventa — piesa × concept

Legenda: 3D = configurat in pasul 3D; Q = intrebare clasica; „—” = nu se intreaba. Dimensiuni in cm, cum le vede clientul.

| Piesa | Flux | Latime | Inaltime | Adancime | Material | Culoare | Deschidere | Picioare / baza | Interior | Altele | Observatii (text liber) | Fisiere | 3D |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dulap | v3 | 60–600 | 180–280 | 35–80 | Q (6) | 3D „vizual” | 3D maner/push + batante/glisante (2–3 col.) | soclu fix | polite / bara (≤3) / sertare | — | doar „Altul” la material | schita perete (7) | da |
| Comodă TV | v3 | 100–360 | 25–90 | 30–60 | Q | 3D | 3D maner/push + Q sisteme (dublura) | soclu fix (nu suspendat) | deschis/sertare/usa, max 2 zone | Q unde sta TV | idem | 7 | da |
| Bibliotecă | v3 | 40–400 | 80–280 | 20–50 | Q | 3D | 3D + Q (dublura) | soclu | polite/sertare/usa, 4 zone | — | idem | 7 | da |
| Birou | v3 | 80–240 | 68–80 | 50–80 | Q | 3D | 3D (fara Q) | 2 cm distantier | 0–2 casetiere | Q canal cabluri | idem | 7 | da |
| Pat | v3 | 103–202 (din saltea) | 100 fix | 220 fix | Q („cadru”) | 3D | — | — | ladă / sertare | saltea 4 marimi, tapitat (fara stofa) | idem | 7 | da |
| Comodă | v3 | 40–240 | 50–140 | 35–60 | Q | 3D | 3D + Q (dublura) | soclu / picioare | sertare/usa/deschis | — | idem | 7 | da |
| Masă | v3 | lung. dupa tip (50–300) | fix dupa tip | 40–120 | Q („blat”) | 3D | — | — (baza nu se intreaba) | — | tip, forma, locuri | idem | 7 | da |
| Pantofar | v3 | 50–160 | 50–180 | 20–40 | Q | 3D | 3D (fara Q) | soclu | usa/sertare/deschis | — | idem | 7 | da |
| Noptiere | v3 | 30–80 | 30–80 | 30–50 | Q | 3D | 3D (fara Q) | soclu fix | 1 coloana | Q cate (1/2) | idem | 7 | da |
| Băncuță | v3 | 60–200 | 45 fix | 40 fix | Q | 3D | — | — | stil (ladă/pantofi/simpla) | sezut tapitat (fara stofa) | idem | 7 | da |
| Bufet | cat. v1 | 60–300 | 60–120 | 30–60 | Q | 3D | 3D | soclu / picioare | usa/sertare/deschis | — | idem | 7 | da |
| Corp suspendat | cat. v1 | 40–300 | 30–120 | 20–50 | Q | 3D | 3D | cota montaj 30–220 | usa/deschis | — | idem | 7 | da |
| Mobilier lavoar | cat. v1 | 60–200 | 50–95 (podea ≥80) | 40–60 | Q (fara recomandare) | 3D | 3D push/manere | suspendat 10–60 / podea | sertare/usi/deschis | 1–2 lavoare, blat deschis/inchis | idem | 7 | da |
| Mobilier hol | cat. v1 | 80–240 | 160–240 | 35–55 | Q | 3D | dedus (usi → maner) | — | pantofar deschis/usi | cuiere 2–6, oglinda, polita, sezut tapitat | idem | 7 | da |
| Canapea | cat. v1 | 140–340 | 75–105 | 80–200 | Q „structura” PAL/MDF | 3D hex | — | 3D picioare (stejar/nuc/negru/baza) | — | locuri 2–4, sezlong, brate, perne, tesatura, fermitate | idem | 7 | da |
| Fotoliu | cat. v1 | 70–130 | 75–105 | 80–115 | Q „structura” | 3D hex | — | 3D | — | brate, tapiterie | idem | 7 | da |
| Taburet | cat. v1 | 40–140 | 35–50 | 40–140 | Q „structura” | 3D hex | — | 3D | — | forma, depozitare, tapiterie | idem | 7 | da |
| Altă piesă | v1 | — | — | — | Q dropdown (7, cu „MDF” legacy, „Altul” fara text) | — | 6 casute (cu legacy) | — | — | denumire, cantitate | **lipsa** | 7 | nu |

Piesa vs camera (acelasi obiect):

| Obiect | Piesa | Camera | Diferente principale |
|---|---|---|---|
| Dulap | 60–600 x 180–280 cm, usi in 3D | Dormitor: latime 0,6–6 m + `wardrobeDoorType` Q; Dressing: 1,8–3,2 m inaltime, usi incl. „Fără uși”, module (LED, pantalonar); Hol: 0,5–3 m | inaltime max, fara „fara usi”, fara accesorii, m vs cm |
| Comodă TV | 100–360 x 25–90, fara suspendat | Living: stil suspendat/podea/ansamblu, 1–5 m x 0,2–2,8 m, LED; Dormitor 0,8–4 m | suspendat, perete media, LED |
| Birou | drept 80–240 | Birou: drept/L/U, A 0,8–3, B/C 0,6–2,5 m, deschidere obligatorie | forma, canal cabluri doar la piesa |
| Pantofar / bancuta | 50–160 / 60–200 | Hol: 0,4–2,5 / 0,5–2 m, deschidere obligatorie | limite, „Bancuță” fara ă |
| Lavoar | fara ventilatie | Baie: ventilatie + MDF înfoliat recomandat | recomandare material |
| Pat / noptiere | 4 marimi saltea; noptiera 30–80 | Dormitor: 5 marimi (CUSTOM); noptiera 35–80 | CUSTOM lipsa |

## 4. Top 10 de schimbat (dupa impact)

1. **Verifica / adauga ponderile ROOM_TYPE pentru cele 7 piese de catalog** (CP-03) — altfel canapeaua costa cat un fotoliu, si mai putin decat doua noptiere.
2. **Repara textele din cos care promit optiuni inexistente** (birou pe colt, perete media, vitrine, pantofar rabatabil) (CP-01).
3. **„Alta piesa”: descriere libera + dimensiuni, materiale / sisteme curente** (CP-02).
4. **Scoate codurile brute din descrierea pentru firma** („SIX locuri”, „TV: TV_ON_WALL”) (CP-04).
5. **O singura intrebare de deschidere, iar implicitul „Push” sa ajunga la firma** (CP-07, CP-08).
6. **Marcheaza / confirma configul implicit; decide statutul culorii** (CP-09, CP-20).
7. **Dimensiuni coerente pe cardul firmei (gabarit real, cm, aceeasi ordine) si unitati unice** (CP-10, CP-22).
8. **Instantaneul PNG sa nu se piarda la reluarea ciornei** (CP-11).
9. **Aliniaza piesele cu camerele**: pat CUSTOM, comoda TV suspendata, birou in L, dulap pana la 3,2 m / glisant > 3 m, lavoar cu ventilatie (CP-12…CP-17).
10. **Tapitate: material de cadru potrivit, stofa la pat / bancuta, extensibila la canapea, cantitate pe toate piesele** (CP-05, CP-06, CP-19, CP-23).
