import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { VOLUNTARY_WITHDRAWAL_GRACE_MS } from '../claims/claims.constants';

// E-client-9 (C7-16) — cardul "Cine vede cererea": proiectul in marketplace + firmele care au
// (sau vor avea dupa gratie) datele de contact, evaluate ca pe fisa de lucru.

/* eslint-disable @typescript-eslint/no-explicit-any */
const MIN = 60_000;

function setup(opts: {
  request?: Record<string, unknown> | null;
  slots?: Record<string, unknown>[];
  settings?: Record<string, string>;
  covered?: boolean;
} = {}) {
  const request = opts.request === undefined
    ? {
        id: 'r1', clientUserId: 'client-1', status: 'CLAIMED_PARTIAL', deletedAt: null,
        publishedAt: new Date(Date.now() - 60 * MIN), lat: 44.43, lng: 26.1, deliveredAt: null,
      }
    : opts.request;
  const allSlots = opts.slots ?? [];
  const prisma: any = {
    request: { findUnique: jest.fn().mockResolvedValue(request) },
    claimSlot: {
      findMany: jest.fn(async ({ where }: any) => allSlots.filter((s: any) => where.status.in.includes(s.status))),
    },
    // a6: interogarea de acoperire (hasCoveringCompany) — doar da / nu
    $queryRaw: jest.fn().mockResolvedValue([{ covered: opts.covered ?? true }]),
  };
  const values: Record<string, string> = opts.settings ?? {};
  const settings: any = {
    getBool: jest.fn(async (k: string, f: boolean) => (k in values ? values[k] === 'true' : f)),
    getInt: jest.fn(async (k: string, f: number) => (k in values ? Number(values[k]) : f)),
    getString: jest.fn(async (k: string, f: string) => values[k] ?? f),
  };
  const service = new RequestsService(
    prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, {} as never, settings as never,
  );
  return { service, prisma };
}

const slot = (id: string, status: string, createdAt: Date, name = `Firma ${id}`) => ({
  id, status, createdAt, updatedAt: createdAt, claimedByUserId: `u-${id}`, assignedToUserId: null,
  company: { name },
});

