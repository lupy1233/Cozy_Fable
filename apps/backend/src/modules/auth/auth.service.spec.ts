import { BadRequestException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ERROR_CODES, LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION } from '@marketplace/shared';
import * as bcrypt from 'bcrypt';
import type Redis from 'ioredis';
import type { EventBusService } from '../../infra/event-bus/event-bus.service';
import type { MailService } from '../../infra/mail/mail.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { SettingsService } from '../../common/settings/settings.service';
import { AuthController } from './auth.controller';
import { AuthService, LEGAL_REACCEPT_CACHE_MS, needsLegalAcceptance } from './auth.service';
import type { LoginLockoutService } from './login-lockout.service';
import type { TokenService } from './token.service';
import type { TwoFactorService } from './two-factor.service';

// L0-A: retrimitere confirmare, parola uitata/resetare/schimbare, termeni la register.
// Fara DB/Redis reale: Prisma + Redis sunt mock-uri in memorie.

const CONFIG: Record<string, string> = { FRONTEND_ORIGIN: 'http://localhost:3000' };

// Redis minimal in memorie (get/set/del) — suficient pentru tokenurile one-time
function makeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
      return 'OK';
    }),
    del: jest.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'ana@demo.ro',
    passwordHash: bcrypt.hashSync('Parola123', 4),
    name: 'Ana <b>Popescu</b>',
    phone: null,
    role: 'CLIENT',
    languagePreference: 'RO',
    emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    twoFactorEnabled: false,
    twoFactorSecret: null,
    blockedAt: null,
    deletedAt: null,
    termsVersion: null,
    privacyVersion: null,
    ...overrides,
  };
}

