# Etapa 10 — proiectarea celei de-a doua versiuni noi a formularului (măsuri și întrebări lipsă)

Probleme: 49 `c9`, 50 `c5`, a doua parte din 21 `d3` + costul fix al versiunii noi.
Sursa hotărârilor: `docs/implementation/plan-reparatii-2026-11-13/etapa-10.md` (răspunsurile PO c9-1, c9-2, c9-3, c5-1, c5-2, c5-3
sunt FINALE), `etapa-05.md` §21 (d3, răspunsurile d3-1…d3-3), `docs/07` D-E5-3 / D-E5-4 / D-E5-22, D-E6-*, D-E8-33.
Model: `lucru-cu-agenti/etapa-06/DESIGN.md` (aceeași structură, aceleași reguli de fier).
Baza de cod citită: ramura `claude/reparatii-etapa-09` (din `245fab0`) cu lucrul NECOMIS al etapei 9 în curs (vezi §14).

---

## 1. Rezumat

- Apar **14 versiuni noi de flux** (a doua generație nouă de formular; o numim „formularul v7”, ca migrarea rezervată):
  10 camere — KITCHEN v5, DRESSING v5, LIVING v5, OFFICE v4, BEDROOM v4, BATHROOM v4, PANTRY v4, LAUNDRY v4, BALCONY v4, HALLWAY v3 —
  și 4 piese 3D — PIECE_BED v5, PIECE_TABLE v5, PIECE_BENCH v5, PIECE_SOFA v3.
- **Rămân neatinse** (nicio versiune nouă): PIECES („Altă piesă”) v2, cele 7 piese ghidate cu corpuri (PIECE_WARDROBE, PIECE_TV_UNIT,
  PIECE_BOOKCASE, PIECE_DESK, PIECE_DRESSER, PIECE_SHOE_CABINET, PIECE_NIGHTSTAND) v4, piesele de catalog PIECE_SIDEBOARD,
  PIECE_WALL_CABINET, PIECE_BATHROOM_VANITY, PIECE_ENTRYWAY, PIECE_ARMCHAIR, PIECE_OTTOMAN v2.
- `c9` (doar grupele alese de PO la c9-1): bucătărie — „fără corpuri suspendate”, chiuveta (montaj + material), frigiderul (încorporabil /
  independent); dormitor — stofa patului tapițat, interiorul dulapului, mărimile 120 × 200 și lungimea 190; baie — lavoarul (tip + cine îl aduce);
  spălătorie — încărcarea mașinii; canapea — extensibilă, ladă; pat 3D — „Altă mărime”; masă 3D — lungimea deschisă a mesei extensibile.
  Toate opționale, cu „Nu știu — vreau recomandarea firmei” (valoarea comună `FIRM_DECIDES` din etapa 6).
- `c5`: o mică schimbare în motor (slot de dimensiune opțional, cu valoare tipică ca indiciu); tavanul doar cu o piesă înaltă (7 camere);
  lățime obligatorie + înălțime opțională la piesele înalte; la balcon / spălătorie / debara lățimea fiecărei piese dă mărimea, peretele rămâne
  informativ; walk-in cu laturile A / B / C; latura B / C de la 0,6 m (bucătărie, dressing); holul îngust / generos / nu știu; înălțimea mesei și a
  băncuței în 3D. Plus pașii „acum”, fără versiune nouă (texte, eticheta biroului, ordinea câmpurilor, planșa dormitorului).
- `d3` (a doua parte): canapeaua primește puncte pe configurație (locuri, șezlong) — valori DE CONFIRMAT DE PO.
- Costul: scade doar unde nu se mai creează „Corpuri suspendate”, crește la canapeaua extensibilă (și pe locuri / șezlong, d3); toate celelalte
  valori noi au rânduri de scor cu 0 puncte. O singură migrare de date: `20261115100000_form_v7_scores` (doar `INSERT … ON CONFLICT DO NOTHING`).
- Nicio coloană nouă, niciun enum nou în baza de date. Câmpurile 3D noi sunt opționale și primite DOAR de versiunile noi.

---

## 2. Reguli de fier (pentru toți agenții)

1. **Versiunile existente sunt ÎNGHEȚATE.** Niciun fișier `*.vN.ts` existent (inclusiv cele din etapa 6: `kitchen.v4.ts`, `dressing.v4.ts`,
   `living.v4.ts`, `office.v3.ts`, `bedroom.v3.ts`, `bathroom.v3.ts`, `pantry.v3.ts`, `laundry.v3.ts`, `balcony.v3.ts`, `hallway.v2.ts`,
   `pieces.v2.ts`, `guided-pieces/v4.ts`, `furniture-v4.ts`, `catalog-v2.ts`), `common.ts`, `per-piece.ts`, `pieces-flow.ts`, `builder.ts`,
   `v2.ts`, `v3.ts`, `furniture-v3.ts`, `catalog-v1.ts`, `pieces.ts`, `pieces-row.ts` nu se modifică.
   `finish-sets.ts` și `piece-finish.ts` (folosite de versiunile etapei 6) primesc DOAR adăugări opționale (câmpuri / funcții noi), făcute de
   fundație; o definiție fără câmpurile noi produce exact aceiași pași și aceeași derivare.
2. **Instantaneele rămân BYTE-identice**: `__snapshots__/score-invariance.json`, `firm-text.json` (versiunile dinainte de etapa 6) ȘI
   `score-v6.json`, `firm-text-v6.json` (versiunile etapei 6). Fiecare agent verifică la final `git diff --stat -- packages/shared/src/questionnaire/__snapshots__` = gol.
   Versiunile noi primesc instantanee NOI: `score-v7.json`, `firm-text-v7.json` (§10).
3. **Cererile publicate și ciornele în curs rămân pe versiunea lor** (`request_rooms.flow_version`, `configurator-store` → `CURRENT_FLOW_VERSION`
   doar la camerele noi; etapa 6 §7 rămâne valabil): se rezumă, se editează și costă la fel. O cerere veche editată poate primi o cameră nouă pe
   versiunea nouă (cerere mixtă, acceptată).
4. **Comutarea = o singură constantă**: `CURRENT_FLOW_VERSION` din `flows/index.ts`, schimbată de coordonator în valul 2, într-un commit separat
   (14 linii). Până atunci versiunile noi sunt înregistrate în `FLOW_REGISTRY` dar nu pornește nimeni pe ele.
5. **Nicio coloană nouă, niciun enum nou** (`schema.prisma`, `enums.ts`, `Material`, `ItemSystem` neschimbate). Răspunsurile noi trăiesc în
   `answers` (JSON-ul camerei) și ajung la firmă în `request_items.description` (text RO, tăiat la 2000 — `finishDescription`).
6. **Configurațiile 3D vechi rămân valide**: câmpurile noi din `PieceConfig3d` sunt opționale; schemele (`.strict()`) le acceptă, iar motorul le
   RESPINGE pe pașii 3D care nu le declară (`Configurator3dStep.features`, §4.3) → pe versiunile vechi comportamentul e identic cu azi
   (azi un câmp necunoscut e respins de `.strict()`; mâine e respins de verificarea de funcții). Normalizarea / descrierea / geometria unei configurații
   fără câmpurile noi nu se schimbă.
7. **Rânduri de scor doar adăugate**, în `seed.ts` și în migrarea `20261115100000_form_v7_scores` (adminul poate doar edita rânduri existente;
   ponderile sunt 0..100, deci nu există puncte negative — „scade” = piesa nu se mai creează).
8. Texte RO + EN doar prin fragmente (`…\reparatii\etapa-10\i18n\<id>.{ro,en}.json`, îmbinate cu `merge-i18n.cjs`). „Firmă”, niciodată „atelier”.
   Valorile salvate: engleză, UPPER_SNAKE_CASE. Descrierile pentru firmă: română cu diacritice, fără coduri interne (testul `firm-text`).
9. Agenții NU extind produsul: doar întrebările din tabelul §5. Ce lipsește → raport, „DECIZIE NECESARĂ”.

---

## 3. Tabelul versiunilor

| # | RoomType | Azi (curent) | Nou | Fișier nou (pornește din) | Ce se schimbă (c9 / c5 / d3) |
|---|---|---|---|---|---|
| 1 | KITCHEN | 4 | **5** | `flows/kitchen.v5.ts` (`kitchen.v4.ts`) | c9: `wallCabinets` (fără corpuri suspendate), `sinkMounting`, `sinkMaterial`, `fridgeType`; electrocasnicele în descriere; c5: latura B/C de la 0,6 m |
| 2 | DRESSING | 4 | **5** | `flows/dressing.v5.ts` (`dressing.v4.ts`) | c5: walk-in cu A / B / C; B / C de la 0,6 m |
| 3 | LIVING | 4 | **5** | `flows/living.v5.ts` (`living.v4.ts`) | c5: tavan doar cu bibliotecă / vitrină; înălțime opțională doar la piesele înalte |
| 4 | OFFICE | 3 | **4** | `flows/office.v4.ts` (`office.v3.ts`) | c5: tavan doar cu bibliotecă / dulap; înălțime opțională la ele |
| 5 | BEDROOM | 3 | **4** | `flows/bedroom.v4.ts` (`bedroom.v3.ts`) | c9: `D_120`, `bedLength`, `bedFabric`, `wardrobeInterior`; c5: tavan doar cu dulap; înălțimea dulapului opțională |
| 6 | BATHROOM | 3 | **4** | `flows/bathroom.v4.ts` (`bathroom.v3.ts`) | c9: `basinType`, `basinSupply`; c5: tavan doar cu dulap cu oglindă / coloană; înălțime opțională la ele |
| 7 | PANTRY | 3 | **4** | `flows/pantry.v4.ts` (`pantry.v3.ts`) | c5 / d3: lățimea rafturilor și a dulapurilor dă mărimea; laturile informative; tavan doar cu dulapuri |
| 8 | LAUNDRY | 3 | **4** | `flows/laundry.v4.ts` (`laundry.v3.ts`) | c9: `washerLoading`, aparatele în descriere; c5 / d3: lățimea pieselor dă mărimea, peretele informativ; tavan doar cu dulapuri înalte |
| 9 | BALCONY | 3 | **4** | `flows/balcony.v4.ts` (`balcony.v3.ts`) | c5 / d3: lățimea pieselor dă mărimea, lungimea / adâncimea balconului informative; tavan doar cu dulapul |
| 10 | HALLWAY | 2 | **3** | `flows/hallway.v3.ts` (`hallway.v2.ts`) | c5: `hallWidth` (îngust / generos / nu știu); înălțime opțională la dulap / cuier (tavanul era deja doar la ele) |
| 11 | PIECES | 2 | neschimbat | — | — |
| 12–18 | PIECE_WARDROBE, PIECE_TV_UNIT, PIECE_BOOKCASE, PIECE_DESK, PIECE_DRESSER, PIECE_SHOE_CABINET, PIECE_NIGHTSTAND | 4 | neschimbat | — | — |
| 19 | PIECE_BED | 4 | **5** | `flows/guided-pieces/furniture-v5.ts` (`furniture-v4.ts`) | c9 / c5: „Altă mărime” de saltea în 3D (`bed.customSize`) |
| 20 | PIECE_TABLE | 4 | **5** | același fișier | c9: lungimea deschisă (`table.openLengthM`); c5: înălțimea mesei (`table.customHeightM`) |
| 21 | PIECE_BENCH | 4 | **5** | același fișier | c5: înălțimea băncuței (`bench.customHeightM`) |
| 22 | PIECE_SOFA | 2 | **3** | `flows/guided-pieces/catalog-v3.ts` (bucla din `catalog-v2.ts`, doar SOFA) | c9: `sofa.sleeper`, `sofa.storage`; d3: puncte pe locuri și șezlong |
| 23–28 | PIECE_SIDEBOARD, PIECE_WALL_CABINET, PIECE_BATHROOM_VANITY, PIECE_ENTRYWAY, PIECE_ARMCHAIR, PIECE_OTTOMAN | 2 | neschimbat | — | (d3: fotoliul și taburetul rămân pe mărimea din `ROOM_SIZE` — DE CONFIRMAT, E10-N17) |

