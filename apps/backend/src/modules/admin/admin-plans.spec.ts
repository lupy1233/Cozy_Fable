import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminService } from './admin.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/admin.dto';

// E-admin-platform-58 — planurile de abonament sunt date: creare (cod unic, pret >= 0, acces
// marketplace ales explicit), actualizare (pret 0 permis, nume, functii prin upsert).

type PlanRow = {
  id: string;
  code: string;
  tier: string | null;
  nameRo: string | null;
  nameEn: string | null;
  priceRon: number;
  includedCredits: number;
  marketplaceGatingDelayMin: number;
  isActive: boolean;
  features: { planId: string; featureKey: string; enabled: boolean; limitValue: number | null }[];
};

function makeService(initial: PlanRow[] = []) {
  const plans = new Map(initial.map((p) => [p.id, { ...p, features: p.features.map((f) => ({ ...f })) }]));
  let seq = 0;
  const tx = {
    subscriptionPlan: {
      create: jest.fn(async ({ data }: { data: Omit<PlanRow, 'id' | 'tier' | 'features'> }) => {
        if ([...plans.values()].some((p) => p.code === data.code)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`code`)', {
            code: 'P2002',
            clientVersion: 'test',
            meta: { target: ['code'] },
          });
        }
        const row: PlanRow = { id: `plan-${++seq}`, tier: null, features: [], ...data };
        plans.set(row.id, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = plans.get(where.id)!;
        for (const [k, v] of Object.entries(data)) if (v !== undefined) (row as Record<string, unknown>)[k] = v;
        return row;
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => plans.get(where.id)),
    },
    subscriptionPlanFeature: {
      createMany: jest.fn(async ({ data }: { data: { planId: string; featureKey: string; enabled: boolean }[] }) => {
        for (const f of data) plans.get(f.planId)!.features.push({ limitValue: null, ...f });
        return { count: data.length };
      }),
      upsert: jest.fn(
        async ({ where, update, create }: { where: { planId_featureKey: { planId: string; featureKey: string } }; update: Record<string, unknown>; create: PlanRow['features'][number] }) => {
          const { planId, featureKey } = where.planId_featureKey;
          const row = plans.get(planId)!;
          const existing = row.features.find((f) => f.featureKey === featureKey);
          if (existing) Object.assign(existing, update);
          else row.features.push({ ...create });
          return existing ?? create;
        },
      ),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    subscriptionPlan: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => plans.get(where.id) ?? null),
      findMany: jest.fn(async () => [...plans.values()]),
    },
  };
  const queue = {} as never;
  const service = new AdminService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue,
  );
  return { service, prisma, tx, plans };
}

const GOLD: PlanRow = {
  id: 'plan-gold',
  code: 'GOLD',
  tier: 'GOLD',
  nameRo: null,
  nameEn: null,
  priceRon: 399,
  includedCredits: 50,
  marketplaceGatingDelayMin: 30,
  isActive: true,
  features: [{ planId: 'plan-gold', featureKey: 'MARKETPLACE_ACCESS', enabled: true, limitValue: null }],
};

const createInput = {
  code: 'TEST_FREE',
  nameRo: ' Test gratuit ',
  priceRon: 0,
  includedCredits: 0,
  marketplaceGatingDelayMin: 60,
  features: { MARKETPLACE_ACCESS: { enabled: false } },
};

