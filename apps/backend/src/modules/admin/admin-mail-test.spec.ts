import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

// E-admin-platform-1: emailul de test merge DOAR catre adminul curent si nu arunca la esec SMTP.
describe('AdminService.sendTestEmail', () => {
  const makeService = (user: Record<string, unknown> | null, supportEmail: string | null = 'suport@cozyhome.ro') => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
    const mail = {
      send: jest.fn().mockResolvedValue(undefined),
      supportEmail,
      fromAddress: '"Cozy Home" <notificari@cozyhome.ro>',
    };
    const queue = {} as never;
    const service = new AdminService(
      prisma as never,
      {} as never,
      mail as never,
      {} as never,
      queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue,
    );
    return { service, prisma, mail };
  };
  const admin = { email: 'admin@demo.ro', name: 'Admin', languagePreference: 'RO' };

  it('trimite catre adresa adminului, cu Reply-To suport, si raporteaza expeditorul', async () => {
    const { service, prisma, mail } = makeService(admin);
    const res = await service.sendTestEmail('admin-1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'admin-1' } }));
    expect(res).toEqual({
      ok: true,
      to: 'admin@demo.ro',
      from: '"Cozy Home" <notificari@cozyhome.ro>',
      replyTo: 'suport@cozyhome.ro',
      error: null,
    });
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0]).toBe('admin@demo.ro');
    expect(mail.send.mock.calls[0][1]).toBe('Email de test — Cozy Home');
    expect(mail.send.mock.calls[0][3]).toEqual({ replyToSupport: true });
    expect(mail.send.mock.calls[0][2]).toContain('mailto:suport@cozyhome.ro');
  });

  it('respingerea SMTP intoarce ok:false cu clasificarea, fara sa arunce si fara mesajul brut', async () => {
    const { service, mail } = makeService({ ...admin, languagePreference: 'EN' }, null);
    mail.send.mockRejectedValueOnce(Object.assign(new Error('535 auth failed for secret@x.ro'), { code: 'EAUTH', responseCode: 535 }));
    const res = await service.sendTestEmail('admin-1');
    expect(res.ok).toBe(false);
    expect(res.replyTo).toBeNull();
    expect(res.error).toBe('kind=Error code=EAUTH status=535');
    expect(mail.send.mock.calls[0][1]).toBe('Test email — Cozy Home');
  });

  it('user inexistent → NotFoundException, fara trimitere', async () => {
    const { service, mail } = makeService(null);
    await expect(service.sendTestEmail('ghost')).rejects.toBeInstanceOf(NotFoundException);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('numele adminului e escapat in HTML', async () => {
    const { service, mail } = makeService({ ...admin, name: 'Ion <b>Pop</b>' });
    await service.sendTestEmail('admin-1');
    const html = mail.send.mock.calls[0][2] as string;
    expect(html).not.toContain('<b>Pop');
    expect(html).toContain('Ion &lt;b&gt;Pop&lt;/b&gt;');
  });
});
