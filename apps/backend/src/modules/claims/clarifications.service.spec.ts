import { ClarificationsService } from './clarifications.service';

// L0-B — IDOR: GET /claims/:id/clarifications doar pentru firma detinatoare a claim-ului.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

function makeService(slot: Any) {
  const prisma: Any = {
    claimSlot: { findUnique: jest.fn().mockResolvedValue(slot) },
    clarificationRequest: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'cl1',
          claimSlotId: 's1',
          questionText: 'Ce inaltime are tavanul?',
          answerText: null,
          status: 'PENDING',
          answeredAt: null,
          createdAt: new Date(),
        },
      ]),
    },
  };
  const service = new ClarificationsService(prisma, {} as Any, {} as Any, {} as Any);
  return { service, prisma };
}

describe('ClarificationsService.listForClaim (IDOR, L0-B)', () => {
  const ctx: Any = { companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED' };

  it('firma detinatoare vede clarificarile claim-ului ei', async () => {
    const { service } = makeService({ id: 's1', companyId: 'c1' });
    const rows = await service.listForClaim(ctx, 's1');
    expect(rows).toHaveLength(1);
    expect(rows[0].questionText).toBe('Ce inaltime are tavanul?');
  });

  it('claim-ul altei firme → NOT_FOUND (fara scurgere de continut)', async () => {
    const { service, prisma } = makeService({ id: 's1', companyId: 'c-other' });
    await expect(service.listForClaim(ctx, 's1')).rejects.toMatchObject({ status: 404 });
    expect(prisma.clarificationRequest.findMany).not.toHaveBeenCalled();
  });

  it('claim inexistent → NOT_FOUND', async () => {
    const { service } = makeService(null);
    await expect(service.listForClaim(ctx, 's1')).rejects.toMatchObject({ status: 404 });
  });
});
