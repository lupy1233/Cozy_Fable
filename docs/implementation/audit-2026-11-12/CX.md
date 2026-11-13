# CX — Consecventa transversala a intrebarilor din formular (28 de fluxuri)

Agent: CX · 2026-11-12 · doar citire de fisiere (nu am rulat aplicatia, nu am deschis site-ul).
Surse: `AUDIT\flows-dump.json` (+ `.md`), `packages\shared\dist` (sloturile de dimensiuni calculate cu raspunsuri reale,
textele `info` / pro / contra), `packages\shared\src\questionnaire\flows\kitchen.v2.ts` / `kitchen.v3.ts`,
`packages\shared\src\questionnaire\piece3d\config.ts`, `apps\frontend\src\components\configurator\piece3d\configurator3d-step.tsx`,
`apps\frontend\src\messages\ro.json` / `en.json`.
Scripturi (le poti rula din nou): `AUDIT\scripts\CX\01..09-*.cjs`; iesirile brute sunt `AUDIT\scripts\CX\out-0*.txt`.
Matricea mare: `AUDIT\reports\CX-matrice.md`.

## 1. Ce am acoperit

Am verificat toate cele 28 de fluxuri curente, toate pasii (inclusiv cei ascunsi), toate optiunile, toate sloturile de
dimensiuni (calculate pe toate combinatiile de raspunsuri care le schimba), toate cele 719 texte unice din fluxuri plus
158 de texte pro / contra din `info`. Toate perechile RO / EN au fost citite, nu esantionate.

| flux | v | pasi (vizibili) | obligatorii | pasi cu `info` | optiuni cu `info` | acoperit | NU am acoperit |
|---|---|---|---|---|---|---|---|
| KITCHEN | 3 | 16 | 12 | 1 | 32/41 | tot | aspect vizual |
| DRESSING | 3 | 7 | 6 | 0 | 18/19 | tot | idem |
| LIVING | 3 | 24 | 22 | 1 | 51/67 | tot | idem |
| OFFICE | 2 | 16 | 15 | 0 | 35/43 | tot | idem |
| BEDROOM | 2 | 27 | 26 | 3 | 53/72 | tot | idem |
| BATHROOM | 2 | 10 | 9 | 1 | 15/24 | tot | idem |
| HALLWAY | 1 | 18 | 17 | 0 | 40/50 | tot | idem |
| PANTRY | 2 | 9 | 8 | 1 | 16/21 | tot | idem |
| LAUNDRY | 2 | 16 | 15 | 1 | 32/43 | tot | idem |
| BALCONY | 2 | 14 | 13 | 1 | 28/36 | tot | idem |
| PIECES | 1 | 2 | 1 | 0 | 0/0 | tot | interiorul controlului „lista de piese” |
| 10 piese v3 (WARDROBE…BENCH) | 3 | 4–6 | 3–4 | 0–1 | 5/6 … 8/12 | tot | textele din interiorul configuratorului 3D (doar sondaj) |
| 7 piese v1 (SIDEBOARD…OTTOMAN) | 1 | 4 | 3 | 0 | 5/6 | tot | idem |

„Obligatorii” = pasi vizibili fara `optional`, numarati pe tot fluxul (cu toate ramurile). Fluxurile camerelor sunt
scurte sau lungi in functie de piesele bifate: cu toate piesele, BEDROOM are 21 de intrebari (20 obligatorii), LIVING 18,
HALLWAY 13, OFFICE / LAUNDRY 12, KITCHEN 13, BALCONY 10, BATHROOM / PANTRY 7, DRESSING 6.

Verificari automate cu rezultat **zero** (deci curate): chei de traducere lipsa (0 in RO, 0 in EN, aceleasi 4.776 de chei in ambele
fisiere), sedila ş / ţ (0), „atelier” (0), „dumneavoastra / dvs.” (0), diacritice romanesti in EN (0), spatii duble (0),
cratima simpla in loc de linie de pauza (0). Diacritice lipsa in RO: nu am gasit niciun caz real (55 de alarme ale
euristicii, toate false).

## 2. Constatari

### CX-01 · P1 · defect · Blatul din bucatarie e obligatoriu, dar textul spune „Optional”
- **Unde:** KITCHEN v3, pasul `countertop` (`packages\shared\src\questionnaire\flows\kitchen.v2.ts:184-202`, refolosit de `kitchen.v3.ts:72`).
- **Ce se intampla:** pasul nu are `optional: true`, deci motorul (`engine.ts` `validateRoomAnswers`) il cere ca obligatoriu
  (`validation.answerRequired`). Subtitlul spune clientului ca e optional.
