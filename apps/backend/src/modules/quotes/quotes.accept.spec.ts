import { HttpException } from '@nestjs/common';
import { FUTURE, makeQuoteFull, makeService, makeVersion } from './quotes.test-fixtures';

// L0-B — masina de stari la acceptarea ofertei (3.1 + 4.14), cu Prisma mock-uit:
//  - refuz cand cererea nu e in OFFERS_RECEIVED/NEGOTIATION (ex. deja ACCEPTED);
//  - a doua acceptare (updateMany conditionat pe status SENT → count 0) → 409;
//  - sloturile nealese: ACTIVE → CANCELLED_REQUEST_ACCEPTED + REFUND,
//    OFFER_SENT → CANCELLED_REQUEST_ACCEPTED + CONSUME (pay-to-play) + oferta SUPERSEDED.
// E-company-2: slotul castigator trebuie sa fie OFFER_SENT sub lock; chitanta in memorie.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

describe('QuotesService.acceptQuote (L0-B)', () => {
  it('refuza cand cererea nu mai e deschisa la acceptare (ex. deja ACCEPTED) — sub lock', async () => {
    const { service, tx } = makeService({ lockedRequest: { status: 'ACCEPTED' } });
    await expect(service.acceptQuote('u-client', 'q1', 'v1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'QUOTE_ACCEPT_NOT_ALLOWED' },
    });
    expect(tx.$queryRaw).toHaveBeenCalled(); // SELECT ... FOR UPDATE pe cerere
    expect(tx.quote.updateMany).not.toHaveBeenCalled();
    expect(tx.request.update).not.toHaveBeenCalled();
  });

  it('cerere stearsa (soft delete) → NOT_FOUND', async () => {
    const { service } = makeService({ lockedRequest: { deleted_at: new Date() } });
    await expect(service.acceptQuote('u-client', 'q1', 'v1')).rejects.toMatchObject({ status: 404 });
  });

  it('a doua acceptare (oferta nu mai e SENT sub lock) → 409, fara efecte', async () => {
    const { service, tx, credits } = makeService();
    tx.quote.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.acceptQuote('u-client', 'q1', 'v1')).rejects.toBeInstanceOf(HttpException);
    expect(tx.request.update).not.toHaveBeenCalled();
    expect(credits.consume).not.toHaveBeenCalled();
    expect(credits.refund).not.toHaveBeenCalled();
  });

  it('updateMany e conditionat pe status SENT (protectie la accept concurent)', async () => {
    const { service, tx } = makeService();
    await service.acceptQuote('u-client', 'q1', 'v1');
    expect(tx.quote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'q1', status: 'SENT' } }),
    );
    expect(tx.request.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'ACCEPTED' } });
  });

  it('nu e cererea clientului → FORBIDDEN', async () => {
    const { service } = makeService();
    await expect(service.acceptQuote('u-altcineva', 'q1', 'v1')).rejects.toMatchObject({ status: 403 });
  });

  it('inchide sloturile nealese: ACTIVE → refund, OFFER_SENT → consum + oferta SUPERSEDED + chat read-only', async () => {
    const losers = [
      { id: 'slot-active', companyId: 'c-b', status: 'ACTIVE', claimCostCreditsSnapshot: 2, slaDeadlineAt: FUTURE },
      { id: 'slot-offer', companyId: 'c-c', status: 'OFFER_SENT', claimCostCreditsSnapshot: 4, slaDeadlineAt: FUTURE },
    ];
    const { service, tx, credits, outbox, queue } = makeService();
    tx.claimSlot.findMany.mockResolvedValue(losers);
    // ledger: fiecare pierzator are RESERVE-ul lui (suma = snapshot)
    tx.creditTransaction.findMany.mockImplementation(async ({ where }: Any) => [
      { type: 'RESERVE', amount: losers.find((l) => l.id === where.claimSlotId)!.claimCostCreditsSnapshot },
    ]);
    await service.acceptQuote('u-client', 'q1', 'v1');

    // ambele sloturi → status terminal, prin biletul conditionat pe statusul citit sub lock
    expect(tx.claimSlot.updateMany).toHaveBeenCalledWith({
      where: { id: 'slot-active', status: { in: ['ACTIVE'] } },
      data: { status: 'CANCELLED_REQUEST_ACCEPTED', withdrawnAt: expect.any(Date) },
    });
    expect(tx.claimSlot.updateMany).toHaveBeenCalledWith({
      where: { id: 'slot-offer', status: { in: ['OFFER_SENT'] } },
      data: { status: 'CANCELLED_REQUEST_ACCEPTED', withdrawnAt: expect.any(Date) },
    });
    // ACTIVE fara oferta → REFUND (decizie PO 2026-08-19)
    expect(credits.refund).toHaveBeenCalledWith('c-b', 2, 'REQUEST_ACCEPTED_OTHER_OFFER', 'slot-active', tx);
    expect(credits.consume).not.toHaveBeenCalledWith('c-b', expect.anything(), expect.anything(), 'slot-active', tx);
    // OFFER_SENT pierzator → pay-to-play (CONSUME), oferta SUPERSEDED
    expect(credits.consume).toHaveBeenCalledWith('c-c', 4, 'OFFER_LOST', 'slot-offer', tx);
    expect(credits.refund).not.toHaveBeenCalledWith('c-c', expect.anything(), expect.anything(), 'slot-offer', tx);
    expect(tx.quote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { claimSlotId: 'slot-offer', status: { in: ['SENT', 'EXPIRED'] } },
        data: { status: 'SUPERSEDED' },
      }),
    );
    // chat read-only imediat (4.14) pentru ambele
    expect(tx.chatThread.updateMany).toHaveBeenCalledWith({ where: { claimSlotId: 'slot-active' }, data: { readOnly: true } });
    expect(tx.chatThread.updateMany).toHaveBeenCalledWith({ where: { claimSlotId: 'slot-offer' }, data: { readOnly: true } });
    // joburile sloturilor inchise (SLA + atribuire) sunt scoase best-effort
    expect(queue.remove).toHaveBeenCalledWith('claim-assign-slot-active');
    expect(queue.remove).toHaveBeenCalledWith(expect.stringMatching(/^sla-slot-active-/));
    // notificare tintita per firma inchisa
    const withdrawnCalls = outbox.record.mock.calls.filter((c: Any[]) => c[2] === 'claim.withdrawn');
    expect(withdrawnCalls).toHaveLength(2);
    expect(withdrawnCalls[0][0]).toBe(tx);
    expect(withdrawnCalls[0][3]).toMatchObject({ reason: 'REQUEST_ACCEPTED_OTHER_OFFER', requestId: 'r1', refunded: true });
    expect(withdrawnCalls[1][3]).toMatchObject({ claimSlotId: 'slot-offer', refunded: false });
    expect(withdrawnCalls[0][4]).toEqual(['m1']);
  });
});

