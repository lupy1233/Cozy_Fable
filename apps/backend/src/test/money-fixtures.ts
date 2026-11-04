import { randomUUID } from 'node:crypto';
import type { ClaimSlotStatus, CreditTransactionType, ProjectSize, RequestStatus } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { runTx } from '../infra/prisma/tx';
import type { CreditsService } from '../modules/billing/credits.service';

// E-admin-platform-14 — fixture-uri pentru specurile de bani pe PostgreSQL real
// (*.integration.spec.ts, doar cu TEST_DATABASE_URL local — vezi db-guard.ts).
// Reguli: creditele se misca DOAR prin CreditsService (portofel creat cu 0, apoi grant);
// fiecare rand are prefixul "E14 " / email @example.invalid si se sterge dupa id in afterEach;
// firmele demo nu se ating niciodata.

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface TestPrisma {
  prisma: PrismaService;
  setLatency(ms: number): void;
  inTxCount(): number;
}

// PrismaService cu URL explicit + middleware (ca in quotes.concurrency): numara operatiile din
// tranzactii interactive si poate injecta latenta (curse mai late, ca in productie).
export function createTestPrisma(url: string): TestPrisma {
  const prisma = new PrismaService({ datasources: { db: { url } } });
  let latencyMs = 0;
  let inTx = 0;
  prisma.$use(async (params, next) => {
    if (params.runInTransaction) inTx++;
    if (latencyMs > 0) await sleep(latencyMs);
    return next(params);
  });
  return {
    prisma,
    setLatency: (ms: number) => {
      latencyMs = ms;
    },
    inTxCount: () => inTx,
  };
}

export interface TestFirm {
  companyId: string;
  ownerId: string;
}

export interface MakeFirmOptions {
  label: string;
  lat: number;
  lng: number;
  radiusKm?: number;
  grant?: number;
}

export async function makeFirm(prisma: PrismaService, credits: CreditsService, opts: MakeFirmOptions): Promise<TestFirm> {
  const { label, lat, lng, radiusKm = 50, grant = 20 } = opts;
  const company = await prisma.company.create({
    data: {
      name: `E14 ${label}`, cui: randomUUID(), regComNumber: 'test', addressText: 'test',
      county: 'test', city: 'test', lat, lng, status: 'APPROVED',
    },
  });
  const owner = await prisma.user.create({
    data: { email: `${randomUUID()}@example.invalid`, name: `E14 owner ${label}`, role: 'COMPANY_USER', passwordHash: 'test' },
  });
  await prisma.companyMember.create({ data: { companyId: company.id, userId: owner.id, role: 'OWNER' } });
  await prisma.companyLocation.create({
    data: { companyId: company.id, addressText: 'test', county: 'test', city: 'test', lat, lng, coverageRadiusKm: radiusKm },
  });
  await prisma.companyOfferFieldPermission.createMany({
    data: (['PRICE', 'DESCRIPTION', 'DELIVERY_TERM', 'DELIVERY_DATE', 'WARRANTY'] as const).map((fieldKey) => ({
      companyId: company.id, role: 'OWNER' as const, fieldKey, canEdit: true,
    })),
  });
  // portofel gol + GRANT prin ledger (niciodata sold scris direct)
  await prisma.companyCreditWallet.create({ data: { companyId: company.id, balance: 0, reserved: 0 } });
  if (grant > 0) await runTx(prisma, 'write', (tx) => credits.grant(company.id, grant, 'CREDIT_PURCHASE', tx));
  return { companyId: company.id, ownerId: owner.id };
}

export async function makeClient(prisma: PrismaService): Promise<string> {
  const client = await prisma.user.create({
    data: { email: `${randomUUID()}@example.invalid`, name: 'E14 client', role: 'CLIENT', passwordHash: 'test' },
  });
  return client.id;
}

export interface MakeRequestOptions {
  cost: number;
  lat: number;
  lng: number;
  status?: RequestStatus;
  publishedMinutesAgo?: number;
  size?: ProjectSize;
}

// Cerere publicata (toate campurile pe care claim-ul si marketplace-ul le cer nenule).
export async function makePublishedRequest(prisma: PrismaService, clientId: string, opts: MakeRequestOptions): Promise<string> {
  const { cost, lat, lng, status = 'IN_MARKETPLACE', publishedMinutesAgo = 120, size = 'SMALL' } = opts;
  const now = Date.now();
  const request = await prisma.request.create({
    data: {
      clientUserId: clientId,
      status,
      title: 'E14 test',
      description: 'E14 test',
      budgetRange: 'UNDISCLOSED',
      includesPaidDesign: false,
      hasOwnProject: false,
      addressText: 'test',
      county: 'test',
      city: 'test',
      lat,
      lng,
      projectSize: size,
      sizeScore: cost,
      creditCost: cost,
      publishedAt: new Date(now - publishedMinutesAgo * 60_000),
      expiresAt: new Date(now + 7 * 24 * 3600 * 1000),
    },
  });
  return request.id;
}

export interface SlotBackdate {
  createdAt?: Date;
  assignDeadlineAt?: Date;
  slaDeadlineAt?: Date;
}

// Regulile de timp in specurile DB = coloane mutate in trecut (fara fake timers).
export async function backdate(prisma: PrismaService, model: 'claimSlot', id: string, fields: SlotBackdate): Promise<void> {
  if (model === 'claimSlot') await prisma.claimSlot.update({ where: { id }, data: fields });
}

