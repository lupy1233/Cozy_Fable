# Etapa 6 — proiectarea versiunii noi a formularului (material și deschidere)

Probleme: 27 `c2`, 28 `c1`, 51 `c7`, 53 `c14` + a doua parte din 4 `c6`, 20 `c10`, 24 `c3` + costul fix.
Sursa hotărârilor: `docs/implementation/plan-reparatii-2026-11-13/etapa-06.md` (răspunsurile PO sunt FINALE),
`etapa-05.md` §20, §24, `etapa-01.md` §4. Baza de cod citită: ramura `claude/reparatii-etapa-06` (din `2084da9`).

Pașii „Acum, fără versiune nouă” (27/1, 28/1, 51/1, 53/1) îi face agentul separat `e6-now` (deja gata, raport în
`etapa-06/rapoarte/e6-now.md`: subtitluri, „lei pe metru liniar”, contorul „x / 120”, ecranul Fronturi al bucătăriei pe
zone în `kitchen-front-zones.ts`). Proiectul de mai jos NU îi refolosește fișierele, cu o excepție: ecranul pe zone al
bucătăriei funcționează pe id-uri de pas, deci se aplică și bucătăriei v4 (id-urile rămân aceleași).

Reguli de fier (repetate pentru agenți):
- Versiunile existente sunt ÎNGHEȚATE: niciun fișier `*.vN.ts` existent, `per-piece.ts`, `pieces-flow.ts`, `builder.ts`,
  `v2.ts`, `v3.ts`, `furniture-v3.ts`, `catalog-v1.ts` nu se modifică (excepție: `guided-pieces/index.ts` primește exporturi).
  Testul `score-invariance.test.ts` + `__snapshots__/score-invariance.json` și `firm-text.json` rămân identice pentru versiunile vechi.
- Doar camerele adăugate după lansare primesc versiunea nouă (`CURRENT_FLOW_VERSION`); ciornele și cererile publicate își păstrează `flowVersion`.
- Nicio schimbare de schemă. Toate răspunsurile noi se salvează pe valorile de enum existente (`Material`, `ItemSystem`).
  Un singur rând nou de scor (blatul bucătăriei „decide firma”), în `seed.ts` și într-o migrare doar cu `INSERT … ON CONFLICT DO NOTHING`
  (adminul poate doar edita rânduri existente — confirmat de migrarea etapei 5 `20261114100000_piece_weights_room_approx_length`).
- Texte RO + EN doar prin fragmente i18n (`etapa-06/i18n/<id>.{ro,en}.json`, imbinate cu `merge-i18n.cjs`).

---

## 1. Inventarul celor 28 de fluxuri

Toate cele 28 au nevoie de versiune nouă: fiecare are cel puțin o întrebare de material care primește „Nu știu — vreau
recomandarea firmei” (o opțiune nouă = altă validare, deci altă versiune; versiunile vechi trebuie să o respingă).
Nu există flux care să poată rămâne pe versiunea curentă.

| # | RoomType | Curent | Nou | Fișier nou | Schimbarea principală |
|---|---|---|---|---|---|
| 1 | KITCHEN | 3 | 4 | `flows/kitchen.v4.ts` | seturi noi + „decide firma” (material, deschidere, blat), pistoane la suspendate, „Corp: PAL standard” |
| 2 | DRESSING | 3 | 4 | `flows/dressing.v4.ts` | deschidere doar la uși batante, pe ecranul materialului |
| 3 | LIVING | 3 | 4 | `flows/living.v4.ts` | constructor nou, tabel fronturi, pistoane la comoda TV, întrebarea comună |
| 4 | OFFICE | 2 | 3 | `flows/office.v3.ts` | constructor nou, „Fără uși sau sertare” la birou / bibliotecă |
| 5 | BEDROOM | 2 | 3 | `flows/bedroom.v3.ts` | uși dulap o dată (c3), pat cu deschidere doar la sertare, regrupare ecrane (≤ 10) |
| 6 | BATHROOM | 2 | 3 | `flows/bathroom.v3.ts` | deschidere nouă pe fiecare piesă, „Integral din MDF” |
| 7 | PANTRY | 2 | 3 | `flows/pantry.v3.ts` | material + deschidere pe un ecran la dulapuri |
| 8 | LAUNDRY | 2 | 3 | `flows/laundry.v3.ts` | setul de blaturi la blat (c6), constructor nou |
| 9 | BALCONY | 2 | 3 | `flows/balcony.v3.ts` | setul de blaturi, „Integral din MDF”, constructor nou |
| 10 | HALLWAY | 1 | 2 | `flows/hallway.v2.ts` | uși dulap (nou), cuier / oglindă fără deschidere, setul oglinzii |
| 11 | PIECES („Altă piesă”) | 1 | 2 | `flows/pieces.v2.ts` | dimensiuni opționale în cm, liste după regula unică (c10) |
| 12–18 | PIECE_WARDROBE, PIECE_TV_UNIT, PIECE_BOOKCASE, PIECE_DESK, PIECE_DRESSER, PIECE_SHOE_CABINET, PIECE_NIGHTSTAND | 3 | 4 | `flows/guided-pieces/v4.ts` | o singură sursă de deschidere (3D), „decide firma” la material, pistoane la comoda TV |
| 19–21 | PIECE_BED, PIECE_TABLE, PIECE_BENCH | 3 | 4 | `flows/guided-pieces/furniture-v4.ts` | setul de lemn (pat, masă), setul de plăci (bancă) |
| 22–28 | PIECE_SIDEBOARD, PIECE_WALL_CABINET, PIECE_BATHROOM_VANITY, PIECE_ENTRYWAY, PIECE_SOFA, PIECE_ARMCHAIR, PIECE_OTTOMAN | 1 | 2 | `flows/guided-pieces/catalog-v2.ts` | tapițatele fără întrebare de material; pistoane la bufet / corp suspendat; MDF integral la lavoar |

Fișierele vechi rămân înregistrate în `FLOW_REGISTRY` (cererile vechi se rezumă, se editează și dau același scor).

---

## 2. Seturile de opțiuni noi — `packages/shared/src/questionnaire/flows/finish-sets.ts` (fișier NOU)

Nu se atinge `common.ts` (îl importă fluxurile înghețate). `finish-sets.ts` importă din `common.ts` doar `materialOptions` /
`systemOptions` ca să refolosească cheile de info existente.

### 2.1 Valori speciale (string-uri în răspunsuri, NU valori de enum)
| Constantă | Valoare | Unde apare |
|---|---|---|
| `FIRM_DECIDES` | `'FIRM_DECIDES'` | material (toate seturile), deschidere (toate listele), blatul bucătăriei |
| `NO_FRONTS` | `'NO_FRONTS'` | deschidere, doar la piesele „poate” |
| `PISTONS` | `'PISTONS'` | deschidere, doar la bucătărie (suspendate) și piesele cu pistoane |
| `MDF_INTEGRAL` | `'MDF_INTEGRAL'` | material, doar la baie și balcon (+ mobilierul de lavoar din catalog) |

Marcajul „decide firma” = valoarea `FIRM_DECIDES` chiar în răspunsul pasului (nu text). Derivarea o transformă în enum (2.4).
Nicio valoare nouă de enum: `Material` și `ItemSystem` din `schema.prisma` / `enums.ts` rămân neschimbate.

### 2.2 Seturile de material (`MaterialSetKind = 'BODY' | 'PANEL' | 'WOOD' | 'MIRROR' | 'WORKTOP'`)

Funcție: `materialSetOptions(kind: MaterialSetKind, opts?: { integralMdf?: boolean }): ChoiceOption[]`.
„Prețul pe metru liniar doar la corpuri” se face din constructorul opțiunilor (`info` fără `priceHintKey`), nu printr-un
steag nou pe pas: `CompactChoiceCard` și dialogul Info arată prețul doar dacă `priceHintKey` există. Zero cod nou în interfață.

**BODY — corpuri cu fronturi** (titlu „Material pentru fronturi (uși și sertare)”, subtitlu cu corpul PAL standard; CU preț pe ml)
| id opțiune | salvat ca (`Material`) | text RO scurt | descriere adăugată piesei | MATERIAL (seed) |
|---|---|---|---|---|
| `PAL` | PAL | PAL melaminat (cheile existente `common.materials.PAL.*`) | `Corp: PAL standard` | 1 |
| `MDF_INFOLIAT` | MDF_INFOLIAT | (existent) | `Corp: PAL standard` | 2 |
| `MDF_VOPSIT` | MDF_VOPSIT | (existent) | `Corp: PAL standard` | 3 |
| `MDF_FURNIR` | MDF_FURNIR | (existent) | `Corp: PAL standard` | 3 |
| `LEMN_MASIV` | LEMN_MASIV | (existent) | `Corp: PAL standard` | 4 |
| `MDF_INTEGRAL` (doar cu `integralMdf`) | **MDF** (enum legacy) | „Integral din MDF (corp și fronturi)” | `Corp și fronturi din MDF` | 2 (rândul `MATERIAL:MDF` există) — DECIZIE N4 |
| `ALTUL` | ALTUL | (existent; deschide „Altul” text) | `Material dorit: <text>` | 2 |
| `FIRM_DECIDES` | ALTUL | „Nu știu — vreau recomandarea firmei” | `Material: clientul vrea recomandarea firmei` | 2 (ca „Altul”, PO c7-2) |

