import type { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

const TOKEN = 't'.repeat(40);
// Cerere cu tokenul corect (detaliile health sunt ascunse fara el, E-admin-platform-56)
const authed = (extra: Record<string, unknown> = {}) =>
  ({ headers: { 'x-health-token': TOKEN }, ...extra }) as never;

function setup(
  overrides: { queryRaw?: jest.Mock; ping?: jest.Mock; healthCheck?: jest.Mock; token?: string | null } = {},
) {
  const prisma = { $queryRaw: overrides.queryRaw ?? jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
  const storage = { healthCheck: overrides.healthCheck ?? jest.fn().mockResolvedValue(undefined) };
  const redis = { ping: overrides.ping ?? jest.fn().mockResolvedValue('PONG') };
  const values: Record<string, string> = {
    DEPLOYMENT_SLOT: 'green',
    DEPLOYMENT_MODE: 'standby',
    RELEASE_SHA: '0123456789abcdef0123456789abcdef01234567',
  };
  if (overrides.token !== null) values.HEALTH_DETAILS_TOKEN = overrides.token ?? TOKEN;
  const config = { get: (key: string, fallback?: string) => values[key] ?? fallback };
  const controller = new HealthController(
    prisma as never,
    storage as never,
    redis as never,
    config as ConfigService,
  );
  return { controller, prisma, storage, redis, values };
}

const hang = () => new Promise(() => undefined);

describe('HealthController release identity', () => {
  it('reports the deployment slot, mode and immutable release SHA', async () => {
    const { controller, values } = setup();
    await expect(controller.check(authed({ ip: '127.0.0.1' }))).resolves.toMatchObject({
      status: 'ok',
      checks: { db: 'up', redis: 'up', storage: 'up' },
      release: { slot: 'green', mode: 'standby', sha: values.RELEASE_SHA },
    });
  });
});

describe('HealthController live/ready split (E-admin-platform-8)', () => {
  afterEach(() => jest.useRealTimers());

  it('live() does no I/O and returns ok + release', () => {
    const { controller, prisma, storage, redis, values } = setup();
    expect(controller.live(authed())).toMatchObject({
      status: 'ok',
      release: { slot: 'green', mode: 'standby', sha: values.RELEASE_SHA },
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(redis.ping).not.toHaveBeenCalled();
    expect(storage.healthCheck).not.toHaveBeenCalled();
  });

  it('ready() is degraded when Redis hangs past the timeout', async () => {
    jest.useFakeTimers();
    const { controller } = setup({ ping: jest.fn().mockImplementation(hang) });
    const result = controller.ready(authed());
    await jest.advanceTimersByTimeAsync(1500);
    await expect(result).resolves.toMatchObject({
      status: 'degraded',
      checks: { db: 'up', redis: 'down', storage: 'up' },
    });
  });

  it('ready() is degraded when storage rejects', async () => {
    const { controller } = setup({ healthCheck: jest.fn().mockRejectedValue(new Error('down')) });
    await expect(controller.ready(authed())).resolves.toMatchObject({
      status: 'degraded',
      checks: { db: 'up', redis: 'up', storage: 'down' },
    });
  });

  it('ready() returns 503 when the DB is down', async () => {
    const { controller } = setup({ queryRaw: jest.fn().mockRejectedValue(new Error('db')) });
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('check() stays strict and fails after 1500 ms when storage hangs', async () => {
    jest.useFakeTimers();
    const { controller } = setup({ healthCheck: jest.fn().mockImplementation(hang) });
    const assertion = expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
    await jest.advanceTimersByTimeAsync(1500);
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('aborts the signal passed to storage.healthCheck after the timeout', async () => {
    jest.useFakeTimers();
    let received: AbortSignal | undefined;
    const healthCheck = jest.fn().mockImplementation((signal: AbortSignal) => {
      received = signal;
      return hang();
    });
    const { controller } = setup({ healthCheck });
    const result = controller.ready();
    await Promise.resolve();
    expect(received?.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1500);
    await result;
    expect(received?.aborted).toBe(true);
  });
});

describe('HealthController client IP diagnostic (E-admin-platform-5)', () => {
  it('check() with the token but no client info still resolves with scope unknown', async () => {
    const { controller } = setup();
    await expect(controller.check(authed({ ip: undefined }))).resolves.toMatchObject({
      client: { source: 'socket', scope: 'unknown' },
    });
  });

  it('reports source and scope but never the IP value', async () => {
    const { controller } = setup();
    const viaHeader = (await controller.check(
      authed({ ip: '127.0.0.1', clientIp: '198.51.100.7', clientIpSource: 'header' }),
    )) as { client?: unknown };
    expect(viaHeader.client).toEqual({ source: 'header', scope: 'public' });
    const viaProxy = (await controller.check(authed({ ip: '100.64.0.3' }))) as { client?: unknown };
    expect(viaProxy.client).toEqual({ source: 'socket', scope: 'private' });
    expect(JSON.stringify([viaHeader, viaProxy])).not.toMatch(/198\.51\.100\.7|100\.64\.0\.3/);
  });
});

describe('HealthController public body is status only (E-admin-platform-56)', () => {
  it('without a configured token returns exactly {status} on every route', async () => {
    const { controller, values } = setup({ token: null });
    const req = { headers: { 'x-health-token': TOKEN }, ip: '127.0.0.1' } as never;
    const bodies = [await controller.check(req), controller.live(req), await controller.ready(req)];
    for (const body of bodies) expect(body).toEqual({ status: 'ok' });
    expect(JSON.stringify(bodies)).not.toContain(values.RELEASE_SHA);
  });

  it('without a request (no header) returns the minimal body', async () => {
    const { controller } = setup();
    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
    expect(controller.live()).toEqual({ status: 'ok' });
  });

  it('with a wrong header returns the minimal body', async () => {
    const { controller } = setup();
    const req = { headers: { 'x-health-token': 'w'.repeat(40) }, ip: '127.0.0.1' } as never;
    await expect(controller.check(req)).resolves.toEqual({ status: 'ok' });
    expect(controller.live(req)).toEqual({ status: 'ok' });
    await expect(controller.ready(req)).resolves.toEqual({ status: 'ok' });
  });

  it('with the right header returns the full body with release.sha', async () => {
    const { controller, values } = setup();
    const body = await controller.check(authed({ ip: '127.0.0.1' }));
    expect(body).toMatchObject({
      status: 'ok',
      checks: { db: 'up', redis: 'up', storage: 'up' },
      release: { sha: values.RELEASE_SHA },
      client: { source: 'socket', scope: 'loopback' },
    });
  });

  it('treats a repeated header (array) as missing', async () => {
    const { controller } = setup();
    const req = { headers: { 'x-health-token': [TOKEN, TOKEN] }, ip: '127.0.0.1' } as never;
    await expect(controller.check(req)).resolves.toEqual({ status: 'ok' });
    expect(controller.live(req)).toEqual({ status: 'ok' });
  });

  it('ready() degraded stays minimal without the token', async () => {
    const { controller } = setup({ healthCheck: jest.fn().mockRejectedValue(new Error('down')) });
    await expect(controller.ready({ headers: {} } as never)).resolves.toEqual({ status: 'degraded' });
  });
});