describe('RequestsService.getVisibilityForClient (E-client-9)', () => {
  it('alt client → 403', async () => {
    const { service } = setup();
    await expect(service.getVisibilityForClient('altcineva', 'r1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cerere stearsa → 404', async () => {
    const { service } = setup({ request: { id: 'r1', clientUserId: 'client-1', deletedAt: new Date() } });
    await expect(service.getVisibilityForClient('client-1', 'r1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('doar sloturile ocupante apar (ACTIVE/OFFER_SENT/COMPLETED), nu CANCELLED_REQUEST_ACCEPTED/WITHDRAWN', async () => {
    const t = new Date(Date.now() - 120 * MIN);
    const { service, prisma } = setup({
      slots: [
        slot('s1', 'ACTIVE', t, 'Mobila A'),
        slot('s2', 'OFFER_SENT', t, 'Mobila B'),
        slot('s3', 'CANCELLED_REQUEST_ACCEPTED', t),
        slot('s4', 'WITHDRAWN_VOLUNTARY', t),
      ],
    });
    const res = await service.getVisibilityForClient('client-1', 'r1');
    expect(res.contactHolders.map((h) => h.companyName)).toEqual(['Mobila A', 'Mobila B']);
    expect(res.contactHolders.every((h) => h.contactsVisibleFrom === null)).toBe(true);
    expect(prisma.claimSlot.findMany.mock.calls[0][0].where.status.in).toEqual(['ACTIVE', 'OFFER_SENT', 'COMPLETED']);
    expect(res.projectVisibleInMarketplace).toBe(true);
  });

  it('AFTER_GRACE in primele 30 min → contactsVisibleFrom in viitor', async () => {
    const createdAt = new Date(Date.now() - 5 * MIN);
    const { service } = setup({ slots: [slot('s1', 'ACTIVE', createdAt)], settings: { claim_contact_reveal_policy: 'AFTER_GRACE' } });
    const [holder] = (await service.getVisibilityForClient('client-1', 'r1')).contactHolders;
    expect(holder.contactsVisibleFrom).toBe(new Date(createdAt.getTime() + VOLUNTARY_WITHDRAWAL_GRACE_MS).toISOString());
    expect(new Date(holder.contactsVisibleFrom as string).getTime()).toBeGreaterThan(Date.now());
  });

  it('IN_MARKETPLACE fara preluari → proiect vizibil, niciun detinator', async () => {
    const { service } = setup({
      request: { id: 'r1', clientUserId: 'client-1', status: 'IN_MARKETPLACE', deletedAt: null, publishedAt: new Date(), lat: 1, lng: 1, deliveredAt: null },
    });
    await expect(service.getVisibilityForClient('client-1', 'r1')).resolves.toEqual({
      requestId: 'r1', projectVisibleInMarketplace: true, contactHolders: [], marketplaceClosedReason: null,
      coverage: 'COVERED', pastContactAccess: [],
    });
  });

  // e4: dupa ce o firma renunta, caseta nu mai spune "Nicio firma inca" — istoricul fara nume
  it('istoric: firma care a avut contactele si a renuntat → pana pe <data inchiderii>, fara nume', async () => {
    const claimed = new Date(Date.now() - 600 * MIN);
    const closed = new Date(Date.now() - 60 * MIN);
    const { service, prisma } = setup({
      request: { id: 'r1', clientUserId: 'client-1', status: 'IN_MARKETPLACE', deletedAt: null, publishedAt: claimed, lat: 1, lng: 1, deliveredAt: null },
      slots: [{ ...slot('s1', 'WITHDRAWN_VOLUNTARY', claimed), updatedAt: closed }],
    });
    const res = await service.getVisibilityForClient('client-1', 'r1');
    expect(res.contactHolders).toEqual([]);
    expect(res.pastContactAccess).toEqual([{ until: closed.toISOString() }]);
    expect(JSON.stringify(res.pastContactAccess)).not.toContain('Firma');
    // a doua interogare = doar preluarile inchise
    const closedQuery = prisma.claimSlot.findMany.mock.calls[1][0];
    expect(closedQuery.where.status.in).not.toContain('ACTIVE');
    expect(closedQuery.where.status.in).toContain('WITHDRAWN');
  });

  // revizie m2: data vine din withdrawnAt (scris la decontare), nu din updatedAt
  it('istoric: data = withdrawnAt, chiar daca randul a fost atins mai tarziu', async () => {
    const claimed = new Date(Date.now() - 600 * MIN);
    const withdrawn = new Date(Date.now() - 120 * MIN);
    const touched = new Date(Date.now() - 5 * MIN);
    const { service } = setup({
      slots: [{ ...slot('s1', 'WITHDRAWN', claimed), withdrawnAt: withdrawn, updatedAt: touched }],
    });
    expect((await service.getVisibilityForClient('client-1', 'r1')).pastContactAccess).toEqual([{ until: withdrawn.toISOString() }]);
  });

  it('istoric: firma care a renuntat in gratie (AFTER_GRACE, contacte inca ascunse) → nu apare', async () => {
    const claimed = new Date(Date.now() - 60 * MIN);
    const { service } = setup({
      slots: [{ ...slot('s1', 'WITHDRAWN_VOLUNTARY', claimed), updatedAt: new Date(claimed.getTime() + 5 * MIN) }],
      settings: { claim_contact_reveal_policy: 'AFTER_GRACE' },
    });
    expect((await service.getVisibilityForClient('client-1', 'r1')).pastContactAccess).toEqual([]);
  });

  // a6 (PO a6-1): doar da / nu, fara numar de firme
  it('acoperire: nicio firma pe raza → NONE; firma pe raza → COVERED', async () => {
    const none = setup({ covered: false });
    expect((await none.service.getVisibilityForClient('client-1', 'r1')).coverage).toBe('NONE');
    expect(none.prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const covered = setup({ covered: true });
    expect((await covered.service.getVisibilityForClient('client-1', 'r1')).coverage).toBe('COVERED');
  });

  it('acoperire: cerere fara coordonate → UNKNOWN, fara interogare', async () => {
    const { service, prisma } = setup({
      request: { id: 'r1', clientUserId: 'client-1', status: 'IN_MARKETPLACE', deletedAt: null, publishedAt: new Date(), lat: null, lng: null, deliveredAt: null },
    });
    expect((await service.getVisibilityForClient('client-1', 'r1')).coverage).toBe('UNKNOWN');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('ACCEPTED / sloturi pline → proiectul nu mai e in marketplace; COMPLETED ramane detinator', async () => {
    const t = new Date(Date.now() - 600 * MIN);
    const { service } = setup({
      request: { id: 'r1', clientUserId: 'client-1', status: 'ACCEPTED', deletedAt: null, publishedAt: t, lat: 1, lng: 1, deliveredAt: null },
      slots: [slot('s1', 'COMPLETED', t, 'Castigatoare')],
    });
    const res = await service.getVisibilityForClient('client-1', 'r1');
    expect(res.projectVisibleInMarketplace).toBe(false);
    expect(res.contactHolders.map((h) => [h.companyName, h.claimStatus])).toEqual([['Castigatoare', 'COMPLETED']]);

    const full = setup({ slots: [slot('a', 'ACTIVE', t), slot('b', 'ACTIVE', t), slot('c', 'OFFER_SENT', t)] });
    expect((await full.service.getVisibilityForClient('client-1', 'r1')).projectVisibleInMarketplace).toBe(false);
  });

  it('flag-ul claims_open_after_first_offer: OFFERS_RECEIVED vizibil doar cu flag pornit', async () => {
    const req = { id: 'r1', clientUserId: 'client-1', status: 'OFFERS_RECEIVED', deletedAt: null, publishedAt: new Date(), lat: 1, lng: 1, deliveredAt: null };
    const off = setup({ request: req, settings: { claims_open_after_first_offer: 'false' } });
    const offRes = await off.service.getVisibilityForClient('client-1', 'r1');
    expect(offRes.projectVisibleInMarketplace).toBe(false);
    expect(offRes.marketplaceClosedReason).toBe('FIRST_OFFER_RULE');
    const on = setup({ request: req, settings: { claims_open_after_first_offer: 'true' } });
    const onRes = await on.service.getVisibilityForClient('client-1', 'r1');
    expect(onRes.projectVisibleInMarketplace).toBe(true);
    expect(onRes.marketplaceClosedReason).toBeNull();
  });

  // a1 (PO 2026-11-13): implicit cererea ramane in piata dupa prima oferta (si dupa o cerere
  // de modificare, NEGOTIATION) cat are locuri libere
  it.each(['OFFERS_RECEIVED', 'NEGOTIATION'])('setarea implicita: %s cu 1/3 locuri → vizibila, fara motiv', async (status) => {
    const t = new Date(Date.now() - 60 * MIN);
    const { service } = setup({
      request: { id: 'r1', clientUserId: 'client-1', status, deletedAt: null, publishedAt: t, lat: 1, lng: 1, deliveredAt: null },
      slots: [slot('s1', 'OFFER_SENT', t)],
    });
    const res = await service.getVisibilityForClient('client-1', 'r1');
    expect(res.projectVisibleInMarketplace).toBe(true);
    expect(res.marketplaceClosedReason).toBeNull();
  });

  it('motivul inchiderii: locuri ocupate / oferta acceptata / expirata', async () => {
    const t = new Date(Date.now() - 600 * MIN);
    const req = (status: string) => ({ id: 'r1', clientUserId: 'client-1', status, deletedAt: null, publishedAt: t, lat: 1, lng: 1, deliveredAt: null });
    const full = setup({ request: req('OFFERS_RECEIVED'), slots: [slot('a', 'ACTIVE', t), slot('b', 'OFFER_SENT', t), slot('c', 'OFFER_SENT', t)] });
    expect((await full.service.getVisibilityForClient('client-1', 'r1')).marketplaceClosedReason).toBe('SLOTS_FULL');
    const accepted = setup({ request: req('ACCEPTED'), slots: [slot('a', 'OFFER_SENT', t)] });
    expect((await accepted.service.getVisibilityForClient('client-1', 'r1')).marketplaceClosedReason).toBe('OFFER_ACCEPTED');
    const expired = setup({ request: req('EXPIRED') });
    expect((await expired.service.getVisibilityForClient('client-1', 'r1')).marketplaceClosedReason).toBe('EXPIRED');
  });
});
