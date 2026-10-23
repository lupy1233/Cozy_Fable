import { DAY, companyCtx, makeQuoteFull, makeService } from './quotes.test-fixtures';

// E-company-2 — ciclul de viata al ofertei trimise: prelungire (max 2), retragere (1 zi
// lucratoare + asignat ocupat), incheierea negocierii, raspuns la invitatie; plus cererea de
// prelungire a clientului (E-admin-platform-3, mutat din quotes.service.spec).

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

describe('QuotesService.extendValidity', () => {
  it('limita de 2 prelungiri atinsa sub lock → 409 VALIDITY_EXTENSION_LIMIT_REACHED', async () => {
    const ctx = makeService({ state: { latest_extensions: 2 } });
    await expect(ctx.service.extendValidity(companyCtx, 'u-firm', 'q1', { days: 7 })).rejects.toMatchObject({
      status: 409,
      response: { code: 'VALIDITY_EXTENSION_LIMIT_REACHED' },
    });
    expect(ctx.tx.quoteValidityExtension.create).not.toHaveBeenCalled();
  });

  it('limita vazuta in snapshot → fast-fail fara tranzactie', async () => {
    const ext = { id: 'e', extendedAt: new Date() };
    const ctx = makeService({ snapshot: makeQuoteFull({ versions: [{ validityExtensions: [ext, ext] }] }) });
    await expect(ctx.service.extendValidity(companyCtx, 'u-firm', 'q1', { days: 7 })).rejects.toMatchObject({
      response: { code: 'VALIDITY_EXTENSION_LIMIT_REACHED' },
    });
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('prelungeste de la valid_until BLOCAT (nu din snapshot) si redeschide conditionat', async () => {
    const lockedUntil = new Date('2026-10-10T00:00:00.000Z');
    const ctx = makeService({ state: { latest_valid_until: lockedUntil } });
    const out = await ctx.service.extendValidity(companyCtx, 'u-firm', 'q1', { days: 7 });
    const expected = new Date(lockedUntil.getTime() + 7 * DAY);
    expect(ctx.tx.quoteValidityExtension.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ quoteVersionId: 'v1', previousValidUntil: lockedUntil, newValidUntil: expected }),
    });
    expect(ctx.tx.quoteVersion.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { validUntil: expected } });
    expect(ctx.tx.quote.updateMany).toHaveBeenCalledWith({
      where: { id: 'q1', status: { in: ['SENT', 'EXPIRED'] } },
      data: { status: 'SENT', updatedAt: expect.any(Date) },
    });
    expect(out.versions[0]).toMatchObject({ validityExtensionsUsed: 1, validUntil: expected.toISOString() });
    expect(ctx.queue.add).toHaveBeenCalledWith(
      'expire',
      { quoteVersionId: 'v1' },
      expect.objectContaining({ jobId: `qv-v1-${expected.getTime()}` }),
    );
  });

  it('pe oferta WITHDRAWN → 409 QUOTE_NOT_MODIFIABLE', async () => {
    const ctx = makeService({ snapshot: makeQuoteFull({ status: 'WITHDRAWN' }) });
    await expect(ctx.service.extendValidity(companyCtx, 'u-firm', 'q1', { days: 7 })).rejects.toMatchObject({
      response: { code: 'QUOTE_NOT_MODIFIABLE' },
    });
  });
});

