import { NotFoundException, BadRequestException } from '@nestjs/common';
import type { AnswerMap } from '@marketplace/shared';
import { AdminSizingService } from './admin-sizing.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';

// E-admin-platform-25: editorul de puncte (project_sizing_config) — previzualizare fara scriere,
// salvare intr-o singura instructiune.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const CONFIG = [
  ['ROOM_TYPE', 'KITCHEN', 8],
  ['ROOM_SIZE', 'UNDER_2M', 1],
  ['ROOM_SIZE', 'FROM_2_TO_4M', 3],
  ['ROOM_SIZE', 'OVER_4M', 5],
  ['MATERIAL', 'MDF', 2],
  ['SYSTEM', 'GLISANTE', 3],
  ['ITEM_QUANTITY', 'QTY_1', 0],
  ['ITEM_QUANTITY', 'QTY_2_3', 2],
  ['KITCHEN_LAYOUT', 'STRAIGHT', 1],
  ['BUDGET', 'UNDISCLOSED', 0],
].map(([key, option, weight], i) => ({ id: uuid(i + 1), key: key as string, option: option as string, weight: weight as number }));
const KITCHEN_ID = uuid(1);

const THRESHOLDS = [
  { size: 'SMALL', minScore: 0, maxScore: 14 },
  { size: 'MEDIUM', minScore: 15, maxScore: 29 },
  { size: 'LARGE', minScore: 30, maxScore: null },
];

// bucatarie STRAIGHT 3.5 ml, 2 corpuri MDF cu glisante: 8+3+2+4+6+1 = 24 → MEDIUM (engine.test.ts)
const KITCHEN_ANSWERS: AnswerMap = {
  layout: 'STRAIGHT',
  hasIsland: false,
  dimensions: { runA: 3.5, ceilingHeight: 2.6 },
  cabinetZones: ['BASE_UNITS', 'WALL_UNITS'],
  frontMaterial: 'MDF',
  openingSystems: ['GLISANTE'],
  countertop: 'LAMINATE',
};

function makeService(requests: unknown[] = [], settings: { key: string; value: string }[] = []) {
  const prisma = {
    projectSizingConfig: {
      findMany: jest.fn((args?: { where?: { id?: { in: string[] } } }) => {
        const ids = args?.where?.id?.in;
        return Promise.resolve(ids ? CONFIG.filter((r) => ids.includes(r.id)).map((r) => ({ id: r.id, weight: r.weight })) : CONFIG);
      }),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    projectSizeThreshold: { findMany: jest.fn().mockResolvedValue(THRESHOLDS) },
    request: { findMany: jest.fn().mockResolvedValue(requests) },
    systemSetting: { findMany: jest.fn().mockResolvedValue(settings) },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn(),
  };
  return { service: new AdminSizingService(prisma as unknown as PrismaService), prisma };
}

const kitchenRequest = {
  id: 'req-kitchen',
  budgetRange: null,
  includesPaidDesign: false,
  rooms: [{ roomType: 'KITCHEN', flowVersion: 1, answers: KITCHEN_ANSWERS }],
};

describe('AdminSizingService', () => {
  it('previzualizarea nu scrie nimic', async () => {
    const { service, prisma } = makeService([kitchenRequest]);
    await service.preview([{ id: KITCHEN_ID, weight: 20 }]);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.projectSizingConfig.update).not.toHaveBeenCalled();
    expect(prisma.projectSizingConfig.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.request.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200, orderBy: { publishedAt: 'desc' } }));
  });

  it('ROOM_TYPE:KITCHEN 8 → 20 muta bucataria din MEDIUM in LARGE si creste costul', async () => {
    const { service } = makeService([kitchenRequest]);
    const preview = await service.preview([{ id: KITCHEN_ID, weight: 20 }]);
    expect(preview.sampleSize).toBe(1);
    expect(preview.skipped).toBe(0);
    expect(preview.current).toEqual({ SMALL: 0, MEDIUM: 1, LARGE: 0 });
    expect(preview.proposed).toEqual({ SMALL: 0, MEDIUM: 0, LARGE: 1 });
    expect(preview.changedSize).toBe(1);
    expect(preview.changedCreditCost).toBe(1);
    expect(preview.avgCreditCostProposed).toBeGreaterThan(preview.avgCreditCostCurrent);
    expect(preview.examples).toEqual([
      { requestId: 'req-kitchen', currentSize: 'MEDIUM', proposedSize: 'LARGE', currentCreditCost: 24, proposedCreditCost: 36 },
    ]);
  });

  // E-company-21: previzualizarea aplica plafonul claim_cost_max din system_settings
  it('cu claim_cost_max 25, costul propus nu depaseste plafonul oricat de mare e ponderea', async () => {
    const { service } = makeService([kitchenRequest, { ...kitchenRequest, id: 'req-kitchen-2' }], [
      { key: 'claim_cost_max', value: '25' },
    ]);
    const preview = await service.preview([{ id: KITCHEN_ID, weight: 100 }]);
    expect(preview.examples.length).toBeGreaterThan(0);
    for (const ex of preview.examples) {
      expect(ex.proposedCreditCost).toBeLessThanOrEqual(25);
      expect(ex.currentCreditCost).toBeLessThanOrEqual(25);
    }
    expect(preview.avgCreditCostProposed).toBeLessThanOrEqual(25);
  });

  it('camerele fara raspunsuri (legacy) si flow-urile necunoscute sunt sarite', async () => {
    const { service } = makeService([
      { ...kitchenRequest, id: 'legacy', rooms: [{ roomType: 'KITCHEN', flowVersion: 1, answers: null }] },
      { ...kitchenRequest, id: 'no-rooms', rooms: [] },
      { ...kitchenRequest, id: 'bad-flow', rooms: [{ roomType: 'KITCHEN', flowVersion: 999, answers: KITCHEN_ANSWERS }] },
      kitchenRequest,
    ]);
    const preview = await service.preview([{ id: KITCHEN_ID, weight: 8 }]);
    expect(preview.skipped).toBe(3);
    expect(preview.sampleSize).toBe(1);
    expect(preview.examples).toEqual([]);
  });

  it('id necunoscut → 404, id duplicat → 400', async () => {
    const { service, prisma } = makeService();
    await expect(service.updateWeights([{ id: uuid(99), weight: 3 }])).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.preview([
        { id: KITCHEN_ID, weight: 3 },
        { id: KITCHEN_ID, weight: 4 },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('updateWeights scrie intr-o singura instructiune', async () => {
    const { service, prisma } = makeService();
    prisma.$executeRaw.mockResolvedValueOnce(2);
    const result = await service.updateWeights([
      { id: KITCHEN_ID, weight: 9 },
      { id: uuid(2), weight: 2 },
    ]);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      count: 2,
      items: [
        { id: KITCHEN_ID, weight: 9, previousWeight: 8 },
        { id: uuid(2), weight: 2, previousWeight: 1 },
      ],
    });
  });
});