**PANEL — piese din plăci fără fronturi** (rafturi, cuier, rafturi suspendate, bancă, rafturile debaralei): aceleași
opțiuni ca BODY, fără `MDF_INTEGRAL`, CU preț pe ml (sunt tot mobilier din plăci); titlu „Material — <piesă>”,
subtitlu `common.finish.panelMaterial.subtitle` („Pentru plăcile piesei.”), FĂRĂ nota „Corp: PAL standard”.

**WOOD — masă și pat** (PO c1-3: „setul de lemn, fără preț pe metru”) — conținut DECIZIE N5 (varianta mică):
| id | salvat ca | text RO | descriere | MATERIAL |
|---|---|---|---|---|
| `LEMN_MASIV` | LEMN_MASIV | „Lemn masiv” | — | 4 |
| `MDF_FURNIR` | MDF_FURNIR | „Furnir de lemn natural” | — | 3 |
| `PAL` | PAL | „PAL cu decor lemn” | — | 1 |
| `FIRM_DECIDES` | ALTUL | (comun) | `Material: clientul vrea recomandarea firmei` | 2 |
Fără `ALTUL` (cine vrea altceva scrie în detalii / schiță) — ține ecranul patului la 3 întrebări. Etichete noi
`common.finish.wood.<id>.{label,description}`; info = cheile existente `common.materials.<id>.info.*` FĂRĂ `priceHintKey`.

**MIRROR — oglinda (rama)** (PO c1-3: ramă fără / lemn / MDF vopsit / metal / decide firma); fără preț, fără „Altul”:
| id | salvat ca | text RO | descriere | MATERIAL |
|---|---|---|---|---|
| `MIRROR_FRAMELESS` | ALTUL | „Fără ramă” | `Ramă: fără ramă` | 2 |
| `MIRROR_FRAME_WOOD` | LEMN_MASIV | „Ramă din lemn” | `Ramă: lemn` | 4 |
| `MIRROR_FRAME_MDF` | MDF_VOPSIT | „Ramă din MDF vopsit” | `Ramă: MDF vopsit` | 3 |
| `MIRROR_FRAME_METAL` | ALTUL | „Ramă metalică” | `Ramă: metal` | 2 |
| `FIRM_DECIDES` | ALTUL | (comun) | `Ramă: clientul vrea recomandarea firmei` | 2 |

**WORKTOP — blatul de la spălătorie și balcon** (PO c6-2); fără preț pe ml, fără „Recomandat”:
| id | salvat ca | text RO | descriere | MATERIAL |
|---|---|---|---|---|
| `WORKTOP_PAL_POSTFORMED` | PAL | „PAL postformat” | `Blat: PAL postformat` | 1 |
| `WORKTOP_HPL` | ALTUL | „HPL” | `Blat: HPL` | 2 |
| `WORKTOP_HPL_COMPACT` | ALTUL | „HPL compact (rezistent la apă)” | `Blat: HPL compact` | 2 |
| `WORKTOP_QUARTZ` | ALTUL | „Cuarț” | `Blat: cuarț` | 2 |
| `WORKTOP_SOLID_WOOD` | LEMN_MASIV | „Lemn masiv” | `Blat: lemn masiv` | 4 |
| `FIRM_DECIDES` | ALTUL | (comun) | `Blat: clientul vrea recomandarea firmei` | 2 |
Prefixul `WORKTOP_` evită coliziunea cu valorile blatului de bucătărie (`HPL`, `QUARTZ`) în harta de ilustrații.

**Blatul bucătăriei** — `kitchenCountertopOptionsV4(): ChoiceOption[]` = opțiunile pasului `countertop` din kitchen v2
(`PAL`, `HPL`, `QUARTZ`, `GRANITE`, cu scoring `KITCHEN_COUNTERTOP:<v>`, 0 puncte) + `FIRM_DECIDES` cu
`scoring: { category: 'KITCHEN_COUNTERTOP', optionKey: 'FIRM_DECIDES' }` → rând NOU în seed, 0 puncte (PO c6-1: blatul
nu schimbă costul). Pasul rămâne obligatoriu. Blatul bucătăriei nu e piesă (nu intră în `items`), deci nu are descriere.

### 2.3 Lista unică de deschidere (`OpeningSetKind = 'GENERAL' | 'KITCHEN_BASE' | 'KITCHEN_WALL' | 'KITCHEN_ISLAND'`)

Funcție: `openingOptions(kind, opts?: { pistons?: boolean; noFronts?: boolean }): ChoiceOption[]`. Bife multiple (PO c2-3),
costul ia maximul (neschimbat: `SYSTEM pick:'max'`). `FIRM_DECIDES` și `NO_FRONTS` sunt EXCLUSIVE (capabilitate nouă 4.1).
| id | salvat ca (`ItemSystem`) | text RO | GENERAL | K_BASE | K_WALL | K_ISLAND | SYSTEM |
|---|---|---|---|---|---|---|---|
| `MANER` | MANER | (existent) | da | da | da | da | 1 |
| `PUSH` | PUSH | (existent) „Push (fără mâner)” | da | da | da | da | 2 |
| `GOLA` | GOLA | (existent) | — | da | da | da | 3 |
| `AVENTOS` | AVENTOS | (existent) | — | — | da | — | 3 |
| `PISTONS` | **AVENTOS** + descriere `Uși rabatabile pe pistoane (în sus sau în jos)` | „Rabatabilă, pe pistoane (în sus sau în jos)” | cu `pistons` | — | da | — | 3 — DECIZIE N1 |
| `NO_FRONTS` (exclusivă) | `[]` + descriere `Fără uși sau sertare` | „Fără uși sau sertare” | cu `noFronts` | — | — | — | 0 |
| `FIRM_DECIDES` (exclusivă) | `[]` + descriere `Deschidere: clientul vrea recomandarea firmei` | „Nu știu — vreau recomandarea firmei” | da | da | da | da | 0 (PO c7-2) |
`GLISANTE` NU mai e în nicio listă de deschidere: devine tip de uși (dulap dormitor, dulap hol, dressing, dulap 3D) — c3.
Pistoane la bucătărie doar pe suspendate (unde stă și Aventos) — DECIZIE N8.

### 2.4 Rezolvarea (folosită de toate derivările noi)
- `resolveMaterial(value: string | undefined, kind, otherText?: string): { material: Material; notes: string[]; firmDecides: boolean }`
  — tabelele de mai sus; `value` lipsă → `DEFAULT_MATERIAL_WHEN_MISSING = 'ALTUL'` (aliniere CP-30: un singur implicit;
  apare doar în previzualizarea ciornelor, la publicare pasul e obligatoriu). Nota `Corp: PAL standard` o adaugă constructorul
  (doar la BODY cu fronturi și material ≠ `MDF_INTEGRAL` / `FIRM_DECIDES`).
- `resolveOpening(values: string[] | undefined, opts: { pistons: boolean }): { systems: ItemSystem[]; notes: string[]; firmDecides: boolean }`
  — dedup, `PISTONS→AVENTOS` doar cu `pistons`, `NO_FRONTS`/`FIRM_DECIDES` → `[]` + notă.
- Constante text (RO, fără coduri interne — testul `firm-text` „fără coduri”): `BODY_NOTE`, `INTEGRAL_MDF_NOTE`, `FIRM_MATERIAL_NOTE`,
  `FIRM_OPENING_NOTE`, `NO_FRONTS_NOTE`, `PISTONS_NOTE`, `FRAME_NOTES`, `WORKTOP_NOTES`, `FRAME_BY_FIRM_NOTE = 'Cadru: îl alege firma'`.
- Descrierea finală a piesei: `[descrierea existentă a fluxului, ...note].join('; ')`, tăiată la 2000 de caractere (limita `requestItemSchema`).

---

## 3. Tabelul „are fronturi: da / nu / poate” și setul de material

`fronts`: `YES` = pas de deschidere obligatoriu; `NO` = fără pas; `MAYBE` = pas cu `NO_FRONTS`; `YES?cond` = pas doar când condiția e adevărată.
„Comun” = piesa intră în întrebarea „Același material și aceeași deschidere pentru toate piesele?” (doar `BODY` cu fronturi ≠ `NO`).

