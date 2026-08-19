import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
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
import { EMAIL_VERIFY_TTL_SEC, PASSWORD_RESET_TTL_SEC } from './auth.constants';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';

const BCRYPT_COST = 12; // invarianta 3.13
// hash dummy pentru timing uniform cand emailul nu exista
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7ZBp4LOSAsigGqlGCk9hxEONjVrIa6y';

// Tokenuri one-time in Redis (verificare email, resetare parola): se stocheaza DOAR
// sha256(raw) → userId, plus un index invers userId → hash ca regenerarea sa
// invalideze tokenul anterior.
type OneTimeTokenKind = 'email-verify' | 'pwd-reset';

// escape minimal pentru valorile interpolate in HTML-ul emailurilor (nume user)
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type PublicUser = Pick<
  User,
  'id' | 'email' | 'name' | 'phone' | 'role' | 'languagePreference' | 'emailVerifiedAt' | 'twoFactorEnabled'
>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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

  // --- tokenuri one-time (Redis) ---

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private async issueOneTimeToken(
    kind: OneTimeTokenKind,
    userId: string,
    ttlSec: number,
  ): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    const hash = this.hashToken(raw);
    const userKey = `${kind}-user:${userId}`;
    // regenerarea invalideaza tokenul anterior (un singur link valid per user)
    const previous = await this.redis.get(userKey);
    if (previous) await this.redis.del(`${kind}:${previous}`);
    await this.redis.set(`${kind}:${hash}`, userId, 'EX', ttlSec);
    await this.redis.set(userKey, hash, 'EX', ttlSec);
    return raw;
  }

  // Consuma tokenul (one-time): stergerea se face INAINTE de folosire, ca doua
  // cereri concurente cu acelasi token sa nu reuseasca amandoua.
  private async consumeOneTimeToken(kind: OneTimeTokenKind, raw: string): Promise<string | null> {
    const key = `${kind}:${this.hashToken(raw)}`;
    const userId = await this.redis.get(key);
    if (!userId) return null;
    const deleted = await this.redis.del(key);
    if (deleted === 0) return null;
    await this.redis.del(`${kind}-user:${userId}`);
    return userId;
  }

  // --- emailuri auth (stil comun cu notification-emails; valorile userului escapate) ---

  private authEmailHtml(user: Pick<User, 'name' | 'languagePreference'>, body: string, link: string, ctaLabel: string): string {
    const ro = user.languagePreference !== 'EN';
    return `
      <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #2b2b2b;">
        <p style="letter-spacing: 0.12em; font-size: 12px; color: #8a7355;">COZY HOME</p>
        <p>${ro ? 'Salut' : 'Hi'} ${esc(user.name)},</p>
        <p>${body}</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background: #8a7355; color: #fff; padding: 10px 22px; text-decoration: none; border-radius: 999px;">
            ${ctaLabel}
          </a>
        </p>
        <p style="font-size: 12px; color: #888;">
          ${ro ? 'Sau deschide direct:' : 'Or open directly:'} <a href="${link}">${link}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e5ded4; margin: 28px 0 12px;" />
        <p style="font-size: 11px; color: #999;">
          ${
            ro
              ? 'Dacă nu ai cerut tu acest email, îl poți ignora.'
              : 'If you did not request this email, you can ignore it.'
          }
        </p>
      </div>`;
  }

  // Email verify: token random in Redis (TTL 24h), link catre FE in limba userului
  private async sendVerificationEmail(user: User): Promise<void> {
    const raw = await this.issueOneTimeToken('email-verify', user.id, EMAIL_VERIFY_TTL_SEC);
    const origin = this.config.getOrThrow<string>('FRONTEND_ORIGIN');
    const link = `${origin}/${user.languagePreference.toLowerCase()}/verify-email?token=${raw}`;
    const ro = user.languagePreference !== 'EN';
    await this.mail.send(
      user.email,
      ro ? 'Confirmă adresa de email — Cozy Home' : 'Confirm your email — Cozy Home',
      this.authEmailHtml(
        user,
        ro
          ? 'Apasă pe butonul de mai jos ca să îți confirmi adresa de email și să îți activezi contul. Linkul expiră în 24 de ore.'
          : 'Click the button below to confirm your email address and activate your account. The link expires in 24 hours.',
        link,
        ro ? 'Confirmă emailul' : 'Confirm email',
      ),
    );
  }

  private async sendPasswordResetEmail(user: User, raw: string): Promise<void> {
    const origin = this.config.getOrThrow<string>('FRONTEND_ORIGIN');
    const link = `${origin}/${user.languagePreference.toLowerCase()}/reset-password?token=${raw}`;
    const ro = user.languagePreference !== 'EN';
    await this.mail.send(
      user.email,
      ro ? 'Resetare parolă — Cozy Home' : 'Password reset — Cozy Home',
      this.authEmailHtml(
        user,
        ro
          ? 'Am primit o cerere de resetare a parolei pentru contul tău. Apasă pe butonul de mai jos ca să alegi o parolă nouă. Linkul expiră în 60 de minute și poate fi folosit o singură dată.'
          : 'We received a request to reset the password for your account. Click the button below to choose a new password. The link expires in 60 minutes and can be used only once.',
        link,
        ro ? 'Alege o parolă nouă' : 'Choose a new password',
      ),
    );
  }

  // --- inregistrare / verificare ---

  async register(dto: RegisterDto): Promise<PublicUser> {
    if (dto.termsAccepted !== true) {
      throw new BadRequestException({
        code: ERROR_CODES.TERMS_NOT_ACCEPTED,
        message: 'Terms and conditions must be accepted',
      });
    }
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
        termsAcceptedAt: new Date(),
      },
    });
    // best-effort: daca SMTP pica, contul exista si userul poate cere retrimiterea
    try {
      await this.sendVerificationEmail(user);
    } catch (e) {
      this.logger.warn(`emailul de verificare catre ${user.id} a esuat: ${(e as Error).message}`);
    }
    return this.toPublic(user);
  }

  // Raspuns uniform (anti-enumerare): nu spune daca emailul exista / e deja verificat.
  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.deletedAt || user.emailVerifiedAt) return;
    try {
      await this.sendVerificationEmail(user);
    } catch (e) {
      this.logger.warn(`retrimiterea emailului de verificare catre ${user.id} a esuat: ${(e as Error).message}`);
    }
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const userId = await this.consumeOneTimeToken('email-verify', rawToken);
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
  }

  // --- parola uitata / resetare / schimbare (L0-A) ---

  // Raspuns uniform indiferent daca emailul exista. Tokenul 32B → Redis (sha256, TTL 60 min).
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.deletedAt) return;
    const raw = await this.issueOneTimeToken('pwd-reset', user.id, PASSWORD_RESET_TTL_SEC);
    try {
      await this.sendPasswordResetEmail(user, raw);
    } catch (e) {
      this.logger.warn(`emailul de resetare parola catre ${user.id} a esuat: ${(e as Error).message}`);
    }
  }

  async resetPassword(rawToken: string, password: string): Promise<void> {
    const invalid = () =>
      new BadRequestException({
        code: ERROR_CODES.RESET_TOKEN_INVALID,
        message: 'Reset token invalid, expired or already used',
      });
    const userId = await this.consumeOneTimeToken('pwd-reset', rawToken);
    if (!userId) throw invalid();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw invalid();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, BCRYPT_COST),
        // linkul primit pe email dovedeste controlul adresei → contul neconfirmat
        // nu ramane in fundatura dupa o resetare reusita
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
    });
    // toate sesiunile cad (parola compromisa); userul se autentifica din nou
    await this.tokens.revokeAllForUser(user.id);
    this.eventBus.emitAuthExpired(user.id);
  }

  // Schimbare parola autentificata: verifica parola curenta, revoca toate familiile
  // de refresh tokens si emite una noua pentru dispozitivul curent (o singura sesiune
  // activa, 3.13) — controllerul seteaza cookie-urile noi, userul ramane logat.
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHORIZED, message: 'Unauthorized' });
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      // 400 (nu 401): clientul nu trebuie sa incerce refresh + retry pe aceasta eroare
      throw new BadRequestException({
        code: ERROR_CODES.PASSWORD_INCORRECT,
        message: 'Current password is incorrect',
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST) },
    });
    await this.tokens.revokeAllForUser(user.id);
    const refreshToken = await this.tokens.issueNewFamily(user.id);
    const accessToken = await this.tokens.signAccessToken(user);
    this.eventBus.emitAuthExpired(user.id);
    return { accessToken, refreshToken };
  }

  // --- login / sesiuni ---

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
