import { FulfillmentService, AUTO_COMPLETE_DAYS, earliestDeliveryAt } from './fulfillment.service';
import { ClaimSettlementService } from '../billing/claim-settlement.service';

// e1 (PO 2026-11-13): contactele firmei castigatoare catre client, pragul minim pana la "livrat",
// etapele informative de executie.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const DAY_MS = 24 * 60 * 60 * 1000;
const STAGES = ['MEASUREMENTS', 'CONTRACT', 'PRODUCTION', 'INSTALLATION'];

const activeUser = (name: string, over: Any = {}) => ({
  name,
  email: `${name.toLowerCase()}@firma.ro`,
  phone: null,
  deletedAt: null,
  blockedAt: null,
  anonymizedAt: null,
  ...over,
});

function harness(opts: { request?: Any; quote?: Any; minDays?: number; stages?: Any[]; members?: Any[]; owners?: Any[] } = {}) {
  const request = opts.request ?? {
    id: 'r1',
    title: 'Dressing',
    status: 'ACCEPTED',
    clientUserId: 'u-client',
    deliveredAt: null,
    completedAt: null,
    deletedAt: null,
  };
  const tx: Any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    request: {
      findUnique: jest.fn().mockResolvedValue(request),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    claimSlot: { count: jest.fn().mockResolvedValue(1) },
    requestExecutionStage: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma: Any = {
    $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)),
    request: { findUnique: jest.fn().mockResolvedValue(request) },
    quote: { findFirst: jest.fn().mockResolvedValue(opts.quote ?? null) },
    requestProjectCase: { findFirst: jest.fn().mockResolvedValue(null) },
    requestExecutionStage: { findMany: jest.fn().mockResolvedValue(opts.stages ?? []) },
    review: { findUnique: jest.fn().mockResolvedValue(null) },
    companyMember: {
      findMany: jest.fn().mockImplementation(async ({ where }: Any) =>
        where.role === 'OWNER' ? (opts.owners ?? []) : (opts.members ?? [])),
    },
  };
  const outbox: Any = { record: jest.fn().mockResolvedValue(undefined) };
  const queue: Any = { add: jest.fn().mockResolvedValue(undefined), remove: jest.fn() };
  const settings: Any = {
    getString: jest.fn().mockImplementation(async (_k: string, fallback: string) => fallback),
    getInt: jest.fn().mockImplementation(async (key: string, fallback: number) =>
      key === 'delivery_min_days_after_accept' ? (opts.minDays ?? fallback) : 0),
  };
  const service = new FulfillmentService(prisma, { publish: jest.fn() } as Any, new ClaimSettlementService({} as Any), queue, outbox, settings);
  return { service, prisma, tx, outbox, request };
}

const owner = { companyId: 'c1', memberRole: 'OWNER' } as Any;

describe('earliestDeliveryAt', () => {
  it('0 zile sau fara acceptare → fara limita', () => {
    expect(earliestDeliveryAt(new Date(), 0)).toBeNull();
    expect(earliestDeliveryAt(null, 7)).toBeNull();
  });
  it('acceptedAt + N zile', () => {
    const at = new Date('2026-11-01T10:00:00Z');
    expect(earliestDeliveryAt(at, 7)?.toISOString()).toBe('2026-11-08T10:00:00.000Z');
  });
});

