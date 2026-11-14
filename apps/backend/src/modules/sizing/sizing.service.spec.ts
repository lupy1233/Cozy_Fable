import * as fs from 'fs';
import * as path from 'path';
import { creditCostFromBaseScore } from '@marketplace/shared';
import { computeSizing, SizingService, type SizingConfigRow, type SizingThresholdRow } from './sizing.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';

// E-admin-platform-25: functia pura de scoring (folosita si de previzualizarea din admin).
const CONFIG: SizingConfigRow[] = [
  { key: 'ROOM_TYPE', option: 'KITCHEN', weight: 8 },
  { key: 'ROOM_SIZE', option: 'OVER_4M', weight: 5 },
  { key: 'MATERIAL', option: 'PAL', weight: 1 },
  { key: 'SYSTEM', option: 'MANER', weight: 1 },
  { key: 'SYSTEM', option: 'GOLA', weight: 3 },
  { key: 'PAID_DESIGN', option: 'YES', weight: 2 },
  { key: 'BUDGET', option: 'OVER_15K', weight: 5 },
  { key: 'BUDGET', option: 'UNDISCLOSED', weight: 0 },
];

const THRESHOLDS: SizingThresholdRow[] = [
  { size: 'SMALL', minScore: 0, maxScore: 14 },
  { size: 'MEDIUM', minScore: 15, maxScore: 29 },
  { size: 'LARGE', minScore: 30, maxScore: null },
];

describe('computeSizing', () => {
  it('pick max pe SYSTEM si suma pe restul intrarilor', () => {
    const result = computeSizing(CONFIG, THRESHOLDS, {
      scoreEntries: [
        { category: 'ROOM_TYPE', optionKey: 'KITCHEN' },
        { category: 'MATERIAL', optionKey: 'PAL' },
        { category: 'SYSTEM', optionKeys: ['MANER', 'GOLA'], pick: 'max' },
      ],
      budgetRange: 'UNDISCLOSED',
      includesPaidDesign: false,
    });
    expect(result.baseScore).toBe(8 + 1 + 3);
    expect(result.score).toBe(12);
    expect(result.size).toBe('SMALL');
    expect(result.creditCost).toBe(creditCostFromBaseScore(12));
  });

  it('BUDGET si PAID_DESIGN intra in scorul total, nu in costul in credite', () => {
    const result = computeSizing(CONFIG, THRESHOLDS, {
      scoreEntries: [
        { category: 'ROOM_TYPE', optionKey: 'KITCHEN' },
        { category: 'ROOM_SIZE', optionKey: 'OVER_4M' },
      ],
      budgetRange: 'OVER_15K',
      includesPaidDesign: true,
    });
    expect(result.baseScore).toBe(13);
    expect(result.score).toBe(13 + 2 + 5);
    expect(result.size).toBe('MEDIUM');
    expect(result.creditCost).toBe(creditCostFromBaseScore(13));
  });

  it('pragul LARGE cu maxScore null acopera orice scor mare', () => {
    const heavy = CONFIG.map((r) => (r.key === 'ROOM_TYPE' ? { ...r, weight: 100 } : r));
    const result = computeSizing(heavy, THRESHOLDS, {
      scoreEntries: [{ category: 'ROOM_TYPE', optionKey: 'KITCHEN' }],
      budgetRange: 'UNDISCLOSED',
      includesPaidDesign: false,
    });
    expect(result.size).toBe('LARGE');
    expect(result.creditCost).toBe(creditCostFromBaseScore(100));
  });

  it('optiune fara rand in config scoreaza 0; costul minim ramane 1 credit', () => {
    const result = computeSizing(CONFIG, THRESHOLDS, {
      scoreEntries: [{ category: 'ROOM_TYPE', optionKey: 'NECUNOSCUT' }],
      budgetRange: 'UNDISCLOSED',
      includesPaidDesign: false,
    });
    expect(result.baseScore).toBe(0);
    expect(result.size).toBe('SMALL');
    expect(result.creditCost).toBe(1);
  });
});

