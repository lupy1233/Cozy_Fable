import * as fs from 'fs';
import * as path from 'path';
import {
  collectScoreEntries,
  defaultPieceConfig,
  ETAPA10_FLOW_VERSION,
  ETAPA6_FLOW_VERSION,
  normalizePieceConfig,
  validateRoomAnswers,
  type AnswerMap,
  type PieceConfig3d,
  type RoomType,
} from '@marketplace/shared';
import { computeSizing, type SizingConfigRow } from './sizing.service';

// Etapa 10 (DESIGN §7e, formularul v7) — "diferenta explicata": cereri tipice punctate pe versiunea de azi
// (etapa 6) si pe versiunea noua, cu ponderile reale din prisma/seed.ts (SIZING_CONFIG, inclusiv randurile
// noi ale migrarii 20261115100000) si functia reala de scor (computeSizing). Fara buget / proiectare →
// scorul de baza = costul.
// Pragurile verificate in mapping.ts: ROOM_SIZE < 2 m UNDER_2M, 2..4 m (inclusiv) FROM_2_TO_4M, peste 4 m
// OVER_4M; ITEM_QUANTITY 1 / 2-3 / 4+.
// Regula PO c9-3: doar "fara corpuri suspendate" (scade, prin piesa care dispare — nu exista puncte
// negative) si canapeaua extensibila (creste) schimba costul; d3: canapeaua primeste puncte pe locuri /
// sezlong; restul valorilor noi au 0 puncte. c5-3 / d3: la balcon / spalatorie / debara marimea vine din
// latimea pieselor, peretele / balconul e doar informativ.
// Dupa revizuire (coordonator, 2026-11-14):
// - balcon / spalatorie / debara v4: marimea = min(suma latimilor pieselor, "peretele" de pe v3) → costul nu
//   poate creste fata de v3 (cazurile I, J, K); B, C, F raman la fel;
// - patul 3D "Alta marime" (PIECE_BED v5): latimea pentru scor e plafonata la 1,8 m (cazul L);
// - dressingul walk-in v5: latura C intra in marime (cazul H; DE CONFIRMAT DE PO).

const SEED_SRC = fs.readFileSync(path.join(__dirname, '../../../prisma/seed.ts'), 'utf8');
const SEED_WEIGHTS: SizingConfigRow[] = [
  ...SEED_SRC.matchAll(/\{\s*key:\s*'([A-Z0-9_]+)',\s*option:\s*'([A-Z0-9_]+)',\s*weight:\s*(-?\d+)\s*\}/g),
].map((m) => ({ key: m[1], option: m[2], weight: Number(m[3]) }));

const OLD = (rt: RoomType) => ETAPA6_FLOW_VERSION[rt];
const NEW = (rt: RoomType) => ETAPA10_FLOW_VERSION[rt];

function cost(roomType: RoomType, version: number, answers: AnswerMap): number {
  // raspunsurile trebuie sa fie o cerere publicabila pe versiunea respectiva
  expect(validateRoomAnswers(roomType, answers, { partial: false, version })).toEqual({ ok: true });
  return computeSizing(SEED_WEIGHTS, [{ size: 'S', minScore: 0, maxScore: null }], {
    scoreEntries: collectScoreEntries(roomType, answers, version),
    budgetRange: 'UNDISCLOSED',
    includesPaidDesign: false,
  }).baseScore;
}

const sofa = (sofaOpts: Record<string, unknown>, widthM: number): PieceConfig3d => {
  const base = defaultPieceConfig('SOFA');
  return normalizePieceConfig('SOFA', { ...base, widthM, sofa: { ...base.sofa!, ...sofaOpts } } as PieceConfig3d);
};

