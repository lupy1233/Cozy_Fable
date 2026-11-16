import 'reflect-metadata';
import { HttpStatus } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ERROR_CODES, MIN_COVERAGE_RADIUS_KM } from '@marketplace/shared';
import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyLocationDto } from './dto/company.dto';

// E-client-9 — locatiile firmei: raza minima, plafon de locatii, plafon de schimbari pe 24h.

/* eslint-disable @typescript-eslint/no-explicit-any */
function setup(
  opts: {
    locations?: number;
    recentChanges?: number;
    max?: number;
    perDay?: number;
    role?: string;
    existing?: Record<string, unknown> | null;
    // m7: schimbarile vazute dupa lock (alta cerere a scris intre timp)
    recentInTx?: number;
    redis?: any;
  } = {},
) {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: '' }]),
    auditLog: { count: jest.fn().mockResolvedValue(opts.recentInTx ?? opts.recentChanges ?? 0) },
    companyLocation: {
      count: jest.fn().mockResolvedValue(opts.locations ?? 1),
      create: jest.fn().mockResolvedValue({ id: 'loc-new' }),
      updateMany,
    },
  };
  const prisma: any = {
    companyMember: { findUnique: jest.fn().mockResolvedValue({ companyId: 'c1', userId: 'u1', role: opts.role ?? 'OWNER' }) },
    auditLog: { count: jest.fn().mockResolvedValue(opts.recentChanges ?? 0) },
    companyLocation: {
      // h1: updateLocation citeste intai locatia firmei proprii
      findFirst: jest.fn(async ({ where }: any) =>
        opts.existing === null || where.companyId !== 'c1'
          ? null
          : { id: where.id, companyId: 'c1', ...location, ...(opts.existing ?? {}) },
      ),
      // h1 (m7): modificarea se scrie acum in tranzactie, sub lock — acelasi mock
      updateMany,
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
  const geo: any = { geocode: jest.fn().mockResolvedValue({ lat: 44.43, lng: 26.1, displayName: null }) };
  const service = new CompaniesService(prisma, {} as any, {} as any, settings, geo, undefined, opts.redis);
  jest.spyOn(service, 'getMyCompany').mockResolvedValue({ id: 'c1' } as any);
  return { service, prisma, tx, settings, geo };
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

// h1 (etapa 11): "Modifica" pe locatie + coordonate fara scriere de mana.
describe('CompaniesService — modificarea locatiei si coordonatele (h1)', () => {
  const { lat: _lat, lng: _lng, ...withoutCoords } = location;

  it('fara coordonate la adaugare, serverul geocodeaza adresa (invarianta 3.8)', async () => {
    const { service, tx, geo } = setup();
    await service.addLocation('u1', withoutCoords as CompanyLocationDto);
    expect(geo.geocode).toHaveBeenCalledWith('Str. Exemplu 1', 'Cluj-Napoca', 'Cluj', 'RO');
    expect(tx.companyLocation.create.mock.calls[0][0].data).toMatchObject({ lat: 44.43, lng: 26.1 });
  });

  it('doar raza schimbata: pastreaza coordonatele salvate, fara geocodare', async () => {
    const { service, prisma, geo } = setup({ existing: { lat: 46.1, lng: 23.2 } });
    await service.updateLocation('u1', 'loc-1', { ...withoutCoords, coverageRadiusKm: 30 } as CompanyLocationDto);
    expect(geo.geocode).not.toHaveBeenCalled();
    expect(prisma.companyLocation.updateMany).toHaveBeenCalledWith({
      where: { id: 'loc-1', companyId: 'c1' },
      data: expect.objectContaining({ lat: 46.1, lng: 23.2, coverageRadiusKm: 30 }),
    });
  });

  it('adresa noua: geocodeaza din nou', async () => {
    const { service, prisma, geo } = setup({ existing: { addressText: 'Alta strada 9', lat: 46.1, lng: 23.2 } });
    await service.updateLocation('u1', 'loc-1', withoutCoords as CompanyLocationDto);
    expect(geo.geocode).toHaveBeenCalledTimes(1);
    expect(prisma.companyLocation.updateMany.mock.calls[0][0].data).toMatchObject({ lat: 44.43, lng: 26.1 });
  });

  it('adresa care nu se poate localiza → GEOCODING_FAILED, fara scriere', async () => {
    const { service, prisma, geo } = setup({ existing: { addressText: 'Alta strada 9' } });
    const failure = Object.assign(new Error('x'), { getResponse: () => ({ code: ERROR_CODES.GEOCODING_FAILED }) });
    geo.geocode.mockRejectedValue(failure);
    const err: any = await service.updateLocation('u1', 'loc-1', withoutCoords as CompanyLocationDto).catch((e) => e);
    expect(err.getResponse().code).toBe(ERROR_CODES.GEOCODING_FAILED);
    expect(prisma.companyLocation.updateMany).not.toHaveBeenCalled();
  });

  it('locatia altei firme → 404, fara scriere', async () => {
    const { service, prisma } = setup({ existing: null });
    const err: any = await service.updateLocation('u1', 'loc-x', location as CompanyLocationDto).catch((e) => e);
    expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(prisma.companyLocation.updateMany).not.toHaveBeenCalled();
  });

  it.each(['EMPLOYEE_TRUSTED', 'EMPLOYEE_MANAGED'])('%s nu poate modifica locatia (403)', async (role) => {
    const { service, prisma } = setup({ role });
    const err: any = await service.updateLocation('u1', 'loc-1', location as CompanyLocationDto).catch((e) => e);
    expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(prisma.companyLocation.findFirst).not.toHaveBeenCalled();
    expect(prisma.companyLocation.updateMany).not.toHaveBeenCalled();
  });

  it('plafonul de schimbari se verifica inainte de citire / geocodare', async () => {
    const { service, prisma, geo } = setup({ recentChanges: 5, perDay: 5 });
    const err: any = await service.updateLocation('u1', 'loc-1', withoutCoords as CompanyLocationDto).catch((e) => e);
    expect(err.getResponse().code).toBe(ERROR_CODES.COMPANY_LOCATION_CHANGE_LIMIT);
    expect(prisma.companyLocation.findFirst).not.toHaveBeenCalled();
    expect(geo.geocode).not.toHaveBeenCalled();
  });
});

// Redis simulat: GET + MULTI(SET NX, INCR) ca in contorul de geocodari esuate
function fakeRedis(initial = 0) {
  const store = new Map<string, number>();
  if (initial) store.set('company-geo-fail:c1', initial);
  return {
    store,
    get: jest.fn(async (k: string) => (store.has(k) ? String(store.get(k)) : null)),
    multi: jest.fn(() => {
      const ops: Array<() => void> = [];
      const chain: any = {
        set: (k: string) => {
          ops.push(() => {
            if (!store.has(k)) store.set(k, 0);
          });
          return chain;
        },
        incr: (k: string) => {
          ops.push(() => store.set(k, (store.get(k) ?? 0) + 1));
          return chain;
        },
        exec: async () => {
          ops.forEach((o) => o());
          return [];
        },
      };
      return chain;
    }),
  };
}

const geocodingFailed = () =>
  Object.assign(new Error('x'), { getResponse: () => ({ code: ERROR_CODES.GEOCODING_FAILED }) });

describe('CompaniesService — limitele geocodarii la locatii (h1, revizuire M1 / m6 / m7)', () => {
  const { lat: _lat, lng: _lng, ...withoutCoords } = location;

  it('fiecare GEOCODING_FAILED se numara pe firma', async () => {
    const redis = fakeRedis();
    const { service, geo } = setup({ redis });
    geo.geocode.mockRejectedValue(geocodingFailed());
    await service.addLocation('u1', withoutCoords as CompanyLocationDto).catch(() => undefined);
    await service.addLocation('u1', withoutCoords as CompanyLocationDto).catch(() => undefined);
    expect(redis.store.get('company-geo-fail:c1')).toBe(2);
  });

  it('dupa 10 esecuri, a 11-a cerere e refuzata cu codul de limita, fara apel la serviciul extern', async () => {
    const redis = fakeRedis();
    const { service, geo } = setup({ redis, perDay: 1000 });
    geo.geocode.mockRejectedValue(geocodingFailed());
    for (let i = 0; i < 10; i += 1) {
      const err: any = await service.addLocation('u1', withoutCoords as CompanyLocationDto).catch((e) => e);
      expect(err.getResponse().code).toBe(ERROR_CODES.GEOCODING_FAILED);
    }
    expect(geo.geocode).toHaveBeenCalledTimes(10);
    const err: any = await service.addLocation('u1', withoutCoords as CompanyLocationDto).catch((e) => e);
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(err.getResponse().code).toBe(ERROR_CODES.COMPANY_LOCATION_CHANGE_LIMIT);
    expect(geo.geocode).toHaveBeenCalledTimes(10);
  });

  it('la plafon, modificarea fara schimbare de adresa (fara geocodare) trece in continuare', async () => {
    const { service, geo, prisma } = setup({ redis: fakeRedis(10), existing: { lat: 46.1, lng: 23.2 } });
    await service.updateLocation('u1', 'loc-1', { ...withoutCoords, coverageRadiusKm: 30 } as CompanyLocationDto);
    expect(geo.geocode).not.toHaveBeenCalled();
    expect(prisma.companyLocation.updateMany).toHaveBeenCalledTimes(1);
  });

  it('o adresa gasita nu se numara; alte erori (ex. retea) nu consuma plafonul', async () => {
    const redis = fakeRedis();
    const { service, geo } = setup({ redis });
    await service.addLocation('u1', withoutCoords as CompanyLocationDto);
    geo.geocode.mockRejectedValue(new Error('boom'));
    await service.addLocation('u1', withoutCoords as CompanyLocationDto).catch(() => undefined);
    expect(redis.store.has('company-geo-fail:c1')).toBe(false);
  });

  it('Redis cazut → fail open (geocodarea merge)', async () => {
    const redis = { get: jest.fn().mockRejectedValue(new Error('down')), multi: jest.fn() };
    const { service, geo } = setup({ redis });
    await service.addLocation('u1', withoutCoords as CompanyLocationDto);
    expect(geo.geocode).toHaveBeenCalledTimes(1);
  });

  it('m7: modificarea se scrie sub lock-ul pe firma, iar plafonul se reverifica dupa lock', async () => {
    const { service, tx, prisma } = setup({ existing: { addressText: 'Alta strada 9' } });
    await service.updateLocation('u1', 'loc-1', withoutCoords as CompanyLocationDto);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.count).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.auditLog.count.mock.invocationCallOrder[0]);
    expect(tx.auditLog.count.mock.invocationCallOrder[0]).toBeLessThan(prisma.companyLocation.updateMany.mock.invocationCallOrder[0]);
  });

  it('m7: schimbarile facute de alta cerere in timpul geocodarii → refuz dupa lock, fara scriere', async () => {
    const { service, prisma, geo } = setup({ recentChanges: 0, recentInTx: 20, existing: { addressText: 'Alta strada 9' } });
    const err: any = await service.updateLocation('u1', 'loc-1', withoutCoords as CompanyLocationDto).catch((e) => e);
    expect(err.getResponse().code).toBe(ERROR_CODES.COMPANY_LOCATION_CHANGE_LIMIT);
    expect(geo.geocode.mock.invocationCallOrder[0]).toBeLessThan(prisma.$transaction.mock.invocationCallOrder[0]);
    expect(prisma.companyLocation.updateMany).not.toHaveBeenCalled();
  });

  it('m7: la adaugare, plafonul se reverifica sub lock', async () => {
    const { service, tx } = setup({ recentInTx: 20 });
    const err: any = await service.addLocation('u1', withoutCoords as CompanyLocationDto).catch((e) => e);
    expect(err.getResponse().code).toBe(ERROR_CODES.COMPANY_LOCATION_CHANGE_LIMIT);
    expect(tx.companyLocation.create).not.toHaveBeenCalled();
  });

  it('m6: doar orasul gasit → raspunsul are geocodePrecision CITY; adresa exacta → fara camp', async () => {
    const { service, geo } = setup();
    geo.geocode.mockResolvedValueOnce({ lat: 1, lng: 2, displayName: null, precision: 'CITY' });
    await expect(service.addLocation('u1', withoutCoords as CompanyLocationDto)).resolves.toEqual({ id: 'c1', geocodePrecision: 'CITY' });
    geo.geocode.mockResolvedValueOnce({ lat: 1, lng: 2, displayName: null, precision: 'ADDRESS' });
    await expect(service.addLocation('u1', withoutCoords as CompanyLocationDto)).resolves.toEqual({ id: 'c1' });
  });
});

describe('CompaniesController — limite de frecventa (h1, revizuire M1 / M2)', () => {
  it.each([
    ['addLocation', 10],
    ['updateLocation', 10],
    ['presignPortfolioImage', 30],
    ['confirmPortfolioImage', 30],
    ['setPortfolioImage', 30],
  ])('%s: %i / minut', (name, limit) => {
    const handler = (CompaniesController.prototype as any)[name];
    expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler)).toBe(limit);
    expect(Reflect.getMetadata(`${THROTTLER_TTL}default`, handler)).toBe(60_000);
  });
});

describe('CompanyLocationDto — coordonate optionale (h1)', () => {
  it.each([
    [{}, true],
    [{ lat: 46.77, lng: 23.59 }, true],
    [{ lat: 46.77 }, false],
    [{ lng: 23.59 }, false],
    [{ lat: 120, lng: 23.59 }, false],
  ])('%o valid=%p', async (coords, ok) => {
    const { lat: _a, lng: _b, ...rest } = location;
    const dto = plainToInstance(CompanyLocationDto, { ...rest, ...coords });
    const errors = await validate(dto);
    expect(errors.length === 0).toBe(ok);
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
