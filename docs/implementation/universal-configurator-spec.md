# Configuratorul universal de piese 3D — specificatie finala

Data: 2026-10-04 · Stare: PROPUNERE pentru aprobarea PO · Autor: sinteza din 3 propuneri (schema-first, ux-first, migration-first) si 3 evaluari independente.

Cerinta PO (2026-10-04, citat): "te rog sa faci toate corpurile din studioul 3D sa aiba acelasi tip de configurator; momentan avem mai multe tipuri de configurator; vreau sa gandesti un singur model universal care sa arate si sa functioneze foarte bine pentru toate corpurile de mobilier."

Propunerea castigatoare este **Universal Capability Schema (UCS)**, aleasa de 2 din 3 evaluatori. Peste ea s-au grefat ideile recomandate de evaluatori din celelalte doua propuneri. Fiecare grefa are sursa marcata in text cu [UX] (din propunerea ux-first) sau [MIG] (din propunerea migration-first).

Nota despre limba: documentul e scris in romana fara diacritice, ca CHANGELOG. Textele de interfata RO citate aici se scriu **cu diacritice** in `ro.json` (regula `apps/frontend/CLAUDE.md`). In orice text de produs spunem "firma", niciodata "atelier".

---

## 1. Obiectiv si principii

### 1.1 Ce rezolvam

Azi cele 17 corpuri **salveaza deja acelasi JSON** (`PieceConfig3d`, `packages/shared/src/questionnaire/piece3d/config.ts:141-167`). Acel JSON trece prin aceleasi trei puncte de intrare: `normalizePieceConfig`, `pieceConfig3dSchema` si `buildPanels`. "Mai multe configuratoare" exista doar in frontend:

| Azi | Corpuri | Cum arata |
|---|---|---|
| `CabinetControls` (`configurator3d-step.tsx:339-1085`) | BOOKCASE, WARDROBE, TV_UNIT, SHOE_CABINET, DRESSER, NIGHTSTAND, DESK, SIDEBOARD, WALL_CABINET | rail de 330px, canvas sticky, swatch-uri, pills, steppers de 28px, editarea zonei prin click in 3D, buton Reset, scrie default-ul fara sa anunte cand datele sunt invalide |
| `FurnitureControls` (`furniture-controls.tsx`) | BED, TABLE, BENCH, BATHROOM_VANITY, ENTRYWAY, SOFA, ARMCHAIR, OTTOMAN | rail de 280px, canvas care nu e sticky, `<select>` + checkbox, input doar numeric, fara Reset, alerta fara iesire la date invalide |
| `CatalogControls` (`catalog-controls.tsx`) | inserat in ambele | limite dublate in UI (`:33-59`), color input brut |

Pe langa asta: 7 implementari diferite de input pentru dimensiuni, 2 selectoare de finisaj, 2 politici de date invalide si 6 verificari WebGL cu criterii diferite. Hint-ul din vederea firmei e gresit pentru sofa, lavoar si mobilierul de hol (`piece-viewer.tsx:172`). Piesele din Studio ajung fara poza PNG (lipseste `onSnapshot` la `studio-page.tsx:209-213`). Dialogul din Studio pierde modificarile la un click pe fundal (`studio-page.tsx:148`).

### 1.2 Ce livram

**Un singur model universal de editare**: o declaratie pura de capabilitati per corp, in `packages/shared`, care nu se persista niciodata. Peste ea:

- **un singur panou** (`PieceConfigurator`): aceleasi 6 sectiuni, in aceeasi ordine, cu aceleasi widget-uri;
- **un singur comportament 3D**: atingi o parte → o selectezi, o deschizi si panoul sare la sectiunea ei. "Deschide tot" si "Incadreaza" exista pe toate corpurile;
- **o singura politica de citire** a datelor salvate.

Toate trei sunt folosite in pasul de cerere, in editorul din Studio si in vederea firmei, pe desktop si pe telefon.

### 1.3 Principii (nenegociabile in acest program)

1. **JSON-ul stocat nu se schimba.** `PieceConfig3d`, `pieceConfig3dSchema` (`.strict()`, neversionat per flow, `engine.ts:127-129`), `normalizePieceConfig`, dimensiunile canonice (`bedFootprint`, `TABLE_HEIGHT`, `TABLE_LENGTH_LIMITS`, cuplajele sofa/fotoliu/taburet/lavoar), `describePieceConfig`, toate `deriveRoom` si `scoreEntries` raman identice, octet cu octet. Le blocam cu teste golden in Faza 0.
2. **Fara versiune noua de flow si fara versiune noua de draft Studio** in programul de baza. Flow-urile raman FROZEN (`flows/index.ts:59-64`). `CURRENT_FLOW_VERSION` ramane 3/1. `StudioDraftData.version` ramane 3.
3. **Identitatea la publicare e sacra.** `isDeepStrictEqual(answers.config3d, piece.config)` (`studio-publication.ts:48`) si `JSON.stringify` (`studio-transfer.ts:57`) trebuie sa dea acelasi rezultat ca azi. Orice scriere trece prin `normalizePieceConfig`. Panoul **nu scrie niciodata la montare** o valoare ne-nula [MIG].
4. **Regulile geometrice traiesc doar in shared.** Limitele din FE (`furniture-controls.tsx:84-91`, `catalog-controls.tsx:33-59`) dispar. UI-ul citeste doar intervalele calculate de shared.
5. **Deciziile existente raman.** Optiunile imposibile geometric sunt ASCUNSE, nu dezactivate. D-3D-2: modul 3D si modul fara 3D coexista si produc acelasi config. D-3D-3: fara pret afisat. D-3D-4: PNG automat. NIGHTSTAND din Studio = count ONE. Un corp cu o singura coloana nu are control de coloane. DESK are casetiere de latime fixa.
6. **Nicio optiune existenta nu se pierde.** Un test de acoperire esueaza daca vreun camp persistat al unui corp nu are control sau afisare explicita (vezi 2.5, regula V3).
7. **Optiunile noi care cer campuri noi** (de exemplu culoarea tesaturii la pat) **nu intra in program**. Fiecare are nevoie de decizie PO (sectiunea 8) si merge pe "pista de date" separata, versionata (5.8).
8. **Un singur comutator** pentru toate suprafetele (pas de cerere, Studio, vederea firmei) si pentru toate cele 17 corpuri deodata in productie [MIG + judecata]. Clientul nu vede niciodata configuratoare amestecate.

---

## 2. Modelul de date universal

### 2.1 Doua straturi

| Strat | Ce e | Persistat? | Unde |
|---|---|---|---|
| L0 Stocare | `PieceConfig3d` de azi, numit "dialect 3" | DA (studio_drafts.data, answers.config3d, request_studio_scenes.data) | `piece3d/config.ts`, neschimbat |
| L1 Capabilitati | declaratia per corp: sectiuni, controale legate de cai din JSON, intervale vii, optiuni disponibile, cuplaje, parti 3D | NU, se calculeaza din (kind, config) | `piece3d/capabilities/*` (NOU) |

Nu exista un strat de "plugin geometric": evaluatorii l-au considerat o indirectare inutila, iar `buildPanels` face deja dispatch (`model.ts:364-379`). Adaugam doar `buildPartBoxes` langa `buildZoneBoxes`, cu rol exclusiv de randare.

### 2.2 Schita TypeScript (L1)

```ts
// packages/shared/src/questionnaire/piece3d/capabilities/types.ts  (NOU)
export const CAPABILITIES_VERSION = 1; // doar in cod; nu se scrie niciodata in DB

export type SectionId = 'size' | 'layout' | 'storage' | 'opening' | 'base' | 'finish'; // ordine FIXA
export type Family = 'cabinet' | 'bed' | 'table' | 'bench' | 'vanity' | 'entryway' | 'seating';
export type KindCategory = 'STORAGE' | 'TABLES_WORK' | 'REST_SEATING' | 'BATH_HALL';
export type MsgKey = string; // cheie next-intl sub Configurator.piece.*

/** Tinta unei editari: piesa intreaga sau o coloana/zona (doar family cabinet). */
export type PartRef =
  | { type: 'piece' }
  | { type: 'column'; column: number }
  | { type: 'zone'; column: number; zone: number }
  | { type: 'mechanism'; key: string }; // cheia Panel3d.motion (sertare pat, capac taburet, usi lavoar...)

/** Lentila peste JSON-ul de azi. write NU normalizeaza si NU adauga chei undefined. */
export interface Binding<T> {
  read(c: PieceConfig3d, at?: PartRef): T;
  write(c: PieceConfig3d, v: T, at?: PartRef): PieceConfig3d;
}

interface ControlBase {
  id: ControlId;                 // lista inchisa, ~45 id-uri (vezi 2.3)
  section: SectionId;
  scope: 'piece' | 'column' | 'zone';
  label: MsgKey;                 // substantiv, niciodata intrebare
  hint?: MsgKey;                 // ex. nota instalatii, nota lenjerie
  visible(c: PieceConfig3d, at?: PartRef): boolean; // false = ASCUNS (regula PO)
  part?: (c: PieceConfig3d) => string | null;        // partea 3D asociata (selectie <-> sectiune)
}

export type ControlSpec = ControlBase & (
  | { widget: 'dimension'; bind: Binding<number>;
      range(c: PieceConfig3d, at?: PartRef): { min: number; max: number }; // in metri, din limits.ts
      stepCm: 1 | 5; lockable?: Binding<boolean> }                          // lacat latime coloana/inaltime rand
  | { widget: 'readout'; value(c: PieceConfig3d): { cm?: number; text?: MsgKey }; reason: MsgKey }
  | { widget: 'choice'; bind: Binding<string>; options: readonly string[];
      available(c: PieceConfig3d, at?: PartRef): readonly string[];          // DOAR optiunile vizibile
      optionLabel(v: string): MsgKey; optionImage?(v: string): string | null } // ex. push.png / maner.png / glisante.png
  | { widget: 'count'; bind: Binding<number>; range(c: PieceConfig3d, at?: PartRef): { min: number; max: number }; unit?: MsgKey }
  | { widget: 'toggle'; bind: Binding<boolean> }
  | { widget: 'woodFinish'; bind: Binding<{ finish: Piece3dFinish; customColor?: string }> }
  | { widget: 'fabric'; bind: Binding<Upholstery3d> }  // textura + paleta + culoare proprie (fermitatea si baza sunt controale separate)
  | { widget: 'structure' }                           // harta coloane/zone, doar family cabinet
);

export interface Coupling {           // folosit DOAR pentru notele explicative; sursa de adevar ramane normalize
  trigger: ControlId;
  affects: readonly string[];         // cai: 'widthM', 'sofa.cushions', 'table.seats'...
  reason: MsgKey;
}

export interface PartBox3d {          // DOAR randare, niciodata persistat (regula model.ts:55)
  id: string;                         // 'zone:c:z' | 'motion:<key>' | 'piece'
  ref: PartRef;
  center: [number, number, number];
  size: [number, number, number];
  motionKeys: readonly string[];
  section: SectionId;
  label: MsgKey;
  labelParams?: Record<string, number>;
}

export interface KindCapabilities {
  kind: Piece3dKind;
  family: Family;
  category: KindCategory;             // gruparea din picker-ul Studio
  controls: readonly ControlSpec[];   // ordinea din panou, in interiorul sectiunii
  couplings: readonly Coupling[];
  exempt: readonly { path: string; reason: MsgKey }[]; // campuri persistate fara control, explicit (ex. finish pe tapitate)
  viewerHint: MsgKey;                 // hint-ul din vederea firmei
  summaryTokens(c: PieceConfig3d): readonly SummaryToken[]; // 2-4 jetoane pentru linia de rezumat
}

export const KIND_CAPABILITIES: Record<Piece3dKind, KindCapabilities>;
```

