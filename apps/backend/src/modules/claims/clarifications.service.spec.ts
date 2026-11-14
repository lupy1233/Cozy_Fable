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
  const service = new ClarificationsService(prisma, {} as Any, {} as Any, {} as Any, {} as Any);
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
        companyId: 'co-1',
        requestId: 'req-1',
        request: { clientUserId: 'u-client', title: 'Bucătărie — Cluj' },
        company: { name: 'Firma Unu' },
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
      companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'm1' }, { userId: 'm2' }]) },
    };
    const prisma: Any = {
      clarificationRequest: { findUnique: jest.fn().mockResolvedValue(clarification) },
      $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)),
    };
    const claims: Any = { scheduleSlaBreach: jest.fn().mockResolvedValue(undefined) };
    const outbox: Any = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new ClarificationsService(prisma, {} as Any, {} as Any, claims, outbox);
    return { service, tx, claims, outbox, pausedAt, deadline };
  }

  it('e3: raspunsul scrie clarification.answered in tranzactie, catre toti membrii firmei', async () => {
    const { service, tx, outbox } = makeAnswerService();
    await service.answer('u-client', 'cl1', { answerText: 'A' } as Any);
    expect(outbox.record).toHaveBeenCalledTimes(1);
    const [usedTx, key, event, payload, targets] = outbox.record.mock.calls[0];
    expect(usedTx).toBe(tx);
    expect(key).toBe('clarification.answered:cl1');
    expect(event).toBe('clarification.answered');
    expect(payload).toEqual({
      requestId: 'req-1',
      requestTitle: 'Bucătărie — Cluj',
      claimSlotId: 's1',
      companyId: 'co-1',
      companyName: 'Firma Unu',
      clientUserId: 'u-client',
      actorUserId: 'u-client',
    });
    expect(tx.companyMember.findMany).toHaveBeenCalledWith({ where: { companyId: 'co-1' }, select: { userId: true } });
    expect(targets).toEqual(['m1', 'm2']);
  });

  it('e3: raspuns refuzat (alt client) → niciun eveniment', async () => {
    const { service, outbox } = makeAnswerService();
    await expect(service.answer('u-other', 'cl1', { answerText: 'A' } as Any)).rejects.toMatchObject({ status: 403 });
    expect(outbox.record).not.toHaveBeenCalled();
  });

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

// e3 (etapa 9): intrebarea firmei anunta clientul, prin outbox, in aceeasi tranzactie.
describe('ClarificationsService.request — clarification.asked (e3)', () => {
  const ctx: Any = { companyId: 'co-1', memberRole: 'OWNER', status: 'APPROVED' };

  function makeRequestService(slotOverrides: Any = {}) {
    const slot: Any = {
      id: 's1',
      companyId: 'co-1',
      requestId: 'req-1',
      status: 'ACTIVE',
      slaDeadlineAt: new Date('2026-11-20T10:00:00Z'),
      request: { deletedAt: null, title: 'Bucătărie — Cluj', clientUserId: 'u-client' },
      company: { name: 'Firma Unu' },
      ...slotOverrides,
    };
    const tx: Any = {
      clarificationRequest: {
        create: jest.fn().mockImplementation(({ data }: Any) =>
          Promise.resolve({ id: 'cl9', status: 'PENDING', answerText: null, answeredAt: null, createdAt: new Date(), ...data }),
        ),
      },
      claimSlot: { update: jest.fn().mockResolvedValue(undefined) },
    };
    const prisma: Any = {
      claimSlot: { findUnique: jest.fn().mockResolvedValue(slot) },
      clarificationRequest: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)),
    };
    const calendar: Any = { addWorkingDays: jest.fn().mockReturnValue(new Date('2026-11-21T10:00:00Z')) };
    const claims: Any = { scheduleSlaBreach: jest.fn().mockResolvedValue(undefined) };
    const outbox: Any = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new ClarificationsService(prisma, calendar, {} as Any, claims, outbox);
    return { service, tx, outbox };
  }

  it('scrie clarification.asked catre client, cu campurile din contract', async () => {
    const { service, tx, outbox } = makeRequestService();
    await service.request(ctx, 'u-firm', 's1', { questionText: 'Ce inaltime are tavanul?' } as Any);
    expect(outbox.record).toHaveBeenCalledTimes(1);
    const [usedTx, key, event, payload, targets] = outbox.record.mock.calls[0];
    expect(usedTx).toBe(tx);
    expect(key).toBe('clarification.asked:cl9');
    expect(event).toBe('clarification.asked');
    expect(payload).toEqual({
      requestId: 'req-1',
      requestTitle: 'Bucătărie — Cluj',
      claimSlotId: 's1',
      companyId: 'co-1',
      companyName: 'Firma Unu',
      clientUserId: 'u-client',
      actorUserId: 'u-firm',
    });
    expect(targets).toEqual(['u-client']);
  });

  it('preluare care nu mai e ACTIVE → refuz, niciun eveniment', async () => {
    const { service, outbox } = makeRequestService({ status: 'WITHDRAWN' });
    await expect(service.request(ctx, 'u-firm', 's1', { questionText: 'Q?' } as Any)).rejects.toMatchObject({ status: 409 });
    expect(outbox.record).not.toHaveBeenCalled();
  });
});

