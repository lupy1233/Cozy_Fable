import { DAY, makeQuoteFull, makeService, PAST } from './quotes.test-fixtures';

// a4 (2026-11-13, PO a4-1 / a4-2) — refuzul ofertei de catre client: verificarile sub lock,
// decontarea unica (CONSUME prin ClaimSettlementService), slotul inchis, excluderea firmei,
// recalcularea cererii, mesajul de sistem si evenimentul catre firma.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const RESERVE = [{ type: 'RESERVE', amount: 2 }];

describe('QuotesService.declineQuote — fast-fail', () => {
  it('alt client → 403, fara tranzactie', async () => {
    const { service, prisma } = makeService();
    await expect(service.declineQuote('u-altul', 'q1')).rejects.toMatchObject({ status: 403 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['ACCEPTED', 'WITHDRAWN', 'EXPIRED', 'SUPERSEDED', 'DECLINED'])(
    'oferta %s → 409 QUOTE_NOT_DECLINABLE, fara tranzactie',
    async (status) => {
      const { service, prisma } = makeService({ snapshot: makeQuoteFull({ status }) });
      await expect(service.declineQuote('u-client', 'q1')).rejects.toMatchObject({
        status: 409,
        response: { code: 'QUOTE_NOT_DECLINABLE' },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
});

describe('QuotesService.declineQuote — sub lock', () => {
  it.each([
    ['oferta acceptata intre timp', { quote_status: 'ACCEPTED' }, undefined],
    ['oferta refuzata intre timp (al doilea refuz)', { quote_status: 'DECLINED' }, undefined],
    ['slotul inchis intre timp (SLA / retragere)', { slot_status: 'WITHDRAWN' }, undefined],
    ['cererea acceptata (alta oferta)', {}, { status: 'ACCEPTED' }],
  ] as const)('%s → 409 QUOTE_NOT_DECLINABLE, nimic scris', async (_label, state, lockedRequest) => {
    const ctx = makeService({ state: state as Any, lockedRequest: lockedRequest as Any });
    await expect(ctx.service.declineQuote('u-client', 'q1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'QUOTE_NOT_DECLINABLE' },
    });
    expect(ctx.tx.quote.updateMany).not.toHaveBeenCalled();
    expect(ctx.tx.claimSlot.updateMany).not.toHaveBeenCalled();
    expect(ctx.credits.consume).not.toHaveBeenCalled();
    expect(ctx.outbox.record).not.toHaveBeenCalled();
  });

  it('updateMany conditionat pe SENT intoarce 0 → 409, fara decontare', async () => {
    const ctx = makeService();
    ctx.tx.quote.updateMany.mockResolvedValue({ count: 0 });
    await expect(ctx.service.declineQuote('u-client', 'q1')).rejects.toMatchObject({
      response: { code: 'QUOTE_NOT_DECLINABLE' },
    });
    expect(ctx.tx.claimSlot.updateMany).not.toHaveBeenCalled();
    expect(ctx.credits.consume).not.toHaveBeenCalled();
  });

  it('biletul de decontare pierdut (slot deja inchis) → 409 (rollback), fara credite', async () => {
    const ctx = makeService();
    ctx.tx.claimSlot.updateMany.mockResolvedValue({ count: 0 });
    await expect(ctx.service.declineQuote('u-client', 'q1')).rejects.toMatchObject({
      response: { code: 'QUOTE_NOT_DECLINABLE' },
    });
    expect(ctx.credits.consume).not.toHaveBeenCalled();
    expect(ctx.outbox.record).not.toHaveBeenCalled();
  });

  it('happy path: DECLINED + motiv, slot OFFER_DECLINED cu CONSUME o data, excludere, mesaj de sistem, eveniment', async () => {
    const ctx = makeService();
    ctx.tx.creditTransaction.findMany.mockResolvedValue(RESERVE);
    const out = await ctx.service.declineQuote('u-client', 'q1', { reason: 'PRICE', note: '  prea scump, sunati 0722 123 456 ' });

    expect(ctx.tx.quote.updateMany).toHaveBeenCalledWith({
      where: { id: 'q1', status: 'SENT' },
      data: {
        status: 'DECLINED',
        declinedAt: expect.any(Date),
        declineReason: 'PRICE',
        declineNote: 'prea scump, sunati 0722 123 456',
      },
    });
    // biletul: OFFER_SENT → OFFER_DECLINED
    expect(ctx.tx.claimSlot.updateMany).toHaveBeenCalledWith({
      where: { id: 'slot-win', status: { in: ['OFFER_SENT'] } },
      data: { status: 'OFFER_DECLINED', withdrawnAt: expect.any(Date) },
    });
    // creditele: un singur CONSUME pe suma RESERVE-ului, motivul OFFER_DECLINED
    expect(ctx.credits.consume).toHaveBeenCalledTimes(1);
    expect(ctx.credits.consume).toHaveBeenCalledWith('c-win', 2, 'OFFER_DECLINED', 'slot-win', ctx.tx);
    expect(ctx.credits.refund).not.toHaveBeenCalled();
    // conversatia read-only
    expect(ctx.tx.chatThread.updateMany).toHaveBeenCalledWith({ where: { claimSlotId: 'slot-win' }, data: { readOnly: true } });
    // refuz definitiv: firma exclusa de la o noua preluare
    expect(ctx.tx.requestCompanyExclusion.upsert).toHaveBeenCalledWith({
      where: { requestId_companyId: { requestId: 'r1', companyId: 'c-win' } },
      update: {},
      create: { requestId: 'r1', companyId: 'c-win', reason: 'QUOTE_DECLINED' },
    });
    // cererea recalculata: un ocupant ramas, fara oferte vii → CLAIMED_PARTIAL (locul se poate prelua)
    expect(ctx.tx.request.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'CLAIMED_PARTIAL' } });
    // mesajul de sistem (nota mascata pentru firma)
    expect(ctx.tx.$executeRaw).toHaveBeenCalledTimes(1);
    const sqlValues = ctx.tx.$executeRaw.mock.calls[0].slice(1);
    expect(sqlValues).toContain('QUOTE_DECLINED');
    expect(sqlValues.some((v: unknown) => typeof v === 'string' && v.includes('0722'))).toBe(false);
    // evenimentul catre firma (clopotel + e-mail), cu motivul si nota mascata
    const declinedEvent = ctx.outbox.record.mock.calls.find((c: Any[]) => c[2] === 'quote.declined');
    expect(declinedEvent).toBeDefined();
    expect(declinedEvent[1]).toBe('quote.declined:q1');
    expect(declinedEvent[3]).toMatchObject({ quoteId: 'q1', requestId: 'r1', companyId: 'c-win', claimSlotId: 'slot-win', reason: 'PRICE', consumed: true });
    expect(declinedEvent[3].note).not.toContain('0722');
    expect(declinedEvent[4]).toEqual(['m1']);
    // chitanta: oferta DECLINED cu motivul (clientul vede nota bruta)
    expect(out).toMatchObject({ id: 'q1', status: 'DECLINED', declineReason: 'PRICE', declineNote: 'prea scump, sunati 0722 123 456' });
    expect(out.declinedAt).toEqual(expect.any(String));
    // joburile SLA ale slotului inchis
    expect(ctx.queue.remove).toHaveBeenCalled();
  });

  it('fara motiv si nota → null; cererea ramasa fara ocupanti revine in piata cu ceas nou (job programat)', async () => {
    const ctx = makeService();
    ctx.tx.creditTransaction.findMany.mockResolvedValue(RESERVE);
    ctx.tx.claimSlot.count.mockResolvedValue(0);
    const out = await ctx.service.declineQuote('u-client', 'q1', {});
    expect(out).toMatchObject({ status: 'DECLINED', declineReason: null, declineNote: null });
    expect(ctx.tx.request.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'IN_MARKETPLACE', expiresAt: expect.any(Date) },
    });
    expect(ctx.queue.add).toHaveBeenCalledWith('expire', { requestId: 'r1' }, expect.objectContaining({ jobId: expect.stringMatching(/^req-exp-r1-/) }));
  });

  it('ledger deja decontat (plasa) → slotul tot se inchide, dar fara a doua miscare de credite', async () => {
    const ctx = makeService();
    ctx.tx.creditTransaction.findMany.mockResolvedValue([...RESERVE, { type: 'CONSUME', amount: 2 }]);
    const out = await ctx.service.declineQuote('u-client', 'q1');
    expect(out.status).toBe('DECLINED');
    expect(ctx.credits.consume).not.toHaveBeenCalled();
    expect(ctx.credits.refund).not.toHaveBeenCalled();
  });
});

describe('QuotesService — firma vede nota refuzului mascata', () => {
  it('getQuoteForCompany mascheaza contactele din nota', async () => {
    const snapshot = { ...makeQuoteFull({ status: 'DECLINED' }), declinedAt: new Date(), declineReason: 'OTHER_COMPANY', declineNote: 'scrieti la ana@example.com' };
    const ctx = makeService({ snapshot });
    const out = await ctx.service.getQuoteForCompany({ companyId: 'c-win', memberRole: 'OWNER' } as Any, 'q1');
    expect(out.declineReason).toBe('OTHER_COMPANY');
    expect(out.declineNote).not.toContain('ana@example.com');
  });
});

// a4 (pas 5): cererea de modificare apare in conversatie si anunta firma; varianta noua anunta clientul
describe('QuotesService — mesaje si evenimente pentru variante (a4 pas 5)', () => {
  it('requestChange: mesaj de sistem QUOTE_CHANGE_REQUESTED cu textul clientului + quote.updated kind CHANGE_REQUESTED', async () => {
    const ctx = makeService();
    ctx.prisma.quoteVersion.findUnique.mockResolvedValue({ id: 'v1', quoteId: 'q1' });
    await ctx.service.requestChange('u-client', { quoteVersionId: 'v1', requestedText: 'Mai ieftin, va rog' });
    expect(ctx.tx.$executeRaw).toHaveBeenCalledTimes(1);
    const values = ctx.tx.$executeRaw.mock.calls[0].slice(1);
    expect(values).toContain('QUOTE_CHANGE_REQUESTED');
    expect(values).toContain('Mai ieftin, va rog');
    expect(values).toContain('slot-win');
    const updated = ctx.outbox.record.mock.calls.find((c: Any[]) => c[2] === 'quote.updated');
    expect(updated[3]).toMatchObject({ kind: 'CHANGE_REQUESTED', changeRequestId: 'cr-new', version: 1, claimSlotId: 'slot-win' });
  });

  it('reofferModify: varianta noua in EUR (moneda pe varianta) + quote.updated kind NEW_VERSION', async () => {
    const snapshot = makeQuoteFull({ status: 'EXPIRED' });
    snapshot.versions[0].currency = 'RON'; // backfill-ul migrarii
    const ctx = makeService({ snapshot, state: { quote_status: 'EXPIRED' } });
    const out = await ctx.service.reofferModify(
      { companyId: 'c-win', memberRole: 'OWNER' } as Any,
      'u-firm',
      'q1',
      { price: 3900, description: 'v2', currency: 'EUR', vatMode: 'VAT_EXCLUDED', deliveryTermValue: 30, deliveryTermUnit: 'WORKING_DAYS', warrantyMonths: 12, includesTransport: false, includesAssembly: true } as Any,
    );
    expect(ctx.tx.quoteVersion.create.mock.calls[0][0].data).toMatchObject({ currency: 'EUR', deliveryTerm: '30 de zile lucrătoare', warranty: '12 luni' });
    expect(ctx.tx.quote.updateMany).toHaveBeenCalledWith({
      where: { id: 'q1', status: { in: ['SENT', 'EXPIRED'] } },
      data: { status: 'SENT', updatedAt: expect.any(Date), currency: 'EUR' },
    });
    expect(out.currency).toBe('EUR');
    expect(out.versions.map((v: Any) => v.currency)).toEqual(['RON', 'EUR']);
    const updated = ctx.outbox.record.mock.calls.find((c: Any[]) => c[2] === 'quote.updated');
    expect(updated[3]).toMatchObject({ kind: 'NEW_VERSION', version: 2 });
  });

  it('varianta noua fara moneda → moneda variantei precedente', async () => {
    const snapshot = makeQuoteFull({ status: 'EXPIRED' });
    snapshot.versions[0].currency = 'EUR';
    const ctx = makeService({ snapshot, state: { quote_status: 'EXPIRED' } });
    await ctx.service.reofferModify({ companyId: 'c-win', memberRole: 'OWNER' } as Any, 'u-firm', 'q1', { price: 1, description: 'x', vatMode: 'VAT_INCLUDED', deliveryTermValue: 2, deliveryTermUnit: 'WEEKS', warrantyMonths: 6, includesTransport: true, includesAssembly: true } as Any);
    expect(ctx.tx.quoteVersion.create.mock.calls[0][0].data.currency).toBe('EUR');
  });
});

// ===== dupa revizuirea etapei 4 =====
describe('revizuire — refuz pe oferta cu valabilitatea trecuta (M3)', () => {
  it('valabilitatea ultimei variante trecuta (jobul nu a rulat) → 409 QUOTE_EXPIRED, fara tranzactie', async () => {
    const ctx = makeService({ snapshot: makeQuoteFull({ versions: [{ validUntil: PAST }] }) });
    await expect(ctx.service.declineQuote('u-client', 'q1')).rejects.toMatchObject({ status: 409, response: { code: 'QUOTE_EXPIRED' } });
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('valabilitatea trecuta vazuta abia sub blocare → 409 QUOTE_EXPIRED, nimic scris, fara credite', async () => {
    const ctx = makeService({ state: { latest_valid_until: PAST } });
    ctx.tx.creditTransaction.findMany.mockResolvedValue(RESERVE);
    await expect(ctx.service.declineQuote('u-client', 'q1')).rejects.toMatchObject({ response: { code: 'QUOTE_EXPIRED' } });
    expect(ctx.tx.quote.updateMany).not.toHaveBeenCalled();
    expect(ctx.tx.claimSlot.updateMany).not.toHaveBeenCalled();
    expect(ctx.credits.consume).not.toHaveBeenCalled();
  });
});

describe('revizuire — ramasite inchise la refuz (m9 / interfata M3)', () => {
  it('invitatiile la consultanta PENDING_CLIENT → EXPIRED (DB + chitanta)', async () => {
    const invite = { id: 'inv1', quoteId: 'q1', companyId: 'c-win', locationAddress: 'x', proposedDatetime: new Date(), alternativeDatetimes: null, status: 'PENDING_CLIENT', clientResponseText: null, expiresAt: new Date(Date.now() + DAY), respondedAt: null, createdAt: new Date() };
    const ctx = makeService({ snapshot: makeQuoteFull({ consultationInvites: [invite] }) });
    ctx.tx.creditTransaction.findMany.mockResolvedValue(RESERVE);
    const out = await ctx.service.declineQuote('u-client', 'q1');
    expect(ctx.tx.physicalConsultationInvite.updateMany).toHaveBeenCalledWith({
      where: { quoteId: 'q1', status: 'PENDING_CLIENT' },
      data: { status: 'EXPIRED' },
    });
    expect(out.consultationInvites[0].status).toBe('EXPIRED');
  });
});

describe('revizuire — cererea de modificare = activitatea clientului (m2)', () => {
  it('mesajul de sistem actualizeaza si chat_threads.last_client_message_at, in acelasi statement', async () => {
    const ctx = makeService();
    ctx.prisma.quoteVersion.findUnique.mockResolvedValue({ id: 'v1', quoteId: 'q1' });
    await ctx.service.requestChange('u-client', { quoteVersionId: 'v1', requestedText: 'Mai ieftin' });
    const sql = (ctx.tx.$executeRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toContain('UPDATE chat_threads SET last_client_message_at = now()');
    expect(sql).toContain('INSERT INTO messages');
  });

  it('refuzul NU atinge last_client_message_at (conversatia se inchide oricum)', async () => {
    const ctx = makeService();
    ctx.tx.creditTransaction.findMany.mockResolvedValue(RESERVE);
    await ctx.service.declineQuote('u-client', 'q1');
    const sql = (ctx.tx.$executeRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).not.toContain('last_client_message_at');
  });
});

describe('revizuire — variante fara moneda la schimbarea monedei (m6)', () => {
  const structured: Any = { vatMode: 'VAT_INCLUDED', deliveryTermValue: 2, deliveryTermUnit: 'WEEKS', warrantyMonths: 6, includesTransport: true, includesAssembly: true };
  const owner: Any = { companyId: 'c-win', memberRole: 'OWNER' };

  it('varianta noua in EUR pe oferta RON → variantele cu currency NULL primesc intai RON', async () => {
    const snapshot = makeQuoteFull({ status: 'EXPIRED' }); // v1 fara moneda (imaginea veche)
    const ctx = makeService({ snapshot, state: { quote_status: 'EXPIRED' } });
    ctx.tx.quoteVersion.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const out = await ctx.service.reofferModify(owner, 'u-firm', 'q1', { price: 1, description: 'x', currency: 'EUR', ...structured });
    expect(ctx.tx.quoteVersion.updateMany).toHaveBeenCalledWith({ where: { quoteId: 'q1', currency: null }, data: { currency: 'RON' } });
    expect(ctx.tx.quoteVersion.updateMany.mock.invocationCallOrder[0]).toBeLessThan(ctx.tx.quoteVersion.create.mock.invocationCallOrder[0]);
    expect(out.versions.map((v: Any) => v.currency)).toEqual(['RON', 'EUR']);
  });

  it('aceeasi moneda → nicio scriere pe variantele vechi', async () => {
    const ctx = makeService({ snapshot: makeQuoteFull({ status: 'EXPIRED' }), state: { quote_status: 'EXPIRED' } });
    ctx.tx.quoteVersion.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    await ctx.service.reofferModify(owner, 'u-firm', 'q1', { price: 1, description: 'x', ...structured });
    expect(ctx.tx.quoteVersion.updateMany).not.toHaveBeenCalled();
  });
});

describe('revizuire — cota de TVA inghetata pe varianta (M1)', () => {
  it('varianta noua scrie vat_rate_percent din cota curenta', async () => {
    const ctx = makeService({ snapshot: makeQuoteFull({ status: 'EXPIRED' }), state: { quote_status: 'EXPIRED' } });
    await ctx.service.reofferModify({ companyId: 'c-win', memberRole: 'OWNER' } as Any, 'u-firm', 'q1', { price: 100, description: 'x', vatMode: 'VAT_EXCLUDED', deliveryTermValue: 2, deliveryTermUnit: 'WEEKS', warrantyMonths: 6, includesTransport: true, includesAssembly: true } as Any);
    expect(Number(ctx.tx.quoteVersion.create.mock.calls[0][0].data.vatRatePercent)).toBe(21);
  });
});

describe('revizuire — permisiunile pe campuri la o varianta noua (interfata M1)', () => {
  const managedCtx: Any = { companyId: 'c-win', memberRole: 'EMPLOYEE_TRUSTED' };
  const base: Any = { price: 900, description: 'v2', vatMode: 'VAT_INCLUDED', deliveryTermValue: 6, deliveryTermUnit: 'WEEKS', warrantyMonths: 24, includesTransport: true, includesAssembly: true };
  function withoutDeliveryDate() {
    const snapshot = makeQuoteFull({ status: 'EXPIRED', versions: [{ deliveryDate: new Date('2027-03-10T00:00:00Z') }] });
    Object.assign(snapshot.versions[0], { deliveryTermValue: 6, deliveryTermUnit: 'WEEKS', warrantyMonths: 24 });
    const ctx = makeService({ snapshot, state: { quote_status: 'EXPIRED' } });
    ctx.prisma.companyOfferFieldPermission.findMany.mockResolvedValue(
      ['PRICE', 'DESCRIPTION', 'DELIVERY_TERM', 'WARRANTY'].map((fieldKey) => ({ fieldKey, canEdit: true })),
    );
    return ctx;
  }

  it('membru fara DELIVERY_DATE retrimite aceeasi data (precompletata) → trece', async () => {
    const ctx = withoutDeliveryDate();
    await expect(ctx.service.reofferModify(managedCtx, 'u-emp', 'q1', { ...base, deliveryDate: '2027-03-10' })).resolves.toMatchObject({ status: 'SENT' });
  });

  it('membru fara DELIVERY_DATE schimba data → 403 OFFER_FIELD_NOT_EDITABLE', async () => {
    const ctx = withoutDeliveryDate();
    await expect(ctx.service.reofferModify(managedCtx, 'u-emp', 'q1', { ...base, deliveryDate: '2027-04-01' })).rejects.toMatchObject({
      status: 403,
      response: { code: 'OFFER_FIELD_NOT_EDITABLE', details: { fields: ['DELIVERY_DATE'] } },
    });
  });

  it('membru fara WARRANTY: aceeasi garantie trece, alta garantie → 403', async () => {
    const ctx = withoutDeliveryDate();
    ctx.prisma.companyOfferFieldPermission.findMany.mockResolvedValue(
      ['PRICE', 'DESCRIPTION', 'DELIVERY_TERM', 'DELIVERY_DATE'].map((fieldKey) => ({ fieldKey, canEdit: true })),
    );
    await expect(ctx.service.reofferModify(managedCtx, 'u-emp', 'q1', base)).resolves.toBeDefined();
    await expect(ctx.service.reofferModify(managedCtx, 'u-emp', 'q1', { ...base, warrantyMonths: 36 })).rejects.toMatchObject({
      response: { code: 'OFFER_FIELD_NOT_EDITABLE', details: { fields: ['WARRANTY'] } },
    });
  });

  it('la v1 regula ramane: data trimisa fara DELIVERY_DATE → 403', async () => {
    const ctx = makeService({ lockedRequest: { status: 'CLAIMED_PARTIAL' } });
    ctx.prisma.companyOfferFieldPermission.findMany.mockResolvedValue(
      ['PRICE', 'DESCRIPTION', 'DELIVERY_TERM', 'WARRANTY'].map((fieldKey) => ({ fieldKey, canEdit: true })),
    );
    await expect(ctx.service.createQuote(managedCtx, 'u-emp', { ...base, claimSlotId: 'slot-win', deliveryDate: '2027-03-10' })).rejects.toMatchObject({
      response: { code: 'OFFER_FIELD_NOT_EDITABLE' },
    });
  });
});

describe('revizuire — firma primeste textele cererilor de modificare mascate (M2)', () => {
  it('getQuoteForCompany mascheaza istoricul si cererea de pe varianta', async () => {
    const change = { id: 'c1', quoteVersionId: 'v1', clientUserId: 'u-client', requestedText: 'sunati 0722 123 456', status: 'PENDING', respondedAt: null, createdAt: new Date() };
    const ctx = makeService({ snapshot: makeQuoteFull({ versions: [{ changeRequests: [change] }] }) });
    const out = await ctx.service.getQuoteForCompany({ companyId: 'c-win', memberRole: 'OWNER' } as Any, 'q1');
    expect(out.changeRequests[0].requestedText).not.toContain('0722');
    expect(out.versions[0].changeRequest?.requestedText).not.toContain('0722');
  });

  it('clientul vede textul brut', async () => {
    const change = { id: 'c1', quoteVersionId: 'v1', clientUserId: 'u-client', requestedText: 'sunati 0722 123 456', status: 'PENDING', respondedAt: null, createdAt: new Date() };
    const ctx = makeService({ snapshot: makeQuoteFull({ versions: [{ changeRequests: [change] }] }) });
    const out = await ctx.service.getQuoteForClient('u-client', 'q1');
    expect(out.changeRequests[0].requestedText).toBe('sunati 0722 123 456');
  });
});