| Flux | Piesă (value) | step material / deschidere (id-uri PĂSTRATE) | Set | Fronturi | Pistoane | Comun |
|---|---|---|---|---|---|---|
| KITCHEN | Corpuri de bază | `frontMaterialBase` / `openingSystemsBase` | BODY | YES | — | (bifa existentă `separateFrontMaterials`) |
| KITCHEN | Corpuri suspendate | `frontMaterialWall` / `openingSystemsWall` | BODY | YES | da | idem |
| KITCHEN | Insulă | `frontMaterialIsland` / `openingSystemsIsland` | BODY | YES | — | idem |
| KITCHEN | Blat | `countertop` | blat bucătărie | — | — | — |
| DRESSING | Dressing | `material` / `openingSystems` (NOU) | BODY | YES?`doorType=HINGED` (SLIDING→GLISANTE fără întrebare; OPEN→`[]`) | — | — |
| LIVING | TV_UNIT | `materialTvUnit` / `systemsTvUnit` | BODY | YES | da | da |
| LIVING | BOOKSHELF | `materialBookshelf` / `systemsBookshelf` | BODY | MAYBE | — | da |
| LIVING | DISPLAY_CABINET | `materialDisplay` / `systemsDisplay` | BODY | YES | — | da |
| LIVING | COFFEE_TABLE | `materialCoffeeTable` / — | WOOD | NO | — | — |
| LIVING | WALL_SHELVES | `materialShelves` / — | PANEL | NO | — | — |
| LIVING | OTHER | `materialOtherPiece` / `systemsOtherPiece` | BODY | MAYBE | — | da |
| BEDROOM | WARDROBE | `materialWardrobe` / `systemsWardrobe` | BODY | YES?`wardrobeDoorType=HINGED` (SLIDING→GLISANTE) | — | da |
| BEDROOM | BED_FRAME | `materialBed` / `systemsBed` | WOOD | YES?`bedStorage=DRAWERS` | — | — |
| BEDROOM | NIGHTSTANDS | `materialNightstands` / `systemsNightstands` | BODY | YES | — | da |
| BEDROOM | DRESSER | `materialDresser` / `systemsDresser` | BODY | YES | — | da |
| BEDROOM | TV_UNIT | `materialTvUnit` / `systemsTvUnit` | BODY | YES | da | da |
| BEDROOM | VANITY | `materialVanity` / `systemsVanity` | BODY | MAYBE | — | da |
| OFFICE | DESK | `materialDesk` / `systemsDesk` | BODY | MAYBE | — | da |
| OFFICE | BOOKSHELF | `materialBookshelf` / `systemsBookshelf` | BODY | MAYBE | — | da |
| OFFICE | STORAGE | `materialStorage` / `systemsStorage` | BODY | YES | — | da |
| OFFICE | WALL_SHELVES | `materialShelves` / — | PANEL | NO | — | — |
| BATHROOM | VANITY_UNIT | `materialVanity` / `systemsVanity` (NOU) | BODY+integral | YES | — | da |
| BATHROOM | MIRROR_CABINET | `materialMirror` / `systemsMirror` (NOU) | BODY+integral | YES | — (DECIZIE N7) | da |
| BATHROOM | TALL_STORAGE | `materialTall` / `systemsTall` (NOU) | BODY+integral | YES | — | da |
| PANTRY | rafturi | `materialShelves` / — | PANEL | NO | — | — |
| PANTRY | dulapuri | `materialCabinets` / `systemsCabinets` | BODY | YES | — | — (fără întrebare comună) |
| LAUNDRY | APPLIANCE_HOUSING | `materialApplianceHousing` / `systemsApplianceHousing` | BODY | YES | — | da |
| LAUNDRY | STORAGE | `materialStorage` / `systemsStorage` | BODY | YES | — | da |
| LAUNDRY | COUNTERTOP | `materialCountertop` / — | WORKTOP | NO | — | — |
| LAUNDRY | SINK_UNIT | `materialSinkUnit` / `systemsSinkUnit` | BODY | YES | — | da |
| BALCONY | STORAGE_BENCH | `materialStorageBench` / `systemsStorageBench` | BODY+integral | MAYBE | — | da |
| BALCONY | TALL_CABINET | `materialTallCabinet` / `systemsTallCabinet` | BODY+integral | YES | — | da |
| BALCONY | WORKTOP | `materialWorktop` / — | WORKTOP | NO | — | — |
| BALCONY | SHELVES | `materialShelves` / — | PANEL | NO | — | — |
| HALLWAY | SHOE_CABINET | `materialShoeCabinet` / `systemsShoeCabinet` | BODY | YES | — | da |
| HALLWAY | COAT_UNIT | `materialCoatUnit` / — | PANEL | NO | — | — |
| HALLWAY | WARDROBE | `materialWardrobe` / `systemsWardrobe` | BODY | YES?`wardrobeDoorType=HINGED` (NOU) | — | da |
| HALLWAY | BENCH | `materialBench` / `systemsBench` | BODY | MAYBE | — | da |
| HALLWAY | MIRROR | `materialMirror` / — | MIRROR | NO | — | — |
| PIECES | fiecare rând | câmpuri pe rând (vezi 5.11) | BODY | MAYBE | — | — |
| PIECE_WARDROBE | — | `material` / 3D (`doorMode`, `frontStyle`) | BODY | din 3D | — | — |
| PIECE_TV_UNIT | — | `material` / 3D + `liftUpDoors` | BODY | din 3D | da (bifă) | — |
| PIECE_BOOKCASE, PIECE_DRESSER, PIECE_SHOE_CABINET, PIECE_NIGHTSTAND, PIECE_DESK | — | `material` / 3D | BODY | din 3D | — | — |
| PIECE_BED | — | `material` / — | WOOD | NO (DECIZIE N10) | — | — |
| PIECE_TABLE | — | `material` / — | WOOD | NO | — | — |
| PIECE_BENCH | — | `material` / — | PANEL | NO | — | — |
| PIECE_SIDEBOARD, PIECE_WALL_CABINET | — | `material` / 3D `frontStyle` + `liftUpDoors` | BODY | din 3D | da (bifă) | — |
| PIECE_BATHROOM_VANITY | — | `material` / 3D `vanity.handles` | BODY+integral | din 3D | — | — |
| PIECE_ENTRYWAY | — | `material` / 3D `entryway.shoeStorage` | BODY | din 3D | — | — |
| PIECE_SOFA, PIECE_ARMCHAIR, PIECE_OTTOMAN | — | NICIUN pas de material (PO c1-2) | — (ALTUL + `Cadru: îl alege firma`) | NO | — | — |

„din 3D” = o singură sursă: nu există pas de deschidere; sistemele vin din `config3d` (vezi 5.12).

---

## 4. Constructorul nou și capabilitățile noi ale motorului

### 4.1 Capabilități noi (toate opționale → versiunile vechi nu le folosesc → comportament identic)
1. **`types.ts` — `Condition`**: se adaugă `{ not: Condition }` și câmpul opțional `atLeast?: number` pe varianta `in`
   (`{ questionId; in: string[]; atLeast?: number }`). `engine.ts evalCondition`: `not` → `!eval`; `in` pe `string[]` →
   numărul de potriviri `>= (atLeast ?? 1)` (implicit 1 = exact comportamentul de azi; pe primitiv `atLeast` se ignoră).
   Folosit pentru „≥ 2 piese comune bifate” și „întrebarea comună NU e Da”.
2. **`types.ts` — `ChoiceOption.exclusive?: boolean`**: `engine.ts stepAnswerSchema` (`multi-choice`) adaugă
   `.refine(arr => !arr.some(isExclusive) || arr.length === 1, 'validation.exclusiveOption')`. Cheie i18n nouă
   `Configurator.validation.exclusiveOption`. `pruneAnswers` neschimbat. `firm-text.fixtures.ts answerFor` (multi-choice):
   variantele `last` / `middle` sar opțiunile exclusive (altfel fixture-ul devine invalid).
3. **`types.ts` — `PiecesStep.rowVersion?: 2`**: `stepAnswerSchema('pieces')` folosește `pieceRowV2Schema` când `rowVersion === 2`,
   altfel `requestItemSchema` (ca azi). Schema nouă în `questionnaire/pieces-row.ts` (NOU): vezi 5.11.
4. **`types.ts` — `DerivedRoom.firmRecommendations?: FirmRecommendation[]`** cu
   `FirmRecommendation = { itemName: string; material: boolean; opening: boolean }`. Opțional; fluxurile vechi nu îl pun;
   serverul copiază explicit doar `items`/dimensiuni (`requests.service.ts:1307-1328`), deci câmpul nu ajunge în baza de date.
   `engine.ts` exportă `firmRecommendations(roomType, answers, version?, opts?): FirmRecommendation[]`
   (= `deriveRoomForFirms(...).firmRecommendations ?? []`).
5. **`piece3d`** — `configHasFronts(kind, config): boolean` (în `piece3d/config.ts`, lângă totalurile de uși existente,
   ~l. 877): adevărat dacă există o zonă `DOOR` / `DRAWERS` / `TILT_OUT`, `doorMode === 'SLIDING'`, `vanity.storage !== 'OPEN'`
   sau `entryway.shoeStorage === 'DOORS'`. Pur, fără efect asupra derivărilor v3.

NU sunt necesare: grup de ecran separat de id (există deja `screenGroup`; `groupScreens` unește pașii consecutivi cu același
grup — `room-screens.ts:31`), steag „ascunde prețul” (se rezolvă din opțiuni, 2.2), schimbări în `validateRoomAnswers`
pentru „Am deja un proiect” (PO c14-3: materialul și deschiderea rămân obligatorii — regula de azi, doar `dimension-group` se sare).

### 4.2 Constructorul — `packages/shared/src/questionnaire/flows/piece-finish.ts` (NOU)

```
interface FinishPieceDef extends PieceDef {          // PieceDef din pieces-flow.ts (value, icon, itemName, quantity)
  materialStepId: string;                            // id-urile PĂSTRATE din versiunea curentă (tabelul 3)
  systemsStepId?: string;                            // lipsă ⇔ fronts === 'NO'
  materialSet: 'BODY' | 'PANEL' | 'WOOD' | 'MIRROR' | 'WORKTOP';
  integralMdf?: boolean;                             // baie, balcon
  fronts: 'YES' | 'NO' | 'MAYBE';
  frontsIf?: Condition;                              // YES condiționat (dulap batant, pat cu sertare)
  fixedSystems?: (a: AnswerMap) => ItemSystem[] | null;  // dulap glisant → ['GLISANTE']; null = din răspuns
  pistons?: boolean;
  selectedIf?: Condition;                            // implicit { questionId: 'piecesNeeded', in: [value] } (debaraua îl schimbă)
  leadSteps?: QuestionStep[];                        // pașii piesei puși PRIMII pe ecranul ei (wardrobeDoorType, bedStorage, nightstandsCount)
  materialTitleKey: string;                          // `flows.<ROOM>.v<N>.<materialStepId>.title`
  systemsTitleKey?: string;                          // implicit cheia existentă `flows.<ROOM>.<systemsStepId>.title` („Deschidere — dulap”)
}
interface FinishOpts {
  flowKey: string;                                   // 'flows.BEDROOM'
  common: boolean;                                   // false la debara (și la piesele unice)
  recommended?: { material: string; cond: Condition };  // badge-ul „Recomandat” (baie, spălătorie, balcon) pe BODY/PANEL, nu pe WORKTOP
}

sameFinishStep(opts, defs): BooleanStep
pieceFinishSteps(opts, defs): QuestionStep[]         // ecranele pe piese + ecranul comun (la final)
buildFinishItems(answers, defs, fallbackName): { items: RequestItemInput[]; firmRecommendations: FirmRecommendation[] }
```