describe('AdminService — planuri (E-admin-platform-58)', () => {
  it('creeaza un plan de 0 lei → isFree, tier null, functia MARKETPLACE_ACCESS scrisa explicit', async () => {
    const { service, tx } = makeService([GOLD]);
    const plan = await service.createPlan(createInput);
    expect(plan).toEqual({
      id: 'plan-1',
      code: 'TEST_FREE',
      tier: 'TEST_FREE',
      nameRo: 'Test gratuit',
      nameEn: null,
      priceRon: 0,
      includedCredits: 0,
      marketplaceGatingDelayMin: 60,
      isActive: true,
      isFree: true,
      features: { MARKETPLACE_ACCESS: { enabled: false, limit: null } },
    });
    expect(tx.subscriptionPlan.create.mock.calls[0][0].data).not.toHaveProperty('tier');
    expect(tx.subscriptionPlanFeature.createMany).toHaveBeenCalledWith({
      data: [{ planId: 'plan-1', featureKey: 'MARKETPLACE_ACCESS', enabled: false }],
    });
  });

  it('cod duplicat → 409 PLAN_CODE_TAKEN', async () => {
    const { service } = makeService([GOLD]);
    const err = await service.createPlan({ ...createInput, code: 'GOLD' }).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toMatchObject({ code: 'PLAN_CODE_TAKEN' });
  });

  it('actualizare cu pret 0 → acceptata, planul devine gratuit', async () => {
    const { service } = makeService([GOLD]);
    const plan = await service.updatePlan('plan-gold', { priceRon: 0 });
    expect(plan).toMatchObject({ code: 'GOLD', priceRon: 0, isFree: true });
  });

  it('functiile se actualizeaza prin upsert (existent → update; lipsa → create)', async () => {
    const { service, tx } = makeService([GOLD, { ...GOLD, id: 'plan-bare', code: 'BARE', tier: null, features: [] }]);
    const off = await service.updatePlan('plan-gold', { features: { MARKETPLACE_ACCESS: { enabled: false } } });
    expect(off.features.MARKETPLACE_ACCESS).toEqual({ enabled: false, limit: null });
    expect(tx.subscriptionPlanFeature.upsert).toHaveBeenLastCalledWith({
      where: { planId_featureKey: { planId: 'plan-gold', featureKey: 'MARKETPLACE_ACCESS' } },
      update: { enabled: false },
      create: { planId: 'plan-gold', featureKey: 'MARKETPLACE_ACCESS', enabled: false, limitValue: null },
    });
    const on = await service.updatePlan('plan-bare', { features: { MARKETPLACE_ACCESS: { enabled: true, limit: 5 } } });
    expect(on.features.MARKETPLACE_ACCESS).toEqual({ enabled: true, limit: 5 });
  });

  it('nume: null/gol → sters; fara features → nicio scriere de functii', async () => {
    const { service, tx } = makeService([{ ...GOLD, nameRo: 'Aur' }]);
    const plan = await service.updatePlan('plan-gold', { nameRo: null, nameEn: '  Gold  ' });
    expect(plan).toMatchObject({ nameRo: null, nameEn: 'Gold' });
    expect(tx.subscriptionPlanFeature.upsert).not.toHaveBeenCalled();
  });

  it('plan inexistent → 404', async () => {
    const { service } = makeService([]);
    await expect(service.updatePlan('nope', { priceRon: 1 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getPlans intoarce codul, isFree si functiile rezolvate', async () => {
    const { service } = makeService([GOLD]);
    await expect(service.getPlans()).resolves.toEqual([
      expect.objectContaining({ code: 'GOLD', tier: 'GOLD', isFree: false, features: { MARKETPLACE_ACCESS: { enabled: true, limit: null } } }),
    ]);
  });
});

describe('CreatePlanDto / UpdatePlanDto (E-admin-platform-58)', () => {
  const errorsOf = async (cls: new () => object, body: object) =>
    (await validate(plainToInstance(cls, body), { whitelist: true, forbidNonWhitelisted: true })).map((e) => e.property);

  it('body valid → fara erori', async () => {
    await expect(errorsOf(CreatePlanDto, createInput)).resolves.toEqual([]);
  });

  it.each(['gold', 'G', '1ABC', 'A-B', 'A'.repeat(33)])('cod invalid %p → 400 (code)', async (code) => {
    await expect(errorsOf(CreatePlanDto, { ...createInput, code })).resolves.toContain('code');
  });

  it('features lipsa sau fara MARKETPLACE_ACCESS → 400 (alegere explicita)', async () => {
    const { features: _f, ...noFeatures } = createInput;
    await expect(errorsOf(CreatePlanDto, noFeatures)).resolves.toContain('features');
    await expect(errorsOf(CreatePlanDto, { ...createInput, features: {} })).resolves.toContain('features');
  });

  it('pret negativ → 400; pret 0 pe update → ok', async () => {
    await expect(errorsOf(CreatePlanDto, { ...createInput, priceRon: -1 })).resolves.toContain('priceRon');
    await expect(errorsOf(UpdatePlanDto, { priceRon: 0 })).resolves.toEqual([]);
    await expect(errorsOf(UpdatePlanDto, { priceRon: -1 })).resolves.toContain('priceRon');
  });

  it('valori peste INT4 (limit / gating) → 400, nu 500 din Postgres', async () => {
    await expect(errorsOf(CreatePlanDto, { ...createInput, marketplaceGatingDelayMin: 2_147_483_648 })).resolves.toContain('marketplaceGatingDelayMin');
    await expect(errorsOf(UpdatePlanDto, { features: { MARKETPLACE_ACCESS: { enabled: true, limit: 2_147_483_648 } } })).resolves.toContain('features');
    await expect(errorsOf(UpdatePlanDto, { features: { MARKETPLACE_ACCESS: { enabled: true, limit: 5 } } })).resolves.toEqual([]);
    await expect(errorsOf(UpdatePlanDto, { includedCredits: 2_147_483_648, marketplaceGatingDelayMin: 2_147_483_648 })).resolves.toEqual(['includedCredits', 'marketplaceGatingDelayMin']);
  });

  it('codul nu se poate schimba prin update (forbidNonWhitelisted)', async () => {
    await expect(errorsOf(UpdatePlanDto, { code: 'OTHER' })).resolves.toContain('code');
  });
});
