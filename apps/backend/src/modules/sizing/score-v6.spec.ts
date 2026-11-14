import * as fs from 'fs';
import * as path from 'path';
import {
  collectScoreEntries,
  defaultPieceConfig,
  ETAPA6_FLOW_VERSION,
  FIRM_DECIDES,
  FLOW_VERSIONS_BEFORE_ETAPA6,
  normalizePieceConfig,
  validateRoomAnswers,
  type AnswerMap,
  type RoomType,
} from '@marketplace/shared';
import { computeSizing, type SizingConfigRow } from './sizing.service';

// Etapa 6 (DESIGN §6.4) — "diferenta explicata": cinci cereri tipice, punctate pe versiunea veche si pe
// cea noua a formularului, cu ponderile reale din prisma/seed.ts (SIZING_CONFIG) si functia reala de
// scor (computeSizing). Fara buget / proiectare → scorul de baza = costul.
// Testul sta in backend (nu in packages/shared) pentru ca shared nu poate importa seed-ul si computeSizing.
// Pragurile verificate in mapping.ts: ROOM_SIZE < 2 m UNDER_2M, 2..4 m FROM_2_TO_4M; ITEM_QUANTITY 1 / 2-3 / 4+.
// Toate cifrele din tabelul §6.4 s-au confirmat; la D, configuratia 3D trebuie sa AIBA fronturi
// (o zona cu usi / sertare), altfel pe v4 nu exista niciun sistem (configHasFronts) si scorul ar fi 4, nu 5.

const SEED_SRC = fs.readFileSync(path.join(__dirname, '../../../prisma/seed.ts'), 'utf8');
const SEED_WEIGHTS: SizingConfigRow[] = [
  ...SEED_SRC.matchAll(/\{\s*key:\s*'([A-Z0-9_]+)',\s*option:\s*'([A-Z0-9_]+)',\s*weight:\s*(-?\d+)\s*\}/g),
].map((m) => ({ key: m[1], option: m[2], weight: Number(m[3]) }));

const OLD = (rt: RoomType) => Math.max(...FLOW_VERSIONS_BEFORE_ETAPA6[rt]);
const NEW = (rt: RoomType) => ETAPA6_FLOW_VERSION[rt];

function cost(roomType: RoomType, version: number, answers: AnswerMap): number {
  // raspunsurile trebuie sa fie o cerere publicabila pe versiunea respectiva
  expect(validateRoomAnswers(roomType, answers, { partial: false, version })).toEqual({ ok: true });
  return computeSizing(SEED_WEIGHTS, [{ size: 'S', minScore: 0, maxScore: null }], {
    scoreEntries: collectScoreEntries(roomType, answers, version),
    budgetRange: 'UNDISCLOSED',
    includesPaidDesign: false,
  }).baseScore;
}

