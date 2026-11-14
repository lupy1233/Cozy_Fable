import { CompaniesService, quoteTotalsByCurrency } from './companies.service';

// h3 (etapa 9) — valoarea ofertelor pe panoul firmei: totaluri separate pe moneda, fara conversie.

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('quoteTotalsByCurrency', () => {
  it('lei si euro raman separate; numarul ofertelor se aduna', () => {
    expect(
      quoteTotalsByCurrency([
        { currency: 'RON', quotes: 2, total: 17000 },
        { currency: 'EUR', quotes: 1, total: 3900.5 },
      ]),
    ).toEqual({ quotesSent: 3, quotesTotals: { RON: 17000, EUR: 3900.5 } });
  });

  it('fara oferte → zero pe ambele monede', () => {
    expect(quoteTotalsByCurrency([])).toEqual({ quotesSent: 0, quotesTotals: { RON: 0, EUR: 0 } });
  });

  it('doar euro → leii raman 0 (nu se converteste nimic)', () => {
    expect(quoteTotalsByCurrency([{ currency: 'EUR', quotes: 1, total: 1000 }]).quotesTotals).toEqual({ RON: 0, EUR: 1000 });
  });

  it('moneda necunoscuta se numara, dar nu intra in totaluri; zecimalele se rotunjesc la bani', () => {
    expect(
      quoteTotalsByCurrency([
        { currency: 'RON', quotes: 2, total: 0.1 + 0.2 },
        { currency: 'USD', quotes: 1, total: 50 },
        { currency: null, quotes: 1, total: 10 },
      ]),
    ).toEqual({ quotesSent: 4, quotesTotals: { RON: 0.3, EUR: 0 } });
  });
});

describe('CompaniesService.dashboardStats — quotesTotals', () => {
  it('SQL-ul grupeaza pe moneda si nu mai foloseste cursul eur_ron_rate', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      { currency: 'RON', quotes: 1, total: 8500 },
      { currency: 'EUR', quotes: 1, total: 8500 },
    ]);
    const prisma: any = {
      companyMember: { findUnique: jest.fn().mockResolvedValue({ companyId: 'c1', userId: 'u1', role: 'OWNER' }) },
      claimSlot: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      companyCreditWallet: { findUnique: jest.fn().mockResolvedValue(null) },
      creditTransaction: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
      penaltyEvent: { aggregate: jest.fn().mockResolvedValue({ _sum: { points: 0 } }) },
      $queryRaw: queryRaw,
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new CompaniesService(prisma, {} as any, {} as any, {} as any);
    const stats = await service.dashboardStats('u1');
    expect(stats.quotesSent).toBe(2);
    expect(stats.quotesTotals).toEqual({ RON: 8500, EUR: 8500 });
    expect((stats as any).quotesTotalRon).toBeUndefined();
    const sqlText = (queryRaw.mock.calls[0][0] as readonly string[]).join('?');
    expect(sqlText).toContain('GROUP BY 1');
    expect(sqlText).not.toContain('eur_ron_rate');
    expect(queryRaw.mock.calls[0]).toContain('c1');
  });
});
