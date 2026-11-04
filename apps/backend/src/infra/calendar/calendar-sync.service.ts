import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { safeErrorSummary } from '../../common/logging/safe-error';
import { BusinessCalendarService } from './business-calendar.service';

// E-admin-platform-25: cache-ul de sarbatori traieste in fiecare proces (sloturile blue/green).
// O modificare din admin reincarca cache-ul local imediat si anunta celelalte procese prin
// Redis pub/sub; reincarcarea periodica e plasa de siguranta daca un mesaj se pierde.
export const CALENDAR_CHANNEL = 'calendar:holidays:changed';
const RELOAD_MS = 10 * 60_000;

@Injectable()
export class CalendarSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CalendarSyncService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private sub: Redis | undefined;
  private subErrorLogged = false;

  constructor(
    private readonly calendar: BusinessCalendarService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  onModuleInit(): void {
    // ambele sloturi blue/green: doar reincarcare cache (citire) - permis si pe standby
    this.timer = setInterval(() => void this.reload('interval'), RELOAD_MS);
    this.timer.unref?.();
    try {
      const sub = this.redis.duplicate();
      this.sub = sub;
      sub.on('error', (e: unknown) => {
        // un singur warn per episod de eroare (ioredis reincearca singur si re-aboneaza)
        if (this.subErrorLogged) return;
        this.subErrorLogged = true;
        this.logger.warn(`calendar subscriber error: ${safeErrorSummary(e)}`);
      });
      sub.on('ready', () => {
        this.subErrorLogged = false;
      });
      sub.on('message', (channel: string) => {
        if (channel === CALENDAR_CHANNEL) void this.reload('pubsub');
      });
      // nu asteptam abonarea: bootul nu se blocheaza cand Redis e jos
      void sub.subscribe(CALENDAR_CHANNEL).catch((e: unknown) => this.logger.warn(`calendar subscribe failed: ${safeErrorSummary(e)}`));
    } catch (e) {
      this.logger.warn(`calendar subscriber init failed: ${safeErrorSummary(e)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.sub?.quit().catch(() => undefined);
    this.sub = undefined;
  }

  // apelat de admin dupa orice modificare: cache local imediat + celelalte procese prin Redis
  async notifyChanged(): Promise<void> {
    await this.reload('admin');
    await this.redis
      .publish(CALENDAR_CHANNEL, String(Date.now()))
      .catch((e: unknown) => this.logger.warn(`calendar publish failed: ${safeErrorSummary(e)}`));
  }

  private async reload(source: string): Promise<void> {
    await this.calendar.refresh().catch((e: unknown) => this.logger.warn(`calendar reload (${source}) failed: ${safeErrorSummary(e)}`));
  }
}
