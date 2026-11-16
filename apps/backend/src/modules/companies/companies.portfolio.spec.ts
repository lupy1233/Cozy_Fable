import 'reflect-metadata';
import { HttpStatus } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_PORTFOLIO_ITEMS } from '../uploads/portfolio-images.service';
import { CompaniesService } from './companies.service';
import { PortfolioItemDto } from './dto/company.dto';

// h1 (etapa 11): portofoliul firmei — poza incarcata (presign → PUT → confirm), o singura poza
// pe lucrare, doar membrii cu rol potrivit, doar in firma proprie, fara fisiere orfane.

/* eslint-disable @typescript-eslint/no-explicit-any */
function setup(opts: { role?: string; item?: Record<string, unknown> | null; items?: number; status?: string } = {}) {
  const company = { findUnique: jest.fn().mockResolvedValue({ status: opts.status ?? 'APPROVED' }) };
  const tx: any = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    company,
    companyPortfolioItem: {
      count: jest.fn().mockResolvedValue(opts.items ?? 0),
      create: jest.fn().mockResolvedValue({ id: 'item-new' }),
      findFirst: jest.fn(async ({ where }: any) =>
        opts.item === null || where.companyId !== 'c1' ? null : { id: where.id, companyId: 'c1', imageUrl: null, ...(opts.item ?? {}) },
      ),
      update: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn(async ({ where }: any) => ({ count: opts.item === null || where.companyId !== 'c1' ? 0 : 1 })),
    },
  };
  const prisma: any = {
    companyMember: { findUnique: jest.fn().mockResolvedValue({ companyId: 'c1', userId: 'u1', role: opts.role ?? 'OWNER' }) },
    company,
    $transaction: jest.fn(async (fn: (t: any) => unknown) => fn(tx)),
  };
  const images: any = {
    presign: jest.fn().mockResolvedValue({ attachmentId: 'a1', uploadUrl: 'https://s/put', storageKey: 'k', expiresInSeconds: 900 }),
    confirm: jest.fn().mockResolvedValue({ id: 'a1', status: 'SAFE', downloadUrl: null }),
    attachInTx: jest.fn().mockResolvedValue(['company_portfolio/c1/old/clean-o.png']),
    keysForItems: jest.fn().mockResolvedValue(['company_portfolio/c1/a1/clean-x.png']),
    deleteRowsForItems: jest.fn().mockResolvedValue(undefined),
    deleteObjects: jest.fn().mockResolvedValue(undefined),
    urlsForItems: jest.fn().mockResolvedValue(new Map()),
  };
  const service = new CompaniesService(prisma, {} as any, {} as any, {} as any, undefined, images);
  jest.spyOn(service, 'getMyCompany').mockResolvedValue({ id: 'c1' } as any);
  return { service, prisma, tx, images };
}