describe('markDelivered — pragul minim de la acceptare (e1-3)', () => {
  const quote = (acceptedAt: Date | null) => ({
    claimSlotId: 'slot1',
    acceptedAt,
    company: { name: 'Firma B' },
    claimSlot: { status: 'OFFER_SENT' },
  });

  it('prea devreme → 409 DELIVERY_TOO_EARLY cu data, cererea nu se schimba', async () => {
    const acceptedAt = new Date(Date.now() - 2 * DAY_MS);
    const { service, tx, outbox } = harness({ quote: quote(acceptedAt), minDays: 7 });
    const err: Any = await service.markDelivered(owner, 'r1').catch((e) => e);
    expect(err.getStatus()).toBe(409);
    expect(err.getResponse()).toMatchObject({
      code: 'DELIVERY_TOO_EARLY',
      details: { earliestDeliveryAt: new Date(acceptedAt.getTime() + 7 * DAY_MS).toISOString() },
    });
    // verificat sub lock (dupa FOR UPDATE), fara scriere
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.request.updateMany).not.toHaveBeenCalled();
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('la limita (exact N zile) → trece', async () => {
    const { service } = harness({ quote: quote(new Date(Date.now() - 7 * DAY_MS - 1000)), minDays: 7 });
    await expect(service.markDelivered(owner, 'r1')).resolves.toEqual({ status: 'DELIVERED_BY_COMPANY' });
  });

  it('setarea 0 → trece oricand (chiar la un minut dupa acceptare)', async () => {
    const { service } = harness({ quote: quote(new Date(Date.now() - 60_000)), minDays: 0 });
    await expect(service.markDelivered(owner, 'r1')).resolves.toEqual({ status: 'DELIVERED_BY_COMPANY' });
  });

  it('setare lipsa → implicit 7 zile', async () => {
    const h = harness({ quote: quote(new Date(Date.now() - DAY_MS)) });
    await expect(h.service.markDelivered(owner, 'r1')).rejects.toMatchObject({ status: 409, response: { code: 'DELIVERY_TOO_EARLY' } });
  });
});

describe('getFulfillmentForClient — contactele firmei (e1-1)', () => {
  const acceptedAt = new Date('2026-11-01T10:00:00Z');
  const winningQuote = {
    acceptedAt,
    companyId: 'c1',
    company: { name: 'Firma B', cui: 'RO123', addressText: 'Str. Lunga 1', city: 'Iasi', county: 'Iasi' },
    claimSlot: { claimedByUserId: 'u-claimer', assignedToUserId: 'u-assigned' },
  };

  it('alt utilizator decat clientul cererii → 403, fara date ale firmei', async () => {
    const { service, prisma } = harness({ quote: winningQuote });
    await expect(service.getFulfillmentForClient('u-intrus', 'r1')).rejects.toMatchObject({ status: 403 });
    expect(prisma.quote.findFirst).not.toHaveBeenCalled();
  });

  it('cerere stearsa / inexistenta → 404', async () => {
    const { service, prisma } = harness();
    prisma.request.findUnique.mockResolvedValue(null);
    await expect(service.getFulfillmentForClient('u-client', 'r1')).rejects.toMatchObject({ status: 404 });
  });

  it('inainte de acceptare → company / contact null, fara etape', async () => {
    const { service, prisma } = harness({ request: { id: 'r1', status: 'OFFERS_RECEIVED', clientUserId: 'u-client', deliveredAt: null, completedAt: null, deletedAt: null } });
    await expect(service.getFulfillmentForClient('u-client', 'r1')).resolves.toEqual({
      requestId: 'r1',
      acceptedAt: null,
      deliveredAt: null,
      completedAt: null,
      autoCompleteAt: null,
      company: null,
      contact: null,
      stages: [],
    });
    expect(prisma.companyMember.findMany).not.toHaveBeenCalled();
  });

  it('doar oferta ACCEPTATA a cererii (firma castigatoare) e citita', async () => {
    const { service, prisma } = harness({ quote: winningQuote, members: [{ userId: 'u-assigned', user: activeUser('Ana', { phone: '0722000000' }) }] });
    const dto = await service.getFulfillmentForClient('u-client', 'r1');
    expect(prisma.quote.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { requestId: 'r1', status: 'ACCEPTED' } }));
    expect(dto.acceptedAt).toBe(acceptedAt.toISOString());
    expect(dto.company).toEqual({ name: 'Firma B', cui: 'RO123', addressText: 'Str. Lunga 1', city: 'Iasi', county: 'Iasi' });
    expect(dto.contact).toEqual({ name: 'Ana', email: 'ana@firma.ro', phone: '0722000000' });
    expect(dto.stages.map((s) => s.stage)).toEqual(STAGES);
    // membrii cautati doar in firma castigatoare
    expect(prisma.companyMember.findMany.mock.calls[0][0].where.companyId).toBe('c1');
  });

  it('ordinea de rezerva: atribuit inactiv → cel care a preluat', async () => {
    const { service } = harness({
      quote: winningQuote,
      members: [
        { userId: 'u-assigned', user: activeUser('Ana', { blockedAt: new Date() }) },
        { userId: 'u-claimer', user: activeUser('Bogdan') },
      ],
    });
    expect((await service.getFulfillmentForClient('u-client', 'r1')).contact?.name).toBe('Bogdan');
  });

  it('atribuitul si cel care a preluat inactivi / iesiti din firma → proprietarul activ', async () => {
    const { service } = harness({
      quote: winningQuote,
      members: [{ userId: 'u-claimer', user: activeUser('Bogdan', { deletedAt: new Date() }) }],
      owners: [{ user: activeUser('Vechi', { anonymizedAt: new Date() }) }, { user: activeUser('Ioana') }],
    });
    expect((await service.getFulfillmentForClient('u-client', 'r1')).contact).toEqual({ name: 'Ioana', email: 'ioana@firma.ro', phone: null });
  });

  it('review m4: COMPLETED (garantie) → trimite contactul, firma si etapele', async () => {
    const { service } = harness({
      quote: winningQuote,
      members: [{ userId: 'u-assigned', user: activeUser('Ana') }],
      request: { id: 'r1', status: 'COMPLETED', clientUserId: 'u-client', deliveredAt: null, completedAt: null, deletedAt: null },
    });
    const dto = await service.getFulfillmentForClient('u-client', 'r1');
    expect(dto.contact?.name).toBe('Ana');
    expect(dto.company?.name).toBe('Firma B');
    expect(dto.stages).toHaveLength(4);
  });

  it('review m4: CANCELLED → fara contact, fara firma, fara etape', async () => {
    const { service, prisma } = harness({
      quote: winningQuote,
      members: [{ userId: 'u-assigned', user: activeUser('Ana') }],
      request: { id: 'r1', status: 'CANCELLED', clientUserId: 'u-client', deliveredAt: null, completedAt: null, deletedAt: null },
    });
    const dto = await service.getFulfillmentForClient('u-client', 'r1');
    expect(dto).toMatchObject({ company: null, contact: null, stages: [] });
    expect(prisma.companyMember.findMany).not.toHaveBeenCalled();
    expect(prisma.requestExecutionStage.findMany).not.toHaveBeenCalled();
  });

  it('nimeni activ → contact null, datele firmei raman', async () => {
    const { service } = harness({ quote: winningQuote });
    const dto = await service.getFulfillmentForClient('u-client', 'r1');
    expect(dto.contact).toBeNull();
    expect(dto.company?.name).toBe('Firma B');
  });

  it('livrata → autoCompleteAt = livrare + 14 zile', async () => {
    const deliveredAt = new Date(Date.now() - 2 * DAY_MS);
    const { service } = harness({
      quote: winningQuote,
      request: { id: 'r1', status: 'DELIVERED_BY_COMPANY', clientUserId: 'u-client', deliveredAt, completedAt: null, deletedAt: null },
    });
    const dto = await service.getFulfillmentForClient('u-client', 'r1');
    expect(dto.autoCompleteAt).toBe(new Date(deliveredAt.getTime() + AUTO_COMPLETE_DAYS * DAY_MS).toISOString());
  });
});

