import { Prisma } from '@prisma/client';
import { companyCtx, makeService } from './quotes.test-fixtures';

// L0-B + E-company-2 — trimiterea ofertei v1: gardele din afara tranzactiei (fast-fail) si
// verificarile autoritative sub lock (cererea FOR UPDATE + slotul mutat conditionat).

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const dto: Any = { claimSlotId: 'slot-win', price: 1000, description: 'x' };

function slotWith(requestStatus: string, deletedAt: Date | null = null, status = 'ACTIVE') {
  return {
    id: 'slot-win',
    companyId: 'c-win',
    status,
    requestId: 'r1',
    request: { id: 'r1', status: requestStatus, deletedAt, includesPaidDesign: false },
  };
}

describe('QuotesService.createQuote — fast-fail (L0-B)', () => {
  it('refuza cand cererea e deja ACCEPTED → REQUEST_NOT_OPEN_FOR_OFFERS', async () => {
    const { service, prisma } = makeService({ slot: slotWith('ACCEPTED') });
    await expect(service.createQuote(companyCtx, 'u1', dto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'REQUEST_NOT_OPEN_FOR_OFFERS' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuza pe cerere stearsa', async () => {
    const { service } = makeService({ slot: slotWith('CLAIMED_PARTIAL', new Date()) });
    await expect(service.createQuote(companyCtx, 'u1', dto)).rejects.toMatchObject({
      response: { code: 'REQUEST_NOT_OPEN_FOR_OFFERS' },
    });
  });

  it('slot deja OFFER_SENT → QUOTE_ALREADY_SENT fara tranzactie', async () => {
    const { service, prisma } = makeService({ slot: slotWith('OFFERS_RECEIVED', null, 'OFFER_SENT') });
    await expect(service.createQuote(companyCtx, 'u1', dto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'QUOTE_ALREADY_SENT' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('QuotesService.createQuote — sub lock (E-company-2)', () => {
  it('slotul inchis intre timp (updateMany count 0) → 409 QUOTE_ALREADY_SENT, nicio oferta creata', async () => {
    const { service, tx, outbox, queue } = makeService({ lockedRequest: { status: 'CLAIMED_PARTIAL' } });
    tx.claimSlot.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.createQuote(companyCtx, 'u1', dto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'QUOTE_ALREADY_SENT' },
    });
    expect(tx.claimSlot.updateMany).toHaveBeenCalledWith({
      where: { id: 'slot-win', companyId: 'c-win', status: 'ACTIVE' },
      data: { status: 'OFFER_SENT', quoteId: expect.any(String) },
    });
    expect(tx.quote.create).not.toHaveBeenCalled();
    expect(tx.quoteVersion.create).not.toHaveBeenCalled();
    expect(outbox.record).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it.each([
    ['ACCEPTED', null],
    ['IN_MARKETPLACE', null],
    ['CLAIMED_PARTIAL', new Date()],
  ])('cererea %s (sters=%s) sub lock → 409 REQUEST_NOT_OPEN_FOR_OFFERS, slotul neatins', async (status, deleted) => {
    const { service, tx } = makeService({ lockedRequest: { status: status as Any, deleted_at: deleted } });
    await expect(service.createQuote(companyCtx, 'u1', dto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'REQUEST_NOT_OPEN_FOR_OFFERS' },
    });
    expect(tx.claimSlot.updateMany).not.toHaveBeenCalled();
    expect(tx.quote.create).not.toHaveBeenCalled();
  });

  it('happy path: slot mutat INAINTE de insert, chitanta in memorie, cerere urcata conditionat', async () => {
    const { service, tx, prisma, outbox, queue } = makeService({ lockedRequest: { status: 'CLAIMED_PARTIAL' } });
    const out = await service.createQuote(companyCtx, 'u1', dto);

    const slotCall = tx.claimSlot.updateMany.mock.invocationCallOrder[0];
    const createCall = tx.quote.create.mock.invocationCallOrder[0];
    expect(slotCall).toBeLessThan(createCall);
    const quoteId = tx.quote.create.mock.calls[0][0].data.id;
    expect(tx.claimSlot.updateMany.mock.calls[0][0].data.quoteId).toBe(quoteId);
    expect(tx.request.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', status: { in: ['CLAIMED_PARTIAL', 'CLAIMED_FULL'] } },
      data: { status: 'OFFERS_RECEIVED' },
    });
    // fara recitirea ofertei (loadQuoteFull / getQuoteDto) in tranzactie
    expect(tx.quote.findUnique).not.toHaveBeenCalled();
    expect(prisma.quote.findUnique).not.toHaveBeenCalled();
    expect(out).toMatchObject({
      id: quoteId,
      status: 'SENT',
      companyName: 'Firma A',
      versionsUsed: 1,
      versions: [expect.objectContaining({ version: 1, price: 1000, attachments: [] })],
    });
    expect(outbox.record).toHaveBeenCalledWith(
      tx,
      expect.stringMatching(new RegExp(`^quote\\.created:${quoteId}:`)),
      'quote.created',
      { quoteId, requestId: 'r1', companyId: 'c-win', clientUserId: 'u-client' },
      ['m1', 'u-client'],
    );
    expect(queue.add).toHaveBeenCalledWith('expire', expect.anything(), expect.objectContaining({ jobId: expect.stringMatching(/^qv-/) }));
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable', timeout: 20_000, maxWait: 5_000 }),
    );
  });

  it('cererea deja OFFERS_RECEIVED → fara bump de status', async () => {
    const { service, tx } = makeService({ lockedRequest: { status: 'OFFERS_RECEIVED' } });
    await service.createQuote(companyCtx, 'u1', dto);
    expect(tx.request.updateMany).not.toHaveBeenCalled();
  });

  it('P2002 pe quotes_one_live_per_claim_slot → 409 QUOTE_ALREADY_SENT', async () => {
    const { service, tx } = makeService({ lockedRequest: { status: 'CLAIMED_PARTIAL' } });
    tx.quote.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { modelName: 'Quote', target: ['claim_slot_id'] },
      }),
    );
    await expect(service.createQuote(companyCtx, 'u1', dto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'QUOTE_ALREADY_SENT' },
    });
  });

  it('P2034 persistent → reincearca de 3 ori apoi 409 CONCURRENT_MODIFICATION', async () => {
    const { service, prisma } = makeService({ lockedRequest: { status: 'CLAIMED_PARTIAL' } });
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' }),
    );
    await expect(service.createQuote(companyCtx, 'u1', dto)).rejects.toMatchObject({
      status: 409,
      response: { code: 'CONCURRENT_MODIFICATION' },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(4);
  });
});
