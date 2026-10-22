import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { SettingsService } from '../../common/settings/settings.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { SubscriptionsService } from '../billing/subscriptions.service';
import type { OutboxService } from '../outbox/outbox.service';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/company.dto';

// E-company-24 — email de facturare optional al firmei (contabil): normalizat la salvare,
// sters cu ''/null, vizibil doar pentru OWNER/MANAGER.

function setup(role: string) {
  const company = {
    id: 'c1',
    name: 'A Mobila Premium',
    cui: '7850265',
    regComNumber: 'J40/1/2020',
    isVatPayer: true,
    billingEmail: 'contabil@firma-a.ro',
    status: 'APPROVED',
    addressText: 'Str. 1',
    county: 'Bucuresti',
    city: 'Bucuresti',
    lat: 44.4,
    lng: 26.1,
    rejectedAt: null,
    rejectionReason: null,
    suspendedUntil: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    members: [{ id: 'm1', userId: 'u1', role, createdAt: new Date(), user: { name: 'Ana', email: 'a@x.ro' } }],
    locations: [],
    portfolioItems: [],
    offerFieldPerms: [],
  };
  const prisma = {
    companyMember: { findUnique: jest.fn().mockResolvedValue({ companyId: 'c1', role }) },
    company: { findFirst: jest.fn().mockResolvedValue(company), update: jest.fn().mockResolvedValue({}) },
  };
  const service = new CompaniesService(
    prisma as unknown as PrismaService,
    {} as unknown as SubscriptionsService,
    {} as unknown as OutboxService,
    {} as unknown as SettingsService,
  );
  return { service, prisma };
}

describe('CompaniesService — email de facturare (E-company-24)', () => {
  it('PATCH me: adresa se salveaza trim + lowercase; "" / null o sterg; lipsa nu o atinge', async () => {
    const { service, prisma } = setup('OWNER');
    jest.spyOn(service as unknown as { requireManager: () => Promise<unknown> }, 'requireManager').mockResolvedValue({ companyId: 'c1', role: 'OWNER' });
    await service.updateProfile('u1', { billingEmail: ' Contabil@Firma-A.ro ' });
    expect(prisma.company.update).toHaveBeenLastCalledWith({ where: { id: 'c1' }, data: { billingEmail: 'contabil@firma-a.ro' } });
    await service.updateProfile('u1', { billingEmail: '' });
    expect(prisma.company.update).toHaveBeenLastCalledWith({ where: { id: 'c1' }, data: { billingEmail: null } });
    await service.updateProfile('u1', { billingEmail: null });
    expect(prisma.company.update).toHaveBeenLastCalledWith({ where: { id: 'c1' }, data: { billingEmail: null } });
    await service.updateProfile('u1', { name: 'X' });
    expect(prisma.company.update).toHaveBeenLastCalledWith({ where: { id: 'c1' }, data: { name: 'X' } });
  });

  it.each([
    ['OWNER', 'contabil@firma-a.ro'],
    ['MANAGER', 'contabil@firma-a.ro'],
    ['EMPLOYEE_TRUSTED', null],
    ['EMPLOYEE_MANAGED', null],
  ])('GET me ca %s → billingEmail %p', async (role, expected) => {
    const { service } = setup(role);
    const dto = await service.getMyCompany('u1');
    expect(dto.billingEmail).toBe(expected);
  });

  it('DTO: email invalid → eroare de validare; "", null si email valid trec', () => {
    const errors = (value: unknown) =>
      validateSync(plainToInstance(UpdateCompanyDto, { billingEmail: value })).filter((e) => e.property === 'billingEmail');
    expect(errors('nu-e-email')).toHaveLength(1);
    expect(errors('a'.repeat(250) + '@x.ro')).toHaveLength(1);
    expect(errors('')).toHaveLength(0);
    expect(errors(null)).toHaveLength(0);
    expect(errors('Contabil@Firma-A.ro')).toHaveLength(0);
  });
});
