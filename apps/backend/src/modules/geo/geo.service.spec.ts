import { HttpException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GeoService } from './geo.service';

jest.setTimeout(10_000);

// E-admin-platform-8: esecul geocodarii nu are voie sa scrie adresa clientului in loguri.
describe('GeoService failure logging', () => {
  const originalFetch = global.fetch;
  let warn: jest.SpyInstance;

  function service() {
    const prisma = {
      geocodingCache: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
    };
    const values: Record<string, string> = {
      NOMINATIM_BASE_URL: 'https://nominatim.example.invalid',
      NOMINATIM_USER_AGENT: 'test-agent/1.0 (contact: ops@example.invalid)',
    };
    const config = { getOrThrow: (key: string) => values[key] } as unknown as ConfigService;
    return new GeoService(prisma as never, config);
  }

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warn.mockRestore();
    global.fetch = originalFetch;
  });

  function expectCleanWarnings(marker: string) {
    expect(warn).toHaveBeenCalled();
    for (const [line] of warn.mock.calls) {
      const text = String(line);
      for (const secret of ['Secreta', 'Orasxyz', 'Testjud', '@']) expect(text).not.toContain(secret);
      expect(text).toContain(marker);
      expect(text).toMatch(/tier=\d\/\d country=ro/);
    }
  }

  it('fails with 502 after every tier returns nothing, logging only tier and code', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] }) as never;
    const error = await service()
      .geocode('Str. Secreta 12, bl. A3', 'Orasxyz', 'Judetul Testjud')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(502);
    expectCleanWarnings('code=ENORESULT');
  });

  it('logs the upstream HTTP status without the query', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429, json: async () => [] }) as never;
    await expect(
      service().geocode('Str. Secreta 12, bl. A3', 'Orasxyz', 'Judetul Testjud'),
    ).rejects.toBeInstanceOf(HttpException);
    expectCleanWarnings('status=429');
  });
});
