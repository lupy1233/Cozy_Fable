import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@marketplace/shared';
import type { User } from '@prisma/client';
import { createHash } from 'crypto';
import type Redis from 'ioredis';
import { safeErrorSummary } from '../../common/logging/safe-error';
import { MailService } from '../../infra/mail/mail.service';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import { AuditService } from '../audit/audit.service';
import { authEmailHtml } from './auth-email';
import {
  LOGIN_COOLDOWN_SEC,
  LOGIN_FAILURE_WINDOW_SEC,
  LOGIN_MAX_FAILURES,
  LOGIN_MAX_FAILURES_ADMIN,
} from './auth.constants';

type LockoutUser = Pick<User, 'id' | 'role' | 'email' | 'name' | 'languagePreference' | 'deletedAt'>;

export interface LoginAttemptContext {
  ip?: string | null;
  userAgent?: string | null;
}

// E-admin-platform-5: blocare temporara per email dupa parole gresite (SEC1-21).
// - cheile Redis contin DOAR sha256(email normalizat), niciodata emailul brut;
// - raspunsul LOGIN_COOLDOWN (429) e identic pentru conturi existente si inexistente si
//   se da si cu parola corecta cat tine pauza (altfel blocarea n-ar opri ghicitul);
// - Redis cazut = fail open (limita per IP a throttlerului ramane activa).
@Injectable()
export class LoginLockoutService {
  private readonly logger = new Logger(LoginLockoutService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private keys(email: string): { failKey: string; lockKey: string } {
    const hash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
    return { failKey: `login-fail:${hash}`, lockKey: `login-lock:${hash}` };
  }

  private cooldown(retryAfterSec: number): HttpException {
    return new HttpException(
      {
        code: ERROR_CODES.LOGIN_COOLDOWN,
        message: 'Too many failed sign-in attempts. Try again later.',
        details: { retryAfterSec },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // Inainte de lookup-ul in DB si bcrypt: un email in pauza raspunde la fel, cont sau nu.
  async assertNotLocked(email: string): Promise<void> {
    let ms: number;
    try {
      ms = await this.redis.pttl(this.keys(email).lockKey);
    } catch (error) {
      this.logger.warn(`verificarea blocarii login a esuat (fail open): ${safeErrorSummary(error)}`);
      return;
    }
    if (ms > 0) throw this.cooldown(Math.ceil(ms / 1000));
  }

  // Numara un esec; la prag porneste pauza si arunca LOGIN_COOLDOWN (chiar pe incercarea
  // care atinge pragul). Sub prag se intoarce normal, iar apelantul arunca INVALID_CREDENTIALS.
  async recordFailure(email: string, user: LockoutUser | null, ctx: LoginAttemptContext = {}): Promise<void> {
    const { failKey, lockKey } = this.keys(email);
    const max = user?.role === 'ADMIN' ? LOGIN_MAX_FAILURES_ADMIN : LOGIN_MAX_FAILURES;
    let startedNow = false;
    try {
      // un singur round trip: TTL-ul se pune o data (NX), INCR il pastreaza
      const res = await this.redis
        .multi()
        .set(failKey, '0', 'PX', LOGIN_FAILURE_WINDOW_SEC * 1000, 'NX')
        .incr(failKey)
        .exec();
      const [incrError, count] = res?.[1] ?? [new Error('multi aborted'), null];
      if (incrError) throw incrError;
      if (Number(count) < max) return;
      startedNow = (await this.redis.set(lockKey, '1', 'PX', LOGIN_COOLDOWN_SEC * 1000, 'NX')) === 'OK';
      await this.redis.del(failKey);
    } catch (error) {
      this.logger.warn(`contorul de esecuri login a esuat (fail open): ${safeErrorSummary(error)}`);
      return;
    }

    // o singura alerta + un singur rand de audit per blocare (SET NX castigat)
    if (startedNow && user && !user.deletedAt) {
      void this.sendLockAlert(user).catch((error: unknown) =>
        this.logger.warn(`alerta de blocare login catre ${user.id} a esuat: ${safeErrorSummary(error)}`),
      );
      try {
        await this.audit.log({
          userId: user.id,
          role: user.role,
          action: 'LOGIN_COOLDOWN_STARTED',
          entityType: 'user',
          entityId: user.id,
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent ?? null,
        });
      } catch (error) {
        this.logger.warn(`auditul blocarii login a esuat: ${safeErrorSummary(error)}`);
      }
    }
    throw this.cooldown(LOGIN_COOLDOWN_SEC);
  }

  // Login reusit: sterge contorul. Reset de parola (linkul dovedeste controlul adresei):
  // sterge si pauza, ca userul legitim sa aiba mereu o iesire.
  async clear(email: string, opts: { includeLock?: boolean } = {}): Promise<void> {
    const { failKey, lockKey } = this.keys(email);
    try {
      if (opts.includeLock) await this.redis.del(failKey, lockKey);
      else await this.redis.del(failKey);
    } catch (error) {
      this.logger.warn(`resetarea contorului login a esuat: ${safeErrorSummary(error)}`);
    }
  }

  private async sendLockAlert(user: LockoutUser): Promise<void> {
    const origin = this.config.getOrThrow<string>('FRONTEND_ORIGIN');
    const lang = user.languagePreference === 'EN' ? 'en' : 'ro';
    const ro = lang === 'ro';
    const minutes = LOGIN_COOLDOWN_SEC / 60;
    const link = `${origin}/${lang}/forgot-password`;
    await this.mail.send(
      user.email,
      ro ? 'Încercări de autentificare nereușite — Cozy Home' : 'Failed sign-in attempts — Cozy Home',
      authEmailHtml({
        user,
        body: ro
          ? `Am observat mai multe încercări nereușite de a intra în contul tău, așa că am pus autentificarea pe pauză pentru ${minutes} minute. Dacă nu ai fost tu, îți recomandăm să îți schimbi parola.`
          : `We noticed several failed attempts to sign in to your account, so we paused sign-in for ${minutes} minutes. If this wasn't you, we recommend changing your password.`,
        link,
        ctaLabel: ro ? 'Resetează parola' : 'Reset password',
        supportEmail: this.mail.supportEmail ?? null,
        footer: {
          ro: 'Dacă nu ai fost tu, schimbă-ți parola cât mai curând.',
          en: "If this wasn't you, change your password as soon as possible.",
        },
      }),
      { replyToSupport: true },
    );
  }
}
