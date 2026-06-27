import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import { Public } from '../auth/decorators/public.decorator';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';

type CheckStatus = 'up' | 'down';

// Invarianta 3.11: health la /api/v1/health cu DB, Redis, MinIO.
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async check() {
    const [db, redis, storage] = await Promise.all([
      this.checkSafe(() => this.prisma.$queryRaw`SELECT 1`),
      this.checkSafe(() => this.redis.ping()),
      this.checkSafe(() => this.storage.healthCheck()),
    ]);

    const checks: Record<string, CheckStatus> = { db, redis, storage };
    const healthy = Object.values(checks).every((s) => s === 'up');
    if (!healthy) {
      throw new ServiceUnavailableException({ status: 'error', checks });
    }
    return { status: 'ok', checks, timestamp: new Date().toISOString() };
  }

  private async checkSafe(fn: () => Promise<unknown>): Promise<CheckStatus> {
    try {
      await fn();
      return 'up';
    } catch {
      return 'down';
    }
  }
}
