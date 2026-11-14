import { NewRequestsService, newInAreaKey, NEW_IN_AREA_EVENT } from './new-requests.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { EntitlementsService } from '../entitlements/entitlements.service';
import type { MarketplaceService } from '../marketplace/marketplace.service';
import type { OutboxService } from '../outbox/outbox.service';
import type { NotificationEmailsService } from './notification-emails.service';

// g1-2 (etapa 9): clopotelul „cerere noua in zona” + rezumatul zilnic pe e-mail.
// Vizibilitatea (intarzierea planului, raza, excluderi) e regula marketplace-ului: aici o
// simulam cu un MarketplaceService fals care aplica aceeasi formula (published_at + intarziere
// <= acum, firma pe raza), ca sa verificam ca anuntul urmeaza lista firmei. Testul pe baza reala
// e in new-requests.integration.spec.ts.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const T0 = new Date('2026-11-14T08:00:00Z');
const min = (n: number) => new Date(T0.getTime() + n * 60_000);

interface Req { id: string; title: string; publishedAt: Date; coveredBy: string[]; city?: string; county?: string }
interface Co { id: string; name?: string; gating: number; digestUntil?: Date | null; marketplaceAccess?: boolean; subscription?: boolean }

function setup(opts: {
  requests: Req[];
  companies: Co[];
  members?: Record<string, string[]>;
  outboxRows?: { eventKey: string; eventType: string; payload: Record<string, unknown>; createdAt: Date }[];
  now: () => Date;
}) {
  const outboxRows = opts.outboxRows ?? [];
  const companies = opts.companies.map((c) => ({ ...c, digestUntil: c.digestUntil ?? null }));
  const tx = {};
  const prisma: Any = {
    request: {
      findMany: jest.fn(async ({ where }: Any) =>
        opts.requests.filter((r) => r.publishedAt >= where.publishedAt.gte).map((r) => ({ id: r.id, publishedAt: r.publishedAt }))),
    },
    company: {
      // o singura interogare: firma + abonamentul activ + planul cu functiile lui
      findMany: jest.fn(async () => companies.map((c) => ({
        id: c.id,
        name: c.name ?? c.id,
        newRequestsDigestUntil: c.digestUntil,
        subscriptions: c.subscription === false ? [] : [{
          plan: {
            marketplaceGatingDelayMin: c.gating,
            features: c.marketplaceAccess === false ? [] : [{ featureKey: 'MARKETPLACE_ACCESS', enabled: true, limitValue: null }],
          },
        }],
      }))),
      updateMany: jest.fn(async ({ where, data }: Any) => {
        const c = companies.find((x) => x.id === where.id);
        if (!c || (c.digestUntil?.getTime() ?? null) !== (where.newRequestsDigestUntil?.getTime?.() ?? null)) return { count: 0 };
        c.digestUntil = data.newRequestsDigestUntil;
        return { count: 1 };
      }),
    },
    domainEventOutbox: {
      findMany: jest.fn(async ({ where }: Any) => {
        if (where.eventKey) return outboxRows.filter((r) => where.eventKey.in.includes(r.eventKey)).map((r) => ({ eventKey: r.eventKey }));
        return outboxRows
          .filter((r) => r.eventType === where.eventType && r.createdAt > where.createdAt.gt && r.createdAt <= where.createdAt.lte)
          .map((r) => ({ payload: r.payload, createdAt: r.createdAt }));
      }),
    },
    companyMember: {
      findMany: jest.fn(async ({ where }: Any) => (opts.members?.[where.companyId] ?? [`${where.companyId}-m1`]).map((userId) => ({ userId }))),
    },
    $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  };
  const entitlements = { has: jest.fn((e: Any) => e.features.MARKETPLACE_ACCESS.enabled === true) };
  const marketplace = {
    list: jest.fn(async (companyId: string, gating: number) =>
      opts.requests
        .filter((r) => r.coveredBy.includes(companyId))
        .filter((r) => r.publishedAt.getTime() + gating * 60_000 <= opts.now().getTime())
        .map((r) => ({ id: r.id, title: `[mascat] ${r.title}`, city: r.city ?? 'Iași', county: r.county ?? 'Iași' }))),
  };
  const outbox = {
    record: jest.fn(async (_tx: unknown, eventKey: string, eventType: string, payload: Record<string, unknown>) => {
      outboxRows.push({ eventKey, eventType, payload, createdAt: opts.now() });
    }),
  };
  const emails = { sendNewRequestsDigest: jest.fn(async () => 1) };
  const make = () => new NewRequestsService(
    prisma as PrismaService,
    entitlements as unknown as EntitlementsService,
    marketplace as unknown as MarketplaceService,
    outbox as unknown as OutboxService,
    emails as unknown as NotificationEmailsService,
  );
  return { service: make(), make, prisma, outbox, marketplace, emails, outboxRows, companies };
}

