import 'reflect-metadata';
import { HttpStatus } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ERROR_CODES, MIN_COVERAGE_RADIUS_KM } from '@marketplace/shared';
import { CompaniesService } from './companies.service';
import { CompanyLocationDto } from './dto/company.dto';

// E-client-9 — locatiile firmei: raza minima, plafon de locatii, plafon de schimbari pe 24h.

/* eslint-disable @typescript-eslint/no-explicit-any */
function setup(opts: { locations?: number; recentChanges?: number; max?: number; perDay?: number } = {}) {
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: '' }]),
    companyLocation: {
      count: jest.fn().mockResolvedValue(opts.locations ?? 1),
      create: jest.fn().mockResolvedValue({ id: 'loc-new' }),
    },
  };
  const prisma: any = {
    companyMember: { findUnique: jest.fn().mockResolvedValue({ companyId: 'c1', userId: 'u1', role: 'OWNER' }) },
    auditLog: { count: jest.fn().mockResolvedValue(opts.recentChanges ?? 0) },
    companyLocation: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(async (fn: (t: any) => unknown) => fn(tx)),
  };
  const settings: any = {
    getInt: jest.fn(async (key: string, fallback: number) => {
      if (key === 'company_locations_max') return opts.max ?? fallback;
      if (key === 'company_location_changes_per_day') return opts.perDay ?? fallback;
      return fallback;
    }),
  };
  const service = new CompaniesService(prisma, {} as any, {} as any, settings);
  jest.spyOn(service, 'getMyCompany').mockResolvedValue({ id: 'c1' } as any);
  return { service, prisma, tx, settings };
}

const location = {
  addressText: 'Str. Exemplu 1',
  county: 'Cluj',
  city: 'Cluj-Napoca',
  lat: 46.77,
  lng: 23.59,
  coverageRadiusKm: 50,
};

describe('CompaniesService — locatii (E-client-9)', () => {
  it('adauga locatia sub lock cand plafonul nu e atins', async () => {
    const { service, tx } = setup({ locations: 2, max: 10 });
    await expect(service.addLocation('u1', location as CompanyLocationDto)).resolves.toEqual({ id: 'c1' });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.companyLocation.count).toHaveBeenCalledWith({ where: { companyId: 'c1' } });
    expect(tx.companyLocation.create).toHaveBeenCalledTimes(1);
  });

  it('refuza cu 409 COMPANY_LOCATION_LIMIT_REACHED la plafon, fara scriere', async () => {
    const { service, tx } = setup({ locations: 3, max: 3 });
    const err: any = await service.addLocation('u1', location as CompanyLocationDto).catch((e) => e);
    expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(err.getResponse().code).toBe(ERROR_CODES.COMPANY_LOCATION_LIMIT_REACHED);
    expect(tx.companyLocation.create).not.toHaveBeenCalled();
  });

  it('refuza cu 429 COMPANY_LOCATION_CHANGE_LIMIT cand s-a atins plafonul pe 24h (numarat din audit)', async () => {
    const { service, prisma, tx } = setup({ recentChanges: 20 });
    const err: any = await service.addLocation('u1', location as CompanyLocationDto).catch((e) => e);
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(err.getResponse().code).toBe(ERROR_CODES.COMPANY_LOCATION_CHANGE_LIMIT);
    const where = prisma.auditLog.count.mock.calls[0][0].where;
    expect(where.entityType).toBe('company_location');
    expect(where.entityId).toBe('c1');
    expect(Date.now() - where.createdAt.gte.getTime()).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
    expect(tx.companyLocation.create).not.toHaveBeenCalled();
  });

  it('editarea si stergerea sunt numarate de acelasi plafon', async () => {
    const { service, prisma } = setup({ recentChanges: 1, perDay: 1 });
    const upd: any = await service.updateLocation('u1', 'loc-1', location as CompanyLocationDto).catch((e) => e);
    expect(upd.getResponse().code).toBe(ERROR_CODES.COMPANY_LOCATION_CHANGE_LIMIT);
    const del: any = await service.deleteLocation('u1', 'loc-1').catch((e) => e);
    expect(del.getResponse().code).toBe(ERROR_CODES.COMPANY_LOCATION_CHANGE_LIMIT);
    expect(prisma.companyLocation.updateMany).not.toHaveBeenCalled();
    expect(prisma.companyLocation.deleteMany).not.toHaveBeenCalled();
  });

  it('sub plafon, stergerea trece', async () => {
    const { service, prisma } = setup({ recentChanges: 0, perDay: 1 });
    await expect(service.deleteLocation('u1', 'loc-1')).resolves.toEqual({ id: 'c1' });
    expect(prisma.companyLocation.deleteMany).toHaveBeenCalledWith({ where: { id: 'loc-1', companyId: 'c1' } });
  });
});

describe('CompanyLocationDto — raza minima', () => {
  it.each([
    [1, false],
    [0.1, false],
    [MIN_COVERAGE_RADIUS_KM, true],
    [50, true],
  ])('coverageRadiusKm=%p valid=%p', async (radius, ok) => {
    const dto = plainToInstance(CompanyLocationDto, { ...location, coverageRadiusKm: radius });
    const errors = await validate(dto);
    expect(errors.length === 0).toBe(ok);
  });
});