Versiunile vechi (toate) rămân în `FLOW_REGISTRY`. Bucătăria și dressingul își păstrează tavanul / înălțimea dulapului (c5 pasul 3).

---

## 4. Schimbările din motor (fundația, valul 0)

### 4.1 Slot de dimensiune opțional cu valoare tipică (c5 pasul 2)

`packages/shared/src/questionnaire/types.ts`, `DimensionSlot` — două câmpuri NOI, opționale:
```ts
export interface DimensionSlot {
  id: string; labelKey: string; unit: 'm'; min: number; max: number; step?: number;
  countsTowardLinear?: boolean;
  // etapa 10 (c5): slotul poate ramane gol la publicare; lipsa = "clientul nu stie" (nu se inventeaza nimic)
  optional?: boolean;
  // etapa 10 (c5): valoarea tipica, in metri, aratata doar ca indiciu ("de obicei 240 cm"); NU se salveaza, NU intra in calcul
  typicalM?: number;
}
```
`engine.ts`, `stepAnswerSchema` cazul `dimension-group`:
```ts
const num = z.number({ required_error: 'validation.dimensionRequired', invalid_type_error: 'validation.dimensionOutOfRange' })
  .min(slot.min, 'validation.dimensionOutOfRange').max(slot.max, 'validation.dimensionOutOfRange');
shape[slot.id] = slot.optional === true ? num.optional() : num;
```
- Compatibilitate: niciun flux vechi nu pune `optional` → schema identică (D-E8-33 neschimbat). `.strict()` rămâne.
- O valoare dată într-un slot opțional se validează la fel (interval); `null` / text = `validation.dimensionOutOfRange` (ca azi). Golul = cheia lipsă
  din obiect (interfața NU scrie `0`, `NaN` sau `null`; la ștergerea câmpului cheia se scoate).
- Pasul `dimension-group` rămâne obligatoriu cât are cel puțin un slot obligatoriu (lățimile). Nu există pas cu toate sloturile opționale
  în versiunile noi (regula „lățime obligatorie”); dacă ar exista, răspunsul `{}` e valid.
- `linearMeters` / `dimensionValues` neschimbate (sloturile goale nu au valoare → nu intră). Sloturile de înălțime NU au `countsTowardLinear`.
- `validateRoomAnswers`, `pruneAnswers` neschimbate. Proiectul propriu (`ownProject`) sare tot pasul, ca azi.

`summarizeAnswers`, cazul `dimensions` — câmp NOU opțional pe intrare (`types.ts`, `AnswerSummaryEntry` varianta `dimensions`):
```ts
| { kind: 'dimensions'; stepId: string; labelKey: string;
    slots: { labelKey: string; value: number }[];
    // etapa 10: sloturile optionale lasate goale (lipsa pe fluxurile vechi)
    missing?: { labelKey: string; typicalM?: number }[] }
```
Se pune doar când există sloturi `optional` fără valoare; intrarea se emite dacă `slots.length > 0 || missing.length > 0`.
Pe fluxurile vechi câmpul lipsește → rezumatul identic (instantaneele `firm-text*` nu includ rezumatul, dar `engine.test.ts` verifică forma).

Helper NOU în `flows/measure-sets.ts` (fundația; folosit de toate camerele noi):
```ts
export const TALL_PIECE_SUBTITLE_NOTE: string;                         // nimic in UI; doar pentru teste/documentare
export function pieceWidthSlot(id: string, labelKey: string, range: { min: number; max: number }): DimensionSlot; // = linearSlot (countsTowardLinear: true)
export function optionalHeightSlot(id: string, labelKey: string, range: { min: number; max: number }, typicalM?: number): DimensionSlot;
  // { id, labelKey, unit:'m', min, max, step: 0.05, optional: true, typicalM }
export function informativeSlot(id: string, labelKey: string, range: { min: number; max: number }): DimensionSlot;
  // perete / balcon: OBLIGATORIU, dar FARA countsTowardLinear (nu mai da marimea) — step 0.1
export function ceilingIfTall(selected: readonly string[], tall: readonly string[]): DimensionSlot[];
  // [ceilingHeightSlot()] daca vreuna din piesele bifate e inalta, altfel [] (regula holului, generalizata)
```

### 4.2 Legătura cu `dimension-check.ts` / `dimensionSlotStatus` (etapa 8) — pachetul `e10-ui`

`apps/frontend/src/components/configurator/dimension-check.ts`:
- `SlotState = 'ok' | 'missing' | 'outOfRange' | 'skipped'` — `'skipped'` = slot `optional` fără valoare (NU e eroare).
- `DimensionSlotStatus` primește `optional: boolean` și `typicalM?: number` (copiate din slot).
- `summary-rows.ts` `dimensionIssue`: numără doar `missing` (cele `skipped` nu cer „Completează…”); `room-screens.ts` (contorul / ecranul complet)
  tratează `skipped` ca `ok`. Pe fluxurile vechi `skipped` nu apare niciodată → comportament identic (testele `dimension-check.test.ts` existente trec neschimbate).

Afișare:
- **Ecranul de dimensiuni** (`step-renderer.tsx`, cazul `dimension-group`): sub eticheta unui slot `optional` apare „(opțional)” și, dacă are `typicalM`,
  placeholder-ul / textul de ajutor „de obicei {value}” cu `formatDimension(typicalM, { unit, locale })` (unitatea aleasă de client, D-E8-1;
  ex. „de obicei 240 cm” / „de obicei 2,4 m”). Câmpul gol nu e marcat roșu la „Continuă”. Cheile: `Configurator.dimensions.optionalTag`
  („opțional” / „optional”), `Configurator.dimensions.typicalHint` („de obicei {value}” / „usually {value}”).
