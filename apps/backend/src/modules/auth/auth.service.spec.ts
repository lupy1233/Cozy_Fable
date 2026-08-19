import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@marketplace/shared';
import * as bcrypt from 'bcrypt';
import type Redis from 'ioredis';
import type { EventBusService } from '../../infra/event-bus/event-bus.service';
import type { MailService } from '../../infra/mail/mail.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthService } from './auth.service';
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
    deletedAt: null,
    ...overrides,
  };
}

function makeService(user: Record<string, unknown> | null = makeUser()) {
  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (!user) return null;
        if (where.email && where.email !== user.email) return null;
        if (where.id && where.id !== user.id) return null;
        return user;
      }),
      findUniqueOrThrow: jest.fn(async () => user),
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
    issueNewFamily: jest.fn().mockResolvedValue('raw-refresh'),
    signAccessToken: jest.fn().mockResolvedValue('access-jwt'),
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
  const service = new AuthService(
    prisma as PrismaService,
    tokens as TokenService,
    mail as MailService,
    twoFactor as TwoFactorService,
    eventBus as EventBusService,
    config as ConfigService,
    redis as unknown as Redis,
  );
  return { service, prisma, tokens, mail, eventBus, redis };
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
    expect(tokens.revokeAllForUser).toHaveBeenCalledWith('u1');
    expect(tokens.issueNewFamily).toHaveBeenCalledWith('u1');
    // ordinea: revocare INAINTE de emiterea familiei noi
    expect(tokens.revokeAllForUser.mock.invocationCallOrder[0]).toBeLessThan(
      tokens.issueNewFamily.mock.invocationCallOrder[0],
    );
  });
});
