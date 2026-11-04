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
import { ERROR_CODES, LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION } from '@marketplace/shared';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import type Redis from 'ioredis';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { MailService } from '../../infra/mail/mail.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { withDeletedRecords } from '../../infra/prisma/soft-delete';
import { safeErrorSummary } from '../../common/logging/safe-error';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import { SETTING_DEFAULTS } from '../../common/settings/setting-defaults';
import { SettingsService } from '../../common/settings/settings.service';
import { SETTING_LEGAL_REACCEPT_EXISTING_USERS } from '../legal/legal.constants';
import { authEmailHtml } from './auth-email';
import { EMAIL_VERIFY_TTL_SEC, PASSWORD_RESET_TTL_SEC } from './auth.constants';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { LoginLockoutService, type LoginAttemptContext } from './login-lockout.service';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';

const BCRYPT_COST = 12; // invarianta 3.13
// hash dummy pentru timing uniform cand emailul nu exista
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7ZBp4LOSAsigGqlGCk9hxEONjVrIa6y';

// Tokenuri one-time in Redis (verificare email, resetare parola): se stocheaza DOAR
// sha256(raw) → userId, plus un index invers userId → hash ca regenerarea sa
// invalideze tokenul anterior.
type OneTimeTokenKind = 'email-verify' | 'pwd-reset';

export type PublicUser = Pick<
  User,
  'id' | 'email' | 'name' | 'phone' | 'role' | 'languagePreference' | 'emailVerifiedAt' | 'twoFactorEnabled'
> & { needsLegalAcceptance: boolean };

// E-admin-platform-2: re-acceptare cand versiunea salvata difera de cea curenta (NULL = cont vechi).
// Adminii sunt exceptati: personalul operatorului nu e parte la Termeni.
// Hotfix 2026-10-04 (PO): re-acceptarea fortata ruleaza DOAR cu system_settings
// legal_reaccept_existing_users='true' (dupa revizuirea avocatului). Cu 'false' (implicit) nimeni
// nu e blocat; conturile noi primesc oricum versiunile curente la inregistrare.
export function needsLegalAcceptance(
  u: Pick<User, 'role' | 'termsVersion' | 'privacyVersion'>,
  reacceptExistingUsers: boolean,
): boolean {
  if (!reacceptExistingUsers || u.role === 'ADMIN') return false;
  return u.termsVersion !== LEGAL_TERMS_VERSION || u.privacyVersion !== LEGAL_PRIVACY_VERSION;
}