- **Dovada:** dump: `countertop [single-choice · obligatoriu]`; titlu „Ce blat preferi?”; subtitlu RO „Opțional — ajută firma să estimeze mai exact.” / EN „Optional — helps the company estimate more accurately.” Nu exista nici o optiune „Nu stiu / decide firma”.
- **Ce ar trebui:** textul si regula sa spuna acelasi lucru.
- **Propunere:** fie `optional: true` (cum sugereaza textul si cum sunt `appliances` si `sketch` din acelasi flux), fie scos „Opțional —” si adaugata o optiune „Nu m-am decis — recomanda firma”.

### CX-02 · P1 · inconsistenta · Usile dulapului sunt intrebate de doua ori in dormitor, cu doua valori diferite numite la fel „Glisante”
- **Unde:** BEDROOM: `wardrobeDoorType` (sc, OBL: SLIDING „Glisante” / HINGED „Batante”) si `systemsWardrobe` (mc, OBL, min 1: MANER / PUSH / GLISANTE „Glisante”).
- **Ce se intampla:** clientul poate alege „Batante” la primul ecran si „Glisante” la al doilea — firma primeste o contradictie. Eticheta „Glisante” apare pentru doua valori diferite: `SLIDING` (DRESSING.doorType, BEDROOM.wardrobeDoorType, PIECE_WARDROBE.doorType) si `GLISANTE` (toate cele 30 de intrebari `systems*` / `openingSystems`). In HALLWAY, dulapul (`WARDROBE` „Dulap de hol”) nu are deloc intrebare de tip usi, doar `systemsWardrobe` cu acelasi „Glisante”.
- **Dovada:** `GLISANTE` = „Glisante — Uși sau sertare pe șine”, info pros1: „Ușile glisante nu se deschid în cameră…”; `SLIDING` = „Glisante — Alunecă pe șine, fără spațiu de deschidere”.
- **Propunere:** tipul de usi intrebat o singura data (`wardrobeDoorType`), iar in `systems*` pentru dulap doar MANER / PUSH; „GLISANTE” din setul comun redenumit sau scos (sertarele sunt mereu pe glisiere — vezi CX-03).

### CX-03 · P1 · inconsistenta / UX · „Ce sistem de deschidere?” obligatoriu pentru piese fara usi si sertare
- **Unde:** 7 intrebari obligatorii (min 1 selectie, fara optiune „Fara”): LIVING `systemsShelves` („Rafturi suspendate — Montate pe perete, fără corp jos”), OFFICE `systemsShelves` („Rafturi perete”), LIVING `systemsCoffeeTable`, BEDROOM `systemsBed`, HALLWAY `systemsCoatUnit` („Cuier cu panou”), `systemsBench`, `systemsMirror` („Oglindă cu poliță”).
- **Ce se intampla:** subtitlul comun spune „Pentru ușile și sertarele acestei piese — poți alege mai multe.”, dar piesa nu are nici usi, nici sertare. Clientul e obligat sa bifeze ceva fals (Maner / Push / Glisante) ca sa treaca mai departe; firma primeste date inventate. Titluri: „Deschidere — oglindă”, „Deschidere — rafturi”, „Deschidere — cuier”.
- **Propunere:** scoase aceste intrebari (rafturi, cuier, oglinda) sau facute optionale cu optiunea „Fara usi / sertare”; la pat si masuta doar daca s-a ales depozitare (`bedStorage` ≠ NONE).

### CX-04 · P1 · inconsistenta · Setul de materiale de mobilier corp e impus si pe oglinda, canapea, fotoliu, taburet — cu pret „lei/ml”
- **Unde:** HALLWAY `materialMirror` („Material — oglindă”, OBL); PIECE_SOFA / PIECE_ARMCHAIR / PIECE_OTTOMAN `material` („Ce material dorești pentru structură?”, subtitlu „Materialul cadrului…”); PIECE_TABLE, PIECE_BED, LIVING `materialCoffeeTable`.
- **Ce se intampla:** toate primesc aceleasi 6 optiuni `common.materials.*`: PAL, „MDF înfoliat — Folie PVC pe fronturi frezate”, „MDF vopsit”, … cu explicatii despre fronturi si cu preturi „250–450 lei/ml” … „900–1800 lei/ml” (EN „RON/lm”). Pentru cadrul unei canapele sau rama unei oglinzi, „fronturi frezate” si pretul pe metru liniar nu au sens si pot induce in eroare la buget. „ml” se poate citi „mililitri”.
- **Propunere:** set de materiale pe tip de piesa (tapitate: lemn masiv / placaj / metal; oglinda: rama lemn / MDF / fara rama; masa: blat); pretul „pe metru liniar” afisat doar la corpuri.