**Pașii produși** (ordinea în `steps` = ordinea ecranelor):
1. `sameFinishAll` (`boolean`, NU optional, fără răspuns implicit — PO c14-2), `screenGroup: 'pieces'` (stă pe ecranul listei de piese,
   lângă `piecesNeeded` care primește și el `screenGroup: 'pieces'`). `visibleIf: { questionId: 'piecesNeeded', in: <comune>, atLeast: 2 }`.
   Titlu `common.finish.sameAll.title` „Același material și aceeași deschidere pentru toate piesele?”, subtitlu
   `common.finish.sameAll.subtitle` („Pentru corpurile cu uși sau sertare. Patul, măsuța, oglinda, rafturile și blatul au întrebarea lor.”).
   Randare: cartonașe Da / Nu (boolean obișnuit, inline pe ecran).
2. Pentru fiecare piesă, grupul `piece:<VALUE>` (aceeași convenție ca azi → banda-țintă funcționează fără schimbări):
   - `leadSteps` (cu `screenGroup` suprascris, `visibleIf` păstrat);
   - `<materialStepId>` single-choice, opțiunile setului; `visibleIf = all[selectedIf, comun ? not(sameFinishAll = true) : —]`;
   - `<materialStepId>Other` (`otherMaterialStep` din `common.ts`) doar la seturile cu `ALTUL` (BODY, PANEL);
   - `<systemsStepId>` multi-choice (`minSelected: 1`, opțiuni `openingOptions('GENERAL', { pistons, noFronts: fronts==='MAYBE' })`),
     doar dacă `fronts !== 'NO'`; `visibleIf = all[selectedIf, frontsIf?, comun ? not(sameFinishAll = true) : —]`;
     `subtitleKey: 'common.finish.opening.subtitle'` („Poți bifa mai multe. Pentru ușile și sertarele piesei.”).
3. Ecranul comun, grupul `piece:ALL`, DUPĂ ecranele pieselor (ca `wardrobeDoorType` să fie deja răspuns):
   - `materialAll` (BODY; `integralMdf` dacă oricare piesă comună îl are), `materialAllOther`;
   - `systemsAll` (GENERAL; `NO_FRONTS` vizibilă doar dacă NICIO piesă comună bifată nu e `YES`: opțiunea are
     `visibleIf: not({ questionId:'piecesNeeded', in:<comune YES> })`; FĂRĂ `PISTONS` — DECIZIE N11);
   - toate cu `visibleIf: { questionId: 'sameFinishAll', equals: true }`.
   Titluri `common.finish.allMaterial.title` („Material pentru fronturi — toate corpurile”), `common.finish.allOpening.title`.

**Cel mult 3 întrebări pe ecran**: un ecran de piesă = (lead) + material + deschidere. Câmpul „Altul” (text care apare doar la
`ALTUL`) e completarea întrebării de material, nu se numără: runner-ul nu îi pune număr în contorul „1/3” (pachet E).
DECIZIE N12. Bucătăria păstrează ecranul „Fronturi” cu zone (`e6-now`), mai mult de 3 întrebări — DECIZIE N16.

**Derivarea (`buildFinishItems`)**, pe fiecare piesă bifată, în ordinea `defs`:
- `common = sameFinishAll === true && esteComună(def)`;
- material = `resolveMaterial(common ? answers.materialAll : answers[materialStepId], def.materialSet, textul Other)`;
- sisteme: `fixedSystems(answers)` dacă nu e null; altfel dacă `fronts==='NO'` sau `frontsIf` fals → `[]`;
  altfel `resolveOpening(common ? answers.systemsAll : answers[systemsStepId], { pistons: def.pistons })`;
- note: `Corp: PAL standard` la BODY cu fronturi (nu la `MDF_INTEGRAL`, nu la `FIRM_DECIDES`), plus notele din rezolvare;
- `firmRecommendations.push({ itemName, material: m.firmDecides, opening: o.firmDecides })` când oricare e adevărat;
- fără nicio piesă: `{ name: fallbackName, material: 'ALTUL', systems: [], quantity: 1 }` (garanția „minim un item”).
Fluxul își face după aceea ajustările proprii (nume TV după stil, „Pat tapițat”, LED, cantitatea noptierelor) pe `items`;
dacă redenumește o piesă, redenumește și `itemName` în `firmRecommendations` (helper `renameItem(result, from, to)` exportat).

### 4.3 Înregistrarea versiunilor — `flows/index.ts` (editat DOAR de fundație)
- Fundația creează TOATE fișierele noi din tabelul 1 ca schelete (`export const bedroomFlowV3: RoomFlow = { ...bedroomFlowV2, version: 3 }`,
  la fel pentru toate) și le înregistrează în `FLOW_REGISTRY` din start; `catalog-v2.ts` exportă `catalogFlowRegistryV2`
  (un `Record` cu versiunea 2 pentru cele 7) care se îmbină în registru lângă `catalogFlowRegistry`.
- `CURRENT_FLOW_VERSION` rămâne pe versiunile vechi până la valul 3 (o singură schimbare, făcută de coordonator).
- Export nou `FLOW_VERSIONS_BEFORE_ETAPA6: Record<RoomType, number[]>` (versiunile existente azi) — folosit de teste.
- Agenții valului 2 înlocuiesc conținutul scheletului în fișierul lor; nimeni altcineva nu atinge `index.ts`.

---

## 5. Schimbările pe fiecare flux (față de versiunea curentă)

Id-urile de pas existente se PĂSTREAZĂ; se schimbă opțiunile, vizibilitatea, `screenGroup` și titlurile. „+” = pas nou.

### 5.1 KITCHEN v4 (`kitchen.v4.ts`, pornește din `kitchen.v3.ts`)
- Aceiași pași și aceeași ordine ca v3 (ecranul `fronts` rămâne; zonele `e6-now` se aplică pe id-uri).
- `frontMaterialBase/Wall/Island`: opțiuni `materialSetOptions('BODY')` (cu `FIRM_DECIDES`, fără integral);
  titlu `flows.KITCHEN.v4.frontMaterial.title` „Material pentru fronturi (uși și sertare)”, subtitlu `common.finish.frontMaterial.subtitle`.
- `openingSystemsBase` → `KITCHEN_BASE`; `openingSystemsWall` → `KITCHEN_WALL` (cu `PISTONS`); `openingSystemsIsland` → `KITCHEN_ISLAND`.
- `countertop` → `kitchenCountertopOptionsV4()` (obligatoriu, + `FIRM_DECIDES`).
- Derivare: ca v3 (materialul de bază copiat când `separateFrontMaterials` ≠ true), apoi `resolveMaterial` / `resolveOpening`,
  nota `Corp: PAL standard`, `firmRecommendations` pe „Corpuri de bază / suspendate / Insulă”.
- Fără întrebarea comună (bucătăria are deja bifa „materiale diferite pe zone”, implicit același material).

### 5.2 DRESSING v4
- `doorType` neschimbat (SLIDING / HINGED / OPEN). `material`: BODY + `FIRM_DECIDES`, titlu nou `flows.DRESSING.v4.material.title`.
- + `openingSystems` (GENERAL, fără `NO_FRONTS`), `screenGroup: 'materialScreen'`, `visibleIf: { doorType = HINGED }` → ecranul
  are material (+Altul) + deschidere.
- Derivare: SLIDING → `['GLISANTE']` (ca azi); HINGED → `resolveOpening`; OPEN → `[]`. Nota `Corp: PAL standard` doar la SLIDING / HINGED.
  DECIZIE N9 (dressing deschis cu sertare).

### 5.3 LIVING v4
- `piecesNeeded` + `piecesOtherText` + `sameFinishAll` pe ecranul `pieces`. `tvStyle` rămâne ecran propriu.
- Piesele după tabelul 3, prin `pieceFinishSteps`; `ledPieces` și `sketch` neschimbate, după ecranul comun.
- Derivare: `buildFinishItems` + ajustările v3 (LED pe index, nume TV după stil, „Altă piesă living” → textul clientului; cu `renameItem`).

### 5.4 OFFICE v3
- `piecesNeeded` (+`sameFinishAll`), `deskShape`, `dimensions` neschimbate; piesele după tabelul 3 (birou și bibliotecă cu „Fără uși sau sertare”;
  rafturile de perete fără deschidere).

### 5.5 BEDROOM v3 (c3 + c14)
- Ordinea: `piecesNeeded`+`sameFinishAll` (ecran `pieces`) · `bedSize` + `bedCustomSize` + `bedUpholstered` (ecran `bedSize`, 3 întrebări,
  custom e condiționat) · `dimensions` · ecranele pieselor · ecranul comun · `sketch`.
- WARDROBE: lead `wardrobeDoorType` (id păstrat, opțiuni SLIDING / HINGED, chei existente); `systemsWardrobe` doar la HINGED;
  SLIDING → `fixedSystems = ['GLISANTE']` (c3: „costul ține cont de ușile glisante”). Un răspuns trimis pentru `systemsWardrobe` la
  SLIDING e respins automat (`validation.unknownAnswer`, pas invizibil).