// systemSettings: randurile din system_settings (lipsa = implicitul din SETTING_DEFAULTS)
function makeService(user: Record<string, unknown> | null = makeUser(), systemSettings: Record<string, string> = {}) {
  const prisma = {
    systemSetting: {
      findUnique: jest.fn(async ({ where }: { where: { key: string } }) =>
        where.key in systemSettings ? { key: where.key, value: systemSettings[where.key] } : null,
      ),
    },
    user: {
      findUnique: jest.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (!user) return null;
        if (where.email && where.email !== user.email) return null;
        if (where.id && where.id !== user.id) return null;
        return user;
      }),
      findUniqueOrThrow: jest.fn(async () => user),
      // pasul 6: refresh()/me() filtreaza deletedAt/blockedAt prin findFirst
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findFirst: jest.fn(async ({ where }: any) => {
        if (!user) return null;
        if (where.id && where.id !== user.id) return null;
        if (where.email && where.email !== user.email) return null;
        if ('deletedAt' in where && where.deletedAt === null && user.deletedAt) return null;
        if ('blockedAt' in where && where.blockedAt === null && user.blockedAt) return null;
        return user;
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...makeUser(),
        ...data,
        id: 'u-new',
      })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...user, ...data })),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const tokens = {
    revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    issueNewFamily: jest.fn().mockResolvedValue({ refreshToken: 'raw-refresh', familyId: 'session-family' }),
    signAccessToken: jest.fn().mockResolvedValue('access-jwt'),
    rotate: jest.fn().mockResolvedValue({ userId: 'u1', refreshToken: 'raw-refresh-2', familyId: 'session-family' }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mail = { send: jest.fn().mockResolvedValue(undefined) } as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const twoFactor = { isFeatureEnabled: false } as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventBus = { emitAuthExpired: jest.fn() } as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = { getOrThrow: (k: string) => CONFIG[k], get: (k: string) => CONFIG[k] } as any;
  const redis = makeRedis();
  // E-admin-platform-5: blocarea per email are specul ei (login-lockout.service.spec.ts)
  const lockout = {
    assertNotLocked: jest.fn().mockResolvedValue(undefined),
    recordFailure: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AuthService(
    prisma as PrismaService,
    tokens as TokenService,
    mail as MailService,
    twoFactor as TwoFactorService,
    eventBus as EventBusService,
    config as ConfigService,
    redis as unknown as Redis,
    lockout as unknown as LoginLockoutService,
    // SettingsService real peste prisma mock: acelasi parsing ca in productie
    new SettingsService(prisma as PrismaService),
  );
  return { service, prisma, tokens, mail, eventBus, redis, lockout };
}

// extrage tokenul raw din linkul trimis pe email
function tokenFromMail(mail: { send: jest.Mock }, path: string): string {
  const html = mail.send.mock.calls.at(-1)?.[2] as string;
  const m = new RegExp(`${path}\\?token=([0-9a-f]{64})`).exec(html);
  if (!m) throw new Error('token lipsa din email');
  return m[1];
}

const registerDto = {
  email: 'Nou@Demo.ro',
  password: 'Parola123',
  name: 'Nou',
  role: 'CLIENT' as const,
  termsAccepted: true,
};

describe('register (termeni + email best-effort)', () => {
  it('termsAccepted=false → TERMS_NOT_ACCEPTED (400), userul NU e creat', async () => {
    const { service, prisma } = makeService(null);
    await expect(service.register({ ...registerDto, termsAccepted: false })).rejects.toMatchObject({
      response: { code: ERROR_CODES.TERMS_NOT_ACCEPTED },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('termsAccepted=true → creeaza userul cu termsAcceptedAt si trimite emailul', async () => {
    const { service, prisma, mail } = makeService(null);
    const user = await service.register(registerDto);
    expect(user.email).toBe('nou@demo.ro');
    expect(prisma.user.create.mock.calls[0][0].data.termsAcceptedAt).toBeInstanceOf(Date);
    expect(mail.send).toHaveBeenCalledTimes(1);
    // E-admin-platform-1: raspunsurile la emailul de verificare ajung la SUPPORT_EMAIL
    expect(mail.send.mock.calls[0][3]).toEqual({ replyToSupport: true });
  });

  it('SMTP cazut → register reuseste totusi (email best-effort)', async () => {
    const { service, mail } = makeService(null);
    mail.send.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(service.register(registerDto)).resolves.toMatchObject({ email: 'nou@demo.ro' });
  });

  it('numele userului e escapat in HTML-ul emailului', async () => {
    const { service, mail } = makeService(null);
    await service.register({ ...registerDto, name: 'X <img src=x>' });
    const html = mail.send.mock.calls[0][2] as string;
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x&gt;');
  });
});

describe('resend-verification (raspuns uniform)', () => {
  it('email inexistent → nu arunca, nu trimite', async () => {
    const { service, mail } = makeService(null);
    await expect(service.resendVerification('nimeni@demo.ro')).resolves.toBeUndefined();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('email deja verificat → nu arunca, nu trimite', async () => {
    const { service, mail } = makeService(makeUser());
    await expect(service.resendVerification('ana@demo.ro')).resolves.toBeUndefined();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('email neverificat → trimite link nou si INVALIDEAZA tokenul anterior', async () => {
    const { service, mail, redis } = makeService(makeUser({ emailVerifiedAt: null }));
    await service.resendVerification('ANA@demo.ro');
    const first = tokenFromMail(mail, '/ro/verify-email');
    await service.resendVerification('ana@demo.ro');
    const second = tokenFromMail(mail, '/ro/verify-email');
    expect(first).not.toBe(second);
    // doar un token email-verify:<hash> ramane in Redis
    const keys = [...redis.store.keys()].filter((k) => k.startsWith('email-verify:'));
    expect(keys).toHaveLength(1);
    await expect(service.verifyEmail(first)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.verifyEmail(second)).resolves.toBeUndefined();
  });
});

describe('forgot-password / reset-password', () => {
  it('forgot cu email inexistent → raspuns uniform, fara email', async () => {
    const { service, mail } = makeService(null);
    await expect(service.forgotPassword('nimeni@demo.ro')).resolves.toBeUndefined();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('forgot → email cu link /ro/reset-password?token=...; tokenul e stocat DOAR hash-uit', async () => {
    const { service, mail, redis } = makeService();
    await service.forgotPassword('ana@demo.ro');
    const raw = tokenFromMail(mail, '/ro/reset-password');
    expect(redis.store.has(`pwd-reset:${raw}`)).toBe(false);
    expect([...redis.store.values()]).toContain('u1');
  });

  it('reset cu token invalid → RESET_TOKEN_INVALID (400), parola neschimbata', async () => {
    const { service, prisma } = makeService();
    await expect(service.resetPassword('f'.repeat(64), 'NouaParola1')).rejects.toMatchObject({
      response: { code: ERROR_CODES.RESET_TOKEN_INVALID },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('reset cu token expirat (sters din Redis) → RESET_TOKEN_INVALID', async () => {
    const { service, mail, redis } = makeService();
    await service.forgotPassword('ana@demo.ro');
    const raw = tokenFromMail(mail, '/ro/reset-password');
    redis.store.clear(); // simuleaza TTL expirat
    await expect(service.resetPassword(raw, 'NouaParola1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reset valid → hash bcrypt nou, toate sesiunile revocate; tokenul e one-time', async () => {
    const { service, mail, prisma, tokens, eventBus } = makeService();
    await service.forgotPassword('ana@demo.ro');
    const raw = tokenFromMail(mail, '/ro/reset-password');
    await service.resetPassword(raw, 'NouaParola1');
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.passwordHash).toMatch(/^\$2[ab]\$12\$/);
    expect(await bcrypt.compare('NouaParola1', data.passwordHash)).toBe(true);
    expect(tokens.revokeAllForUser).toHaveBeenCalledWith('u1');
    expect(eventBus.emitAuthExpired).toHaveBeenCalledWith('u1');
    // a doua folosire a aceluiasi token → invalid
    await expect(service.resetPassword(raw, 'AltaParola1')).rejects.toMatchObject({
      response: { code: ERROR_CODES.RESET_TOKEN_INVALID },
    });
  });

  it('un forgot nou invalideaza linkul anterior', async () => {
    const { service, mail } = makeService();
    await service.forgotPassword('ana@demo.ro');
    const first = tokenFromMail(mail, '/ro/reset-password');
    await service.forgotPassword('ana@demo.ro');
    await expect(service.resetPassword(first, 'NouaParola1')).rejects.toMatchObject({
      response: { code: ERROR_CODES.RESET_TOKEN_INVALID },
    });
  });

  it('reset pe cont neconfirmat marcheaza emailul ca verificat (linkul dovedeste adresa)', async () => {
    const { service, mail, prisma } = makeService(makeUser({ emailVerifiedAt: null }));
    await service.forgotPassword('ana@demo.ro');
    await service.resetPassword(tokenFromMail(mail, '/ro/reset-password'), 'NouaParola1');
    expect(prisma.user.update.mock.calls[0][0].data.emailVerifiedAt).toBeInstanceOf(Date);
  });
});

describe('change-password', () => {
  it('parola curenta gresita → PASSWORD_INCORRECT (400), nimic revocat', async () => {
    const { service, prisma, tokens } = makeService();
    await expect(service.changePassword('u1', 'Gresita123', 'NouaParola1')).rejects.toMatchObject({
      response: { code: ERROR_CODES.PASSWORD_INCORRECT },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(tokens.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('parola corecta → hash nou, revoca tot si emite familie noua pentru sesiunea curenta', async () => {
    const { service, prisma, tokens } = makeService();
    const out = await service.changePassword('u1', 'Parola123', 'NouaParola1');
    expect(out).toEqual({ accessToken: 'access-jwt', refreshToken: 'raw-refresh' });
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(await bcrypt.compare('NouaParola1', data.passwordHash)).toBe(true);
    expect(tokens.issueNewFamily).toHaveBeenCalledWith('u1', data.passwordHash);
    expect(tokens.signAccessToken).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), 'session-family');
  });
});

// Pasul 6 (audit 2026-08-23, D-L1-2): cont blocat de admin + refresh pe cont sters/blocat.
describe('cont blocat / sters soft (pasul 6)', () => {
  it('login pe cont blocat cu parola corecta → 403 ACCOUNT_BLOCKED', async () => {
    const { service } = makeService(makeUser({ blockedAt: new Date() }));
    await expect(
      service.login({ email: 'ana@demo.ro', password: 'Parola123' } as never),
    ).rejects.toMatchObject({ status: 403, response: { code: ERROR_CODES.ACCOUNT_BLOCKED } });
  });

  it('login pe cont blocat cu parola GRESITA → INVALID_CREDENTIALS (nu confirmam blocarea)', async () => {
    const { service } = makeService(makeUser({ blockedAt: new Date() }));
    await expect(
      service.login({ email: 'ana@demo.ro', password: 'gresita123' } as never),
    ).rejects.toMatchObject({ response: { code: ERROR_CODES.INVALID_CREDENTIALS } });
  });

  it('refresh pe cont sters soft → 401 + toate sesiunile revocate', async () => {
    const { service, tokens } = makeService(makeUser({ deletedAt: new Date() }));
    await expect(service.refresh('raw')).rejects.toMatchObject({ status: 401 });
    expect(tokens.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('refresh pe cont blocat → 401 + revocare; me() la fel', async () => {
    const { service, tokens } = makeService(makeUser({ blockedAt: new Date() }));
    await expect(service.refresh('raw')).rejects.toMatchObject({ status: 401 });
    expect(tokens.revokeAllForUser).toHaveBeenCalledWith('u1');
    await expect(service.me('u1')).rejects.toMatchObject({ status: 401 });
  });

  it('refresh pe cont valid functioneaza in continuare', async () => {
    const { service } = makeService();
    await expect(service.refresh('raw')).resolves.toEqual({
      accessToken: 'access-jwt',
      refreshToken: 'raw-refresh-2',
      role: 'CLIENT',
    });
  });
});

// E-admin-platform-2: versiunea Termenilor/Politicii acceptata + re-acceptare
describe('acceptare juridica versionata', () => {
  it('register salveaza versiunile curente si raspunde needsLegalAcceptance=false', async () => {
    const { service, prisma } = makeService(null);
    const user = await service.register(registerDto);
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.termsVersion).toBe(LEGAL_TERMS_VERSION);
    expect(data.privacyVersion).toBe(LEGAL_PRIVACY_VERSION);
    expect(user.needsLegalAcceptance).toBe(false);
  });

  it('needsLegalAcceptance cu legal_reaccept_existing_users=true: NULL → true, versiune veche → true, curenta → false, ADMIN → false', () => {
    const current = { termsVersion: LEGAL_TERMS_VERSION, privacyVersion: LEGAL_PRIVACY_VERSION };
    expect(needsLegalAcceptance({ role: 'CLIENT', termsVersion: null, privacyVersion: null }, true)).toBe(true);
    expect(needsLegalAcceptance({ role: 'COMPANY_USER', termsVersion: '2020-01-01', privacyVersion: LEGAL_PRIVACY_VERSION }, true)).toBe(true);
    expect(needsLegalAcceptance({ role: 'CLIENT', termsVersion: LEGAL_TERMS_VERSION, privacyVersion: 'veche' }, true)).toBe(true);
    expect(needsLegalAcceptance({ role: 'CLIENT', ...current }, true)).toBe(false);
    expect(needsLegalAcceptance({ role: 'ADMIN', termsVersion: null, privacyVersion: null }, true)).toBe(false);
  });

  // Hotfix 2026-10-04 (PO): re-acceptarea conturilor existente asteapta revizuirea avocatului
  it('needsLegalAcceptance cu legal_reaccept_existing_users=false: nimeni nu e blocat (NULL, versiune veche, curenta, ADMIN)', () => {
    const current = { termsVersion: LEGAL_TERMS_VERSION, privacyVersion: LEGAL_PRIVACY_VERSION };
    expect(needsLegalAcceptance({ role: 'CLIENT', termsVersion: null, privacyVersion: null }, false)).toBe(false);
    expect(needsLegalAcceptance({ role: 'COMPANY_USER', termsVersion: null, privacyVersion: null }, false)).toBe(false);
    expect(needsLegalAcceptance({ role: 'COMPANY_USER', termsVersion: '2020-01-01', privacyVersion: LEGAL_PRIVACY_VERSION }, false)).toBe(false);
    expect(needsLegalAcceptance({ role: 'CLIENT', termsVersion: LEGAL_TERMS_VERSION, privacyVersion: 'veche' }, false)).toBe(false);
    expect(needsLegalAcceptance({ role: 'CLIENT', ...current }, false)).toBe(false);
    expect(needsLegalAcceptance({ role: 'ADMIN', termsVersion: null, privacyVersion: null }, false)).toBe(false);
  });

  it('me() pe cont vechi (versiuni NULL) cu setarea implicita (rand lipsa) → needsLegalAcceptance=false', async () => {
    const { service, prisma } = makeService(makeUser());
    await expect(service.me('u1')).resolves.toMatchObject({ needsLegalAcceptance: false });
    expect(prisma.systemSetting.findUnique).toHaveBeenCalledWith({ where: { key: 'legal_reaccept_existing_users' } });
  });

  it("me() pe cont vechi cu legal_reaccept_existing_users='false' (randul din migrare) → false", async () => {
    const { service } = makeService(makeUser(), { legal_reaccept_existing_users: 'false' });
    await expect(service.me('u1')).resolves.toMatchObject({ needsLegalAcceptance: false });
  });

  it("me() pe cont vechi cu legal_reaccept_existing_users='true' → true (comportamentul E-admin-platform-2)", async () => {
    const { service } = makeService(makeUser(), { legal_reaccept_existing_users: 'true' });
    await expect(service.me('u1')).resolves.toMatchObject({ needsLegalAcceptance: true });
  });

  it("me() pe versiune acceptata veche: false implicit, true doar cu setarea 'true'", async () => {
    const old = makeUser({ termsVersion: '2020-01-01', privacyVersion: '2020-01-01' });
    await expect(makeService(old).service.me('u1')).resolves.toMatchObject({ needsLegalAcceptance: false });
    await expect(
      makeService(old, { legal_reaccept_existing_users: 'true' }).service.me('u1'),
    ).resolves.toMatchObject({ needsLegalAcceptance: true });
  });

  it("ADMIN cu versiuni NULL ramane exceptat si cu setarea 'true'; nu citeste setarea", async () => {
    const { service, prisma } = makeService(makeUser({ role: 'ADMIN' }), { legal_reaccept_existing_users: 'true' });
    await expect(service.me('u1')).resolves.toMatchObject({ needsLegalAcceptance: false });
    expect(prisma.systemSetting.findUnique).not.toHaveBeenCalled();
  });

  it("user cu versiunile curente → false fara sa citeasca setarea (si cu 'true')", async () => {
    const { service, prisma } = makeService(
      makeUser({ termsVersion: LEGAL_TERMS_VERSION, privacyVersion: LEGAL_PRIVACY_VERSION }),
      { legal_reaccept_existing_users: 'true' },
    );
    await expect(service.me('u1')).resolves.toMatchObject({ needsLegalAcceptance: false });
    expect(prisma.systemSetting.findUnique).not.toHaveBeenCalled();
  });

  it('login pe cont vechi (versiuni NULL) cu setarea implicita → user.needsLegalAcceptance=false', async () => {
    const { service } = makeService(makeUser());
    const out = await service.login({ email: 'ana@demo.ro', password: 'Parola123' });
    expect(out.user.needsLegalAcceptance).toBe(false);
  });

  it("login pe cont vechi cu setarea 'true' → user.needsLegalAcceptance=true", async () => {
    const { service } = makeService(makeUser(), { legal_reaccept_existing_users: 'true' });
    const out = await service.login({ email: 'ana@demo.ro', password: 'Parola123' });
    expect(out.user.needsLegalAcceptance).toBe(true);
  });

  it('setarea e tinuta in memorie 60 s: un singur query pe rafala, recitita dupa expirare', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    try {
      const { service, prisma } = makeService(makeUser());
      await service.me('u1');
      await service.me('u1');
      await service.login({ email: 'ana@demo.ro', password: 'Parola123' });
      expect(prisma.systemSetting.findUnique).toHaveBeenCalledTimes(1);
      now.mockReturnValue(1_000_000 + LEGAL_REACCEPT_CACHE_MS + 1);
      await service.me('u1');
      expect(prisma.systemSetting.findUnique).toHaveBeenCalledTimes(2);
    } finally {
      now.mockRestore();
    }
  });
});

// GET /auth/me cap-coada (controller + service real, DB mock): contul existent nu e blocat implicit
describe('GET /auth/me (controller + service) — hotfix re-acceptare amanata', () => {
  const controllerFor = (service: AuthService) =>
    new AuthController(service, {} as never, { get: () => 'test' } as never);
  const meReq = { cookies: { mm_access: 'ok' }, headers: {}, user: { sub: 'u1', role: 'CLIENT', email: 'ana@demo.ro' } } as never;
  const meRes = { clearCookie: jest.fn() } as never;

  it('user cu versiuni NULL + setarea implicita → { user: { needsLegalAcceptance: false } }', async () => {
    const { service } = makeService(makeUser());
    await expect(controllerFor(service).me(meReq, meRes)).resolves.toMatchObject({
      user: { id: 'u1', needsLegalAcceptance: false },
    });
  });

  it("aceeasi cerere dupa ce adminul pune legal_reaccept_existing_users='true' → needsLegalAcceptance=true", async () => {
    const { service } = makeService(makeUser(), { legal_reaccept_existing_users: 'true' });
    await expect(controllerFor(service).me(meReq, meRes)).resolves.toMatchObject({
      user: { id: 'u1', needsLegalAcceptance: true },
    });
  });
});

describe('blocare login per email (E-admin-platform-5)', () => {
  const cooldown = () =>
    new HttpException({ code: ERROR_CODES.LOGIN_COOLDOWN, message: 'cooldown', details: { retryAfterSec: 900 } }, HttpStatus.TOO_MANY_REQUESTS);

  it('email in pauza → LOGIN_COOLDOWN inainte de DB/bcrypt, chiar cu parola corecta', async () => {
    const { service, prisma, lockout, tokens } = makeService();
    lockout.assertNotLocked.mockRejectedValueOnce(cooldown());
    await expect(service.login({ email: 'ana@demo.ro', password: 'Parola123' })).rejects.toMatchObject({
      response: { code: ERROR_CODES.LOGIN_COOLDOWN },
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(tokens.issueNewFamily).not.toHaveBeenCalled();
  });

  it('parola gresita → recordFailure cu userul si contextul, apoi INVALID_CREDENTIALS', async () => {
    const { service, lockout } = makeService();
    const ctx = { ip: '198.51.100.1', userAgent: 'jest' };
    await expect(service.login({ email: 'ana@demo.ro', password: 'Gresita1' }, ctx)).rejects.toMatchObject({
      response: { code: ERROR_CODES.INVALID_CREDENTIALS },
    });
    expect(lockout.recordFailure).toHaveBeenCalledWith('ana@demo.ro', expect.objectContaining({ id: 'u1' }), ctx);
    expect(lockout.clear).not.toHaveBeenCalled();
  });

  it('email inexistent → recordFailure cu null (acelasi raspuns)', async () => {
    const { service, lockout } = makeService(null);
    await expect(service.login({ email: 'ghost@example.invalid', password: 'Gresita1' })).rejects.toMatchObject({
      response: { code: ERROR_CODES.INVALID_CREDENTIALS },
    });
    expect(lockout.recordFailure).toHaveBeenCalledWith('ghost@example.invalid', null, {});
  });

  it('cont sters soft → tratat ca inexistent (recordFailure cu null)', async () => {
    const { service, lockout } = makeService(makeUser({ deletedAt: new Date() }));
    await expect(service.login({ email: 'ana@demo.ro', password: 'Parola123' })).rejects.toMatchObject({
      response: { code: ERROR_CODES.INVALID_CREDENTIALS },
    });
    expect(lockout.recordFailure).toHaveBeenCalledWith('ana@demo.ro', null, {});
  });

  it('pragul atins → LOGIN_COOLDOWN propagat din recordFailure', async () => {
    const { service, lockout } = makeService();
    lockout.recordFailure.mockRejectedValueOnce(cooldown());
    await expect(service.login({ email: 'ana@demo.ro', password: 'Gresita1' })).rejects.toMatchObject({
      response: { code: ERROR_CODES.LOGIN_COOLDOWN },
    });
  });

  it('login reusit → clear (fara includeLock)', async () => {
    const { service, lockout } = makeService();
    await service.login({ email: 'ana@demo.ro', password: 'Parola123' });
    expect(lockout.clear).toHaveBeenCalledWith('ana@demo.ro');
    expect(lockout.recordFailure).not.toHaveBeenCalled();
  });

  it('reset de parola reusit → clear cu includeLock', async () => {
    const { service, mail, lockout } = makeService();
    await service.forgotPassword('ana@demo.ro');
    const raw = tokenFromMail(mail, '/ro/reset-password');
    await service.resetPassword(raw, 'ParolaNoua1');
    expect(lockout.clear).toHaveBeenCalledWith('ana@demo.ro', { includeLock: true });
  });
});
