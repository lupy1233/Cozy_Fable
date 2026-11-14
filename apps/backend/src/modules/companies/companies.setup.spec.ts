import { CompaniesService, companySetupSteps } from './companies.service';

// h1 (etapa 11) — cardul "Pregateste-ti firma" de pe panou: starea pasilor vine de la server,
// din datele existente (portofoliu, locatii, membri, e-mail de facturare).
// Revizuire m1: permisiunile ofertei = legatura optionala, doar proprietarului, fara bifa.

/* eslint-disable @typescript-eslint/no-explicit-any */

const EMPTY = { portfolioItems: 0, locations: 0, members: 1, billingEmail: null };

describe('companySetupSteps', () => {
  it('firma noua (proprietar): 0 din 3 pasi obligatorii; echipa si permisiunile sunt optionale', () => {
    const setup = companySetupSteps('OWNER', EMPTY)!;
    expect(setup.steps.map((s) => s.key)).toEqual(['PORTFOLIO', 'LOCATIONS', 'BILLING_EMAIL', 'TEAM', 'OFFER_PERMISSIONS']);
    expect(setup.steps.every((s) => !s.done)).toBe(true);
    expect(setup.steps.filter((s) => s.optional).map((s) => s.key)).toEqual(['TEAM', 'OFFER_PERMISSIONS']);
    expect(setup).toMatchObject({ requiredDone: 0, requiredTotal: 3, complete: false });
  });

  it('portofoliu + locatie → 2 facuti', () => {
    const setup = companySetupSteps('OWNER', { ...EMPTY, portfolioItems: 1, locations: 2 })!;
    expect(setup.requiredDone).toBe(2);
    expect(setup.steps.filter((s) => s.done).map((s) => s.key)).toEqual(['PORTFOLIO', 'LOCATIONS']);
  });

  it('pasii optionali nu tin progresul pe loc: obligatoriii facuti → complet, fara colegi', () => {
    const setup = companySetupSteps('OWNER', {
      portfolioItems: 1,
      locations: 1,
      members: 1,
      billingEmail: 'contabil@firma.ro',
    })!;
    expect(setup).toMatchObject({ requiredDone: 3, requiredTotal: 3, complete: true });
    expect(setup.steps.find((s) => s.key === 'TEAM')?.done).toBe(false);
    // permisiunile nu se bifeaza niciodata (exista mereu; nu masuram „vazut”)
    expect(setup.steps.find((s) => s.key === 'OFFER_PERMISSIONS')?.done).toBe(false);
  });

  it('echipa e facuta cand firma are cel putin un coleg; e-mailul din spatii nu conteaza', () => {
    const setup = companySetupSteps('OWNER', { ...EMPTY, members: 2, billingEmail: '   ' })!;
    expect(setup.steps.find((s) => s.key === 'TEAM')?.done).toBe(true);
    expect(setup.steps.find((s) => s.key === 'BILLING_EMAIL')?.done).toBe(false);
    expect(setup.requiredDone).toBe(0);
  });

  it('managerul: aceiasi 3 pasi obligatorii, fara legatura spre permisiuni (le seteaza doar proprietarul)', () => {
    const setup = companySetupSteps('MANAGER', { ...EMPTY, portfolioItems: 1, locations: 1, billingEmail: 'a@b.ro' })!;
    expect(setup.steps.map((s) => s.key)).not.toContain('OFFER_PERMISSIONS');
    expect(setup).toMatchObject({ requiredDone: 3, requiredTotal: 3, complete: true });
  });

  it('angajatii nu primesc pasii', () => {
    expect(companySetupSteps('EMPLOYEE_TRUSTED', EMPTY)).toBeNull();
    expect(companySetupSteps('EMPLOYEE_MANAGED', EMPTY)).toBeNull();
  });
});

function setup(role: string, company: any) {
  const prisma: any = {
    companyMember: { findUnique: jest.fn().mockResolvedValue({ companyId: 'c1', userId: 'u1', role }) },
    claimSlot: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
    companyCreditWallet: { findUnique: jest.fn().mockResolvedValue(null) },
    creditTransaction: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    penaltyEvent: { aggregate: jest.fn().mockResolvedValue({ _sum: { points: 0 } }) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    user: { findMany: jest.fn().mockResolvedValue([]) },
    company: { findUnique: jest.fn().mockResolvedValue(company) },
  };
  return { service: new CompaniesService(prisma, {} as any, {} as any, {} as any), prisma };
}

const counts = (c: Partial<Record<'portfolioItems' | 'locations' | 'members', number>>) => ({
  portfolioItems: 0,
  locations: 0,
  members: 1,
  ...c,
});

describe('CompaniesService.dashboardStats — setup', () => {
  it('firma noua: raspunsul panoului are 0 pasi facuti', async () => {
    const { service, prisma } = setup('OWNER', { billingEmail: null, _count: counts({}) });
    const stats = await service.dashboardStats('u1');
    expect(stats.setup).toMatchObject({ requiredDone: 0, requiredTotal: 3, complete: false });
    // interogarea e pe firma membrului; membrii cu cont sters nu se numara
    const args = prisma.company.findUnique.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'c1' });
    expect(args.select._count.select.members).toEqual({ where: { user: { deletedAt: null } } });
  });

  it('firma cu portofoliu si locatie: 2 pasi facuti', async () => {
    const { service } = setup('OWNER', { billingEmail: null, _count: counts({ portfolioItems: 3, locations: 1 }) });
    const stats = await service.dashboardStats('u1');
    expect(stats.setup?.requiredDone).toBe(2);
    expect(stats.setup?.steps.find((s) => s.key === 'PORTFOLIO')?.done).toBe(true);
    expect(stats.setup?.steps.find((s) => s.key === 'LOCATIONS')?.done).toBe(true);
  });

  it('angajat: fara pasi si fara interogare in plus', async () => {
    const { service, prisma } = setup('EMPLOYEE_MANAGED', { billingEmail: null, _count: counts({}) });
    const stats = await service.dashboardStats('u1');
    expect(stats.setup).toBeNull();
    expect(prisma.company.findUnique).not.toHaveBeenCalled();
  });
});