- BED_FRAME: lead `bedStorage` (id păstrat); `materialBed` WOOD; `systemsBed` doar la `bedStorage = DRAWERS` (lada rabatabilă și „fără” → fără pas).
- NIGHTSTANDS: lead `nightstandsCount`. DRESSER, TV_UNIT (pistoane), VANITY (MAYBE) — tabelul 3.
- Număr de ecrane, 6 piese, fără proiect propriu: azi 20 → „Nu” 10 (pieces, bedSize, dimensions, 6 piese, sketch) · „Da” 8
  (pieces, bedSize, dimensions, dulap = doar tipul ușilor, pat, noptiere = doar câte, comun, sketch).
- Derivarea v2 a patului (saltea, ladă, sertare, „Pat tapițat”) și cantitatea noptierelor se păstrează peste `buildFinishItems`.

### 5.6 BATHROOM v3
- `piecesNeeded`(+`sameFinishAll`), `dimensions`, `ventilation` neschimbate; cele trei piese BODY+integral cu deschidere NOUĂ
  (`systemsVanity`, `systemsMirror`, `systemsTall`), material + deschidere pe `piece:<VALUE>`; badge MDF_INFOLIAT la `ventilation = NONE`
  pe materialul pieselor și pe `materialAll`. Titlurile de material (`flows.BATHROOM.v3.<id>.title`) și de deschidere (chei NOI
  `flows.BATHROOM.v3.<systemsId>.title`, baia nu are chei de deschidere azi).

### 5.7 PANTRY v3
- `wallsUsed`, `storageStyle`, `dimensions` neschimbate. Două definiții cu `selectedIf` pe `storageStyle`: rafturi (PANEL, NO) și dulapuri
  (BODY, YES). `systemsCabinets` trece pe `screenGroup: 'piece:CABINETS'` (azi `piece:CABINETS:systems`). `common: false`.

### 5.8 LAUNDRY v3 (c6)
- `applianceSetup`, `piecesNeeded`(+`sameFinishAll`), `ventilation`, `dimensions` neschimbate. `materialCountertop` → WORKTOP (fără „Recomandat”,
  fără deschidere — `systemsCountertop` nu mai există deloc). Badge MDF_INFOLIAT doar pe BODY.

### 5.9 BALCONY v3 (c6)
- `enclosed`, `piecesNeeded`(+`sameFinishAll`), `dimensions` neschimbate. `materialWorktop` → WORKTOP; `materialShelves` → PANEL; bancă (MAYBE)
  și dulap cu integral MDF. Badge LEMN_MASIV la `enclosed = OPEN` pe BODY / PANEL. Fără `systemsWorktop` / `systemsShelves`.

### 5.10 HALLWAY v2 (c3 „aceeași regulă la dulapul de hol”)
- `piecesNeeded`(+`sameFinishAll`), `dimensions` neschimbate. + `wardrobeDoorType` (NOU în hol, lead pe `piece:WARDROBE`, `visibleIf` WARDROBE bifat;
  chei NOI `flows.HALLWAY.wardrobeDoorType.*`, text copiat din dormitor). COAT_UNIT fără deschidere (PANEL), MIRROR cu setul oglinzii,
  BENCH cu „Fără uși sau sertare”.
- Test cerut: cuier + oglindă → niciun pas de deschidere; bancă → pas cu `NO_FRONTS`, care lasă piesa cu `systems: []`.

### 5.11 PIECES v2 — „Altă piesă” (c10, partea a doua)
- Pasul `pieces` primește `rowVersion: 2`; `sketch` neschimbat; `deriveRoom` cu aceeași euristică de lungime ca v1 (DECIZIE N14).
- `pieceRowV2Schema` (`questionnaire/pieces-row.ts`) = `requestItemSchema` + câmpuri opționale, `.strict()`:
  `widthCm?`, `heightCm?`, `depthCm?` (întregi 1–600), `materialChoice?: 'FIRM_DECIDES'`, `openingChoice?: 'FIRM_DECIDES' | 'NO_FRONTS'`;
  `description` max 1800 (lasă loc notelor). Reguli (`superRefine`): `materialChoice` ⇒ `material = 'ALTUL'`; `openingChoice` ⇒ `systems = []`;
  fără `openingChoice` ⇒ `systems` din {MANER, PUSH} cu cel puțin una (regula unică: deschiderea e obligatorie, cu ieșiri) — DECIZIE N13.
- Derivarea: pentru fiecare rând → `RequestItemInput` (fără câmpurile noi) cu descrierea = detaliile clientului + dimensiuni +
  note. Dimensiuni: toate trei → `Dimensiuni: 120 × 80 × 40 cm (lățime × înălțime × adâncime)`; parțial → `Lățime 120 cm, adâncime 40 cm`;
  niciuna → nimic. `materialChoice` → `FIRM_MATERIAL_NOTE` + `firmRecommendations`; `NO_FRONTS` → `NO_FRONTS_NOTE`.
  Materialul `ALTUL` ales din listă rămâne ca azi (clientul scrie în „Detalii”).
- Liste pe rând: material = BODY fără integral (cu „Nu știu — vreau recomandarea firmei” ca valoare de interfață care pune
  `material: 'ALTUL'` + `materialChoice`); deschidere = Mâner / Push / Decide firma / Fără uși sau sertare (fără „Uși glisante”).

### 5.12 Piese ghidate (corpuri) v4 — `guided-pieces/v4.ts`
- `piece3dFlowV4(spec)` (copie a `piece3dFlow` din v3, NU import cu modificări): `config3d` · `extraSteps` · `material` (BODY, titlu
  `flows.<PIECE>.v4.material.title`, subtitlu `common.finish.frontMaterial.subtitle`, grup `material`) · `materialOther` ·
  + `liftUpDoors` (doar TV: `boolean`, `optional`, `toggleStyle: 'checkbox'`, grup `material`, `cardLabelKey: common.finish.liftUp.cardLabel`
  „Unele uși se deschid în sus sau în jos, pe pistoane”) · `sketch` · `snapshot3d`.
- Scos: `openingSystems` (TV, bibliotecă, comodă) și pasul ascuns `doorType` (dulap) — o singură sursă, alegerea din 3D (c2 pasul 5).
- Sisteme: dacă `configHasFronts` → `frontStyle` (HANDLE→MANER, PUSH→PUSH, lipsă→nimic, ca v3 — DECIZIE N3); `doorMode = SLIDING` → GLISANTE;
  `liftUpDoors = true` → AVENTOS + `PISTONS_NOTE`. Descriere: ca v3 + `Corp: PAL standard` / note de material.
- `extraSteps` păstrate: `tvSetup` (TV), `count` (noptieră — id păstrat, Studio îl ascunde), `cableManagement` (birou).

### 5.13 Pat, masă, bancă v4 — `guided-pieces/furniture-v4.ts`
- Copie a `furnitureFlow` din `furniture-v3.ts` cu `material` WOOD (pat, masă) / PANEL (bancă), fără „Altul” la WOOD; derivarea
  pornește tot din `pieceBedFlowV2` / `pieceTableFlowV2` / `pieceBenchFlowV2` (`furnitureLegacyAnswers`), apoi suprascrie `material` cu
  `resolveMaterial` și adaugă notele. Fără deschidere.

### 5.14 Piese de catalog v2 — `guided-pieces/catalog-v2.ts`
- Bucla din `catalog-v1.ts` copiată pentru versiunea 2: SIDEBOARD / WALL_CABINET — BODY + `liftUpDoors`; BATHROOM_VANITY — BODY + integral;
  ENTRYWAY — BODY; SOFA / ARMCHAIR / OTTOMAN — pașii `config3d`, `sketch`, `snapshot3d` (FĂRĂ material), item cu `material: 'ALTUL'`,
  nota `Cadru: îl alege firma`, `firmRecommendations: [{ material: true, opening: false }]`.
- Sistemele din 3D ca la v1 (`vanity.handles`, `entryway.shoeStorage`, `frontStyle`), plus AVENTOS din `liftUpDoors`.

---

## 6. Derivare, fișa firmei și cost

### 6.1 Ce ajunge în piesa salvată (exemple)
| Răspuns | `material` | `systems` | adăugat în `description` |
|---|---|---|---|
| corp MDF vopsit, Mâner | MDF_VOPSIT | [MANER] | `Corp: PAL standard` |
| corp „decide firma”, deschidere „decide firma” | ALTUL | [] | `Material: clientul vrea recomandarea firmei; Deschidere: clientul vrea recomandarea firmei` |
| baie „Integral din MDF”, Push | MDF | [PUSH] | `Corp și fronturi din MDF` |
| dulap uși glisante | (ales) | [GLISANTE] | `Corp: PAL standard` |
| comodă TV, Mâner + Pistoane | (ales) | [MANER, AVENTOS] | `Corp: PAL standard; Uși rabatabile pe pistoane (în sus sau în jos)` |
| bancă „Fără uși sau sertare” | (ales) | [] | `Corp: PAL standard; Fără uși sau sertare` |
| oglindă ramă metal | ALTUL | [] | `Ramă: metal` |
| blat spălătorie HPL | ALTUL | [] | `Blat: HPL` |
| canapea (catalog) | ALTUL | din 3D | `…config 3D…; Cadru: îl alege firma` |
| „Altă piesă” 120 × 80 × 40 | (ales) | (ales) | `<detalii>; Dimensiuni: 120 × 80 × 40 cm (lățime × înălțime × adâncime)` |
Notă: la `FIRM_DECIDES` NU se pune `Corp: PAL standard` (firma alege tot).