describe('etapa 6 — diferenta de scor explicata (versiunea veche fata de cea noua)', () => {
  it('ponderile folosite sunt cele din seed', () => {
    const w = (key: string, option: string) => SEED_WEIGHTS.find((r) => r.key === key && r.option === option)?.weight;
    expect([w('MATERIAL', 'PAL'), w('MATERIAL', 'ALTUL'), w('SYSTEM', 'MANER'), w('SYSTEM', 'PUSH'), w('SYSTEM', 'GLISANTE')]).toEqual([1, 2, 1, 2, 3]);
  });

  it('A — hol: cuier 1,0 m + oglinda 0,6 m: 10 → 9', () => {
    const base = { piecesNeeded: ['COAT_UNIT', 'MIRROR'], dimensions: { coatUnitWidth: 1, mirrorWidth: 0.6, ceilingHeight: 2.6 }, materialCoatUnit: 'PAL' };
    // v1: HALLWAY 3 + UNDER_2M 1 (1,6 m) + QTY_2_3 2 + PAL 1 + MANER 1 + PAL 1 + MANER 1 = 10
    // (deschiderea era obligatorie si la cuier, si la oglinda, desi nu au usi)
    expect(cost('HALLWAY', OLD('HALLWAY'), { ...base, systemsCoatUnit: ['MANER'], materialMirror: 'PAL', systemsMirror: ['MANER'] })).toBe(10);
    // v2: 3 + 1 + 2 + PAL 1 + oglinda "decide firma" = ALTUL 2 = 9
    // cauza: cele doua sisteme false dispar (−2), oglinda ALTUL in loc de PAL (+1) → −1
    expect(cost('HALLWAY', NEW('HALLWAY'), { ...base, materialMirror: FIRM_DECIDES })).toBe(9);
  });

  it('B — dormitor: dulap 2,4 m cu usi glisante, MDF vopsit: 11 → 13', () => {
    const base = { piecesNeeded: ['WARDROBE'], wardrobeDoorType: 'SLIDING', dimensions: { wardrobeWidth: 2.4, ceilingHeight: 2.6 }, materialWardrobe: 'MDF_VOPSIT' };
    // v2: BEDROOM 4 + FROM_2_TO_4M 3 + QTY_1 0 + MDF_VOPSIT 3 + MANER 1 (raspunsul la deschidere) = 11
    expect(cost('BEDROOM', OLD('BEDROOM'), { ...base, systemsWardrobe: ['MANER'] })).toBe(11);
    // v3: 4 + 3 + 0 + 3 + GLISANTE 3 = 13
    // cauza: tipul de usi (glisante) devine sistemul piesei si intra in cost (c3) → +2
    expect(cost('BEDROOM', NEW('BEDROOM'), base)).toBe(13);
  });

  it('C — dormitor: pat 160 fara depozitare (lemn masiv) + pereche de noptiere 0,5 m (PAL, maner): 17 → 15', () => {
    const base = {
      piecesNeeded: ['BED_FRAME', 'NIGHTSTANDS'], bedSize: 'Q_160', bedStorage: 'NONE', bedUpholstered: false, nightstandsCount: 'TWO',
      dimensions: { nightstandWidth: 0.5, ceilingHeight: 2.6 }, materialBed: 'LEMN_MASIV', materialNightstands: 'PAL', systemsNightstands: ['MANER'],
    };
    // v2: 4 + FROM_2_TO_4M 3 (0,5 + 1,6 = 2,1 m) + QTY_2_3 2 + LEMN 4 + PUSH 2 (patul) + PAL 1 + MANER 1 = 17
    expect(cost('BEDROOM', OLD('BEDROOM'), { ...base, systemsBed: ['PUSH'] })).toBe(17);
    // v3: 4 + 3 + 2 + 4 + PAL 1 + MANER 1 = 15
    // cauza: patul fara sertare nu mai are intrebare de deschidere (sistemul fals de 2 puncte dispare) → −2
    expect(cost('BEDROOM', NEW('BEDROOM'), base)).toBe(15);
  });

  it('D — comoda TV ghidata 1,6 m, PAL, 3D cu maner: 6 → 5', () => {
    const config3d = normalizePieceConfig('TV_UNIT', {
      ...defaultPieceConfig('TV_UNIT'),
      widthM: 1.6,
      columns: [{ zones: [{ type: 'DOOR' }] }, { zones: [{ type: 'DRAWERS', count: 1 }] }],
      frontStyle: 'HANDLE',
    });
    const base = { config3d, tvSetup: 'UNDECIDED', material: 'PAL' };
    // v3: PIECE_TV_UNIT 2 + UNDER_2M 1 + QTY_1 0 + PAL 1 + max(PUSH din ecranul separat, MANER din 3D) 2 = 6
    expect(cost('PIECE_TV_UNIT', OLD('PIECE_TV_UNIT'), { ...base, openingSystems: ['PUSH'] })).toBe(6);
    // v4: 2 + 1 + 0 + 1 + MANER 1 = 5
    // cauza: o singura sursa pentru deschidere (3D); ecranul separat care contrazicea 3D-ul a disparut → −1
    expect(cost('PIECE_TV_UNIT', NEW('PIECE_TV_UNIT'), base)).toBe(5);
  });

  it('E — canapea de catalog 2,2 m: 7 → 8', () => {
    const config3d = normalizePieceConfig('SOFA', { ...defaultPieceConfig('SOFA'), widthM: 2.2 });
    expect(config3d.widthM).toBe(2.2);
    // v1: PIECE_SOFA 3 + FROM_2_TO_4M 3 + QTY_1 0 + PAL 1 ("structura" PAL) = 7
    expect(cost('PIECE_SOFA', OLD('PIECE_SOFA'), { config3d, material: 'PAL' })).toBe(7);
    // v2: 3 + 3 + 0 + ALTUL 2 = 8
    // cauza: tapitatele nu mai au intrebare de material; cadrul il alege firma, punctaj mediu (PO c1-2) → +1
    expect(cost('PIECE_SOFA', NEW('PIECE_SOFA'), { config3d })).toBe(8);
  });
});
