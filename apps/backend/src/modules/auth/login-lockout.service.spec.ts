import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@marketplace/shared';
import { LOGIN_COOLDOWN_SEC } from './auth.constants';
import { LoginLockoutService } from './login-lockout.service';

// Redis minimal in memorie: pttl / set (PX, NX) / incr / del / multi().exec()
function makeRedis() {
  const store = new Map<string, { value: string; expiresAt: number | null }>();
  const now = () => Date.now();
  const alive = (k: string) => {
    const entry = store.get(k);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= now()) store.delete(k);
    return store.get(k);
  };
  const set = (k: string, v: string, ...args: (string | number)[]) => {
    const nx = args.includes('NX');
    if (nx && alive(k)) return null;
    const pxIndex = args.indexOf('PX');
    const expiresAt = pxIndex >= 0 ? now() + Number(args[pxIndex + 1]) : null;
    store.set(k, { value: v, expiresAt });
    return 'OK';
  };
  const incr = (k: string) => {
    const entry = alive(k);
    const next = Number(entry?.value ?? 0) + 1;
    store.set(k, { value: String(next), expiresAt: entry?.expiresAt ?? null });
    return next;
  };
  const redis = {
    store,
    pttl: jest.fn(async (k: string) => {
      const entry = alive(k);
      if (!entry) return -2;
      return entry.expiresAt === null ? -1 : entry.expiresAt - now();
    }),
    set: jest.fn(async (k: string, v: string, ...args: (string | number)[]) => set(k, v, ...args)),
    del: jest.fn(async (...keys: string[]) => keys.filter((k) => store.delete(k)).length),
    multi: jest.fn(() => {
      const ops: (() => unknown)[] = [];
      const chain = {
        set: (k: string, v: string, ...args: (string | number)[]) => {
          ops.push(() => set(k, v, ...args));
          return chain;
        },
        incr: (k: string) => {
          ops.push(() => incr(k));
          return chain;
        },
        exec: async () => ops.map((op) => [null, op()]),
      };
      return chain;
    }),
  };
  return redis;
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'ana@demo.ro',
    name: 'Ana <b>Popescu</b>',
    role: 'CLIENT',
    languagePreference: 'RO',
    deletedAt: null,
    ...overrides,
  } as never;
}

function setup() {
  const redis = makeRedis();
  const mail = { send: jest.fn().mockResolvedValue(undefined), supportEmail: 'suport@cozyhome.ro' };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const config = { getOrThrow: () => 'http://localhost:3000' };
  const service = new LoginLockoutService(redis as never, mail as never, audit as never, config as never);
  return { service, redis, mail, audit };
}

async function failTimes(service: LoginLockoutService, email: string, user: unknown, times: number) {
  for (let i = 0; i < times; i += 1) await service.recordFailure(email, user as never, { ip: '198.51.100.1' });
}

const cooldown = {
  status: HttpStatus.TOO_MANY_REQUESTS,
  response: { code: ERROR_CODES.LOGIN_COOLDOWN },
};

describe('LoginLockoutService (E-admin-platform-5)', () => {
  it('does not lock after 9 failures; the 10th starts the cooldown and alerts once', async () => {
    const { service, mail, audit } = setup();
    const user = makeUser();
    await failTimes(service, 'ana@demo.ro', user, 9);
    await expect(service.assertNotLocked('ana@demo.ro')).resolves.toBeUndefined();

    await expect(service.recordFailure('ana@demo.ro', user, { ip: '198.51.100.1', userAgent: 'jest' })).rejects.toMatchObject({
      ...cooldown,
      response: { code: ERROR_CODES.LOGIN_COOLDOWN, details: { retryAfterSec: LOGIN_COOLDOWN_SEC } },
    });
    await Promise.resolve();
    expect(mail.send).toHaveBeenCalledTimes(1);
    const [to, subject, html, opts] = mail.send.mock.calls[0];
    expect(to).toBe('ana@demo.ro');
    expect(subject).toBe('Încercări de autentificare nereușite — Cozy Home');
    expect(html).toContain('http://localhost:3000/ro/forgot-password');
    expect(html).toContain('Ana &lt;b&gt;Popescu&lt;/b&gt;');
    expect(html).not.toContain('îl poți ignora');
    expect(opts).toEqual({ replyToSupport: true });
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_COOLDOWN_STARTED', entityType: 'user', entityId: 'u1', ip: '198.51.100.1' }),
    );

    // a 11-a incercare: blocata inainte de orice numarare, fara al doilea email
    const locked = service.assertNotLocked('ANA@demo.ro ');
    await expect(locked).rejects.toMatchObject(cooldown);
    await locked.catch((e: { getResponse: () => { details: { retryAfterSec: number } } }) =>
      expect(e.getResponse().details.retryAfterSec).toBeGreaterThan(LOGIN_COOLDOWN_SEC - 5),
    );
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('locks ADMIN accounts after 5 failures', async () => {
    const { service } = setup();
    const admin = makeUser({ role: 'ADMIN', email: 'admin@demo.ro' });
    await failTimes(service, 'admin@demo.ro', admin, 4);
    await expect(service.recordFailure('admin@demo.ro', admin)).rejects.toMatchObject(cooldown);
    await expect(service.assertNotLocked('admin@demo.ro')).rejects.toMatchObject(cooldown);
  });

  it('locks an unknown email at 10 without email or audit (same response)', async () => {
    const { service, mail, audit } = setup();
    await failTimes(service, 'ghost@example.invalid', null, 9);
    await expect(service.recordFailure('ghost@example.invalid', null)).rejects.toMatchObject(cooldown);
    await expect(service.assertNotLocked('ghost@example.invalid')).rejects.toMatchObject(cooldown);
    expect(mail.send).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('clear() resets the counter; clear with includeLock lifts the cooldown', async () => {
    const { service } = setup();
    const user = makeUser();
    await failTimes(service, 'ana@demo.ro', user, 9);
    await service.clear('ana@demo.ro');
    await failTimes(service, 'ana@demo.ro', user, 9);
    await expect(service.assertNotLocked('ana@demo.ro')).resolves.toBeUndefined();

    await expect(service.recordFailure('ana@demo.ro', user)).rejects.toMatchObject(cooldown);
    await service.clear('ana@demo.ro', { includeLock: true });
    await expect(service.assertNotLocked('ana@demo.ro')).resolves.toBeUndefined();
  });

  it('fails open when Redis errors', async () => {
    const { service, redis } = setup();
    redis.pttl.mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(service.assertNotLocked('ana@demo.ro')).resolves.toBeUndefined();
    redis.multi.mockImplementationOnce(() => {
      throw new Error('ECONNRESET');
    });
    await expect(service.recordFailure('ana@demo.ro', makeUser())).resolves.toBeUndefined();
  });

  it('never puts the raw email in Redis keys', async () => {
    const { service, redis } = setup();
    await failTimes(service, 'Ana@Demo.ro', makeUser(), 10).catch(() => undefined);
    await service.assertNotLocked('ana@demo.ro').catch(() => undefined);
    const keys = [...redis.store.keys(), ...redis.pttl.mock.calls.map((c) => c[0] as string)];
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key).toMatch(/^login-(fail|lock):[0-9a-f]{64}$/);
      expect(key.toLowerCase()).not.toContain('ana');
    }
  });
});