### 6.2 „Recomandarea firmei” pe fișă (marcaj în răspunsuri)
`room-spec-card.tsx` calculează `firmRecommendations(room.roomType, answers, room.flowVersion)` (re-derivare din răspunsuri, aceeași
funcție ca pe server) și, pe fiecare `room.items` (fără ordine garantată din baza de date — potrivire după `name`):
- `material === 'ALTUL'` și `material: true` → badge `roomSpec.firmRecommendation` „Recomandarea firmei” în locul etichetei „Altul”;
- `systems` gol și `opening: true` → badge `roomSpec.firmRecommendationOpening` „Deschidere: recomandarea firmei”.
Cererile vechi: funcția întoarce `[]` → fișa arată exact ca azi.

### 6.3 Rânduri de scor
- Folosite: `MATERIAL:*` și `SYSTEM:*` existente (tabelele 2.2 / 2.3), `BED_STORAGE`, `TV_MEDIA_WALL`, `KITCHEN_*` existente.
- NOU: `KITCHEN_COUNTERTOP:FIRM_DECIDES`, 0 puncte — `seed.ts` (`SIZING_CONFIG`, lângă rândurile `KITCHEN_COUNTERTOP`) + migrarea
  `apps/backend/prisma/migrations/20261114120000_kitchen_countertop_firm_decides/migration.sql`
  (`INSERT INTO "project_sizing_config" ("id","key","option","weight") VALUES (gen_random_uuid()::text,'KITCHEN_COUNTERTOP','FIRM_DECIDES',0) ON CONFLICT ("key","option") DO NOTHING;`).
- „Decide firma”: material = ca „Altul” (2), deschidere = 0 (PO c7-2) → fără rânduri noi. Pistoane = AVENTOS (3).
- `docs/03 §4.5`: de scris cât valorează „decide firma”, „Fără uși sau sertare”, pistoanele, tapițatele (ALTUL).

### 6.4 Exemple pentru testul „diferența explicată” (`packages/shared/src/questionnaire/score-v6.test.ts`)
Ponderi din `seed.ts`. Fiecare exemplu calculează `computeSizing`-ul pur (sau suma ponderilor pe `collectScoreEntries`) pe ambele versiuni.
| # | Cerere | Versiunea veche | Versiunea nouă | Diferență și cauza |
|---|---|---|---|---|
| A | Hol: cuier 1,0 m + oglindă 0,6 m, PAL; azi deschidere obligatorie Mâner la ambele; nou: oglindă „decide firma” | HALLWAY 3 + UNDER_2M 1 + QTY_2_3 2 + PAL 1 + MANER 1 + PAL 1 + MANER 1 = **10** | 3 + 1 + 2 + PAL 1 + ALTUL 2 = **9** | −1: două sisteme false dispar (−2), oglinda ALTUL în loc de PAL (+1) |
| B | Dormitor: dulap 2,4 m uși glisante, MDF vopsit; azi „Mâner” la deschidere | BEDROOM 4 + FROM_2_TO_4M 3 + QTY_1 0 + MDF_VOPSIT 3 + MANER 1 = **11** | 4 + 3 + 0 + 3 + GLISANTE 3 = **13** | +2: ușile glisante intră în cost (c3) |
| C | Dormitor: pat 160 fără depozitare (lemn masiv, azi Push) + pereche noptiere 0,5 m (PAL, Mâner) | 4 + FROM_2_TO_4M 3 (0,5 + 1,6) + QTY_2_3 2 + LEMN 4 + PUSH 2 + PAL 1 + MANER 1 = **17** | 4 + 3 + 2 + 4 + 1 + 1 = **15** | −2: patul fără sertare nu mai are deschidere |
| D | Comodă TV ghidată 1,6 m, PAL, 3D cu mâner; azi și ecranul separat cu Push | PIECE_TV_UNIT 2 + UNDER_2M 1 + QTY_1 0 + PAL 1 + max(PUSH, MANER) 2 = **6** | 2 + 1 + 0 + 1 + MANER 1 = **5** | −1: o singură sursă (3D) |
| E | Canapea de catalog 2,2 m; azi „PAL” la „structură” | PIECE_SOFA 3 + FROM_2_TO_4M 3 + QTY_1 0 + PAL 1 = **7** | 3 + 3 + 0 + ALTUL 2 = **8** | +1: cadrul îl alege firma, punctaj mediu (PO c1-2) |
Toate fără buget / proiectare (scor de bază = cost). Agentul care scrie testul verifică întâi bucket-urile reale (`roomSizeBucket`,
`itemQuantityBucket` din `mapping.ts`) și corectează cifrele din tabel dacă un prag diferă — diferența trebuie explicată în test.

---

## 7. Ciorne, editare, server

- **Versiunea unei camere noi**: `configurator-store.ts addRoom` / `addRoomWithAnswers` folosesc `CURRENT_FLOW_VERSION[roomType]`
  (l. 672, 683) → după schimbarea din valul 3, camerele noi pornesc pe versiunea nouă. Camerele existente își țin `flowVersion`
  (ciornă locală, ciornă de pe server, editarea unei cereri publicate — `configurator-wizard.tsx:115` citește `r.flowVersion`).
  Editarea unei cereri publicate: camerele vechi rămân pe versiunea lor, o cameră adăugată în editare primește versiunea nouă —
  cereri mixte, acceptate (fiecare cameră se validează pe versiunea ei).
- **Store**: nicio migrare de ciornă (persist `version: 6` rămâne; nimic nu se mută între versiuni). `copyRoomAnswers` refuză deja
  versiuni diferite (l. 777) — interfața să ascundă butonul „Copiază din …” când versiunile diferă (pachet E).
- **Studio** (`stores/studio-transfer.ts:60`): azi o piesă re-transferată primește `CURRENT_FLOW_VERSION` dar își păstrează răspunsurile
  vechi → după lansare, o piesă v3 cu `openingSystems` ar deveni invalidă pe v4. Schimbare: `flowVersion: previous?.roomType === roomType ?
  previous.flowVersion : CURRENT_FLOW_VERSION[roomType]` (piesa existentă = cameră veche; doar piesele noi primesc versiunea nouă).
- **Server**: `configurator.service.ts:106` acceptă orice versiune înregistrată → ambele versiuni sunt valide simultan fără cod nou.
  Nu se respinge o cameră nouă trimisă pe versiunea veche (un tab vechi deschis) — e tot o versiune validă.
  Teste noi (pachet F): publicare cu camere pe versiunile noi; republicarea unei cereri pe versiunile vechi; `FIRM_DECIDES` / `NO_FRONTS`
  respinse pe versiunile vechi (`validation.optionInvalid`); `systemsWardrobe` la uși glisante respins; „Altă piesă” v2 cu dimensiuni.
- **Teste de invarianță**: `score-invariance.test.ts` și `firm-text.test.ts` se restrâng la `FLOW_VERSIONS_BEFORE_ETAPA6`
  (`allFixtureFlows({ only: 'legacy' })`) → instantaneele existente rămân BYTE-identice; versiunile noi primesc instantanee noi
  (`__snapshots__/score-v6.json`, `firm-text-v6.json`) generate o singură dată în valul 3 și citite de revizor.

---

## 8. Interfața

- **`step-renderer.tsx`** (pachet E):
  - multi-choice: la bifarea unei opțiuni `exclusive` se golesc celelalte; la bifarea alteia se scoate opțiunea exclusivă.
  - `pieces` cu `rowVersion: 2`: trei câmpuri opționale în cm (Lățime / Înălțime / Adâncime, întregi, `inputMode="numeric"`), select
    de material cu „Nu știu — vreau recomandarea firmei” (pune `material: 'ALTUL'` + `materialChoice`), bifele de deschidere Mâner / Push /
    Decide firma / Fără uși sau sertare (ultimele două exclusive, scriu `openingChoice`), contorul Detalii la 1800. Rândurile v1 neschimbate.
  - textul „Altul” (pas `text` cu id `*Other`) randat fără număr în contor (regula de 3 întrebări — în `room-flow-runner.tsx`, Edit punctual
    pe calculul `numbered` făcut de `e6-now`).
- **`room-screens.ts`**: nimic (grupurile noi sunt consecutive).
- **`illustrations/question-anchor.tsx`**: `screenGroup === 'piece:ALL'` → banda cu toate piesele comune bifate, `active: '*'`;
  `SINGLE_TARGET` neschimbat (cheile `material` / `openingSystems` acoperă și piesele ghidate v4).
- **`room-spec-card.tsx`**: regula `MATERIAL_STEP` devine `/^(material|frontMaterial|openingSystems|systems|sameFinish|liftUp)/`
  (alegerile sunt deja în piese); badge-urile „Recomandarea firmei” (6.2).
- **Sumar / Review** (`review-room-card.tsx`, `room-answer-summary.tsx`): nimic obligatoriu — `summarizeAnswers` arată pașii noi cu
  titlurile lor; titlurile de material sunt pe piesă (de aceea fiecare piesă are cheia ei, 4.2), altfel rezumatul ar repeta același titlu.
