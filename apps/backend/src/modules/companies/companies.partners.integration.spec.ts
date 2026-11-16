import { randomUUID } from 'node:crypto';
import { testDatabaseUrl } from '../../test/db-guard';
import { createTestPrisma } from '../../test/money-fixtures';
import { CompaniesService } from './companies.service';

// k1 — filtrul firmelor demo din lista publica (listPartners) pe PostgreSQL real: semantica
// Prisma NOT { members.some(user.email endsWith @demo.ro), name notIn KEEP } — aceeasi regula
// ca prisma/cleanup-demo.ts (MACAR UN membru @demo.ro, exceptand „Mobila Unicat”).

const url = testDatabaseUrl();

(url ? describe : describe.skip)('listPartners pe PostgreSQL — firmele demo ascunse (k1)', () => {
  jest.setTimeout(60_000);
  const prisma = url ? createTestPrisma(url).prisma : (undefined as never);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = url ? new CompaniesService(prisma, {} as any, {} as any, {} as any) : (undefined as never);
  const companyIds: string[] = [];
  const userIds: string[] = [];

  async function firm(name: string, emails: string[], status: 'APPROVED' | 'PENDING_VERIFICATION' = 'APPROVED') {
    const company = await prisma.company.create({
      data: {
        name, cui: randomUUID(), regComNumber: 'test', addressText: 'test',
        county: 'test', city: 'test', lat: 44.43, lng: 26.1, status,
      },
    });
    companyIds.push(company.id);
    for (const [i, email] of emails.entries()) {
      const user = await prisma.user.create({
        data: { email, name: `k1 ${i}`, role: 'COMPANY_USER', passwordHash: 'test' },
      });
      userIds.push(user.id);
      await prisma.companyMember.create({
        data: { companyId: company.id, userId: user.id, role: i === 0 ? 'OWNER' : 'EMPLOYEE_TRUSTED' },
      });
    }
    return company.id;
  }

  afterAll(async () => {
    if (!url) return;
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } }); // membrii: cascade
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it('toti membrii @demo.ro → lipseste; firma reala si „Mobila Unicat” (cu membru @demo.ro) apar', async () => {
    const tag = randomUUID().slice(0, 8);
    const demo = await firm(`k1 demo ${tag}`, [`owner.${tag}@demo.ro`, `mgr.${tag}@demo.ro`]);
    const real = await firm(`k1 real ${tag}`, [`owner.${tag}@firma-reala.example`]);
    const keep = await firm('Mobila Unicat', [`unicat.${tag}@demo.ro`]);
    // macar un membru @demo.ro (regula scriptului) → ascunsa si cand are si un membru real
    const mixed = await firm(`k1 mixt ${tag}`, [`owner2.${tag}@firma-reala.example`, `x.${tag}@demo.ro`]);
    // firma fara membri nu e demo
    const empty = await firm(`k1 gol ${tag}`, []);
    const pending = await firm(`k1 pending ${tag}`, [`p.${tag}@firma-reala.example`], 'PENDING_VERIFICATION');

    // lista are take: 100 (createdAt asc) → baza de test trebuie sa aiba loc pentru firmele noi
    const approvedTotal = await prisma.company.count({ where: { status: 'APPROVED', deletedAt: null } });
    expect(approvedTotal).toBeLessThanOrEqual(100);

    const ids = (await service.listPartners()).map((p) => p.id);
    expect(ids).not.toContain(demo);
    expect(ids).toContain(real);
    expect(ids).toContain(keep);
    expect(ids).not.toContain(mixed);
    expect(ids).toContain(empty);
    expect(ids).not.toContain(pending);
  });
});
