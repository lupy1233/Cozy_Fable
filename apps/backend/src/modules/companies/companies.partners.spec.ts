import { CompaniesService } from './companies.service';
import { DEMO_EMAIL_SUFFIX, KEEP_COMPANY_NAMES, demoCompanyWhere } from './demo-companies';

// k1: lista publica „Firme partenere” (landing + /partners) nu arata firmele demo — aceeasi
// regula ca prisma/cleanup-demo.ts: macar un membru @demo.ro, exceptand firmele pastrate.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Member = { email: string };
type Row = { id: string; name: string; status: string; deletedAt: Date | null; members: Member[] };

// evaluator minimal pentru where-ul folosit de listPartners (status, deletedAt, NOT demo)
function matchesDemo(row: Row): boolean {
  const suffix = (demoCompanyWhere as any).members.some.user.email.endsWith as string;
  const keep = (demoCompanyWhere as any).name.notIn as string[];
  return row.members.some((m) => m.email.endsWith(suffix)) && !keep.includes(row.name);
}

function setup(rows: Row[]) {
  const findMany = jest.fn(async ({ where }: any) =>
    rows
      .filter((r) => r.status === where.status && r.deletedAt === where.deletedAt)
      .filter((r) => (where.NOT === demoCompanyWhere ? !matchesDemo(r) : true))
      .map((r) => ({ ...r, city: 'Bucuresti', county: 'B', createdAt: new Date('2026-01-01'), portfolioItems: [] })),
  );
  const prisma: any = { company: { findMany } };
  const service = new CompaniesService(prisma, {} as any, {} as any, {} as any);
  return { service, findMany };
}

const approved = (id: string, name: string, emails: string[]): Row => ({
  id,
  name,
  status: 'APPROVED',
  deletedAt: null,
  members: emails.map((email) => ({ email })),
});

describe('CompaniesService.listPartners — firmele demo ascunse (k1)', () => {
  it('foloseste conventia cleanup-demo: @demo.ro, pastreaza Mobila Unicat', () => {
    expect(DEMO_EMAIL_SUFFIX).toBe('@demo.ro');
    expect(KEEP_COMPANY_NAMES).toEqual(['Mobila Unicat']);
  });

  it('exclude firmele cu macar un membru @demo.ro; firma reala si Mobila Unicat raman', async () => {
    const { service, findMany } = setup([
      approved('c-demo', 'A Mobila Premium', ['owner.a@demo.ro', 'mgr.a@demo.ro']),
      approved('c-mixed', 'Mixt SRL', ['owner@firma-reala.ro', 'test@demo.ro']),
      approved('c-real', 'Firma Reala', ['owner@firma-reala.ro']),
      approved('c-keep', 'Mobila Unicat', ['contact@demo.ro']),
      { ...approved('c-pending', 'In verificare', ['x@firma.ro']), status: 'PENDING_VERIFICATION' },
    ]);
    const out = await service.listPartners();
    expect(out.map((p) => p.id).sort()).toEqual(['c-keep', 'c-real']);
    // filtrul e pus in interogare (nu dupa), langa APPROVED + nesterse
    expect(findMany.mock.calls[0][0].where).toEqual({ status: 'APPROVED', deletedAt: null, NOT: demoCompanyWhere });
  });

  it('where-ul demo: membri @demo.ro si numele nu e in lista pastrata', () => {
    expect(demoCompanyWhere).toEqual({
      members: { some: { user: { email: { endsWith: '@demo.ro' } } } },
      name: { notIn: ['Mobila Unicat'] },
    });
  });
});