### CX-05 · P1 · inconsistenta · Intrebarea „Ce material?” inseamna altceva in fiecare flux
- **Unde / dovada (textul exact):**
  - KITCHEN: doar fronturi — `frontMaterialBase` „Ce material vrei pentru fronturi?”; **corpul (carcasa) nu e intrebat deloc**.
  - DRESSING `material`: „Ce material?” / subtitlu „Materialul modulelor interioare.” — usile (`doorType` Glisante / Batante) nu au material.
  - 7 piese v1: „Ce material dorești pentru structură?” / „Confirmă materialul de execuție cu firma.”
  - PIECE_WARDROBE: „Alege materialul principal. Descrie în detaliile proiectului dacă vrei materiale diferite pentru corp și fronturi.”
  - PIECE_DRESSER: „Materialul corpului și al fronturilor.” · PIECE_TV_UNIT: „Pentru corpuri și panouri.” · PIECE_BED: „Materialul cadrului…”
  - 31 de intrebari de material din camere (LIVING, OFFICE, BEDROOM, HALLWAY, PANTRY, LAUNDRY, BALCONY): fara subtitlu, deci nu se stie daca e corp, front sau ambele.
- **Ce se intampla:** aceeasi valoare `MDF_VOPSIT` ajunge la firma o data ca material de front, o data ca material de corp, o data ca „principal”. Ofertele nu sunt comparabile intre camere.
- **Propunere:** o regula unica: „Material fronturi” (cu setul actual) + „Corp: PAL standard / la fel ca fronturile / decide firma”, aceeasi in camere si piese.

### CX-06 · P2 · inconsistenta · Sistemul de deschidere: patru seturi de optiuni, obligatoriu intr-un loc si optional in altul, dublat in 3D
- **Unde / dovada:**
  - KITCHEN `openingSystemsBase` / `Island`: MANER, PUSH, GOLA; `openingSystemsWall`: MANER, PUSH, GOLA, AVENTOS — OBL, min 1. Fara GLISANTE.
  - 27 de intrebari `systems*` in 7 camere: MANER, PUSH, GLISANTE — OBL, min 1. Fara GOLA.
  - PIECE_TV_UNIT / PIECE_BOOKCASE / PIECE_DRESSER `openingSystems`: MANER, PUSH, GLISANTE — **optional**, fara subtitlu, titlu „Sisteme de deschidere”.
  - Toate piesele v3 au in configuratorul 3D si comutatorul „Push (fără mâner)” / „Cu mâner” (`configurator3d-step.tsx:783-799`, comentariu „deschiderea fronturilor (toate piesele)”) — deci la TV_UNIT, BOOKCASE, DRESSER deschiderea e intrebata de doua ori, cu etichete diferite: „Push (fără mânere)” / „Mâner” in intrebare vs „Push (fără mâner)” / „Cu mâner” in 3D.
  - BATHROOM (corp lavoar, dulap oglinda, coloana — toate cu usi), DRESSING (usi batante), PIECES: **nicio** intrebare de deschidere.
- **Propunere:** un singur set comun, cu optiuni filtrate dupa piesa; o singura sursa (intrebarea sau 3D, nu ambele); aceeasi regula obligatoriu / optional peste tot.

### CX-07 · P2 · text · Aceeasi intrebare de material / deschidere scrisa in cinci stiluri
- **Dovada (numarate in dump):**
  - „Material — X” / „Deschidere — X” (eticheta, nu intrebare, fara subtitlu): LIVING, OFFICE, BEDROOM, HALLWAY — 21 + 21 de titluri (ex. „Material — comodă TV”, „Deschidere — oglindă”).
  - „Material pentru X” / „Deschidere pentru X”: PANTRY, LAUNDRY, BALCONY — 10 + 6 (ex. „Material pentru corpul cu cuvă”).
  - „Ce material pentru X?” cu subtitlu: BATHROOM — 3 (ex. „Ce material pentru coloană?” / „Poate fi alt material decât restul pieselor.”).
  - „Ce material?”: 10 piese v3 + DRESSING (EN „What material?” la piese, „Which material?” la DRESSING).
  - „Ce material dorești pentru structură?”: 7 piese v1 („dorești”, in rest „vrei”).
  - Deschidere: „Ce sistem de deschidere pentru corpurile de bază?” (KITCHEN) / „Deschidere — birou” / „Deschidere pentru dulapul înalt” / „Sisteme de deschidere”.
- **Propunere:** un singur sablon, intrebare cu subtitlu: „Ce material vrei pentru {piesa}?” si „Cum se deschid usile si sertarele la {piesa}?”.

