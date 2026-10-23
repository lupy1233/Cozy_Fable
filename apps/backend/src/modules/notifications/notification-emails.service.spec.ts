import { NotificationEmailsService } from './notification-emails.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { MailService } from '../../infra/mail/mail.service';
import type { ConfigService } from '@nestjs/config';
import type { BillingDocumentsService, BillingEmailExtras } from '../billing/billing-documents.service';

// Q4 (idee 5 PO r2): selectia destinatarilor + dezabonarea semnata HMAC.

const CONFIG: Record<string, string> = {
  JWT_ACCESS_SECRET: 'test-secret-atleast-16-chars',
  FRONTEND_ORIGIN: 'http://localhost:3000',
};

// members: userId (rol implicit OWNER) sau { userId, role, email }; mock-ul aplica filtrul de rol
// din `where` ca sa verifice ca rutarea cere doar OWNER/MANAGER la evenimentele de facturare.
type MemberRow = { userId: string; role: string; email: string };
function makeService(
  users: Array<Record<string, unknown>> = [],
  members: Array<string | Partial<MemberRow>> = [],
  extras: BillingEmailExtras | null = null,
) {
  const rows: MemberRow[] = members.map((m) =>
    typeof m === 'string'
      ? { userId: m, role: 'OWNER', email: `${m}@demo.ro` }
      : { userId: m.userId ?? 'x', role: m.role ?? 'OWNER', email: m.email ?? `${m.userId}@demo.ro` },
  );
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue(users),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue(undefined),
      findUnique: jest.fn().mockResolvedValue({ emailNotificationsEnabled: true }),
    },
    companyMember: {
      findMany: jest.fn(async ({ where }: { where?: { role?: { in?: string[] } } } = {}) =>
        rows
          .filter((r) => !where?.role?.in || where.role.in.includes(r.role))
          .map((r) => ({ userId: r.userId, role: r.role, user: { email: r.email } })),
      ),
    },
    domainEventOutbox: {
      findUnique: jest.fn().mockResolvedValue({ billingContactEmailedAt: null }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    company: {
      findUnique: jest.fn().mockResolvedValue({ name: 'A Mobila Premium', billingEmail: 'contabil@firma-a.ro' }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const billingDocs = { prepare: jest.fn().mockResolvedValue(extras) };
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
    billingDocs as unknown as BillingDocumentsService,
  );
  return { service, prisma, mail, billingDocs };
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

  // --- L1 (audit 2026-08-23): evenimente noi + escape + terminologie ---

  it('quote.accepted → email DOAR membrilor firmei castigatoare (identificata prin companyId)', async () => {
    const { service, prisma } = makeService(
      [{ id: 'm1', email: 'firma@demo.ro', name: 'Ana', languagePreference: 'RO' }],
      ['m1', 'm2'],
    );
    await service.sendForEvent('quote.accepted', ['u-client', 'm1', 'm2', 'alt-participant'], {
      companyId: 'c1',
      clientUserId: 'u-client',
      requestTitle: 'Dressing Iasi',
      companyName: 'B DesignWood',
      requestId: 'r1',
      claimSlotId: 'slot1',
    });
    expect(prisma.companyMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1' } }),
    );
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['m1', 'm2'] } }),
      }),
    );
  });

  it('claim.withdrawn cu SLA_EXPIRED trimite email; retragerea voluntara NU (doar clopotel)', async () => {
    const member = { id: 'm1', email: 'firma@demo.ro', name: 'Ana', languagePreference: 'RO' };
    const { service, mail } = makeService([member]);
    await service.sendForEvent('claim.withdrawn', ['m1'], {
      reason: 'SLA_EXPIRED',
      requestTitle: 'Dressing Iasi',
      requestId: 'r1',
      claimSlotId: 'slot1',
    });
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][1]).toContain('Termenul de ofertare');

    mail.send.mockClear();
    await service.sendForEvent('claim.withdrawn', ['m1'], {
      reason: 'VOLUNTARY_NO_REASON',
      requestId: 'r1',
    });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('valorile interpolate sunt escapate (anti HTML-injection) si terminologia e "firma"', async () => {
    const { service, mail } = makeService([radu]);
    await service.sendForEvent('quote.created', ['u-client'], {
      clientUserId: 'u-client',
      requestTitle: '<img src=x onerror=alert(1)>',
      companyName: '<b>Evil</b> & Co',
      requestId: 'r1',
    });
    const [, , html] = mail.send.mock.calls[0];
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;b&gt;Evil&lt;/b&gt; &amp; Co');
    expect(html).toContain('Firma');
    expect(html).not.toMatch(/atelier/i);
  });

  it('company.approved / delivery.marked / payment.confirmed au template si pleaca spre tinte', async () => {
    const member = { id: 'm1', email: 'firma@demo.ro', name: 'Ana', languagePreference: 'RO' };
    const { service, mail } = makeService([member], ['m1']);
    await service.sendForEvent('company.approved', ['m1'], { companyId: 'c1', companyName: 'B DesignWood' });
    await service.sendForEvent('payment.confirmed', ['m1'], {
      companyId: 'c1',
      orderType: 'SUBSCRIPTION',
      invoiceSeries: 'MM',
      invoiceNumber: 42,
    });
    const { service: s2, mail: mail2 } = makeService([radu]);
    await s2.sendForEvent('delivery.marked', ['u-client'], {
      clientUserId: 'u-client',
      requestTitle: 'Dressing Iasi',
      companyName: 'B DesignWood',
      requestId: 'r1',
    });
    expect(mail.send).toHaveBeenCalledTimes(2);
    expect(mail.send.mock.calls[0][1]).toContain('aprobată');
    expect(mail.send.mock.calls[1][2]).toContain('MM-42');
    expect(mail2.send).toHaveBeenCalledTimes(1);
    expect(mail2.send.mock.calls[0][2]).toContain('/ro/requests/r1/offers');
  });

  it('company.suspended: data suspendarii in Europe/Bucharest (23:30 UTC = ziua urmatoare)', async () => {
    const member = { id: 'm1', email: 'firma@demo.ro', name: 'Ana', languagePreference: 'RO' };
    const { service, mail } = makeService([member]);
    await service.sendForEvent('company.suspended', ['m1'], {
      companyId: 'c1',
      companyName: 'B DesignWood',
      suspendedUntil: '2026-03-01T23:30:00.000Z',
    });
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][2]).toContain('02.03.2026');
    expect(mail.send.mock.calls[0][2]).not.toContain('01.03.2026');
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

