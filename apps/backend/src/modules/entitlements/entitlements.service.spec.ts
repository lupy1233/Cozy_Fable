import type { PrismaService } from '../../infra/prisma/prisma.service';
import { freezeClock, restoreClock } from '../../test/clock';
import { EntitlementsService, activeSubscriptionWhere } from './entitlements.service';

// E-admin-platform-58 — entitlements = abonamentul activ + functiile planului, un singur query.

const NOW = '2026-09-01T10:00:00Z';

function setup(subscription: unknown) {
  const findFirst = jest.fn().mockResolvedValue(subscription);
  const service = new EntitlementsService({ subscription: { findFirst } } as unknown as PrismaService);
  return { service, findFirst };
}

const sub = (planOver: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => ({
  id: 'sub1',
  isTrial: false,
  expiresAt: new Date('2026-09-20T10:00:00Z'),
  plan: {
    id: 'p1',
    code: 'GOLD',
    nameRo: 'Aur',
    nameEn: 'Gold',
    priceRon: 399,
    marketplaceGatingDelayMin: 30,
    features: [{ featureKey: 'MARKETPLACE_ACCESS', enabled: true, limitValue: null }],
    ...planOver,
  },
  ...over,
});

describe('EntitlementsService (E-admin-platform-58)', () => {
  let now: Date;
  beforeEach(() => {
    now = freezeClock(NOW);
  });
  afterEach(() => restoreClock());

  it('activeSubscriptionWhere = ACTIVE si neexpirat (predicatul unic)', () => {
    expect(activeSubscriptionWhere()).toEqual({ status: 'ACTIVE', expiresAt: { gt: now } });
    const at = new Date('2026-01-01T00:00:00Z');
    expect(activeSubscriptionWhere(at)).toEqual({ status: 'ACTIVE', expiresAt: { gt: at } });
  });

  it('fara abonament activ → null-uri + functii implicite (dezactivate)', async () => {
    const { service } = setup(null);
    const e = await service.forCompany('c1');
    expect(e).toEqual({
      subscriptionId: null,
      planId: null,
      planCode: null,
      nameRo: null,
      nameEn: null,
      isFree: false,
      isTrial: false,
      expiresAt: null,
      gatingDelayMinutes: null,
      features: { MARKETPLACE_ACCESS: { enabled: false, limit: null } },
    });
    expect(service.has(e, 'MARKETPLACE_ACCESS')).toBe(false);
  });

  it('abonament activ + functie activa → planul si functiile lui', async () => {
    const { service, findFirst } = setup(sub());
    const e = await service.forCompany('c1');
    expect(e).toMatchObject({
      subscriptionId: 'sub1',
      planId: 'p1',
      planCode: 'GOLD',
      nameRo: 'Aur',
      nameEn: 'Gold',
      isFree: false,
      gatingDelayMinutes: 30,
      features: { MARKETPLACE_ACCESS: { enabled: true, limit: null } },
    });
    expect(service.has(e, 'MARKETPLACE_ACCESS')).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: { companyId: 'c1', status: 'ACTIVE', expiresAt: { gt: now } },
      include: { plan: { include: { features: true } } },
      orderBy: { expiresAt: 'desc' },
    });
  });

  it('abonamentul expirat e ignorat prin predicat (query-ul cere expiresAt > now)', async () => {
    const { service, findFirst } = setup(null);
    const e = await service.forCompany('c1');
    const where = findFirst.mock.calls[0][0].where;
    expect(where.expiresAt).toEqual({ gt: now });
    expect(where.status).toBe('ACTIVE');
    expect(e.subscriptionId).toBeNull();
  });

  it('rand de functie lipsa → functie dezactivata', async () => {
    const { service } = setup(sub({ features: [] }));
    const e = await service.forCompany('c1');
    expect(e.subscriptionId).toBe('sub1');
    expect(service.has(e, 'MARKETPLACE_ACCESS')).toBe(false);
  });

  it('cheie de functie necunoscuta → ignorata', async () => {
    const { service } = setup(sub({ features: [{ featureKey: 'AI_READS', enabled: true, limitValue: 10 }] }));
    const e = await service.forCompany('c1');
    expect(Object.keys(e.features)).toEqual(['MARKETPLACE_ACCESS']);
    expect(e.features.MARKETPLACE_ACCESS.enabled).toBe(false);
  });

  it('priceRon 0 → isFree; toDto serializeaza expiresAt', async () => {
    const { service } = setup(sub({ priceRon: 0, code: 'TEST_FREE' }, { isTrial: true }));
    const e = await service.forCompany('c1');
    expect(e.isFree).toBe(true);
    expect(service.toDto(e)).toEqual({
      planId: 'p1',
      planCode: 'TEST_FREE',
      nameRo: 'Aur',
      nameEn: 'Gold',
      isFree: true,
      isTrial: true,
      expiresAt: '2026-09-20T10:00:00.000Z',
      gatingDelayMinutes: 30,
      features: { MARKETPLACE_ACCESS: { enabled: true, limit: null } },
      lastExpired: null,
    });
  });

  it('h2: toDto pune lastExpired doar cand nu exista abonament activ', async () => {
    const last = { planCode: 'GOLD', nameRo: 'Aur', nameEn: 'Gold', expiredAt: '2026-08-20T10:00:00.000Z' };
    const active = await setup(sub()).service.forCompany('c1');
    expect(setup(null).service.toDto(active, last).lastExpired).toBeNull();
    const { service } = setup(null);
    const none = await service.forCompany('c1');
    expect(service.toDto(none, last).lastExpired).toEqual(last);
    expect(service.toDto(none).lastExpired).toBeNull();
  });

  it('h2: lastExpired = ultimul abonament incheiat (data expirarii)', async () => {
    const { service, findFirst } = setup({
      id: 'sub-old',
      status: 'ACTIVE',
      expiresAt: new Date('2026-08-20T10:00:00Z'),
      plan: { code: 'SILVER', nameRo: 'Argint', nameEn: 'Silver' },
    });
    await expect(service.lastExpired('c1')).resolves.toEqual({
      planCode: 'SILVER',
      nameRo: 'Argint',
      nameEn: 'Silver',
      expiredAt: '2026-08-20T10:00:00.000Z',
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { companyId: 'c1', expiresAt: { lte: now } },
      include: { plan: true },
      orderBy: { expiresAt: 'desc' },
    });
  });

  it('m4: doar expirarile reale (data trecuta) conteaza; un rand anulat cu data in viitor nu da o data inventata', async () => {
    // query-ul cere expiresAt <= acum, deci randul anulat cu data in viitor nu e gasit → null
    const { service, findFirst } = setup(null);
    await expect(service.lastExpired('c1')).resolves.toBeNull();
    const where = findFirst.mock.calls[0][0].where;
    expect(where).toEqual({ companyId: 'c1', expiresAt: { lte: now } });
    expect(where).not.toHaveProperty('OR');
  });

  it('foloseste clientul de tranzactie cand e dat', async () => {
    const { service, findFirst } = setup(null);
    const txFind = jest.fn().mockResolvedValue(null);
    await service.forCompany('c1', { subscription: { findFirst: txFind } } as never);
    expect(txFind).toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