// numarul de interogari la baza dintr-o rulare (mock-urile prisma + lista marketplace = ~2 drumuri)
function dbCalls(ctx: ReturnType<typeof setup>): number {
  const p = ctx.prisma;
  return p.request.findMany.mock.calls.length + p.company.findMany.mock.calls.length
    + p.domainEventOutbox.findMany.mock.calls.length + p.companyMember.findMany.mock.calls.length
    + p.$transaction.mock.calls.length + ctx.marketplace.list.mock.calls.length;
}
function resetCalls(ctx: ReturnType<typeof setup>): void {
  for (const m of [ctx.prisma.request.findMany, ctx.prisma.company.findMany, ctx.prisma.domainEventOutbox.findMany,
    ctx.prisma.companyMember.findMany, ctx.prisma.$transaction, ctx.marketplace.list, ctx.outbox.record]) m.mockClear();
}

describe('scanNewInArea (clopotel cand cererea devine vizibila)', () => {
  it('firma pe plan cu 30 min: nimic la +29 min, anuntul pleaca la +31 min, o singura data', async () => {
    let now = min(10);
    const ctx = setup({
      requests: [{ id: 'r1', title: 'Dulap', publishedAt: T0, coveredBy: ['gold', 'silver'] }],
      companies: [{ id: 'gold', gating: 0 }, { id: 'silver', gating: 30 }],
      members: { gold: ['g1', 'g2'], silver: ['s1'] },
      now: () => now,
    });
    await expect(ctx.service.scanNewInArea(now)).resolves.toBe(1);
    expect(ctx.marketplace.list).toHaveBeenCalledWith('gold', 0);
    expect(ctx.marketplace.list).not.toHaveBeenCalledWith('silver', 30); // nu i-a devenit vizibila
    expect(ctx.outbox.record).toHaveBeenCalledWith(expect.anything(), newInAreaKey('r1', 'gold'), NEW_IN_AREA_EVENT,
      { requestId: 'r1', requestTitle: '[mascat] Dulap', companyId: 'gold' }, ['g1', 'g2']);

    now = min(29);
    await expect(ctx.service.scanNewInArea(now)).resolves.toBe(0);

    now = min(31);
    await expect(ctx.service.scanNewInArea(now)).resolves.toBe(1);
    expect(ctx.marketplace.list).toHaveBeenCalledWith('silver', 30);
    expect(ctx.outbox.record).toHaveBeenLastCalledWith(expect.anything(), newInAreaKey('r1', 'silver'), NEW_IN_AREA_EVENT,
      { requestId: 'r1', requestTitle: '[mascat] Dulap', companyId: 'silver' }, ['s1']);

    // rulari ulterioare: nimic nou si nicio lista ceruta
    resetCalls(ctx);
    now = min(45);
    await expect(ctx.service.scanNewInArea(now)).resolves.toBe(0);
    expect(ctx.marketplace.list).not.toHaveBeenCalled();
    expect(ctx.outbox.record).not.toHaveBeenCalled();
  });

  it('firma din afara razei nu primeste anuntul, iar lista ei nu se mai cere la rularile urmatoare', async () => {
    let now = min(5);
    const ctx = setup({
      requests: [{ id: 'r1', title: 'Dulap', publishedAt: T0, coveredBy: ['near'] }],
      companies: [{ id: 'near', gating: 0 }, { id: 'far', gating: 0 }],
      now: () => now,
    });
    await ctx.service.scanNewInArea(now);
    expect(ctx.outbox.record.mock.calls.map((c: Any[]) => c[3].companyId)).toEqual(['near']);
    resetCalls(ctx);
    now = min(6);
    await ctx.service.scanNewInArea(now);
    expect(ctx.marketplace.list).not.toHaveBeenCalled();
  });

  it('payload-ul scris are doar requestId / requestTitle (mascat) / companyId', async () => {
    const now = min(5);
    const ctx = setup({ requests: [{ id: 'r1', title: 'Dulap', publishedAt: T0, coveredBy: ['a'] }], companies: [{ id: 'a', gating: 0 }], now: () => now });
    await ctx.service.scanNewInArea(now);
    expect(Object.keys(ctx.outbox.record.mock.calls[0][3]).sort()).toEqual(['companyId', 'requestId', 'requestTitle']);
  });

  it('firma fara acces la marketplace in plan / fara abonament activ nu e verificata', async () => {
    const now = min(5);
    const ctx = setup({
      requests: [{ id: 'r1', title: 'Dulap', publishedAt: T0, coveredBy: ['a', 'b', 'c'] }],
      companies: [{ id: 'a', gating: 0 }, { id: 'b', gating: 0, marketplaceAccess: false }, { id: 'c', gating: 0, subscription: false }],
      now: () => now,
    });
    await ctx.service.scanNewInArea(now);
    expect(ctx.marketplace.list).toHaveBeenCalledTimes(1);
    expect(ctx.marketplace.list).toHaveBeenCalledWith('a', 0);
    expect(ctx.prisma.company.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ deletedAt: null, subscriptions: { some: expect.anything() } }),
    }));
  });

  it('cererile vechi nu sunt „noi”: fereastra = intarzierea maxima + recuperarea; fara cereri → o singura interogare', async () => {
    const now = min(5 * 60);
    const ctx = setup({
      requests: [{ id: 'old', title: 'Vechi', publishedAt: T0, coveredBy: ['a'] }],
      companies: [{ id: 'a', gating: 0 }],
      now: () => now,
    });
    await expect(ctx.service.scanNewInArea(now)).resolves.toBe(0);
    expect(dbCalls(ctx)).toBe(1);
    const gte: Date = ctx.prisma.request.findMany.mock.calls[0][0].where.publishedAt.gte;
    // 60 min (plan maxim) + 20 min recuperare + 30 s
    expect(now.getTime() - gte.getTime()).toBe((60 + 20) * 60_000 + 30_000);
    expect(ctx.prisma.request.findMany.mock.calls[0][0].where.status).toEqual({ in: expect.arrayContaining(['IN_MARKETPLACE']) });
  });

  it('firma fara membri activi → nimic scris', async () => {
    const now = min(5);
    const ctx = setup({
      requests: [{ id: 'r1', title: 'Dulap', publishedAt: T0, coveredBy: ['a'] }],
      companies: [{ id: 'a', gating: 0 }],
      members: { a: [] },
      now: () => now,
    });
    await expect(ctx.service.scanNewInArea(now)).resolves.toBe(0);
    expect(ctx.outbox.record).not.toHaveBeenCalled();
  });

  it('recuperare: o coada blocata 10 minute nu pierde anuntul; dupa repornire nu se dubleaza', async () => {
    let now = min(10); // prima rulare abia la +10 min (cererea vizibila de la +0)
    const ctx = setup({ requests: [{ id: 'r1', title: 'Dulap', publishedAt: T0, coveredBy: ['a'] }], companies: [{ id: 'a', gating: 0 }], now: () => now });
    await expect(ctx.service.scanNewInArea(now)).resolves.toBe(1);
    // „repornire”: instanta noua, fara memorie → cheia outbox existenta opreste dublura, fara lista
    const fresh = ctx.make();
    resetCalls(ctx);
    now = min(12);
    await expect(fresh.scanNewInArea(now)).resolves.toBe(0);
    expect(ctx.marketplace.list).not.toHaveBeenCalled();
    expect(ctx.outbox.record).not.toHaveBeenCalled();
  });

  it('peste fereastra de recuperare (20 min) anuntul nu mai pleaca (limita documentata)', async () => {
    const now = min(21);
    const ctx = setup({ requests: [{ id: 'r1', title: 'Dulap', publishedAt: T0, coveredBy: ['a'] }], companies: [{ id: 'a', gating: 0 }], now: () => now });
    await expect(ctx.service.scanNewInArea(now)).resolves.toBe(0);
    expect(ctx.marketplace.list).not.toHaveBeenCalled();
  });

  it('cost (revizie M1), 50 de firme: fara cereri = 1; cerere de 40 min deja anuntata = 1–2; cerere tocmai vizibila = 2 + lista doar pentru firmele carora le-a devenit vizibila', async () => {
    let now = min(40);
    // 25 firme pe plan 0 (anuntate demult), 25 pe plan 30 (vizibila de la +30 → scadenta)
    const companies: Co[] = Array.from({ length: 50 }, (_, i) => ({ id: `c${i}`, gating: i < 25 ? 0 : 30 }));
    const covered = companies.slice(0, 5).map((c) => c.id).concat(companies.slice(25, 30).map((c) => c.id));
    const outboxRows = companies.map((c) => ({
      eventKey: newInAreaKey('r1', c.id), eventType: NEW_IN_AREA_EVENT, payload: { requestId: 'r1', companyId: c.id }, createdAt: min(c.gating),
    }));
    const ctx = setup({ requests: [{ id: 'r1', title: 'Dulap', publishedAt: T0, coveredBy: covered }], companies, outboxRows, now: () => now });

    // a) cerere de 40 min, deja anuntata tuturor: cererile + firmele (cache rece) + cheile outbox
    await expect(ctx.service.scanNewInArea(now)).resolves.toBe(0);
    expect(ctx.marketplace.list).not.toHaveBeenCalled();
    expect(dbCalls(ctx)).toBe(3);
    // aceeasi situatie un minut mai tarziu (cache cald, perechile tinute minte): 1 interogare
    resetCalls(ctx);
    now = min(41);
    await ctx.service.scanNewInArea(now);
    expect(dbCalls(ctx)).toBe(1);

    // b) nicio cerere recenta: 1 interogare
    resetCalls(ctx);
    now = min(5 * 60);
    await ctx.service.scanNewInArea(now);
    expect(dbCalls(ctx)).toBe(1);
  });

  it('cost: cerere tocmai vizibila pentru 25 de firme (plan 0), 5 pe raza → lista doar pentru cele 25, scrieri doar pentru 5', async () => {
    const now = min(1);
    const companies: Co[] = Array.from({ length: 50 }, (_, i) => ({ id: `c${i}`, gating: i < 25 ? 0 : 30 }));
    const ctx = setup({ requests: [{ id: 'r2', title: 'Hol', publishedAt: T0, coveredBy: ['c0', 'c1', 'c2', 'c3', 'c4'] }], companies, now: () => now });
    await expect(ctx.service.scanNewInArea(now)).resolves.toBe(5);
    expect(ctx.marketplace.list).toHaveBeenCalledTimes(25);
    expect(ctx.prisma.companyMember.findMany).toHaveBeenCalledTimes(5);
    expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(5);
    // 1 cereri + 1 firme + 1 chei outbox + 25 liste + 5 × (membri + tranzactie)
    expect(dbCalls(ctx)).toBe(3 + 25 + 10);
  });
});