### CX-08 · P2 · text · Aceeasi piesa are nume diferite de la un ecran la altul (RO si EN)
- TV_UNIT: optiunea „Comodă TV” (LIVING, BEDROOM), dar in LIVING titlurile si sloturile spun „zonă TV” („Material — zonă TV”, „Lățime zonă TV”), iar in BEDROOM „comodă TV”.
- BOOKSHELF: EN „Bookshelf” la optiune, „bookcase” la material / slot / piesa PIECE_BOOKCASE.
- WALL_SHELVES: „Rafturi suspendate” (LIVING) vs „Rafturi perete” (OFFICE); titlurile ambelor: „Material — rafturi”.
- OFFICE `STORAGE` „Dulap depozitare” → titlu „Material — dulap” (EN „storage”), identic in RO cu `materialWardrobe` din BEDROOM / HALLWAY („Material — dulap”, EN „wardrobe”).
- COAT_UNIT: „Cuier cu panou” / „Material — cuier” / slot „Lățime cuier/panou”; EN „Coat rack panel” / „coat rack” / „Coat panel width”.
- BATHROOM: „Corp lavoar” → „Ce material pentru corpul de lavoar?”; „Dulap oglindă” → „…dulapul cu oglindă?”.
- VANITY (BEDROOM): EN „Vanity table” la optiune, „vanity” la titluri si slot.
- DRESSING: „Dimensiunile dressingului”, slot „Înălțimea dressingului”, dar subtitlul „…înălțimea dulapului” si LED „Iluminare LED în interiorul dulapului”; EN „Closet height (H)” — „(H)” lipseste in RO.
- **Propunere:** un glosar de piese (o eticheta RO + EN per valoare) folosit in optiune, titluri, sloturi si sumar.

### CX-09 · P2 · inconsistenta · Aceeasi valoare cu etichete diferite; acelasi concept cu valori diferite
- `STRAIGHT`: „Liniară” (KITCHEN.layout) / „Drept” (OFFICE.deskShape); acelasi concept „pe un perete” mai are si valorile `LINEAR` „Liniar” (DRESSING) si `ONE_WALL` „Un perete” (PANTRY.wallsUsed) — trei valori pentru acelasi lucru.
- `L_SHAPE`: „În formă de L” (KITCHEN) / „În L” (DRESSING, OFFICE, PANTRY); EN „L-shaped” peste tot, dar „L-shape” / „U-shape” in PANTRY. Buton de informatii la L / U in KITCHEN, DRESSING, OFFICE, nu si in PANTRY.
- `PAL`: material „PAL” / EN „Chipboard (PAL)”; la blat „PAL” / EN „Laminated board”.
- Ventilatie (BATHROOM vs LAUNDRY, aceeasi intrebare): `FAN` EN „Extractor fan” / „Fan”; `WINDOW` „Aerisire naturală” / „Ventilație naturală”; `FAN` „Aerisire mecanică” / „Ventilație mecanică”; titlu „Baia este ventilată?” / „Încăperea este ventilată?”.
- `NONE`: „Fără” (bedStorage) / „Neventilată” (ventilation). `DRAWERS`: „Sertare” (DRESSING) / „Sertare laterale” (bedStorage). `STORAGE`: „Dulap depozitare” (OFFICE) / „Dulapuri depozitare” (LAUNDRY).
- Etichete identice pentru valori diferite: „Glisante” (`SLIDING` vs `GLISANTE`, vezi CX-02); „Blat de lucru” (`COUNTERTOP` in LAUNDRY vs `WORKTOP` in BALCONY).
- Ordinea optiunilor: nu am gasit acelasi set in ordini diferite.

### CX-10 · P2 · inconsistenta · Unitati de masura amestecate: m in camere, cm in 3D si in saltele
- Toate sloturile din camere sunt in **m** (ex. „Înălțime tavan” 2..4 m pas 0.05; „Lățime noptieră” 0.35..0.8 m pas 0.1).
- Configuratorul 3D afiseaza **cm** („{w} × {h} × {d} cm”, „Sertarele nu pot sta peste 160 cm”).
- BEDROOM `bedSize`: optiuni „90 × 200” … „180 × 200” (cm, fara unitate scrisa), dar „Dimensiuni custom” → `bedCustomSize` cere **m** (`bedCustomWidth` 0.7..2.2 m, `bedCustomLength` 1.6..2.4 m).
- Textele `info` folosesc cm („Cer circa 50 cm liberi în față”, „Păstrează cel puțin 80 cm”).
- Detaliu: `nightstandWidth` porneste de la 0.35 cu pas 0.1 (0.35, 0.45, …) — de verificat daca 0.40 / 0.50 se pot introduce.
- **Propunere:** cm peste tot in interfata (clientii masoara cu ruleta in cm), conversie interna in m.

