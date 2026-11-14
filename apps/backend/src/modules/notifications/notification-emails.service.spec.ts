import { NotificationEmailsService, roNeedsDe } from './notification-emails.service';
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
  // g1: preluarea (responsabilul) citita de regula „cine din firma primeste e-mail”
  slot: { assignedToUserId: string | null; companyId: string } | null = null,
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
    claimSlot: {
      findUnique: jest.fn().mockResolvedValue(slot),
      findFirst: jest.fn().mockResolvedValue(slot),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const billingDocs = {
    prepare: jest.fn().mockResolvedValue(extras),
    markProformaEmailed: jest.fn().mockResolvedValue(undefined),
  };
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

  // g1-1 (PO): la firma e-mail doar proprietar/manageri + responsabilul preluarii
  it('message.created de la client → email proprietarului/managerilor + responsabilului, fara expeditor', async () => {
    const { service, prisma } = makeService(
      [],
      ['m1', { userId: 'm2', role: 'MANAGER' }, { userId: 'e1', role: 'EMPLOYEE_MANAGED' }, { userId: 'e2', role: 'EMPLOYEE_TRUSTED' }],
      null,
      { assignedToUserId: 'e1', companyId: 'c1' },
    );
    await service.sendForEvent('message.created', ['m1', 'm2', 'e1', 'e2', 'u-client'], {
      senderUserId: 'u-client',
      senderRole: 'CLIENT',
      clientUserId: 'u-client',
      requestId: 'r1',
      companyId: 'c1',
      claimSlotId: 's1',
    });
    expect(prisma.claimSlot.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's1' } }));
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['m1', 'm2', 'e1'] } }),
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
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1', role: { in: ['OWNER', 'MANAGER'] } }) }),
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
    expect(mail.send.mock.calls[0][1]).toContain('Termenul de răspuns');
    // glosar etapa 8: „termen de răspuns”, nu „SLA”
    expect(mail.send.mock.calls[0][2]).not.toMatch(/\bSLA\b/);

    mail.send.mockClear();
    await service.sendForEvent('claim.withdrawn', ['m1'], {
      reason: 'VOLUNTARY_NO_REASON',
      requestId: 'r1',
    });
    expect(mail.send).not.toHaveBeenCalled();
  });

  // glosar etapa 8 (42): ecranul firmei se numeste „Cereri disponibile”; in text nu mai apare „marketplace”
  // (ramane doar in adresa linkului), iar dupa acceptare se spune „comandă”, nu „lucrare”
  it('glosar: „Cereri disponibile” si „comandă” in e-mailurile firmei, RO si EN', async () => {
    const ro = { id: 'm1', email: 'firma@demo.ro', name: 'Ana', languagePreference: 'RO' };
    const en = { id: 'm2', email: 'firm@demo.ro', name: 'Ann', languagePreference: 'EN' };
    const { service, mail } = makeService([ro, en], ['m1', 'm2']);
    await service.sendForEvent('company.approved', ['m1', 'm2'], { companyName: 'A Mobila', companyId: 'c1' });
    await service.sendForEvent('quote.accepted', ['m1', 'm2'], { companyName: 'A Mobila', companyId: 'c1', requestTitle: 'Bucatarie', requestId: 'r1', claimSlotId: 'slot1' });
    const texts = mail.send.mock.calls.map((c: unknown[]) => `${String(c[1])} ${String(c[2]).replace(/https?:\/\/[^\s"<]+/g, '')}`);
    expect(texts.length).toBe(4);
    const all = texts.join('\n');
    expect(all).toContain('Cereri disponibile');
    expect(all).toContain('Available requests');
    expect(all).toContain('Deschide comanda');
    expect(all).toContain('Open the order');
    for (const t of texts) {
      expect(t).not.toMatch(/marketplace|lucrarea|the job|\bSLA\b|atelier/i);
    }
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
    expect(mail.send.mock.calls[0][1]).toContain('Comanda a fost anulată');
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
    expect(subject).toBe('Datele pentru plata prin transfer — plata ABCD1234');
    expect(html).toContain('RO08TEST0000000000000001');
    expect(html).toContain('Platforma &lt;SRL&gt;');
    expect(html).not.toContain('Platforma <SRL>');
    expect(html).toContain('„Comanda ABCD1234”');
    expect(html).toContain(`${new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2 }).format(1210)} lei`);
    // glosar etapa 8: „lei”, nu „RON”; referinta de plata ramane „Comanda …” (D6)
    expect(html).not.toMatch(/\bRON\b/);
    expect(html).toContain('Factura proformă este atașată.');
    expect(html).toContain('/ro/marketplace/wallet');
    expect(html).not.toMatch(/atelier/i);
    expect(opts).toEqual({ replyToSupport: true, attachments: [pdf] });
    // g4: e-mailul a plecat → comanda tine minte (BillingDocumentsService decide daca era proforma)
    expect(billingDocs.markProformaEmailed).toHaveBeenCalledWith('payment.transfer_instructions', payload, extras());
  });

  it('g4: niciun e-mail plecat (SMTP picat, best-effort) → proforma NU e marcata trimisa', async () => {
    const { service, mail, billingDocs } = makeService([owner], members, extras());
    mail.send.mockRejectedValueOnce(new Error('smtp down'));
    await service.sendForEvent('payment.transfer_instructions', ['own'], { orderId: 'o1', companyId: 'c1' });
    expect(billingDocs.markProformaEmailed).not.toHaveBeenCalled();
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
    expect(subject).toBe('Payment ABCD1234 is awaiting your transfer');
    expect(html).toContain('the pending payment is cancelled automatically');
    expect(html).toContain('in your wallet');

    const ro = makeService([owner], members, extras({ attachment: null }));
    await ro.service.sendForEvent('payment.auto_cancelled', ['own'], { orderId: 'o1', companyId: 'c1', expiryDays: 7 });
    const [, subjectRo, htmlRo] = ro.mail.send.mock.calls[0];
    expect(subjectRo).toBe('Plata ABCD1234 a fost anulată — banii nu au ajuns');
    expect(htmlRo).toContain('Nu am primit banii în 7 zile');
    expect(htmlRo).toContain('Poți porni oricând o plată nouă din portofel.');
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
    const { service, mail, prisma, billingDocs } = makeService([], members, extras());
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
    // g4 (revizie m5): doar la contabil → proforma NU e marcata „trimisa firmei”
    expect(billingDocs.markProformaEmailed).not.toHaveBeenCalled();

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

// a4 (2026-11-13): varianta noua → clientul; cererea de modificare → firma; refuzul → firma
describe('evenimente a4 (oferte: varianta noua, cerere de modificare, refuz)', () => {
  const member = { id: 'm1', email: 'firma@demo.ro', name: 'Ana', languagePreference: 'RO' };
  const base = { clientUserId: 'u-client', requestTitle: 'Bucatarie', companyName: 'A Mobila', requestId: 'r1', companyId: 'c1', claimSlotId: 's1' };

  it('quote.updated NEW_VERSION → e-mail DOAR clientului, cu numarul variantei', async () => {
    const { service, prisma, mail } = makeService([radu], ['m1']);
    await service.sendForEvent('quote.updated', ['m1', 'u-client'], { ...base, kind: 'NEW_VERSION', version: 2 });
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: ['u-client'] } }) }));
    expect(mail.send).toHaveBeenCalledWith('radu@demo.ro', expect.stringContaining('Variantă nouă'), expect.stringContaining('varianta 2'), expect.anything());
  });

  it('quote.updated CHANGE_REQUESTED → e-mail DOAR membrilor firmei, link la preluare', async () => {
    const { service, prisma, mail } = makeService([member], ['m1']);
    await service.sendForEvent('quote.updated', ['m1', 'u-client'], { ...base, kind: 'CHANGE_REQUESTED' });
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: ['m1'] } }) }));
    expect(mail.send).toHaveBeenCalledWith('firma@demo.ro', expect.stringContaining('modificare'), expect.stringContaining('/ro/marketplace/claims/s1'), expect.anything());
  });

  it('quote.updated fara kind (prelungire, invitatie etc.) → fara e-mail', async () => {
    const { service, prisma, mail } = makeService([radu, member], ['m1']);
    await service.sendForEvent('quote.updated', ['m1', 'u-client'], base);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('quote.declined → e-mail firmei cu motivul si nota (escapata), creditele consumate', async () => {
    const { service, mail } = makeService([member], ['m1']);
    await service.sendForEvent('quote.declined', ['m1'], { ...base, reason: 'PRICE', note: 'prea <b>scump</b>', consumed: true });
    const [to, subject, html] = mail.send.mock.calls[0];
    expect(to).toBe('firma@demo.ro');
    expect(subject).toContain('Clientul a refuzat oferta');
    expect(html).toContain('Motivul indicat: prețul');
    expect(html).toContain('prea &lt;b&gt;scump&lt;/b&gt;');
    expect(html).toContain('s-au consumat');
  });

  it('quote.declined fara motiv, in engleza', async () => {
    const { service, mail } = makeService([{ ...member, languagePreference: 'EN' }], ['m1']);
    await service.sendForEvent('quote.declined', ['m1'], { ...base, reason: null, note: null, consumed: true });
    const [, subject, html] = mail.send.mock.calls[0];
    expect(subject).toContain('The client declined your offer');
    expect(html).not.toContain('Reason given');
  });

  // glosar etapa 8 (m1 din revizuire): refuzul vine inainte de acceptare → „cerere”, ca in interfata
  it('quote.declined GAVE_UP → „renunță la cerere” / „is dropping the request”', async () => {
    const { service, mail } = makeService([member, { ...member, id: 'm2', email: 'firm@demo.ro', languagePreference: 'EN' }], ['m1', 'm2']);
    await service.sendForEvent('quote.declined', ['m1', 'm2'], { ...base, reason: 'GAVE_UP', note: null, consumed: true });
    const htmls = mail.send.mock.calls.map((c: unknown[]) => String(c[2]));
    expect(htmls.join('\n')).toContain('Motivul indicat: renunță la cerere');
    expect(htmls.join('\n')).toContain('Reason given: is dropping the request');
    for (const h of htmls) expect(h).not.toMatch(/proiect|project/i);
  });
});

