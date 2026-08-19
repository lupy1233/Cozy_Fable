import { HttpException } from '@nestjs/common';
import { QuotesService } from './quotes.service';

// L0-B — masina de stari la acceptarea ofertei (3.1 + 4.14), cu Prisma mock-uit:
//  - refuz cand cererea nu e in OFFERS_RECEIVED/NEGOTIATION (ex. deja ACCEPTED);
//  - a doua acceptare (updateMany conditionat pe status SENT → count 0) → 409;
//  - sloturile nealese: ACTIVE → CANCELLED_REQUEST_ACCEPTED + REFUND,
//    OFFER_SENT → CANCELLED_REQUEST_ACCEPTED + CONSUME (pay-to-play) + oferta SUPERSEDED.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000);

function makeQuote(overrides: Partial<Any> = {}) {
  return {
    id: 'q1',
    requestId: 'r1',
    claimSlotId: 'slot-win',
    companyId: 'c-win',
    status: 'SENT',
    request: { id: 'r1', clientUserId: 'u-client', title: 'Bucatarie', deletedAt: null, status: 'OFFERS_RECEIVED' },
    company: { name: 'Firma A' },
    versions: [{ id: 'v1', version: 1, validUntil: FUTURE, isExtra: false }],
    consultationInvites: [],
    ...overrides,
  };
}

function makeService(opts: {
  requestStatus?: string;
  deletedAt?: Date | null;
  acceptedCount?: number;
  freshStatus?: string;
  losers?: Any[];
}) {
  const tx: Any = {
    $queryRaw: jest.fn().mockResolvedValue([
      { id: 'r1', status: opts.requestStatus ?? 'OFFERS_RECEIVED', deleted_at: opts.deletedAt ?? null },
    ]),
    quote: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'q1',
        status: opts.freshStatus ?? 'SENT',
        versions: [{ version: 1, validUntil: FUTURE }],
      }),
      updateMany: jest.fn().mockResolvedValue({ count: opts.acceptedCount ?? 1 }),
    },
    request: { update: jest.fn().mockResolvedValue(undefined) },
    claimSlot: {
      findMany: jest.fn().mockResolvedValue(opts.losers ?? []),
      update: jest.fn().mockResolvedValue(undefined),
    },
    chatThread: { updateMany: jest.fn().mockResolvedValue(undefined) },
  };
  const prisma: Any = {
    $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)),
    quote: {
      findUnique: jest.fn().mockResolvedValue(makeQuote()),
    },
    request: { findUnique: jest.fn().mockResolvedValue({ clientUserId: 'u-client' }) },
    claimSlot: { findMany: jest.fn().mockResolvedValue([]) },
    companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'm1' }]) },
  };
  const credits: Any = {
    consume: jest.fn().mockResolvedValue(undefined),
    refund: jest.fn().mockResolvedValue(undefined),
  };
  const eventBus: Any = { publish: jest.fn().mockResolvedValue(undefined) };
  const queue: Any = { add: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) };
  const service = new QuotesService(
    prisma,
    {} as Any, // settings
    eventBus,
    {} as Any, // calendar
    {} as Any, // uploads
    credits,
    queue, // validity
    queue, // consultation
    queue, // sla
    queue, // assign
  );
  // getQuoteDto cere mapare completa — nu e obiectul testului
  jest.spyOn(service, 'getQuoteDto').mockResolvedValue({ id: 'q1' } as Any);
  return { service, tx, prisma, credits, eventBus, queue };
}