describe('QuotesService.withdrawQuote', () => {
  it('in fereastra de 1 zi lucratoare → WITHDRAWN + slot ACTIVE conditionat + SLA reprogramat', async () => {
    const ctx = makeService();
    const out = await ctx.service.withdrawQuote(companyCtx, 'q1');
    expect(out.status).toBe('WITHDRAWN');
    expect(ctx.tx.quote.updateMany).toHaveBeenCalledWith({
      where: { id: 'q1', status: { in: ['SENT', 'EXPIRED'] } },
      data: { status: 'WITHDRAWN', withdrawnAt: expect.any(Date) },
    });
    expect(ctx.tx.claimSlot.updateMany).toHaveBeenCalledWith({
      where: { id: 'slot-win', status: 'OFFER_SENT' },
      data: { status: 'ACTIVE', quoteId: null },
    });
    expect(ctx.queue.add).toHaveBeenCalledWith(
      'breach',
      { claimSlotId: 'slot-win' },
      expect.objectContaining({ jobId: expect.stringMatching(/^sla-slot-win-/) }),
    );
  });

  it('dupa fereastra (sent_at blocat vechi) → 409 QUOTE_WITHDRAW_WINDOW_CLOSED, nimic scris', async () => {
    const ctx = makeService({ state: { latest_sent_at: new Date(Date.now() - 3 * DAY) } });
    await expect(ctx.service.withdrawQuote(companyCtx, 'q1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'QUOTE_WITHDRAW_WINDOW_CLOSED' },
    });
    expect(ctx.tx.quote.updateMany).not.toHaveBeenCalled();
  });

  it('fereastra inchisa deja in snapshot → fast-fail fara tranzactie', async () => {
    const ctx = makeService({ snapshot: makeQuoteFull({ versions: [{ sentAt: new Date(Date.now() - 3 * DAY) }] }) });
    await expect(ctx.service.withdrawQuote(companyCtx, 'q1')).rejects.toMatchObject({
      response: { code: 'QUOTE_WITHDRAW_WINDOW_CLOSED' },
    });
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('asignatul are alt claim ACTIVE fara oferta → 409 ASSIGNED_USER_HAS_ACTIVE_CLAIM, niciun updateMany', async () => {
    const ctx = makeService({
      state: { assigned_to_user_id: 'u-emp' },
      busySlots: [{ id: 'slot-busy', company_id: 'c-win' }],
    });
    await expect(ctx.service.withdrawQuote(companyCtx, 'q1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'ASSIGNED_USER_HAS_ACTIVE_CLAIM', details: { busyClaimSlotId: 'slot-busy' } },
    });
    expect(ctx.tx.quote.updateMany).not.toHaveBeenCalled();
    expect(ctx.tx.claimSlot.updateMany).not.toHaveBeenCalled();
    expect(ctx.outbox.record).not.toHaveBeenCalled();
    expect(ctx.queue.add).not.toHaveBeenCalled();
  });

  it('slot ocupat in ALTA firma → 409 fara id-ul slotului strain', async () => {
    const ctx = makeService({
      state: { assigned_to_user_id: 'u-emp' },
      busySlots: [{ id: 'slot-other', company_id: 'c-other' }],
    });
    const err: Any = await ctx.service.withdrawQuote(companyCtx, 'q1').catch((e) => e);
    expect(err.response).toMatchObject({ code: 'ASSIGNED_USER_HAS_ACTIVE_CLAIM' });
    expect(err.response.details).toBeUndefined();
  });

  it('slot neatribuit → sare peste interogarea de ocupare', async () => {
    const ctx = makeService();
    await ctx.service.withdrawQuote(companyCtx, 'q1');
    const sqls = ctx.tx.$queryRaw.mock.calls.map((c: Any[]) => (c[0] as string[]).join('?'));
    expect(sqls.some((s: string) => s.includes('FROM claim_slots'))).toBe(false);
  });

  it('slotul nu mai e OFFER_SENT (updateMany 0) → 409 QUOTE_NOT_MODIFIABLE (rollback)', async () => {
    const ctx = makeService();
    ctx.tx.claimSlot.updateMany.mockResolvedValue({ count: 0 });
    await expect(ctx.service.withdrawQuote(companyCtx, 'q1')).rejects.toMatchObject({
      response: { code: 'QUOTE_NOT_MODIFIABLE' },
    });
    expect(ctx.queue.add).not.toHaveBeenCalled();
  });

  // E-company-6: dupa termen + 12h gratie retragerea expira imediat preluarea → confirmare explicita
  const HOUR = 60 * 60 * 1000;

  it('SLA depasit (termen acum 13h), fara confirmare → 409 QUOTE_WITHDRAW_SLA_ACK_REQUIRED, nimic scris', async () => {
    const deadline = new Date(Date.now() - 13 * HOUR);
    const ctx = makeService({ state: { sla_deadline_at: deadline, sla_paused_at: null } });
    await expect(ctx.service.withdrawQuote(companyCtx, 'q1')).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'QUOTE_WITHDRAW_SLA_ACK_REQUIRED',
        details: { slaBreachAt: new Date(deadline.getTime() + 12 * HOUR).toISOString() },
      },
    });
    expect(ctx.tx.quote.updateMany).not.toHaveBeenCalled();
    expect(ctx.tx.claimSlot.updateMany).not.toHaveBeenCalled();
    expect(ctx.queue.add).not.toHaveBeenCalled();
  });

  it('SLA depasit cu acknowledgeSlaBreach → WITHDRAWN + job SLA re-armat', async () => {
    const ctx = makeService({ state: { sla_deadline_at: new Date(Date.now() - 13 * HOUR), sla_paused_at: null } });
    const out = await ctx.service.withdrawQuote(companyCtx, 'q1', { acknowledgeSlaBreach: true });
    expect(out.status).toBe('WITHDRAWN');
    expect(ctx.queue.add).toHaveBeenCalledWith(
      'breach',
      { claimSlotId: 'slot-win' },
      expect.objectContaining({ jobId: expect.stringMatching(/^sla-slot-win-/) }),
    );
  });

  it('SLA pe pauza (clarificare) → nu cere confirmare chiar daca termenul a trecut', async () => {
    const ctx = makeService({
      state: { sla_deadline_at: new Date(Date.now() - 13 * HOUR), sla_paused_at: new Date(Date.now() - HOUR) },
    });
    const out = await ctx.service.withdrawQuote(companyCtx, 'q1');
    expect(out.status).toBe('WITHDRAWN');
  });

  it('termen depasit dar inca in gratia de 12h → nu cere confirmare', async () => {
    const ctx = makeService({ state: { sla_deadline_at: new Date(Date.now() - 2 * HOUR), sla_paused_at: null } });
    const out = await ctx.service.withdrawQuote(companyCtx, 'q1');
    expect(out.status).toBe('WITHDRAWN');
  });
});

