import { validateConfig } from './config.schema';

const required = {
  NODE_ENV: 'test',
  FRONTEND_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'access',
  S3_SECRET_KEY: 'secret',
  S3_BUCKET: 'uploads',
  S3_REGION: 'us-east-1',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  MAIL_FROM: 'no-reply@example.com',
  JWT_ACCESS_SECRET: 'access-secret-long-enough',
  JWT_REFRESH_SECRET: 'refresh-secret-long-enough',
  IP_HASH_SALT: 'hash-salt',
};

const prodBase = {
  ...required,
  NODE_ENV: 'production',
  MESSAGE_ENCRYPTION_KEY: 'a'.repeat(64),
  SMTP_HOST: 'smtp-relay.brevo.com',
  SMTP_PORT: '587',
  SMTP_USER: 'u',
  SMTP_PASS: 'p',
  MAIL_FROM: '"Cozy Home" <notificari@cozyhome.ro>',
  SUPPORT_EMAIL: 'suport@cozyhome.ro',
};

describe('blue-green deployment config', () => {
  it('keeps existing deployments active with migrations by default', () => {
    const config = validateConfig(required);
    expect(config.DEPLOYMENT_MODE).toBe('active');
    expect(config.RUN_MIGRATIONS).toBe(true);
  });

  it('accepts a read-only standby that cannot migrate', () => {
    const config = validateConfig({
      ...required,
      DEPLOYMENT_MODE: 'standby',
      DEPLOYMENT_SLOT: 'green',
      RUN_MIGRATIONS: 'false',
    });
    expect(config).toMatchObject({
      DEPLOYMENT_MODE: 'standby',
      DEPLOYMENT_SLOT: 'green',
      RUN_MIGRATIONS: false,
    });
  });

  it('normalizes an explicit preview-origin allowlist', () => {
    const config = validateConfig({
      ...required,
      FRONTEND_PREVIEW_ORIGINS: 'https://blue.example.com/, https://green.example.com',
    });
    expect(config.FRONTEND_PREVIEW_ORIGINS).toEqual([
      'https://blue.example.com',
      'https://green.example.com',
    ]);
  });

  it('rejects a standby configured to run migrations', () => {
    expect(() => validateConfig({
      ...required,
      DEPLOYMENT_MODE: 'standby',
      RUN_MIGRATIONS: 'true',
    })).toThrow('must be false while DEPLOYMENT_MODE=standby');
  });
});

describe('production mail guard', () => {
  it('accepts a real authenticated provider with a branded sender and a support mailbox', () => {
    const config = validateConfig(prodBase);
    expect(config.SUPPORT_EMAIL).toBe('suport@cozyhome.ro');
  });

  it.each([
    ['mailpit.railway.internal'],
    ['green-mail.railway.internal'],
    ['mailpit'],
    ['127.0.0.1'],
    ['[::1]'],
    ['smtp.cozy.local'],
  ])('rejects the capture/dev SMTP host %s', (host) => {
    expect(() => validateConfig({ ...prodBase, SMTP_HOST: host })).toThrow(/SMTP_HOST/);
  });

  it('rejects the Mailpit capture port', () => {
    expect(() => validateConfig({ ...prodBase, SMTP_PORT: '1025' })).toThrow(/SMTP_PORT: port de captura/);
  });

  it('rejects unauthenticated SMTP', () => {
    const { SMTP_PASS: _omit, ...rest } = prodBase;
    expect(() => validateConfig(rest)).toThrow(/SMTP_USER: SMTP autentificat obligatoriu/);
  });

  it('rejects a MAIL_FROM without display name', () => {
    expect(() => validateConfig({ ...prodBase, MAIL_FROM: 'no-reply@cozyhome.ro' })).toThrow(/MAIL_FROM/);
  });

  it('rejects a MAIL_FROM on a reserved domain', () => {
    expect(() => validateConfig({ ...prodBase, MAIL_FROM: '"Cozy Home" <x@cozy-fable.local>' })).toThrow(/MAIL_FROM/);
  });

  it('rejects a missing SUPPORT_EMAIL', () => {
    const { SUPPORT_EMAIL: _omit, ...rest } = prodBase;
    expect(() => validateConfig(rest)).toThrow(/SUPPORT_EMAIL: obligatoriu in productie/);
  });

  it('rejects a no-reply SUPPORT_EMAIL', () => {
    expect(() => validateConfig({ ...prodBase, SUPPORT_EMAIL: 'no-reply@cozyhome.ro' })).toThrow(/SUPPORT_EMAIL/);
  });

  it('keeps the explicit escape hatch for the local prod-like compose stack', () => {
    const { SMTP_USER: _u, SMTP_PASS: _p, SUPPORT_EMAIL: _s, ...rest } = prodBase;
    expect(() =>
      validateConfig({
        ...rest,
        SMTP_HOST: 'mailpit',
        SMTP_PORT: '1025',
        MAIL_FROM: 'no-reply@cozyhome.local',
        SMTP_ALLOW_DEV_HOST: 'true',
      }),
    ).not.toThrow();
  });

  it('treats an empty SUPPORT_EMAIL as absent outside production', () => {
    const config = validateConfig({ ...required, SUPPORT_EMAIL: '' });
    expect(config.SUPPORT_EMAIL).toBeUndefined();
  });
});