### CX-11 · P2 · lipsa · Inaltimea tavanului si adancimea lipsesc unde conteaza; subtitlurile promit alte masuri decat cele cerute
- Inaltime tavan: ceruta in 9 din 10 camere (DRESSING are in schimb `wardrobeHeight`), in **0 din 17** piese — inclusiv dulap (pana la 2.8 m), biblioteca (pana la 2.8 m). Singura mentiune: PIECE_BOOKCASE `sketch` „Opțional — lățimea peretelui și înălțimea tavanului.”
- Adancime: ceruta doar la insula (KITCHEN) si balcon.
- Inaltime pe piesa: LIVING cere latime + inaltime pentru fiecare piesa; OFFICE, BEDROOM, BATHROOM, HALLWAY doar latime.
- BEDROOM `dimensions` subtitlu „Spațiul disponibil și înălțimea camerei.”, iar HALLWAY „Lățimea fiecărei piese alese.” — dar HALLWAY cere si `ceilingHeight`. KITCHEN subtitlu „Măsoară lungimea fronturilor…” in timp ce sloturile sunt „Lungimea laturii A/B/C” (fronturi ≠ laturi).
- **Propunere:** inaltimea tavanului ca slot optional si la piesele inalte; subtitluri generate din sloturile reale.

### CX-12 · P2 · lipsa · Concepte pe care firma le are nevoie si formularul nu le intreaba (sau doar intr-un flux)
Din matricea `CX-matrice.md` (acoperire din 28 de fluxuri):
- **Culoare / finisaj:** 0 din 10 camere (exista doar in 3D la cele 17 piese). La bucatarie, „MDF vopsit — Orice culoare RAL” nu e urmat de nicio intrebare de culoare.
- **Stil** (modern, clasic, scandinav…): 0/28.
- **Observatii libere pe camera:** 0 (doar LIVING `piecesOtherText` cand alegi „Altceva”); descrierea exista o singura data pe cerere, la Date generale. PIECE_WARDROBE trimite clientul acolo: „Descrie în detaliile proiectului…”.
- **Buget pe camera:** 0 (doar global, `budgetRange`).
- **Iluminat LED:** doar LIVING (`ledPieces`, optional) si DRESSING (optiune in `interiorModules`) — nu in bucatarie (sub corpuri suspendate), dulap din dormitor, dulap cu oglinda din baie.
- **Electrocasnice:** doar KITCHEN (`appliances`, optional, fara „incorporabil / independent”); LAUNDRY are `applianceSetup` (alt control, alt concept).
- **Picioare / soclu:** doar in 3D la comoda si bufet.
- **Bucatarie:** nu se intreaba chiuveta, corpul (carcasa — CX-05), inaltimea corpurilor suspendate.
- **Propunere:** un pas comun la finalul fiecarei camere: culoare / finisaj (cu „decide firma”), stil, observatii (text liber).

### CX-13 · P2 · UX · Nicio iesire de tip „Nu stiu inca / las firma sa propuna”
- Singura optiune de acest tip din toate cele 28 de fluxuri: `PIECE_TV_UNIT.tvSetup` „Nu m-am decis”.
- Obligatorii fara iesire: 52 de intrebari de material, 30 de deschidere (27 `systems*` + 3 in KITCHEN), `countertop`, `layout` (2), `doorType`, `wardrobeDoorType`, `bedSize`, `bedStorage`, `ventilation` (2), `enclosed`, `wallsUsed`, `storageStyle`, `applianceSetup`, `deskShape`, `tvStyle`, `nightstandsCount` / `count`.
- Optiunea „Altul” la material obliga apoi la text (`*Other`, OBL, max 120 caractere) — nu e o iesire, e inca o intrebare.
- **Propunere:** la material si deschidere, optiunea „Nu stiu — vreau recomandarea firmei” (fara text obligatoriu).

### CX-14 · P2 · UX · Lungimea fluxurilor creste liniar cu numarul de piese: doua ecrane obligatorii pe piesa
- In camerele cu piese (LIVING, OFFICE, BEDROOM, HALLWAY, LAUNDRY, BALCONY, PANTRY), fiecare piesa bifata adauga `material*` (OBL) + `systems*` (OBL) (+ `*Other` daca „Altul”).
- BEDROOM cu toate cele 6 piese: 21 de intrebari, 20 obligatorii (12 doar pentru material si deschidere). Comparabil: BATHROOM 7, PANTRY 7, o piesa v3 3–4.
- **Propunere:** o intrebare „Acelasi material si aceeasi deschidere pentru toate piesele?” (da = un singur ecran), ca bifa `separateFrontMaterials` din KITCHEN.

