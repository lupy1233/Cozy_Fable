import type { CreateQuoteInput } from '@marketplace/shared';
import { testDatabaseUrl } from '../../test/db-guard';
import {
  cleanupMoney,
  createTestPrisma,
  makeClient,
  makeFirm,
  makePublishedRequest,
  sweepLateNotifications,
  type MoneyCleanup,
} from '../../test/money-fixtures';
import { createMoneyServices, ownerCtx } from '../../test/money-services';

// e1-2 (PO 2026-11-13) — pe PostgreSQL real (TEST_DATABASE_URL local, garda db-guard):
// bifarea aceleiasi etape de doua ori in paralel lasa UN singur rand (unic pe request_id + stage)
// si o singura notificare catre client; debifarea sterge randul.

const COST = 2;
const GRANT = 20;
const LAT = 44.4268;
const LNG = 26.1025;

const url = testDatabaseUrl();

(url ? describe : describe.skip)('execution stages on PostgreSQL (e1-2)', () => {
  jest.setTimeout(120_000);
  const t = url ? createTestPrisma(url) : (undefined as unknown as ReturnType<typeof createTestPrisma>);
  const w = url ? { prisma: t.prisma, ...createMoneyServices(t.prisma) } : (undefined as never);
  const ids: MoneyCleanup = { requestIds: [], companyIds: [], userIds: [] };

  afterAll(async () => {
    const users = [...ids.userIds];
    await cleanupMoney(w.prisma, ids);
    await sweepLateNotifications(w.prisma, users);
    await w.prisma.$disconnect();
  });

  async function accepted(): Promise<{ companyId: string; ownerId: string; requestId: string }> {
    const a = await makeFirm(w.prisma, w.credits, { label: 'E1', lat: LAT, lng: LNG, grant: GRANT });
    ids.companyIds.push(a.companyId);
    ids.userIds.push(a.ownerId);
    const clientId = await makeClient(w.prisma);
    ids.userIds.push(clientId);
    const requestId = await makePublishedRequest(w.prisma, clientId, { cost: COST, lat: LAT, lng: LNG });
    ids.requestIds.push(requestId);
    const slot = await w.claims.create(ownerCtx(a.companyId), a.ownerId, { requestId });
    const quote = await w.quotes.createQuote(ownerCtx(a.companyId), a.ownerId, {
      claimSlotId: slot.id,
      price: 1000,
      description: 'E1 oferta',
    } as CreateQuoteInput);
    await w.quotes.acceptQuote(clientId, quote.id, quote.versions[0].id);
    return { companyId: a.companyId, ownerId: a.ownerId, requestId };
  }

  it('doua bifari paralele ale aceleiasi etape → un rand si o notificare; debifarea il sterge', async () => {
    const s = await accepted();
    const results = await Promise.allSettled([
      w.fulfillment.setExecutionStage(ownerCtx(s.companyId), s.ownerId, s.requestId, 'CONTRACT', true),
      w.fulfillment.setExecutionStage(ownerCtx(s.companyId), s.ownerId, s.requestId, 'CONTRACT', true),
    ]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(await w.prisma.requestExecutionStage.count({ where: { requestId: s.requestId, stage: 'CONTRACT' } })).toBe(1);
    const events = await w.prisma.domainEventOutbox.count({
      where: { eventType: 'execution.stage_updated', payload: { path: ['requestId'], equals: s.requestId } },
    });
    expect(events).toBe(1);

    const dto = await w.fulfillment.setExecutionStage(ownerCtx(s.companyId), s.ownerId, s.requestId, 'CONTRACT', false);
    expect(dto.stages.find((x) => x.stage === 'CONTRACT')?.done).toBe(false);
    expect(await w.prisma.requestExecutionStage.count({ where: { requestId: s.requestId } })).toBe(0);

    // review m3: re-bifarea dupa debifare nu mai anunta clientul (cheie stabila pe cerere + etapa)
    await w.fulfillment.setExecutionStage(ownerCtx(s.companyId), s.ownerId, s.requestId, 'CONTRACT', true);
    expect(await w.prisma.requestExecutionStage.count({ where: { requestId: s.requestId, stage: 'CONTRACT' } })).toBe(1);
    expect(await w.prisma.domainEventOutbox.count({
      where: { eventType: 'execution.stage_updated', payload: { path: ['requestId'], equals: s.requestId } },
    })).toBe(1);
  });
});