API-ul de rezolvare. **Doar acesta** e apelat din UI si din vederile firmei:

```ts
// capabilities/resolve.ts (NOU)
export interface ResolvedControl { spec: ControlSpec; value: unknown; range?: { min: number; max: number };
  options?: readonly string[]; at?: PartRef }
export function resolveControls(kind: Piece3dKind, c: PieceConfig3d, selection?: PartRef): ResolvedControl[];

export interface Adjustment { path: string; from: unknown; to: unknown; reason: MsgKey; params: Record<string, string | number> }
export function applyControl(kind: Piece3dKind, c: PieceConfig3d, id: ControlId, value: unknown, at?: PartRef):
  { config: PieceConfig3d; adjustments: Adjustment[] };
// = normalizePieceConfig(kind, spec.bind.write(c, value, at)) + diff intre intentie si rezultat pe caile din couplings.
// Pentru family cabinet, operatiile de structura apeleaza legacy-grid-ops (2.4), mutate NESCHIMBATE din configurator3d-step.tsx:391-511 [MIG].
// CUSTOM pe family non-cabinet: scrie customColor = CUSTOM_COLOR_DEFAULT daca lipseste (normalize nu repara finish-ul acolo).

export type StructureOp =
  | { op: 'columns'; count: number }
  | { op: 'column'; c: number; patch: { widthM?: number | null; slideTo?: 'L' | 'R' | null } }
  | { op: 'zone'; c: number; z: number; patch: { type?: Piece3dZoneType; fill?: Piece3dZoneFill | null; count?: number; heightM?: number | null } }
  | { op: 'zone.add'; c: number } | { op: 'zone.remove'; c: number; z: number };
export function applyStructure(kind, c, op: StructureOp): { config: PieceConfig3d; adjustments: Adjustment[] };

export type ReadResult =
  | { status: 'empty'; config: PieceConfig3d }                         // value == null: pasul nu are raspuns -> default, SINGURA scriere permisa la montare
  | { status: 'ok'; config: PieceConfig3d }                            // schema accepta: ACEEASI referinta, fara normalize, fara onChange
  | { status: 'repairable'; config: PieceConfig3d; proposed: PieceConfig3d; adjustments: Adjustment[] } // normalize reuseste si iese valid; se aplica DOAR la click
  | { status: 'unreadable'; config: PieceConfig3d };                   // normalize arunca sau iese invalid; afisam default-ul ca previzualizare, scriem DOAR la click
export function readPieceForEdit(kind: Piece3dKind, raw: unknown): ReadResult; // [MIG]

export function resetPiece(kind: Piece3dKind): PieceConfig3d;          // = defaultPieceConfig; aplicat doar la confirmare
export function buildPartBoxes(c: PieceConfig3d, kind: Piece3dKind): PartBox3d[];
// cabinet: 1:1 cu buildZoneBoxes (model.ts:524-537); restul: un box per cheie Panel3d.motion
// (sertare pat, capac taburet, sertare/usi lavoar per lavoar, usi hol) + 'piece'.
export function pieceSummary(kind, c): SummaryToken[];                 // localizat in FE; inlocuieste logica din config3dChips
```

### 2.3 Lista inchisa de controale (ControlId)

| Sectiune | ControlId |
|---|---|
| size | `size.width`, `size.height`, `size.depth`, `size.mattress`, `size.footprint` (readout), `size.tableHeight` (readout), `size.bodyDepth`, `size.chaiseDepth`, `size.totalDepth` (readout) |
| layout | `layout.structure` (harta coloane/zone), `layout.columns` (stepper "Coloane"/"Casetiere"), `table.type`, `table.shape`, `table.seats`, `sofa.seats`, `sofa.layout`, `sofa.arms`, `sofa.cushions`, `armchair.arms`, `ottoman.shape`, `vanity.basins`, `entryway.hooks`, `entryway.mirror`, `entryway.upperShelf` |
| storage | `zone.type`, `zone.fill`, `zone.count`, `zone.height` (+lacat), `column.width` (+lacat), `zone.add`, `zone.remove`, `bed.storage`, `vanity.storage`, `entryway.shoeStorage`, `ottoman.storage`, `bench.style` |
| opening | `opening.style` (frontStyle SAU vanity.handles), `opening.doorMode`, `column.slideTo`, `opening.entrywayDoors` (readout) |
| base | `base.legs`, `base.mounting` (vanity.mounting), `base.mountingHeight`, `base.seatingBase` (upholstery.base) |
| finish | `finish.wood` (finish + customColor), `finish.countertop`, `finish.bedUpholstered`, `finish.benchSeat`, `finish.entrywaySeat`, `upholstery.fabric` (textura + culoare), `upholstery.firmness` |

`opening.style` e un singur control cu un singur vocabular (PUSH/HANDLE). Legatura (binding) lui difera dupa familie: `frontStyle` pe cabinete, `vanity.handles` pe lavoar. Campul stocat ramane cel de azi; doar widget-ul si cheia i18n devin comune.

### 2.4 Unde stau limitele: `limits.ts`

Cuplajele de azi sunt scrise inline in `normalizeNewFurniture` (`catalog-config.ts:71-99`) si `normalizeFurnitureConfig` (`furniture-config.ts:60-94`), deci nu exista functii pe care `range()` sa le apeleze. Le extragem in `piece3d/limits.ts` [UX]: `sofaMinWidth(sofa)`, `armchairMinWidth(arms)`, `vanityMinWidth(basins)`, `vanityMinHeight(mounting)`, `vanityMountingRange()`, `wallCabinetMountingRange()`, `tableWidthRange(table)`, `tableDepthRange(table)`, `benchWidthRange()`, `ottomanDepthLinked(shape)`.

Normalize le apeleaza pe acestea, iar `range()` din capabilitati la fel. Garantia: extragerea e acceptata **doar** daca diff-ul golden pe corpus e zero, octet cu octet. Asta acopera riscul semnalat de un evaluator: verificarile canonice cer 1e-6 sau egalitate exacta. `PIECE3D_RULES.TABLE` (`config.ts:225-231`, limite gresite) NU se editeaza; capabilitatile nu il mai citesc si primeste un comentariu.

Operatiile de grila (`setColumns`, `updateZone`, `updateColumn`, `setZoneType`, `setZoneFill`, `addZone`, `removeZone`, plafoanele din `:491-511`) se muta **neschimbate** in `piece3d/capabilities/legacy-grid-ops.ts` [MIG]. Si panoul vechi, si cel nou le importa de acolo, deci paritatea e garantata prin constructie.

### 2.5 Reguli de validare (impuse prin teste, nu prin conventie)

| # | Regula | Test |
|---|---|---|
| V1 | **Interval ⇔ normalize.** Pentru orice corp, control numeric si config esantionat, orice x din `range(c)` satisface `read(normalize(write(c,x))) == x`, iar x din afara intervalului se fixeaza la margine. | `capabilities.test.ts` (proprietate, seed fix) |
| V2 | **Disponibil ⇔ schema.** Orice valoare din `available(c)`, aplicata, trece `pieceConfig3dSchema(kind)`. O valoare scoasa ar fi schimbata de normalize sau respinsa de schema (ascuns ≠ dezactivat). | idem |
| V3 | **Acoperire: nicio optiune pierduta.** Fiecare cale-frunza persistata a unui corp (din `defaultPieceConfig` + schemele de familie + cai de coloana/zona) e atinsa de cel putin un binding sau e in `exempt` cu motiv. | idem, poarta obligatorie in CI |
| V4 | **Identitate.** `applyControl`/`applyStructure` sunt deterministe, nu scriu chei `undefined` explicite si dau `JSON.stringify(n(n(c))) === JSON.stringify(n(c))` [MIG R2]. `isDeepStrictEqual` intre iesirea din Studio si cea din pasul de cerere, pentru aceleasi editari. | idem + `studio-transfer.test.ts` |
| V5 | **Echivalenta 3D/2D.** `resolveControls` da acelasi set de controale in ambele moduri (D-3D-2). | idem |
| V6 | **Fara scriere la montare.** Pentru orice fixture ne-nul, panoul montat nu apeleaza `onChange`; `readPieceForEdit(ok)` intoarce aceeasi referinta [MIG]. | RTL `piece-configurator.test.tsx` pe tot corpusul |
| V7 | **Schema nu se strange, normalize nu isi schimba comportamentul.** Diff golden zero la normalize, verdict schema, `describePieceConfig`, `deriveRoom` (v3, furniture-v3, catalog-v1), `collectScoreEntries`, `pieceConfigTotals`, hash `buildPanels`, `buildZoneBoxes`. | `golden.test.ts` |
| V8 | **Parti in limite.** `buildPartBoxes` ramane in bounding box; la cabinete e 1:1 cu `buildZoneBoxes`; panouri < 150 per config (`catalog.test.ts:22`). | `parts.test.ts` |

### 2.6 Versiune

- `CAPABILITIES_VERSION = 1` exista doar in cod, pentru review si e2e. Nu ajunge niciodata in DB.
- Programul de baza nu are versiune de date: nici flow, nici draft Studio, nici schema.
- O versiune de date apare doar pe pista de date (5.8), pentru optiuni aprobate de PO: `cabinet v4`, `furniture v4`, `catalog v2`, plus `schemaRev` per pas, cu regula superset rev2 ⊇ rev1.

### 2.7 Exemple complete

#### WARDROBE

JSON stocat (neschimbat; exact ce exista azi in `answers.config3d` / `studio_drafts.data`):

```json
{
  "widthM": 2.4, "heightM": 2.6, "depthM": 0.6,
  "columns": [
    { "zones": [ { "type": "DOOR", "fill": "HANGING", "count": 1 }, { "type": "DRAWERS", "count": 2, "heightM": 0.5 } ] },
    { "zones": [ { "type": "DOOR", "fill": "SHELVES", "count": 5 } ], "slideTo": "L" },
    { "zones": [ { "type": "DOOR", "fill": "HANGING", "count": 1 }, { "type": "DRAWERS", "count": 2 } ] }
  ],
  "finish": "NUC", "frontStyle": "HANDLE", "doorMode": "SLIDING"
}
```

Declaratie (extras din `capabilities/cabinet.ts`, generata din `PIECE3D_RULES.WARDROBE` + `resolvePieceLayout`):