describe('etapa 10 — diferenta de scor explicata (versiunea de azi fata de formularul v7)', () => {
  const w = (key: string, option: string) => SEED_WEIGHTS.find((r) => r.key === key && r.option === option)?.weight;

  it('ponderile folosite sunt cele din seed (vechi + randurile noi ale canapelei)', () => {
    expect([w('ROOM_TYPE', 'KITCHEN'), w('ROOM_TYPE', 'BALCONY'), w('ROOM_TYPE', 'LAUNDRY'), w('ROOM_TYPE', 'PIECE_SOFA')]).toEqual([8, 2, 2, 3]);
    expect([w('SOFA_SEATS', 'SEATS_2'), w('SOFA_SEATS', 'SEATS_3'), w('SOFA_SEATS', 'SEATS_4')]).toEqual([0, 1, 2]);
    expect([w('SOFA_LAYOUT', 'STRAIGHT'), w('SOFA_LAYOUT', 'CHAISE_LEFT'), w('SOFA_LAYOUT', 'CHAISE_RIGHT')]).toEqual([0, 1, 1]);
    expect([w('SOFA_SLEEPER', 'YES'), w('SOFA_STORAGE', 'YES')]).toEqual([2, 0]);
    expect([w('KITCHEN_WALL_CABINETS', 'NO_WALL_CABINETS'), w('KITCHEN_WALL_CABINETS', 'WALL_CABINETS')]).toEqual([0, 0]);
  });

  // bucatarie dreapta 3 m, PAL, Maner peste tot, fara insula, blat PAL
  const KITCHEN = {
    layout: 'STRAIGHT', hasIsland: false, dimensions: { runA: 3, ceilingHeight: 2.6 },
    frontMaterialBase: 'PAL', openingSystemsBase: ['MANER'], countertop: 'PAL',
  };

  it('A — bucatarie "Fara corpuri suspendate": 18 → 14', () => {
    // v4: KITCHEN 8 + FROM_2_TO_4M 3 + QTY_2_3 2 + STRAIGHT 1 + (PAL 1 + MANER 1) × 2 = 18
    expect(cost('KITCHEN', OLD('KITCHEN'), { ...KITCHEN, openingSystemsWall: ['MANER'] })).toBe(18);
    // v5: 8 + 3 + QTY_1 0 + 1 + PAL 1 + MANER 1 + NO_WALL_CABINETS 0 = 14
    // cauza: piesa "Corpuri suspendate" nu se mai creeaza (−PAL −MANER = −2) si cantitatea scade la o piesa (−2) → −4
    expect(cost('KITCHEN', NEW('KITCHEN'), { ...KITCHEN, wallCabinets: 'NO_WALL_CABINETS' })).toBe(14);
  });

  it("A' — aceeasi bucatarie cu corpuri suspendate + chiuveta + frigider incorporabil: 18 → 18", () => {
    const answers = {
      ...KITCHEN, openingSystemsWall: ['MANER'], wallCabinets: 'WALL_CABINETS',
      sinkMounting: 'UNDERMOUNT', sinkMaterial: 'COMPOSITE', appliances: ['FRIDGE'], fridgeType: 'BUILT_IN',
    };
    // cauza: randurile noi (KITCHEN_WALL_CABINETS / SINK_* / FRIDGE) au 0 puncte → 0
    expect(collectScoreEntries('KITCHEN', answers, NEW('KITCHEN'))).toEqual(expect.arrayContaining([
      { category: 'KITCHEN_WALL_CABINETS', optionKey: 'WALL_CABINETS' },
      { category: 'KITCHEN_SINK_MOUNTING', optionKey: 'UNDERMOUNT' },
      { category: 'KITCHEN_SINK_MATERIAL', optionKey: 'COMPOSITE' },
      { category: 'KITCHEN_FRIDGE', optionKey: 'BUILT_IN' },
    ]));
    expect(cost('KITCHEN', NEW('KITCHEN'), answers)).toBe(18);
  });

  it('B — balcon 6 m cu un singur raft de 1 m (PAL): 8 → 4', () => {
    const base = { enclosed: 'ENCLOSED', piecesNeeded: ['SHELVES'], materialShelves: 'PAL' };
    // v3: BALCONY 2 + OVER_4M 5 (lungimea balconului, 6 m) + QTY_1 0 + PAL 1 = 8
    expect(cost('BALCONY', OLD('BALCONY'), { ...base, dimensions: { balconyLength: 6, balconyDepth: 1, ceilingHeight: 2.6 } })).toBe(8);
    // v4: 2 + UNDER_2M 1 (latimea raftului, 1 m) + 0 + 1 = 4; fara tavan (nicio piesa inalta)
    // cauza: marimea vine din latimea piesei, balconul e doar informativ (c5-3 / d3) → −4
    expect(cost('BALCONY', NEW('BALCONY'), { ...base, dimensions: { balconyLength: 6, balconyDepth: 1, shelvesWidth: 1 } })).toBe(4);
  });

  it('C — balcon 6 m mobilat (banca 2 m, dulap 1 m, blat 2 m, rafturi 1 m): 17 → 17', () => {
    const base = {
      enclosed: 'ENCLOSED', piecesNeeded: ['STORAGE_BENCH', 'TALL_CABINET', 'WORKTOP', 'SHELVES'], sameFinishAll: false,
      materialStorageBench: 'PAL', systemsStorageBench: ['MANER'], materialTallCabinet: 'PAL', systemsTallCabinet: ['MANER'],
      materialWorktop: 'WORKTOP_PAL_POSTFORMED', materialShelves: 'PAL',
    };
    // v3: 2 + OVER_4M 5 + QTY_4_PLUS 4 + (PAL 1 + MANER 1) × 2 + blat PAL postformat 1 + rafturi PAL 1 = 17
    expect(cost('BALCONY', OLD('BALCONY'), { ...base, dimensions: { balconyLength: 6, balconyDepth: 1, ceilingHeight: 2.6 } })).toBe(17);
    // v4: piesele insumeaza 6 m → OVER_4M; tavanul cerut (dulapul e piesa inalta), inaltimea dulapului lasata goala
    // cauza: acelasi balcon mobilat costa la fel → 0
    expect(cost('BALCONY', NEW('BALCONY'), {
      ...base,
      dimensions: { balconyLength: 6, balconyDepth: 1, storageBenchWidth: 2, tallCabinetWidth: 1, worktopWidth: 2, shelvesWidth: 1, ceilingHeight: 2.6 },
    })).toBe(17);
  });

  it('D — canapea dreapta 3 locuri, 2,2 m: 8 → 9', () => {
    const config3d = sofa({ seats: 3, layout: 'STRAIGHT' }, 2.2);
    expect(config3d.widthM).toBe(2.2);
    // v2: PIECE_SOFA 3 + FROM_2_TO_4M 3 + QTY_1 0 + ALTUL 2 (cadrul il alege firma) = 8
    expect(cost('PIECE_SOFA', OLD('PIECE_SOFA'), { config3d })).toBe(8);
    // v3: 8 + SEATS_3 1 + STRAIGHT 0 = 9
    // cauza: punctele pe configuratie (d3, a doua parte) → +1
    expect(collectScoreEntries('PIECE_SOFA', { config3d }, NEW('PIECE_SOFA'))).toEqual(expect.arrayContaining([
      { category: 'SOFA_SEATS', optionKey: 'SEATS_3' },
      { category: 'SOFA_LAYOUT', optionKey: 'STRAIGHT' },
    ]));
    expect(cost('PIECE_SOFA', NEW('PIECE_SOFA'), { config3d })).toBe(9);
  });

  it('E — canapea 4 locuri cu sezlong, extensibila, cu lada, 2,8 m: 8 → 13', () => {
    const plain = sofa({ seats: 4, layout: 'CHAISE_LEFT' }, 2.8);
    const config3d = sofa({ seats: 4, layout: 'CHAISE_LEFT', sleeper: true, storage: true }, 2.8);
    expect(config3d.widthM).toBe(2.8);
    // v2: 3 + FROM_2_TO_4M 3 + 0 + ALTUL 2 = 8 (pe v2 extensibila / lada nici nu se pot trimite)
    expect(cost('PIECE_SOFA', OLD('PIECE_SOFA'), { config3d: plain })).toBe(8);
    // v3: 8 + SEATS_4 2 + CHAISE_LEFT 1 + SLEEPER 2 + STORAGE 0 = 13
    // cauza: d3 (locuri + sezlong, +3) si canapeaua extensibila (c9-3, +2); lada 0 → +5
    expect(cost('PIECE_SOFA', NEW('PIECE_SOFA'), { config3d })).toBe(13);
  });

  it('F — spalatorie, perete 3 m, doar dulap incastrare 0,7 m (PAL, Maner): 7 → 5', () => {
    const base = {
      applianceSetup: 'WASHER_ONLY', piecesNeeded: ['APPLIANCE_HOUSING'], ventilation: 'WINDOW',
      materialApplianceHousing: 'PAL', systemsApplianceHousing: ['MANER'],
    };
    // v3: LAUNDRY 2 + FROM_2_TO_4M 3 (peretele, 3 m) + QTY_1 0 + PAL 1 + MANER 1 = 7
    expect(cost('LAUNDRY', OLD('LAUNDRY'), { ...base, dimensions: { runA: 3, ceilingHeight: 2.6 } })).toBe(7);
    // v4: 2 + UNDER_2M 1 (latimea dulapului, 0,7 m) + 0 + 1 + 1 = 5
    // cauza: marimea vine din latimea piesei, peretele e doar informativ → −2
    expect(cost('LAUNDRY', NEW('LAUNDRY'), { ...base, dimensions: { runA: 3, applianceHousingWidth: 0.7, ceilingHeight: 2.6 } })).toBe(5);
  });

  it('G — dormitor doar cu pat 160 fara depozitare (lemn masiv): 9 → 9', () => {
    const base = { piecesNeeded: ['BED_FRAME'], bedSize: 'Q_160', bedStorage: 'NONE', bedUpholstered: false, materialBed: 'LEMN_MASIV' };
    // v3: BEDROOM 4 + UNDER_2M 1 (latimea patului, 1,6 m) + QTY_1 0 + LEMN 4 = 9
    expect(cost('BEDROOM', OLD('BEDROOM'), { ...base, dimensions: { ceilingHeight: 2.6 } })).toBe(9);
    // v4: fara pasul de dimensiuni (doar pat → fara tavan), acelasi cost
    // cauza: tavanul dispare, dar nu intra in cost → 0
    expect(cost('BEDROOM', NEW('BEDROOM'), base)).toBe(9);
  });

  // ---------------------------------------------------------------- dupa revizuire
  it('H — dressing walk-in A 1,5 + B 1,5 (glisante, MDF infoliat): 17 → 19 cu C 1,5 m; 17 → 17 cu C 1,0 m', () => {
    const base = { layout: 'WALK_IN', doorType: 'SLIDING', interiorModules: ['SHELVES', 'LED_LIGHTING'], material: 'MDF_INFOLIAT' };
    // v4: DRESSING 6 + FROM_2_TO_4M 3 (A + B = 3 m) + QTY_1 0 + WALK_IN 3 + MDF_INFOLIAT 2 + GLISANTE 3 = 17
    expect(cost('DRESSING', OLD('DRESSING'), { ...base, dimensions: { runA: 1.5, runB: 1.5, wardrobeHeight: 2.4 } })).toBe(17);
    // v5 cu latura C 1,5 m: 4,5 m → OVER_4M 5 → 19
    // cauza: walk-in masoara acum si al treilea perete, iar latura C intra in marime (hotararea coordonatorului) → +2
    expect(cost('DRESSING', NEW('DRESSING'), { ...base, dimensions: { runA: 1.5, runB: 1.5, runC: 1.5, wardrobeHeight: 2.4 } })).toBe(19);
    // v5 cu latura C 1,0 m: exact 4 m → ramane in treapta 2–4 m → 17
    expect(cost('DRESSING', NEW('DRESSING'), { ...base, dimensions: { runA: 1.5, runB: 1.5, runC: 1, wardrobeHeight: 2.4 } })).toBe(17);
  });

  it('I — balcon 1,5 m cu banca 3 m + blat 4 m (piese mai lungi decat balconul): 8 → 8 (plafonat la balcon)', () => {
    const base = {
      enclosed: 'ENCLOSED', piecesNeeded: ['STORAGE_BENCH', 'WORKTOP'],
      materialStorageBench: 'PAL', systemsStorageBench: ['MANER'], materialWorktop: 'WORKTOP_PAL_POSTFORMED',
    };
    // v3: BALCONY 2 + UNDER_2M 1 (balconul, 1,5 m) + QTY_2_3 2 + PAL 1 + MANER 1 + blat PAL postformat 1 = 8
    expect(cost('BALCONY', OLD('BALCONY'), { ...base, dimensions: { balconyLength: 1.5, balconyDepth: 1, ceilingHeight: 2.6 } })).toBe(8);
    // v4: piesele insumeaza 7 m, dar marimea = min(7; 1,5) = 1,5 m → UNDER_2M → 8 (fara plafon ar fi fost OVER_4M, 12)
    // cauza: plafonul la "perete" (revizuire M3) → 0
    const answers = { ...base, dimensions: { balconyLength: 1.5, balconyDepth: 1, storageBenchWidth: 3, worktopWidth: 4 } };
    expect(collectScoreEntries('BALCONY', answers, NEW('BALCONY'))).toContainEqual({ category: 'ROOM_SIZE', optionKey: 'UNDER_2M' });
    expect(cost('BALCONY', NEW('BALCONY'), answers)).toBe(8);
  });

  it('J — spalatorie perete 1,5 m cu dulap incastrare 1,2 m + dulap depozitare 2 m: 9 → 9 (plafonat la perete)', () => {
    const base = {
      applianceSetup: 'WASHER_ONLY', piecesNeeded: ['APPLIANCE_HOUSING', 'STORAGE'], ventilation: 'WINDOW', sameFinishAll: false,
      materialApplianceHousing: 'PAL', systemsApplianceHousing: ['MANER'], materialStorage: 'PAL', systemsStorage: ['MANER'],
    };
    // v3: LAUNDRY 2 + UNDER_2M 1 (peretele, 1,5 m) + QTY_2_3 2 + (PAL 1 + MANER 1) × 2 = 9
    expect(cost('LAUNDRY', OLD('LAUNDRY'), { ...base, dimensions: { runA: 1.5, ceilingHeight: 2.6 } })).toBe(9);
    // v4: piesele insumeaza 3,2 m, dar marimea = min(3,2; 1,5) = 1,5 m → UNDER_2M → 9 (fara plafon: FROM_2_TO_4M, 11)
    expect(cost('LAUNDRY', NEW('LAUNDRY'), {
      ...base, dimensions: { runA: 1.5, applianceHousingWidth: 1.2, storageWidth: 2, ceilingHeight: 2.6 },
    })).toBe(9);
  });

  it('K — debara pe un perete de 1,5 m cu dulapuri de 2,5 m: 5 → 5 (plafonat la perete)', () => {
    const base = { wallsUsed: 'ONE_WALL', storageStyle: 'CLOSED_CABINETS', materialCabinets: 'PAL', systemsCabinets: ['MANER'] };
    // v3: PANTRY 2 + UNDER_2M 1 (peretele, 1,5 m) + QTY_1 0 + PAL 1 + MANER 1 = 5
    expect(cost('PANTRY', OLD('PANTRY'), { ...base, dimensions: { runA: 1.5, ceilingHeight: 2.6 } })).toBe(5);
    // v4: min(2,5; 1,5) = 1,5 m → UNDER_2M → 5 (fara plafon: FROM_2_TO_4M, 7)
    expect(cost('PANTRY', NEW('PANTRY'), { ...base, dimensions: { runA: 1.5, cabinetsWidth: 2.5, ceilingHeight: 2.6 } })).toBe(5);
  });

  it('L — pat 3D "Alta marime" 220 × 200 costa cat patul 180 × 200 (latimea pentru scor plafonata la 1,8 m)', () => {
    const bed = (extra: Record<string, unknown>): PieceConfig3d => {
      const base = defaultPieceConfig('BED');
      return normalizePieceConfig('BED', { ...base, bed: { ...base.bed!, ...extra } } as PieceConfig3d);
    };
    const k180 = { config3d: bed({ mattressSize: 'K_180' }), material: 'LEMN_MASIV' };
    const custom = { config3d: bed({ mattressSize: 'K_180', customSize: { widthM: 2.2, lengthM: 2 } }), material: 'LEMN_MASIV' };
    // v4 / v5 cu 180 × 200: PIECE_BED 2 + UNDER_2M 1 (1,8 m) + QTY_1 0 + LEMN 4 = 7
    expect(cost('PIECE_BED', OLD('PIECE_BED'), k180)).toBe(7);
    expect(cost('PIECE_BED', NEW('PIECE_BED'), k180)).toBe(7);
    // v5 cu 220 × 200: latimea pentru scor min(2,2; 1,8) = 1,8 → UNDER_2M → 7 (fara plafon: FROM_2_TO_4M, 9)
    // cauza: "Alta marime" nu schimba costul (PO c9-3) → 0
    expect(collectScoreEntries('PIECE_BED', custom, NEW('PIECE_BED'))).toContainEqual({ category: 'ROOM_SIZE', optionKey: 'UNDER_2M' });
    expect(cost('PIECE_BED', NEW('PIECE_BED'), custom)).toBe(7);
  });
});