describe('QuotesService.acceptQuote (L0-B)', () => {
  it('refuza cand cererea nu mai e deschisa la acceptare (ex. deja ACCEPTED) — sub lock', async () => {
    const { service, tx } = makeService({ requestStatus: 'ACCEPTED' });
    await expect(service.acceptQuote('u-client', 'q1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'QUOTE_ACCEPT_NOT_ALLOWED' },
    });
    expect(tx.$queryRaw).toHaveBeenCalled(); // SELECT ... FOR UPDATE pe cerere
    expect(tx.quote.updateMany).not.toHaveBeenCalled();
    expect(tx.request.update).not.toHaveBeenCalled();
  });

  it('cerere stearsa (soft delete) → NOT_FOUND', async () => {
    const { service } = makeService({ deletedAt: new Date() });
    await expect(service.acceptQuote('u-client', 'q1')).rejects.toMatchObject({ status: 404 });
  });

  it('a doua acceptare (oferta nu mai e SENT sub lock) → 409, fara efecte', async () => {
    const { service, tx, credits } = makeService({ acceptedCount: 0 });
    await expect(service.acceptQuote('u-client', 'q1')).rejects.toBeInstanceOf(HttpException);
    expect(tx.request.update).not.toHaveBeenCalled();
    expect(credits.consume).not.toHaveBeenCalled();
    expect(credits.refund).not.toHaveBeenCalled();
  });

  it('updateMany e conditionat pe status SENT (protectie la accept concurent)', async () => {
    const { service, tx } = makeService({});
    await service.acceptQuote('u-client', 'q1');
    expect(tx.quote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'q1', status: 'SENT' } }),
    );
    expect(tx.request.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'ACCEPTED' } });
  });

  it('nu e cererea clientului → FORBIDDEN', async () => {
    const { service } = makeService({});
    await expect(service.acceptQuote('u-altcineva', 'q1')).rejects.toMatchObject({ status: 403 });
  });

  it('inchide sloturile nealese: ACTIVE → refund, OFFER_SENT → consum + oferta SUPERSEDED + chat read-only', async () => {
    const losers = [
      { id: 'slot-active', companyId: 'c-b', status: 'ACTIVE', claimCostCreditsSnapshot: 2, slaDeadlineAt: FUTURE },
      { id: 'slot-offer', companyId: 'c-c', status: 'OFFER_SENT', claimCostCreditsSnapshot: 4, slaDeadlineAt: FUTURE },
    ];
    const { service, tx, credits, eventBus, queue } = makeService({ losers });
    await service.acceptQuote('u-client', 'q1');

    // ambele sloturi → status terminal
    expect(tx.claimSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'slot-active' },
        data: expect.objectContaining({ status: 'CANCELLED_REQUEST_ACCEPTED' }),
      }),
    );
    expect(tx.claimSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'slot-offer' },
        data: expect.objectContaining({ status: 'CANCELLED_REQUEST_ACCEPTED' }),
      }),
    );
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
    const withdrawnCalls = eventBus.publish.mock.calls.filter((c: Any[]) => c[0] === 'claim.withdrawn');
    expect(withdrawnCalls).toHaveLength(2);
    expect(withdrawnCalls[0][1]).toMatchObject({ reason: 'REQUEST_ACCEPTED_OTHER_OFFER', requestId: 'r1' });
    expect(withdrawnCalls[0][2]).toEqual(['m1']);
  });
});

describe('QuotesService — masina de stari oferte (L0-B)', () => {
  function serviceWithSlot(requestStatus: string, deletedAt: Date | null = null) {
    const prisma: Any = {
      claimSlot: {
        findUnique: jest.fn().mockResolvedValue({
          id: 's1',
          companyId: 'c1',
          status: 'ACTIVE',
          requestId: 'r1',
          request: { id: 'r1', status: requestStatus, deletedAt, includesPaidDesign: false },
        }),
      },
      $transaction: jest.fn(),
    };
    return new QuotesService(prisma, {} as Any, {} as Any, {} as Any, {} as Any, {} as Any, {} as Any, {} as Any, {} as Any, {} as Any);
  }
  const ctx: Any = { companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED' };
  const dto: Any = { claimSlotId: 's1', price: 1000, description: 'x' };

  it('createQuote refuza cand cererea e deja ACCEPTED → REQUEST_NOT_OPEN_FOR_OFFERS', async () => {
    await expect(serviceWithSlot('ACCEPTED').createQuote(ctx, 'u1', dto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'REQUEST_NOT_OPEN_FOR_OFFERS' },
    });
  });

  it('createQuote refuza pe cerere stearsa', async () => {
    await expect(serviceWithSlot('CLAIMED_PARTIAL', new Date()).createQuote(ctx, 'u1', dto)).rejects.toMatchObject({
      response: { code: 'REQUEST_NOT_OPEN_FOR_OFFERS' },
    });
  });
});