// E-admin-platform-4 — productia nu accepta chei Stripe de test fara supapa explicita.
describe('production Stripe key guard', () => {
  const stripe = { STRIPE_WEBHOOK_SECRET: 'whsec_x' };

  it('rejects a test secret key in production', () => {
    expect(() => validateConfig({ ...prodBase, ...stripe, STRIPE_SECRET_KEY: 'sk_test_x' })).toThrow(/STRIPE_SECRET_KEY: cheie Stripe de test in productie/);
  });

  it('accepts a test key in production only with STRIPE_ALLOW_TEST_MODE=true', () => {
    const config = validateConfig({ ...prodBase, ...stripe, STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_ALLOW_TEST_MODE: 'true' });
    expect(config.STRIPE_ALLOW_TEST_MODE).toBe(true);
  });

  it('accepts a live key in production', () => {
    expect(() => validateConfig({ ...prodBase, ...stripe, STRIPE_SECRET_KEY: 'sk_live_x' })).not.toThrow();
    expect(() => validateConfig({ ...prodBase, ...stripe, STRIPE_SECRET_KEY: 'rk_live_x' })).not.toThrow();
  });

  it('accepts a test key outside production', () => {
    const config = validateConfig({ ...required, NODE_ENV: 'development', ...stripe, STRIPE_SECRET_KEY: 'sk_test_x' });
    expect(config.STRIPE_ALLOW_TEST_MODE).toBe(false);
  });

  it('rejects an unknown key format', () => {
    expect(() => validateConfig({ ...required, ...stripe, STRIPE_SECRET_KEY: 'foo' })).toThrow(/STRIPE_SECRET_KEY: format necunoscut/);
  });
});

describe('observability config (E-admin-platform-8)', () => {
  it('defaults LOG_LEVEL to info and leaves the tracker disabled', () => {
    const config = validateConfig(required);
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.SENTRY_DSN).toBeUndefined();
  });

  it('rejects an invalid LOG_LEVEL', () => {
    expect(() => validateConfig({ ...required, LOG_LEVEL: 'verbose' })).toThrow(/LOG_LEVEL/);
  });

  it('turns an empty SENTRY_DSN into undefined and rejects a non-URL DSN', () => {
    expect(validateConfig({ ...required, SENTRY_DSN: '  ' }).SENTRY_DSN).toBeUndefined();
    expect(() => validateConfig({ ...required, SENTRY_DSN: 'not a url' })).toThrow(/SENTRY_DSN/);
  });
});

describe('client IP and throttler config (E-admin-platform-5)', () => {
  it('defaults THROTTLER_STORE to redis and leaves the trusted header unset', () => {
    const config = validateConfig(required);
    expect(config.THROTTLER_STORE).toBe('redis');
    expect(config.TRUSTED_CLIENT_IP_HEADER).toBeUndefined();
  });

  it('treats an empty TRUSTED_CLIENT_IP_HEADER as unset and lowercases a real one', () => {
    expect(validateConfig({ ...required, TRUSTED_CLIENT_IP_HEADER: '  ' }).TRUSTED_CLIENT_IP_HEADER).toBeUndefined();
    expect(validateConfig({ ...required, TRUSTED_CLIENT_IP_HEADER: 'X-Real-IP' }).TRUSTED_CLIENT_IP_HEADER).toBe('x-real-ip');
  });

  it('rejects x-forwarded-for as the trusted header', () => {
    expect(() => validateConfig({ ...required, TRUSTED_CLIENT_IP_HEADER: 'X-Forwarded-For' })).toThrow(
      /TRUSTED_CLIENT_IP_HEADER: req.ip already handles X-Forwarded-For/,
    );
  });

  it('rejects a malformed header name and an unknown store', () => {
    expect(() => validateConfig({ ...required, TRUSTED_CLIENT_IP_HEADER: 'x real ip' })).toThrow(/TRUSTED_CLIENT_IP_HEADER/);
    expect(() => validateConfig({ ...required, THROTTLER_STORE: 'postgres' })).toThrow(/THROTTLER_STORE/);
  });

  it('accepts THROTTLER_STORE=memory', () => {
    expect(validateConfig({ ...required, THROTTLER_STORE: 'memory' }).THROTTLER_STORE).toBe('memory');
  });
});

describe('health details token and listen host (E-admin-platform-56)', () => {
  it('treats an empty HEALTH_DETAILS_TOKEN as unset', () => {
    expect(validateConfig({ ...required, HEALTH_DETAILS_TOKEN: '' }).HEALTH_DETAILS_TOKEN).toBeUndefined();
    expect(validateConfig(required).HEALTH_DETAILS_TOKEN).toBeUndefined();
  });

  it('rejects a short token and accepts 32 characters', () => {
    expect(() => validateConfig({ ...required, HEALTH_DETAILS_TOKEN: 'short' })).toThrow(/HEALTH_DETAILS_TOKEN/);
    const token = 'x'.repeat(32);
    expect(validateConfig({ ...required, HEALTH_DETAILS_TOKEN: token }).HEALTH_DETAILS_TOKEN).toBe(token);
  });

  it('keeps the token optional in production', () => {
    expect(validateConfig(prodBase).HEALTH_DETAILS_TOKEN).toBeUndefined();
  });

  it('accepts an IP LISTEN_HOST, rejects a hostname and allows it unset', () => {
    expect(validateConfig({ ...required, LISTEN_HOST: '127.0.0.1' }).LISTEN_HOST).toBe('127.0.0.1');
    expect(() => validateConfig({ ...required, LISTEN_HOST: 'localhost' })).toThrow(/LISTEN_HOST/);
    expect(validateConfig(required).LISTEN_HOST).toBeUndefined();
    expect(validateConfig({ ...required, LISTEN_HOST: '' }).LISTEN_HOST).toBeUndefined();
  });
});
