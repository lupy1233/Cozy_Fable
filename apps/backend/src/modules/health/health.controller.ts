import { createHash, timingSafeEqual } from 'node:crypto';
import { Controller, Get, Inject, Req, ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import { Public } from '../auth/decorators/public.decorator';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { releaseSha } from '../../infra/monitoring/release';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { clientIpOf, clientIpSourceOf, ipScope, type ClientIpSource } from '../../common/http/client-ip';

type CheckStatus = 'up' | 'down';
type Checks = { db: CheckStatus; redis: CheckStatus; storage: CheckStatus };

// E-admin-platform-8: o dependinta care atarna nu mai tine cererea deschisa
// (Caddy renunta la 5 s si ar scoate singurul upstream din rotatie).
export const CHECK_TIMEOUT_MS = 1500;

// Invarianta 3.11: health la /api/v1/health cu DB, Redis, MinIO.
// E-admin-platform-8: + /health/live (doar procesul) si /health/ready (tolerant la Redis/storage).
// E-admin-platform-56: corpul public e DOAR { status }; slot/mode/sha/checks/client se dau
// numai cu headerul X-Health-Token egal cu HEALTH_DETAILS_TOKEN (nesetat = niciodata).
// Railway, Caddy si monitorul de uptime citesc doar codul HTTP (si 'degraded' din /ready).
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  // Strict (invarianta 3.11 + gating deploy Railway/verify-slot/smoke):
  // 503 daca oricare dependinta e jos (filtrul de exceptii scoate `checks` din plic).
  // E-admin-platform-5: `client` = de unde vine IP-ul folosit la rate limit si ce tip de adresa
  // e (verify-slot cere 'public' in productie). NICIODATA IP-ul insusi. Doar cu token.
  @Get()
  async check(@Req() req?: Request) {
    const checks = await this.runChecks();
    const healthy = Object.values(checks).every((s) => s === 'up');
    if (!healthy) {
      throw new ServiceUnavailableException({ status: 'error', checks });
    }
    if (!this.detailsAllowed(req)) return { status: 'ok' as const };
    const tracked = req as (Request & { clientIp?: string | null; clientIpSource?: ClientIpSource }) | undefined;
    return {
      status: 'ok' as const,
      checks,
      release: this.release(),
      client: {
        source: tracked ? clientIpSourceOf(tracked) : 'socket',
        scope: ipScope(tracked ? clientIpOf(tracked) : null),
      },
      timestamp: new Date().toISOString(),
    };
  }

  // Rutarea gateway-ului; doar procesul (fara I/O), deci un Redis/MinIO picat nu scoate site-ul.
  @Get('live')
  live(@Req() req?: Request) {
    if (!this.detailsAllowed(req)) return { status: 'ok' as const };
    return { status: 'ok' as const, release: this.release(), timestamp: new Date().toISOString() };
  }

  // Monitor de uptime: 503 doar cand DB-ul e jos; Redis/storage jos → 200 "degraded".
  @Get('ready')
  async ready(@Req() req?: Request) {
    const checks = await this.runChecks();
    if (checks.db === 'down') {
      throw new ServiceUnavailableException({ status: 'error', checks });
    }
    const degraded = checks.redis === 'down' || checks.storage === 'down';
    const status = degraded ? ('degraded' as const) : ('ok' as const);
    if (!this.detailsAllowed(req)) return { status };
    return {
      status,
      checks,
      release: this.release(),
      timestamp: new Date().toISOString(),
    };
  }

  // Comparatie in timp constant pe digest-uri sha256 (lungime fixa, fara scurgere de lungime).
  private detailsAllowed(req?: Request): boolean {
    const token = this.config.get<string>('HEALTH_DETAILS_TOKEN');
    if (!token || !req) return false;
    const header = req.headers?.['x-health-token'];
    if (typeof header !== 'string' || header.length === 0) return false;
    const given = createHash('sha256').update(header).digest();
    const expected = createHash('sha256').update(token).digest();
    return timingSafeEqual(given, expected);
  }

  private async runChecks(): Promise<Checks> {
    const [db, redis, storage] = await Promise.all([
      this.checkWithTimeout(() => this.prisma.$queryRaw`SELECT 1`),
      this.checkWithTimeout(() => this.redis.ping()),
      this.checkWithTimeout((signal) => this.storage.healthCheck(signal)),
    ]);
    return { db, redis, storage };
  }

  private release() {
    return {
      slot: this.config.get<string>('DEPLOYMENT_SLOT', 'unassigned'),
      mode: this.config.get<string>('DEPLOYMENT_MODE', 'active'),
      sha: releaseSha(this.config),
    };
  }

  // Orice respingere sau depasire a timeout-ului → 'down'; timerul se curata mereu.
  private async checkWithTimeout(fn: (signal: AbortSignal) => Promise<unknown>): Promise<CheckStatus> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('health check timeout'));
      }, CHECK_TIMEOUT_MS);
    });
    try {
      await Promise.race([Promise.resolve().then(() => fn(controller.signal)), timeout]);
      return 'up';
    } catch {
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }
}