// e4 (etapa 7): o firma a renuntat la preluare → e-mail clientului, fara numele firmei
describe('request.company_withdrew', () => {
  it('trimite clientului (tinta) un e-mail cu linkul cererii, fara numele firmei', async () => {
    const { service, mail } = makeService([radu]);
    await service.sendForEvent('request.company_withdrew', ['u-client'], { requestId: 'r1', requestTitle: 'Bucătărie <i>nouă</i>', companyName: 'A Mobila Premium' });
    expect(mail.send).toHaveBeenCalledTimes(1);
    const [to, subject, html] = mail.send.mock.calls[0];
    expect(to).toBe('radu@demo.ro');
    expect(subject).toContain('O firmă a renunțat la cererea ta');
    expect(html).toContain('din nou disponibilă pentru alte firme');
    expect(html).toContain('/ro/requests/r1');
    expect(html).toContain('&lt;i&gt;');
    expect(html).not.toContain('A Mobila Premium');
  });

  it('in engleza', async () => {
    const { service, mail } = makeService([{ ...radu, languagePreference: 'EN' }]);
    await service.sendForEvent('request.company_withdrew', ['u-client'], { requestId: 'r1', requestTitle: 'Kitchen' });
    const [, subject] = mail.send.mock.calls[0];
    expect(subject).toContain('A company stepped back from your request');
  });
});

