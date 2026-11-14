import { describe, expect, it } from 'vitest';
import { collectScoreEntries, validateRoomAnswers } from '../../engine';
import {
  buildPanels,
  defaultPieceConfig,
  editPieceConfig,
  initialPieceConfig,
  normalizePieceConfig,
  pieceConfig3dSchema,
  type Piece3dKind,
  type PieceConfig3d,
} from '../../piece3d';
import type { AnswerMap, Configurator3dStep, RoomFlow, RoomType, SingleChoiceStep } from '../../types';
import { catalogFlowRegistryV2 } from './catalog-v2';
import { pieceSofaFlowV3, sofaScoreEntriesV3 } from './catalog-v3';
import { pieceBedFlowV4, pieceBenchFlowV4, pieceTableFlowV4 } from './furniture-v4';
import { BED_CUSTOM_SIZE_SCORE_WIDTH_MAX_M, pieceBedFlowV5, pieceBenchFlowV5, pieceTableFlowV5 } from './furniture-v5';

// Etapa 10 (DESIGN §6 / §7a / §10, pachetul e10-3d): pat, masa, banca v5 si canapeaua v3.

const cfg = (kind: Piece3dKind, patch: Partial<PieceConfig3d> = {}): PieceConfig3d =>
  normalizePieceConfig(kind, { ...defaultPieceConfig(kind), ...patch });

const firstMaterial = (flow: RoomFlow) =>
  (flow.steps.find((s) => s.id === 'material') as SingleChoiceStep | undefined)?.options[0]?.value;

function answersFor(flow: RoomFlow, config: unknown): AnswerMap {
  const material = firstMaterial(flow);
  return { config3d: config as AnswerMap[string], ...(material ? { material } : {}) };
}

const valid = (roomType: RoomType, version: number, config: unknown, flow: RoomFlow) =>
  validateRoomAnswers(roomType, answersFor(flow, config), { partial: false, version });

const sofaV2 = catalogFlowRegistryV2.PIECE_SOFA[2];
const step3d = (flow: RoomFlow) => flow.steps.find((s) => s.type === 'configurator-3d') as Configurator3dStep;

// masa extensibila de dining 1,6 m (lungimea deschisa acceptata: 1,9 … 2,8 m)
const extendable = (patch: Partial<NonNullable<PieceConfig3d['table']>> = {}, widthM = 1.6) =>
  normalizePieceConfig('TABLE', {
    ...defaultPieceConfig('TABLE'),
    widthM,
    table: { type: 'DINING', shape: 'EXTENDABLE', seats: 'SIX', ...patch },
  });