### CX-15 · P2 · text · Trei generatii de design vizibile in acelasi formular
- Titlurile configuratorului 3D: v1 „Configurează: Bufet” / „Configurează: Taburet tapițat” (EN „Create your sideboard” — alta structura); v3 „Construiește-ți dulapul în 3D” (7 piese); v3 „Creează patul tău” / „Creează masa ta” / „Creează băncuța ta”.
- Subtitlurile v1 (7) sunt liste fara punct final („Dimensiuni, șezlong, perne și tapițerie”); celelalte 106 subtitluri au punct.
- Material v1 „Ce material dorești pentru structură?” + subtitlu generic „Confirmă materialul de execuție cu firma.” vs v3 „Ce material?” + subtitlu specific piesei.
- Piesele v1 nu au deloc intrebare de deschidere; v3 au (3 din 10) sau o au doar in 3D.
- In chei: `flows.KITCHEN.v3.frontMaterial.title` / `.subtitle` (singurele chei cu `vN` in fluxurile curente).

### CX-16 · P2 · text · Preturile din explicatii au cel putin sase formate
- RO: „600–1100 lei/ml” si „900–1800 lei/ml” (fara punct de mii) vs „3.000–7.000 lei”, „+400–1.200 lei” (cu punct); „ml” = metru liniar, neexplicat.
- EN: „250–450 RON/lm” · „RON 150–300/lm” · „+RON 3,000–8,000” · „+800–2,000 lei” · „2,000–5,000 lei” · „+250–450 lei / drawer” (cu spatii in jurul barei).
- Exemple: `common.materials.PAL.info.price` „250–450 lei/ml” / „250–450 RON/lm”; `flows.KITCHEN.countertop.options.PAL.info.price` „150–300 lei/ml” / „RON 150–300/lm”; `flows.DRESSING.interiorModules.options.DRAWERS.info.price` „+250–450 lei / sertar” / „+250–450 lei / drawer”.
- **Propunere:** un singur formatter de pret (Intl.NumberFormat) si o singura unitate („lei / m liniar”).

### CX-17 · P2 · text · Sfaturi contradictorii despre umezeala intre doua intrebari identice
- BATHROOM `ventilation.info.body`: „…În acest caz recomandăm MDF, care ține mai bine la umezeală…” (orice MDF, inclusiv vopsit / furniruit).
- LAUNDRY `ventilation.info.body`: „…în acest caz recomandăm MDF înfoliat, care o suportă mai bine.”
- BALCONY `enclosed.options.OPEN.info.cons1`: „PAL-ul și MDF-ul nu rezistă aici, nici înfoliate”.
- **Propunere:** acelasi text de recomandare (MDF înfoliat) in baie si spalatorie.

### CX-18 · P3 · text · Subtitluri lipsa unde intrebarea „sora” are
41 de pasi vizibili fara subtitlu, intre care toate cele 31 de intrebari de material din camerele LIVING, OFFICE, BEDROOM, HALLWAY, PANTRY, LAUNDRY, BALCONY (in BATHROOM cele trei au subtitlu; la piese, toate), plus BEDROOM `bedCustomSize`, `bedStorage` „Depozitare sub pat?”, `bedUpholstered` „Pat tapițat?”, `nightstandsCount`; PIECE_TV_UNIT `tvSetup`, `openingSystems`; PIECE_BOOKCASE / PIECE_DRESSER `openingSystems`; PIECE_DESK `cableManagement`; PIECE_NIGHTSTAND `count`.

### CX-19 · P3 · text · Titluri care nu sunt intrebari printre intrebari; ton imperativ vs intrebare
- 93 de titluri nu se termina cu „?”: cele 58 „Material/Deschidere — / pentru …” (CX-07), 8× „Dimensiuni”, „Câteva dimensiuni”, „Dimensiunile dressingului”, „Dimensiunile saltelei tale”, „Materiale diferite pe zone”, 3× „Sisteme de deschidere”, 3× „Încarcă proiectul sau schița ta”, 17 titluri de configurator 3D.
- Pasul de schita are 7 formulari: imperativ „Încarcă proiectul sau schița ta” (KITCHEN, BATHROOM, PIECES) vs intrebare „Ai o schiță?” / „Ai o schiță a spațiului?” / „…a camerei?” / „…a holului?” / „…a peretelui?” / „…a debaralei?” / „…a balconului?”.
- „Ce piese îți trebuie?” (LIVING, OFFICE, BEDROOM, BATHROOM, PIECES) vs „De ce piese ai nevoie?” (HALLWAY, BALCONY) vs „Ce mobilier îți trebuie?” (LAUNDRY); EN e identic la 7 din 8.
- Vocea „noi” ca si cum platforma ar monta: PANTRY `wallsUsed` „Pe câți pereți montăm?” (EN „How many walls do we use?”), KITCHEN `frontMaterialBase` „Îl folosim la toată bucătăria.” / „We use it for the whole kitchen.”
- Lungimi: titluri intre 10 („Dimensiuni”) si 52 de caractere („Ce material pentru fronturile corpurilor suspendate?”); subtitluri intre 19 („Structura băncuței.”) si 114.

