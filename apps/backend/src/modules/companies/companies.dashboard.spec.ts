import { CompaniesService } from './companies.service';

// E-admin-platform-44 — lista "De facut acum" a firmei: OWNER/MANAGER vad preluarile
// neatribuite + toate termenele SLA apropiate; angajatii doar termenele lor.

/* eslint-disable @typescript-eslint/no-explicit-any */
function setup(role: string) {
  const now = Date.now();
  const assignDeadlineAt = new Date(now + 20 * 60 * 1000);
  const slaDeadlineAt = new Date(now + 5 * 60 * 60 * 1000);
  const claimFindMany = jest.fn(async (args: any) => {
    if (args.where.assignedToUserId === null && !args.where.slaDeadlineAt) {
      return [{ id: 's-unassigned', requestId: 'r1', request: { title: 'Dulap' }, assignDeadlineAt }];
    }
    return [{ id: 's-sla', requestId: 'r2', request: { title: 'Birou' }, slaDeadlineAt }];
  });
  const prisma: any = {
    companyMember: { findUnique: jest.fn().mockResolvedValue({ companyId: 'c1', userId: 'u1', role }) },
    claimSlot: { groupBy: jest.fn().mockResolvedValue([]), findMany: claimFindMany },
    companyCreditWallet: { findUnique: jest.fn().mockResolvedValue(null) },
    creditTransaction: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    penaltyEvent: { aggregate: jest.fn().mockResolvedValue({ _sum: { points: 0 } }) },
    $queryRaw: jest.fn().mockResolvedValue([{ quotes: 0, total: 0 }]),
    user: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const service = new CompaniesService(prisma, {} as any, {} as any, {} as any);
  return { service, prisma, claimFindMany, assignDeadlineAt, slaDeadlineAt };
}

describe('CompaniesService.dashboardStats — actions', () => {
  it('OWNER: preluari neatribuite + termene SLA, sortate dupa termen', async () => {
    const { service, claimFindMany, assignDeadlineAt, slaDeadlineAt } = setup('OWNER');
    const stats = await service.dashboardStats('u1');
    expect(stats.actions).toEqual([
      { kind: 'UNASSIGNED_CLAIM', requestId: 'r1', claimSlotId: 's-unassigned', title: 'Dulap', count: null, dueAt: assignDeadlineAt.toISOString() },
      { kind: 'SLA_DUE_SOON', requestId: 'r2', claimSlotId: 's-sla', title: 'Birou', count: null, dueAt: slaDeadlineAt.toISOString() },
    ]);
    // interogarile sunt limitate la firma membrului; OWNER nu primeste filtrul OR
    for (const call of claimFindMany.mock.calls) expect(call[0].where.companyId).toBe('c1');
    const slaCall: any[] = claimFindMany.mock.calls.find((c: any[]) => c[0].where.slaDeadlineAt) ?? [];
    expect(slaCall[0].where.OR).toBeUndefined();
    expect(slaCall[0].where.slaPausedAt).toBeNull();
  });

  it('EMPLOYEE_TRUSTED: fara UNASSIGNED_CLAIM, iar termenele SLA sunt doar ale lui', async () => {
    const { service, claimFindMany } = setup('EMPLOYEE_TRUSTED');
    const stats = await service.dashboardStats('u1');
    expect(stats.actions.map((a) => a.kind)).toEqual(['SLA_DUE_SOON']);
    expect(claimFindMany).toHaveBeenCalledTimes(1);
    expect(claimFindMany.mock.calls[0][0].where.OR).toEqual([
      { assignedToUserId: 'u1' },
      { assignedToUserId: null, claimedByUserId: 'u1' },
    ]);
  });
});

describe('CompaniesService.dashboardStats — wallet', () => {
  it('available = balance (rezervarile sunt deja scazute din balance, 4.8)', async () => {
    const { service, prisma } = setup('OWNER');
    prisma.companyCreditWallet.findUnique.mockResolvedValue({ balance: 10, reserved: 8 });
    const stats = await service.dashboardStats('u1');
    expect(stats.wallet).toEqual({ balance: 10, reserved: 8, available: 10 });
  });

  it('available nu devine negativ cand rezervarile depasesc balance', async () => {
    const { service, prisma } = setup('OWNER');
    prisma.companyCreditWallet.findUnique.mockResolvedValue({ balance: 2, reserved: 8 });
    const stats = await service.dashboardStats('u1');
    expect(stats.wallet).toEqual({ balance: 2, reserved: 8, available: 2 });
  });
});