describe('etapa 10 — versiunile noi declara campurile 3D (features)', () => {
  it('pasii 3D noi au exact campurile proiectului; versiunile vechi niciunul', () => {
    expect(step3d(pieceBedFlowV5).features).toEqual(['BED_CUSTOM_SIZE']);
    expect(step3d(pieceTableFlowV5).features).toEqual(['TABLE_OPEN_LENGTH', 'TABLE_CUSTOM_HEIGHT']);
    expect(step3d(pieceBenchFlowV5).features).toEqual(['BENCH_CUSTOM_HEIGHT']);
    expect(step3d(pieceSofaFlowV3).features).toEqual(['SOFA_SLEEPER', 'SOFA_STORAGE']);
    for (const flow of [pieceBedFlowV4, pieceTableFlowV4, pieceBenchFlowV4, sofaV2]) {
      expect(step3d(flow).features).toBeUndefined();
    }
    expect([pieceBedFlowV5, pieceTableFlowV5, pieceBenchFlowV5].map((f) => f.version)).toEqual([5, 5, 5]);
    expect(pieceSofaFlowV3.version).toBe(3);
  });

  it('versiunile vechi nu sunt atinse (pasii lor nu sunt obiectele noi)', () => {
    expect(step3d(pieceBedFlowV5)).not.toBe(step3d(pieceBedFlowV4));
    expect(step3d(pieceSofaFlowV3)).not.toBe(step3d(sofaV2));
  });

  const cases: [string, RoomType, RoomFlow, RoomFlow, number, PieceConfig3d][] = [
    ['pat customSize', 'PIECE_BED', pieceBedFlowV5, pieceBedFlowV4, 4,
      cfg('BED', { bed: { mattressSize: 'Q_160', storage: 'NONE', upholstered: false, customSize: { widthM: 1.2, lengthM: 1.9 } } })],
    ['masa openLengthM', 'PIECE_TABLE', pieceTableFlowV5, pieceTableFlowV4, 4, extendable({ openLengthM: 2.4 })],
    ['masa customHeightM', 'PIECE_TABLE', pieceTableFlowV5, pieceTableFlowV4, 4,
      cfg('TABLE', { table: { type: 'DINING', shape: 'RECTANGULAR', seats: 'SIX', customHeightM: 0.72 } })],
    ['banca customHeightM', 'PIECE_BENCH', pieceBenchFlowV5, pieceBenchFlowV4, 4,
      cfg('BENCH', { bench: { style: 'SIMPLE', upholsteredSeat: false, customHeightM: 0.48 } })],
    ['canapea sleeper', 'PIECE_SOFA', pieceSofaFlowV3, sofaV2, 2,
      cfg('SOFA', { sofa: { ...defaultPieceConfig('SOFA').sofa!, sleeper: true } })],
    ['canapea storage', 'PIECE_SOFA', pieceSofaFlowV3, sofaV2, 2,
      cfg('SOFA', { sofa: { ...defaultPieceConfig('SOFA').sofa!, storage: false } })],
  ];
  for (const [name, rt, flowNew, flowOld, oldVersion, config] of cases) {
    it(`${name}: acceptat pe versiunea noua, respins (unknownAnswer) pe v${oldVersion}`, () => {
      expect(valid(rt, flowNew.version, config, flowNew)).toEqual({ ok: true });
      const old = valid(rt, oldVersion, config, flowOld);
      expect(old.ok).toBe(false);
      expect(('errors' in old ? old.errors : []).map((e) => e.messageKey)).toContain('validation.unknownAnswer');
    });
  }

  it('configuratiile vechi (fara campuri noi) trec pe versiunile noi si au aceeasi descriere si acelasi scor', () => {
    const pairs: [RoomType, RoomFlow, RoomFlow, PieceConfig3d][] = [
      ['PIECE_BED', pieceBedFlowV5, pieceBedFlowV4, cfg('BED', { bed: { mattressSize: 'M_140', storage: 'LIFT_UP', upholstered: true } })],
      ['PIECE_TABLE', pieceTableFlowV5, pieceTableFlowV4, extendable()],
      ['PIECE_TABLE', pieceTableFlowV5, pieceTableFlowV4, cfg('TABLE', { widthM: 1.2, table: { type: 'DINING', shape: 'ROUND', seats: 'FOUR' } })],
      ['PIECE_BENCH', pieceBenchFlowV5, pieceBenchFlowV4, cfg('BENCH', { bench: { style: 'WITH_STORAGE', upholsteredSeat: true } })],
      ['PIECE_SOFA', pieceSofaFlowV3, sofaV2, cfg('SOFA')],
    ];
    for (const [rt, flowNew, flowOld, config] of pairs) {
      const answers = answersFor(flowNew, config);
      expect(validateRoomAnswers(rt, answers, { partial: false, version: flowNew.version })).toEqual({ ok: true });
      expect(flowNew.deriveRoom(answers)).toEqual(flowOld.deriveRoom(answers));
      if (rt !== 'PIECE_SOFA') {
        expect(collectScoreEntries(rt, answers, flowNew.version)).toEqual(collectScoreEntries(rt, answers, flowOld.version));
      }
    }
  });
});