- **Ilustrații** (`illustrations/index.tsx`, `common.tsx`) — testul `coverage.test.tsx` cere zero „fallback-icon” pe versiunile curente:
  | Valoare / pas | Imagine |
  |---|---|
  | `FIRM_DECIDES` (orice pas) | NOUĂ: desen SVG în `common.tsx` `IlluFirmDecides` (cartonaș cu semn de întrebare + cheie), în `COMMON_BY_VALUE` |
  | `NO_FRONTS` | NOUĂ: SVG `IlluNoFronts` (corp deschis, fără uși), în `COMMON_BY_VALUE` |
  | `PISTONS` | refolosește `PhotoAventos` |
  | `MDF_INTEGRAL` | refolosește `PhotoMdfVopsit` |
  | WOOD `LEMN_MASIV` / `MDF_FURNIR` / `PAL` | valorile comune existente (`PhotoLemnMasiv`, `PhotoMdfFurnir`, `PhotoPal`) |
  | `MIRROR_FRAME_WOOD` / `MIRROR_FRAME_MDF` | `PhotoLemnMasiv` / `PhotoMdfVopsit` |
  | `MIRROR_FRAMELESS` / `MIRROR_FRAME_METAL` | NOI: SVG `IlluMirrorFrameless`, `IlluMirrorMetal` în `room-pieces.tsx` sau `common.tsx` |
  | `WORKTOP_PAL_POSTFORMED` / `WORKTOP_HPL` / `WORKTOP_QUARTZ` | fotografiile blatului de bucătărie (`countertop-pal`, `countertop-hpl`, `countertop-quartz`) |
  | `WORKTOP_HPL_COMPACT` / `WORKTOP_SOLID_WOOD` | `IlluCountertopHpl` / `IlluCountertopWood` |
  | HALLWAY `wardrobeDoorType` | `WARDROBE_DOOR_PHOTOS` (ca la dormitor) |
  | `sameFinishAll`, `liftUpDoors` (boolean) | simbolul Da / Nu existent („boolean-symbol”, acceptat de test) |
  Valorile `WORKTOP_*` / `MIRROR_*` merg în `COMMON_BY_VALUE` (prefixate, fără coliziuni). Fără PNG noi.
- **Chei i18n noi** (toate sub `Configurator`):
  - `common.finish.firmDecides.{label,description}`, `common.finish.frontMaterial.subtitle`, `common.finish.panelMaterial.subtitle`,
    `common.finish.woodMaterial.subtitle`, `common.finish.mirror.subtitle`, `common.finish.worktop.subtitle`;
  - `common.finish.integralMdf.{label,description,info.title,info.body}`; `common.finish.wood.<LEMN_MASIV|MDF_FURNIR|PAL>.{label,description}`;
    `common.finish.mirror.<id>.{label,description}`; `common.finish.worktop.<id>.{label,description,info.title,info.body}`;
  - `common.finish.opening.subtitle`, `common.finish.opening.<NO_FRONTS|PISTONS>.{label,description,info.title,info.body}`;
  - `common.finish.sameAll.{title,subtitle}`, `common.finish.allMaterial.title`, `common.finish.allOpening.title`,
    `common.finish.liftUp.{title,cardLabel,subtitle}`;
  - per flux: `flows.<ROOM>.v<N>.<materialStepId>.title` (material pe piesă), `flows.BATHROOM.v3.<systemsId>.title`,
    `flows.HALLWAY.wardrobeDoorType.*`, `flows.KITCHEN.v4.frontMaterial.title`, `flows.DRESSING.v4.material.title`,
    `flows.<PIECE>.v4.material.title` / `flows.PIECE_*.v2.material.title`;
  - `validation.exclusiveOption`, `roomSpec.firmRecommendation`, `roomSpec.firmRecommendationOpening`,
    `pieces.{width,height,depth,dimensionsHint,firmDecides,noFronts,openingTitle}`.
  Fragmente: `e6-found`, `e6-rooms-a`, `e6-rooms-b`, `e6-kd`, `e6-guided`, `e6-ui` — fiecare doar cheile fișierelor lui
  (`common.finish.*` = fundația; titlurile per flux = agentul fluxului; `roomSpec.*`, `pieces.*`, `validation.*` = interfața).

---

## 9. Pachetele de lucru

Proprietate strictă: fiecare fișier are UN proprietar. Ce trebuie montat în fișierul altuia se cere în raport („De făcut de coordonator”).
Agenții nu rulează build / suite întregi; doar testele lor prin `low.cjs`. Coordonatorul rulează `pnpm -F @marketplace/shared build`
după valul 1 (backend și frontend iau tipurile din `dist`).

### Valul 1 — fundația (1 agent, `e6-found`, ~2,5 zile)
Fișiere: `questionnaire/types.ts`, `questionnaire/engine.ts`, `questionnaire/index.ts` (exporturi), `flows/index.ts`, `flows/finish-sets.ts` (NOU),
`flows/piece-finish.ts` (NOU), `questionnaire/pieces-row.ts` (NOU), `piece3d/config.ts` (doar `configHasFronts`), `flows/guided-pieces/index.ts`,
`firm-text.fixtures.ts`, `score-invariance.test.ts`, `firm-text.test.ts`, TOATE scheletele din tabelul 1, teste noi
`flows/finish-sets.test.ts`, `flows/piece-finish.test.ts`, `engine.test.ts` (doar `describe` nou „etapa 6 — motor”), fragment `e6-found` (`common.finish.*`, `validation.exclusiveOption`).
Exportă (din `@marketplace/shared`): `FIRM_DECIDES`, `NO_FRONTS`, `PISTONS`, `MDF_INTEGRAL`, `MaterialSetKind`, `OpeningSetKind`,
`materialSetOptions`, `openingOptions`, `kitchenCountertopOptionsV4`, `resolveMaterial`, `resolveOpening`, constantele de note,
`FinishPieceDef`, `FinishOpts`, `sameFinishStep`, `pieceFinishSteps`, `buildFinishItems`, `renameItem`, `pieceRowV2Schema`, `PieceRowV2`,
`derivePieceRowsV2`, `firmRecommendations`, `FirmRecommendation`, `configHasFronts`, `FLOW_VERSIONS_BEFORE_ETAPA6`.
Teste: `not` / `atLeast` (vechi neschimbate), opțiune exclusivă acceptată singură și respinsă cu altele, `rowVersion: 2`; seturile au opțiunile
din tabelele 2.2 / 2.3; `resolveMaterial`/`resolveOpening` pe toate valorile; constructorul pe un flux-jucărie (3 piese: YES, MAYBE, NO + una
WOOD): pași, grupuri, vizibilitate cu / fără `sameFinishAll`, derivarea copiază răspunsul comun pe fiecare piesă comună și NU pe cea WOOD;
invarianța: instantaneele vechi neschimbate; toate scheletele înregistrate.

### Valul 2 — în paralel (6 agenți, fără fișiere comune)
| Pachet | Fișiere (proprietate) | Primește de la fundație | Teste („Cum se verifică”) | Mărime |
|---|---|---|---|---|
| **A** `e6-rooms-a` | `bedroom.v3.ts`, `hallway.v2.ts`, `office.v3.ts`, `living.v4.ts` + `flows/rooms-a.v6.test.ts` + fragment | constructorul, seturile | hol: cuier + oglindă → zero pași de deschidere; bancă → `NO_FRONTS` → `systems: []`; pat fără depozitare → fără deschidere, cu sertare → vizibilă; dulap glisant → GLISANTE și `systemsWardrobe` respins; batant + Push → PUSH; dormitor 6 piese → „Nu” ≤ 10 ecrane, „Da” un singur ecran de material (prin `groupScreens` + `visibleSteps`, cu `room-screens` re-implementat minimal în test sau importat din shared dacă există); „același material” → toate piesele comune cu același material și aceeași deschidere; „decide firma” fără text acceptat, respins pe v2 | 3 zile |
| **B** `e6-rooms-b` | `bathroom.v3.ts`, `laundry.v3.ts`, `balcony.v3.ts`, `pantry.v3.ts` + `flows/rooms-b.v6.test.ts` + fragment | idem | baia: pas de deschidere pe fiecare piesă; „Integral din MDF” → MDF + notă, doar la baie / balcon; blat spălătorie HPL → ALTUL + `Blat: HPL`; blatul fără „Recomandat”, celelalte piese îl păstrează la `ventilation = NONE`; balcon fără `systemsWorktop`/`systemsShelves`; debara: material + deschidere pe `piece:CABINETS` | 2,5 zile |
| **C** `e6-kd` | `kitchen.v4.ts`, `dressing.v4.ts`, `pieces.v2.ts` + `flows/kd.v6.test.ts` + fragment | idem + `pieceRowV2Schema`, `derivePieceRowsV2` | blatul bucătăriei acceptă `FIRM_DECIDES`, v2 / v3 îl resping; Gola / Aventos / Pistoane doar la bucătărie, Pistoane doar la suspendate; dressing batant → pas de deschidere pe ecranul materialului, glisant → GLISANTE fără pas; „Altă piesă” 120 × 80 × 40 → descrierea conține dimensiunile, fără dimensiuni → nimic în plus; liste fără „Uși glisante” | 2 zile |
| **D** `e6-guided` | `guided-pieces/v4.ts`, `guided-pieces/furniture-v4.ts`, `guided-pieces/catalog-v2.ts` + `flows/guided-pieces/v4.test.ts` + fragment | idem + `configHasFronts` | comoda TV v4 → o singură sursă (3D), sistemul = alegerea din 3D, fără `openingSystems`; bibliotecă cu toate zonele deschise → fără sistem; pistoane → AVENTOS + notă; canapea → fără pas de material, ALTUL + `Cadru: îl alege firma` + recomandarea firmei; masă / pat cu setul de lemn, fără preț în opțiuni | 2 zile |
| **E** `e6-ui` | `step-renderer.tsx` (+ test nou `step-renderer-v6.test.tsx`), `room-flow-runner.tsx` (Edit punctual: contorul + butonul „copiază răspunsurile” ascuns când versiunile diferă), `room-spec-card.tsx` (+ test), `illustrations/index.tsx`, `illustrations/common.tsx`, `illustrations/question-anchor.tsx`, `stores/studio-transfer.ts` (+ test), fragment `e6-ui` | tipurile noi (după build-ul shared) | componentă: exclusivitatea bifelor; rândul „Altă piesă” v2 (cm, decide firma, fără uși); fișa arată „Recomandarea firmei”, nu „Altul”, iar o cerere veche arată ca azi; banda `piece:ALL`; acoperirea ilustrațiilor (rulat după valul 2, cu versiunile noi ca „curente” în test prin `FLOW_REGISTRY`); Studio păstrează versiunea piesei existente | 2,5 zile |
| **F** `e6-seed` | `apps/backend/prisma/seed.ts` (un rând), migrarea `20261114120000_kitchen_countertop_firm_decides`, `configurator.service.spec.ts` (`describe` nou), `apps/backend/src/modules/requests/configurator.v6.integration.spec.ts` (NOU) | versiunile înregistrate (schelete → teste roșii până la sfârșitul valului 2; agentul scrie testele pe contractul din acest document și le rulează la final) | 7. „Server” + rândul de scor există după seed / migrare | 0,75 zile |