describe('QuotesService.endNegotiation', () => {
  it('pe oferta ACCEPTED sub lock → 409 QUOTE_NOT_MODIFIABLE, chat neatins', async () => {
    const ctx = makeService({ state: { quote_status: 'ACCEPTED' } });
    await expect(ctx.service.endNegotiation(companyCtx, 'q1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'QUOTE_NOT_MODIFIABLE' },
    });
    expect(ctx.tx.chatThread.update).not.toHaveBeenCalled();
  });

  it('pe oferta SENT → chat read-only + negotiationEndedByCompany', async () => {
    const ctx = makeService();
    await ctx.service.endNegotiation(companyCtx, 'q1');
    expect(ctx.tx.chatThread.update).toHaveBeenCalledWith({
      where: { claimSlotId: 'slot-win' },
      data: { negotiationEndedByCompany: true, readOnly: true },
    });
  });
});

describe('QuotesService.respondConsultationInvite', () => {
  const invite = (over: Any = {}) => ({
    id: 'inv1',
    quoteId: 'q1',
    status: 'PENDING_CLIENT',
    expiresAt: new Date(Date.now() + DAY),
    quote: { request: { clientUserId: 'u-client' } },
    ...over,
  });

  it('raspuns concurent (updateMany 0, invitatia nu mai e PENDING) → 409 VALIDATION_ERROR', async () => {
    const ctx = makeService();
    ctx.prisma.physicalConsultationInvite.findUnique.mockResolvedValue(invite());
    ctx.tx.physicalConsultationInvite.updateMany.mockResolvedValue({ count: 0 });
    ctx.tx.physicalConsultationInvite.findUnique.mockResolvedValue({ status: 'ACCEPTED' });
    await expect(ctx.service.respondConsultationInvite('u-client', 'inv1', { accept: true })).rejects.toMatchObject({
      response: { code: 'VALIDATION_ERROR', message: 'Invite already answered' },
    });
  });

  it('expirata intre timp (inca PENDING) → 409 CONSULTATION_INVITE_EXPIRED', async () => {
    const ctx = makeService();
    ctx.prisma.physicalConsultationInvite.findUnique.mockResolvedValue(invite());
    ctx.tx.physicalConsultationInvite.updateMany.mockResolvedValue({ count: 0 });
    ctx.tx.physicalConsultationInvite.findUnique.mockResolvedValue({ status: 'PENDING_CLIENT' });
    await expect(ctx.service.respondConsultationInvite('u-client', 'inv1', { accept: false })).rejects.toMatchObject({
      response: { code: 'CONSULTATION_INVITE_EXPIRED' },
    });
  });
});

describe('QuotesService.requestExtension — E-admin-platform-3', () => {
  function extensionService(status: string, requestStatus = 'OFFERS_RECEIVED', count = 1) {
    const ctx = makeService({ snapshot: makeQuoteFull({ status, requestStatus }) });
    ctx.tx.quoteVersion.updateMany = jest.fn().mockResolvedValue({ count });
    jest.spyOn(ctx.service, 'getQuoteDto').mockResolvedValue({ id: 'q1' } as Any);
    return ctx;
  }

  it('pe oferta EXPIRED → marcheaza versiunea o singura data + anunta firma', async () => {
    const { service, tx, outbox } = extensionService('EXPIRED');
    await expect(service.requestExtension('u-client', 'q1')).resolves.toEqual({ id: 'q1' });
    expect(tx.quoteVersion.updateMany).toHaveBeenCalledWith({
      where: { id: 'v1', extensionRequestedAt: null },
      data: { extensionRequestedAt: expect.any(Date) },
    });
    expect(outbox.record).toHaveBeenCalledWith(
      tx,
      'quote.extension_requested:v1',
      'quote.extension_requested',
      expect.objectContaining({ quoteId: 'q1', requestId: 'r1', claimSlotId: 'slot-win', companyId: 'c-win' }),
      ['m1'],
    );
  });

  it('repetat (versiune deja marcata) → no-op idempotent, fara notificare', async () => {
    const { service, outbox } = extensionService('EXPIRED', 'OFFERS_RECEIVED', 0);
    await expect(service.requestExtension('u-client', 'q1')).resolves.toEqual({ id: 'q1' });
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it.each([
    ['SENT', 'OFFERS_RECEIVED'],
    ['ACCEPTED', 'ACCEPTED'],
    ['EXPIRED', 'ACCEPTED'],
  ])('pe oferta %s / cerere %s → 409 QUOTE_EXTENSION_NOT_REQUESTABLE', async (status, requestStatus) => {
    const { service, tx } = extensionService(status, requestStatus);
    await expect(service.requestExtension('u-client', 'q1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'QUOTE_EXTENSION_NOT_REQUESTABLE' },
    });
    expect(tx.quoteVersion.updateMany).not.toHaveBeenCalled();
  });

  it('de alt client → FORBIDDEN', async () => {
    const { service } = extensionService('EXPIRED');
    await expect(service.requestExtension('u-altcineva', 'q1')).rejects.toMatchObject({ status: 403 });
  });
});