// E-admin-platform-3: evenimente noi — destinatari, texte cu decontarea corecta, "firma".
describe('evenimente E-admin-platform-3', () => {
  const member = { id: 'm1', email: 'firma@demo.ro', name: 'Ana', languagePreference: 'RO' };

  it('quote.expired → email DOAR clientului (firma are doar clopotel), cu data inchiderii automate', async () => {
    const { service, prisma, mail } = makeService([radu]);
    await service.sendForEvent('quote.expired', ['m1', 'u-client'], {
      clientUserId: 'u-client',
      requestId: 'r1',
      requestTitle: 'Dressing Iasi',
      companyName: 'B DesignWood',
      autoCloseAt: '2026-10-20T10:00:00.000Z',
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ['u-client'] } }) }),
    );
    const [, subject, html] = mail.send.mock.calls[0];
    expect(subject).toContain('O ofertă a expirat');
    expect(html).toContain('prelungească');
    expect(html).toContain('20.10.2026');
    expect(html).toContain('/ro/requests/r1/offers');
    expect(html).not.toMatch(/atelier/i);
  });

  it('claim.withdrawn PROJECT_CANCELLED / OFFER_EXPIRED_UNDECIDED → email cu textul decontarii', async () => {
    const { service, mail } = makeService([member]);
    await service.sendForEvent('claim.withdrawn', ['m1'], {
      reason: 'PROJECT_CANCELLED',
      refunded: true,
      requestTitle: 'Dressing Iasi',
      requestId: 'r1',
      claimSlotId: 'slot1',
    });
    await service.sendForEvent('claim.withdrawn', ['m1'], {
      reason: 'OFFER_EXPIRED_UNDECIDED',
      refunded: false,
      requestTitle: 'Dressing Iasi',
      requestId: 'r1',
      claimSlotId: 'slot1',
    });
    expect(mail.send).toHaveBeenCalledTimes(2);
    expect(mail.send.mock.calls[0][1]).toContain('Proiectul a fost anulat');
    expect(mail.send.mock.calls[0][2]).toContain('returnate');
    expect(mail.send.mock.calls[0][2]).toContain('/ro/marketplace/claims/slot1');
    expect(mail.send.mock.calls[1][2]).toContain('s-au consumat');
  });

  it('project.case_opened de la client → email doar membrilor firmei (nu adminilor)', async () => {
    const { service, prisma } = makeService([member], ['m1']);
    await service.sendForEvent('project.case_opened', ['m1', 'admin1'], {
      openedBy: 'CLIENT',
      companyId: 'c1',
      clientUserId: 'u-client',
      requestId: 'r1',
      claimSlotId: 'slot1',
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ['m1'] } }) }),
    );
  });

  it('project.overdue → link diferit pentru client si pentru firma, data afisata', async () => {
    const { service, mail } = makeService([radu, member]);
    await service.sendForEvent('project.overdue', ['u-client', 'm1'], {
      clientUserId: 'u-client',
      requestId: 'r1',
      claimSlotId: 'slot1',
      deliveryDate: '2026-10-05',
      requestTitle: 'Dressing Iasi',
    });
    expect(mail.send).toHaveBeenCalledTimes(2);
    const byTo = Object.fromEntries(mail.send.mock.calls.map((c: unknown[]) => [c[0], String(c[2])]));
    expect(byTo['radu@demo.ro']).toContain('/ro/requests/r1/offers');
    expect(byTo['firma@demo.ro']).toContain('/ro/marketplace/claims/slot1');
    expect(byTo['radu@demo.ro']).toContain('05.10.2026');
  });
});

