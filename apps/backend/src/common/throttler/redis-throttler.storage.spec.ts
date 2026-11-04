import { ThrottlerStorageService } from '@nestjs/throttler';
import Redis from 'ioredis';
import { RedisThrottlerStorage } from './redis-throttler.storage';

function fakeRedis(impl: jest.Mock) {
  const client: Record<string, unknown> = {};
  client.defineCommand = jest.fn((name: string) => {
    client[name] = impl;
  });
  return client;
}

describe('RedisThrottlerStorage (E-admin-platform-5)', () => {
  afterEach(() => jest.useRealTimers());

  it('defines the Lua command once per client and maps the reply', async () => {
    const command = jest.fn().mockResolvedValue([3, 59_500, 0, 0]);
    const redis = fakeRedis(command);
    const storage = new RedisThrottlerStorage(redis as never);
    new RedisThrottlerStorage(redis as never);
    expect(redis.defineCommand).toHaveBeenCalledTimes(1);

    await expect(storage.increment('abc', 60_000, 100, 60_000, 'default')).resolves.toEqual({
      totalHits: 3,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    expect(command).toHaveBeenCalledWith('throttle:default:abc', 'throttle-block:default:abc', 60_000, 100, 60_000);
  });

  it('maps a blocked reply', async () => {
    const redis = fakeRedis(jest.fn().mockResolvedValue([101, 0, 1, 42_100]));
    const storage = new RedisThrottlerStorage(redis as never);
    await expect(storage.increment('abc', 60_000, 100, 60_000, 'default')).resolves.toMatchObject({
      isBlocked: true,
      timeToBlockExpire: 43,
    });
  });

  it('falls back to memory when Redis rejects, without failing the request', async () => {
    const redis = fakeRedis(jest.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const fallback = new ThrottlerStorageService();
    const spy = jest.spyOn(fallback, 'increment');
    const storage = new RedisThrottlerStorage(redis as never, fallback);
    const record = await storage.increment('abc', 60_000, 100, 60_000, 'default');
    expect(record.totalHits).toBe(1);
    expect(record.isBlocked).toBe(false);
    expect(spy).toHaveBeenCalledWith('abc', 60_000, 100, 60_000, 'default');
    storage.onApplicationShutdown();
  });

  it('falls back to memory when Redis hangs past the timeout', async () => {
    jest.useFakeTimers();
    const redis = fakeRedis(jest.fn().mockImplementation(() => new Promise(() => undefined)));
    const fallback = { increment: jest.fn().mockResolvedValue({ totalHits: 1, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 }), onApplicationShutdown: jest.fn() };
    const storage = new RedisThrottlerStorage(redis as never, fallback as never, 1000);
    const result = storage.increment('abc', 60_000, 100, 60_000, 'default');
    await jest.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toMatchObject({ totalHits: 1 });
    expect(fallback.increment).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});

// Integrare pe Redis real: ruleaza doar cu TEST_REDIS_HOST (ex. 127.0.0.1 din dev-infra;
// pe Windows "localhost" poate rezolva ::1 si conexiunea atarna).
const redisHost = process.env.TEST_REDIS_HOST;
(redisHost ? describe : describe.skip)('RedisThrottlerStorage on a real Redis', () => {
  let a: Redis;
  let b: Redis;
  const key = `spec-${Date.now()}`;

  beforeAll(() => {
    const port = Number(process.env.TEST_REDIS_PORT ?? 6379);
    a = new Redis({ host: redisHost, port, lazyConnect: false });
    b = new Redis({ host: redisHost, port, lazyConnect: false });
  });

  afterAll(async () => {
    await a.del(`throttle:spec:${key}`, `throttle-block:spec:${key}`);
    await Promise.all([a.quit(), b.quit()]);
  });

  it('blocks after the limit and shares the count between instances', async () => {
    const first = new RedisThrottlerStorage(a);
    const second = new RedisThrottlerStorage(b);
    let last = await first.increment(key, 60_000, 100, 60_000, 'spec');
    for (let i = 1; i < 100; i += 1) {
      last = await (i % 2 ? second : first).increment(key, 60_000, 100, 60_000, 'spec');
    }
    expect(last).toMatchObject({ totalHits: 100, isBlocked: false });
    const over = await second.increment(key, 60_000, 100, 60_000, 'spec');
    expect(over.isBlocked).toBe(true);
    expect(over.timeToBlockExpire).toBeGreaterThan(0);
  });
});