// g1 (etapa 9): evenimentele noi + regula „cine din firma primeste e-mail” (PO g1-1)
describe('g1: evenimente noi si destinatarii firmei', () => {
  const owner = { id: 'm1', email: 'owner@demo.ro', name: 'Ana', languagePreference: 'RO' };
  const team = ['m1', { userId: 'm2', role: 'MANAGER' }, { userId: 'e1', role: 'EMPLOYEE_MANAGED' }, { userId: 'e2', role: 'EMPLOYEE_TRUSTED' }];
  const base = { requestId: 'r1', requestTitle: 'Bucătărie', companyName: 'A Mobila', companyId: 'c1', claimSlotId: 's1', clientUserId: 'u-client' };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emailedIds = (prisma: any) => prisma.user.findMany.mock.calls[0]?.[0]?.where?.id?.in;

  it.each(['quote.accepted', 'quote.declined', 'clarification.answered', 'request.edited_after_claim', 'delivery.confirmed', 'review.created'])(
    '%s → responsabilul preluarii + proprietar/manageri; ceilalti membri si clientul NU',
    async (type) => {
      const { service, prisma } = makeService([owner], team, null, { assignedToUserId: 'e1', companyId: 'c1' });
      await service.sendForEvent(type, ['u-client', 'm1', 'm2', 'e1', 'e2'], { ...base, rating: 4 });
      expect(emailedIds(prisma)).toEqual(['m1', 'm2', 'e1']);
    },
  );

  it('preluare fara responsabil → doar proprietar + manageri', async () => {
    const { service, prisma } = makeService([owner], team, null, { assignedToUserId: null, companyId: 'c1' });
    await service.sendForEvent('quote.accepted', ['m1', 'm2', 'e1', 'e2'], base);
    expect(emailedIds(prisma)).toEqual(['m1', 'm2']);
  });

  it('responsabilul unei alte firme (slot strain) nu e adaugat', async () => {
    const { service, prisma } = makeService([owner], team, null, { assignedToUserId: 'e2', companyId: 'alta' });
    await service.sendForEvent('review.created', ['m1', 'm2', 'e1', 'e2'], { ...base, rating: 5 });
    expect(emailedIds(prisma)).toEqual(['m1', 'm2']);
  });

  it('payload fara slot → cauta ultima preluare a firmei pe cerere', async () => {
    const { service, prisma } = makeService([owner], team, null, { assignedToUserId: 'e2', companyId: 'c1' });
    await service.sendForEvent('delivery.confirmed', ['m1', 'm2', 'e1', 'e2'], { ...base, claimSlotId: undefined });
    expect(prisma.claimSlot.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { requestId: 'r1', companyId: 'c1' } }));
    expect(emailedIds(prisma)).toEqual(['m1', 'm2', 'e2']);
  });

  it('payload vechi fara companyId → niciun e-mail la firma', async () => {
    const { service, prisma } = makeService([owner], team);
    await service.sendForEvent('review.created', ['m1'], { requestId: 'r1', rating: 5 });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('message.created de la client: link direct la fisa preluarii (nu la lista de mesaje)', async () => {
    const { service, mail } = makeService([owner], team);
    await service.sendForEvent('message.created', ['m1'], { ...base, senderUserId: 'u-client', senderRole: 'CLIENT' });
    expect(mail.send.mock.calls[0][2]).toContain('/ro/marketplace/claims/s1');
    expect(mail.send.mock.calls[0][2]).not.toContain('/marketplace/messages');
  });

  it('request.published → e-mail DOAR clientului, cu legatura spre cerere si data expirarii (ora Romaniei)', async () => {
    const { service, prisma, mail } = makeService([radu]);
    await service.sendForEvent('request.published', ['u-client'], {
      requestId: 'r1', requestTitle: 'Dulap <b>hol</b>', clientUserId: 'u-client', expiresAt: '2026-11-20T22:30:00.000Z',
    });
    expect(emailedIds(prisma)).toEqual(['u-client']);
    const [to, subject, html] = mail.send.mock.calls[0];
    expect(to).toBe('radu@demo.ro');
    expect(subject).toContain('Cererea ta e publicată');
    expect(html).toContain('/ro/requests/r1');
    expect(html).not.toContain('/ro/requests/r1/offers');
    // 22:30 UTC = 21 noiembrie, 00:30 in Bucuresti
    expect(html).toContain('21 nov. 2026');
    expect(html).toContain('Dulap &lt;b&gt;hol&lt;/b&gt;');
  });

  it('request.published in engleza', async () => {
    const { service, mail } = makeService([{ ...radu, languagePreference: 'EN' }]);
    await service.sendForEvent('request.published', ['u-client'], { requestId: 'r1', requestTitle: 'Hall', clientUserId: 'u-client', expiresAt: '2026-11-20T10:00:00.000Z' });
    const [, subject, html] = mail.send.mock.calls[0];
    expect(subject).toContain('Your request is published');
    expect(html).toContain('/en/requests/r1');
    expect(html).toContain('20 Nov 2026');
  });

  it('clarification.asked → clientul, cu numele firmei si legatura spre cerere', async () => {
    const { service, prisma, mail } = makeService([radu], team);
    await service.sendForEvent('clarification.asked', ['u-client'], { ...base, actorUserId: 'm1' });
    expect(emailedIds(prisma)).toEqual(['u-client']);
    const [, subject, html] = mail.send.mock.calls[0];
    expect(subject).toContain('Firma A Mobila are o întrebare la cererea ta');
    expect(html).toContain('/ro/requests/r1');
  });

  it('clarification.answered / request.edited_after_claim / delivery.confirmed / review.created → legatura spre fisa preluarii', async () => {
    const { service, mail } = makeService([owner], team);
    for (const type of ['clarification.answered', 'request.edited_after_claim', 'delivery.confirmed', 'review.created']) {
      await service.sendForEvent(type, ['m1'], { ...base, rating: 2, disputed: true });
    }
    expect(mail.send).toHaveBeenCalledTimes(4);
    for (const call of mail.send.mock.calls) {
      expect(call[2]).toContain('/ro/marketplace/claims/s1');
      expect(String(call[1]) + String(call[2])).not.toMatch(/atelier|lucrare/i);
    }
    expect(mail.send.mock.calls[3][2]).toContain('2 stele');
  });

  it('request.new_in_area NU trimite e-mail pe eveniment (doar rezumatul zilnic)', async () => {
    const { service, prisma } = makeService([owner], team);
    await service.sendForEvent('request.new_in_area', ['m1', 'm2'], { requestId: 'r1', companyId: 'c1', requestTitle: 'X' });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe('h1-1 (etapa 11): company.member_added → colegul adaugat', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emailedIds = (prisma: any) => prisma.user.findMany.mock.calls[0]?.[0]?.where?.id?.in;
  const ion = { id: 'u-new', email: 'ion@demo.ro', name: 'Ion', languagePreference: 'RO' };
  const payload = { companyId: 'c1', companyName: 'Lemn & Stil <script>x</script>', memberUserId: 'u-new', role: 'EMPLOYEE_TRUSTED', actorUserId: 'm1' };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withStatus = (prisma: any, status: string) => prisma.company.findUnique.mockResolvedValue({ name: 'X', billingEmail: null, status });

  it('firma aprobata: e-mail DOAR colegului; corpul escapat, subiectul text simplu (m9), rolul, legatura', async () => {
    const { service, prisma, mail } = makeService([ion]);
    withStatus(prisma, 'APPROVED');
    await service.sendForEvent('company.member_added', ['u-new', 'm1'], payload);
    expect(emailedIds(prisma)).toEqual(['u-new']);
    const [to, subject, html] = mail.send.mock.calls[0];
    expect(to).toBe('ion@demo.ro');
    // subiectul nu e HTML: fara &amp; / &lt;
    expect(subject).toBe('Ai fost adăugat în firma Lemn & Stil <script>x</script>');
    expect(html).toContain('Lemn &amp; Stil &lt;script&gt;x&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Angajat de încredere');
    expect(html).toContain('/ro/company');
    expect(String(subject) + String(html)).not.toMatch(/atelier/i);
  });

  it('subiectul scoate randurile noi din numele firmei', async () => {
    const { service, prisma, mail } = makeService([ion]);
    withStatus(prisma, 'APPROVED');
    await service.sendForEvent('company.member_added', ['u-new'], { ...payload, companyName: 'A\r\nBcc: x@y.ro' });
    expect(mail.send.mock.calls[0][1]).toBe('Ai fost adăugat în firma A Bcc: x@y.ro');
  });

  it.each(['PENDING_VERIFICATION', 'REJECTED', 'SUSPENDED'])('firma %s → niciun e-mail (clopotelul ramane)', async (status) => {
    const { service, prisma, mail } = makeService([ion]);
    withStatus(prisma, status);
    await service.sendForEvent('company.member_added', ['u-new'], payload);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('readaugare in <24h (emailSuppressed) → niciun e-mail, nici la firma aprobata', async () => {
    const { service, prisma, mail } = makeService([ion]);
    withStatus(prisma, 'APPROVED');
    await service.sendForEvent('company.member_added', ['u-new'], { ...payload, emailSuppressed: true });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('in engleza', async () => {
    const { service, prisma, mail } = makeService([{ ...ion, languagePreference: 'EN' }]);
    withStatus(prisma, 'APPROVED');
    await service.sendForEvent('company.member_added', ['u-new'], payload);
    const [, subject, html] = mail.send.mock.calls[0];
    expect(subject).toContain('You were added to the company');
    expect(html).toContain('Trusted employee');
    expect(html).toContain('/en/company');
  });

  it('payload fara memberUserId → niciun e-mail', async () => {
    const { service, prisma } = makeService([ion]);
    await service.sendForEvent('company.member_added', ['u-new'], { companyId: 'c1', role: 'MANAGER' });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe('g1-2: rezumatul zilnic „cereri noi in zona ta”', () => {
  const items = [
    { requestId: 'r1', title: 'Dulap <i>dormitor</i>', city: 'Iași', county: 'Iași' },
    { requestId: 'r2', title: 'Bucătărie', city: 'Pașcani', county: '' },
  ];

  it('un singur e-mail per destinatar (proprietar + manageri activi), cu cererile si legaturile lor', async () => {
    const users = [
      { id: 'm1', email: 'owner@demo.ro', name: 'Ana', languagePreference: 'RO' },
      { id: 'm2', email: 'manager@demo.ro', name: 'Ann', languagePreference: 'EN' },
    ];
    const { service, prisma, mail } = makeService(users, ['m1', { userId: 'm2', role: 'MANAGER' }, { userId: 'e1', role: 'EMPLOYEE_MANAGED' }]);
    await expect(service.sendNewRequestsDigest({ id: 'c1', name: 'A Mobila' }, items)).resolves.toBe(2);
    // doar OWNER/MANAGER, conturi nesterse/neblocate
    expect(prisma.companyMember.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ companyId: 'c1', role: { in: ['OWNER', 'MANAGER'] }, user: { deletedAt: null, blockedAt: null } }),
    }));
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: ['m1', 'm2'] }, emailNotificationsEnabled: true, emailVerifiedAt: { not: null } }),
    }));
    expect(mail.send).toHaveBeenCalledTimes(2);
    const [, subjectRo, htmlRo] = mail.send.mock.calls[0];
    expect(subjectRo).toBe('Cereri noi în zona ta — 2 cereri noi');
    expect(htmlRo).toContain('http://localhost:3000/ro/marketplace/r1');
    expect(htmlRo).toContain('Dulap &lt;i&gt;dormitor&lt;/i&gt;');
    expect(htmlRo).toContain('Pașcani');
    expect(htmlRo).toContain('/ro/unsubscribe?uid=m1');
    expect(htmlRo).not.toMatch(/atelier/i);
    const [, subjectEn, htmlEn] = mail.send.mock.calls[1];
    expect(subjectEn).toBe('New requests in your area — 2 new requests');
    expect(htmlEn).toContain('/en/marketplace/r2');
  });

  it('fara cereri sau fara manageri → niciun e-mail', async () => {
    const { service, mail } = makeService([{ id: 'm1', email: 'o@demo.ro', name: 'A', languagePreference: 'RO' }], ['m1']);
    await expect(service.sendNewRequestsDigest({ id: 'c1', name: 'A' }, [])).resolves.toBe(0);
    const { service: s2, mail: mail2 } = makeService([], [{ userId: 'e1', role: 'EMPLOYEE_MANAGED' }]);
    await expect(s2.sendNewRequestsDigest({ id: 'c1', name: 'A' }, items)).resolves.toBe(0);
    expect(mail.send).not.toHaveBeenCalled();
    expect(mail2.send).not.toHaveBeenCalled();
  });

  it('o singura cerere → „o cerere nouă”; esecul SMTP nu arunca', async () => {
    const { service, mail } = makeService([{ id: 'm1', email: 'o@demo.ro', name: 'A', languagePreference: 'RO' }], ['m1']);
    mail.send.mockRejectedValueOnce(new Error('smtp down'));
    await expect(service.sendNewRequestsDigest({ id: 'c1', name: 'A' }, [items[0]])).resolves.toBe(0);
    expect(mail.send.mock.calls[0][1]).toBe('Cereri noi în zona ta — o cerere nouă');
  });
});

// revizie g1 m7: „de” in romana doar cand ultimele doua cifre sunt 0 sau 20–99
describe('roNeedsDe', () => {
  it.each([[2, false], [19, false], [20, true], [99, true], [100, true], [101, false], [119, false], [120, true], [1000, true], [1005, false]])('%i → %s', (n, de) => {
    expect(roNeedsDe(n)).toBe(de);
  });
});

// revizie g1 m4: recenziile nu se afiseaza public, deci e-mailul nu promite „inainte sa apara public”
describe('review.created sub 3 stele', () => {
  it('spune doar ca echipa analizeaza recenzia (RO + EN)', async () => {
    const ro = { id: 'm1', email: 'o@demo.ro', name: 'A', languagePreference: 'RO' };
    const en = { id: 'm2', email: 'e@demo.ro', name: 'B', languagePreference: 'EN' };
    const { service, mail } = makeService([ro, en], ['m1', 'm2']);
    await service.sendForEvent('review.created', ['m1', 'm2'], { requestId: 'r1', companyId: 'c1', claimSlotId: 's1', rating: 2, disputed: true });
    const all = mail.send.mock.calls.map((c: unknown[]) => String(c[2])).join(' | ');
    expect(all).toContain('echipa Cozy Home analizează recenzia');
    expect(all).toContain('the Cozy Home team is reviewing it');
    expect(all).not.toMatch(/public/i);
  });
});

// Etapa 12 (adaos): subiectul e text simplu → valorile NU se escapeaza HTML (altfel „Lemn & Stil”
// ajunge „Lemn &amp;amp; Stil”), doar se curata randurile noi / caracterele de control si se taie.
// Corpul ramane escapat exact ca inainte.
describe('etapa 12: subiectele e-mailurilor sunt text curat, corpul ramane escapat', () => {
  const dirtyTitle = 'Dulap "hol" & <script>alert(1)</script>\r\nBcc: x@y.ro';
  const cleanTitle = 'Dulap "hol" & <script>alert(1)</script> Bcc: x@y.ro';
  const dirtyCompany = 'Lemn & Stil\n<b>SRL</b>';
  const cleanCompany = 'Lemn & Stil <b>SRL</b>';
  const payload = {
    clientUserId: 'u-client',
    requestId: 'r1',
    requestTitle: dirtyTitle,
    companyName: dirtyCompany,
    companyId: 'c1',
  };
  const expectBodyEscaped = (html: string) => {
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('&amp;amp;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&quot;hol&quot; &amp;');
  };

  it('quote.created: subiectul are titlul curat, corpul e escapat', async () => {
    const { service, mail } = makeService([radu]);
    await service.sendForEvent('quote.created', ['u-client'], payload);
    const [, subject, html] = mail.send.mock.calls[0];
    expect(subject).toBe(`Ofertă nouă la cererea ta — ${cleanTitle}`);
    expect(subject).not.toMatch(/&amp;|&lt;|&quot;|[\r\n]/);
    expectBodyEscaped(html);
    expect(html).toContain('Lemn &amp; Stil');
  });

  it('message.created de la firma: subiectul are numele firmei curat (EN)', async () => {
    const { service, mail } = makeService([{ ...radu, languagePreference: 'EN' }]);
    await service.sendForEvent('message.created', ['u-client'], { ...payload, senderRole: 'COMPANY', senderUserId: 'm1' });
    const [, subject, html] = mail.send.mock.calls[0];
    expect(subject).toBe(`New message — ${cleanCompany}`);
    expect(html).toContain('Lemn &amp; Stil');
    expect(html).toContain('&lt;b&gt;SRL&lt;/b&gt;');
  });

  it('clarification.asked: firma si titlul in subiect, ambele curate', async () => {
    const { service, mail } = makeService([radu]);
    await service.sendForEvent('clarification.asked', ['u-client'], { ...payload, actorUserId: 'm1' });
    const [, subject, html] = mail.send.mock.calls[0];
    expect(subject).toBe(`Firma ${cleanCompany} are o întrebare la cererea ta — ${cleanTitle}`);
    expect(html).not.toContain('<b>SRL</b>');
  });

  it('request.expired: subiectul fara entitati HTML, corpul escapat', async () => {
    const { service, mail } = makeService([radu]);
    await service.sendForEvent('request.expired', ['u-client'], payload);
    const [, subject, html] = mail.send.mock.calls[0];
    expect(subject).toBe(`Cererea ta a expirat — ${cleanTitle}`);
    expect(html).not.toContain('<script>');
  });

  it('request.no_coverage: localitatea curata in subiect, escapata in corp', async () => {
    const admin = { id: 'a1', email: 'admin@demo.ro', name: 'Admin', languagePreference: 'RO' };
    const { service, mail } = makeService([admin]);
    await service.sendForEvent('request.no_coverage', ['a1'], { ...payload, city: 'Iași & <i>Copou</i>', county: 'Iași\n' });
    const [, subject, html] = mail.send.mock.calls[0];
    expect(subject).toBe('Cerere nouă fără nicio firmă în zonă — Iași & <i>Copou</i>, Iași');
    expect(html).toContain('Iași &amp; &lt;i&gt;Copou&lt;/i&gt;');
  });

  it('un titlu foarte lung se taie in subiect (fara sa atinga corpul)', async () => {
    const { service, mail } = makeService([radu]);
    const long = 'A'.repeat(300);
    await service.sendForEvent('quote.created', ['u-client'], { ...payload, requestTitle: long });
    const [, subject, html] = mail.send.mock.calls[0];
    expect(subject.length).toBeLessThan(200);
    expect(subject.endsWith('…')).toBe(true);
    expect(html).toContain(long);
  });
});