export async function backdateRequest(
  prisma: PrismaService,
  id: string,
  fields: { deliveredAt?: Date; publishedAt?: Date },
): Promise<void> {
  await prisma.request.update({ where: { id }, data: fields });
}

export type SettlementType = Extract<CreditTransactionType, 'REFUND' | 'CONSUME'>;

export async function settlementsOf(prisma: PrismaService, slotId: string): Promise<SettlementType[]> {
  const rows = await prisma.creditTransaction.findMany({
    where: { claimSlotId: slotId, type: { in: ['REFUND', 'CONSUME'] } },
    select: { type: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => r.type as SettlementType);
}

export async function reservesOf(prisma: PrismaService, slotId: string): Promise<{ count: number; amount: number }> {
  const rows = await prisma.creditTransaction.findMany({
    where: { claimSlotId: slotId, type: 'RESERVE' },
    select: { amount: true },
  });
  return { count: rows.length, amount: rows.reduce((sum, r) => sum + r.amount, 0) };
}

export const OPEN_SLOT_STATUSES: ClaimSlotStatus[] = ['ACTIVE', 'OFFER_SENT'];

// Invarianta contabila (IMPACT credite pct. 2/7): portofelul = suma ledger-ului si fiecare
// RESERVE are exact o decontare (REFUND sau CONSUME) odata ce slotul e inchis.
// E-admin-platform-15: `unreservedSlotIds` = sloturi create fara RESERVE (ca seed-demo / date
// vechi) — pentru ele regula e 0 RESERVE si 0 decontari (settle() nu misca bani).
export async function assertLedgerBalanced(
  prisma: PrismaService,
  companyId: string,
  opts: { unreservedSlotIds?: string[] } = {},
): Promise<void> {
  const wallet = await prisma.companyCreditWallet.findUniqueOrThrow({ where: { companyId } });
  const groups = await prisma.creditTransaction.groupBy({
    by: ['type'],
    where: { companyId },
    _sum: { amount: true },
  });
  const sum = (type: CreditTransactionType) => groups.find((g) => g.type === type)?._sum.amount ?? 0;
  expect(wallet.reserved).toBe(sum('RESERVE') - sum('REFUND') - sum('CONSUME'));
  expect(wallet.balance).toBe(sum('GRANT') - sum('RESERVE') + sum('REFUND'));
  expect(wallet.balance).toBeGreaterThanOrEqual(0);
  expect(wallet.reserved).toBeGreaterThanOrEqual(0);

  const slots = await prisma.claimSlot.findMany({ where: { companyId }, select: { id: true, status: true } });
  for (const slot of slots) {
    const txs = await prisma.creditTransaction.findMany({ where: { claimSlotId: slot.id }, select: { type: true } });
    const reserves = txs.filter((t) => t.type === 'RESERVE').length;
    const settlements = txs.filter((t) => t.type === 'REFUND' || t.type === 'CONSUME').length;
    const unreserved = opts.unreservedSlotIds?.includes(slot.id) ?? false;
    const expected = unreserved || OPEN_SLOT_STATUSES.includes(slot.status) ? 0 : 1;
    // obiectul include slotul si statusul ca un esec sa spuna exact unde s-a rupt ledger-ul
    expect({ slot: slot.id, status: slot.status, reserves, settlements }).toEqual({
      slot: slot.id,
      status: slot.status,
      reserves: unreserved ? 0 : 1,
      settlements: expected,
    });
  }
}

export interface MoneyCleanup {
  requestIds: string[];
  companyIds: string[];
  userIds: string[];
}

// Stergere dupa id (ordinea conteaza: outbox/notificari nu au FK; cererea cascadeaza sloturi,
// oferte, retrageri, chat; firma cascadeaza portofel, ledger, penalizari, locatii).
export async function cleanupMoney(prisma: PrismaService, ids: MoneyCleanup): Promise<void> {
  const payloadFilters = [
    ...ids.requestIds.map((id) => ({ payload: { path: ['requestId'], equals: id } })),
    ...ids.companyIds.map((id) => ({ payload: { path: ['companyId'], equals: id } })),
  ];
  if (payloadFilters.length) await prisma.domainEventOutbox.deleteMany({ where: { OR: payloadFilters } });
  if (ids.userIds.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: ids.userIds } } });
    await prisma.idempotencyKey.deleteMany({ where: { userId: { in: ids.userIds } } });
  }
  if (ids.requestIds.length) await prisma.request.deleteMany({ where: { id: { in: ids.requestIds } } });
  if (ids.companyIds.length) await prisma.company.deleteMany({ where: { id: { in: ids.companyIds } } });
  if (ids.userIds.length) await prisma.user.deleteMany({ where: { id: { in: ids.userIds } } });
}

// Releul outbox al serverului de dev (daca ruleaza pe aceeasi baza) poate livra o intentie
// chiar inainte de cleanup → notificari pentru utilizatori deja stersi (fara FK). O trecere
// finala, dupa o pauza scurta, le curata. In CI nu ruleaza niciun releu.
export async function sweepLateNotifications(prisma: PrismaService, userIds: string[], waitMs = 1500): Promise<void> {
  if (!userIds.length) return;
  await sleep(waitMs);
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
}