```ts
WARDROBE: {
  kind: 'WARDROBE', family: 'cabinet', category: 'STORAGE', viewerHint: 'hints.viewer.zones',
  controls: [
    dimension('size.width',  'widthM',  c => ({ min: 0.6, max: 6 })),
    dimension('size.height', 'heightM', c => ({ min: 1.8, max: 2.8 })),
    dimension('size.depth',  'depthM',  c => ({ min: 0.35, max: 0.8 })),
    structure('layout.structure'),
    count('layout.columns', columnsBinding, c => ({ min: 1, max: 8 }), { visible: r => r.maxColumns > 1 }),
    // storage, scope zone: type OPEN/DRAWERS/DOOR, fill SHELVES/HANGING (HANGING ascuns sub 55 cm adancime / 80 cm pe bara),
    // count cu plafon live, inaltime rand cu lacat, latime coloana cu lacat (0.22-1.0 m)
    ...zoneControls(),
    choice('opening.style', 'frontStyle', ['PUSH', 'HANDLE'], { visible: hasFronts }),
    choice('opening.doorMode', 'doorMode', ['HINGED', 'SLIDING'], { available: c => c.columns.length >= 2 && c.columns.length <= 3 ? ['HINGED','SLIDING'] : ['HINGED'] }),
    choice('column.slideTo', 'columns[c].slideTo', ['L', 'R'], { scope: 'column', visible: (c, at) => isSliding(c) && isMiddleColumn(c, at) }),
    woodFinish('finish.wood'),
  ],
  couplings: [ { trigger: 'size.height', affects: ['columns[*].zones[*].type'], reason: 'adjust.drawersTooHigh' } ],
  exempt: [],
  summaryTokens: c => [cols(c), drawers(c), c.heightM >= 2.5 ? tok('summary.toCeiling') : null, finishTok(c)],
}
```

Rezolvare, cu zona (0,1) selectata: `resolveControls('WARDROBE', cfg, {type:'zone',column:0,zone:1})` intoarce in sectiunea `storage` `zone.type` (DRAWERS, optiuni [OPEN, DRAWERS, DOOR]), `zone.count` (2, interval 1..N calculat din inaltimea randului si 15 cm per front), `zone.height` (0.5, blocat) si `column.width` (neblocat). Antetul sectiunii e "Coloana 1 · Zona 2", cu jetonul "Toata piesa".

Ajustare: daca se cere `size.height = 2.8` cu un rand de sertare peste 1,60 m, `applyControl` intoarce `adjustments: [{ path: 'columns[0].zones[0].type', from: 'DRAWERS', to: 'OPEN', reason: 'adjust.drawersTooHigh' }]`. Panoul afiseaza nota "Sertarele de sus au devenit zona deschisa: sertarele se pun doar sub 1,60 m." Este o nota despre o **valoare schimbata**, deci nu redeschide decizia "ascuns fara explicatie".

#### SOFA

JSON stocat (neschimbat):

```json
{
  "widthM": 2.24, "heightM": 0.85, "depthM": 1.6, "columns": [], "finish": "STEJAR",
  "upholstery": { "fabric": "BOUCLE", "color": "#a69d8e", "firmness": "MEDIUM", "base": "WALNUT" },
  "sofa": { "seats": 4, "layout": "CHAISE_LEFT", "bodyDepthM": 0.95, "arms": "SLIM", "cushions": "SPLIT", "chaiseDepthM": 1.6 }
}
```

Declaratie (extras din `capabilities/catalog.ts`):

```ts
SOFA: {
  kind: 'SOFA', family: 'seating', category: 'REST_SEATING', viewerHint: 'hints.viewer.rotate',
  controls: [
    dimension('size.width', 'widthM', c => ({ min: sofaMinWidth(c.sofa!), max: 3.4 })),
    dimension('size.height', 'heightM', () => ({ min: 0.75, max: 1.05 })),
    dimension('size.bodyDepth', 'sofa.bodyDepthM', () => ({ min: 0.8, max: 1.15 })),
    dimension('size.chaiseDepth', 'sofa.chaiseDepthM', () => ({ min: 1.35, max: 2 }), { visible: c => c.sofa!.layout !== 'STRAIGHT' }),
    readout('size.totalDepth', c => ({ cm: cm(c.depthM) }), 'fixed.sofaDepth'),
    count('sofa.seats', 'sofa.seats', () => ({ min: 2, max: 4 })),
    choice('sofa.layout', 'sofa.layout', SOFA_LAYOUTS),
    choice('sofa.arms', 'sofa.arms', ['SLIM', 'WIDE']),
    choice('sofa.cushions', 'sofa.cushions', ['SPLIT', 'BENCH'], { available: c => c.sofa!.layout === 'STRAIGHT' ? ['SPLIT','BENCH'] : ['SPLIT'] }),
    choice('base.seatingBase', 'upholstery.base', SEATING_BASES),
    fabric('upholstery.fabric'),
    choice('upholstery.firmness', 'upholstery.firmness', SEAT_FIRMNESSES),
  ],
  couplings: [
    { trigger: 'sofa.seats', affects: ['widthM'], reason: 'adjust.sofaWidth' },
    { trigger: 'sofa.arms', affects: ['widthM'], reason: 'adjust.sofaWidth' },
    { trigger: 'sofa.layout', affects: ['depthM', 'sofa.cushions'], reason: 'adjust.chaise' },
  ],
  exempt: [ { path: 'finish', reason: 'exempt.upholsteryReplacesFinish' }, { path: 'customColor', reason: 'exempt.upholsteryReplacesFinish' } ],
  summaryTokens: c => [seatsTok(c), layoutTok(c), fabricTok(c)],
}
```

Ajustare: de la 3 la 4 locuri, cu bratele SLIM si latimea 1,80 m, `applyControl` da `widthM: 2.24` si `adjustments: [{ path: 'widthM', from: 1.8, to: 2.24, reason: 'adjust.sofaWidth', params: { cm: 224, seats: 4 } }]`. Nota afisata: "Latimea a crescut la 224 cm ca sa incapa 4 locuri."

#### BATHROOM_VANITY

JSON stocat (neschimbat):

```json
{
  "widthM": 1.2, "heightM": 0.65, "depthM": 0.5, "columns": [], "finish": "ALB", "mountingHeightM": 0.2,
  "vanity": { "mounting": "WALL", "basins": "DOUBLE", "storage": "DRAWERS", "handles": "PUSH", "countertop": "DARK" }
}
```

Declaratie (extras):

```ts
BATHROOM_VANITY: {
  kind: 'BATHROOM_VANITY', family: 'vanity', category: 'BATH_HALL', viewerHint: 'hints.viewer.parts',
  controls: [
    dimension('size.width', 'widthM', c => ({ min: vanityMinWidth(c.vanity!.basins), max: 2 })),
    dimension('size.height', 'heightM', c => ({ min: vanityMinHeight(c.vanity!.mounting), max: 0.95 })),
    dimension('size.depth', 'depthM', () => ({ min: 0.4, max: 0.6 })),
    choice('vanity.basins', 'vanity.basins', ['SINGLE', 'DOUBLE'], { hint: 'hints.plumbing' }),
    choice('vanity.storage', 'vanity.storage', ['DRAWERS', 'DOORS', 'OPEN'], { part: () => 'motion:vanity-storage' }),
    choice('opening.style', 'vanity.handles', ['PUSH', 'HANDLE'], { visible: c => c.vanity!.storage !== 'OPEN' }),
    choice('base.mounting', 'vanity.mounting', ['WALL', 'FLOOR']),
    dimension('base.mountingHeight', 'mountingHeightM', () => vanityMountingRange(), { visible: c => c.vanity!.mounting === 'WALL' }),
    woodFinish('finish.wood'),
    choice('finish.countertop', 'vanity.countertop', ['LIGHT', 'DARK']),
  ],
  couplings: [
    { trigger: 'vanity.basins', affects: ['widthM'], reason: 'adjust.doubleBasinWidth' },
    { trigger: 'base.mounting', affects: ['heightM', 'mountingHeightM'], reason: 'adjust.floorVanity' },
  ],
  exempt: [],
  summaryTokens: c => [basinsTok(c), storageTok(c), mountingTok(c)],
}
```

Ajustare: SINGLE la 1,00 m → DOUBLE da `widthM 1.0 → 1.2`, cu nota "Latimea a crescut la 120 cm pentru doua lavoare." WALL → FLOOR la inaltimea 0,65 da `heightM 0.65 → 0.8` si scoate `mountingHeightM`, cu nota "Pe podea, inaltimea minima e 80 cm."

---

## 3. Panoul universal

### 3.1 Componenta si punctele de montare

- `PieceConfigurator` (NOU, `components/configurator/piece3d/universal/piece-configurator.tsx`), cu props-urile de azi: `piece`, `value`, `onChange`, `onSnapshot?`, plus `variant: 'step' | 'studio-editor'`.
- `Configurator3dStepUI` (`configurator3d-step.tsx:335-337`) devine un dispatcher subtire: `useUnifiedConfigurator() ? <PieceConfigurator/> : legacy`. Se incarca **doar** prin `dynamic.tsx` (three.js ramane in afara celorlalte bundle-uri).
- Il folosesc `StepRenderer` (pas de cerere), `PieceEditorDialog` (Studio) si pagina `/dev/piece-3d`. Vederea firmei (`piece-viewer.tsx`) foloseste aceleasi capabilitati in regim read-only (3.10).

### 3.2 Structura fixa, la fel pentru toate corpurile

**Bara de rezumat** (mereu vizibila), cu 4 elemente:
- linia de rezumat [UX], de forma "Dulap · 240 × 260 × 60 cm · 3 coloane · 4 sertare · Nuc", din `pieceSummary`;
- comutatorul **3D | Plan 2D** (`ui/Tabs`, min-h-11);
- butoanele **Anuleaza / Reface** (undo/redo);
- **Reseteaza**, cu un popover de confirmare.

Aceeasi linie de rezumat apare si in `LibraryRow` din Studio si in antetul vederii firmei [UX].

**Sectiunile, in ordine fixa.** O sectiune fara controale vizibile nu se randeaza; ordinea nu se schimba niciodata.

| # | Sectiune (RO / EN) | Contine |
|---|---|---|
| 1 | Dimensiuni / Size | latime, inaltime, adancime; saltea (pat); adancime corp si sezlong (sofa); afisari fixe cu motiv (gabarit pat, inaltime masa, adancime = diametru) |
| 2 | Structura / Layout | harta coloanelor si stepper-ul Coloane/Casetiere (cabinete); tip, forma, locuri (masa); locuri, forma, brate, perne (sofa); brate (fotoliu); forma (taburet); lavoare; cuiere, oglinda, polita (hol) |
| 3 | Depozitare / Storage | **contextuala** [UX]: cu o zona selectata, antetul "Coloana N · Zona M" + jetonul "Toata piesa", apoi tip, umplere, numar, inaltime rand cu lacat, latime coloana cu lacat, adauga/sterge rand. Fara selectie: depozitarea la nivel de piesa (depozitare pat, lavoar, pantofar, lada taburet, stil banca), iar la cabinete lista coloanelor (vezi 3.5) |
| 4 | Deschidere / Opening | stil deschidere PUSH/HANDLE (frontStyle sau vanity.handles), usi batante/glisante, directia glisarii (coloana selectata), afisare "Usi cu maner" la hol |
| 5 | Baza si montaj / Base & mounting | soclu/picioare, montaj perete/podea, inaltime de la podea, baza scaunelor (stejar/nuc/negru/soclu) |
| 6 | Finisaj / Finish | swatch-uri de lemn + culoare proprie; blat; tapiterie (textura, paleta, culoare proprie, fermitate); comutatoarele "Tablie tapitata", "Sezut tapitat" |

