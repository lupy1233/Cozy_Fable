import { HttpException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GeoService } from './geo.service';

// h1 (etapa 11, revizuire M1 / m6): cache negativ scurt + treapta la care s-a gasit adresa.
// Pauza de 1,1 s intre trepte e reala → testele cu toate treptele dureaza ~2-3 s.
jest.setTimeout(20_000);

function service() {
  const prisma = {
    geocodingCache: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
  };
  const values: Record<string, string> = {
    NOMINATIM_BASE_URL: 'https://nominatim.example.invalid',
    NOMINATIM_USER_AGENT: 'test-agent/1.0',
  };
  const config = { getOrThrow: (key: string) => values[key] } as unknown as ConfigService;
  return new GeoService(prisma as never, config);
}

const hit = { ok: true, json: async () => [{ lat: '44.43', lon: '26.10', display_name: 'X' }] };
const none = { ok: true, json: async () => [] };

describe('GeoService — cache negativ (h1, M1)', () => {
  const originalFetch = global.fetch;
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warn.mockRestore();
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('adresa negasita la toate treptele: a doua cerere identica nu mai pleaca spre serviciul extern', async () => {
    const fetch = jest.fn().mockResolvedValue(none);
    global.fetch = fetch as never;
    const geo = service();
    await expect(geo.geocode('Str. Inventata 1', 'Orasxyz', 'Jud')).rejects.toBeInstanceOf(HttpException);
    const calls = fetch.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    const err = await geo.geocode('  str. inventata 1 ', 'ORASXYZ', 'jud').catch((e: unknown) => e);
    expect((err as HttpException).getStatus()).toBe(502);
    expect((err as HttpException).getResponse()).toMatchObject({ code: 'GEOCODING_FAILED' });
    expect(fetch.mock.calls.length).toBe(calls);
  });

  it('dupa 10 minute adresa se incearca din nou', async () => {
    const fetch = jest.fn().mockResolvedValue(none);
    global.fetch = fetch as never;
    const geo = service();
    const t0 = Date.now();
    await geo.geocode('Str. Inventata 2', 'Orasxyz', 'Jud').catch(() => undefined);
    const calls = fetch.mock.calls.length;
    // + pauzele reale dintre trepte (~2 s) → 11 minute dupa inceput
    jest.spyOn(Date, 'now').mockReturnValue(t0 + 11 * 60 * 1000);
    fetch.mockResolvedValue(hit);
    await expect(geo.geocode('Str. Inventata 2', 'Orasxyz', 'Jud')).resolves.toMatchObject({ lat: 44.43 });
    expect(fetch.mock.calls.length).toBe(calls + 1);
  });

  it('o pana a serviciului (HTTP 429 / retea) NU se tine minte', async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: false, status: 429, json: async () => [] });
    global.fetch = fetch as never;
    const geo = service();
    await geo.geocode('Str. Reala 3', 'Cluj-Napoca', 'Cluj').catch(() => undefined);
    fetch.mockResolvedValue(hit);
    await expect(geo.geocode('Str. Reala 3', 'Cluj-Napoca', 'Cluj')).resolves.toMatchObject({ lat: 44.43 });
  });
});

describe('GeoService — treapta gasita (h1, m6)', () => {
  const originalFetch = global.fetch;
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warn.mockRestore();
    global.fetch = originalFetch;
  });

  it('adresa gasita la prima treapta → ADDRESS', async () => {
    global.fetch = jest.fn().mockResolvedValue(hit) as never;
    await expect(service().geocode('Str. Reala 3', 'Cluj-Napoca', 'Cluj')).resolves.toMatchObject({ precision: 'ADDRESS' });
  });

  it('doar orasul gasit → CITY (centrul localitatii)', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(none).mockResolvedValue(hit) as never;
    await expect(service().geocode('Str. Inventata 9', 'Cluj-Napoca', 'Cluj')).resolves.toMatchObject({ precision: 'CITY' });
  });
});