describe('QuotesService.acceptQuote — E-company-2', () => {
  it.each(['SLA_EXPIRED', 'WITHDRAWN', 'ACTIVE', 'CANCELLED_UNASSIGNED'])(
    'slotul castigator %s sub lock → 409 QUOTE_ACCEPT_NOT_ALLOWED, fara credite',
    async (slotStatus) => {
      const { service, tx, credits } = makeService();
      const fresh = await tx.quote.findUnique();
      tx.quote.findUnique.mockResolvedValue({ ...fresh, claimSlot: { status: slotStatus } });
      await expect(service.acceptQuote('u-client', 'q1', 'v1')).rejects.toMatchObject({
        status: 409,
        response: { code: 'QUOTE_ACCEPT_NOT_ALLOWED' },
      });
      expect(tx.quote.updateMany).not.toHaveBeenCalled();
      expect(tx.request.update).not.toHaveBeenCalled();
      expect(credits.consume).not.toHaveBeenCalled();
      expect(credits.refund).not.toHaveBeenCalled();
    },
  );

  it('chitanta ACCEPTED construita in memorie (fara recitirea ofertei in tranzactie) si intoarsa', async () => {
    const { service, tx, prisma } = makeService();
    const dto = await service.acceptQuote('u-client', 'q1', 'v1');
    expect(dto).toMatchObject({ id: 'q1', status: 'ACCEPTED', companyName: 'Firma A', eurRonRate: 5.2 });
    expect(dto.acceptedAt).not.toBeNull();
    // singura citire a ofertei in tx = starea proaspata sub lock
    expect(tx.quote.findUnique).toHaveBeenCalledTimes(1);
    // loadQuoteFull o singura data, in afara tranzactiei
    expect(prisma.quote.findUnique).toHaveBeenCalledTimes(1);
  });

  it('pastreaza timeout-ul claim/accept de 10 s (invarianta 3.1)', async () => {
    const { service, prisma } = makeService();
    await service.acceptQuote('u-client', 'q1', 'v1');
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable', timeout: 10_000 }),
    );
  });
});