### CX-20 · P3 · text · Gramatica si anglicisme in etichete
- PANTRY sloturi „Lungime latura A/B/C” (corect „Lungimea laturii A”, cum e in KITCHEN / DRESSING); EN „Side A length” vs „Run A length”.
- LIVING sloturi „Lățime piesa ta” / „Înălțime piesa ta” (corect „Lățimea piesei tale”); titluri „Material — piesa ta”, „Deschidere — piesa ta”.
- Anglicisme in RO: „Dimensiuni custom” (BEDROOM `bedSize:CUSTOM`, fara buton de informatii), „Walk-in” (are info), „previzualizare showroom” (PIECE_TABLE config3d), „King” (bedSize K_180), „Push” (are info), „live” (PIECE_BOOKCASE config3d).
- Termeni tehnici fara explicatie: „casetierele” (PIECE_DESK config3d), „rabatabile” (PIECE_SHOE_CABINET config3d), „Corp cu cuvă” / „Dulap încastrare” (LAUNDRY — toate optiunile `piecesNeeded` au `info` = nu), „soclu” (doar in descrierea `tvStyle:ON_FLOOR`), „ml”. Au explicatie: Gola, Aventos, furnir, PAL, MDF, HPL, push, walk-in, termopan, batante. Niciuna din cele 32 de optiuni `piecesNeeded` din camere nu are buton de informatii.

### CX-21 · P3 · text · RO si EN nu spun acelasi lucru (toate cele 877 de perechi citite)
- `flows.PIECE_*.config3d.title` (v1, 7×): „Configurează: Bufet” / „Create your sideboard”.
- `flows.PIECE_SOFA.config3d.subtitle`: „Dimensiuni, șezlong…” / „Custom size, chaise…” (idem ARMCHAIR).
- `flows.PIECE_WALL_CABINET.config3d.subtitle`: „…cu montaj suspendat” / „…above the floor”.
- `flows.DRESSING.interiorModules.options.DRAWERS.info.body`: „Amortizarea merită în zonele folosite zilnic.” (in RO se poate intelege „se amortizeaza investitia”, cum e in `SHELVES`: „se amortizează repede” / „pay off quickly”) / „Soft-close is worth it in daily-use zones.”
- `flows.DRESSING.dimensions.slots.wardrobeHeight`: „Înălțimea dressingului” / „Closet height (H)”.
- Material v1, subtitlu: „…cu firma.” / „…with the maker.” (in rest EN spune „company”).
- `flows.DRESSING.doorType.subtitle`: „Alege sistemul de acces.” / „Pick the access system.” (intelegere greoaie in ambele).
- EN amesteca engleza britanica si americana: „colour”, „centre”, „metre”, „aluminium”, „organising” vs „closet”, „meter” (`PANTRY…OPEN_SHELVES.info.pros2` „per meter of shelving”), „millimeter” (`LAUNDRY…STACKED.info.cons1`), „Organizing the cables” (`PIECE_DESK.cableManagement.info.title`).
- EN ramas netradus: nimic in afara numerelor si „Gola”, „Walk-in”, „HPL”, preturilor in „lei” (care in alte chei EN sunt „RON”, CX-16).

### CX-22 · P3 · UX · „Pat tapițat?” e da / nu obligatoriu, fara subtitlu si fara eticheta de card
- BEDROOM `bedUpholstered` (bool, OBL, info). Singurul boolean obligatoriu din 4; celelalte (`hasIsland`, `separateFrontMaterials`, `cableManagement`) sunt optionale si doua au eticheta de card. De verificat in interfata cum se inregistreaza „Nu” (daca controlul porneste fara valoare, clientul trebuie sa apese explicit „Nu”).

