import { randomUUID } from 'node:crypto';
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
import { createMoneyServices } from '../../test/money-services';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { MarketplaceBudgetEstimator } from '../marketplace/marketplace-budget-estimate';
import { ConfiguratorService } from '../requests/configurator.service';
import { SizingService } from '../sizing/sizing.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import type { NotificationEmailsService } from './notification-emails.service';
import { NEW_IN_AREA_EVENT, NewRequestsService, newInAreaKey } from './new-requests.service';

// g1-2 (revizie M1 / teste lipsa 1): scanarea „cerere noua in zona” pe PostgreSQL real, cu lista
// adevarata din marketplace (SQL-ul published_at + intarziere <= now(), Haversine pe raza).
// Firma pe plan cu 30 min, cerere in raza: nimic la +29 min, un rand outbox la +31 min, nimic la
// a doua rulare; firma din afara razei nu primeste nimic. Il ruleaza coordonatorul (marketplace_test).

const LAT = 44.4268;
const LNG = 26.1025;
const FAR_LAT = 46.7712; // Cluj, ~320 km
const FAR_LNG = 23.6236;

const url = testDatabaseUrl();

function wire(dbUrl: string) {
  const { prisma } = createTestPrisma(dbUrl);
  const services = createMoneyServices(prisma);
  const marketplace = new MarketplaceService(prisma, services.settings, services.uploads, services.calendar, new MarketplaceBudgetEstimator(new ConfiguratorService(), new SizingService(prisma)));
  const entitlements = new EntitlementsService(prisma);
  const scanner = () => new NewRequestsService(prisma, entitlements, marketplace, services.outbox, {} as unknown as NotificationEmailsService);
  return { prisma, marketplace, scanner, ...services };
}

(url ? describe : describe.skip)('request.new_in_area pe PostgreSQL (g1-2)', () => {
  jest.setTimeout(120_000);
  const w = url ? wire(url) : (undefined as unknown as ReturnType<typeof wire>);
  const ids: MoneyCleanup = { requestIds: [], companyIds: [], userIds: [] };
  const allUserIds: string[] = [];
  const planIds: string[] = [];

  afterEach(async () => {
    await cleanupMoney(w.prisma, ids);
    ids.requestIds = [];
    ids.companyIds = [];
    allUserIds.push(...ids.userIds);
    ids.userIds = [];
  });
  afterAll(async () => {
    if (planIds.length) await w.prisma.subscriptionPlan.deleteMany({ where: { id: { in: planIds } } });
    await sweepLateNotifications(w.prisma, allUserIds);
    await w.prisma.$disconnect();
  });

  async function firmWithPlan(label: string, gating: number, lat: number, lng: number) {
    const f = await makeFirm(w.prisma, w.credits, { label, lat, lng, grant: 0 });
    ids.companyIds.push(f.companyId);
    ids.userIds.push(f.ownerId);
    const plan = await w.prisma.subscriptionPlan.create({
      data: { code: `T9${randomUUID().slice(0, 8).toUpperCase()}`, priceRon: 0, includedCredits: 0, marketplaceGatingDelayMin: gating },
    });
    planIds.push(plan.id);
    await w.prisma.subscriptionPlanFeature.create({ data: { planId: plan.id, featureKey: 'MARKETPLACE_ACCESS', enabled: true } });
    await w.prisma.subscription.create({
      data: { companyId: f.companyId, planId: plan.id, status: 'ACTIVE', expiresAt: new Date(Date.now() + 30 * 24 * 3600_000) },
    });
    return f;
  }

  // doar randurile firmelor din test (baza de test poate avea si alte firme eligibile pe raza)
  const mine = new Set<string>();
  const rowsFor = async (requestId: string) =>
    (await w.prisma.domainEventOutbox.findMany({ where: { eventType: NEW_IN_AREA_EVENT, payload: { path: ['requestId'], equals: requestId } } }))
      .filter((r) => mine.has((r.payload as { companyId?: string }).companyId ?? ''));

  it('plan 30 min: nimic la +29 min, un singur anunt la +31 min, nimic la a doua rulare; firma departata nimic', async () => {
    const near = await firmWithPlan('g1-near', 30, LAT, LNG);
    const far = await firmWithPlan('g1-far', 30, FAR_LAT, FAR_LNG);
    mine.add(near.companyId);
    mine.add(far.companyId);
    const clientId = await makeClient(w.prisma);
    ids.userIds.push(clientId);
    const requestId = await makePublishedRequest(w.prisma, clientId, { cost: 1, lat: LAT, lng: LNG, publishedMinutesAgo: 29 });
    ids.requestIds.push(requestId);

    const scanner = w.scanner();
    await scanner.scanNewInArea(new Date());
    expect(await rowsFor(requestId)).toHaveLength(0);

    // timpul „trece”: cererea e publicata acum 31 de minute (SQL-ul listei foloseste now())
    await w.prisma.request.update({ where: { id: requestId }, data: { publishedAt: new Date(Date.now() - 31 * 60_000) } });
    await scanner.scanNewInArea(new Date());
    const rows = await rowsFor(requestId);
    expect(rows.map((r) => r.eventKey)).toEqual([newInAreaKey(requestId, near.companyId)]);
    expect(rows[0].targetUserIds).toEqual([near.ownerId]);
    // payload-ul pastrat: doar id-uri (titlul se rehidrateaza si se mascheaza la livrare)
    expect(Object.keys(rows[0].payload as object).sort()).toEqual(['companyId', 'requestId']);

    await scanner.scanNewInArea(new Date());
    // „repornire”: instanta noua, fara memorie → tot un singur rand
    await w.scanner().scanNewInArea(new Date());
    expect(await rowsFor(requestId)).toHaveLength(1);
    expect((await rowsFor(requestId)).some((r) => r.eventKey === newInAreaKey(requestId, far.companyId))).toBe(false);
  });
});