Toate optiunile raman la vedere. Nu exista nivel "avansat" ascuns (evaluatorii au respins ascunderea optiunilor existente in spatele unui "Mai multe optiuni").

### 3.3 Tipurile de control (`components/ui`, noi si reutilizabile)

Azi `ui/` nu are slider, stepper numeric sau swatch. Toate controalele de mai jos au tinte de atingere de cel putin 44px (min-h-11), accentul walnut si `Card`/`Field`/`Label`.

| Control | Fisier | Comportament |
|---|---|---|
| `DimensionField` | `ui/dimension-field.tsx` | Slider + input numeric in cm + unitatea "cm" + textul "min–max" sub eticheta, mereu vizibil. Draftul se confirma la eliberarea slider-ului, la blur sau la Enter; Escape revine. Fixarea in interval o face `applyControl` (nu componenta). Nume accesibile distincte [UX]: slider "Latime", spinbutton "Latime (cm)"; `aria-valuetext` "160 cm". Lacat optional (`aria-pressed`). Moduri: free / readout. In timpul gestului, onChange trimite valori normalizate pentru previzualizarea live; istoricul undo comaseaza tot gestul. |
| `ChoiceChips` | extinde `ui/filter-chips.tsx` cu `semantics="radio"` [UX] | `role=radiogroup` + `aria-labelledby`, sageti, roving tabindex, imagine/icon optional (push.png, maner.png, glisante.png). **Fara fallback la Select**: niciun enum nu depaseste 6 valori. |
| `CountStepper` | `ui/count-stepper.tsx` | Butoane −/+ de 44px, `aria-label` "Mai putine/Mai multe {x}", valoare cu `aria-live`, plafon live din `range()`. Inlocuieste `Stepper`-ul local (nume in conflict cu `ui/stepper.tsx`). |
| `ToggleField` | pe `ui/switch.tsx` + `Field` | `role=switch`, eticheta + hint optional. |
| `SwatchGroup` | `ui/swatch-group.tsx` | radiogroup; nume accesibil = numele finisajului (i18n); `title` pastrat pentru e2e (`getByTitle('Walnut')`) [MIG]; bifa pe selectat. Ultimul swatch, "Culoare proprie", deschide un `Popover` cu `input type=color` + hex. Paleta e configurabila: lemn (9 + proprie) sau tesatura (12 + proprie). O singura constanta `CUSTOM_COLOR_DEFAULT = '#c9aa80'` pentru ambele familii (azi sunt doua valori diferite). |
| `FabricPicker` | `universal/controls/fabric-picker.tsx` | Textura (ChoiceChips WOVEN/BOUCLE/VELVET) + SwatchGroup cu paleta de tesatura. Fermitatea e control separat. |
| `Readout` | `universal/controls/readout.tsx` | Valoare + motiv ("Stabilita de saltea si cadru: 173 cm"). |
| `StructureMap` | `universal/structure-editor.tsx` | Harta coloanelor/zonelor: corpul extras din `configurator3d-step.tsx` (toolbar-ul de zona + grila din modul campuri), mai intai **mutat ca atare**, restilizat abia dupa ce trec testele de paritate. |

Cele 3 dimensiuni ale corpului sunt mereu cate una pe rand; dispare grila inghesuita `sm:grid-cols-3`.

### 3.4 Stari

| Stare | Cand | Ce vede clientul | Scriere |
|---|---|---|---|
| Incarcare | chunk-ul 3D se incarca | `ui/Skeleton` de dimensiunea canvas-ului (in locul spinner-ului din `dynamic.tsx:12-14`) | — |
| `empty` | pas nou, `value == null` | configul implicit | **o singura** scriere la montare (ca azi; pasul trebuie sa aiba raspuns) |
| `ok` | configul salvat e valid | panoul normal | **nimic** la montare (V6) |
| `repairable` | configul vechi trece prin normalize (de exemplu zone pre-R5.3) | `Alert` amber: "Configuratia salvata nu mai respecta regulile actuale. Am pregatit o varianta corectata: {lista ajustari}." Butoane: [Aplica ajustarea] [Pastreaza si revin mai tarziu] | doar la click |
| `unreadable` | normalize arunca sau iese invalid | `Alert` crimson: "Nu putem citi configuratia salvata." Buton: [Reia de la valorile implicite]. Previzualizarea arata default-ul, estompat. | doar la click; pana atunci pasul ramane invalid (engine-ul il respinge, ca azi) |
| Ajustare dupa o editare | normalize a corectat o valoare | o linie amber sub controlul care a declansat-o, in `aria-live=polite`, care se poate inchide si dispare dupa ~6 s | — |
| Optiune imposibila | regula geometrica | optiunea e **ascunsa** (decizia PO). Singura explicatie existenta ramane `slidingNeeds`. Motivele pentru alte optiuni ascunse = DECIZIE NECESARA D1. | — |
| Fara WebGL | `lib/webgl.ts` → `none` | doar modul Plan 2D + nota "Previzualizarea 3D nu e disponibila pe acest dispozitiv" | — |
| Refuz in Studio (coliziune) | `savePiece` refuza | mesajul `collisionReason` inline in dialog, langa butonul Salveaza; dialogul ramane deschis, modificarile se pastreaza | — |

### 3.5 Previzualizarea 3D: un singur comportament

O singura `PieceCanvas`, cu setarile de azi: `frameloop="demand"`, `dpr [1,1.75]`, OrbitControls fara damping si fara pan, `StableOrbitCamera` neschimbata, fara `key` pe Canvas.

1. **Parti pentru toate corpurile**, din `buildPartBoxes`. Hover = nuanta. Atingere = selectie (contur `HIGHLIGHT_COLOR #e2662e`) + deschiderea mecanismului + saltul panoului la sectiunea partii. A doua atingere inchide mecanismul. Este regula de azi de la cabinete, generalizata la sertarele patului, capacul taburetului, sertarele/usile lavoarului si usile holului. Patul LIFT_UP ramane previzualizare statica. Corpurile fara mecanisme (masa, sofa, fotoliu) au doar partea "piece"; pe ele, atingerea nu face nimic.
2. **Overlay-uri** (min-h-11, `aria-pressed`), pe **toate** corpurile, inclusiv cabinetele:
   - "Deschide tot / Inchide tot", jos-stanga. Numele existente "Open storage" / "Open drawers" se pastreaza unde se aplica. `use-cabinet-fronts.ts` primeste `openAll`.
   - "Incadreaza", jos-dreapta [UX]. E singurul reframe explicit; camera nu se reseteaza niciodata la editare.
3. **Montajul pe perete**: WALL_CABINET si lavoarul WALL se ridica cu `pieceElevation` ca transformare a grupului (panourile nu se muta, deci `panelsWithinBounds` ramane valabil). Apar un plan de perete discret, o linie de podea si o cota "{n} cm de la podea". Incadrarea initiala include si inaltimea de montaj. Previzualizarea devine consecventa cu Studio si cu vederea firmei (azi piesa sta pe podea doar in configurator).
4. **Animatii**: duratele 400/420/480/520/620 ms, `prefers-reduced-motion` (stabilizare instantanee) si secventierea prin `onFrontSettled` raman. Un sertar tot nu se poate deschide printr-o usa glisanta inchisa.
5. **Performanta**: `buildPanels` se memoizeaza o singura data per config (azi ruleaza de 3 ori in `piece-canvas.tsx:297/369/375`, plus o data in `use-cabinet-fronts.ts`). Hitbox-urile sunt meshe invizibile fara material, doar pentru raycast, comasate per piesa. Bugete: fixture mic ≤ 70 draws/frame si p95 ≤ 40 ms; fixture mare ≤ 600 draws si p95 ≤ 85 ms; heap ≤ 180 MB; 0 draws in repaus; dispose complet.
6. **Modul Plan 2D** [UX]: `ElevationMap` interactiv (SVG din `buildPanels` + `buildPartBoxes`, ca `studio/previews.tsx`). Partile sunt `<button>`, cu sageti si Enter. Modul serveste trei roluri: fallback fara WebGL (D-3D-2), drumul de tastatura pentru selectarea zonelor si modul "campuri". Panoul e **identic** in 3D si in 2D.
7. **Lista de parti** (cititor de ecran/tastatura): in sectiunea Depozitare, fara selectie, lista "Coloana 1: usa + 2 sertare" etc. (sau "Sertare pat", "Capac lada" la celelalte corpuri). Fiecare element e un buton care face aceeasi selectie ca atingerea in 3D.
8. **PNG**: debounce de 800 ms, doar in modul 3D, ca azi. Acum se genereaza si in Studio (3.9).

### 3.6 Layout

**Desktop (lg+):**
- grila `[minmax(0,1fr)_360px]`, la fel pentru toate cele 17 corpuri (dispar latimile 330/280);
- canvas `lg:sticky lg:top-20`, inaltime `min(560px, 100vh - 7rem)`;
- railul, de sus in jos: bara de rezumat, un rand de ancore de sectiune, apoi cardurile sectiunilor, toate deschise. Railul are scroll propriu, ca sa ramana vizibil canvas-ul;
- partea selectata evidentiaza cardul sectiunii ei si il aduce in vedere.

**Tableta (sm–lg):**
- canvas sus, 420px;
- sectiunile pe 2 coloane;
- dimensiunile cate una pe rand.

**Telefon (< sm):**
- Canvas-ul e sticky sus, `clamp(260px, 42svh, 400px)`. Are un buton "Ascunde previzualizarea" pentru ecranele scurte (inclusiv landscape) si `touch-action: none` doar pe canvas.
- Sub el, bara de rezumat compacta (linia scurtata + Anuleaza/Reface + meniu cu Reseteaza). Rezumatul NU sta peste canvas: pe canvas raman doar "Deschide tot" si "Incadreaza".
- Sub rezumat, banda de taburi de sectiune: sticky, `ui/Tabs`, scroll orizontal, icon + text, min-h-11. Se vede doar sectiunea activa.
- Atingerea unei parti comuta automat tabul. Clientul nu mai face scroll intre model si toolbar.
- Fara overflow orizontal (asertat in e2e). Navigatia de subsol a wizard-ului nu e acoperita.

**In dialogul Studio:** containerul de scroll e corpul dialogului, iar canvas-ul e sticky `top-0` in el.

### 3.7 Anuleaza / Reface (undo)

Grefa [UX]:
- Istoric local per instanta de panou, maximum 50 de intrari, cu config-ul intreg per intrare (JSON mic).
- Un gest de slider (de la pointerdown la pointerup) sau o serie de taste pe slider (debounce 400 ms) face o singura intrare.
- Ctrl/Cmd+Z si Ctrl/Cmd+Shift+Z sunt active **doar cand focusul e in panou**. Scurtaturile globale din Studio raman dezactivate cat e deschis editorul (`studio-page.tsx:1262`).
- Reset si "Aplica ajustarea" sunt intrari in istoric.
- In Studio, "Salveaza" ramane **o singura** intrare de undo in `studio-store` (atomic, ca azi). Istoricul local se pierde la inchidere sau reincarcare; e acceptabil.

### 3.8 Preset-uri

