import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@marketplace/shared';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import type Redis from 'ioredis';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { MailService } from '../../infra/mail/mail.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import { EMAIL_VERIFY_TTL_SEC } from './auth.constants';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';

const BCRYPT_COST = 12; // invarianta 3.13
// hash dummy pentru timing uniform cand emailul nu exista
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7ZBp4LOSAsigGqlGCk9hxEONjVrIa6y';

export type PublicUser = Pick<
  User,
  'id' | 'email' | 'name' | 'phone' | 'role' | 'languagePreference' | 'emailVerifiedAt' | 'twoFactorEnabled'
>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly twoFactor: TwoFactorService,
    private readonly eventBus: EventBusService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private toPublic(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      languagePreference: user.languagePreference,
      emailVerifiedAt: user.emailVerifiedAt,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  }

  async register(dto: RegisterDto): Promise<PublicUser> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        code: ERROR_CODES.EMAIL_ALREADY_REGISTERED,
        message: 'Email already registered',
      });
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_COST),
        name: dto.name,
        phone: dto.phone,
        role: dto.role,
        languagePreference: dto.languagePreference ?? 'RO',
      },
    });
    await this.sendVerificationEmail(user);
    return this.toPublic(user);
  }

  // Mock email verify: token random in Redis (TTL 24h), link trimis pe Mailpit
  private async sendVerificationEmail(user: User): Promise<void> {
    const raw = randomBytes(32).toString('hex');
    const key = `email-verify:${createHash('sha256').update(raw).digest('hex')}`;
    await this.redis.set(key, user.id, 'EX', EMAIL_VERIFY_TTL_SEC);

    const origin = this.config.getOrThrow<string>('FRONTEND_ORIGIN');
    const link = `${origin}/${user.languagePreference.toLowerCase()}/verify-email?token=${raw}`;
    await this.mail.send(
      user.email,
      'Confirma adresa de email / Confirm your email',
      `<p>Salut ${user.name},</p>
       <p>Confirma emailul / confirm your email:</p>
       <p><a href="${link}">${link}</a></p>
       <p>Linkul expira in 24h. / Link expires in 24h.</p>`,
    );
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const key = `email-verify:${createHash('sha256').update(rawToken).digest('hex')}`;
    const userId = await this.redis.get(key);
    if (!userId) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Verification token invalid or expired',
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
    await this.redis.del(key);
  }

  async login(dto: LoginDto): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // compara mereu (timing uniform), apoi decide
    const passwordOk = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || user.deletedAt || !passwordOk) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        code: ERROR_CODES.EMAIL_NOT_VERIFIED,
        message: 'Email not verified',
      });
    }

    // 2FA doar cand flagul e activ si userul are 2FA pornit (3.13)
    if (this.twoFactor.isFeatureEnabled && user.twoFactorEnabled && user.twoFactorSecret) {
      if (!dto.totpCode) {
        throw new UnauthorizedException({
          code: ERROR_CODES.TWO_FACTOR_REQUIRED,
          message: 'TOTP code required',
        });
      }
      if (!this.twoFactor.verifyLoginCode(user.twoFactorSecret, dto.totpCode)) {
        throw new UnauthorizedException({
          code: ERROR_CODES.TWO_FACTOR_INVALID_CODE,
          message: 'Invalid TOTP code',
        });
      }
    }

    // O singura sesiune activa (3.13): revoca tot, familie noua, auth_expired pe socketul vechi
    await this.tokens.revokeAllForUser(user.id);
    const refreshToken = await this.tokens.issueNewFamily(user.id);
    const accessToken = await this.tokens.signAccessToken(user);
    this.eventBus.emitAuthExpired(user.id);

    return { user: this.toPublic(user), accessToken, refreshToken };
  }

  async refresh(rawToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const rotated = await this.tokens.rotate(rawToken);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: rotated.userId } });
    return {
      accessToken: await this.tokens.signAccessToken(user),
      refreshToken: rotated.refreshToken,
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken) await this.tokens.revokeByRawToken(rawToken);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.toPublic(user);
  }
}