describe('ClarificationsService.listForClientRequest (e3 — istoric cu firma)', () => {
  it('intoarce si intrebarile cu raspuns, cu numele firmei', async () => {
    const prisma: Any = {
      request: { findUnique: jest.fn().mockResolvedValue({ id: 'req-1', clientUserId: 'u-client' }) },
      clarificationRequest: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'a', claimSlotId: 's1', questionText: 'Q1', answerText: 'R1', status: 'ANSWERED', answeredAt: new Date('2026-11-10T10:00:00Z'), createdAt: new Date('2026-11-09T10:00:00Z'), claimSlot: { company: { name: 'Firma Unu' } } },
          { id: 'b', claimSlotId: 's2', questionText: 'Q2', answerText: null, status: 'PENDING', answeredAt: null, createdAt: new Date('2026-11-11T10:00:00Z'), claimSlot: { company: { name: 'Firma Doi' } } },
        ]),
      },
    };
    const service = new ClarificationsService(prisma, {} as Any, {} as Any, {} as Any, {} as Any);
    const rows = await service.listForClientRequest('u-client', 'req-1');
    expect(prisma.clarificationRequest.findMany.mock.calls[0][0].where).toEqual({ claimSlot: { requestId: 'req-1' } });
    expect(rows.map((r) => [r.status, r.companyName])).toEqual([['ANSWERED', 'Firma Unu'], ['PENDING', 'Firma Doi']]);
    expect(rows[0]).not.toHaveProperty('claimSlot');
  });
});

describe('ClarificationsService.editChangesForClaim (e3 — ce s-a schimbat)', () => {
  const ctx: Any = { companyId: 'co-1', memberRole: 'OWNER', status: 'APPROVED' };
  const claimedAt = new Date('2026-11-10T10:00:00Z');
  const v1 = { budgetRange: 'UNDER_5K', city: 'Cluj-Napoca', county: 'Cluj', rooms: [{ roomType: 'KITCHEN', flowVersion: 1, answers: { material: 'PAL' } }] };
  const v2 = { ...v1, budgetRange: 'FROM_5K_TO_15K', rooms: [{ roomType: 'KITCHEN', flowVersion: 1, answers: { material: 'MDF' } }] };

  function make(slot: Any, versions: Any[]) {
    const prisma: Any = {
      claimSlot: { findUnique: jest.fn().mockResolvedValue(slot) },
      requestVersion: { findMany: jest.fn().mockResolvedValue(versions) },
    };
    return { service: new ClarificationsService(prisma, {} as Any, {} as Any, {} as Any, {} as Any), prisma };
  }
  const openSlot = { id: 's1', companyId: 'co-1', requestId: 'req-1', status: 'ACTIVE', createdAt: claimedAt, request: { deletedAt: null } };

  it('editare dupa preluare → data editarii + campurile si camerele schimbate', async () => {
    const editedAt = new Date('2026-11-12T08:00:00Z');
    const { service } = make(openSlot, [
      { snapshot: v2, createdAt: editedAt },
      { snapshot: v1, createdAt: new Date('2026-11-09T08:00:00Z') },
    ]);
    const res = await service.editChangesForClaim(ctx, 's1');
    expect(res.edit).toEqual({
      editedAt: editedAt.toISOString(),
      comparable: true,
      fields: ['budget'],
      rooms: [{ change: 'MODIFIED', roomType: 'KITCHEN', ordinal: 1, ofType: 1, detailed: true, aspects: ['answers'] }],
    });
  });

  it('ultima editare e dinaintea preluarii → fara caseta', async () => {
    const { service } = make(openSlot, [
      { snapshot: v2, createdAt: new Date('2026-11-09T12:00:00Z') },
      { snapshot: v1, createdAt: new Date('2026-11-09T08:00:00Z') },
    ]);
    await expect(service.editChangesForClaim(ctx, 's1')).resolves.toEqual({ edit: null });
  });

  it('o singura copie (nicio editare) → fara caseta', async () => {
    const { service } = make(openSlot, [{ snapshot: v1, createdAt: new Date('2026-11-09T08:00:00Z') }]);
    await expect(service.editChangesForClaim(ctx, 's1')).resolves.toEqual({ edit: null });
  });

  it('preluare inchisa → fara caseta, fara citirea copiilor', async () => {
    const { service, prisma } = make({ ...openSlot, status: 'WITHDRAWN' }, []);
    await expect(service.editChangesForClaim(ctx, 's1')).resolves.toEqual({ edit: null });
    expect(prisma.requestVersion.findMany).not.toHaveBeenCalled();
  });

  it('preluarea altei firme → NOT_FOUND', async () => {
    const { service, prisma } = make({ ...openSlot, companyId: 'co-other' }, []);
    await expect(service.editChangesForClaim(ctx, 's1')).rejects.toMatchObject({ status: 404 });
    expect(prisma.requestVersion.findMany).not.toHaveBeenCalled();
  });
});