describe('sendDailyDigest (rezumatul zilnic pe e-mail)', () => {
  const day = (n: number) => new Date(T0.getTime() + n * 24 * 60 * 60_000);
  const row = (requestId: string, companyId: string, createdAt: Date) => ({
    eventKey: newInAreaKey(requestId, companyId), eventType: NEW_IN_AREA_EVENT, payload: { requestId, companyId }, createdAt,
  });

  it('un singur e-mail pe firma cu cererile din ultimele 24 h, inca vizibile; a doua rulare nu repeta nimic', async () => {
    let now = day(1);
    const ctx = setup({
      requests: [
        { id: 'r1', title: 'Dulap', publishedAt: min(10), coveredBy: ['a'] },
        { id: 'r2', title: 'Hol', publishedAt: min(60), coveredBy: ['a'] },
        { id: 'r3', title: 'Inchisa', publishedAt: min(60), coveredBy: [] }, // nu mai e in lista firmei
      ],
      companies: [{ id: 'a', name: 'A Mobila', gating: 0 }],
      outboxRows: [row('r1', 'a', min(11)), row('r2', 'a', min(61)), row('r3', 'a', min(61)), row('old', 'a', day(-1))],
      now: () => now,
    });
    await expect(ctx.service.sendDailyDigest(now)).resolves.toBe(1);
    expect(ctx.emails.sendNewRequestsDigest).toHaveBeenCalledTimes(1);
    const [company, items] = (ctx.emails.sendNewRequestsDigest.mock.calls as Any[])[0];
    expect(company).toEqual({ id: 'a', name: 'A Mobila' });
    expect(items.map((i: Any) => i.requestId).sort()).toEqual(['r1', 'r2']);
    expect(items[0]).toEqual({ requestId: expect.any(String), title: expect.stringContaining('[mascat]'), city: 'Iași', county: 'Iași' });
    expect(ctx.companies[0].digestUntil).toEqual(now);

    await expect(ctx.service.sendDailyDigest(now)).resolves.toBe(0);
    ctx.outboxRows.push(row('r4', 'a', new Date(day(1).getTime() + 3_600_000)));
    (ctx.marketplace.list as jest.Mock).mockResolvedValue([
      { id: 'r1', title: 'x', city: 'c', county: 'j' },
      { id: 'r4', title: 'y', city: 'c', county: 'j' },
    ]);
    now = day(2);
    await expect(ctx.service.sendDailyDigest(now)).resolves.toBe(1);
    const second = (ctx.emails.sendNewRequestsDigest.mock.calls as Any[])[1][1];
    expect(second.map((i: Any) => i.requestId)).toEqual(['r4']);
  });

  it('nicio cerere noua → niciun e-mail si nicio citire pe firme', async () => {
    const now = day(1);
    const ctx = setup({ requests: [], companies: [{ id: 'a', gating: 0 }], now: () => now });
    await expect(ctx.service.sendDailyDigest(now)).resolves.toBe(0);
    expect(ctx.emails.sendNewRequestsDigest).not.toHaveBeenCalled();
    expect(ctx.prisma.company.findMany).not.toHaveBeenCalled();
  });

  it('revendicarea pierduta (alta rulare a trimis deja) → fara e-mail', async () => {
    const now = day(1);
    const ctx = setup({
      requests: [{ id: 'r1', title: 'Dulap', publishedAt: min(10), coveredBy: ['a'] }],
      companies: [{ id: 'a', gating: 0 }],
      outboxRows: [row('r1', 'a', min(11))],
      now: () => now,
    });
    ctx.prisma.company.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(ctx.service.sendDailyDigest(now)).resolves.toBe(0);
    expect(ctx.emails.sendNewRequestsDigest).not.toHaveBeenCalled();
  });

  it('revizie m1: lista arunca (inainte de marcaj) → marcajul nu se misca, reluarea jobului trimite rezumatul', async () => {
    const now = day(1);
    const ctx = setup({
      requests: [{ id: 'r1', title: 'Dulap', publishedAt: min(10), coveredBy: ['a'] }],
      companies: [{ id: 'a', gating: 0 }],
      outboxRows: [row('r1', 'a', min(11))],
      now: () => now,
    });
    (ctx.marketplace.list as jest.Mock).mockRejectedValueOnce(new Error('statement timeout'));
    await expect(ctx.service.sendDailyDigest(now)).rejects.toThrow('statement timeout');
    expect(ctx.prisma.company.updateMany).not.toHaveBeenCalled();
    expect(ctx.companies[0].digestUntil).toBeNull();
    await expect(ctx.service.sendDailyDigest(now)).resolves.toBe(1);
    expect(ctx.emails.sendNewRequestsDigest).toHaveBeenCalledTimes(1);
  });

  it('marcajul se scrie imediat inainte de trimitere; e-mailul picat dupa marcaj nu se repeta la reluare (fara dubluri)', async () => {
    const now = day(1);
    const ctx = setup({
      requests: [{ id: 'r1', title: 'Dulap', publishedAt: min(10), coveredBy: ['a'] }],
      companies: [{ id: 'a', gating: 0 }],
      outboxRows: [row('r1', 'a', min(11))],
      now: () => now,
    });
    ctx.emails.sendNewRequestsDigest.mockResolvedValueOnce(0); // SMTP picat pentru toti (doar logat)
    await expect(ctx.service.sendDailyDigest(now)).resolves.toBe(0);
    expect(ctx.marketplace.list.mock.invocationCallOrder[0]).toBeLessThan(ctx.prisma.company.updateMany.mock.invocationCallOrder[0]);
    expect(ctx.prisma.company.updateMany.mock.invocationCallOrder[0]).toBeLessThan(ctx.emails.sendNewRequestsDigest.mock.invocationCallOrder[0]);
    await expect(ctx.service.sendDailyDigest(now)).resolves.toBe(0);
    expect(ctx.emails.sendNewRequestsDigest).toHaveBeenCalledTimes(1);
  });

  it('nicio cerere inca vizibila → fara marcaj si fara e-mail', async () => {
    const now = day(1);
    const ctx = setup({
      requests: [{ id: 'r1', title: 'Dulap', publishedAt: min(10), coveredBy: [] }],
      companies: [{ id: 'a', gating: 0 }],
      outboxRows: [row('r1', 'a', min(11))],
      now: () => now,
    });
    await expect(ctx.service.sendDailyDigest(now)).resolves.toBe(0);
    expect(ctx.prisma.company.updateMany).not.toHaveBeenCalled();
    expect(ctx.emails.sendNewRequestsDigest).not.toHaveBeenCalled();
  });

  it('cererile anuntate altei firme nu apar in rezumatul firmei', async () => {
    const now = day(1);
    const ctx = setup({
      requests: [{ id: 'r1', title: 'Dulap', publishedAt: min(10), coveredBy: ['a', 'b'] }],
      companies: [{ id: 'a', gating: 0 }, { id: 'b', gating: 0 }],
      outboxRows: [row('r1', 'b', min(11))],
      now: () => now,
    });
    await ctx.service.sendDailyDigest(now);
    expect(ctx.emails.sendNewRequestsDigest).toHaveBeenCalledTimes(1);
    expect((ctx.emails.sendNewRequestsDigest.mock.calls as Any[])[0][0].id).toBe('b');
  });
});