### CX-23 · P3 · text · Texte in afara formularului (ro.json / en.json, cautari tintite)
- „atelier”: 0 · „dumneavoastră / dvs.”: 0 · sedila ş / ţ: 0 · „offer / quote / dashboard / submit / lead / upload / feedback”: 0.
- **„draft” — 13 valori, toate in `Studio`**: `Studio.myDrafts` „Drafturile mele”, `Studio.saveAsNew` „Salvează ca draft nou”, `Studio.draftSaved` „Draft salvat în cont.”, `Studio.deleteDraft` „Șterge draftul”… In rest aplicatia spune „ciornă” (9 valori: `Requests.statusValue.DRAFT` „Ciornă”, `Requests.next.line.DRAFT` „cererea e încă o ciornă…”, 4 in `Configurator`, 1 in `Quotes`).
- „claim”: 2 valori, doar in `Admin.settings.creditCostRange` / `creditCostNoMax`, ca nume tehnic de setare in `<code>` — acceptabil.
- „request”: 2, ambele placeholdere ICU (`{requests, plural…}`, `{request}`) — nu e text vizibil.
- Ton amestecat: `Fulfillment.projectCase.reportIntro` „Dacă cealaltă parte nu mai răspunde sau **vreți** să renunțați de comun acord, **anunță-ne**.” (plural + singular in aceeasi fraza); `Fulfillment.agreement.title` „Acordul vostru” (singurul „vostru” din aplicatie; adresat ambelor parti, probabil intentionat).
- Anglicisme: „Walk-in” (si `Admin.sizing.options.DRESSING_LAYOUT.WALK_IN`, `Inspiration.pins.dressing-walkin-oak` „Dressing walk-in din stejar”), „Dimensiuni custom”, „showroom”.
- „email” scris consecvent fara cratima (52× „email”, 16× „emailul” etc.) — consecvent, doar notez.
- EN: 0 valori cu diacritice romanesti; 4 valori identice cu RO, toate sabloane fara text (ex. `Meta.titleTemplate` „%s · Cozy Home”).

## 3. Tabel de consecventa (rezumat; matricea completa in `CX-matrice.md`)

| Concept | Camere (din 10) | Piese (din 18) | Cum e intrebat — diferentele |
|---|---|---|---|
| Forma / asezare | 4 (KITCHEN, DRESSING, OFFICE birou, PANTRY) + LAUNDRY `applianceSetup` | in 3D | 4 valori pentru „un perete” (STRAIGHT, LINEAR, ONE_WALL); „În formă de L” vs „În L” |
| Dimensiuni | 10 (`dimensions`, m) | 17 in 3D (cm) + PIECES | m vs cm; saltea cm vs m |
| Inaltime tavan | 9 (lipsa DRESSING) | 0 | — |
| Material corp | 9 (lipsa KITCHEN) | 17 + PIECES in lista | 5 stiluri de titlu; inteles diferit (CX-05) |
| Material fronturi separat | KITCHEN | DRESSER (in subtitlu) | — |
| Culoare / finisaj | 0 | 17 (3D) | — |
| Deschidere | 8 (lipsa BATHROOM, DRESSING) | 3 intrebari optionale + 3D la v3 | 4 seturi; OBL vs opt; dublat in 3D |
| Tip usi | DRESSING, BEDROOM | WARDROBE (ascuns + 3D) | dublat cu `systems*` in BEDROOM |
| LED | LIVING, DRESSING | 0 | mc separat vs optiune intr-un mc |
| Electrocasnice | KITCHEN, LAUNDRY | 0 | mc optional vs sc obligatoriu |
| Blat | KITCHEN (sc, OBL dar „Opțional”), LAUNDRY / BALCONY (ca material) | VANITY (3D) | 3 controale diferite |
| Ventilatie / mediu | BATHROOM, LAUNDRY, BALCONY | 0 (nici PIECE_BATHROOM_VANITY) | etichete diferite pt. aceleasi valori |
| Observatii libere | 0 (LIVING doar la „Altceva”) | 0 | doar global |
| Buget | 0 | 0 | doar global |
| Schita | 10 | 18 | 7 formulari de titlu, toate optionale, max 7 fisiere |

## 4. Top 10 de schimbat (in ordinea impactului)

1. **CX-01** — blatul: fie optional, fie fara „Opțional” in text (azi blocheaza clientul cu un mesaj care il minte).
2. **CX-03** — scoase intrebarile obligatorii de deschidere la oglinda, rafturi, cuier, bancuta, pat, masuta (firma primeste date inventate).
3. **CX-02** — usile dulapului intrebate o singura data; „Glisante” sa nu mai insemne doua lucruri.
4. **CX-05** — o definitie unica pentru „material” (fronturi vs corp) in toate fluxurile; intrebat corpul si la bucatarie.
5. **CX-04** — seturi de materiale potrivite piesei (tapitate, oglinda, masa) si fara „lei/ml” acolo.
6. **CX-13** — optiunea „Nu stiu — recomanda firma” la material, deschidere, blat, forma.
7. **CX-14** — „Acelasi material / aceeasi deschidere pentru toate piesele?” ca sa scurteze dormitorul (21 de intrebari) si livingul.
8. **CX-12** — un pas comun pe camera: culoare / finisaj, stil, observatii libere.
9. **CX-10 / CX-11** — cm peste tot in interfata; inaltimea tavanului si la piesele inalte; subtitluri de dimensiuni generate din sloturile reale.
10. **CX-07 / CX-08 / CX-16** — un sablon de titlu, un glosar de nume de piese RO + EN, un singur format de pret.
