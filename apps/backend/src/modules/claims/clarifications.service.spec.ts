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

// Pasul 5 (audit 2026-08-23, F6): raspunsul clientului muta deadline-ul SLA inainte cu durata
// pauzei si REprogrameaza verificarea de breach — inainte, un raspuns venit dupa ce jobul vechi
// rulase no-op lasa slotul ACTIVE fara niciun ceas (ratarea nu se mai aplica niciodata).
describe('ClarificationsService.answer (F6 — SLA se reprogrameaza)', () => {
  const HOUR = 60 * 60 * 1000;

  function makeAnswerService(slotOverrides: Any = {}) {
    const pausedAt = new Date(Date.now() - 5 * HOUR);
    const deadline = new Date(Date.now() + 10 * HOUR);
    const clarification: Any = {
      id: 'cl1',
      claimSlotId: 's1',
      status: 'PENDING',
      questionText: 'Q',
      answerText: null,
      answeredAt: null,
      createdAt: new Date(),
      claimSlot: {
        id: 's1',
        status: 'ACTIVE',
        slaPausedAt: pausedAt,
        slaDeadlineAt: deadline,
        request: { clientUserId: 'u-client' },
        ...slotOverrides,
      },
    };
    const tx: Any = {
      clarificationRequest: {
        update: jest.fn().mockImplementation(({ data }: Any) =>
          Promise.resolve({ ...clarification, ...data }),
        ),
      },
      claimSlot: { update: jest.fn().mockResolvedValue(undefined) },
    };
    const prisma: Any = {
      clarificationRequest: { findUnique: jest.fn().mockResolvedValue(clarification) },
      $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)),
    };
    const claims: Any = { scheduleSlaBreach: jest.fn().mockResolvedValue(undefined) };
    const service = new ClarificationsService(prisma, {} as Any, {} as Any, claims);
    return { service, tx, claims, pausedAt, deadline };
  }

  it('muta deadline-ul cu durata pauzei si reprogrameaza jobul de breach', async () => {
    const { service, tx, claims, deadline } = makeAnswerService();
    await service.answer('u-client', 'cl1', { answerText: 'A' } as Any);
    const updateData = tx.claimSlot.update.mock.calls[0][0].data;
    expect(updateData.slaPausedAt).toBeNull();
    expect(updateData.slaDeadlineAt.getTime()).toBeGreaterThan(deadline.getTime());
    expect(claims.scheduleSlaBreach).toHaveBeenCalledWith('s1', updateData.slaDeadlineAt);
  });

  it('slot care nu mai e ACTIVE (oferta trimisa intre timp) → doar curata pauza, fara reprogramare', async () => {
    const { service, tx, claims } = makeAnswerService({ status: 'OFFER_SENT' });
    await service.answer('u-client', 'cl1', { answerText: 'A' } as Any);
    const updateData = tx.claimSlot.update.mock.calls[0][0].data;
    expect(updateData.slaPausedAt).toBeNull();
    expect(updateData.slaDeadlineAt).toBeUndefined();
    expect(claims.scheduleSlaBreach).not.toHaveBeenCalled();
  });
});
