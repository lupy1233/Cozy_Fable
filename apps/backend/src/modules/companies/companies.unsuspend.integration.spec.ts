import { randomUUID } from 'node:crypto';
import { testDatabaseUrl } from '../../test/db-guard';
import { createTestPrisma } from '../../test/money-fixtures';
import { runTx } from '../../infra/prisma/tx';
import { PenaltiesService } from '../penalties/penalties.service';
import { CompaniesService } from './companies.service';

// Etapa 12 (k2) — ridicarea suspendarii pe PostgreSQL real: firma APPROVED, punctele active la 0,
// evenimentele de penalizare raman (expirate), o penalizare noua sub prag nu mai suspenda.

const url = testDatabaseUrl();

(url ? describe : describe.skip)('ridicarea suspendarii pe PostgreSQL (k2)', () => {
  jest.setTimeout(60_000);
  const prisma = url ? createTestPrisma(url).prisma : (undefined as never);
  const outbox = { record: jest.fn().mockResolvedValue(undefined) };
  const settings = { getInt: jest.fn(async (_k: string, fallback: number) => fallback) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companies = url ? new CompaniesService(prisma, {} as any, outbox as any, settings as any) : (undefined as never);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const penalties = url ? new PenaltiesService(prisma, settings as any) : (undefined as never);
  const companyIds: string[] = [];

  async function suspendedFirm(points: number[]) {
    const now = Date.now();
    const company = await prisma.company.create({
      data: {
        name: `k2 ${randomUUID().slice(0, 6)}`, cui: randomUUID(), regComNumber: 'test', addressText: 'test',
        county: 'test', city: 'test', lat: 44.43, lng: 26.1, status: 'SUSPENDED',
        suspendedAt: new Date(now), suspendedUntil: new Date(now + 180 * 86_400_000),
      },
    });
    companyIds.push(company.id);
    for (const p of points) {
      await prisma.penaltyEvent.create({
        data: {
          scope: 'COMPANY', companyId: company.id, ruleKey: 'SLA_MISS', points: p,
          appliedAt: new Date(now - 86_400_000), expiresAt: new Date(now + 170 * 86_400_000),
        },
      });
    }
    return company.id;
  }

  afterAll(async () => {
    if (!url) return;
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.$disconnect();
  });

  it('cu motiv → APPROVED, puncte active 0, istoricul ramane; o penalizare noua nu suspenda', async () => {
    const id = await suspendedFirm([6, 6]);
    const res = await companies.adminUnsuspend(id, { reason: 'Firma a explicat întârzierile.' });
    expect(res).toMatchObject({ id, status: 'APPROVED', penaltyPoints: 12, count: 2 });

    expect(await prisma.penaltyEvent.count({ where: { companyId: id } })).toBe(2);
    expect((await penalties.getCompanyStatus(id)).activePoints).toBe(0);

    const applied = await penalties.applyPenalty({ companyId: id, ruleKey: 'SLA_MISS' });
    expect(applied.suspended).toBe(false);
    const company = await prisma.company.findUniqueOrThrow({ where: { id } });
    expect(company.status).toBe('APPROVED');
  });

  // revizuire m3: penalizarea si ridicarea pornite deodata, de mai multe ori. Indiferent cine
  // castiga blocarea pe randul firmei, la sfarsit starea e coerenta: ori SUSPENDED cu punctele
  // active peste prag, ori APPROVED cu punctele sub prag — niciodata SUSPENDED cu 0–3 puncte.
  it.each([
    ['READ COMMITTED (write)', 'write'],
    ['Serializable (critical)', 'critical'],
  ] as const)('penalizare simultana cu ridicarea, apelant %s → stare coerenta', async (_label, profile) => {
    for (let round = 0; round < 8; round++) {
      const id = await suspendedFirm([6, 6]);
      const [unsuspended, penalty] = await Promise.allSettled([
        companies.adminUnsuspend(id, { reason: 'Firma a explicat întârzierile.' }),
        runTx(prisma, profile, (tx) => penalties.applyPenalty({ companyId: id, ruleKey: 'SLA_MISS' }, tx)),
      ]);
      expect(unsuspended.status).toBe('fulfilled');
      expect(penalty.status).toBe('fulfilled');
      const company = await prisma.company.findUniqueOrThrow({ where: { id } });
      const { activePoints } = await penalties.getCompanyStatus(id);
      if (company.status === 'SUSPENDED') expect(activePoints).toBeGreaterThanOrEqual(12);
      else {
        expect(company.status).toBe('APPROVED');
        expect(activePoints).toBeLessThan(12);
      }
    }
  });

  it('firma nesuspendata → 404 NOT_FOUND', async () => {
    const id = await suspendedFirm([]);
    await prisma.company.update({ where: { id }, data: { status: 'APPROVED' } });
    await expect(companies.adminUnsuspend(id, { reason: 'Motiv valid' })).rejects.toMatchObject({ status: 404 });
  });
});
