import { Prisma } from '@prisma/client';
import { ProjectCasesService } from './project-cases.service';
import { AUTO_COMPLETE_DAYS, autoCompleteJobId } from './fulfillment.service';

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

function harness(opts: {
  status?: string;
  winning?: Any;
  openCase?: Any;
  existingOpen?: boolean;
  completedAt?: Date | null;
  warranty?: string | null;
} = {}) {
  const dates = {
    completedAt: opts.completedAt === undefined ? new Date(Date.now() - 30 * 24 * 3600 * 1000) : opts.completedAt,
    deliveredAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
  };
  const quoteVersion = { findFirst: jest.fn().mockResolvedValue({ warranty: opts.warranty ?? null }) };
  const tx: Any = {
    $queryRaw: jest.fn().mockResolvedValue([{ status: opts.status ?? 'ACCEPTED', deleted_at: null }]),
    $executeRaw: jest.fn().mockResolvedValue(1),
    requestProjectCase: {
      findFirst: jest.fn().mockResolvedValue(opts.existingOpen ? { id: 'other' } : null),
      create: jest.fn().mockImplementation(async ({ data }: Any) => caseRow({ ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(caseRow({ response: 'CONFIRMED_CANCEL' })),
    },
    request: {
      findUnique: jest.fn().mockResolvedValue({ status: opts.status ?? 'ACCEPTED' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(dates),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    quoteVersion,
    companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'm1' }]) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin1' }]) },
  };
  const prisma: Any = {
    quoteVersion,
    request: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'r1',
        clientUserId: 'u-client',
        status: opts.status ?? 'ACCEPTED',
        ...dates,
      }),
    },
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
  const queue: Any = { add: jest.fn().mockResolvedValue(undefined) };
  const service = new ProjectCasesService(prisma, outbox, calendar, queue);
  return { service, tx, prisma, outbox, queue };
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

  it('M1 drumul invers: finalizarea automata a apucat prima (COMPLETED sub lock) → "Am o problema" da 409, fara scriere/caz', async () => {
    const { service, tx } = harness({ status: 'DELIVERED_BY_COMPANY' });
    tx.$queryRaw.mockResolvedValue([{ status: 'COMPLETED', deleted_at: null }]);
    await expect(service.open(client, 'r1', { reason: 'OTHER', note: 'x' })).rejects.toMatchObject({
      status: 409,
      response: { code: 'PROJECT_NOT_CLOSABLE' },
    });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.requestProjectCase.create).not.toHaveBeenCalled();
  });

  it('firma: cerere livrata intre timp (sub lock) → 409 PROJECT_NOT_CLOSABLE', async () => {
    const { service, tx } = harness();
    tx.$queryRaw.mockResolvedValue([{ status: 'DELIVERED_BY_COMPANY', deleted_at: null }]);
    await expect(service.open(owner, 'r1', { reason: 'OTHER' })).rejects.toMatchObject({ response: { code: 'PROJECT_NOT_CLOSABLE' } });
  });

  it('e2-1: clientul raporteaza "Am o problema" in starea livrata → caz OPEN, starea cererii neschimbata', async () => {
    const { service, tx } = harness({ status: 'DELIVERED_BY_COMPANY' });
    const dto = await service.open(client, 'r1', { reason: 'OTHER', note: 'Usa nu se inchide' });
    expect(dto).toMatchObject({ status: 'OPEN', reason: 'OTHER', note: 'Usa nu se inchide' });
    // M1: scriere pe randul cererii DUPA lock si INAINTE de crearea cazului (forteaza 40001 la
    // finalizarea automata concurenta); starea ramane aceeasi
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const sql = (tx.$executeRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toMatch(/UPDATE requests SET updated_at = now\(\) WHERE id = \?/);
    expect(tx.$executeRaw.mock.calls[0][1]).toBe('r1');
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.$executeRaw.mock.invocationCallOrder[0]);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.requestProjectCase.create.mock.invocationCallOrder[0]);
    expect(tx.request.update).not.toHaveBeenCalled();
    expect(tx.request.updateMany).not.toHaveBeenCalled();
  });

  it('clientul nu poate trimite WARRANTY_CLAIM pe calea obisnuita → 400', async () => {
    const { service } = harness({ status: 'COMPLETED' });
    await expect(service.open(client, 'r1', { reason: 'WARRANTY_CLAIM' })).rejects.toMatchObject({ status: 400 });
  });

  it('dupa finalizare calea obisnuita e inchisa → 409 PROJECT_NOT_CLOSABLE', async () => {
    const { service } = harness({ status: 'COMPLETED' });
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

const MONTH_MS = 30.5 * 24 * 3600 * 1000;

// e2-2 (PO 2026-11-13): dupa finalizare clientul raporteaza o problema in fereastra de garantie
// (garantia din oferta, minimum 24 de luni); cazul nou NU schimba starea si nici creditele.
describe('ProjectCasesService.openWarranty / getWarrantyWindow', () => {
  it('COMPLETED, in fereastra → caz WARRANTY_CLAIM + clopotel catre firma si admini, fara alte schimbari', async () => {
    const { service, tx, outbox } = harness({ status: 'COMPLETED' });
    const dto = await service.openWarranty('u-client', 'r1', { note: '  Usa s-a lasat  ' });
    expect(dto).toMatchObject({ status: 'OPEN', reason: 'WARRANTY_CLAIM', openedBy: 'CLIENT', note: 'Usa s-a lasat' });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1); // M1: aceeasi scriere sub lock
    expect(tx.request.update).not.toHaveBeenCalled();
    expect(tx.request.updateMany).not.toHaveBeenCalled();
    expect(outbox.record).toHaveBeenCalledWith(tx, expect.stringMatching(/^project\.case_opened:/), 'project.case_opened',
      expect.objectContaining({ reason: 'WARRANTY_CLAIM', companyId: 'c-win', openedBy: 'CLIENT' }), ['m1', 'admin1']);
  });

  it('DISPUTED (recenzie in analiza) → tot permis', async () => {
    const { service } = harness({ status: 'DISPUTED' });
    await expect(service.openWarranty('u-client', 'r1', { note: 'x' })).resolves.toMatchObject({ reason: 'WARRANTY_CLAIM' });
  });

  it('m12: garantie de 12 luni → se aplica minimul de 24: la 18 luni inca se poate raporta', async () => {
    const { service } = harness({ status: 'COMPLETED', warranty: '12 luni', completedAt: new Date(Date.now() - 18 * MONTH_MS) });
    await expect(service.openWarranty('u-client', 'r1', { note: 'x' })).resolves.toMatchObject({ reason: 'WARRANTY_CLAIM' });
    const win = harness({ status: 'COMPLETED', warranty: '12 luni', completedAt: new Date(Date.now() - 18 * MONTH_MS) });
    await expect(win.service.getWarrantyWindow('u-client', 'r1')).resolves.toMatchObject({ months: 24, open: true });
  });

  it('garantie de 12 luni: la 25 de luni (peste minimul de 24) fereastra e inchisa (409)', async () => {
    const { service, tx } = harness({ status: 'COMPLETED', warranty: '12 luni', completedAt: new Date(Date.now() - 25 * MONTH_MS) });
    await expect(service.openWarranty('u-client', 'r1', { note: 'x' })).rejects.toMatchObject({
      status: 409,
      response: { code: 'WARRANTY_REPORT_WINDOW_CLOSED' },
    });
    expect(tx.requestProjectCase.create).not.toHaveBeenCalled();
  });

  it('garantie "5 ani" in oferta → la 30 de luni inca se poate raporta', async () => {
    const { service } = harness({ status: 'COMPLETED', warranty: '5 ani', completedAt: new Date(Date.now() - 30 * MONTH_MS) });
    await expect(service.openWarranty('u-client', 'r1', { note: 'x' })).resolves.toMatchObject({ reason: 'WARRANTY_CLAIM' });
  });

  it('proiect inca in lucru → 409 PROJECT_NOT_CLOSABLE (are calea "Proiectul s-a blocat?")', async () => {
    const { service } = harness({ status: 'ACCEPTED' });
    await expect(service.openWarranty('u-client', 'r1', { note: 'x' })).rejects.toMatchObject({ response: { code: 'PROJECT_NOT_CLOSABLE' } });
  });

  it('alt client → 404; caz deja deschis → 409', async () => {
    const { service } = harness({ status: 'COMPLETED' });
    await expect(service.openWarranty('u-other', 'r1', { note: 'x' })).rejects.toMatchObject({ status: 404 });
    const second = harness({ status: 'COMPLETED', existingOpen: true });
    await expect(second.service.openWarranty('u-client', 'r1', { note: 'x' })).rejects.toMatchObject({
      response: { code: 'PROJECT_CASE_ALREADY_OPEN' },
    });
  });

  it('firma nu poate "confirma anularea" pe o reclamatie in garantie → 404', async () => {
    const { service } = harness({ status: 'COMPLETED', openCase: caseRow({ reason: 'WARRANTY_CLAIM' }) });
    await expect(service.respond(owner, 'r1', { confirmCancel: true })).rejects.toMatchObject({ status: 404 });
  });

  it('fereastra: null inainte de finalizare; dupa finalizare = baza + max(24, garantia) luni', async () => {
    const before = harness({ status: 'ACCEPTED' });
    await expect(before.service.getWarrantyWindow('u-client', 'r1')).resolves.toBeNull();
    const completedAt = new Date('2026-11-13T10:00:00Z');
    const after = harness({ status: 'COMPLETED', completedAt, warranty: '36 de luni' });
    await expect(after.service.getWarrantyWindow('u-client', 'r1')).resolves.toMatchObject({
      completedAt: completedAt.toISOString(),
      months: 36,
      endsAt: '2029-11-13T10:00:00.000Z',
      open: true,
    });
  });

  it('cerere finalizata inainte de completed_at → baza = delivered_at', async () => {
    const { service } = harness({ status: 'COMPLETED', completedAt: null });
    await expect(service.getWarrantyWindow('u-client', 'r1')).resolves.toMatchObject({
      completedAt: '2024-01-01T10:00:00.000Z',
      months: 24,
      endsAt: '2026-01-01T10:00:00.000Z',
      open: false,
    });
  });
});

// e2-1: inchiderea raportului de catre admin pe o cerere livrata reporneste ceasul de 14 zile.
describe('ProjectCasesService.dismiss — ceasul de finalizare automata (e2-1)', () => {
  it('cerere DELIVERED_BY_COMPANY → job nou de auto-complete la 14 zile de la inchidere', async () => {
    const { service, queue } = harness({ status: 'DELIVERED_BY_COMPANY' });
    const t0 = Date.now();
    await service.dismiss('admin1', 'case1', { adminNote: 'Firma a remediat problema' });
    expect(queue.add).toHaveBeenCalledTimes(1);
    const [name, data, opts] = queue.add.mock.calls[0];
    expect(name).toBe('auto-complete');
    expect(data).toEqual({ requestId: 'r1' });
    expect(opts.delay).toBe(AUTO_COMPLETE_DAYS * 24 * 3600 * 1000);
    const at = Number(String(opts.jobId).replace('auto-complete-r1-', ''));
    expect(at).toBeGreaterThanOrEqual(t0);
    expect(opts.jobId).toBe(autoCompleteJobId('r1', new Date(at)));
  });

  it('cerere in alta stare (in lucru / finalizata) → fara job', async () => {
    const { service, queue } = harness({ status: 'COMPLETED' });
    await service.dismiss('admin1', 'case1', { adminNote: 'Rezolvat in garantie' });
    expect(queue.add).not.toHaveBeenCalled();
  });
});