Nu fac parte din prima livrare (DECIZIE NECESARA D7). Modelul le suporta deja: `presets: { id, label, apply(c) }[]`, cu iesirea trecuta prin normalize si testata cu V1-V4. Activarea lor costa ~1,5 zile dupa aprobarea listei RO/EN.

### 3.9 Studio

- `PieceEditorDialog` se reconstruieste pe `ui/Dialog` (Radix), cu semantica `useDialogFocus`: ecran complet pe telefon, `max-w-6xl` pe desktop.
- **Garda de modificari**: daca exista modificari nesalvate, click pe fundal sau Escape intreaba "Renunti la modificari?" [Renunta] [Continua editarea]. Asta rezolva P1-ul din audit (`studio-page.tsx:148`).
- **Picker-ul de corp** e grupat dupa `capabilities.category`, cu previzualizarile SVG existente. Numele grupurilor si repartizarea = D6:
  - Depozitare: BOOKCASE, WARDROBE, TV_UNIT, SHOE_CABINET, DRESSER, NIGHTSTAND, SIDEBOARD, WALL_CABINET;
  - Mese si lucru: TABLE, DESK;
  - Odihna si sezut: BED, SOFA, ARMCHAIR, OTTOMAN, BENCH;
  - Baie si hol: BATHROOM_VANITY, ENTRYWAY.
- **Piesa plasata de mai multe ori**: antetul afiseaza "Modificarile se aplica tuturor celor {n} plasari ale piesei." Comportamentul ramane cel de azi (D5).
- **PNG din Studio**: `onSnapshot` se transmite acum. Imaginea intra intr-un cache de sesiune in `studio-store`: `pieceId → { configHash, dataUrl }`, LRU 60, hash pe `JSON.stringify` al config-ului normalizat. **Nu se scrie niciodata** in draft (limita de 300 KB si v3 raman intacte). `studio-transfer.ts` ataseaza PNG-ul in `snapshots3d` din `configurator-store` doar daca hash-ul se potriveste; altfel nu ataseaza nimic, ca azi. `review-step` il incarca prin fluxul presigned existent (invarianta 3.4).
- `LibraryRow` foloseste linia de rezumat. Actiunile din `FloatingPanel` raman neschimbate.
- Inspectorul compact in camera (Dimensiuni + Finisaj, previzualizare live) **nu** intra in programul de baza (D8). Cere stare tranzitorie in afara istoricului si a coliziunilor si rollback pe toate camerele.
- Verificarea WebGL trece la `lib/webgl.ts` (`detectWebGl(): 'webgl2' | 'webgl1' | 'none'`, cu cache). Fiecare consumator declara nivelul de care are nevoie: configuratorul si vederea firmei cer webgl1, room-canvas si house-editor cer webgl2. Criteriile de azi se pastreaza; doar codul e unificat.

### 3.10 Vederea firmei

- `piece-viewer.tsx` ia hint-ul din `capabilities.viewerHint` si faptele per sectiune pentru toate cele 17 corpuri (nu doar zonele de cabinet). Sofa, lavoarul si holul nu mai primesc hint-ul "atinge o zona"; masa si banca nu mai primesc hint-ul cu salteaua.
- Butonul "Deschide tot" e acelasi ca in configurator. Click pe fundal **dupa** un drag de rotire nu mai inchide dialogul.
- Antetul afiseaza linia de rezumat. `config3dChips` devine un wrapper peste `pieceSummary`, cu vocabular unificat (PUSH/HANDLE, DRAWERS/DOORS/OPEN). Rezultatul e localizat la citire si nu se persista.
- `describePieceConfig` / `request_items.description` (textul persistat pe care il citeste firma) **nu se schimba**. Testul golden V7 il blocheaza.

### 3.11 Accesibilitate (criterii de acceptare)

- Fiecare sectiune e `<section aria-labelledby>`. Grupurile de alegeri sunt `role=radiogroup` cu eticheta; swatch-urile au nume accesibil din i18n, nu doar `title`.
- Slider-ul si input-ul au nume distincte, iar `aria-valuetext` e in cm.
- Zonele si partile se pot selecta fara pointer: lista de parti si ElevationMap.
- Notele de ajustare sunt anuntate cu `aria-live=polite`; alertele de citire au `role=alert`.
- Respecta `prefers-reduced-motion`. Contrastul textului si al conturului de selectie ≥ 4.5:1 / 3:1.
- Focusul e prins in dialogul Studio, iar la inchidere revine pe butonul Edit.
- Tintele de atingere sunt ≥ 44px pe toate controalele (azi pills 26px, steppers 28px, lacat 32px).

### 3.12 Chei i18n noi (`Configurator.piece.*`, paritate RO/EN testata)

Etichetele sunt substantive, nu intrebari. Unitatea e cm, iar numerele trec prin next-intl ("2,40 m" / "2.40 m"). Nu se afiseaza preturi (D-3D-3). Cheile `flows.PIECE_*` raman, pentru ca le folosesc flow-urile. Cheile `config3d.*` si `config3d.catalog.*` se sterg abia dupa migrarea e2e (Faza 8).

| Grup | Chei (exemple) | RO (in ro.json cu diacritice) | EN |
|---|---|---|---|
| `sections` | size, layout, storage, opening, base, finish | Dimensiuni, Structura, Depozitare, Deschidere, Baza si montaj, Finisaj | Size, Layout, Storage, Opening, Base & mounting, Finish |
| `controls` | width, height, depth, mattress, bodyDepth, chaiseDepth, totalDepth, columns, pedestals, zoneType, zoneFill, zoneCount, rowHeight, columnWidth, tableType, tableShape, tableSeats, seats, sofaLayout, arms, cushions, ottomanShape, basins, hooks, mirror, upperShelf, bedStorage, vanityStorage, shoeStorage, ottomanStorage, benchStyle, openingStyle, doorMode, slideTo, legs, mounting, mountingHeight, seatingBase, woodFinish, countertop, bedUpholstered, benchSeat, entrywaySeat, fabric, fabricColor, firmness | Latime, Inaltime, Adancime, Marime saltea, Adancime corp, Adancime totala sezlong, ... Coloane, Casetiere, ... Stil deschidere, ... Inaltime de la podea, ... Culoare tesatura, Fermitate | Width, Height, Depth, Mattress size, Body depth, Overall chaise depth, ... Columns, Pedestals, ... Opening style, ... Height above floor, ... Fabric colour, Firmness |
| `controls.*Cm` | widthCm, heightCm, depthCm, ... | "Latime (cm)" | "Width (cm)" |
| `values` | PUSH, HANDLE, HINGED, SLIDING, DRAWERS, DOORS, OPEN, DOOR, SHELVES, HANGING, ... (o cheie per concept, comuna cabinete/lavoar) | Push, Cu maner, Batante, Glisante, Sertare, Usi, Deschis, ... | Push, With handle, Hinged, Sliding, Drawers, Doors, Open, ... |
| `fixed` | bedFootprint, tableHeight, roundDepth, benchFixed, sofaDepth | "Stabilita de saltea si cadru", "Fixa pentru {type}: {cm} cm", "= diametrul" | "Set by mattress and frame", "Fixed for {type}: {cm} cm", "= diameter" |
| `adjust` | sofaWidth, armchairWidth, doubleBasinWidth, floorVanity, tableType, chaise, drawersTooHigh, roundOttoman | "Latimea a crescut la {cm} cm ca sa incapa {seats} locuri.", "Masa extensibila e doar de dining; am trecut la dreptunghiulara.", ... | "Width increased to {cm} cm to fit {seats} seats.", ... |
| `recover` | repairableTitle, repairableBody, apply, keep, unreadableTitle, unreadableBody, restart | "Configuratia salvata nu mai respecta regulile actuale", "Aplica ajustarea", "Reia de la valorile implicite" | "The saved configuration no longer matches the current rules", "Apply the adjustment", "Start from defaults" |
| `parts` | zone, column, piece, bedDrawers, ottomanLid, vanityStorage, entrywayDoors, list, wholePiece | "Coloana {c} · Zona {z}", "Toata piesa", "Sertare pat", "Capac lada" | "Column {c} · Zone {z}", "Whole piece", "Bed drawers", "Storage lid" |
| `actions` | openAll, closeAll, frame, undo, redo, reset, resetConfirm, mode3d, mode2d, hidePreview, more, fewer | "Deschide tot", "Inchide tot", "Incadreaza", "Anuleaza", "Reface", "Reseteaza", "Plan 2D", ... | "Open all", "Close all", "Frame", "Undo", "Redo", "Reset", "2D plan", ... |
| `hints` | emptySelection, plumbing, bedding, fabricNote, noWebgl, viewer.zones, viewer.parts, viewer.rotate | "Atinge o zona din model sau alege o coloana din lista.", "Firma confirma pozitia instalatiilor la masuratori.", ... | "Tap a zone in the model or pick a column from the list.", "The firm confirms the plumbing position at the site measurement.", ... |
| `exempt` | upholsteryReplacesFinish | (nu se afiseaza in UI; folosit doar in teste si in documentatie) | — |
| `Studio` | picker.groups.{STORAGE,TABLES_WORK,REST_SEATING,BATH_HALL}, editor.discardTitle, editor.discard, editor.keepEditing, editor.sharedCopies | "Depozitare", "Mese si lucru", "Odihna si sezut", "Baie si hol", "Renunti la modificari?", "Modificarile se aplica tuturor celor {n} plasari ale piesei." | "Storage", "Tables & work", "Rest & seating", "Bath & hall", "Discard changes?", "Changes apply to all {n} placements of this piece." |

Cheile neutilizate azi, `config3d.drawersTooHigh` si `config3d.hangingNeeds`, se muta in `adjust.*` / `hints.*` doar daca le cere D1. Vocabularele duplicate (`catalog.options.PUSH/HANDLE` fata de `frontStyles.*`, `catalog.options.DRAWERS/DOORS/OPEN` fata de `zoneTypes.*`) se unesc in `values.*`.

---

## 4. Maparea celor 17 corpuri

Legenda sectiunilor: Dim = Dimensiuni, Str = Structura, Dep = Depozitare, Des = Deschidere, Baza = Baza si montaj, Fin = Finisaj. **JSON-ul stocat e identic pentru toate 17.** Coloana "Se schimba" listeaza doar diferentele vizibile.