// E-admin-platform-1: Reply-To spre suport doar pe emailurile de cont/facturare + linia de suport.
describe('Reply-To suport si subsol', () => {
  it('payment.confirmed cere Reply-To suport; message.created nu', async () => {
    const member = { id: 'm1', email: 'firma@demo.ro', name: 'Ana', languagePreference: 'RO' };
    const { service, mail } = makeService([member], ['m1']);
    await service.sendForEvent('payment.confirmed', ['m1'], {
      companyId: 'c1',
      orderType: 'SUBSCRIPTION',
      invoiceSeries: 'MM',
      invoiceNumber: 42,
    });
    expect(mail.send.mock.calls[0][3]).toEqual({ replyToSupport: true });

    const { service: s2, mail: mail2 } = makeService([radu]);
    await s2.sendForEvent('message.created', ['m1', 'u-client'], {
      senderUserId: 'm1',
      senderRole: 'COMPANY',
      clientUserId: 'u-client',
      requestId: 'r1',
    });
    expect(mail2.send).toHaveBeenCalledTimes(1);
    expect(mail2.send.mock.calls[0][3]).toEqual({ replyToSupport: false });
  });

  it('subsolul contine adresa de suport cand SUPPORT_EMAIL e setat, si lipseste altfel', async () => {
    const { service, mail } = makeService([radu]);
    mail.supportEmail = 'suport@cozyhome.ro';
    await service.sendForEvent('quote.created', ['u-client'], { clientUserId: 'u-client', requestId: 'r1' });
    const html = mail.send.mock.calls[0][2] as string;
    expect(html).toContain('Ai nevoie de ajutor? Scrie-ne la');
    expect(html).toContain('href="mailto:suport@cozyhome.ro"');

    const { service: s2, mail: mail2 } = makeService([radu]);
    await s2.sendForEvent('quote.created', ['u-client'], { clientUserId: 'u-client', requestId: 'r1' });
    expect(mail2.send.mock.calls[0][2]).not.toContain('mailto:');
  });
});

