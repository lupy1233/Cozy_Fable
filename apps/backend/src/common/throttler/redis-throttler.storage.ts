import { Logger, type OnApplicationShutdown } from '@nestjs/common';
import {
  ThrottlerStorageService,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type Redis from 'ioredis';
import { safeErrorSummary } from '../logging/safe-error';

// E-admin-platform-5: contorul throttlerului in Redis (partajat intre procese si sloturi
// blue/green). O singura comanda EVAL per request (Redis e ~150 ms cross-region pana la
// migrarea in EU). KEYS[1]=hits, KEYS[2]=block; ARGV = ttlMs, limit, blockMs.
// Evitam flag-uri Redis 7 (PEXPIRE NX): versiunea din productie nu e confirmata.
const THROTTLE_LUA = `
local b = redis.call('PTTL', KEYS[2])
if b > 0 then return {tonumber(ARGV[2]) + 1, 0, 1, b} end
local h = redis.call('INCR', KEYS[1])
local t = redis.call('PTTL', KEYS[1])
if t < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  t = tonumber(ARGV[1])
end
if h > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  redis.call('DEL', KEYS[1])
  return {h, t, 1, tonumber(ARGV[3])}
end
return {h, t, 0, 0}
`;

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

const COMMAND = 'cozyThrottle';
const WARN_INTERVAL_MS = 60_000;

type ThrottleReply = [number, number, number, number];
type RedisWithThrottle = Redis & {
  [COMMAND]?: (
    hitsKey: string,
    blockKey: string,
    ttlMs: number,
    limit: number,
    blockMs: number,
  ) => Promise<ThrottleReply>;
};

export class RedisThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private lastWarnAt = 0;

  constructor(
    private readonly redis: Redis,
    private readonly fallback: ThrottlerStorageService = new ThrottlerStorageService(),
    private readonly timeoutMs = 1000,
  ) {
    const client = redis as RedisWithThrottle;
    if (typeof client[COMMAND] !== 'function') {
      redis.defineCommand(COMMAND, { numberOfKeys: 2, lua: THROTTLE_LUA });
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    // cheia vine deja hash-uita (sha256) din guard: fara IP brut in Redis
    const client = this.redis as RedisWithThrottle;
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('throttler redis timeout')), this.timeoutMs);
      });
      const command = client[COMMAND];
      if (!command) throw new Error('throttler command not defined');
      const [hits, ttlMs, blocked, blockMs] = await Promise.race([
        command.call(
          client,
          `throttle:${throttlerName}:${key}`,
          `throttle-block:${throttlerName}:${key}`,
          ttl,
          limit,
          blockDuration,
        ),
        timeout,
      ]);
      return {
        totalHits: Number(hits),
        timeToExpire: Math.ceil(Number(ttlMs) / 1000),
        isBlocked: Number(blocked) === 1,
        timeToBlockExpire: Math.ceil(Number(blockMs) / 1000),
      };
    } catch (error) {
      // Redis lent/cazut: limitele raman aplicate per proces, cererea nu pica (fara 5xx)
      const now = Date.now();
      if (now - this.lastWarnAt >= WARN_INTERVAL_MS) {
        this.lastWarnAt = now;
        this.logger.warn(`throttler Redis indisponibil, fallback in memorie: ${safeErrorSummary(error)}`);
      }
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    } finally {
      clearTimeout(timer);
    }
  }

  onApplicationShutdown(): void {
    this.fallback.onApplicationShutdown();
  }
}
