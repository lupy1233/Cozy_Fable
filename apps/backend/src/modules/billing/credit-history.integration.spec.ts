import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { testDatabaseUrl } from '../../test/db-guard';
import { cleanupMoney, makeFirm } from '../../test/money-fixtures';
import { CreditsService } from './credits.service';
import { CreditHistoryService } from './credit-history.service';

// h3 (etapa 9) — istoricul portofelului pe PostgreSQL real: doar miscarile firmei proprii,
// soldul calculat la capat = soldul portofelului, paginarea nu pierde / dubleaza randuri,
// endpointul nu scrie in registru. Ruleaza doar cu TEST_DATABASE_URL local (db-guard).
const url = testDatabaseUrl();
(url ? describe : describe.skip)('credit history against PostgreSQL', () => {
  const prisma = new PrismaService(url ? { datasources: { db: { url } } } : undefined);
  const credits = new CreditsService(prisma);
  const history = new CreditHistoryService(prisma);
  const created: string[] = [];
  const users: string[] = [];

  async function firm(label: string, grant: number) {
    const f = await makeFirm(prisma, credits, { label: `h3 ${label}`, lat: 44.43, lng: 26.1, grant });
    created.push(f.companyId);
    users.push(f.ownerId);
    return f;
  }

  async function allPages(companyId: string, limit: number) {
    const items = [];
    let cursor: string | null = null;
    for (let i = 0; i < 100; i++) {
      const page = await history.list(companyId, { cursor, limit: String(limit) });
      items.push(...page.items);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return items;
  }

  afterEach(async () => {
    await cleanupMoney(prisma, { companyIds: created.splice(0), userIds: users.splice(0), requestIds: [] });
  });
  afterAll(async () => prisma.$disconnect());

  it('doar firma proprie; soldul de la capat = portofelul; fara scrieri', async () => {
    const a = await firm('A', 20);
    const b = await firm('B', 7);
    await runTx(prisma, 'write', (tx) => credits.reserve(a.companyId, 3, 'CLAIM_RESERVE', randomUUID(), tx));
    await runTx(prisma, 'write', (tx) => credits.grant(a.companyId, 10, 'TRIAL_BONUS', tx));
    await runTx(prisma, 'write', (tx) => credits.reserve(a.companyId, 4, 'CLAIM_RESERVE', randomUUID(), tx));
    const before = await prisma.creditTransaction.count();

    const items = await allPages(a.companyId, 2);
    expect(items).toHaveLength(4);
    expect(new Set(items.map((i) => i.id)).size).toBe(4);
    // cele mai noi primele
    const times = items.map((i) => Date.parse(i.createdAt));
    expect([...times].sort((x, y) => y - x)).toEqual(times);
    // nicio miscare a firmei B
    const bIds = new Set((await prisma.creditTransaction.findMany({ where: { companyId: b.companyId } })).map((t) => t.id));
    expect(items.some((i) => bIds.has(i.id))).toBe(false);

    const wallet = await prisma.companyCreditWallet.findUniqueOrThrow({ where: { companyId: a.companyId } });
    expect(items[0].availableAfter).toBe(wallet.balance);
    expect(items[0].reservedAfter).toBe(wallet.reserved);
    expect(items.reduce((s, i) => s + i.availableDelta, 0)).toBe(wallet.balance);
    expect(items.map((i) => i.kind)).toEqual(['CLAIM', 'TRIAL_BONUS', 'CLAIM', 'PURCHASE']);

    // doar citire
    expect(await prisma.creditTransaction.count()).toBe(before);
    expect(await prisma.companyCreditWallet.findUniqueOrThrow({ where: { companyId: a.companyId } })).toEqual(wallet);
  });

  it('cursorul altei firme nu deschide istoricul ei', async () => {
    const a = await firm('A2', 5);
    const b = await firm('B2', 9);
    const bRow = await prisma.creditTransaction.findFirstOrThrow({ where: { companyId: b.companyId } });
    const page = await history.list(a.companyId, { cursor: bRow.id });
    expect(page.items).toEqual([]);
  });

  // datele demo (seed-demo): miscarea OPENING_BALANCE face ca istoricul sa ajunga la sold.
  // Se verifica doar daca baza de test are datele demo incarcate.
  it('datele demo: soldul calculat din istoric = soldul portofelului', async () => {
    const seeded = await prisma.creditTransaction.findMany({
      where: { reason: 'OPENING_BALANCE' },
      select: { companyId: true },
      distinct: ['companyId'],
    });
    for (const { companyId } of seeded) {
      const wallet = await prisma.companyCreditWallet.findUniqueOrThrow({ where: { companyId } });
      const first = await history.list(companyId, { limit: '1' });
      expect(first.items[0]?.availableAfter ?? 0).toBe(wallet.balance);
      expect(first.items[0]?.reservedAfter ?? 0).toBe(wallet.reserved);
    }
  });
});