// d3 (etapa 5, PO g0-10): ponderile din seed (citite din fisier, nu copiate) — cele 7 piese noi
// au pondere de tip, iar migrarea adauga exact aceleasi randuri pe bazele existente.
describe('ponderile din seed (d3)', () => {
  const prismaDir = path.join(__dirname, '..', '..', '..', 'prisma');
  const ROW = /\{\s*key:\s*'([A-Z_]+)',\s*option:\s*'([A-Z0-9_]+)',\s*weight:\s*(\d+)\s*\}/g;
  const SQL_ROW = /'([A-Z_]+)',\s*'([A-Z0-9_]+)',\s*(\d+)\)/g;
  const parse = (text: string, re: RegExp): SizingConfigRow[] =>
    [...text.matchAll(re)].map((m) => ({ key: m[1], option: m[2], weight: Number(m[3]) }));
  const SEED = parse(fs.readFileSync(path.join(prismaDir, 'seed.ts'), 'utf8'), ROW);
  const NEW_PIECES: Record<string, number> = {
    PIECE_SOFA: 3,
    PIECE_SIDEBOARD: 2,
    PIECE_BATHROOM_VANITY: 2,
    PIECE_ENTRYWAY: 2,
    PIECE_WALL_CABINET: 1,
    PIECE_ARMCHAIR: 1,
    PIECE_OTTOMAN: 1,
  };
  const weightOf = (option: string) => SEED.find((r) => r.key === 'ROOM_TYPE' && r.option === option)?.weight;
  const baseOf = (scoreEntries: Parameters<typeof computeSizing>[2]['scoreEntries']) =>
    computeSizing(SEED, THRESHOLDS, { scoreEntries, budgetRange: 'UNDISCLOSED', includesPaidDesign: false }).baseScore;

  it('cele 7 piese noi au ponderea hotarata de PO', () => {
    for (const [option, weight] of Object.entries(NEW_PIECES)) expect(weightOf(option)).toBe(weight);
  });

  it('migrarea adauga aceleasi 7 randuri, fara sa suprascrie (ON CONFLICT DO NOTHING)', () => {
    const sql = fs.readFileSync(
      path.join(prismaDir, 'migrations', '20261114100000_piece_weights_room_approx_length', 'migration.sql'),
      'utf8',
    );
    const rows = parse(sql, SQL_ROW);
    expect(Object.fromEntries(rows.map((r) => [r.option, r.weight]))).toEqual(NEW_PIECES);
    expect(rows.every((r) => r.key === 'ROOM_TYPE')).toBe(true);
    expect(sql).toMatch(/ON CONFLICT \("key", "option"\) DO NOTHING/);
    expect(sql).toMatch(/ADD COLUMN "approx_length_m" NUMERIC\(5,2\)/);
  });

  it('canapea de 3 locuri > pereche de noptiere (intrarile emise de engine pentru fiecare)', () => {
    // canapea 3 locuri (~2,2 m): tip + 2–4 m + o piesa + materialul structurii
    const sofa = baseOf([
      { category: 'ROOM_TYPE', optionKey: 'PIECE_SOFA' },
      { category: 'ROOM_SIZE', optionKey: 'FROM_2_TO_4M' },
      { category: 'ITEM_QUANTITY', optionKey: 'QTY_1' },
      { category: 'MATERIAL', optionKey: 'PAL' },
    ]);
    // pereche de noptiere: tip + sub 2 m + 2 bucati + material
    const nightstands = baseOf([
      { category: 'ROOM_TYPE', optionKey: 'PIECE_NIGHTSTAND' },
      { category: 'ROOM_SIZE', optionKey: 'UNDER_2M' },
      { category: 'ITEM_QUANTITY', optionKey: 'QTY_2_3' },
      { category: 'MATERIAL', optionKey: 'PAL' },
    ]);
    expect(sofa).toBe(7); // inainte: 4 (canapeaua nu avea rand → 0)
    expect(nightstands).toBe(5);
    expect(sofa).toBeGreaterThan(nightstands);
  });

  it('fotoliul, taburetul si bufetul conteaza la tip', () => {
    for (const option of ['PIECE_ARMCHAIR', 'PIECE_OTTOMAN', 'PIECE_SIDEBOARD']) {
      expect(baseOf([{ category: 'ROOM_TYPE', optionKey: option }])).toBeGreaterThan(0);
    }
  });
});

