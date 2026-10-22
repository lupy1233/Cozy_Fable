import type { SettingsService } from '../../common/settings/settings.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { SubscriptionsService } from '../billing/subscriptions.service';
import type { OutboxService } from '../outbox/outbox.service';
import { CompaniesService } from './companies.service';
import type { OnboardCompanyDto } from './dto/company.dto';

// E-company-19 — platitor TVA declarat: prefixul RO tastat la onboarding seteaza is_vat_payer
// (cui se salveaza fara prefix, unicitatea ramane pe cifre); PATCH /companies/me il poate schimba.

function setup() {
  const tx = {
    company: { create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'c-new', ...data })) },
    companyMember: { create: jest.fn().mockResolvedValue({}) },
    companyVerificationProfile: { create: jest.fn().mockResolvedValue({}) },
    companyOfferFieldPermission: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }]) },
  };
  const prisma = {
    companyMember: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue({ companyId: 'c1', role: 'OWNER' }),
    },
    company: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const outbox = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new CompaniesService(
    prisma as unknown as PrismaService,
    {} as unknown as SubscriptionsService,
    outbox as unknown as OutboxService,
    {} as unknown as SettingsService,
  );
  // DTO-ul final nu e subiectul testului
  jest.spyOn(service, 'getMyCompany').mockResolvedValue({ id: 'c-new' } as never);
  return { service, prisma, tx };
}

const dto = (cui: string): OnboardCompanyDto => ({
  name: 'A Mobila Premium',
  cui,
  regComNumber: 'J40/1234/2020',
  addressText: 'Str. Lemnului 1',
  county: 'Bucuresti',
  city: 'Bucuresti',
  lat: 44.43,
  lng: 26.1,
});

describe('CompaniesService — platitor TVA (E-company-19)', () => {
  it('onboarding cu prefix RO → isVatPayer true, cui salvat fara prefix', async () => {
    const { service, tx, prisma } = setup();
    await service.onboard('u1', 'owner@demo.ro', dto('RO7850265'));
    expect(tx.company.create).toHaveBeenCalledWith({ data: expect.objectContaining({ cui: '7850265', isVatPayer: true }) });
    // unicitatea / blocajul de reaplicare folosesc tot cifrele
    expect(prisma.company.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ cui: '7850265' }) }));
  });

  it('onboarding fara prefix → isVatPayer false; prefixul e case-insensitive', async () => {
    const plain = setup();
    await plain.service.onboard('u1', 'owner@demo.ro', dto('7850265'));
    expect(plain.tx.company.create).toHaveBeenCalledWith({ data: expect.objectContaining({ cui: '7850265', isVatPayer: false }) });
    const lower = setup();
    await lower.service.onboard('u1', 'owner@demo.ro', dto(' ro7850265 '));
    expect(lower.tx.company.create).toHaveBeenCalledWith({ data: expect.objectContaining({ isVatPayer: true }) });
  });

  it('PATCH me: isVatPayer se scrie doar cand e trimis', async () => {
    const { service, prisma } = setup();
    jest.spyOn(service as unknown as { requireManager: () => Promise<unknown> }, 'requireManager').mockResolvedValue({ companyId: 'c1', role: 'OWNER' });
    await service.updateProfile('u1', { isVatPayer: false });
    expect(prisma.company.update).toHaveBeenLastCalledWith({ where: { id: 'c1' }, data: { isVatPayer: false } });
    await service.updateProfile('u1', { name: ' Nou ' });
    expect(prisma.company.update).toHaveBeenLastCalledWith({ where: { id: 'c1' }, data: { name: 'Nou' } });
  });
});