describe('etapa 10 — canapeaua v3 (d3 + c9-3)', () => {
  const sofa = (patch: Partial<NonNullable<PieceConfig3d['sofa']>>, widthM = 2.2) =>
    cfg('SOFA', { widthM, sofa: { ...defaultPieceConfig('SOFA').sofa!, ...patch } });

  it('§7e D: dreapta, 3 locuri → SOFA_SEATS:SEATS_3 + SOFA_LAYOUT:STRAIGHT, fara extensibila / lada', () => {
    const entries = collectScoreEntries('PIECE_SOFA', answersFor(pieceSofaFlowV3, sofa({ seats: 3, layout: 'STRAIGHT' })), 3);
    expect(entries).toContainEqual({ category: 'SOFA_SEATS', optionKey: 'SEATS_3' });
    expect(entries).toContainEqual({ category: 'SOFA_LAYOUT', optionKey: 'STRAIGHT' });
    expect(entries.some((e) => 'category' in e && (e.category === 'SOFA_SLEEPER' || e.category === 'SOFA_STORAGE'))).toBe(false);
    // partea veche a scorului ramane cea de la v2
    const oldEntries = collectScoreEntries('PIECE_SOFA', answersFor(sofaV2, sofa({ seats: 3, layout: 'STRAIGHT' })), 2);
    expect(entries.filter((e) => !('category' in e) || !e.category.startsWith('SOFA_'))).toEqual(oldEntries);
  });

  it('§7e E: 4 locuri, sezlong, extensibila, lada → toate intrarile d3 + c9-3', () => {
    const config = sofa({ seats: 4, layout: 'CHAISE_LEFT', sleeper: true, storage: true }, 2.8);
    expect(sofaScoreEntriesV3(config)).toEqual([
      { category: 'SOFA_SEATS', optionKey: 'SEATS_4' },
      { category: 'SOFA_LAYOUT', optionKey: 'CHAISE_LEFT' },
      { category: 'SOFA_SLEEPER', optionKey: 'YES' },
      { category: 'SOFA_STORAGE', optionKey: 'YES' },
    ]);
    const answers = answersFor(pieceSofaFlowV3, config);
    expect(validateRoomAnswers('PIECE_SOFA', answers, { partial: false, version: 3 })).toEqual({ ok: true });
    const entries = collectScoreEntries('PIECE_SOFA', answers, 3);
    expect(entries).toContainEqual({ category: 'SOFA_SLEEPER', optionKey: 'YES' });
    expect(entries).toContainEqual({ category: 'ROOM_SIZE', optionKey: 'FROM_2_TO_4M' });
  });

  it('sleeper / storage false nu dau puncte', () => {
    expect(sofaScoreEntriesV3(sofa({ sleeper: false, storage: false }))).toHaveLength(2);
  });

  it('descrierea pentru firma contine extensibila si lada (RO); cea veche nu le are', () => {
    const config = sofa({ sleeper: true, storage: true });
    const item = pieceSofaFlowV3.deriveRoom(answersFor(pieceSofaFlowV3, config)).items[0];
    expect(item.description).toContain('Extensibilă: da');
    expect(item.description).toContain('Ladă de depozitare: da');
    expect(item.material).toBe('ALTUL');
    const plain = pieceSofaFlowV3.deriveRoom(answersFor(pieceSofaFlowV3, cfg('SOFA'))).items[0];
    expect(plain.description).not.toMatch(/Extensibilă|Ladă/);
  });
});