| Corp | Sectiuni si controale | Optiuni pastrate (toate cele de azi) | Ce dispare / se redenumeste / se schimba |
|---|---|---|---|
| BOOKCASE | Dim: L 40-400, I 80-280, A 20-50. Str: harta + Coloane 1-6. Dep (zona): tip OPEN/DRAWERS/DOOR, umplere polite, numar, inaltime rand cu lacat, latime coloana cu lacat, adauga/sterge rand (max 4). Des: stil deschidere. Fin: lemn + proprie. | toate operatiile pe zone, lacatele, culoarea proprie, soclul; pasul `openingSystems` din flow | Stilul de deschidere e ascuns cand nu exista zone DOOR/DRAWERS; valoarea stocata ramane (D2). Pills → ChoiceChips 44px. Apar "Deschide tot", undo, note de ajustare. |
| WARDROBE | Dim: 60-600 / 180-280 / 35-80. Str: Coloane 1-8. Dep: + bara de haine (≥ 55 cm adancime, 80 cm pe bara, max 3). Des: stil, batante/glisante (2-3 coloane, plus nota `slidingNeeds`), directia glisarii pentru coloana selectata. Fin. | pasul ascuns `doorType`, scorul WARDROBE_TO_CEILING (≥ 2,5 m), toate umplerile | Jetonul "Pana la tavan" in rezumat la ≥ 2,5 m. Directia glisarii trece din toolbar-ul de zona in sectiunea Deschidere (contextual). |
| TV_UNIT | Dim: 100-360 / 25-90 / 30-60. Str: coloane, max 2 zone. Dep. Des. Baza: soclu/picioare doar daca `legsOption`. Fin. | pasii `tvSetup` si `openingSystems` | doar widget-urile comune |
| SHOE_CABINET | Dim: 50-160 / 50-180 / 20-40. Str: 1-3 coloane (DOOR primul). Dep. Des. Fin. | toate | doar widget-urile comune |
| DRESSER | Dim: 40-240 / 50-140 / 35-60. Str: 1-4 coloane. Dep. Des. Baza: soclu/picioare. Fin. | `legs`, `openingSystems` | Picioarele trec in sectiunea Baza. |
| NIGHTSTAND | Dim: 30-80 ×3. Str: **fara** stepper de coloane (o singura coloana), doar randuri. Dep. Des. Fin. | pasul `count` ONE/TWO din flow; Studio forteaza ONE | — |
| DESK | Dim: 80-240 / 68-80 / 50-80. Str: stepper "Casetiere" 0-2, latime fixa 42 cm, fara latime de coloana. Dep (per casetiera). Des. Fin. | pasul `cableManagement` | — |
| SIDEBOARD | Dim: 60-300 / 60-120 / 30-60. Str: 1-6 coloane, max 3 zone. Dep: DOOR/DRAWERS/OPEN. Des. Baza: soclu/picioare. Fin. | toate | Nu mai trece prin mixin-ul `CatalogControls`. |
| WALL_CABINET | Dim: 40-300 / 30-120 / 20-50. Str: 1-6 coloane. Dep: DOOR/OPEN. Des. Baza: "Inaltime de la podea" 30-220 cm (DimensionField). Fin. | `mountingHeightM` (implicit 1,2 m) | Previzualizarea e ridicata la cota reala, cu plan de perete (consecventa cu Studio si cu firma). PNG-ul arata piesa ridicata. |
| BED | Dim: Marime saltea 90/140/160/180 (ChoiceChips) + afisare L × A × I "Stabilita de saltea si cadru". Dep: depozitare NONE/LIFT_UP/DRAWERS (sertarele = parte 3D). Fin: lemn + "Tablie tapitata" (toggle). | gabaritul canonic (`bedFootprint`), BED_STORAGE, ROOM_SIZE din saltea, nota lenjerie | Select → chips, Select de finisaj → swatch-uri, checkbox → switch. Eticheta "What mattress size?" devine "Mattress size". Culoarea tesaturii ramane derivata din finisaj (D3a). |
| TABLE | Dim: latime/diametru (interval din `TABLE_LENGTH_LIMITS[type]` sau 70-180 la ROUND), adancime 40-120 (afisare "= diametrul" la ROUND), inaltime afisata per tip 75/45/80 cu motiv. Str: tip DINING/COFFEE/CONSOLE, forma (EXTENDABLE doar la DINING), locuri (doar DINING). Fin. | TABLE_EXTENDABLE, inaltimea canonica | Inputurile doar numerice devin DimensionField cu slider. Nota la schimbarea tipului (inaltime noua, forma schimbata, locuri scoase). Limitele vin din shared. |
| BENCH | Dim: latime 60-200; I 45 si A 40 afisate cu motiv. Dep: stil WITH_STORAGE/WITH_SHOE_SPACE/SIMPLE. Fin: lemn + "Sezut tapitat". | toate | Apare slider-ul. Stilul trece in Depozitare. |
| BATHROOM_VANITY | Dim: 60-200 (min 120 la DOUBLE), 50-95 (min 80 la FLOOR), 40-60. Str: lavoare SINGLE/DOUBLE (+ nota instalatii). Dep: DRAWERS/DOORS/OPEN, cu acelasi vocabular ca zonele de cabinet (sertarele/usile per lavoar = parti 3D). Des: stil deschidere (`vanity.handles`), ascuns la OPEN. Baza: montaj WALL/FLOOR + inaltime de la podea 10-60 cm la WALL. Fin: lemn + blat LIGHT/DARK. | toate cele 5 optiuni, `mountingHeightM`, numerele fixe per lavoar | Select → chips. Acelasi control "Stil deschidere" ca la cabinete. Previzualizare ridicata la WALL. Note la DOUBLE/FLOOR. |
| ENTRYWAY | Dim: 80-240 / 160-240 / 35-55. Str: cuiere 2-6 (stepper), oglinda NONE/LEFT/RIGHT, polita superioara. Dep: pantofar OPEN/DOORS (usile = parte 3D). Des: afisare "Usi cu maner" la DOORS. Fin: lemn + "Sezut tapitat". | toate; usi = ceil(L/0,6); sistem MANER la DOORS | Nu se adauga alegerea push/maner (D3b). |
| SOFA | Dim: latime (min = locuri × 50 + brate), inaltime 75-105, adancime corp 80-115, adancime totala sezlong 135-200 (cu sezlong), adancime totala afisata. Str: locuri 2-4 (stepper), forma STRAIGHT/CHAISE_LEFT/CHAISE_RIGHT cu icon, brate SLIM/WIDE, perne SPLIT/BENCH (BENCH ascuns la sezlong). Baza: stejar/nuc/negru/soclu (swatch-uri). Fin: tesatura (textura + paleta + proprie) + fermitate. | toate campurile `sofa` si `upholstery`; `finish: STEJAR` stocat ramane neatins (exempt) | Color input brut → paleta + culoare proprie. Note pentru latime si perne. |
| ARMCHAIR | Dim: 70-130 (min 74/94 dupa brate), 75-105, 80-115. Str: brate. Baza. Fin: tesatura + fermitate. | toate | ca la SOFA |
| OTTOMAN | Dim: 40-140, 35-50, adancime 40-140 (afisata cu motiv la ROUND). Str: forma. Dep: "Cu lada" (toggle; capacul = parte 3D). Baza. Fin: tesatura + fermitate. | toate | ca la SOFA |

Pentru toate corpurile, in vederea firmei: acelasi rezumat, hint corect, fapte per sectiune, acelasi buton "Deschide tot" si textul `describePieceConfig` identic cu cel de azi.

---

## 5. Compatibilitate si migrare

### 5.1 Date: nicio migrare

Nu se schimba nimic din urmatoarele: `PieceConfig3d`, `pieceConfig3dSchema`, normalize (diff golden zero), dimensiunile canonice, flow-urile v1-v3 si catalog v1, `CURRENT_FLOW_VERSION`, draftul Studio v3, `request_studio_scenes`, `answers.config3d`, enum-ul Prisma `room_type`.

Nu exista migrare Prisma, backfill sau re-scorare din admin.

### 5.2 Adaptoarele pentru cele trei forme vechi

| Forma veche | Adaptor | Garantie |
|---|---|---|
| A / A' (cabinete pe coloane, inclusiv SIDEBOARD/WALL_CABINET, plus zonele legacy SHELVES/HANGING/TILT_OUT) | `capabilities/cabinet.ts` + `legacy-grid-ops.ts` (mutat neschimbat); `readPieceForEdit` trimite datele pre-R5.3 in starea `repairable` | paritate de editare prin constructie; testul golden pe operatii |
| B (BED/TABLE/BENCH: obiect tipizat, dimensiuni derivate) | `capabilities/furniture.ts` cu binding-uri pe `bed.*`/`table.*`/`bench.*` si afisari pentru dimensiunile canonice | V1 la margini; `validFurnitureConfig` 1e-6 neatins |
| C (VANITY/ENTRYWAY/SOFA/ARMCHAIR/OTTOMAN: obiect + upholstery) | `capabilities/catalog.ts` cu binding-uri pe obiectul familiei; `readPieceForEdit` prinde exceptia aruncata de `.parse()` → `unreadable` | V1/V2; `validCatalogOptions` (egalitate exacta) neatins |

Draftul Studio v2 trece deja prin normalize in `readStudioDraftData`. Scenele legacy fara mapare raman citite de `readRequestStudioSceneData`. Corpusul golden le include pe amandoua.

### 5.3 Flow-uri FROZEN

Programul de baza nu atinge niciun fisier de flow. Testele `v3.test.ts:30-45` si `furniture.test.ts:53-60` raman verzi. Pasii ortogonali raman unde sunt: material, materialOther, openingSystems, doorType ascuns, tvSetup, cableManagement, count, sketch, snapshot3d ascuns.

Versiuni noi de flow (`guided-pieces/v4.ts` pentru cele 10 corpuri originale, `catalog-v2.ts` pentru cele 7) apar **doar** pe pista de date (5.8), dupa decizia PO.

### 5.4 Publicare

`studio-transfer.ts` si `studio-publication.ts` nu se schimba logic. Doua conditii pastreaza identitatea:
- `applyControl` se termina mereu in `normalizePieceConfig`, cu V4 testat pe toate cele 17 corpuri;
- panoul nu scrie la montare (V6).

Altfel, o scriere implicita marcheaza camera ca modificata, sterge `snapshot3d`, pune `completed=false` si face publicarea sa esueze cu `CONFIGURATOR_ANSWERS_INVALID`.

Singura adaugire in transfer: ataseaza PNG-ul din cache la potrivirea hash-ului (3.9). NIGHTSTAND count ONE ramane neschimbat.

### 5.5 Vederea firmei si PDF

- **Vederea firmei**: `room-spec-card`, `room-answer-summary` si `piece-viewer` citesc orice config dialect 3, inclusiv cererile vechi, pentru ca rezumatul, hint-ul si faptele se calculeaza la citire. `request_items.description` ramane octet cu octet (V7). Firmele primesc PNG mai des, pentru ca vin si piesele din Studio.
- **PDF**: niciun PDF nu consuma `PieceConfig3d`; `quote-pdf.service.ts` randeaza doar liniile ofertei. Nu e nimic de adaptat.

### 5.6 Sizing si credite

Raman identice, cu iesirea blocata de testul golden per fixture:
- `deriveRoom`, adica `lengthM` (latime × cantitate la v3, latime la catalog, salteaua la pat);
- `collectScoreEntries`, adica ROOM_SIZE, ITEM_QUANTITY (×2 la noptiere pereche), MATERIAL si SYSTEM (MANER/PUSH/GLISANTE din frontStyle, vanity.handles, entryway);
- WARDROBE_TO_CEILING, BED_STORAGE, TABLE_EXTENDABLE.

Re-scorarea din admin (`admin-sizing.service.ts:116`) da aceleasi rezultate. Ponderile pentru cele 7 corpuri noi raman DECIZIE NECESARA deschisa (D9); nu blocheaza acest program.

### 5.7 Comutator, ordinea loturilor si rollout