describe('setExecutionStage — etape informative (e1-2)', () => {
  const winning = (slotOver: Any = {}) => ({
    id: 'q1',
    acceptedAt: new Date(Date.now() - DAY_MS),
    company: { name: 'Firma B' },
    claimSlot: {
      status: 'OFFER_SENT',
      createdAt: new Date(Date.now() - 10 * DAY_MS),
      updatedAt: new Date(),
      claimedByUserId: 'u-claimer',
      assignedToUserId: 'u-assigned',
      ...slotOver,
    },
  });

  it('bifare → un rand + execution.stage_updated catre client; raspunsul are cele 4 etape', async () => {
    const { service, tx, outbox, prisma } = harness({ quote: winning() });
    prisma.requestExecutionStage.findMany.mockResolvedValue([
      { stage: 'CONTRACT', completedAt: new Date('2026-11-10T09:00:00Z'), completedBy: { name: 'Ana' } },
    ]);
    const dto = await service.setExecutionStage(owner, 'u-owner', 'r1', 'CONTRACT', true);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.requestExecutionStage.createMany).toHaveBeenCalledWith({
      data: [{ requestId: 'r1', stage: 'CONTRACT', completedAt: expect.any(Date), completedByUserId: 'u-owner' }],
      skipDuplicates: true,
    });
    expect(outbox.record).toHaveBeenCalledWith(
      tx,
      // review m3: cheie stabila (cerere, etapa) → cel mult o notificare per etapa
      'execution.stage_updated:r1:CONTRACT',
      'execution.stage_updated',
      // review m2: companyId → outbox-ul pune la loc companyName la livrare
      expect.objectContaining({ requestId: 'r1', stage: 'CONTRACT', companyId: 'c1' }),
      ['u-client'],
    );
    expect(dto.stages).toEqual([
      { stage: 'MEASUREMENTS', done: false, completedAt: null, completedByName: null },
      { stage: 'CONTRACT', done: true, completedAt: '2026-11-10T09:00:00.000Z', completedByName: 'Ana' },
      { stage: 'PRODUCTION', done: false, completedAt: null, completedByName: null },
      { stage: 'INSTALLATION', done: false, completedAt: null, completedByName: null },
    ]);
  });

  it('bifata deja (createMany count 0) → idempotent, fara a doua notificare', async () => {
    const { service, tx, outbox } = harness({ quote: winning() });
    tx.requestExecutionStage.createMany.mockResolvedValue({ count: 0 });
    await expect(service.setExecutionStage(owner, 'u-owner', 'r1', 'CONTRACT', true)).resolves.toBeDefined();
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('review m3: bifare → debifare → bifare foloseste aceeasi cheie (outbox o ignora a doua oara)', async () => {
    const { service, outbox } = harness({ quote: winning() });
    await service.setExecutionStage(owner, 'u-owner', 'r1', 'CONTRACT', true);
    await service.setExecutionStage(owner, 'u-owner', 'r1', 'CONTRACT', false);
    await service.setExecutionStage(owner, 'u-owner', 'r1', 'CONTRACT', true);
    const keys = outbox.record.mock.calls.map((c: Any[]) => c[1]);
    expect(keys).toEqual(['execution.stage_updated:r1:CONTRACT', 'execution.stage_updated:r1:CONTRACT']);
  });

  it('debifare → sterge randul (idempotent: deleteMany), fara notificare', async () => {
    const { service, tx, outbox } = harness({ quote: winning() });
    tx.requestExecutionStage.deleteMany.mockResolvedValue({ count: 0 });
    await service.setExecutionStage(owner, 'u-owner', 'r1', 'PRODUCTION', false);
    expect(tx.requestExecutionStage.deleteMany).toHaveBeenCalledWith({ where: { requestId: 'r1', stage: 'PRODUCTION' } });
    expect(tx.requestExecutionStage.createMany).not.toHaveBeenCalled();
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it.each(['COMPLETED', 'CANCELLED', 'OFFERS_RECEIVED'])('cererea in %s → 409 EXECUTION_STAGE_NOT_EDITABLE', async (status) => {
    const { service, tx } = harness({
      quote: winning(),
      request: { id: 'r1', status, clientUserId: 'u-client', deliveredAt: null, completedAt: null, deletedAt: null },
    });
    await expect(service.setExecutionStage(owner, 'u-owner', 'r1', 'CONTRACT', true)).rejects.toMatchObject({
      status: 409,
      response: { code: 'EXECUTION_STAGE_NOT_EDITABLE' },
    });
    expect(tx.requestExecutionStage.createMany).not.toHaveBeenCalled();
  });

  it('starea se schimba intre verificare si lock → 409 sub lock', async () => {
    const { service, tx } = harness({ quote: winning() });
    tx.request.findUnique.mockResolvedValue({ status: 'COMPLETED', deletedAt: null, clientUserId: 'u-client', title: 'X' });
    await expect(service.setExecutionStage(owner, 'u-owner', 'r1', 'CONTRACT', true)).rejects.toMatchObject({ status: 409 });
    expect(tx.requestExecutionStage.createMany).not.toHaveBeenCalled();
  });

  it('firma fara oferta acceptata → 409', async () => {
    const { service } = harness({ quote: null });
    await expect(service.setExecutionStage(owner, 'u-owner', 'r1', 'CONTRACT', true)).rejects.toMatchObject({
      status: 409,
      response: { code: 'EXECUTION_STAGE_NOT_EDITABLE' },
    });
  });

  it('angajat cu rol limitat, neatribuit → 403', async () => {
    const { service, tx } = harness({ quote: winning() });
    await expect(
      service.setExecutionStage({ companyId: 'c1', memberRole: 'EMPLOYEE_MANAGED' } as Any, 'u-altul', 'r1', 'CONTRACT', true),
    ).rejects.toMatchObject({ status: 403 });
    expect(tx.requestExecutionStage.createMany).not.toHaveBeenCalled();
  });

  it('angajat cu rol limitat, caruia i-e atribuita preluarea → poate bifa', async () => {
    const { service, tx } = harness({ quote: winning() });
    await service.setExecutionStage({ companyId: 'c1', memberRole: 'EMPLOYEE_MANAGED' } as Any, 'u-assigned', 'r1', 'MEASUREMENTS', true);
    expect(tx.requestExecutionStage.createMany).toHaveBeenCalled();
  });

  it('completion: earliestDeliveryAt = acceptedAt + zilele din setare', async () => {
    const q = winning();
    const { service } = harness({ quote: q, minDays: 7 });
    const dto = await service.getCompletionForCompany(owner, 'u-owner', 'r1');
    expect(dto.acceptedAt).toBe(q.acceptedAt.toISOString());
    expect(dto.earliestDeliveryAt).toBe(new Date(q.acceptedAt.getTime() + 7 * DAY_MS).toISOString());
    expect(dto.autoCompleteAt).toBeNull();
  });
});