describe('etapa 10 — patul v5 „Altă mărime”', () => {
  const bed = (customSize?: { widthM: number; lengthM: number }, upholstered = false) =>
    cfg('BED', { bed: { mattressSize: 'Q_160', storage: 'LIFT_UP', upholstered, ...(customSize ? { customSize } : {}) } });
  const roomSize = (config: PieceConfig3d) =>
    collectScoreEntries('PIECE_BED', answersFor(pieceBedFlowV5, config), 5).find((e) => e.category === 'ROOM_SIZE');

  it('revizuire M2 (c9-3): saltea 220 × 200 are aceeasi treapta de marime ca 180 × 200; descrierea si gabaritul raman reale', () => {
    const custom = bed({ widthM: 2.2, lengthM: 2 });
    const standard = cfg('BED', { bed: { mattressSize: 'K_180', storage: 'LIFT_UP', upholstered: false } });
    expect(BED_CUSTOM_SIZE_SCORE_WIDTH_MAX_M).toBe(1.8);
    expect(roomSize(custom)).toEqual(roomSize(standard));
    expect(roomSize(custom)).toEqual({ category: 'ROOM_SIZE', optionKey: 'UNDER_2M' });
    // tot scorul e acelasi ca la 180 × 200 (v4 si v5)
    expect(collectScoreEntries('PIECE_BED', answersFor(pieceBedFlowV5, custom), 5))
      .toEqual(collectScoreEntries('PIECE_BED', answersFor(pieceBedFlowV4, standard), 4));
    const derived = pieceBedFlowV5.deriveRoom(answersFor(pieceBedFlowV5, custom));
    expect(derived.items[0].description).toContain('Saltea: 220 × 200 cm (altă mărime)');
    expect(derived.items[0].description).toContain('Configurat 3D: 233 × 100 × 220 cm');
    expect(custom.widthM).toBeCloseTo(2.2 + 2 * 0.045 + 0.04, 6);
    // lungimea saltelei ramane cea reala; doar latimea folosita la cost e plafonata
    expect(derived.widthM).toBe(2);
    expect(derived.lengthM).toBe(1.8);
  });

  it('revizuire m3: marimea standard veche salvata langa customSize nu mai e citita de nimeni', () => {
    // K_180 ramas salvat, salteaua aleasa 120 × 190
    const config = cfg('BED', { bed: { mattressSize: 'K_180', storage: 'NONE', upholstered: false, customSize: { widthM: 1.2, lengthM: 1.9 } } });
    // gabarit + geometrie: din customSize
    expect(config.widthM).toBeCloseTo(1.2 + 0.09 + 0.04, 6);
    const panels = buildPanels(config, 'BED');
    const mattress = panels.filter((p) => p.surface === 'BEDDING' && p.shape === undefined);
    expect(mattress.length).toBeGreaterThan(0);
    for (const p of mattress) expect(p.w).toBeLessThanOrEqual(1.2 + 1e-6);
    // descriere: fara "180 × 200", cu salteaua aleasa
    const derived = pieceBedFlowV5.deriveRoom(answersFor(pieceBedFlowV5, config));
    const description = derived.items[0].description ?? '';
    expect(description).not.toMatch(/180|× 200/);
    expect(description).toContain('Saltea: 120 × 190 cm (altă mărime)');
    // cost: din salteaua aleasa (1,2 m), nu din K_180
    expect(derived.lengthM).toBe(1.2);
    expect(roomSize(config)).toEqual({ category: 'ROOM_SIZE', optionKey: 'UNDER_2M' });
  });

  it('120 × 190 schimba gabaritul (latime saltea + cadru, adancime 2,1) si descrierea', () => {
    const config = bed({ widthM: 1.2, lengthM: 1.9 });
    expect(config.widthM).toBeCloseTo(1.2 + 2 * 0.045 + 0.04, 6);
    expect(config.depthM).toBeCloseTo(2.1, 6);
    const answers = answersFor(pieceBedFlowV5, config);
    expect(validateRoomAnswers('PIECE_BED', answers, { partial: false, version: 5 })).toEqual({ ok: true });
    const derived = pieceBedFlowV5.deriveRoom(answers);
    const description = derived.items[0].description ?? '';
    expect(description).toContain('Saltea: 120 × 190 cm (altă mărime)');
    // textul saltelei standard (160 × 200) nu mai apare
    expect(description).not.toContain('160 × 200');
    expect(description).toContain('ladă cu mecanism rabatabil');
    expect(derived.lengthM).toBe(1.2);
    expect(derived.widthM).toBe(1.9);
    // scorul ca la v4 (BED_STORAGE)
    expect(collectScoreEntries('PIECE_BED', answers, 5)).toContainEqual({ category: 'BED_STORAGE', optionKey: 'LIFT_UP' });
  });

  it('pat tapitat 200 × 240: gabaritul tine cont de sina tapitata; geometria intra in gabarit', () => {
    const config = bed({ widthM: 2, lengthM: 2.4 }, true);
    expect(config.widthM).toBeCloseTo(2 + 0.18 + 0.04, 6);
    expect(config.depthM).toBeCloseTo(2.6, 6);
    expect(pieceConfig3dSchema('BED').safeParse(config).success).toBe(true);
    const panels = buildPanels(config, 'BED');
    for (const p of panels) {
      expect(Math.abs(p.z) + p.d / 2).toBeLessThanOrEqual(config.depthM / 2 + 1e-6);
      expect(Math.abs(p.x) + p.w / 2).toBeLessThanOrEqual(config.widthM / 2 + 0.05);
    }
  });

  it('gabaritul care nu se potriveste cu customSize e respins', () => {
    const config = { ...bed({ widthM: 1.2, lengthM: 1.9 }), depthM: 2.2 };
    expect(pieceConfig3dSchema('BED').safeParse(config).success).toBe(false);
  });

  it('limitele saltelei: 0,7–2,2 × 1,6–2,4', () => {
    const base = bed();
    for (const customSize of [{ widthM: 0.6, lengthM: 2 }, { widthM: 2.3, lengthM: 2 }, { widthM: 1.2, lengthM: 1.5 }, { widthM: 1.2, lengthM: 2.5 }]) {
      expect(pieceConfig3dSchema('BED').safeParse({ ...base, bed: { ...base.bed!, customSize } }).success).toBe(false);
    }
  });
});