// /auth/me ruleaza la fiecare incarcare de pagina: setarea se tine in memorie 60 s (fara query
// per cerere, ~150 ms cross-region). Comutarea din Admin -> Setari ajunge pe sloturi in max 60 s.
export const LEGAL_REACCEPT_CACHE_MS = 60_000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private reacceptCache: { value: boolean; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly twoFactor: TwoFactorService,
    private readonly eventBus: EventBusService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly lockout: LoginLockoutService,
    private readonly settings: SettingsService,
  ) {}

  private async reacceptExistingUsers(): Promise<boolean> {
    const now = Date.now();
    if (this.reacceptCache && this.reacceptCache.expiresAt > now) return this.reacceptCache.value;
    const value = await this.settings.getBool(
      SETTING_LEGAL_REACCEPT_EXISTING_USERS,
      SETTING_DEFAULTS.legal_reaccept_existing_users,
    );
    this.reacceptCache = { value, expiresAt: now + LEGAL_REACCEPT_CACHE_MS };
    return value;
  }

  private async toPublic(user: User): Promise<PublicUser> {
    // setarea se citeste doar cand regula stricta ar cere dialogul (versiuni NULL/vechi, non-admin):
    // userii la zi si adminii nu ating system_settings deloc
    const outdated = needsLegalAcceptance(user, true);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      languagePreference: user.languagePreference,
      emailVerifiedAt: user.emailVerifiedAt,
      twoFactorEnabled: user.twoFactorEnabled,
      needsLegalAcceptance: outdated && (await this.reacceptExistingUsers()),
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

  // --- emailuri auth (helper comun in auth-email.ts; valorile userului escapate) ---

  private authEmailHtml(user: Pick<User, 'name' | 'languagePreference'>, body: string, link: string, ctaLabel: string): string {
    return authEmailHtml({ user, body, link, ctaLabel, supportEmail: this.mail.supportEmail ?? null });
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
      { replyToSupport: true },
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
      { replyToSupport: true },
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
    const existing = await withDeletedRecords('EMAIL_UNIQUENESS', () => this.prisma.user.findUnique({ where: { email } }));
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
        termsVersion: LEGAL_TERMS_VERSION,
        privacyVersion: LEGAL_PRIVACY_VERSION,
      },
    });
    // best-effort: daca SMTP pica, contul exista si userul poate cere retrimiterea
    try {
      await this.sendVerificationEmail(user);
    } catch (e) {
      this.logger.warn(`emailul de verificare catre ${user.id} a esuat: ${safeErrorSummary(e)}`);
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
      this.logger.warn(`retrimiterea emailului de verificare catre ${user.id} a esuat: ${safeErrorSummary(e)}`);
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
      this.logger.warn(`emailul de resetare parola catre ${user.id} a esuat: ${safeErrorSummary(e)}`);
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
    // E-admin-platform-5: linkul dovedeste controlul adresei → ridica si pauza de login
    await this.lockout.clear(user.email, { includeLock: true });
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
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST) },
    });
    const { refreshToken, familyId } = await this.tokens.issueNewFamily(user.id, updated.passwordHash);
    const accessToken = await this.tokens.signAccessToken(updated, familyId);
    this.eventBus.emitAuthExpired(user.id);
    return { accessToken, refreshToken };
  }

  // --- login / sesiuni ---

  async login(
    dto: LoginDto,
    ctx: LoginAttemptContext = {},
  ): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }> {
    // E-admin-platform-5: emailul in pauza raspunde LOGIN_COOLDOWN inainte de DB si bcrypt
    // (identic pentru conturi existente/inexistente, chiar si cu parola corecta).
    await this.lockout.assertNotLocked(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // compara mereu (timing uniform), apoi decide
    const passwordOk = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || user.deletedAt || !passwordOk) {
      // la prag arunca LOGIN_COOLDOWN chiar pe aceasta incercare
      await this.lockout.recordFailure(dto.email, user && !user.deletedAt ? user : null, ctx);
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }
    // 2FA doar cand flagul e activ si userul are 2FA pornit (3.13)
    const totpRequired = Boolean(
      this.twoFactor.isFeatureEnabled && user.twoFactorEnabled && user.twoFactorSecret,
    );
    // parola corecta: contorul de esecuri se reseteaza (inclusiv pentru cont blocat/neconfirmat);
    // cu 2FA, abia dupa codul TOTP corect (altfel codurile gresite nu s-ar mai aduna)
    if (!totpRequired) await this.lockout.clear(dto.email);
    // D-L1-2 (pasul 6): cont blocat de admin — mesaj explicit DOAR dupa parola corecta
    // (altfel am confirma existenta contului fara credentiale valide).
    if (user.blockedAt) {
      throw new ForbiddenException({
        code: ERROR_CODES.ACCOUNT_BLOCKED,
        message: 'Account blocked',
      });
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        code: ERROR_CODES.EMAIL_NOT_VERIFIED,
        message: 'Email not verified',
      });
    }

    if (totpRequired && user.twoFactorSecret) {
      if (!dto.totpCode) {
        throw new UnauthorizedException({
          code: ERROR_CODES.TWO_FACTOR_REQUIRED,
          message: 'TOTP code required',
        });
      }
      if (!this.twoFactor.verifyLoginCode(user.twoFactorSecret, dto.totpCode)) {
        await this.lockout.recordFailure(dto.email, user, ctx);
        throw new UnauthorizedException({
          code: ERROR_CODES.TWO_FACTOR_INVALID_CODE,
          message: 'Invalid TOTP code',
        });
      }
      await this.lockout.clear(dto.email);
    }

    // O singura sesiune activa (3.13): revoca tot, familie noua, auth_expired pe socketul vechi
    const { refreshToken, familyId } = await this.tokens.issueNewFamily(user.id, user.passwordHash);
    const accessToken = await this.tokens.signAccessToken(user, familyId);
    this.eventBus.emitAuthExpired(user.id);

    return { user: await this.toPublic(user), accessToken, refreshToken };
  }

  async refresh(
    rawToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; role: User['role'] }> {
    const rotated = await this.tokens.rotate(rawToken);
    // Pasul 6 (audit 2026-08-23): contul sters soft sau blocat NU isi mai reinnoieste
    // sesiunea (inainte un cont sters ramanea functional pana la 7 zile prin refresh).
    const user = await this.prisma.user.findFirst({
      where: { id: rotated.userId, deletedAt: null, blockedAt: null },
    });
    if (!user) {
      await this.tokens.revokeAllForUser(rotated.userId);
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Session no longer valid',
      });
    }
    return {
      accessToken: await this.tokens.signAccessToken(user, rotated.familyId),
      refreshToken: rotated.refreshToken,
      role: user.role,
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken) {
      const userId = await this.tokens.revokeByRawToken(rawToken);
      if (userId) this.eventBus.emitAuthExpired(userId);
    }
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, blockedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Session no longer valid',
      });
    }
    return this.toPublic(user);
  }
}