describe('SizingService.compute', () => {
  it('delega la computeSizing cu randurile din DB (inclusiv baseScore)', async () => {
    const prisma = {
      projectSizingConfig: { findMany: jest.fn().mockResolvedValue(CONFIG) },
      projectSizeThreshold: { findMany: jest.fn().mockResolvedValue(THRESHOLDS) },
      systemSetting: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new SizingService(prisma as unknown as PrismaService);
    const result = await service.compute({
      scoreEntries: [{ category: 'ROOM_TYPE', optionKey: 'KITCHEN' }],
      budgetRange: 'UNDISCLOSED',
      includesPaidDesign: false,
    });
    expect(result).toEqual({ score: 8, size: 'SMALL', creditCost: creditCostFromBaseScore(8), baseScore: 8 });
    expect(prisma.projectSizeThreshold.findMany).toHaveBeenCalledWith({ orderBy: { minScore: 'asc' } });
  });

  // E-admin-platform-14: ponderea BUDGET:UNDISCLOSED e editabila in /admin/sizing — scorul
  // total creste, dar baza (si deci costul si bugetul minim) raman pe camere.
  it('cu BUDGET:UNDISCLOSED nenul, baseScore ramane pe camere si costul nu se schimba', async () => {
    const weighted = CONFIG.map((r) => (r.key === 'BUDGET' && r.option === 'UNDISCLOSED' ? { ...r, weight: 4 } : r));
    const prisma = {
      projectSizingConfig: { findMany: jest.fn().mockResolvedValue(weighted) },
      projectSizeThreshold: { findMany: jest.fn().mockResolvedValue(THRESHOLDS) },
      systemSetting: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new SizingService(prisma as unknown as PrismaService);
    const result = await service.compute({
      scoreEntries: [{ category: 'ROOM_TYPE', optionKey: 'KITCHEN' }],
      budgetRange: 'UNDISCLOSED',
      includesPaidDesign: false,
    });
    expect(result.baseScore).toBe(8);
    expect(result.score).toBe(12);
    expect(result.creditCost).toBe(creditCostFromBaseScore(8));
  });

  // E-company-21: regulile costului vin din system_settings (fara randuri = implicitele)
  function serviceWith(settings: { key: string; value: string }[], config: SizingConfigRow[] = CONFIG) {
    const prisma = {
      projectSizingConfig: { findMany: jest.fn().mockResolvedValue(config) },
      projectSizeThreshold: { findMany: jest.fn().mockResolvedValue(THRESHOLDS) },
      systemSetting: { findMany: jest.fn().mockResolvedValue(settings) },
    };
    return { prisma, service: new SizingService(prisma as unknown as PrismaService) };
  }

  it('cerere uriasa multi-camera: costul e plafonat la claim_cost_max, scorurile nu', async () => {
    const { service, prisma } = serviceWith([{ key: 'claim_cost_max', value: '25' }]);
    const scoreEntries = Array.from({ length: 50 }, () => [
      { category: 'ROOM_TYPE', optionKey: 'KITCHEN' } as const,
      { category: 'ROOM_SIZE', optionKey: 'OVER_4M' } as const,
    ]).flat();
    const result = await service.compute({ scoreEntries, budgetRange: 'UNDISCLOSED', includesPaidDesign: false });
    expect(result.baseScore).toBe(650);
    expect(result.score).toBe(650);
    expect(result.size).toBe('LARGE');
    expect(result.creditCost).toBe(25);
    expect(prisma.systemSetting.findMany).toHaveBeenCalledWith({
      where: { key: { in: ['credit_value_ron', 'claim_cost_min', 'claim_cost_max'] } },
      select: { key: true, value: true },
    });
  });

  it('claim_cost_min 3: baseScore 1 costa 3 credite', async () => {
    const { service } = serviceWith([{ key: 'claim_cost_min', value: '3' }]);
    const result = await service.compute({
      scoreEntries: [{ category: 'MATERIAL', optionKey: 'PAL' }],
      budgetRange: 'UNDISCLOSED',
      includesPaidDesign: false,
    });
    expect(result.baseScore).toBe(1);
    expect(result.creditCost).toBe(3);
  });

  it('credit_value_ron 2000: baseScore 33 costa 17 credite', async () => {
    const config = [...CONFIG, { key: 'ROOM_TYPE', option: 'LIVING', weight: 33 }];
    const { service } = serviceWith([{ key: 'credit_value_ron', value: '2000' }], config);
    const result = await service.compute({
      scoreEntries: [{ category: 'ROOM_TYPE', optionKey: 'LIVING' }],
      budgetRange: 'UNDISCLOSED',
      includesPaidDesign: false,
    });
    expect(result.baseScore).toBe(33);
    expect(result.creditCost).toBe(17);
  });

  it('computeSizing fara reguli = creditCostFromBaseScore(baza)', () => {
    const result = computeSizing(CONFIG, THRESHOLDS, {
      scoreEntries: [
        { category: 'ROOM_TYPE', optionKey: 'KITCHEN' },
        { category: 'ROOM_SIZE', optionKey: 'OVER_4M' },
      ],
      budgetRange: 'OVER_15K',
      includesPaidDesign: true,
    });
    expect(result.creditCost).toBe(creditCostFromBaseScore(result.baseScore));
  });
});