// E-admin-platform-44 — termene apropiate: reminder cerere, warning atribuire, SLA 24h.
describe('evenimente E-admin-platform-44', () => {
  const owner = { id: 'm1', email: 'firma@demo.ro', name: 'Ana', languagePreference: 'RO' };
  const ownerEn = { id: 'm2', email: 'firm@demo.ro', name: 'John', languagePreference: 'EN' };
  const raduEn = { ...radu, languagePreference: 'EN' };

  it('request.expiry_reminder → email clientului, RO si EN, cu link spre cerere', async () => {
    const { service, mail } = makeService([radu]);
    await service.sendForEvent('request.expiry_reminder', ['u-client'], {
      requestId: 'r1',
      requestTitle: 'Dressing Iasi',
      expiresAt: '2026-10-12T20:59:59.999Z',
      clientUserId: 'u-client',
    });
    const [to, subject, html] = mail.send.mock.calls[0];
    expect(to).toBe('radu@demo.ro');
    expect(subject).toBe('Cererea ta expiră curând — Dressing Iasi');
    expect(html).toContain('Nicio firmă nu a preluat');
    expect(html).toContain('/ro/requests/r1');
    expect(html).not.toMatch(/atelier/i);

    const en = makeService([raduEn]);
    await en.service.sendForEvent('request.expiry_reminder', ['u-client'], {
      requestId: 'r1', requestTitle: 'Dressing Iasi', expiresAt: '2026-10-12T20:59:59.999Z', clientUserId: 'u-client',
    });
    expect(en.mail.send.mock.calls[0][1]).toBe('Your request expires soon — Dressing Iasi');
    expect(en.mail.send.mock.calls[0][2]).toContain('/en/requests/r1');
  });

  it('claim.assign_warning → email tintelor (OWNER/MANAGER), link spre fisa preluarii', async () => {
    const { service, mail } = makeService([owner, ownerEn]);
    await service.sendForEvent('claim.assign_warning', ['m1', 'm2'], {
      claimSlotId: 'slot1',
      requestId: 'r1',
      requestTitle: 'Dressing Iasi',
      assignDeadlineAt: '2026-10-05T09:00:00.000Z',
    });
    expect(mail.send).toHaveBeenCalledTimes(2);
    const byTo = Object.fromEntries(mail.send.mock.calls.map((c: unknown[]) => [c[0], c]));
    expect(byTo['firma@demo.ro'][1]).toBe('Atribuie preluarea — Dressing Iasi');
    expect(byTo['firma@demo.ro'][2]).toContain('/ro/marketplace/claims/slot1');
    expect(byTo['firma@demo.ro'][2]).toContain('se anulează automat');
    expect(byTo['firm@demo.ro'][1]).toBe('Assign the claim — Dressing Iasi');
    expect(byTo['firm@demo.ro'][2]).toContain('/en/marketplace/claims/slot1');
  });

  it('sla.expiring_soon → email tintelor RO/EN; titlul HTML e escapat', async () => {
    const { service, mail } = makeService([owner, ownerEn]);
    await service.sendForEvent('sla.expiring_soon', ['m1', 'm2'], {
      claimSlotId: 'slot1',
      requestId: 'r1',
      requestTitle: '<script>x</script>',
      slaDeadlineAt: '2026-10-08T20:59:59.999Z',
    });
    expect(mail.send).toHaveBeenCalledTimes(2);
    const byTo = Object.fromEntries(mail.send.mock.calls.map((c: unknown[]) => [c[0], c]));
    expect(byTo['firma@demo.ro'][1]).toContain('Termenul ofertei se apropie');
    expect(byTo['firm@demo.ro'][1]).toContain('Your offer deadline is close');
    for (const call of mail.send.mock.calls) {
      expect(String(call[2])).not.toContain('<script>');
      expect(String(call[2])).toContain('&lt;script&gt;');
      expect(String(call[2])).not.toMatch(/atelier/i);
    }
    expect(byTo['firma@demo.ro'][2]).toContain('puncte de penalizare');
  });

  // E-company-13 — reminderul de la inceputul gratiei
  it('sla.expiring_soon GRACE → subiect RO/EN, data penalizarii, titlu escapat, fara "atelier"', async () => {
    const { service, mail } = makeService([owner, ownerEn]);
    await service.sendForEvent('sla.expiring_soon', ['m1', 'm2'], {
      claimSlotId: 'slot1',
      requestId: 'r1',
      requestTitle: '<b>Dressing</b>',
      slaDeadlineAt: '2026-10-08T09:00:00.000Z',
      slaBreachAt: '2026-10-08T21:00:00.000Z',
      phase: 'GRACE',
    });
    expect(mail.send).toHaveBeenCalledTimes(2);
    const byTo = Object.fromEntries(mail.send.mock.calls.map((c: unknown[]) => [c[0], c]));
    expect(byTo['firma@demo.ro'][1]).toContain('Termenul ofertei a trecut');
    expect(byTo['firm@demo.ro'][1]).toContain('Your offer deadline has passed');
    // 21:00Z = 00:00 ora Bucurestiului (9 oct)
    const breachRo = new Date('2026-10-08T21:00:00.000Z').toLocaleString('ro-RO', {
      timeZone: 'Europe/Bucharest', dateStyle: 'medium', timeStyle: 'short',
    });
    const breachEn = new Date('2026-10-08T21:00:00.000Z').toLocaleString('en-GB', {
      timeZone: 'Europe/Bucharest', dateStyle: 'medium', timeStyle: 'short',
    });
    expect(byTo['firma@demo.ro'][2]).toContain(breachRo);
    expect(byTo['firma@demo.ro'][2]).toContain('perioada de grație');
    expect(byTo['firma@demo.ro'][2]).toContain('Trimite oferta acum');
    expect(byTo['firma@demo.ro'][2]).toContain('/ro/marketplace/claims/slot1');
    expect(byTo['firm@demo.ro'][2]).toContain(breachEn);
    expect(byTo['firm@demo.ro'][2]).toContain('Send the offer now');
    for (const call of mail.send.mock.calls) {
      expect(String(call[2])).not.toContain('<b>Dressing</b>');
      expect(String(call[2])).toContain('&lt;b&gt;Dressing&lt;/b&gt;');
      expect(String(call[2])).not.toMatch(/atelier/i);
    }
  });
});

