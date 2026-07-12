import { NotificationEmailsService } from './notification-emails.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { MailService } from '../../infra/mail/mail.service';
import type { ConfigService } from '@nestjs/config';

// Q4 (idee 5 PO r2): selectia destinatarilor + dezabonarea semnata HMAC.

const CONFIG: Record<string, string> = {
  JWT_ACCESS_SECRET: 'test-secret-atleast-16-chars',
  FRONTEND_ORIGIN: 'http://localhost:3000',
};

function makeService(users: Array<Record<string, unknown>> = []) {
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue(users),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue(undefined),
      findUnique: jest.fn().mockResolvedValue({ emailNotificationsEnabled: true }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mail = { send: jest.fn().mockResolvedValue(undefined) } as any;
  const config = {
    getOrThrow: (key: string) => CONFIG[key],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const service = new NotificationEmailsService(
    prisma as PrismaService,
    mail as MailService,
    config as ConfigService,
  );
  return { service, prisma, mail };
}

const radu = { id: 'u-client', email: 'radu@demo.ro', name: 'Radu', languagePreference: 'RO' };

describe('semnatura de dezabonare', () => {
  it('sign/verify e valid pe acelasi userId si respinge semnaturi alterate', () => {
    const { service } = makeService();
    const sig = service.signUnsubscribe('u1');
    expect(service.verifyUnsubscribe('u1', sig)).toBe(true);
    expect(service.verifyUnsubscribe('u2', sig)).toBe(false);
    expect(service.verifyUnsubscribe('u1', sig.replace(/.$/, sig.endsWith('0') ? '1' : '0'))).toBe(
      false,
    );
  });

  it('unsubscribe cu semnatura gresita NU modifica preferinta', async () => {
    const { service, prisma } = makeService();
    await expect(service.unsubscribe('u1', 'a'.repeat(64))).resolves.toBe(false);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('unsubscribe valid dezactiveaza emailurile', async () => {
    const { service, prisma } = makeService();
    const sig = service.signUnsubscribe('u1');
    await expect(service.unsubscribe('u1', sig)).resolves.toBe(true);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { emailNotificationsEnabled: false },
    });
  });
});

describe('selectia destinatarilor (sendForEvent)', () => {
  it('claim.created → email DOAR clientului, nu si membrilor firmei', async () => {
    const { service, prisma } = makeService([radu]);
    await service.sendForEvent('claim.created', ['m1', 'm2', 'u-client'], {
      clientUserId: 'u-client',
      requestTitle: 'Dressing Iasi',
      companyName: 'B DesignWood',
      requestId: 'r1',
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['u-client'] },
          emailNotificationsEnabled: true,
        }),
      }),
    );
  });

  it('message.created de la firma → email doar clientului', async () => {
    const { service, prisma } = makeService([radu]);
    await service.sendForEvent('message.created', ['m1', 'u-client'], {
      senderUserId: 'm1',
      senderRole: 'COMPANY',
      clientUserId: 'u-client',
      requestTitle: 'Dressing Iasi',
      companyName: 'B DesignWood',
      requestId: 'r1',
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['u-client'] } }),
      }),
    );
  });

  it('message.created de la client → email membrilor firmei, fara expeditor', async () => {
    const { service, prisma } = makeService([]);
    await service.sendForEvent('message.created', ['m1', 'm2', 'u-client'], {
      senderUserId: 'u-client',
      senderRole: 'CLIENT',
      clientUserId: 'u-client',
      requestId: 'r1',
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['m1', 'm2'] } }),
      }),
    );
  });

  it('quote.updated NU trimite email (doar cele 3 evenimente aprobate)', async () => {
    const { service, prisma } = makeService([radu]);
    await service.sendForEvent('quote.updated', ['u-client'], { clientUserId: 'u-client' });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('emailul contine deep-link si link de dezabonare semnat; esecul SMTP nu arunca', async () => {
    const { service, mail } = makeService([radu]);
    await service.sendForEvent('quote.created', ['u-client'], {
      clientUserId: 'u-client',
      requestTitle: 'Dressing Iasi',
      companyName: 'B DesignWood',
      requestId: 'r1',
    });
    expect(mail.send).toHaveBeenCalledTimes(1);
    const [to, subject, html] = mail.send.mock.calls[0];
    expect(to).toBe('radu@demo.ro');
    expect(subject).toContain('Ofertă nouă');
    expect(html).toContain('/ro/requests/r1/offers');
    expect(html).toContain(`/ro/unsubscribe?uid=u-client&sig=${service.signUnsubscribe('u-client')}`);

    // esec SMTP → doar logat, nu propagat (altfel retry-ul dubleaza in-app)
    mail.send.mockRejectedValueOnce(new Error('smtp down'));
    await expect(
      service.sendForEvent('quote.created', ['u-client'], {
        clientUserId: 'u-client',
        requestId: 'r1',
      }),
    ).resolves.toBeUndefined();
  });
});
