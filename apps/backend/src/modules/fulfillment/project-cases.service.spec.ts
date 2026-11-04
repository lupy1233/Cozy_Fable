import { Prisma } from '@prisma/client';
import { ProjectCasesService } from './project-cases.service';

// E-admin-platform-3: raportarea unui proiect acceptat blocat — ownership (404), rolul firmei
// (403), starea cererii (409), un singur caz deschis (409 + backstop P2002), raspunsul doar al
// celeilalte parti si o singura data, respingerea de catre admin o singura data.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const NOW = new Date('2026-09-29T10:00:00Z');

function caseRow(overrides: Any = {}) {
  return {
    id: 'case1',
    requestId: 'r1',
    claimSlotId: 's-win',
    openedBy: 'CLIENT',
    openedByUserId: 'u-client',
    reason: 'FIRM_UNRESPONSIVE',
    note: null,
    status: 'OPEN',
    response: null,
    respondedByUserId: null,
    responseNote: null,
    respondedAt: null,
    resolvedByUserId: null,
    resolvedAt: null,
    creditOutcome: null,
    adminNote: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function harness(opts: { status?: string; winning?: Any; openCase?: Any; existingOpen?: boolean } = {}) {
  const tx: Any = {
    $queryRaw: jest.fn().mockResolvedValue([{ status: opts.status ?? 'ACCEPTED', deleted_at: null }]),
    requestProjectCase: {
      findFirst: jest.fn().mockResolvedValue(opts.existingOpen ? { id: 'other' } : null),
      create: jest.fn().mockImplementation(async ({ data }: Any) => caseRow({ ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(caseRow({ response: 'CONFIRMED_CANCEL' })),
    },
    companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'm1' }]) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin1' }]) },
  };
  const prisma: Any = {
    request: { findUnique: jest.fn().mockResolvedValue({ id: 'r1', clientUserId: 'u-client', status: opts.status ?? 'ACCEPTED' }) },
    quote: {
      findFirst: jest.fn().mockResolvedValue(opts.winning === undefined ? { claimSlotId: 's-win', companyId: 'c-win' } : opts.winning),
    },
    requestProjectCase: {
      findFirst: jest.fn().mockResolvedValue(opts.openCase === undefined ? caseRow() : opts.openCase),
      findUnique: jest.fn().mockResolvedValue({
        ...caseRow(),
        request: { clientUserId: 'u-client' },
        claimSlot: { companyId: 'c-win' },
      }),
    },
    $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)),
  };
  const outbox: Any = { record: jest.fn().mockResolvedValue(undefined) };
  const calendar: Any = { todayInBucharest: () => '2026-09-29' };
  const service = new ProjectCasesService(prisma, outbox, calendar);
  return { service, tx, prisma, outbox };
}

const client = { kind: 'CLIENT' as const, userId: 'u-client' };
const owner = { kind: 'COMPANY' as const, userId: 'm1', ctx: { companyId: 'c-win', memberRole: 'OWNER', status: 'APPROVED' } as Any };