// E-company-24: facturarea ajunge doar la OWNER/MANAGER; transfer bancar cu IBAN + proforma
// atasata; copia pentru emailul de facturare al firmei (contabil) o singura data.
describe('evenimente de facturare E-company-24', () => {
  const owner = { id: 'own', email: 'owner@demo.ro', name: 'Ana', languagePreference: 'RO' };
  const employee = { id: 'emp', email: 'emp@demo.ro', name: 'Ion', languagePreference: 'RO' };
  const members = [
    { userId: 'own', role: 'OWNER', email: 'owner@demo.ro' },
    { userId: 'mgr', role: 'MANAGER', email: 'mgr@demo.ro' },
    { userId: 'emp', role: 'EMPLOYEE_TRUSTED', email: 'emp@demo.ro' },
  ];
  const pdf = { filename: 'proforma-ABCD1234.pdf', content: Buffer.from('%PDF'), contentType: 'application/pdf' as const };
  const extras = (over: Partial<BillingEmailExtras> = {}): BillingEmailExtras => ({
    orderRef: 'ABCD1234',
    totalRon: 1210,
    orderType: 'CREDIT_PACKAGE',
    transfer: { sellerName: 'Platforma <SRL>', cui: 'RO12345674', iban: 'RO08TEST0000000000000001' },
    cancelAt: null,
    attachment: pdf,
    ...over,
  });

  it.each(['payment.confirmed', 'subscription.expiring'])('%s: angajatul (EMPLOYEE_*) nu primeste email', async (type) => {
    const { service, prisma } = makeService([owner], members);
    await service.sendForEvent(type, ['own', 'emp'], { companyId: 'c1', orderType: 'CREDIT_PACKAGE', daysLeft: 3 });
    expect(prisma.companyMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1', role: { in: ['OWNER', 'MANAGER'] } }) }),
    );
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ['own'] } }) }),
    );
    const onlyEmployee = makeService([employee], members);
    await onlyEmployee.service.sendForEvent(type, ['emp'], { companyId: 'c1', daysLeft: 3 });
    expect(onlyEmployee.prisma.user.findMany).not.toHaveBeenCalled();
    expect(onlyEmployee.mail.send).not.toHaveBeenCalled();
  });

  it('payment.transfer_instructions: IBAN + suma + referinta escapate, proforma atasata, Reply-To suport', async () => {
    const { service, mail, billingDocs } = makeService([owner], members, extras());
    const payload = { orderId: 'o1', companyId: 'c1', orderType: 'CREDIT_PACKAGE' };
    await service.sendForEvent('payment.transfer_instructions', ['own'], payload);
    expect(billingDocs.prepare).toHaveBeenCalledWith('payment.transfer_instructions', payload);
    expect(mail.send).toHaveBeenCalledTimes(1);
    const [to, subject, html, opts] = mail.send.mock.calls[0];
    expect(to).toBe('owner@demo.ro');
    expect(subject).toBe('Datele pentru plata prin transfer — comanda ABCD1234');
    expect(html).toContain('RO08TEST0000000000000001');
    expect(html).toContain('Platforma &lt;SRL&gt;');
    expect(html).not.toContain('Platforma <SRL>');
    expect(html).toContain('„Comanda ABCD1234”');
    expect(html).toContain(new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2 }).format(1210));
    expect(html).toContain('Factura proformă este atașată.');
    expect(html).toContain('/ro/marketplace/wallet');
    expect(html).not.toMatch(/atelier/i);
    expect(opts).toEqual({ replyToSupport: true, attachments: [pdf] });
  });

  it('payment.transfer_instructions fara date fiscale gata → trimite spre portofel, fara atasament', async () => {
    const { service, mail } = makeService([owner], members, extras({ transfer: null, attachment: null }));
    await service.sendForEvent('payment.transfer_instructions', ['own'], { orderId: 'o1', companyId: 'c1' });
    const [, , html, opts] = mail.send.mock.calls[0];
    expect(html).toContain('Datele bancare sunt în portofel.');
    expect(html).not.toContain('IBAN');
    expect(opts).toEqual({ replyToSupport: true });
  });

  it('payment.transfer_reminder (EN) cu termen de anulare; payment.auto_cancelled cu numarul de zile', async () => {
    const ownerEn = { ...owner, languagePreference: 'EN' };
    const { service, mail } = makeService([ownerEn], members, extras({ cancelAt: '2026-10-08T21:00:00.000Z' }));
    await service.sendForEvent('payment.transfer_reminder', ['own'], { orderId: 'o1', companyId: 'c1', cancelAt: '2026-10-08T21:00:00.000Z' });
    const [, subject, html] = mail.send.mock.calls[0];
    expect(subject).toBe('Order ABCD1234 is awaiting payment');
    expect(html).toContain('the order is cancelled automatically');
    expect(html).toContain('in your wallet');

    const ro = makeService([owner], members, extras({ attachment: null }));
    await ro.service.sendForEvent('payment.auto_cancelled', ['own'], { orderId: 'o1', companyId: 'c1', expiryDays: 7 });
    const [, subjectRo, htmlRo] = ro.mail.send.mock.calls[0];
    expect(subjectRo).toBe('Comanda ABCD1234 a fost anulată — plata nu a ajuns');
    expect(htmlRo).toContain('Nu am primit plata în 7 zile');
    expect(htmlRo).toContain('Poți plasa oricând o comandă nouă din portofel.');
  });

  it('payment.confirmed cu factura atasata → textul spune "atașată"', async () => {
    const invoicePdf = { ...pdf, filename: 'factura-MM-42.pdf' };
    const { service, mail } = makeService([owner], members, extras({ attachment: invoicePdf }));
    await service.sendForEvent('payment.confirmed', ['own'], { orderId: 'o1', companyId: 'c1', orderType: 'CREDIT_PACKAGE', invoiceSeries: 'MM', invoiceNumber: 42 });
    const [, , html, opts] = mail.send.mock.calls[0];
    expect(html).toContain('factura <strong>MM-42</strong> este atașată acestui email');
    expect(opts.attachments).toEqual([invoicePdf]);
  });

  it('sendBillingContactCopy: trimite o data (fara dezabonare, fara buton) si marcheaza evenimentul', async () => {
    const { service, mail, prisma } = makeService([], members, extras());
    await service.sendBillingContactCopy('ev1', 'payment.transfer_instructions', { orderId: 'o1', companyId: 'c1' });
    expect(mail.send).toHaveBeenCalledTimes(1);
    const [to, subject, html, opts] = mail.send.mock.calls[0];
    expect(to).toBe('contabil@firma-a.ro');
    expect(subject).toContain('ABCD1234');
    expect(html).toContain('Bună ziua,');
    expect(html).toContain('v-a trecut ca adresă de facturare');
    expect(html).not.toContain('unsubscribe');
    expect(html).not.toContain('href="http');
    expect(opts).toEqual({ replyToSupport: true, attachments: [pdf] });
    expect(prisma.domainEventOutbox.updateMany).toHaveBeenCalledWith({
      where: { id: 'ev1', billingContactEmailedAt: null },
      data: { billingContactEmailedAt: expect.any(Date) },
    });

    // deja trimisa → nimic
    prisma.domainEventOutbox.findUnique.mockResolvedValueOnce({ billingContactEmailedAt: new Date() });
    await service.sendBillingContactCopy('ev1', 'payment.transfer_instructions', { orderId: 'o1', companyId: 'c1' });
    // evenimentele fara documente (reminder/anulare/abonament) nu ajung la contabil
    await service.sendBillingContactCopy('ev2', 'payment.transfer_reminder', { orderId: 'o1', companyId: 'c1' });
    await service.sendBillingContactCopy('ev3', 'subscription.expiring', { companyId: 'c1' });
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('sendBillingContactCopy: adresa = emailul unui OWNER/MANAGER (case-insensitive) → nu dubleaza; fara adresa → nimic', async () => {
    const { service, mail, prisma } = makeService([], members, extras());
    prisma.company.findUnique.mockResolvedValueOnce({ name: 'A', billingEmail: 'MGR@demo.ro' });
    await service.sendBillingContactCopy('ev1', 'payment.confirmed', { orderId: 'o1', companyId: 'c1' });
    prisma.company.findUnique.mockResolvedValueOnce({ name: 'A', billingEmail: null });
    await service.sendBillingContactCopy('ev1', 'payment.confirmed', { orderId: 'o1', companyId: 'c1' });
    expect(mail.send).not.toHaveBeenCalled();
    expect(prisma.domainEventOutbox.updateMany).not.toHaveBeenCalled();
  });

  it('sendBillingContactCopy payment.confirmed: factura atasata, fara trimitere spre portofel', async () => {
    const { service, mail } = makeService([], members, extras({ attachment: { ...pdf, filename: 'factura-MM-42.pdf' } }));
    await service.sendBillingContactCopy('ev9', 'payment.confirmed', { orderId: 'o1', companyId: 'c1', invoiceSeries: 'MM', invoiceNumber: 42 });
    const [, , html] = mail.send.mock.calls[0];
    expect(html).toContain('factura <strong>MM-42</strong> este atașată acestui email.');
    expect(html).not.toContain('portofel');
  });

  it('sendBillingContactCopy: esecul SMTP arunca si NU marcheaza (jobul se reincearca)', async () => {
    const { service, mail, prisma } = makeService([], members, extras());
    mail.send.mockRejectedValueOnce(new Error('smtp down'));
    await expect(
      service.sendBillingContactCopy('ev1', 'payment.confirmed', { orderId: 'o1', companyId: 'c1', invoiceSeries: 'MM', invoiceNumber: 42 }),
    ).rejects.toThrow('smtp down');
    expect(prisma.domainEventOutbox.updateMany).not.toHaveBeenCalled();
  });
});