- **Comutatorul** `NEXT_PUBLIC_PIECE3D_PANEL = legacy | unified`. E de build-time, deci fiecare slot blue/green il are pe al lui. E citit de **un singur** hook, `useUnifiedConfigurator()`, pe care il consuma pasul de cerere, `PieceEditorDialog` si `piece-viewer` impreuna [MIG]. Override `?panel=legacy|unified` exista doar pe `/dev/piece-3d` si pe staging.
- **Dezvoltare pe loturi** (doar pe dev/staging, cu porti de paritate; clientii nu le vad), restranse la trei [judecata MIG]:
  1. **L-A** corpurile fara grila: BED, TABLE, BENCH, BATHROOM_VANITY, ENTRYWAY, SOFA, ARMCHAIR, OTTOMAN.
  2. **L-B** grila simpla: NIGHTSTAND, SHOE_CABINET, WALL_CABINET, SIDEBOARD, DRESSER, TV_UNIT, DESK.
  3. **L-C** grila complexa: BOOKCASE, WARDROBE (glisante, bara, slideTo, lacate).

  Poarta fiecarui lot: golden verde, paritatea de editare legacy ⇔ unified, e2e pe ambele valori ale comutatorului (matrice CI), diff vizual cu `tools/capture-furniture-gallery.mjs`, `tools/verify-3d-mechanics.mjs` si bugetele de performanta.
- **Productie**, toate cele 17 deodata [UCS + judecata]:
  1. Release 1 livreaza codul cu `legacy` pe prod si `unified` pe staging.
  2. Release 2 trece prod la `unified`: build pe slotul standby, smoke-test, switch.
  3. O saptamana de monitorizare (erori FE, `CONFIGURATOR_ANSWERS_INVALID`, rata de PNG la cererile noi).
  4. Release 3 sterge codul legacy si comutatorul.
- **Rollback**: se trece inapoi pe slotul blue/green anterior. E sigur in orice moment, pentru ca forma datelor nu s-a schimbat.

### 5.8 Pista de date (optionala, doar cu aprobarea PO)

Pentru fiecare optiune noua aprobata (vezi D3):

1. Campul nou e **optional si aditiv**, cu precedentul archive/13 T1.
2. `schemaRev` se adauga pe pasul `configurator-3d`, iar `pieceConfig3dSchemaRev(kind, 1)` e o copie inghetata a schemei de azi. Rev2 ⊇ rev1, testat pe corpus.
3. `engine.ts:129` alege validatorul dupa `step.schemaRev`.
4. Se adauga flow-uri noi: `guided-pieces/v4.ts` si/sau `catalog-v2.ts` (fabrica `universalPieceFlow(kind, rev)`), inregistrate langa cele vechi, cu `CURRENT_FLOW_VERSION` si testele actualizate impreuna.
5. Rollout in doi pasi: **R** = cititorii pe AMBELE sloturi, cu scriitorii opriti; **W** = comutatorul care afiseaza controlul nou. Dupa W, rollback-ul pe un slot fara R e interzis.
6. **Regula de transfer** [judecata]: o piesa din Studio care poarta campuri rev2 se poate transfera doar in camere create pe `CURRENT_FLOW_VERSION` (rev2). O camera existenta v3 (rev1) e refuzata **din UI**, cu mesaj clar, nu cu `CONFIGURATOR_ANSWERS_INVALID` la publicare.
7. Draftul Studio ramane v3 cat timp campurile sunt optionale.
8. Se actualizeaza CHANGELOG, Codex si docs/07.

Estimare: 2-4 zile per optiune aprobata, cu versiuni de flow incluse.

---

## 6. Plan de implementare pe faze

Regula CLAUDE.md: inainte de fiecare faza se declara modulele, tabelele afectate (aici: **niciuna**) si presupunerile. Dupa fiecare faza se actualizeaza CHANGELOG.md si checklist-ul de acceptare, iar Codex (FE piece3d, FE configurator, FE studio, SHARED piece3d model) se actualizeaza la final. Fiecare faza se inchide cu `pnpm typecheck`, `pnpm lint` si testele indicate.

Modelul Claude per lot: **Opus** pentru model, adaptoare, geometrie, canvas, identitate si transfer; **Sonnet** pentru controale UI, i18n, e2e si documentatie.

### Faza 0 — Plasa de siguranta (2,5 zile) — Opus

- **Creare** `packages/shared/src/questionnaire/piece3d/__fixtures__/`, un corpus de ~200 de configuri:
  - default/min/max pentru fiecare corp si fiecare valoare de enum;
  - cuplajele DOUBLE, FLOOR, ROUND, CHAISE, 4 locuri, EXTENDABLE→COFFEE, sertare peste 1,6 m, bara sub 55 cm;
  - zone legacy SHELVES/HANGING/TILT_OUT, drafturi Studio v2, scene legacy fara mapare, configuri malformate de familie B/C.
- **Creare** `piece3d/golden.test.ts`: per fixture, snapshot JSON pentru normalize, verdictul schemei, `describePieceConfig`, `deriveRoom` (v3, furniture-v3, catalog-v1), `collectScoreEntries`, `pieceConfigTotals`, hash-ul `buildPanels` (numar + bbox + hash stabil) si `buildZoneBoxes`.
- **Creare** `piece3d/identity.test.ts` (V4: idempotenta + `JSON.stringify` stabil).
- **Creare** `apps/frontend/e2e/helpers/piece-controls.ts` (`setDimension`, `chooseOption`, `toggleOption`, `pickFinish`), care acopera ambele generatii de selectori [MIG].
- Se inregistreaza baseline-urile: e2e (`catalog-furniture`, `furniture-quality`, `studio*`), `tools/verify-3d-mechanics.mjs`, fixture-urile de performanta si `tools/capture-furniture-gallery.mjs`.
- **Teste**: `pnpm -F shared test`, BE `studio-publication.spec.ts` + `configurator.service.spec.ts`, FE vitest.

### Faza 1 — Modelul de capabilitati in shared (5,5 zile) — Opus

- **Creare** `piece3d/limits.ts`; normalize din `catalog-config.ts`, `furniture-config.ts` si `config.ts` (mountingHeight WALL_CABINET) il consuma. Acceptare **doar** cu diff golden zero.
- **Creare** `piece3d/capabilities/`:
  - `types.ts`, `bindings.ts`;
  - `legacy-grid-ops.ts`, cu corpurile din `configurator3d-step.tsx:391-511` mutate neschimbat; componenta veche le importa de aici;
  - `cabinet.ts`, pentru cele 9 corpuri pe coloane, din `PIECE3D_RULES`, `NEW_PIECE_RULES`, `resolvePieceLayout` si helper-ele de plafon;
  - `furniture.ts` (BED/TABLE/BENCH), `catalog.ts` (cele 5);
  - `resolve.ts` (`resolveControls`, `applyControl`, `applyStructure`, diff-ul de ajustari, `readPieceForEdit`, `resetPiece`);
  - `summary.ts` (`pieceSummary`), `index.ts`.
- **Creare** `piece3d/parts.ts` (`buildPartBoxes` langa `buildZoneBoxes`, doar randare).
- **Modificare** `piece3d/index.ts` (exporturi). Comentariu pe `PIECE3D_RULES.TABLE`.
- **Teste**:
  - `capabilities.test.ts` (V1, V2, V3 ca poarta, V5);
  - `read.test.ts` (cele 4 stari; `ok` = aceeasi referinta);
  - `parts.test.ts` (V8);
  - paritatea `legacy-grid-ops` cu golden-ul pe operatii.

### Faza 2 — Primitive UI (2,5 zile) — Sonnet

- **Creare**:
  - `components/ui/dimension-field.tsx`, `count-stepper.tsx`, `swatch-group.tsx`;
  - `filter-chips.tsx` extins cu `semantics="radio"`;
  - `components/ui/toggle-field.tsx` (pe Switch + Field);
  - `lib/webgl.ts` (`detectWebGl` cu cache).
- **Modificare** `finishes.ts`: `CUSTOM_COLOR_DEFAULT`, paleta de tesatura cu 12 culori.
- **Teste** RTL: commit, Escape, blur, nume accesibile distincte, `aria-valuetext`, sageti si roving tabindex, tinte de 44px. Se extinde `accessibility.test.tsx`.

### Faza 3a — Panoul universal: cadru si controale (4 zile) — Sonnet

- **Creare** `components/configurator/piece3d/universal/`:
  - `piece-configurator.tsx`, `section-card.tsx`, `summary-bar.tsx`, `section-tabs-mobile.tsx`;
  - `adjustment-notice.tsx`, `recover-alert.tsx`, `use-config-history.ts` (undo/redo cu comasare per gest), `use-panel-layout.ts`;
  - `controls/{control-renderer, fabric-picker, readout}.tsx`.
- **Modificare**:
  - `configurator3d-step.tsx`: dispatcher + `useUnifiedConfigurator()`;
  - `dynamic.tsx`: Skeleton;
  - `app/[locale]/dev/piece-3d/page.tsx`: `?panel=`;
  - `messages/ro.json` + `en.json`: `Configurator.piece.*`.
- **Teste** `piece-configurator.test.tsx`:
  - randare pentru toate 17;
  - ordinea sectiunilor;
  - ascuns ≠ dezactivat;
  - V6 "fara onChange la montare" pe tot corpusul;
  - stari `repairable` / `unreadable`;
  - comasarea undo;
  - paritatea cheilor RO/EN.

### Faza 3b — Panoul universal: structura si plan 2D (3 zile) — Opus

- **Creare**:
  - `universal/structure-editor.tsx`: extras ca atare din toolbar-ul de zona + grila din modul campuri, restilizat dupa paritate;
  - Depozitare contextuala cu "Toata piesa", lista de parti;
  - `universal/elevation-map.tsx`: SVG interactiv, parti = butoane.
- **Teste**: paritatea editarii legacy ⇔ unified pe L-A/L-B/L-C (aceleasi operatii → acelasi JSON), plafoanele live, regulile de ascundere, ElevationMap cu tastatura.

### Faza 4 — Comportament 3D unificat (3 zile) — Opus

- **Modificare**:
  - `piece-canvas.tsx`: parti pentru toate corpurile, `onPartClick`, "Deschide tot" + "Incadreaza" pe toate, grup ridicat cu plan de perete si linie de podea, `buildPanels` memoizat o data, incadrare care include elevatia;
  - `use-cabinet-fronts.ts`: `openAll`;
  - `furniture-motion.tsx`: deschidere per parte;
  - `stable-orbit-camera.tsx`: reframe doar la actiune explicita sau la schimbarea corpului.
- **Teste**:
  - se extind `use-cabinet-fronts.test.ts` si testele de tween;
  - `tools/verify-3d-mechanics.mjs` pe unified: camera identica dupa editari, durate, reduced motion, secventierea glisantelor;
  - fixture-urile de performanta (70/600 draws, p95 40/85 ms, 0 draws in repaus, heap 180 MB, dispose).

### Faza 5 — Studio (3 zile) — Sonnet (UI) + Opus (cache PNG si transfer)

- **Modificare** `studio-page.tsx`:
  - `PieceEditorDialog` pe `ui/Dialog`, cu garda de modificari, ecran complet pe telefon;
  - picker grupat dupa `category`;
  - antet cu "{n} plasari";
  - `onSnapshot`;
  - collision inline;
  - `LibraryRow` cu rezumat.
