import type { SettingsService } from '../../common/settings/settings.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { SubscriptionsService } from '../billing/subscriptions.service';
import type { OutboxService } from '../outbox/outbox.service';
import { CompaniesService } from './companies.service';

// E-admin-platform-14 — caracterizare adminApprove (4.6/4.16): statusul, profilul de verificare,
// trialul si intentia outbox se scriu in ACEEASI tranzactie (trialul primeste tx-ul aprobarii,
// deci creditele bonus nu pot aparea fara aprobare si nici invers).

function setup(company: unknown = { id: 'c1', status: 'PENDING_VERIFICATION' }) {
  const tx = {
    company: { update: jest.fn().mockResolvedValue({ id: 'c1', status: 'APPROVED' }) },
    companyVerificationProfile: { update: jest.fn().mockResolvedValue({}) },
    companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]) },
  };
  const prisma = {
    company: { findFirst: jest.fn().mockResolvedValue(company) },
    companyPortfolioItem: { count: jest.fn().mockResolvedValue(2) },
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const subscriptions = { startTrialIfEnabled: jest.fn().mockResolvedValue(undefined) };
  const outbox = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new CompaniesService(
    prisma as unknown as PrismaService,
    subscriptions as unknown as SubscriptionsService,
    outbox as unknown as OutboxService,
    {} as unknown as SettingsService,
  );
  return { service, prisma, tx, subscriptions, outbox };
}

describe('CompaniesService.adminApprove (E-admin-platform-14)', () => {
  it('firma necunoscuta sau stearsa → 404 NOT_FOUND, fara tranzactie', async () => {
    const { service, prisma, subscriptions } = setup(null);
    await expect(service.adminApprove('c1', 'admin1')).rejects.toMatchObject({
      status: 404,
      response: { code: 'NOT_FOUND' },
    });
    // filtrul exclude firmele sterse (soft delete)
    expect(prisma.company.findFirst).toHaveBeenCalledWith({ where: { id: 'c1', deletedAt: null } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(subscriptions.startTrialIfEnabled).not.toHaveBeenCalled();
  });

  it('drumul fericit: APPROVED + profil revizuit + trial in ACELASI tx + company.approved', async () => {
    const { service, tx, subscriptions, outbox } = setup();
    await expect(service.adminApprove('c1', 'admin1')).resolves.toEqual({ id: 'c1', status: 'APPROVED' });

    expect(tx.company.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'APPROVED', rejectedAt: null, rejectionReason: null },
    });
    expect(tx.companyVerificationProfile.update).toHaveBeenCalledWith({
      where: { companyId: 'c1' },
      data: expect.objectContaining({ reviewedByUserId: 'admin1', reviewedAt: expect.any(Date) }),
    });
    expect(subscriptions.startTrialIfEnabled).toHaveBeenCalledWith('c1', tx);
    expect(outbox.record).toHaveBeenCalledTimes(1);
    const [recordTx, key, type, payload, targets] = outbox.record.mock.calls[0];
    expect(recordTx).toBe(tx);
    expect(key).toMatch(/^company\.approved:c1:/);
    expect(type).toBe('company.approved');
    expect(payload).toEqual({ companyId: 'c1' });
    expect(targets).toEqual(['u1', 'u2']);
  });
});
