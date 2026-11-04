import { createTransport } from 'nodemailer';
import type { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

// E-admin-platform-1: Reply-To opt-in, STARTTLS impus in productie, verify fara mesaj brut.
describe('MailService', () => {
  const transport = { sendMail: jest.fn().mockResolvedValue(undefined), verify: jest.fn().mockResolvedValue(true) };
  const createTransportMock = createTransport as unknown as jest.Mock;

  const make = (overrides: Record<string, unknown> = {}) => {
    const env: Record<string, unknown> = {
      NODE_ENV: 'test',
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
      SMTP_SECURE: false,
      SMTP_ALLOW_DEV_HOST: false,
      MAIL_FROM: '"Cozy Home" <notificari@cozyhome.ro>',
      FRONTEND_ORIGIN: 'http://localhost:3000',
      ...overrides,
    };
    const config = {
      get: (key: string) => env[key],
      getOrThrow: (key: string) => {
        if (env[key] === undefined) throw new Error(`missing ${key}`);
        return env[key];
      },
    } as unknown as ConfigService;
    return new MailService(config);
  };

  beforeEach(() => {
    transport.sendMail.mockClear();
    transport.verify.mockReset().mockResolvedValue(true);
    createTransportMock.mockReset().mockReturnValue(transport);
  });

  it('seteaza replyTo doar cu replyToSupport si SUPPORT_EMAIL configurat', async () => {
    const svc = make({ SUPPORT_EMAIL: 'suport@cozyhome.ro' });
    await svc.send('a@x.ro', 's', '<p>x</p>', { replyToSupport: true });
    await svc.send('a@x.ro', 's', '<p>x</p>');
    expect(transport.sendMail.mock.calls[0][0]).toMatchObject({ replyTo: 'suport@cozyhome.ro', from: '"Cozy Home" <notificari@cozyhome.ro>' });
    expect(transport.sendMail.mock.calls[1][0]).not.toHaveProperty('replyTo');

    const noSupport = make();
    await noSupport.send('a@x.ro', 's', '<p>x</p>', { replyToSupport: true });
    expect(transport.sendMail.mock.calls[2][0]).not.toHaveProperty('replyTo');
    expect(noSupport.supportEmail).toBeNull();
    expect(noSupport.fromAddress).toBe('"Cozy Home" <notificari@cozyhome.ro>');
  });

  it('E-company-24: atasamentele trec neschimbate spre nodemailer; fara atasamente → fara cheie', async () => {
    const svc = make();
    const pdf = Buffer.from('%PDF-1.4 test');
    await svc.send('a@x.ro', 's', '<p>x</p>', {
      attachments: [{ filename: 'proforma-ABCD1234.pdf', content: pdf, contentType: 'application/pdf' }],
    });
    await svc.send('a@x.ro', 's', '<p>x</p>', { attachments: [] });
    expect(transport.sendMail.mock.calls[0][0].attachments).toEqual([
      { filename: 'proforma-ABCD1234.pdf', content: pdf, contentType: 'application/pdf' },
    ]);
    expect(transport.sendMail.mock.calls[1][0]).not.toHaveProperty('attachments');
  });

  it('impune STARTTLS in productie cand SMTP_SECURE=false, dar nu in dev sau cu supapa', () => {
    make({ NODE_ENV: 'production', SMTP_HOST: 'smtp-relay.brevo.com', SMTP_PORT: 587 });
    expect(createTransportMock.mock.calls[0][0]).toMatchObject({
      requireTLS: true,
      secure: false,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
    make({ NODE_ENV: 'production', SMTP_SECURE: true, SMTP_PORT: 465 });
    expect(createTransportMock.mock.calls[1][0]).toMatchObject({ requireTLS: false, secure: true });
    make({ NODE_ENV: 'production', SMTP_ALLOW_DEV_HOST: true });
    expect(createTransportMock.mock.calls[2][0]).toMatchObject({ requireTLS: false });
    make({ NODE_ENV: 'development' });
    expect(createTransportMock.mock.calls[3][0]).toMatchObject({ requireTLS: false });
  });

  it('verifyConnection intoarce doar clasificarea erorii, niciodata mesajul', async () => {
    const svc = make();
    transport.verify.mockRejectedValueOnce(
      Object.assign(new Error('secret user@x'), { code: 'EAUTH', responseCode: 535 }),
    );
    const res = await svc.verifyConnection();
    expect(res).toEqual({ ok: false, error: 'kind=Error code=EAUTH status=535' });
    expect(JSON.stringify(res)).not.toContain('secret');
    await expect(svc.verifyConnection()).resolves.toEqual({ ok: true, error: null });
  });

  it('nu verifica SMTP la boot in teste', () => {
    const svc = make();
    svc.onApplicationBootstrap();
    expect(transport.verify).not.toHaveBeenCalled();
  });
});