- **Modificare** `stores/studio-store.ts`: cache PNG de sesiune, LRU 60, nepersistat.
- **Modificare** `stores/studio-transfer.ts`: ataseaza PNG-ul la potrivirea hash-ului.
- **Modificare** `configurator-store.ts` (`snapshots3d`).
- **Modificare** `room-canvas.tsx`, `house-editor.tsx`, `room-viewer.tsx` → `lib/webgl.ts`.
- **Teste**:
  - `studio-transfer.test.ts`: PNG cu hash potrivit / nepotrivit; deep-equal neschimbat; nicio scriere fara editare;
  - `studio-compatibility.test.ts`, `studio-collisions.test.ts`, verzi si neschimbate;
  - e2e nou pentru garda de modificari si pentru PNG-ul din Studio.

### Faza 6 — Vederea firmei (1,5 zile) — Sonnet

- **Modificare**:
  - `piece-viewer.tsx`: `viewerHint` si fapte din capabilitati, "Deschide tot", fundalul nu inchide dupa drag, rezumat in antet;
  - `config-chips.ts`: wrapper peste `pieceSummary`, vocabular unificat;
  - `room-spec-card.tsx`, `room-answer-summary.tsx`.
- **Teste**: `room-spec-card.test.tsx`, `review-room-card.test.tsx`; BE `studio-publication.spec.ts` + `configurator.service.spec.ts` re-rulate neschimbate.

### Faza 7 — e2e, CI, documentatie (3 zile) — Sonnet

- **Migrare** `e2e/catalog-furniture.spec.ts`, `furniture-quality.spec.ts`, `studio.spec.ts`, `studio-panels.spec.ts` pe helper-e.
- **Creare** `e2e/universal-panel.spec.ts`. Ruleaza pe 17 corpuri × {desktop 1280, telefon 375} si verifica:
  - min/max pentru fiecare control numeric, dus-intors in JSON-ul de pe pagina dev;
  - fiecare optiune de enum;
  - PNG-ul;
  - lipsa overflow-ului orizontal si tintele ≥ 44px;
  - modul 2D fara WebGL (stub);
  - drumul de tastatura prin ElevationMap.
- **Modificare** `tools/verify-3d-mechanics.mjs`, `tools/capture-furniture-gallery.mjs`.
- **CI**: matrice pe `NEXT_PUBLIC_PIECE3D_PANEL = legacy | unified` (`.github/workflows/ci.yml`).
- **Documentatie**: CHANGELOG.md, checklist de acceptare, `docs/implementation/universal-configurator.md` (starea livrata), notele Codex.

### Faza 8 — Comutare in productie si curatenie (1 zi + 1 saptamana calendaristica) — Sonnet

- Release 2 trece prod la `unified`, urmat de o saptamana de monitorizare.
- Release 3:
  - **Stergere** `furniture-controls.tsx`, `catalog-controls.tsx`, corpul `CabinetControls`, comutatorul, matricea CI, cheile `config3d.furniture.*`, `config3d.catalog.*` si duplicatele.
  - Selectorii vechi se scot din helper-ele e2e.
- **Teste**: tot setul, pe o singura valoare.

### Rezerva

1,5 zile pentru QA mobil pe dispozitive reale: iOS Safari cu bara de adresa, Android mid-range, landscape.

### Total

| Faza | Zile | Model |
|---|---|---|
| 0 Plasa de siguranta | 2,5 | Opus |
| 1 Capabilitati in shared | 5,5 | Opus |
| 2 Primitive UI | 2,5 | Sonnet |
| 3a Panou: cadru si controale | 4 | Sonnet |
| 3b Panou: structura si plan 2D | 3 | Opus |
| 4 Comportament 3D | 3 | Opus |
| 5 Studio | 3 | Sonnet + Opus |
| 6 Vederea firmei | 1,5 | Sonnet |
| 7 e2e, CI, documentatie | 3 | Sonnet |
| 8 Comutare + curatenie | 1 | Sonnet |
| Rezerva QA mobil | 1,5 | — |
| **Total program de baza** | **30,5** | |

In afara totalului, doar dupa decizia PO:
- preset-uri: 1,5 zile (D7);
- inspector compact in camera Studio: 3-4 zile (D8);
- pista de date: 2-4 zile per optiune (D3);
- backfill PNG offscreen in pasul de revizie, cu un singur canvas reutilizat secvential, timeout si plafon N, care nu blocheaza niciodata publicarea: 1,5 zile (optional; riscul de context WebGL pe telefoane e mare).

---

## 7. Riscuri

| # | Risc | Impact | Mitigare |
|---|---|---|---|
| R1 | Scriere implicita la montare sau o cheie in plus fata de normalize (`undefined`, alta ordine) | camere marcate modificate, PNG pierdut, `completed=false`, publicare respinsa | `readPieceForEdit` fara scriere; testele V4 + V6 pe tot corpusul; totul trece prin normalize |
| R2 | Extragerea limitelor in `limits.ts` muta o valoare cu 1 mm | paturi, mese, canapele salvate devin invalide (1e-6 / egalitate exacta) | acceptare doar cu diff golden zero; V1 la margini |
| R3 | Regresie in editarea grilei (lacate, glisante, slideTo, sertare peste 1,6 m) | dulapuri si biblioteci stricate | operatii mutate neschimbat; lotul L-C ultimul; paritatea legacy ⇔ unified; verify-3d-mechanics |
| R4 | e2e si scripturile depind de numele accesibile actuale | CI rosu sau acoperire pierduta pe ascuns | helper-e pentru ambele generatii; matrice CI; `title` pe swatch-uri; spec-ul universal pe 17 corpuri × 2 viewport-uri |
| R5 | Parti, overlay-uri si elevatie cresc numarul de draw calls sau strica stabilitatea camerei | buget de performanta depasit, camera sare | hitbox-uri invizibile comasate; un singur `buildPanels`; fara key pe Canvas; reframe doar explicit; bugetele rulate in Faza 4 |
| R6 | Layout pe telefon: canvas sticky + orbit cu un deget captureaza scroll-ul; bara iOS | experienta proasta pe mobil | `clamp(260px,42svh,400px)`, `touch-action:none` doar pe canvas, buton "Ascunde previzualizarea", QA pe dispozitive reale |
| R7 | Cache-ul PNG din Studio creste in memorie sau ataseaza o poza veche | memorie, poza gresita la firma | LRU 60, hash pe JSON normalizat, niciodata in draft; nepotrivire = nicio poza (ca azi) |
| R8 | Unificarea WebGL schimba ce dispozitive primesc 3D | regresie pe dispozitive vechi | fiecare consumator isi declara nivelul; criteriile de azi pastrate |
| R9 | Comutator divergent intre suprafete | revine inconsecventa reclamata de PO | un singur hook pentru wizard, Studio si vedere; prod comuta toate 17 deodata |
| R10 | Starea `repairable`/`unreadable` blocheaza un pas pana la click | client confuz pe date vechi | mesaj clar, un singur click; azi cabinetele pierd datele fara sa spuna nimic, iar mobila ramane blocata |
| R11 | Previzualizarea ridicata schimba PNG-ul pentru WALL_CABINET / lavoarul WALL | firma vede o poza diferita de cererile vechi | consecvent cu vederea 3D a firmei din camera; mentionat in CHANGELOG |
| R12 | Extinderea scope-ului cu optiuni noi in timpul unificarii | programul devine o migrare versionata | optiunile noi doar pe pista de date, dupa decizii PO |
| R13 | Blue/green: un camp nou (pista de date) scris inainte ca slotul standby sa-l citeasca | drafturi respinse pe standby | rollout R → W; rollback interzis dupa W; programul de baza nu are campuri noi |

---

## 8. DECIZIE NECESARA (doar decizii de produs)

| # | Intrebare | Recomandare |
|---|---|---|
| D1 | **Explicatii.** Panoul arata o nota scurta cand o regula **schimba o valoare** ("Latimea a crescut la 224 cm ca sa incapa 4 locuri", "Masa extensibila e doar de dining; am trecut la dreptunghiulara"). Vreti si un motiv pentru **optiunile ascunse** ("Sertarele se pun doar sub 1,60 m", "Bara de haine cere minimum 55 cm adancime")? | **Da** pentru notele despre valori schimbate (nu redeschid decizia "ascuns"). **Nu acum** pentru motivele optiunilor ascunse: pastram decizia existenta; doar `slidingNeeds` ramane. |
| D2 | **Stilul de deschidere pe piese fara fronturi** (de ex. biblioteca toata deschisa). Daca il ascundem, valoarea stocata (implicit PUSH) ajunge totusi la firma ca sistem MANER/PUSH, fara ca clientul sa o vada. | **Ascundem** (consecvent cu regula optiunilor ascunse). Azi oricum se trimite valoarea implicita cand clientul nu o atinge. Corectura (sa nu mai derivam sistemul fara fronturi) se face doar intr-un viitor flow v4. |
| D3 | **Optiuni noi care cer campuri noi** (fiecare = versiune noua de flow + rollout in doi pasi): (a) culoare de tesatura aleasa separat la patul si banca tapitate; (b) Push / Cu maner la usile holului; (c) numarul de sertare/usi la lavoar (azi fix 2 per lavoar); (d) baza/picioare la pat, masa, banca. | **Amanare.** Panoul universal nu are nevoie de ele. Dupa lansare, (a) e candidatul cu cea mai mare valoare pentru client. |
| D4 | **Intrebarea dubla la BOOKCASE / TV_UNIT / DRESSER**: clientul alege Push/Cu maner in 3D si e intrebat din nou in pasul "Sisteme de deschidere". | **Pastram acum** (flow-urile sunt FROZEN). Scoaterea pasului intr-un flow v4 se decide impreuna cu D3. |
| D5 | **Piesa plasata de mai multe ori in Studio**: salvarea modifica toate copiile. | **Pastram**, cu avertismentul vizibil "Modificarile se aplica tuturor celor {n} plasari". "Salveaza ca piesa noua" vine intr-o iteratie ulterioara. |
| D6 | **Gruparea picker-ului din Studio**: Depozitare (biblioteca, dulap, comoda TV, pantofar, comoda, noptiera, bufet, corp suspendat) / Mese si lucru (masa, birou) / Odihna si sezut (pat, canapea, fotoliu, taburet, banca) / Baie si hol (lavoar, hol). | **Aprobare** a numelor si repartizarii asa cum sunt. |
| D7 | **Preset-uri de pornire** (2-4 per corp, de ex. dulap "Usi + sertare" / "Glisant 3 coloane" / "Pana la tavan"; canapea "3 locuri" / "Coltar stanga"). | **Nu in prima livrare.** Daca le vreti, aprobati lista RO/EN; costa ~1,5 zile. |
| D8 | **Inspector rapid in camera Studio** (Dimensiuni + Finisaj direct in panoul piesei, fara dialog). | **Mai tarziu**, ca faza separata (3-4 zile), dupa ce panoul universal e stabil. |
| D9 | **Ponderile de sizing (credite) pentru cele 7 corpuri noi** (decizie deja deschisa in `furniture-catalog-2026-10-02.md`): mostenesc ponderea PIECES sau raman 0? | Nu blocheaza acest program. **Recomandare: mostenesc ponderea PIECES**, ca firmele sa nu primeasca aceste cereri la cost minim. Trebuie decis inainte de lansare. |