Fișiere comune și cum se evită conflictele:
- `flows/index.ts`, `guided-pieces/index.ts`, `questionnaire/index.ts` — doar fundația (toate versiunile înregistrate din start ca schelete).
- `ro.json` / `en.json` — nimeni direct; doar fragmente, îmbinate de coordonator cu `merge-i18n.cjs` (refuză conflicte / lipsă de paritate).
- `engine.test.ts`, `__snapshots__/*` — fundația (valul 1) și coordonatorul (valul 3); fluxurile își scriu testele în fișiere noi.
- `common.ts`, `per-piece.ts`, fluxurile vechi — nimeni.
- Dacă un flux are nevoie de o capabilitate care lipsește din fundație: se oprește și o cere în raport (nu o adaugă în fișierul fundației).

### Valul 3 — închidere (coordonator + 3 agenți)
1. Coordonator: îmbină fragmentele, `shared build`, schimbă `CURRENT_FLOW_VERSION` (o linie pe tip de cameră), generează `score-v6.json` /
   `firm-text-v6.json`, rulează typecheck, lint, suitele (pe rând, `run-checks.sh`). Repară testele care foloseau versiunea curentă implicit
   (de fixat pe versiunea explicită).
2. **e2e** `e6-e2e` (~1 zi): `apps/frontend/e2e/helpers/guided-request.ts` — multi-choice: nu bifa opțiunile exclusive (`option.exclusive`);
   `sameFinishAll`: „Da” în EN, „Nu” în RO (ambele drumuri, ca la buget); `preferred` + `wardrobeDoorType: 'HINGED'` (ca să apară deschiderea);
   noul ecran comun și titlurile per piesă; `configurator-all-rooms.spec.ts` trece pe versiunile noi; un test nou care deschide o ciornă cu
   camere pe versiunile vechi și ajunge la Sumar (cererea veche se editează pe versiunea ei). Rulează pe GPU (Edge, flagurile din CLAUDE.md global).
3. **Revizor** `e6-review` (doar citește): invarianța (diff gol pe instantaneele vechi), corectitudinea copierii răspunsului comun, cost, i18n, ilustrații.
4. **Documente** `e6-docs`: `docs/03 §4.1` (material = fronturi, seturi proprii, deschidere doar cu fronturi, glisantele = tip de uși),
   `§4.5` (valoarea „decide firma”, pistoane, tapițate), `docs/07` (decizie nouă: material + deschidere pe un ecran — schimbă decizia
   PO din 2026-07-13 / docs/12 S2; `CHANGELOG OWN_PROJECT 2026-07-31` rămâne valabil: PO c14-3), `docs/04` (nicio coloană nouă; valorile
   speciale din răspunsuri), CHANGELOG cu „La lansare (PO)”: migrarea, anunțul către firme despre costul nou, parcurgerea celor 28 de fluxuri.
Parcurgerea celor 28 de fluxuri în browser (costul fix): coordonatorul, după e2e — cele 18 piese ghidate / de catalog / „Altă piesă” nu sunt în e2e.

---

## 10. DECIZIE NECESARĂ / riscuri (varianta mică și reversibilă recomandată; agenții NU extind produsul)

| # | Ce nu acoperă planul | Recomandarea (aplicată în proiect) |
|---|---|---|
| N1 | Pe ce enum se salvează „pe pistoane” | `AVENTOS` (3 puncte, același fel de mecanism de ridicare) + descrierea `Uși rabatabile pe pistoane…`; fișa arată badge-ul „Aventos” lângă descriere. Alternativă (fără schemă): rândul `SYSTEM:BUTON_PRESIUNE` (1 punct) — nepotrivit ca sens. |
| N2 | Pistoane la piesele 3D (comoda TV, bufet, corp suspendat) — 3D-ul are doar Push / Mâner | Bifă `liftUpDoors` pe ecranul materialului, nu o valoare nouă în configuratorul 3D. Mâner / push rămân o singură sursă. |
| N3 | „Decide firma” la deschidere pe piesele 3D; `frontStyle` lipsă | Nu se oferă (3D-ul e lista); `frontStyle` lipsă = fără sistem, ca la v3 (problema 43 `d2` „Push implicit” rămâne a ei). |
| N4 | „Integral din MDF … se punctează ca MDF-ul de azi” | Enum `MDF` (2 puncte, rândul există) + notă. Alternativă: `MDF_VOPSIT` (3). |
| N5 | Conținutul „setului de lemn” | Lemn masiv / Furnir natural / PAL cu decor lemn / Decide firma, fără „Altul”. |
| N6 | Prețul pe ml la rafturi / cuier (PANEL) | Păstrat (sunt tot mobilier din plăci). Ascuns doar la lemn, oglindă, blat. |
| N7 | Lista pieselor cu pistoane („spune dacă lista e alta”) | Exact lista PO: bucătărie, corp suspendat, bufet, comoda TV (camere + ghidată). Candidat de întrebat: dulapul cu oglindă din baie. |
| N8 | Pistoane la toată bucătăria sau doar la suspendate | Doar suspendate (unde e Aventos). |
| N9 | Dressing deschis (fără uși) cu sertare | Fără întrebare de deschidere (planul spune „dressingul cu uși batante”). |
| N10 | Patul ghidat (3D) cu sertare | Fără întrebare de deschidere, ca azi (3D-ul patului nu are mânere); regula „doar la sertare” se aplică patului din dormitor. |
| N11 | Întrebarea comună: ce piese cuprinde, are pistoane? | Doar corpurile BODY cu fronturi; patul, măsuța, oglinda, rafturile, blatul își păstrează ecranul; fără pistoane pe ecranul comun (cine vrea pistoane la comoda TV alege „Nu”). |
| N12 | „Cel mult 3 întrebări pe ecran” și câmpul „Altul” | „Altul” nu se numără (completare a materialului). Fără asta, dormitorul nu coboară sub 10 ecrane. |
| N13 | „Altă piesă”: deschiderea devine obligatorie? fără „Uși glisante”? | Da, obligatorie cu ieșirile „Decide firma” / „Fără uși sau sertare”; „Uși glisante” iese (regula unică), clientul scrie în Detalii. |
| N14 | „Altă piesă”: limitele dimensiunilor și lungimea pentru cost | Întregi 1–600 cm, doar în descriere; lungimea pentru cost rămâne euristica v1 (1 m pe bucată) — schimbarea ei ține de `d3` / `c5`. |
| N15 | Materialul implicit la derivare (CP-30: PAL vs Altul) | `ALTUL` peste tot în versiunile noi (apare doar în previzualizarea ciornelor). |
| N16 | Bucătăria: ecranul „Fronturi” rămâne cu până la 9 întrebări | Rămâne, pe zone (`e6-now`); împărțirea în 3 ecrane ar fi o altă versiune și mai multe ecrane. |
| N17 | Debaraua: întrebarea comună | Nu (doar două zone, cu seturi diferite). |
| N18 | Fișa firmei: potrivirea „Recomandarea firmei” după numele piesei | Două piese cu același nume în aceeași cameră primesc ambele badge-ul; acceptabil. |
| N19 | Tapițatele (canapea, fotoliu, taburet) | ALTUL + `Cadru: îl alege firma` și badge „Recomandarea firmei”; cost +1 față de PAL. |
| N20 | Hol: textul întrebării despre uși | Copie a textului din dormitor, chei proprii în `flows.HALLWAY`. |
| N21 | Momentul schimbării `CURRENT_FLOW_VERSION` | În valul 3, într-un commit separat; lansarea pe producție = PO, cu anunț către firme (costul se schimbă la cererile noi; două cereri asemănătoare pot costa diferit o vreme). |

Riscuri: (1) copierea răspunsului comun — acoperită de testele constructorului și ale fiecărui flux; (2) instantaneele vechi — testul restrâns
la `FLOW_VERSIONS_BEFORE_ETAPA6`, diff verificat de revizor; (3) testele care folosesc versiunea curentă implicit (e2e, `guided-pieces/v3.test.ts`,
teste de componentă) se rup la schimbarea `CURRENT_FLOW_VERSION` — se fixează pe versiune explicită în valul 3; (4) `questionnaire-content.test.tsx`
cere ca toate cheile din fluxuri să existe RO + EN — rulat după îmbinarea fragmentelor; (5) descrierile lungi (detalii „Altă piesă” + note) — tăiate la 2000.
