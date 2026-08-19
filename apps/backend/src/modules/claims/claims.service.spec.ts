import { ClaimsService } from './claims.service';

// L0-B — verificari in tranzactia de claim (3.1), cu Prisma mock-uit:
//  - gating per plan (4.10): published_at + delay(plan) > now → GATING_NOT_OPEN;
//  - cerere stearsa (soft delete) → CLAIM_NOT_ALLOWED (nu se rezerva credite).

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

function makeService(lockedRow: Any) {
  const tx: Any = {
    $queryRaw: jest.fn().mockResolvedValue(lockedRow ? [lockedRow] : []),
    claimSlot: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    requestCompanyExclusion: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const prisma: Any = {
    $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)),
    companyMember: { findUnique: jest.fn() },
  };
  const credits: Any = { reserve: jest.fn() };
  const settings: Any = { getInt: jest.fn().mockResolvedValue(3) };
  const eventBus: Any = { publish: jest.fn() };
  const calendar: Any = { addWorkingDays: jest.fn() };
  const queue: Any = { add: jest.fn() };
  const service = new ClaimsService(prisma, credits, settings, eventBus, calendar, queue, queue);
  return { service, tx, credits };
}

const MIN = 60_000;
const baseRow = {
  id: 'r1',
  status: 'IN_MARKETPLACE',
  deleted_at: null,
  published_at: new Date(Date.now() - 10 * MIN),
  lat: 44.4,
  lng: 26.1,
  project_size: 'SMALL',
  project_score: 10,
  credit_cost: 1,
};
const dto: Any = { requestId: 'r1' };

describe('ClaimsService.create — verificari sub lock (L0-B)', () => {
  it('gating-ul planului nu a trecut (Gold +30 min, publicata acum 10 min) → GATING_NOT_OPEN 403', async () => {
    const { service, tx, credits } = makeService(baseRow);
    const ctx: Any = { companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED', gatingDelayMinutes: 30 };
    await expect(service.create(ctx, 'u1', dto)).rejects.toMatchObject({
      status: 403,
      response: { code: 'GATING_NOT_OPEN' },
    });
    expect(tx.claimSlot.create).not.toHaveBeenCalled();
    expect(credits.reserve).not.toHaveBeenCalled();
  });

  it('gating trecut (Platinum +0) → trece de verificarea de gating (urmatoarea verificare e sloturile)', async () => {
    const { service, tx } = makeService(baseRow);
    tx.claimSlot.count.mockResolvedValue(3); // sloturi pline → ne oprim acolo, dupa gating
    const ctx: Any = { companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED', gatingDelayMinutes: 0 };
    await expect(service.create(ctx, 'u1', dto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'CLAIM_SLOTS_FULL' },
    });
  });

  it('cerere stearsa de client (deleted_at) → CLAIM_NOT_ALLOWED, fara rezervare de credite', async () => {
    const { service, credits } = makeService({ ...baseRow, deleted_at: new Date() });
    const ctx: Any = { companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED', gatingDelayMinutes: 0 };
    await expect(service.create(ctx, 'u1', dto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'CLAIM_NOT_ALLOWED' },
    });
    expect(credits.reserve).not.toHaveBeenCalled();
  });

  it('cerere fara published_at → CLAIM_NOT_ALLOWED', async () => {
    const { service } = makeService({ ...baseRow, published_at: null });
    const ctx: Any = { companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED' };
    await expect(service.create(ctx, 'u1', dto)).rejects.toMatchObject({
      response: { code: 'CLAIM_NOT_ALLOWED' },
    });
  });
});
