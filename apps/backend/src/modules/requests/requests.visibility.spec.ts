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
      requestId: 'r1', projectVisibleInMarketplace: true, contactHolders: [],
    });
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
    const off = setup({ request: req });
    expect((await off.service.getVisibilityForClient('client-1', 'r1')).projectVisibleInMarketplace).toBe(false);
    const on = setup({ request: req, settings: { claims_open_after_first_offer: 'true' } });
    expect((await on.service.getVisibilityForClient('client-1', 'r1')).projectVisibleInMarketplace).toBe(true);
  });
});