- **Sumarul clientului** (`summary-rows.ts`, `case 'dimensions'`): slotul `skipped` → rând cu valoarea `Configurator.dimensions.notGiven`
  („Nu ai dat-o — o stabilești cu firma” / „Not given — you'll agree it with the firm”), fără `invalid`.
- **Fișa firmei** (`room-spec-card.tsx`, linia de sloturi ~l. 331): după sloturile cu valoare se adaugă `dims.missing`:
  `{label}: {roomSpec.dimNotGiven}` — „nespecificată de client (de obicei {value})” / „not given by the client (usually {value})”, `value` în cm
  (firma vede mereu cm). Pe cererile vechi `missing` lipsește → fișa identică.
- Planșa (`dimension-figures.tsx`): slotul opțional își păstrează litera; fără valoare, lângă literă nu apare nimic (ca azi la un slot gol).

### 4.3 Câmpuri 3D noi acceptate doar de versiunile noi (`Configurator3dStep.features`)

`types.ts`:
```ts
export type Configurator3dStep = BaseStep & {
  type: 'configurator-3d'; piece: Piece3dKind;
  scoreEntries?: (config: PieceConfig3d) => ScoreEntry[];
  // etapa 10: campurile 3D optionale pe care pasul le accepta; lipsa = niciunul (fluxurile vechi)
  features?: readonly Piece3dFeature[];
};
```
`piece3d/features.ts` (NOU, fundația):
```ts
export const PIECE3D_FEATURES = ['SOFA_SLEEPER', 'SOFA_STORAGE', 'BED_CUSTOM_SIZE', 'TABLE_OPEN_LENGTH', 'TABLE_CUSTOM_HEIGHT', 'BENCH_CUSTOM_HEIGHT'] as const;
export type Piece3dFeature = (typeof PIECE3D_FEATURES)[number];
export function piece3dFeaturesUsed(config: PieceConfig3d): Piece3dFeature[];
  // SOFA_SLEEPER: config.sofa?.sleeper !== undefined · SOFA_STORAGE: config.sofa?.storage !== undefined
  // BED_CUSTOM_SIZE: config.bed?.customSize !== undefined · TABLE_OPEN_LENGTH: config.table?.openLengthM !== undefined
  // TABLE_CUSTOM_HEIGHT: config.table?.customHeightM !== undefined · BENCH_CUSTOM_HEIGHT: config.bench?.customHeightM !== undefined
```
`engine.ts` cazul `configurator-3d`:
```ts
const allowed = new Set(step.features ?? []);
return pieceConfig3dSchema(step.piece).refine(
  (c) => piece3dFeaturesUsed(c).every((f) => allowed.has(f)), 'validation.unknownAnswer');
```
Câmpurile de schemă (fundația le adaugă, ca tipurile să existe pentru toți; normalizarea / geometria / descrierea = `e10-3d`):
| Schemă (fișier) | Câmp NOU opțional | Tip / limite |
|---|---|---|
| `sofaSchema` (`piece3d/catalog-config.ts`) | `sleeper?: boolean`, `storage?: boolean` | — |
| `bedOptionsSchema` (`piece3d/furniture-config.ts`) | `customSize?: { widthM: number; lengthM: number }` (`.strict()`) | lățime 0,7–2,2 m, lungime 1,6–2,4 m (ca `bedCustomSize` din dormitor) |
| `tableOptionsSchema` | `openLengthM?: number` | §6 |
| `tableOptionsSchema` | `customHeightM?: number` | §6 |
| `benchOptionsSchema` | `customHeightM?: number` | §6 |
Interfața 3D arată controalele noi DOAR dacă pasul le declară (`Configurator3dStep` ajunge deja ca prop la `configurator3d-step.tsx`; se transmite
`features` mai departe la `furniture-controls.tsx` / `catalog-controls.tsx`). Pe versiunile vechi controalele nu apar → nimic nou nu se poate salva acolo.

### 4.4 Ecran de detalii pe piesă (`FinishPieceDef.detailSteps`) — adăugare în `piece-finish.ts`

Problema: ecranul `piece:<VALUE>` are deja până la 3 întrebări (lead + material + deschidere; D-E6-27). Câmp NOU opțional:
```ts
interface FinishPieceDef { …; detailSteps?: QuestionStep[] }
```
`pieceFinishSteps` pune `detailSteps` imediat DUPĂ ecranul piesei, cu `screenGroup: 'piece:<VALUE>:details'` și
`visibleIf = all[selectedIf, step.visibleIf?]` (independent de întrebarea comună — rămân vizibile și la „Da”, ca `leadSteps`).
`question-anchor.tsx` recunoaște deja prefixul (`/^piece:([A-Z0-9_]+)/`) → banda-țintă arată piesa fără cod nou. Fără `detailSteps` →
aceiași pași (instantaneele v6 identice). Folosit de: dormitor (`wardrobeInterior` pe `piece:WARDROBE:details`), baie (`basinType`, `basinSupply`
pe `piece:VANITY_UNIT:details`).

### 4.5 Opțiunea comună „Nu știu” pe întrebările noi

Fiecare întrebare nouă de tip alegere (§5) e `optional: true` și are ca ultimă opțiune `{ ...firmDecidesOption(), scoring: { category: <CAT>, optionKey: 'FIRM_DECIDES' } }`
(`firmDecidesOption` există în `finish-sets.ts`; la multi-choice cu `exclusive: true`). Excepție de etichetă: `hallWidth` (E10-N15).
Lipsa răspunsului = nimic în descriere (firma nu primește nimic inventat). `FIRM_DECIDES` ales = notă `… : clientul vrea recomandarea firmei`
în descriere (stilul `FIRM_MATERIAL_NOTE`). Întrebările noi NU intră în `firmRecommendations` (insigna rămâne pentru material / deschidere —
E10-N22).

Helper NOU (fundația, `flows/measure-sets.ts` sau `flows/question-sets.ts`):
```ts
export function optionalChoiceStep(def: {
  id: string; titleKey: string; subtitleKey?: string; screenGroup?: string; visibleIf?: Condition; icon?: string;
  category: string;                                // categoria de scor (rand nou, 0 puncte)
  options: { value: string; icon?: string; visibleIf?: Condition }[];   // fara FIRM_DECIDES, se adauga automat la final
  keyPrefix: string;                               // `flows.<ROOM>.v<N>.<id>` → `${keyPrefix}.options.<VALUE>.{label,description}`
  multi?: boolean;                                 // multi-choice (FIRM_DECIDES exclusiv)
}): SingleChoiceStep | MultiChoiceStep;
export function noteFor(label: string, value: string | undefined, texts: Readonly<Record<string, string>>): string | undefined;
  // "Chiuvetă: montată sub blat"; FIRM_DECIDES → "Chiuvetă: clientul vrea recomandarea firmei"; lipsa → undefined
```

### 4.6 Înregistrarea versiunilor — `flows/index.ts` (DOAR fundația)

- Fundația creează cele 14 fișiere noi ca SCHELETE (`export const kitchenFlowV5: RoomFlow = { ...kitchenFlowV4, version: 5 }`, la fel pentru
  toate; `catalog-v3.ts` exportă `catalogFlowRegistryV3: Partial<Record<CatalogRoomType, Record<number, RoomFlow>>>` = `{ PIECE_SOFA: { 3: … } }`
  și `catalogFlowVersionsV3 = { PIECE_SOFA: 3 }`) și le înregistrează în `FLOW_REGISTRY` (îmbinarea catalogului: `{ ...v1[rt], ...v2[rt], ...(v3[rt] ?? {}) }`).
- `CURRENT_FLOW_VERSION` NESCHIMBAT până la valul 2 (coordonatorul).
- `ETAPA6_FLOW_VERSION` devine un `Record` LITERAL (valorile curente de azi: KITCHEN/DRESSING/LIVING 4; OFFICE/BEDROOM/BATHROOM/PANTRY/LAUNDRY/BALCONY 3;
  HALLWAY/PIECES 2; piesele ghidate 4; catalogul 2). Azi e calculat ca „versiunea maximă” — cu versiunile noi s-ar muta singur și ar strica
  `score-v6.spec.ts`, `configurator.service.spec.ts`, `configurator.v6.integration.spec.ts`, `engine.test.ts:1258`.
- NOU `FLOW_VERSIONS_BEFORE_ETAPA10: Record<RoomType, number[]>` = toate versiunile înregistrate azi (vechi + etapa 6).
- NOU `ETAPA10_FLOW_VERSION: Record<RoomType, number>` = versiunea nouă pe tipurile din §3, `ETAPA6_FLOW_VERSION[rt]` pe celelalte.
- `firm-text.fixtures.ts` `allFixtureFlows({ only })`: `'legacy'` neschimbat; `'etapa6'` = în `BEFORE_ETAPA10` și NU în `BEFORE_ETAPA6` (exact setul de azi
  → `score-v6.json` / `firm-text-v6.json` identice); NOU `'etapa10'` = NU în `BEFORE_ETAPA10`.
  `answerFor` (dimension-group): completează și sloturile opționale în variantele `first`/`middle`, le lasă GOALE în `last` (ca instantaneul să acopere
  ambele); configurator-3d: configurația implicită (fără câmpuri noi) — câmpurile noi au fixture-uri proprii în testele pachetelor.
- Exporturi noi din `@marketplace/shared` (`questionnaire/index.ts`, `piece3d/index.ts`): `Piece3dFeature`, `PIECE3D_FEATURES`, `piece3dFeaturesUsed`,
  `FLOW_VERSIONS_BEFORE_ETAPA10`, `ETAPA10_FLOW_VERSION`, `pieceWidthSlot`, `optionalHeightSlot`, `informativeSlot`, `ceilingIfTall`,
  `optionalChoiceStep`, `noteFor`, versiunile noi (`kitchenFlowV5`, …, `pieceSofaFlowV3` dacă e nevoie de el separat).

---

## 5. Pe fiecare cameră atinsă

Convenții pentru tot capitolul:
- „Nou” = pas nou; id-urile existente se PĂSTREAZĂ. Toate întrebările noi: `optional: true`, ultima opțiune `FIRM_DECIDES` (§4.5), scor 0 (§7).
- Chei i18n noi sub `Configurator.flows.<ROOM>.v<N>.<stepId>.{title,subtitle,options.<VALUE>.{label,description}}`.
- Notele pentru firmă se adaugă cu `finishDescription([...])` la descrierea existentă a piesei (după notele etapei 6).
- Tavanul: `ceilingIfTall(selected, TALL)`; piesele înalte = lista planului (c5 pasul 3: dulap, bibliotecă, vitrină, coloană, dulap înalt, dulap cu
  oglindă), pe cameră în tabelul 5.0. Titlul pasului de dimensiuni păstrează cheia existentă; subtitlul primește cheie NOUĂ pe versiune
  (`flows.<ROOM>.v<N>.dimensions.subtitle`), pentru că textul vechi rămâne adevărat pentru versiunile vechi.

### 5.0 Tabelul măsurilor pe cameră (c5)

| Cameră | Piese înalte (tavan + înălțime opțională) | Înălțime opțională (slot, interval, tipic) | Lățimi (obligatorii, `countsTowardLinear`) | Informativ |
|---|---|---|---|---|
| LIVING v5 | BOOKSHELF, DISPLAY_CABINET | `bookshelfHeight` 0,6–3 (tipic 2,0) · `displayHeight` 0,8–2,8 (tipic 1,9) | cele 6 lățimi existente | — |
| OFFICE v4 | BOOKSHELF, STORAGE | `bookshelfHeight` 0,6–3 (2,0) · `storageHeight` 0,6–3 (2,0) | existente (`deskWidthA/B/C`, …) | — |
| BEDROOM v4 | WARDROBE | `wardrobeHeight` 1,8–3,2 (2,4) | existente | — |
| BATHROOM v4 | MIRROR_CABINET, TALL_STORAGE | `mirrorHeight` 0,4–1,2 (0,7) · `tallStorageHeight` 1,2–2,4 (1,8) | existente | — |
| HALLWAY v3 | WARDROBE, COAT_UNIT (deja) | `wardrobeHeight` 1,8–3 (2,4) · `coatUnitHeight` 1,4–2,6 (2,0) — E10-N13 | existente | — |
| LAUNDRY v4 | APPLIANCE_HOUSING, STORAGE | `applianceHousingHeight` 0,8–2,4 (tipic 1,9 la `STACKED`, altfel 0,9) · `storageHeight` 0,6–2,6 (fără tipic) | NOI: `applianceHousingWidth` 0,6–2 · `storageWidth` 0,3–3 · `countertopWidth` 0,6–4 · `sinkUnitWidth` 0,4–1,2 | `runA` (perete) 0,8–6, obligatoriu |
| BALCONY v4 | TALL_CABINET | `tallCabinetHeight` 1,2–2,6 (2,0) | NOI: `storageBenchWidth` 0,6–3 · `tallCabinetWidth` 0,4–2 · `worktopWidth` 0,6–4 · `shelvesWidth` 0,4–4 | `balconyLength` 0,8–8, `balconyDepth` 0,4–2,5 (obligatorii) |
| PANTRY v4 | CABINETS | `cabinetsHeight` 1–2,8 (2,2) | NOI: `shelvesWidth` 0,4–5 (la OPEN_SHELVES / MIXED) · `cabinetsWidth` 0,4–5 (la CLOSED_CABINETS / MIXED) | `runA/B/C` 0,5–5 (obligatorii) |
| KITCHEN v5 | — (tavanul rămâne mereu, c5 pasul 3) | — | `runA` min 1; `runB`, `runC` min **0,6** | — |
| DRESSING v5 | — (`wardrobeHeight` rămâne obligatoriu) | — | `runA` min 1; `runB`, `runC` min **0,6**; WALK_IN → A, B, C | — |

Ordinea sloturilor în pas: lățimea piesei, apoi înălțimea ei (lângă ea), în ordinea pieselor; peretele informativ primul; tavanul ultimul.
Etichete noi: `flows.<ROOM>.dimensions.slots.<slotId>` pentru fiecare slot nou (RO „Lățime dulap încastrare”, „Înălțime dulap (opțional)” —
cuvântul „opțional” îl adaugă interfața, nu eticheta). Living pierde sloturile `tvUnitHeight`, `coffeeTableHeight`, `shelvesHeight`, `otherHeight`
(nu sunt piese înalte — PO c5-2; E10-N12).

### 5.1 KITCHEN v5 (`kitchen.v5.ts`, din v4; c9 + c5)

| Pas | Tip | Opțiuni (valori salvate) | Vizibil | Ecran (`screenGroup`) | Cat. scor |
|---|---|---|---|---|---|
| `layout`, `hasIsland` | (din v4) | — | — | `layoutScreen` | existente |
| + `wallCabinets` | single, opțional | `WALL_CABINETS` („Cu corpuri suspendate”), `NO_WALL_CABINETS` („Fără corpuri suspendate”), `FIRM_DECIDES` | mereu | `layoutScreen` (3 întrebări) | `KITCHEN_WALL_CABINETS` |
| `dimensions` | copie v4 cu sloturile noi (`runB`/`runC` min 0,6) | — | — | — | — |
| `frontMaterialWall`, `frontMaterialWallOther` | (din v4) | — | v4 + `not(wallCabinets = NO_WALL_CABINETS)` | `fronts` | — |
| `openingSystemsWall` | (din v4) | — | `not(wallCabinets = NO_WALL_CABINETS)` | `fronts` | — |
| `countertop` | (din v4) | — | — | `countertopScreen` (NOU) | existent |
| + `sinkMounting` | single, opțional | `INSET` („Încastrată în blat”), `UNDERMOUNT` („Montată sub blat”), `FIRM_DECIDES` | mereu | `countertopScreen` | `KITCHEN_SINK_MOUNTING` |
| + `sinkMaterial` | single, opțional | `STAINLESS` („Inox”), `COMPOSITE` („Compozit (granit)”), `CERAMIC` („Ceramică”), `FIRM_DECIDES` | mereu | `countertopScreen` (3 întrebări) | `KITCHEN_SINK_MATERIAL` |
| `appliances` | (din v4) | — | — | `appliancesScreen` (NOU) | — |
| + `fridgeType` | single, opțional | `BUILT_IN` („Încorporabil, în corp de mobilier”), `FREESTANDING` („Independent”), `FIRM_DECIDES` | `appliances` conține `FRIDGE` | `appliancesScreen` | `KITCHEN_FRIDGE` |
| `sketch` | (din v4) | | | | |

Derivare (copie a `kitchenFlowV4.deriveRoom`, apoi):
- `wallCabinets === 'NO_WALL_CABINETS'` → zona „Corpuri suspendate” se SARE (nu se creează piesa, nici `firmRecommendations` pe ea); pe „Corpuri de bază”
  nota `Fără corpuri suspendate`. `FIRM_DECIDES` → piesa rămâne (cu materialul / deschiderea date), nota pe ea `Corpuri suspendate: clientul vrea recomandarea firmei`.
  Lipsă / `WALL_CABINETS` → ca v4.
- Pe „Corpuri de bază” (pasul 4 al planului — electrocasnicele ajung în piese): `Electrocasnice: cuptor, plită, hotă, mașină de spălat vase, frigider, cuptor cu microunde`
  (în ordinea bifelor; texte în `APPLIANCE_TEXT` din `kitchen.v5.ts`, NU în `common.ts`), `Frigider: încorporabil` / `Frigider: independent` /
  `Frigider: clientul vrea recomandarea firmei`, `Chiuvetă: compozit (granit), montată sub blat` (material, montaj; lipsă una → doar cealaltă;
  ambele `FIRM_DECIDES` → `Chiuvetă: clientul vrea recomandarea firmei`).
- Exemplu complet (RO, ce se salvează): `Corp: PAL standard; Electrocasnice: cuptor, plită, hotă, frigider; Frigider: încorporabil; Chiuvetă: compozit (granit), montată sub blat; Fără corpuri suspendate`.
  Echivalent EN (doar ca referință; descrierea se salvează în RO, ca toate notele din etapa 6): `Carcass: standard chipboard; Appliances: oven, hob, hood, fridge; Fridge: built-in; Sink: composite (granite), undermount; No wall cabinets`.
- Interfața: `kitchen-front-zones.ts` lucrează pe id-uri → zona „Corpuri suspendate” dispare singură când pașii ei sunt invizibili (de verificat în test `e10-ui`).

### 5.2 DRESSING v5 (`dressing.v5.ts`, din v4; c5)
- `LAYOUT_RUNS.WALK_IN = ['runA', 'runB', 'runC']` (azi `['runA','runB']`); sloturile `runB`, `runC` cu `min: 0.6` la toate formele; `runA` `min: 1`.
- Restul pașilor identici cu v4 (material, deschidere, module, schiță). Derivarea: `lengthM` = suma laturilor (ca azi).
- Subtitlu nou `flows.DRESSING.v5.dimensions.subtitle` („Lungimea fiecărui perete cu mobilier (A, B, C) și înălțimea dulapului.”).
- Planșa: `dimension-figures.tsx` `case 'DRESSING'` → numărul de laturi din `slotIds` (nu din `DRESSING_RUNS`, ca v3/v4 să rămână cu 2), iar walk-in
  primește `WalkInPlanFigure` (trei pereți + golul ușii pe al patrulea) — pachet `e10-ui`.

### 5.3 LIVING v5 (`living.v5.ts`, din v4; c5)
- Pași identici cu v4, cu pasul `dimensions` NOU: lățimile existente (`tvUnitWidth`, `bookshelfWidth`, `displayWidth`, `coffeeTableLength`, `shelvesTotal`,
  `otherWidth`), `bookshelfHeight` / `displayHeight` opționale (tabelul 5.0), tavanul doar cu BOOKSHELF / DISPLAY_CABINET.
- Subtitlu nou: „Lățimea fiecărei piese alese; înălțimea doar la piesele înalte, dacă o știi. Tavanul doar dacă ai bibliotecă sau vitrină.”
- Derivare: ca v4 (`heightM` = tavanul sau `DEFAULT_CEILING_HEIGHT`).

### 5.4 OFFICE v4 (`office.v4.ts`, din v3; c5)
- Pasul `dimensions` NOU: lățimile v2 + `bookshelfHeight`, `storageHeight` opționale + tavan doar cu BOOKSHELF / STORAGE.
- Eticheta `shelvesTotal` = „Lățimea zonei cu rafturi” — schimbată „acum” pe cheia existentă (§8), deci și v4 o primește.

### 5.5 BEDROOM v4 (`bedroom.v4.ts`, din v3; c9 + c5)

| Pas | Tip | Opțiuni | Vizibil | Ecran | Cat. scor |
|---|---|---|---|---|---|
| `bedSize` | single (copie v2 + opțiune nouă) | `S_90`, **`D_120`** („120 × 200 cm”), `M_140`, `Q_160`, `K_180`, `CUSTOM` | ca v2 | `bedSize` | — (ca azi) |
| + `bedLength` | single, opțional | `L_200` („200 cm”), `L_190` („190 cm”), `FIRM_DECIDES` | `bedSize` ales și ≠ `CUSTOM` | `bedSize` | — (E10-N6) |
| `bedCustomSize`, `bedUpholstered` | (din v3) | | | `bedSize` (max 3 vizibile) | |
| + `bedFabric` | single, opțional | `WOVEN` („Țesătură”), `BOUCLE` („Bouclé”), `VELVET` („Catifea”), `FIRM_DECIDES` | `bedUpholstered = true` | `bedFabric` (ecran propriu) | `BED_FABRIC` |
| + `wardrobeInterior` | multi, opțional (`FIRM_DECIDES` exclusiv) | `HANGING_RODS`, `SHELVES`, `DRAWERS`, `SHOE_RACK`, `ACCESSORIES`, `LED_LIGHTING` (aceleași valori și icoane ca `interiorModules` din dressing; chei noi `flows.BEDROOM.v4.wardrobeInterior.options.*`) | WARDROBE bifat | `piece:WARDROBE:details` (§4.4, `detailSteps`) | `WARDROBE_INTERIOR` |
| `dimensions` | NOU: lățimile v2 + `wardrobeHeight` opțional + tavan doar cu WARDROBE | | | | |

Derivare (copie v3, apoi pe „Cadru pat” / „Pat tapițat”):
- `BED_WIDTH` + `D_120: 1.2`; textul saltelei `saltea 120 × 200`, cu `bedLength = L_190` → `saltea 140 × 190`; `FIRM_DECIDES` la lungime → `saltea 140, lungimea o recomandă firma`.
- `bedFabric` → `Stofă: bouclé` / `Stofă: clientul vrea recomandarea firmei` (nota se pune doar dacă patul e tapițat).
- Pe „Dulap dormitor”: `Interior dulap: bare de agățat, rafturi, sertare` (`interiorModulesText` din `common.ts`, importat, nu modificat) /
  `Interior dulap: clientul vrea recomandarea firmei`.
- Exemplu: `Pat tapițat` → `saltea 120 × 200, ladă rabatabilă; Stofă: catifea` (EN ref.: `mattress 120 × 200, lift-up storage; Fabric: velvet`).
- Test cerut (plan): pat 120 × 200 apare corect în descriere; dormitor doar cu pat nu cere tavan.

### 5.6 BATHROOM v4 (`bathroom.v4.ts`, din v3; c9 + c5)

| Pas | Tip | Opțiuni | Vizibil | Ecran | Cat. scor |
|---|---|---|---|---|---|
| + `basinType` | single, opțional | `COUNTERTOP_BASIN` („Lavoar pe blat”), `INSET_BASIN` („Lavoar încastrat în blat”), `INTEGRATED_BASIN` („Blat cu lavoar integrat”), `FIRM_DECIDES` | VANITY_UNIT bifat | `piece:VANITY_UNIT:details` | `BATHROOM_BASIN_TYPE` |
| + `basinSupply` | single, opțional | `CLIENT` („Îl aduc eu (am deja sau îl cumpăr)”), `FIRM` („Să-l aducă firma”), `FIRM_DECIDES` | VANITY_UNIT bifat | `piece:VANITY_UNIT:details` | `BATHROOM_BASIN_SUPPLY` |
| `dimensions` | NOU: lățimile v3 + `mirrorHeight`, `tallStorageHeight` opționale + tavan doar cu MIRROR_CABINET / TALL_STORAGE | | | | |

Derivare: pe „Corp lavoar”: `Lavoar: încastrat în blat; îl aduce clientul` / `Lavoar: îl aduce firma` / `Lavoar: clientul vrea recomandarea firmei`.
Fără „Altă piesă” în baie (PO c9-1 a ales doar „baie (lavoar)” — E10-N24).

### 5.7 PANTRY v4 (`pantry.v4.ts`, din v3; c5 / d3)
- Pasul `dimensions` NOU: `runA/B/C` după `wallsUsed` cu `informativeSlot` (obligatorii, NU intră în mărime), `shelvesWidth` (la OPEN_SHELVES / MIXED),
  `cabinetsWidth` (la CLOSED_CABINETS / MIXED), `cabinetsHeight` opțional, tavan doar cu dulapuri.
- `lengthM` = `shelvesWidth + cabinetsWidth` (doar cele cu valoare). Subtitlu nou: „Lungimea pereților, pentru context, și lățimea rafturilor / dulapurilor pe care le vrei.”

### 5.8 LAUNDRY v4 (`laundry.v4.ts`, din v3; c9 + c5 / d3)

| Pas | Tip | Opțiuni | Vizibil | Ecran | Cat. scor |
|---|---|---|---|---|---|
| `applianceSetup` | (din v3) | | | `applianceScreen` (NOU) | — |
| + `washerLoading` | single, opțional | `FRONT` („Încărcare frontală”), `TOP` („Încărcare de sus”, `visibleIf: not(applianceSetup = STACKED)`), `FIRM_DECIDES` | mereu | `applianceScreen` | `LAUNDRY_LOADING` |
| `dimensions` | NOU: `runA` informativ + lățimile pieselor bifate + înălțimi opționale + tavan doar cu APPLIANCE_HOUSING / STORAGE | | | | |

Derivare: `lengthM` = suma lățimilor pieselor. Pe „Dulap încastrare electrocasnice” dacă e bifat, altfel pe prima piesă (E10-N5):
`Aparate: mașină de spălat și uscător suprapuse; Încărcare: frontală` (`APPLIANCE_SETUP_TEXT`: `WASHER_ONLY` „doar mașină de spălat”, `STACKED`
„mașină de spălat și uscător suprapuse”, `SIDE_BY_SIDE` „mașină de spălat și uscător alăturate”).

### 5.9 BALCONY v4 (`balcony.v4.ts`, din v3; c5 / d3)
- Pasul `dimensions` NOU: `balconyLength`, `balconyDepth` informative; lățimea fiecărei piese bifate; `tallCabinetHeight` opțional; tavan doar cu TALL_CABINET.
- `lengthM` = suma lățimilor pieselor; `widthM` = `min(balconyDepth, 0.6)` (ca v3).
- Subtitlu nou: „Lungimea și adâncimea balconului, pentru context, și lățimea fiecărei piese alese.”
- Test cerut: balcon 6 m cu un raft de 1 m → `UNDER_2M`; balcon 6 m mobilat (6 m de piese) → `OVER_4M` (§7e).

### 5.10 HALLWAY v3 (`hallway.v3.ts`, din v2; c5)
- + `hallWidth` (single, opțional, `screenGroup: 'pieces'` lângă `piecesNeeded` + `sameFinishAll` — 3 întrebări): `NARROW` („Hol îngust (sub 1,2 m)”),
  `WIDE` („Hol generos”), `FIRM_DECIDES` cu etichetă proprie `flows.HALLWAY.v3.hallWidth.options.FIRM_DECIDES.label` („Nu știu — o măsoară firma”) — E10-N15.
  Categoria `HALLWAY_WIDTH`, 0 puncte. Nu intră în descrierea pieselor (e o informație de cameră; firma o vede ca etichetă pe fișă, din rezumat).
- Pasul `dimensions` NOU: lățimile v1 + `wardrobeHeight`, `coatUnitHeight` opționale; tavanul rămâne doar la piesele înalte (ca v1).

---

## 6. Piesele 3D (pachetul `e10-3d`)

| Piesă | Câmp nou (configurație) | Implicit | Validare | Interfață | Descriere pentru firmă |
|---|---|---|---|---|---|
| Canapea (`PIECE_SOFA` v3, `features: ['SOFA_SLEEPER','SOFA_STORAGE']`) | `sofa.sleeper?: boolean` | lipsă = nu | boolean | comutator „Extensibilă (se face pat)” | `Extensibilă: da` |
| | `sofa.storage?: boolean` | lipsă = nu | boolean | comutator „Ladă de depozitare” | `Ladă de depozitare: da` |
| Pat (`PIECE_BED` v5, `['BED_CUSTOM_SIZE']`) | `bed.customSize?: { widthM; lengthM }` | lipsă = mărimea standard din `mattressSize` | lățime 0,7–2,2, lungime 1,6–2,4, pas 0,05 | al 5-lea card „Altă mărime” lângă 90 / 140 / 160 / 180; deschide două câmpuri (cm), pornește de la 120 × 200; alegerea unei mărimi standard șterge `customSize` | `Saltea: 120 × 190 cm (altă mărime)` |
| Masă (`PIECE_TABLE` v5, `['TABLE_OPEN_LENGTH','TABLE_CUSTOM_HEIGHT']`) | `table.openLengthM?: number` | lipsă | doar la masa extensibilă (`shape === 'EXTENDABLE'` sau câmpul extensibil al etapei 9, §14); `widthM + 0,3` … `min(widthM + 1,2; 4)` | câmp opțional „Lungime deschisă” sub opțiunea extensibilă | `Lungime deschisă: 240 cm` |
| | `table.customHeightM?: number` | lipsă = `TABLE_HEIGHT[type]` | DINING 0,70–0,80 · COFFEE 0,30–0,55 · CONSOLE 0,70–0,90 | câmp opțional „Înălțime”, indiciu „de obicei 75 cm” | `Înălțime: 72 cm` |
| Băncuță (`PIECE_BENCH` v5, `['BENCH_CUSTOM_HEIGHT']`) | `bench.customHeightM?: number` | lipsă = 0,45 | 0,35–0,55 | câmp opțional „Înălțime”, „de obicei 45 cm” | `Înălțime: 48 cm` |

- Normalizare (`furniture-config.ts` / `catalog-config.ts`): cu câmpul prezent, `heightM` = `customHeightM` (masă, băncuță); gabaritul patului cu
  `customSize`: lățime = `customSize.widthM + 2 × șină + 0,04`, adâncime = `customSize.lengthM + 0,2` (azi 2,2 fix pentru 200). `openLengthM` se șterge
  la o masă care nu mai e extensibilă. `validFurnitureConfig` compară și câmpurile noi. Fără câmpurile noi: rezultat identic cu azi (test).
- Descriere: în `describeCatalogOptions` / descrierea mobilierului din `piece3d` (texte noi doar când câmpul există → descrierile vechi identice).
- Scor: `PIECE_SOFA` v3 `config3d.scoreEntries` (§7a); `PIECE_TABLE` v5 `scoreEntries` = `TABLE_EXTENDABLE:YES` la `shape === 'EXTENDABLE'` SAU la
  câmpul extensibil al etapei 9; `PIECE_BED` v5 ca v4 (`BED_STORAGE`). Lungimea deschisă, înălțimile, ladă canapelei: 0 puncte.
- Derivare `furniture-v5.ts`: copie a `furnitureFlowV4` (v4 ÎNGHEȚAT) cu `features` pe pasul 3D; la `bed.customSize` fluxul v2 primește `mattressSize`
  ca azi, dar textul saltelei se ÎNLOCUIEȘTE cu cel custom (nu „160 × 200” + custom). `catalog-v3.ts`: copie a buclei din `catalog-v2.ts` doar pentru
  `SOFA` (fără pas de material, `Cadru: îl alege firma`, ca v2).
- **Ce NU intră** (PO c9-1 a ales doar „canapea (extensibilă, ladă), pat (altă mărime), masă (extensibilă)”): husă detașabilă, fotoliu rotativ / recliner,
  tăblie la pat, „tapițat da / nu” nou la bancă / hol, întrebări noi la comoda TV, corpul suspendat, dulapul, biroul 3D, aparate „standard / altă mărime”
  la spălătorie, „Altă piesă” în baie și dormitor, deschiderea la baie (făcută în etapa 6).

---

## 7. Costul în credite

Ponderi actuale din `seed.ts` (1 punct = 1 credit, fără buget / proiectare): tip cameră (KITCHEN 8, BEDROOM 4, LAUNDRY / BALCONY / PANTRY 2,
PIECE_SOFA 3), `ROOM_SIZE` UNDER_2M 1 / FROM_2_TO_4M 3 / OVER_4M 5, `ITEM_QUANTITY` QTY_1 0 / QTY_2_3 2 / QTY_4_PLUS 4, MATERIAL PAL 1 … LEMN 4,
ALTUL 2, SYSTEM MANER 1 / PUSH 2 / GOLA, AVENTOS, GLISANTE 3, KITCHEN_LAYOUT STRAIGHT 1, TABLE_EXTENDABLE YES 1.

### 7a. d3, partea a doua — puncte pe configurația canapelei (DE CONFIRMAT DE PO)
Formula (în stilul `BED_STORAGE` / `TABLE_EXTENDABLE`: un rând pe opțiune, emis de `config3d.scoreEntries`):
`SOFA_SEATS:SEATS_<n>` + `SOFA_LAYOUT:<layout>` + (`SOFA_SLEEPER:YES` dacă `sleeper`) + (`SOFA_STORAGE:YES` dacă `storage`).
| Rând | Pondere propusă | De ce |
|---|---|---|
| `SOFA_SEATS:SEATS_2` | 0 | canapeaua mică = baza de azi |
| `SOFA_SEATS:SEATS_3` | 1 | un modul în plus |
| `SOFA_SEATS:SEATS_4` | 2 | două module în plus |
| `SOFA_LAYOUT:STRAIGHT` | 0 | — |
| `SOFA_LAYOUT:CHAISE_LEFT`, `CHAISE_RIGHT` | 1 | șezlongul = încă un corp tapițat |
| `SOFA_SLEEPER:YES` | 2 | c9-3: crește; mecanism + saltea (ca insula / peretele media, 2) |
| `SOFA_STORAGE:YES` | 0 | c9-3: restul 0 |
Fotoliul și taburetul: fără rânduri noi (fotoliul nu are locuri / șezlong; mărimea lor vine deja din `ROOM_SIZE`); fluxurile lor rămân pe v2 — DE CONFIRMAT (E10-N17).

### 7b. c9-3
- „Fără corpuri suspendate” scade prin faptul că piesa nu se mai creează (−MATERIAL, −SYSTEM, adesea −2 la `ITEM_QUANTITY`); rândurile `KITCHEN_WALL_CABINETS:*` = 0.
- Canapeaua extensibilă crește: `SOFA_SLEEPER:YES` = 2 (DE CONFIRMAT valoarea).
- Toate celelalte valori noi: rânduri cu 0 (lista §7d).

### 7c. c5-3 / d3 — balcon, spălătorie, debara
`lengthM` = suma lățimilor pieselor (sloturi `countsTowardLinear`); peretele / balconul = `informativeSlot` (fără `countsTowardLinear`). `approxLengthApplies`
funcționează neschimbat (pasul are sloturi liniare). Camerele unde tavanul dispare NU își schimbă costul (tavanul nu intră în scor).

### 7d. Migrarea `apps/backend/prisma/migrations/20261115100000_form_v7_scores/migration.sql` (+ aceleași rânduri în `seed.ts`, lângă categoriile înrudite)
```sql
-- etapa 10 (formularul v7): randuri de scor pentru valorile noi. 0 puncte (PO c9-3), cu exceptia canapelei extensibile
-- si a configuratiei canapelei (d3, valori DE CONFIRMAT DE PO). Adminul poate doar edita randuri existente.
INSERT INTO "project_sizing_config" ("id", "key", "option", "weight") VALUES
  (gen_random_uuid()::text, 'KITCHEN_WALL_CABINETS', 'WALL_CABINETS', 0),
  (gen_random_uuid()::text, 'KITCHEN_WALL_CABINETS', 'NO_WALL_CABINETS', 0),
  (gen_random_uuid()::text, 'KITCHEN_WALL_CABINETS', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'KITCHEN_SINK_MOUNTING', 'INSET', 0),
  (gen_random_uuid()::text, 'KITCHEN_SINK_MOUNTING', 'UNDERMOUNT', 0),
  (gen_random_uuid()::text, 'KITCHEN_SINK_MOUNTING', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'KITCHEN_SINK_MATERIAL', 'STAINLESS', 0),
  (gen_random_uuid()::text, 'KITCHEN_SINK_MATERIAL', 'COMPOSITE', 0),
  (gen_random_uuid()::text, 'KITCHEN_SINK_MATERIAL', 'CERAMIC', 0),
  (gen_random_uuid()::text, 'KITCHEN_SINK_MATERIAL', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'KITCHEN_FRIDGE', 'BUILT_IN', 0),
  (gen_random_uuid()::text, 'KITCHEN_FRIDGE', 'FREESTANDING', 0),
  (gen_random_uuid()::text, 'KITCHEN_FRIDGE', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'BED_FABRIC', 'WOVEN', 0),
  (gen_random_uuid()::text, 'BED_FABRIC', 'BOUCLE', 0),
  (gen_random_uuid()::text, 'BED_FABRIC', 'VELVET', 0),
  (gen_random_uuid()::text, 'BED_FABRIC', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'WARDROBE_INTERIOR', 'HANGING_RODS', 0),
  (gen_random_uuid()::text, 'WARDROBE_INTERIOR', 'SHELVES', 0),
  (gen_random_uuid()::text, 'WARDROBE_INTERIOR', 'DRAWERS', 0),
  (gen_random_uuid()::text, 'WARDROBE_INTERIOR', 'SHOE_RACK', 0),
  (gen_random_uuid()::text, 'WARDROBE_INTERIOR', 'ACCESSORIES', 0),
  (gen_random_uuid()::text, 'WARDROBE_INTERIOR', 'LED_LIGHTING', 0),
  (gen_random_uuid()::text, 'WARDROBE_INTERIOR', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'BATHROOM_BASIN_TYPE', 'COUNTERTOP_BASIN', 0),
  (gen_random_uuid()::text, 'BATHROOM_BASIN_TYPE', 'INSET_BASIN', 0),
  (gen_random_uuid()::text, 'BATHROOM_BASIN_TYPE', 'INTEGRATED_BASIN', 0),
  (gen_random_uuid()::text, 'BATHROOM_BASIN_TYPE', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'BATHROOM_BASIN_SUPPLY', 'CLIENT', 0),
  (gen_random_uuid()::text, 'BATHROOM_BASIN_SUPPLY', 'FIRM', 0),
  (gen_random_uuid()::text, 'BATHROOM_BASIN_SUPPLY', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'LAUNDRY_LOADING', 'FRONT', 0),
  (gen_random_uuid()::text, 'LAUNDRY_LOADING', 'TOP', 0),
  (gen_random_uuid()::text, 'LAUNDRY_LOADING', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'HALLWAY_WIDTH', 'NARROW', 0),
  (gen_random_uuid()::text, 'HALLWAY_WIDTH', 'WIDE', 0),
  (gen_random_uuid()::text, 'HALLWAY_WIDTH', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'SOFA_SEATS', 'SEATS_2', 0),
  (gen_random_uuid()::text, 'SOFA_SEATS', 'SEATS_3', 1),
  (gen_random_uuid()::text, 'SOFA_SEATS', 'SEATS_4', 2),
  (gen_random_uuid()::text, 'SOFA_LAYOUT', 'STRAIGHT', 0),
  (gen_random_uuid()::text, 'SOFA_LAYOUT', 'CHAISE_LEFT', 1),
  (gen_random_uuid()::text, 'SOFA_LAYOUT', 'CHAISE_RIGHT', 1),
  (gen_random_uuid()::text, 'SOFA_SLEEPER', 'YES', 2),
  (gen_random_uuid()::text, 'SOFA_STORAGE', 'YES', 0)
ON CONFLICT ("key", "option") DO NOTHING;
```
45 de rânduri. Fără rânduri pentru `bedSize` / `bedLength` (mărimile saltelei nu au scor nici azi), lungimea deschisă, înălțimi.
Admin → Mărime proiect: texte noi `Admin.sizing.groups.<KEY>.{title,help}` și `Admin.sizing.options.<KEY>.<OPTION>` (fragment `e10-seed`; altfel pagina arată codul).

### 7e. Exemple vechi / nou (testul „diferența explicată” `apps/backend/src/modules/sizing/score-v7.spec.ts`, ca `score-v6.spec.ts`)
| # | Cerere | Versiunea de azi | Versiunea nouă | Diferență și cauza |
|---|---|---|---|---|
| A | Bucătărie dreaptă 3 m, PAL, Mâner peste tot, fără insulă, blat PAL; nou: „Fără corpuri suspendate” | KITCHEN 8 + FROM_2_TO_4M 3 + QTY_2_3 2 + STRAIGHT 1 + (PAL 1 + MANER 1) × 2 = **18** | 8 + 3 + QTY_1 0 + 1 + PAL 1 + MANER 1 = **14** | −4: piesa suspendată nu se mai creează (−2) și cantitatea scade la o piesă (−2) |
| A′ | Aceeași bucătărie, cu corpuri suspendate + chiuvetă + frigider încorporabil | **18** | **18** | 0: rândurile noi au 0 puncte |
| B | Balcon 6 m, un singur raft 1 m, PAL | BALCONY 2 + OVER_4M 5 + QTY_1 0 + PAL 1 = **8** | 2 + UNDER_2M 1 + 0 + 1 = **4** | −4: mărimea vine din raft, nu din balcon (c5-3) |
| C | Balcon 6 m mobilat: bancă 2 m (PAL, Mâner), dulap 1 m (PAL, Mâner), blat 2 m (PAL postformat), rafturi 1 m (PAL) | 2 + OVER_4M 5 + QTY_4_PLUS 4 + 1+1 + 1+1 + 1 + 1 = **17** | piese 6 m → OVER_4M → **17** | 0: același balcon mobilat costă la fel |
| D | Canapea dreaptă 3 locuri, 2,2 m | PIECE_SOFA 3 + FROM_2_TO_4M 3 + QTY_1 0 + ALTUL 2 = **8** | 8 + SEATS_3 1 = **9** | +1 (d3) |
| E | Canapea 4 locuri cu șezlong, extensibilă, cu ladă, 2,8 m | **8** | 8 + SEATS_4 2 + CHAISE 1 + SLEEPER 2 + STORAGE 0 = **13** | +5 (d3 + c9-3) |
| F | Spălătorie perete 3 m, doar dulap încastrare 0,7 m (PAL, Mâner) | LAUNDRY 2 + FROM_2_TO_4M 3 + 0 + 1 + 1 = **7** | 2 + UNDER_2M 1 + 0 + 1 + 1 = **5** | −2: mărimea din lățimea piesei |
| G | Dormitor doar cu pat 160 fără depozitare, lemn masiv | BEDROOM 4 + UNDER_2M 1 + 0 + LEMN 4 = **9** | **9** | 0: tavanul dispare, dar nu intra în cost |
Agentul verifică întâi pragurile reale (`roomSizeBucket`, `itemQuantityBucket` din `mapping.ts`) și ponderile din `seed.ts`, și corectează cifrele dacă diferă —
diferența trebuie explicată în test. Toate fără buget / proiectare (scor de bază = cost).

---

## 8. „Acum”, fără versiune nouă (c5 pasul 1) — pachetul `e10-now` (texte) + `e10-ui` (planșă, ordine)

Se văd imediat și pe versiunile de azi; NU schimbă ce se salvează (instantaneele identice). Textele trebuie să rămână ADEVĂRATE pentru versiunile vechi
(acolo tavanul e încă cerut):
| Cheie existentă (`Configurator.…`) | Azi (RO) | Nou RO | Nou EN |
|---|---|---|---|
| `flows.BEDROOM.dimensions.subtitle` | „Spațiul disponibil și înălțimea camerei.” | „Lățimea fiecărei piese alese și înălțimea tavanului.” | „The width of each piece you chose and the ceiling height.” |
| `flows.LIVING.dimensions.subtitle` | „Lățimea și înălțimea fiecărei piese.” | „Lățimea și înălțimea fiecărei piese alese, apoi înălțimea tavanului.” | „The width and height of each piece you chose, then the ceiling height.” |
| `flows.OFFICE.dimensions.subtitle` | „Spațiul disponibil și blatul de lucru.” | „Lățimea fiecărei piese alese și înălțimea tavanului.” | „The width of each piece you chose and the ceiling height.” |
| `flows.OFFICE.dimensions.slots.shelvesTotal` | „Lungime totală rafturi” | „Lățimea zonei cu rafturi” | „Width of the shelving area” |
| `flows.BATHROOM.dimensions.subtitle`, `flows.LAUNDRY…`, `flows.BALCONY…`, `flows.PANTRY…`, `flows.HALLWAY…` | (azi) | `e10-now` citește fiecare text și îl rescrie ca listă exactă a câmpurilor pe care le cer versiunile de azi (ex. spălătoria: „Lungimea peretelui cu mobilier și înălțimea tavanului.”) | idem |
Textele noi „Lățimea fiecărei piese alese; tavanul doar dacă ai piese înalte” stau pe cheile NOI ale versiunilor noi (§5).
- Ordinea câmpurilor după litere (`e10-ui`, `step-renderer.tsx`): când există planșă, câmpurile se afișează în ordinea literelor (A, B, C…, H1, H2…, H la final),
  sloturile fără literă după ele, în ordinea fluxului. Doar ordinea de afișare; răspunsul (obiect) neschimbat.
- Planșa dormitorului (`e10-ui`, `dimension-figures.tsx`): `BEDROOM_PIECES` primește noptierele desenate ca pereche (două corpuri mici, `nightstandWidth`,
  câte unul de fiecare parte) și patul ca siluetă fără literă (desenat când `piecesNeeded` conține `BED_FRAME`; nu are slot — lățimea vine din saltea).
  `rowFigure` primește un parametru opțional `extras: FrontPieceDef[]` pentru piesele fără slot.

---

## 9. Imagini (acoperirea `illustrations/coverage.test.tsx`: zero `fallback-icon` pe versiunile curente, inclusiv după comutare)

Doar desene SVG simple în stilul existent (`common.tsx`, `room-pieces.tsx`) sau refolosiri; fără PNG noi. `FIRM_DECIDES` e deja acoperit (`IlluFirmDecides`
în `COMMON_BY_VALUE`). Pașii noi tip boolean nu există (toate sunt alegeri).
| Pas / valori | Imagine |
|---|---|
| KITCHEN `wallCabinets`: `WALL_CABINETS` / `NO_WALL_CABINETS` | `WALL_CABINETS` refolosește vizualul piesei „corpuri suspendate” din bucătărie (dacă nu există în `ROOM_MAPS.KITCHEN`, `ShowroomPhoto('wall-cabinet')` din catalog); `NO_WALL_CABINETS` = SVG NOU `IlluNoWallCabinets` (rând de corpuri jos, perete gol, linie tăiată sus) |
| KITCHEN `sinkMounting`: `INSET`, `UNDERMOUNT` | SVG NOI `IlluSinkInset`, `IlluSinkUndermount` (secțiune prin blat + cuvă) în `kitchen.tsx` |
| KITCHEN `sinkMaterial`: `STAINLESS`, `COMPOSITE`, `CERAMIC` | SVG NOU `IlluSink` cu trei tonuri (o singură componentă parametrizată) în `kitchen.tsx` |
| KITCHEN `fridgeType`: `BUILT_IN`, `FREESTANDING` | SVG NOI `IlluFridgeBuiltIn` (corp cu ușă de mobilier), `IlluFridgeFreestanding` |
| BEDROOM `bedSize` `D_120` | diagrama de saltea existentă (aceeași familie ca `S_90` … `K_180`, cu lățimea 120) — testul cere ca mărimile să NU colapseze pe același desen |
| BEDROOM `bedLength`: `L_200`, `L_190` | `MattressFigure` existentă, cu lungimea notată |
| BEDROOM `bedFabric`: `WOVEN`, `BOUCLE`, `VELVET` | aceleași mostre ca țesăturile din 3D (`piece3d/finishes.ts` / `config-chips.ts` — swatch-urile de tapițerie), înfășurate ca ilustrație |
| BEDROOM `wardrobeInterior`: cele 6 valori | refolosesc ilustrațiile `interiorModules` ale dressingului (`ROOM_OPTION_PHOTOS.DRESSING.interiorModules` / `ROOM_MAPS.DRESSING`) — se mapează aceleași componente sub `BEDROOM.wardrobeInterior` |
| BATHROOM `basinType`: 3 valori | SVG NOI `IlluBasinOnTop`, `IlluBasinInset`, `IlluBasinIntegrated` în `bathroom.tsx` |
| BATHROOM `basinSupply`: `CLIENT`, `FIRM` | SVG NOI simple (cutie + persoană / cutie + camion) în `common.tsx`: `IlluSupplyClient`, `IlluSupplyFirm` |
| LAUNDRY `washerLoading`: `FRONT`, `TOP` | SVG NOI `IlluWasherFront`, `IlluWasherTop` în `room-pieces.tsx` |
| HALLWAY `hallWidth`: `NARROW`, `WIDE` | SVG NOI `IlluHallNarrow`, `IlluHallWide` (plan de sus, două lățimi) |
Valorile generice (`FRONT`, `TOP`, `CLIENT`, `FIRM`, `INSET` …) NU merg în `COMMON_BY_VALUE` (coliziuni) — doar pe `ROOM_OPTION_PHOTOS[room][step]` / hărțile pe cameră.
Testul `coverage.test.tsx` (`concepts.size` = 41 azi și lista pe familii) se actualizează: familii noi pe cameră și numărul nou de concepte.

---

## 10. Teste

**Fundația (`e10-found`)**: `engine.test.ts` (`describe` nou „etapa 10 — motor”): slot opțional gol acceptat la publicare, cu valoare în afara intervalului respins,
slot obligatoriu gol tot `validation.dimensionRequired`; `summarizeAnswers` pune `missing` doar pe sloturile opționale goale și deloc pe fluxurile vechi;
`features`: un `sofa.sleeper` respins pe `PIECE_SOFA` v2 (`validation.unknownAnswer`) și acceptat pe un pas-jucărie cu `features`; `piece-finish.test.ts`
(+`detailSteps`: ecranul `piece:X:details`, vizibil și la întrebarea comună „Da”); `measure-sets.test.ts` NOU; invarianța: cele 4 instantanee neschimbate,
`ETAPA6_FLOW_VERSION` = valorile literale, toate scheletele înregistrate.
**Fluxurile** (fișiere NOI, unul pe pachet; „Cum se verifică” din plan):
- `flows/kd.v7.test.ts` (`e10-kd`): bucătărie „fără corpuri suspendate” → fără piesa „Corpuri suspendate”, fără `frontMaterialWall` / `openingSystemsWall`
  vizibili (și un răspuns trimis pentru ei respins), nota pe corpurile de bază; `FIRM_DECIDES` → piesa rămâne cu notă; chiuveta și frigiderul în descriere,
  RO cu diacritice; `fridgeType` invizibil fără `FRIDGE`; `runB = 0.6` acceptat pe v5 și respins pe v4; walk-in cere A / B / C, „În L” doar A / B; v4 walk-in tot A / B.
- `flows/rooms-a.v7.test.ts` (`e10-rooms-a`): dormitor doar cu pat → fără `ceilingHeight`; cu dulap → tavan obligatoriu, `wardrobeHeight` opțional;
  pat 120 × 200 → `saltea 120 × 200`; 140 + L_190 → `saltea 140 × 190`; stofă doar la pat tapițat; interior dulap în descriere, `FIRM_DECIDES` exclusiv;
  living cu toate piesele → doar lățimile obligatorii (6) + înălțimile bibliotecii / vitrinei opționale + tavan; living fără piese înalte → fără tavan;
  birou doar cu birou → fără tavan; hol `hallWidth` opțional, înălțimea dulapului de hol opțională.
- `flows/rooms-b.v7.test.ts` (`e10-rooms-b`): baie lavoar → ecranul `piece:VANITY_UNIT:details` cu cele două întrebări, nota în descriere; baie doar cu lavoar →
  fără tavan; spălătorie: `TOP` invizibil la `STACKED`, aparatele și încărcarea în descriere; `lengthM` = suma lățimilor pieselor; **test de scor**
  (`collectScoreEntries`): balcon 6 m cu un raft 1 m → `ROOM_SIZE:UNDER_2M`, balcon 6 m mobilat → `OVER_4M`; pe `BALCONY` v3 același raft → `OVER_4M` (ca azi);
  debara U cu un dulap de 1,2 m → `UNDER_2M`.
- `flows/guided-pieces/v5.test.ts` (`e10-3d`): canapea extensibilă → `SOFA_SLEEPER:YES` + descriere `Extensibilă: da`; 3 locuri + șezlong → intrările d3;
  `sofa.sleeper` respins pe v2; pat „Altă mărime” 120 × 190 → descriere și gabarit (lățime, adâncime 2,1); masă extensibilă cu `openLengthM` în afara
  intervalului respinsă; `openLengthM` la masă rotundă respins; masa extensibilă pe v5 tot `TABLE_EXTENDABLE:YES` (ambele forme ale câmpului, §14);
  configurațiile vechi (fără câmpuri noi) → normalizare / descriere identice; în `piece3d/*.test.ts`: limitele noi.
**Instantanee noi** (valul 2, coordonatorul; fișiere noi lângă cele etapei 6): `score-invariance-v7.test.ts` → `__snapshots__/score-v7.json`,
`firm-text-v7.test.ts` → `__snapshots__/firm-text-v7.json`, pe `allFixtureFlows({ only: 'etapa10' })`. Testul „fără coduri interne / diacritice” din `firm-text.test.ts`
rulează pe toate versiunile (le prinde și pe cele noi).
**Invarianța versiunilor vechi**: `git diff` gol pe `score-invariance.json`, `firm-text.json`, `score-v6.json`, `firm-text-v6.json`; `score-invariance-v6.test.ts`
și `firm-text-v6.test.ts` NEATINSE (filtrul `'etapa6'` exclude versiunile noi).
**Backend (`e10-seed`)**: `score-v7.spec.ts` (exemplele §7e, ponderile citite din `seed.ts`, `computeSizing` real); `configurator.service.spec.ts` (`describe` nou
„etapa 10”): publicare pe versiunile noi, republicarea pe versiunile etapei 6, cerere mixtă, întrebările noi respinse pe versiunile vechi (`validation.unknownAnswer`),
slot opțional gol acceptat, rândurile de scor egale în seed și migrare; `configurator.v7.integration.spec.ts` (NOU; rulat de coordonator pe `marketplace_test`).
**Frontend (`e10-ui`)**: `dimension-check.test.ts` (+`skipped`), `step-renderer-v7.test.tsx` (NOU: „(opțional)” + „de obicei 240 cm” în unitatea aleasă, câmp gol fără
eroare la „Continuă”, ordinea după litere, walk-in cu trei laturi), `summary-rows.test.ts` (+rândul „Nu ai dat-o…”), `room-spec-card-v7.test.tsx` (NOU: „nespecificată de
client (de obicei 240 cm)”, cererea veche identică), `coverage.test.tsx`; `e10-3d`: controalele noi apar doar cu `features` (test pe `furniture-controls` / `catalog-controls`).
**`questionnaire-content.test.tsx`**: toate cheile fluxurilor (inclusiv cele noi) există RO + EN — rulat după îmbinarea fragmentelor.

---

## 11. Pachetele de lucru

Proprietate STRICTĂ. Fiecare fișier are UN proprietar; ce trebuie pus în fișierul altuia se cere în raport („De făcut de coordonator”).
Fișiere comune (doar Edit punctual, doar ADĂUGARE, citit chiar înainte): cele din ghid (`error-codes.ts`, `shared/src/index.ts`, `enums.ts`, `error-messages.ts`).
Toți agenții: fragmente i18n proprii în `…\reparatii\etapa-10\i18n\`, rapoarte în `…\reparatii\etapa-10\rapoarte\<id>.md`, comenzi grele prin `low.cjs`.

### Valul 0 — fundația (`e10-found`, 1 agent, ~2 zile) + `e10-now` (în paralel, doar texte, ~0,5 zile)
**`e10-found`** — fișiere: `questionnaire/types.ts`, `questionnaire/engine.ts`, `questionnaire/index.ts`, `flows/index.ts`, `flows/measure-sets.ts` (NOU),
`flows/piece-finish.ts` (doar `detailSteps`), `piece3d/features.ts` (NOU), `piece3d/index.ts` (exporturi), schemele din `piece3d/catalog-config.ts`
(`sofaSchema`) și `piece3d/furniture-config.ts` (`bedOptionsSchema`, `tableOptionsSchema`, `benchOptionsSchema`) — DOAR câmpurile opționale,
`flows/guided-pieces/index.ts`, `firm-text.fixtures.ts`, cele 14 SCHELETE (`kitchen.v5.ts`, `dressing.v5.ts`, `living.v5.ts`, `office.v4.ts`, `bedroom.v4.ts`,
`bathroom.v4.ts`, `pantry.v4.ts`, `laundry.v4.ts`, `balcony.v4.ts`, `hallway.v3.ts`, `guided-pieces/furniture-v5.ts`, `guided-pieces/catalog-v3.ts`),
teste `engine.test.ts` (doar `describe` nou), `piece-finish.test.ts` (doar `describe` nou), `measure-sets.test.ts` (NOU), `piece3d/features.test.ts` (NOU);
fragment `e10-found` (`Configurator.dimensions.optionalTag`, `Configurator.dimensions.typicalHint`). La final: `pnpm -F @marketplace/shared build` (prin `low.cjs`).
Exportă: §4.1–4.6. Depinde de: etapa 9 unită (piece3d) — dacă `e9-3d` nu a terminat, fundația așteaptă (§14).
**`e10-now`** — doar fragment `e10-now` (textele §8, chei existente). Fără cod. Verifică cu Grep că fiecare cheie schimbată nu e citită de e2e (`apps/frontend/e2e`).

### Valul 1 — în paralel (6 agenți de cod, fără fișiere comune)
| Pachet | Fișiere (proprietate) | Teste | Depinde de | Mărime |
|---|---|---|---|---|
| **`e10-kd`** | `flows/kitchen.v5.ts`, `flows/dressing.v5.ts`, `flows/kd.v7.test.ts` + fragment | §10 kd | fundația | 1,5 zile |
| **`e10-rooms-a`** | `flows/bedroom.v4.ts`, `flows/living.v5.ts`, `flows/office.v4.ts`, `flows/hallway.v3.ts`, `flows/rooms-a.v7.test.ts` + fragment | §10 rooms-a | fundația | 2,5 zile |
| **`e10-rooms-b`** | `flows/bathroom.v4.ts`, `flows/laundry.v4.ts`, `flows/balcony.v4.ts`, `flows/pantry.v4.ts`, `flows/rooms-b.v7.test.ts` + fragment | §10 rooms-b (inclusiv testul de scor la balcon) | fundația | 2,5 zile |
| **`e10-3d`** | `packages/shared/src/questionnaire/piece3d/**` (fără `features.ts` și fără schemele atinse de fundație — le poate citi, nu rescrie câmpurile), `flows/guided-pieces/furniture-v5.ts`, `flows/guided-pieces/catalog-v3.ts`, `flows/guided-pieces/v5.test.ts`, `apps/frontend/src/components/configurator/piece3d/**` + fragment | §10 3D + componentă | fundația, etapa 9 (`e9-3d`) | 2,5 zile |
| **`e10-ui`** | `components/configurator/dimension-check.ts` (+test), `step-renderer.tsx` (+`step-renderer-v7.test.tsx`), `summary-rows.ts` (+test), `room-screens.ts`, `room-spec-card.tsx` (+`room-spec-card-v7.test.tsx`), `dimension-figures.tsx`, `illustrations/{index,common,kitchen,bathroom,room-pieces}.tsx`, `illustrations/coverage.test.tsx` + fragment (`dimensions.*`, `roomSpec.dimNotGiven`) | §10 frontend | fundația (după build shared) | 3 zile |
| **`e10-seed`** | `apps/backend/prisma/seed.ts` (rândurile §7d), migrarea `20261115100000_form_v7_scores`, `apps/backend/src/modules/sizing/score-v7.spec.ts` (NOU), `configurator.service.spec.ts` (`describe` nou), `configurator.v7.integration.spec.ts` (NOU) + fragment `e10-seed` (`Admin.sizing.groups.*`, `Admin.sizing.options.*`) | §10 backend | fundația (contractul §5 / §7; testele de flux roșii până termină valul 1 — le rulează la final) | 1 zi |
Reguli: un flux care are nevoie de o capabilitate lipsă din fundație se oprește și o cere în raport. Ilustrațiile pentru valorile noi le face `e10-ui` pe baza
tabelului §9 (valorile sunt fixate aici, deci nu așteaptă fluxurile). `kitchen-front-zones.ts` nu se atinge (id-uri neschimbate).

### Valul 2 — închidere (coordonator + 3 agenți)
1. Coordonator: îmbină fragmentele, `shared build`, schimbă `CURRENT_FLOW_VERSION` (14 linii, commit separat), scrie `score-invariance-v7.test.ts` /
   `firm-text-v7.test.ts` și generează `score-v7.json` / `firm-text-v7.json`, aplică migrarea pe `marketplace_test`, rulează `run-checks.sh`.
   Fixează pe versiune explicită testele care foloseau versiunea curentă implicit (`engine.test.ts:1258` „ETAPA6 = curent”, `guided-pieces/v4.test.ts`,
   `rooms-a.v6.test.ts`, `rooms-b.v6.test.ts`, `kd.v6.test.ts` dacă citesc `CURRENT_FLOW_VERSION`, `step-renderer-v6.test.tsx`, `room-spec-card-v6.test.tsx`).
2. **`e10-e2e`** (§13). 3. **`e10-review`** (doar citește): invarianța, `features`, descrierile, costul, imaginile. 4. **`e10-docs`**: `docs/03` §4.1 (rândul 9: întrebările
   noi și ce se măsoară pe piesă; peretele de la balcon / spălătorie / debara nu mai dă mărimea) și §4.5 (categoriile noi de scor, d3), `docs/07` (D-E10-*: E10-N1…),
   `docs/04` (nicio coloană; câmpurile 3D noi opționale), CHANGELOG cu „La lansare (PO)”: migrarea, anunțul către firme (costul canapelei, balcon / spălătorie / debara),
   parcurgerea fluxurilor.
Cel mult 6 agenți de cod simultan (valul 1); valul 0 = 2 agenți; valul 2 = coordonator + cel mult 3.

---

## 12. DECIZIE NECESARĂ (varianta mică și reversibilă, aplicată în proiect) și „De confirmat de PO”

| # | Ce nu acoperă planul | Alegerea (și de ce) |
|---|---|---|
| E10-N1 | Cum primesc doar versiunile noi câmpurile 3D noi | `Configurator3dStep.features` + `piece3dFeaturesUsed`; pe versiunile vechi câmpurile sunt respinse ca azi. Fără ea, o ciornă veche cu interfața nouă ar salva „extensibilă” pe care derivarea veche o ignoră (firma nu o vede, costul nu o include). |
| E10-N2 | Forma întrebării „fără corpuri suspendate” | Alegere opțională `wallCabinets` pe ecranul formei (cu / fără / nu știu); lipsa = cu corpuri (ca azi). „Nu știu” păstrează piesa (firma propune). |
| E10-N3 | Ce înseamnă „chiuvetă” | Două întrebări: montaj (încastrată / sub blat) și material (inox / compozit / ceramică), pe ecranul blatului (montajul schimbă decupajul blatului). Fără „cine o aduce” (nu e în c9-1). |
| E10-N4 | Frigiderul | Doar când „Frigider” e bifat la electrocasnice, pe același ecran. |
| E10-N5 | Unde ajung electrocasnicele / aparatele (pasul 4 al planului; nu e întrebare nouă, deci intră) | Bucătărie: pe „Corpuri de bază”. Spălătorie: pe „Dulap încastrare electrocasnice”, altfel pe prima piesă. |
| E10-N6 | „Mărimi 120 × 200 și lungime 190” | Opțiunea `D_120` în `bedSize` + întrebarea separată `bedLength` (200 / 190); fără puncte (mărimile saltelei nu au puncte nici azi; mărimea intră prin lățime). |
| E10-N7 | Lista stofelor patului | Aceleași trei ca tapițeria 3D (țesătură / bouclé / catifea), pe ecran propriu (ecranul saltelei are deja 3 întrebări). |
| E10-N8 | „Interiorul dulapului ca la dressing” | Aceleași 6 module ca dressingul, multi-choice opțional, ecran `piece:WARDROBE:details`; „Nu știu” exclusiv. |
| E10-N9 | Lavoarul | Tip (pe blat / încastrat / integrat) + cine îl aduce (eu / firma); ecran `piece:VANITY_UNIT:details`. |
| E10-N10 | Încărcarea de sus cu aparate suprapuse | Opțiunea `TOP` ascunsă la `STACKED` (nu se poate suprapune un uscător pe o mașină cu încărcare de sus). |
| E10-N11 | Piesele înalte pe cameră | Exact lista planului (tabelul 5.0). Candidați de întrebat: ansamblul TV cu dulapuri (living), rafturile de debara, dulapul de depozitare de la spălătorie (azi inclus). |
| E10-N12 | Living: „înălțimea devine opțională” (plan) vs „înălțime opțională la piesele înalte” (PO c5-2) | Răspunsul PO (final): înălțimea rămâne doar la bibliotecă și vitrină; dispare la comoda TV, măsuță, rafturi, piesa liberă. |
| E10-N13 | Holul nu e numit la „înălțime opțională” | Primit (PO c5-2: „aceeași regulă peste tot”): dulapul și cuierul de hol, opțional. |
| E10-N14 | Peretele informativ: obligatoriu sau nu | Rămâne obligatoriu (PO: „un ecran puțin mai lung”), dar nu mai dă mărimea. |
| E10-N15 | „Nu știu” la lățimea holului | Valoarea comună `FIRM_DECIDES`, cu etichetă proprie „Nu știu — o măsoară firma”; doar etichetă pe fișă, nu în descrierea pieselor. |
| E10-N16 | Valorile tipice („de obicei …”) | Tabelul 5.0 și §6; doar indiciu, nu se salvează. |
| E10-N17 | d3 la fotoliu și taburet | Fără puncte noi (nu au locuri / șezlong; mărimea vine din `ROOM_SIZE`); fluxurile lor rămân pe v2. |
| E10-N18 | Câte puncte are canapeaua extensibilă și configurația ei | 2 (extensibilă), 0 / 1 / 2 (2 / 3 / 4 locuri), 1 (șezlong), 0 (ladă). |
| E10-N19 | Limitele mesei (lungime deschisă, înălțimi) și ale băncuței | §6; lungimea deschisă doar la masa extensibilă. |
| E10-N20 | „Altă mărime” la patul 3D | Obiect `bed.customSize` (lățime, lungime), cu limitele dormitorului; enumul mărimilor neschimbat (cererile vechi neatinse). |
| E10-N21 | Cum arată o înălțime opțională lăsată goală | Client: „Nu ai dat-o — o stabilești cu firma”; firmă: „nespecificată de client (de obicei …)”. |
| E10-N22 | Insigna „Recomandarea firmei” pe întrebările noi | Nu; insigna rămâne pentru material / deschidere; „Nu știu” la întrebările noi = notă în descriere. |
| E10-N23 | Interacțiunea cu etapa 9 (masa extensibilă separată de formă) | Scorul v5 acceptă ambele forme; vezi §14. |
| E10-N24 | „Altă piesă” în baie / dormitor (în pașii planului, nu în c9-1) | Nu intră. |
| E10-N25 | Numele instantaneelor / fișierelor de test | Sufix `-v7` (ca migrarea rezervată `form_v7_scores`); filtrul fixture-urilor se numește `'etapa10'`. |
| E10-N26 | `ETAPA6_FLOW_VERSION` calculat ca maxim | Înghețat ca valori literale (altfel testele etapei 6 s-ar muta pe versiunile noi). |

**De confirmat de PO (listă scurtă)**:
1. Ponderile canapelei (d3): 2 / 3 / 4 locuri = 0 / 1 / 2, șezlong 1, extensibilă 2, ladă 0; fotoliul și taburetul fără puncte noi (E10-N17, N18).
2. „Fără corpuri suspendate” scade costul doar prin piesa care dispare (de obicei −4 credite); nu există puncte negative.
3. Balcon / spălătorie / debara: costul vine din lățimea pieselor — un raft mic pe un balcon lung costă ~4 credite, nu ~8 (exemplele B, F).
4. Piesele înalte pe cameră (E10-N11) și living fără înălțimea comodei TV / măsuței (E10-N12); holul cu înălțime opțională (E10-N13).
5. Chiuveta = montaj + material; lavoarul = tip + cine îl aduce; stofa patului = 3 țesături; interiorul dulapului = modulele dressingului (E10-N3, N7–N9).
6. Lungimea saltelei ca întrebare separată (200 / 190), fără puncte (E10-N6); „Altă mărime” la patul 3D (E10-N20).
7. Limitele noi: lungimea deschisă a mesei, înălțimea mesei pe tip, înălțimea băncuței (E10-N19).
8. Electrocasnicele și aparatele de spălătorie ajung în descrierea pieselor (pasul 4 al planului; E10-N5).

---

## 13. E2E și verificare în browser

Teste e2e care se rup sau trebuie aduse la zi (agentul `e10-e2e`, Edge pe placa video, flagurile din CLAUDE.md global):
- `e2e/helpers/guided-request.ts`: `dimension-group` — completează doar sloturile obligatorii (lasă gol un slot opțional într-o cameră, ca să treacă și drumul „gol”);
  pașii noi opționali — nu-i alege implicit, dar `preferred` primește `wallCabinets: 'NO_WALL_CABINETS'` (o rulare), `bedSize: 'D_120'`, `basinType: 'INSET_BASIN'`;
  multi-choice `wardrobeInterior`: nu bifa `FIRM_DECIDES` (exclusiv; regula deja existentă pentru `option.exclusive`); ecranele noi `piece:*:details`, `bedFabric`,
  `countertopScreen`, `appliancesScreen`, `applianceScreen`. `bedSize: 'CUSTOM'` din `preferred` rămâne valid.
- `e2e/configurator-all-rooms.spec.ts`: verificarea „versiune nouă” devine `not.toContain` pe `FLOW_VERSIONS_BEFORE_ETAPA10` pentru tipurile din §3.
- `e2e/etapa8.spec.ts` (l. ~49: `runA`, `ceilingHeight` tastate): pe camerele la care tavanul dispare sau `runA` devine informativ, testul trebuie fixat pe o
  cameră care le are (bucătăria) sau pe o ciornă veche.
- `e2e/furniture-quality.spec.ts` (combobox „What mattress size?” cu `S_90` / `K_180`; `selectOption('EXTENDABLE')` la masă — deja schimbat de etapa 9): opțiunea nouă
  „Altă mărime”; câmpul „Lungime deschisă”.
- `e2e/catalog-furniture.spec.ts` (SOFA: lățime / înălțime / adâncime corp): comutatoarele noi nu trebuie să mute etichetele; test nou: extensibilă + ladă ajung în
  configurație și în Sumar.
- `e2e/form-v6.spec.ts`: rămâne (ciorna pe versiunile dinainte de etapa 6); test NOU `e2e/form-v7.spec.ts`: o ciornă pe versiunile etapei 6 ajunge la Sumar pe
  întrebările ei; balconul nou cu un raft → Sumarul arată lățimea raftului; înălțimea dulapului lăsată goală → Sumarul arată „Nu ai dat-o…”.
Parcurgeri de mână (coordonatorul, pe local, cont de client + o firmă):
1. Bucătărie „Fără corpuri suspendate”: ecranul Fronturi fără zona suspendatelor; la firmă doar „Corpuri de bază” (+ insulă), cu notele de chiuvetă / frigider.
2. Dormitor doar cu pat: niciun câmp de tavan; pat 120 × 200, apoi 140 + 190; pat tapițat → ecranul stofei; dulap → ecranul „Interior dulap”, tavanul cerut, înălțimea opțională cu „de obicei 240 cm” (în cm și în m).
3. Living cu toate piesele: doar lățimile obligatorii, înălțimea bibliotecii / vitrinei opțională, tavanul cerut; fără bibliotecă / vitrină: fără tavan.
4. Baie cu lavoar: ecranul lavoarului; la firmă nota „Lavoar: …”.
5. Balcon 6 m cu un raft de 1 m: Sumarul și fișa firmei; costul afișat (Admin → previzualizare) ≈ 4 credite.
6. Spălătorie: „Încărcare de sus” dispare la aparate suprapuse; lățimile pieselor.
7. Debara U cu dulapuri: laturile + lățimea dulapurilor; tavanul doar cu dulapuri.
8. Dressing walk-in: trei laturi, planșa cu ușă; latura B de 0,6 m acceptată.
9. Hol: „Hol îngust / generos / nu știu” pe ecranul pieselor.
10. Piese 3D: canapea extensibilă + ladă + 4 locuri cu șezlong (cost 13 în exemplul E); pat „Altă mărime”; masă extensibilă cu lungimea deschisă; băncuță cu înălțimea 48 cm.
11. O cerere publicată înainte de lansare (versiunile etapei 6) deschisă ca firmă și editată ca client: aceleași întrebări, același cost; Admin → Mărime proiect: cele 45 de rânduri noi cu nume omenești.
Costul fix (plan): parcurgerea tuturor celor 28 de fluxuri în browser (cele 14 noi pe larg, cele 14 neschimbate o trecere scurtă), apoi lansarea (PO).

---

## 14. Etapa 9 în lucru (citit la începutul și la sfârșitul proiectării, 2026-11-14)

La citire, `e9-3d` avea NECOMISE: `piece3d/cleanup-notes.ts`, `config.ts`, `furniture-config.ts` (doar `TABLE_ROUND_DIAMETER` pe tip — cafea 0,5–1,0, dining 0,8–1,6,
consolă 0,6–1,0 — cu plaja acceptată lărgită doar în jos, „cererile publicate rămân valide”), `index.ts`, `model.ts`, `edit-rules.ts` (NOU) + test; raportul `e9-3d.md`
era încă schelet. „Extensibilă” ca da/nu separat de formă NU era încă în schemă. Proiectul presupune:
- câmpul etapei 9 pentru masa extensibilă va fi un boolean opțional în `tableOptionsSchema` (nume probabil `extendable`), acceptat pe toate versiunile, cu `shape: 'EXTENDABLE'`
  rămas valid pentru cererile vechi. `furniture-v5.ts` tratează „extensibilă” = `shape === 'EXTENDABLE' || table.extendable === true` (numele exact se ia din codul unit).
- **De verificat la coordonator, înainte de valul 0**: dacă `e9-3d` salvează noul câmp pe `PIECE_TABLE` v4, `furnitureFlowV4.scoreEntries` (înghețat) vede doar `shape` → o masă
  extensibilă nouă pe v4 pierde punctul `TABLE_EXTENDABLE` și descrierea „extensibilă” (vine din `furnitureLegacyAnswers` / `piece-table.ts`). Asta e treaba etapei 9
  (normalizarea poate păstra `shape: 'EXTENDABLE'` pe v4); etapa 10 nu repară v4.
- limitele noi ale etapei 9 (front de sertar ≤ 50 cm, coloană de bibliotecă ≤ 80 cm, comodă TV ≥ 35 cm, diametrul pe tip) se aplică doar la creare / editare (`edit-rules.ts`)
  și nu ating fluxurile; câmpurile noi ale etapei 10 (§4.3, §6) se adaugă PESTE fișierele etapei 9, după ce aceasta e unită. `e10-found` și `e10-3d` recitesc
  `furniture-config.ts`, `catalog-config.ts`, `config.ts`, `edit-rules.ts` și `components/configurator/piece3d/furniture-controls.tsx` înainte de orice Edit.
**Recitire la final (2026-11-14, după scrierea proiectului)**: `e9-3d` a mai adăugat `edit-rules.ts` (funcții `zoneTypesInDisplayOrder`, `columnWidthMaxFor`,
`pieceHeightMinFor`, `drawerZoneOverCap`, `tableSeatsShortfall`, `tableDepthAfterRound`, `applyPieceEditRules`, `editPieceConfig`) și, în interfață,
`camera-reframe.ts` + modificări în `piece-canvas.tsx`, `stable-orbit-camera.tsx`. Masa extensibilă ca opțiune separată tot NU apare în schemă, iar raportul
e tot schelet. Concluzie: valul 0 al etapei 10 pornește DOAR după ce etapa 9 e unită; `e10-found` confirmă numele câmpului extensibil și actualizează §6 / E10-N23
în raport, iar `e10-3d` își aplică regulile noi (`customHeightM`, `openLengthM`, `customSize`) și prin `editPieceConfig` / `applyPieceEditRules`
(regulile de editare ale etapei 9), nu doar prin `normalize*`.