describe('CompaniesService — portofoliu (h1)', () => {
  it('presign-ul si confirmarea merg in spatiul firmei membrului', async () => {
    const { service, images } = setup();
    await service.presignPortfolioImage('u1', { filename: 'a.png', mimeType: 'image/png', sizeBytes: 10 });
    expect(images.presign).toHaveBeenCalledWith('c1', { filename: 'a.png', mimeType: 'image/png', sizeBytes: 10 });
    await service.confirmPortfolioImage('u1', 'a1');
    expect(images.confirm).toHaveBeenCalledWith('c1', 'a1');
  });

  it.each(['EMPLOYEE_TRUSTED', 'EMPLOYEE_MANAGED'])('%s nu poate incarca, adauga, inlocui sau sterge (403)', async (role) => {
    const { service, images, tx } = setup({ role });
    const calls = [
      service.presignPortfolioImage('u1', { filename: 'a.png', mimeType: 'image/png', sizeBytes: 10 }),
      service.confirmPortfolioImage('u1', 'a1'),
      service.addPortfolioItem('u1', { title: 'Bucatarie', attachmentId: 'a1' } as PortfolioItemDto),
      service.setPortfolioImage('u1', 'item1', 'a1'),
      service.deletePortfolioItem('u1', 'item1'),
    ];
    for (const call of calls) {
      const err: any = await call.catch((e) => e);
      expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
    expect(images.presign).not.toHaveBeenCalled();
    expect(images.confirm).not.toHaveBeenCalled();
    expect(images.attachInTx).not.toHaveBeenCalled();
    expect(tx.companyPortfolioItem.create).not.toHaveBeenCalled();
    expect(images.deleteObjects).not.toHaveBeenCalled();
  });

  it('adaugarea cu poza: lucrarea si atasarea in aceeasi tranzactie, fara image_url', async () => {
    const { service, tx, images } = setup();
    await service.addPortfolioItem('u1', { title: ' Bucatarie ', description: '', attachmentId: 'a1' } as PortfolioItemDto);
    expect(tx.companyPortfolioItem.create).toHaveBeenCalledWith({
      data: { companyId: 'c1', title: 'Bucatarie', description: null },
    });
    expect(images.attachInTx).toHaveBeenCalledWith(tx, 'c1', 'item-new', 'a1');
  });

  it('o poza care nu poate fi atasata (alta firma / neverificata) nu lasa lucrarea in urma', async () => {
    const { service, images } = setup();
    images.attachInTx.mockRejectedValue(Object.assign(new Error('nf'), { status: 404 }));
    await expect(service.addPortfolioItem('u1', { title: 'Bucatarie', attachmentId: 'a2' } as PortfolioItemDto)).rejects.toBeTruthy();
    // eroarea iese din runTx → tranzactia se anuleaza (create-ul nu ramane)
    expect(images.deleteObjects).not.toHaveBeenCalled();
  });

  it('inlocuirea pozei sterge fisierul vechi din storage dupa commit si uita adresa veche', async () => {
    const { service, tx, images } = setup({ item: { imageUrl: 'https://vechi/poza.jpg' } });
    await service.setPortfolioImage('u1', 'item1', 'a1');
    expect(images.attachInTx).toHaveBeenCalledWith(tx, 'c1', 'item1', 'a1');
    expect(tx.companyPortfolioItem.update).toHaveBeenCalledWith({ where: { id: 'item1' }, data: { imageUrl: null } });
    expect(images.deleteObjects).toHaveBeenCalledWith(['company_portfolio/c1/old/clean-o.png']);
  });

  it('inlocuirea pe lucrarea altei firme → 404, fara atasare', async () => {
    const { service, images } = setup({ item: null });
    const err: any = await service.setPortfolioImage('u1', 'item-x', 'a1').catch((e) => e);
    expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(images.attachInTx).not.toHaveBeenCalled();
  });

  it('stergerea lucrarii sterge si randul + fisierul pozei', async () => {
    const { service, tx, images } = setup();
    await service.deletePortfolioItem('u1', 'item1');
    expect(tx.companyPortfolioItem.deleteMany).toHaveBeenCalledWith({ where: { id: 'item1', companyId: 'c1' } });
    expect(images.deleteRowsForItems).toHaveBeenCalledWith(['item1'], tx);
    expect(images.deleteObjects).toHaveBeenCalledWith(['company_portfolio/c1/a1/clean-x.png']);
  });

  it('stergerea lucrarii altei firme → 404, nimic sters din storage', async () => {
    const { service, images } = setup({ item: null });
    const err: any = await service.deletePortfolioItem('u1', 'item-x').catch((e) => e);
    expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(images.deleteObjects).not.toHaveBeenCalled();
  });
});

describe('CompaniesService — limitele portofoliului (h1, revizuire M2 / m11)', () => {
  it(`plafonul de ${MAX_PORTFOLIO_ITEMS} lucrari: verificat sub blocarea randului firmei, fara creare`, async () => {
    const { service, tx, images } = setup({ items: MAX_PORTFOLIO_ITEMS });
    const err: any = await service
      .addPortfolioItem('u1', { title: 'Bucatarie', attachmentId: 'a1' } as PortfolioItemDto)
      .catch((e) => e);
    expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(err.getResponse()).toMatchObject({ code: 'COMPANY_PORTFOLIO_LIMIT_REACHED', details: { max: MAX_PORTFOLIO_ITEMS } });
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.companyPortfolioItem.count.mock.invocationCallOrder[0]);
    expect(tx.companyPortfolioItem.create).not.toHaveBeenCalled();
    expect(images.attachInTx).not.toHaveBeenCalled();
  });

  it('sub plafon se poate adauga; firmele peste plafon isi pastreaza lucrarile (doar adaugarea e oprita)', async () => {
    const ok = setup({ items: MAX_PORTFOLIO_ITEMS - 1 });
    await ok.service.addPortfolioItem('u1', { title: 'Bucatarie' } as PortfolioItemDto);
    expect(ok.tx.companyPortfolioItem.create).toHaveBeenCalledTimes(1);
    // peste plafon: stergerea si inlocuirea pozei merg in continuare
    const over = setup({ items: MAX_PORTFOLIO_ITEMS + 5 });
    await over.service.deletePortfolioItem('u1', 'item1');
    await over.service.setPortfolioImage('u1', 'item1', 'a1');
    expect(over.images.attachInTx).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['SUSPENDED', 'COMPANY_SUSPENDED'],
    ['REJECTED', 'COMPANY_NOT_APPROVED'],
  ])('firma %s nu poate incarca / atasa poze noi (%s)', async (status, code) => {
    const { service, images, tx } = setup({ status });
    const calls = [
      service.presignPortfolioImage('u1', { filename: 'a.png', mimeType: 'image/png', sizeBytes: 10 }),
      service.confirmPortfolioImage('u1', 'a1'),
      service.addPortfolioItem('u1', { title: 'Bucatarie', attachmentId: 'a1' } as PortfolioItemDto),
      service.setPortfolioImage('u1', 'item1', 'a1'),
    ];
    for (const call of calls) {
      const err: any = await call.catch((e) => e);
      expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(err.getResponse().code).toBe(code);
    }
    expect(images.presign).not.toHaveBeenCalled();
    expect(images.confirm).not.toHaveBeenCalled();
    expect(images.attachInTx).not.toHaveBeenCalled();
    expect(tx.companyPortfolioItem.create).not.toHaveBeenCalled();
  });

  it.each(['PENDING_VERIFICATION', 'APPROVED'])('firma %s poate incarca (isi pregateste portofoliul)', async (status) => {
    const { service, images } = setup({ status });
    await service.presignPortfolioImage('u1', { filename: 'a.png', mimeType: 'image/png', sizeBytes: 10 });
    await service.addPortfolioItem('u1', { title: 'Bucatarie', attachmentId: 'a1' } as PortfolioItemDto);
    expect(images.presign).toHaveBeenCalledTimes(1);
    expect(images.attachInTx).toHaveBeenCalledTimes(1);
  });

  it('firma suspendata poate sterge lucrari (si fisierele lor)', async () => {
    const { service, images } = setup({ status: 'SUSPENDED' });
    await service.deletePortfolioItem('u1', 'item1');
    expect(images.deleteObjects).toHaveBeenCalledTimes(1);
  });
});

describe('PortfolioItemDto (h1)', () => {
  it.each([
    [{ title: 'Bucatarie' }, true],
    [{ title: 'Bucatarie', attachmentId: '2f1d7c1e-1111-4a2b-9c3d-123456789abc' }, true],
    [{ title: 'Bucatarie', attachmentId: '../c2/a1' }, false],
  ])('%o valid=%p', async (body, ok) => {
    const errors = await validate(plainToInstance(PortfolioItemDto, body));
    expect(errors.length === 0).toBe(ok);
  });

  it('adresa scrisa de om nu mai e acceptata (forbidNonWhitelisted)', async () => {
    const errors = await validate(plainToInstance(PortfolioItemDto, { title: 'Bucatarie', imageUrl: 'https://x/y.jpg' }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((e) => e.property)).toEqual(['imageUrl']);
  });
});