describe('ProjectCasesService.open', () => {
  it('clientul proprietar deschide cazul → OPEN + notificare catre firma si admini, in aceeasi tranzactie', async () => {
    const { service, tx, outbox } = harness();
    const dto = await service.open(client, 'r1', { reason: 'FIRM_UNRESPONSIVE', note: '  nu raspunde  ' });
    expect(dto).toMatchObject({ status: 'OPEN', openedBy: 'CLIENT', reason: 'FIRM_UNRESPONSIVE', claimSlotId: 's-win' });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.requestProjectCase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ requestId: 'r1', claimSlotId: 's-win', openedBy: 'CLIENT', note: 'nu raspunde' }),
    });
    expect(outbox.record).toHaveBeenCalledWith(tx, expect.stringMatching(/^project\.case_opened:/), 'project.case_opened',
      expect.objectContaining({ requestId: 'r1', claimSlotId: 's-win', openedBy: 'CLIENT' }), ['m1', 'admin1']);
  });

  it('clientul care NU detine cererea → 404 (IDOR)', async () => {
    const { service, tx } = harness();
    await expect(service.open({ kind: 'CLIENT', userId: 'u-other' }, 'r1', { reason: 'OTHER' })).rejects.toMatchObject({ status: 404 });
    expect(tx.requestProjectCase.create).not.toHaveBeenCalled();
  });

  it('cerere inca in NEGOTIATION (fara oferta acceptata) → 409 PROJECT_NOT_CLOSABLE', async () => {
    const { service } = harness({ status: 'NEGOTIATION', winning: null });
    await expect(service.open(client, 'r1', { reason: 'OTHER' })).rejects.toMatchObject({
      status: 409,
      response: { code: 'PROJECT_NOT_CLOSABLE' },
    });
  });

  it('cerere livrata intre timp (sub lock) → 409 PROJECT_NOT_CLOSABLE', async () => {
    const { service, tx } = harness();
    tx.$queryRaw.mockResolvedValue([{ status: 'DELIVERED_BY_COMPANY', deleted_at: null }]);
    await expect(service.open(client, 'r1', { reason: 'OTHER' })).rejects.toMatchObject({ response: { code: 'PROJECT_NOT_CLOSABLE' } });
  });

  it('caz deja deschis → 409 PROJECT_CASE_ALREADY_OPEN', async () => {
    const { service, tx } = harness({ existingOpen: true });
    await expect(service.open(client, 'r1', { reason: 'OTHER' })).rejects.toMatchObject({
      status: 409,
      response: { code: 'PROJECT_CASE_ALREADY_OPEN' },
    });
    expect(tx.requestProjectCase.create).not.toHaveBeenCalled();
  });

  it('cursa pe indexul unic partial (P2002) → mapata pe 409 PROJECT_CASE_ALREADY_OPEN', async () => {
    const { service, tx } = harness();
    tx.requestProjectCase.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(service.open(client, 'r1', { reason: 'OTHER' })).rejects.toMatchObject({ response: { code: 'PROJECT_CASE_ALREADY_OPEN' } });
  });

  it('motivul celeilalte parti (clientul spune "clientul nu raspunde") → 400', async () => {
    const { service } = harness();
    await expect(service.open(client, 'r1', { reason: 'CLIENT_UNRESPONSIVE' })).rejects.toMatchObject({ status: 400 });
  });

  it('firma: EMPLOYEE_MANAGED → 403; firma care nu a castigat → 404', async () => {
    const { service } = harness();
    await expect(service.open({ ...owner, ctx: { ...owner.ctx, memberRole: 'EMPLOYEE_MANAGED' } }, 'r1', { reason: 'OTHER' }))
      .rejects.toMatchObject({ status: 403 });
    await expect(service.open({ ...owner, ctx: { ...owner.ctx, companyId: 'c-lost' } }, 'r1', { reason: 'OTHER' }))
      .rejects.toMatchObject({ status: 404 });
  });

  it('firma OWNER deschide cu motiv de firma → tinta = clientul + adminii', async () => {
    const { service, outbox, tx } = harness();
    await service.open(owner, 'r1', { reason: 'CLIENT_UNRESPONSIVE' });
    expect(outbox.record).toHaveBeenCalledWith(tx, expect.any(String), 'project.case_opened',
      expect.objectContaining({ openedBy: 'COMPANY' }), ['u-client', 'admin1']);
  });
});

describe('ProjectCasesService.respond / dismiss', () => {
  it('raspunde cealalta parte (firma la cazul clientului) → CONFIRMED_CANCEL + notificare catre client si admini', async () => {
    const { service, tx, outbox, prisma } = harness();
    await service.respond(owner, 'r1', { confirmCancel: true });
    expect(prisma.requestProjectCase.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { requestId: 'r1', status: 'OPEN', openedBy: 'CLIENT' },
    }));
    expect(tx.requestProjectCase.updateMany).toHaveBeenCalledWith({
      where: { id: 'case1', status: 'OPEN', response: null },
      data: expect.objectContaining({ response: 'CONFIRMED_CANCEL', respondedByUserId: 'm1' }),
    });
    expect(outbox.record).toHaveBeenCalledWith(tx, 'project.case_responded:case1', 'project.case_responded',
      expect.objectContaining({ confirmed: true }), ['u-client', 'admin1']);
  });

  it('autorul cazului nu isi poate raspunde singur → 404', async () => {
    const { service, prisma } = harness({ openCase: null });
    await expect(service.respond(client, 'r1', { confirmCancel: true })).rejects.toMatchObject({ status: 404 });
    expect(prisma.requestProjectCase.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { requestId: 'r1', status: 'OPEN', openedBy: 'COMPANY' },
    }));
  });

  it('al doilea raspuns → 409 PROJECT_CASE_NOT_OPEN, fara notificare', async () => {
    const { service, tx, outbox } = harness();
    tx.requestProjectCase.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.respond(owner, 'r1', { confirmCancel: false })).rejects.toMatchObject({
      status: 409,
      response: { code: 'PROJECT_CASE_NOT_OPEN' },
    });
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('admin respinge cazul: prima data DISMISSED + notifica partile; a doua oara 409', async () => {
    const { service, tx, outbox } = harness();
    await service.dismiss('admin1', 'case1', { adminNote: 'Proiectul continua normal' });
    expect(tx.requestProjectCase.updateMany).toHaveBeenCalledWith({
      where: { id: 'case1', status: 'OPEN' },
      data: expect.objectContaining({ status: 'DISMISSED', resolvedByUserId: 'admin1' }),
    });
    expect(outbox.record).toHaveBeenCalledWith(tx, 'project.case_dismissed:case1', 'project.case_dismissed',
      expect.objectContaining({ requestId: 'r1' }), ['m1', 'u-client']);
    tx.requestProjectCase.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.dismiss('admin1', 'case1', { adminNote: 'Proiectul continua normal' })).rejects.toMatchObject({
      status: 409,
      response: { code: 'PROJECT_CASE_NOT_OPEN' },
    });
  });
});