describe('QuotesService.acceptQuote — E-admin-platform-3', () => {
  it('programeaza termenele proiectului DUPA commit (reminder + depasire)', async () => {
    const deliveryDate = new Date(Date.now() + 20 * 24 * 3600 * 1000);
    deliveryDate.setUTCHours(0, 0, 0, 0);
    const { service, queue, calendar, settings } = makeService({
      snapshot: makeQuoteFull({ versions: [{ deliveryDate }] }),
    });
    settings.getInt.mockResolvedValue(3);
    calendar.bucharestWallClock = (d: string, h: number) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00.000Z`);
    calendar.endOfBucharestDate = (d: string) => new Date(`${d}T23:59:59.999Z`);
    await service.acceptQuote('u-client', 'q1', 'v1');
    const date = deliveryDate.toISOString().slice(0, 10);
    expect(queue.add).toHaveBeenCalledWith('delivery-reminder', { requestId: 'r1', deliveryDate: date }, expect.objectContaining({ jobId: `proj-rem-r1-${date}` }));
    expect(queue.add).toHaveBeenCalledWith('delivery-overdue', { requestId: 'r1', deliveryDate: date }, expect.objectContaining({ jobId: `proj-overdue-r1-${date}` }));
  });

  it('fara data de livrare → niciun job de termen', async () => {
    const { service, queue } = makeService();
    await service.acceptQuote('u-client', 'q1', 'v1');
    expect(queue.add).not.toHaveBeenCalled();
  });
});

describe('QuotesService.acceptQuote — E-client-1 (versiunea confirmata)', () => {
  it('versiune veche (firma a trimis v2) → 409 QUOTE_VERSION_CHANGED inainte de tranzactie', async () => {
    const { service, prisma, credits } = makeService({ snapshot: makeQuoteFull({ versions: [{}, {}] }) });
    await expect(service.acceptQuote('u-client', 'q1', 'v1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'QUOTE_VERSION_CHANGED', details: { currentVersionId: 'v2', currentVersion: 2 } },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(credits.consume).not.toHaveBeenCalled();
    expect(credits.refund).not.toHaveBeenCalled();
  });

  it('versiune noua aparuta sub lock (revizie cat era deschis dialogul) → 409, fara efecte', async () => {
    const { service, tx, credits, outbox } = makeService();
    const fresh = await tx.quote.findUnique();
    const v2 = makeVersion(2);
    tx.quote.findUnique.mockReset();
    tx.quote.findUnique.mockResolvedValue({
      ...fresh,
      versions: [
        ...fresh.versions,
        { id: v2.id, version: v2.version, validUntil: v2.validUntil, deliveryDate: v2.deliveryDate },
      ],
    });
    await expect(service.acceptQuote('u-client', 'q1', 'v1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'QUOTE_VERSION_CHANGED', details: { currentVersionId: 'v2' } },
    });
    expect(tx.$queryRaw).toHaveBeenCalled(); // lock-ul pe cerere a fost luat
    expect(tx.quote.updateMany).not.toHaveBeenCalled();
    expect(tx.request.update).not.toHaveBeenCalled();
    expect(credits.consume).not.toHaveBeenCalled();
    expect(credits.refund).not.toHaveBeenCalled();
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('happy path: acceptedVersionId scris in acelasi updateMany si intors in DTO', async () => {
    const { service, tx } = makeService();
    const dto = await service.acceptQuote('u-client', 'q1', 'v1');
    expect(tx.quote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'q1', status: 'SENT' },
        data: expect.objectContaining({ status: 'ACCEPTED', acceptedVersionId: 'v1' }),
      }),
    );
    expect(dto.acceptedVersionId).toBe('v1');
  });

  it('versiune care nu apartine ofertei → 400 VALIDATION_ERROR', async () => {
    const { service, prisma } = makeService();
    await expect(service.acceptQuote('u-client', 'q1', 'v-other')).rejects.toMatchObject({
      status: 400,
      response: { code: 'VALIDATION_ERROR' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