describe('etapa 10 — masa v5 (lungime deschisa, inaltime) si banca v5', () => {
  it('lungimea deschisa: in interval acceptata si descrisa; in afara intervalului respinsa', () => {
    const ok = extendable({ openLengthM: 2.4 });
    expect(ok.table?.openLengthM).toBe(2.4);
    const answers = answersFor(pieceTableFlowV5, ok);
    expect(validateRoomAnswers('PIECE_TABLE', answers, { partial: false, version: 5 })).toEqual({ ok: true });
    expect(pieceTableFlowV5.deriveRoom(answers).items[0].description).toContain('Lungime deschisă: 240 cm');
    expect(collectScoreEntries('PIECE_TABLE', answers, 5)).toContainEqual({ category: 'TABLE_EXTENDABLE', optionKey: 'YES' });
    // 1,6 m inchisa → 1,9 … 2,8 m deschisa
    for (const openLengthM of [1.8, 2.9]) {
      const bad = { ...ok, table: { ...ok.table!, openLengthM } };
      expect(valid('PIECE_TABLE', 5, bad, pieceTableFlowV5).ok).toBe(false);
    }
  });

  it('lungimea deschisa la masa neextensibila (dreptunghi, rotunda) e respinsa; normalizarea o sterge', () => {
    for (const shape of ['RECTANGULAR', 'ROUND'] as const) {
      const base = cfg('TABLE', { widthM: 1.2, table: { type: 'DINING', shape, seats: 'FOUR' } });
      const bad = { ...base, table: { ...base.table!, openLengthM: 2 } };
      expect(valid('PIECE_TABLE', 5, bad, pieceTableFlowV5).ok).toBe(false);
      expect(normalizePieceConfig('TABLE', bad).table?.openLengthM).toBeUndefined();
    }
  });

  it('lungimea deschisa urmeaza lungimea inchisa (editare)', () => {
    const wider = editPieceConfig('TABLE', { ...extendable({ openLengthM: 2 }), widthM: 2.2 });
    expect(wider.table?.openLengthM).toBe(2.5);
    expect(pieceConfig3dSchema('TABLE').safeParse(wider).success).toBe(true);
  });

  it('inaltimea mesei pe tip: heightM = customHeightM, descrisa; in afara tipului respinsa / stearsa la schimbarea tipului', () => {
    const dining = cfg('TABLE', { table: { type: 'DINING', shape: 'RECTANGULAR', seats: 'SIX', customHeightM: 0.72 } });
    expect(dining.heightM).toBe(0.72);
    const answers = answersFor(pieceTableFlowV5, dining);
    expect(validateRoomAnswers('PIECE_TABLE', answers, { partial: false, version: 5 })).toEqual({ ok: true });
    const derived = pieceTableFlowV5.deriveRoom(answers);
    expect(derived.heightM).toBe(0.72);
    expect(derived.items[0].description).toContain('Înălțime: 72 cm');
    // 0,5 m nu e o inaltime de masa de dining
    const bad = { ...dining, heightM: 0.5, table: { ...dining.table!, customHeightM: 0.5 } };
    expect(valid('PIECE_TABLE', 5, bad, pieceTableFlowV5).ok).toBe(false);
    // dining → cafea: inaltimea aleasa nu mai e valabila, revine la implicitul tipului
    const coffee = editPieceConfig('TABLE', { ...dining, table: { ...dining.table!, type: 'COFFEE' } });
    expect(coffee.table?.customHeightM).toBeUndefined();
    expect(coffee.heightM).toBe(0.45);
    // heightM nepotrivit cu customHeightM → respins
    expect(pieceConfig3dSchema('TABLE').safeParse({ ...dining, heightM: 0.75 }).success).toBe(false);
  });

  it('inaltimea bancutei 0,35–0,55: heightM, descrierea, limitele', () => {
    const bench = cfg('BENCH', { bench: { style: 'SIMPLE', upholsteredSeat: false, customHeightM: 0.48 } });
    expect(bench.heightM).toBe(0.48);
    const derived = pieceBenchFlowV5.deriveRoom(answersFor(pieceBenchFlowV5, bench));
    expect(derived.heightM).toBe(0.48);
    expect(derived.items[0].description).toContain('Înălțime: 48 cm');
    for (const customHeightM of [0.3, 0.6]) {
      const bad = { ...bench, heightM: customHeightM, bench: { ...bench.bench!, customHeightM } };
      expect(pieceConfig3dSchema('BENCH').safeParse(bad).success).toBe(false);
    }
  });

  it('configuratiile de pornire nu primesc campuri noi (piesa noua ramane ca azi)', () => {
    for (const kind of ['BED', 'TABLE', 'BENCH', 'SOFA'] as const) {
      const start = initialPieceConfig(kind);
      expect(start.bed?.customSize).toBeUndefined();
      expect(start.table?.openLengthM).toBeUndefined();
      expect(start.table?.customHeightM).toBeUndefined();
      expect(start.bench?.customHeightM).toBeUndefined();
      expect(start.sofa?.sleeper).toBeUndefined();
      expect(start.sofa?.storage).toBeUndefined();
    }
  });
});
