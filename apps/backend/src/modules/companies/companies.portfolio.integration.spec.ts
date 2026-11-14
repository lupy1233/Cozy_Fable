import { randomUUID } from 'node:crypto';
import { testDatabaseUrl } from '../../test/db-guard';
import { createTestPrisma } from '../../test/money-fixtures';
import { MAX_PORTFOLIO_ITEMS, PortfolioImagesService } from '../uploads/portfolio-images.service';
import { PORTFOLIO_ENTITY_TYPE, UploadsService } from '../uploads/uploads.service';
import { CompaniesService } from './companies.service';

// h1 (etapa 11) — poza din portofoliu pe PostgreSQL real (storage simulat): incarcarea altei
// firme nu se poate atasa, lucrarea nu ramane fara tranzactie, stergerea nu lasa randuri / fisiere.

const url = testDatabaseUrl();

(url ? describe : describe.skip)('portofoliul firmei pe PostgreSQL (h1)', () => {
  jest.setTimeout(60_000);
  const prisma = url ? createTestPrisma(url).prisma : (undefined as never);
  const storage = {
    deleteObject: jest.fn().mockResolvedValue(undefined),
    getPresignedDownloadUrl: jest.fn(async (key: string) => `https://storage/get/${key}`),
    getPresignedUploadUrl: jest.fn().mockResolvedValue('https://storage/put'),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uploads = url ? new UploadsService(prisma, storage as any, { add: jest.fn(), getJob: jest.fn() } as any) : (undefined as never);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const images = url ? new PortfolioImagesService(prisma, uploads, storage as any) : (undefined as never);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = url ? new CompaniesService(prisma, {} as any, {} as any, {} as any, undefined, images) : (undefined as never);
  const companyIds: string[] = [];
  const userIds: string[] = [];

  async function firm(tag: string) {
    const company = await prisma.company.create({
      data: {
        name: `h1 ${tag}`, cui: randomUUID(), regComNumber: 'test', addressText: 'test',
        county: 'test', city: 'test', lat: 44.43, lng: 26.1, status: 'APPROVED',
      },
    });
    companyIds.push(company.id);
    const user = await prisma.user.create({
      data: { email: `h1.${tag}.${randomUUID().slice(0, 6)}@firma.example`, name: 'h1', role: 'COMPANY_USER', passwordHash: 'test' },
    });
    userIds.push(user.id);
    await prisma.companyMember.create({ data: { companyId: company.id, userId: user.id, role: 'OWNER' } });
    return { companyId: company.id, userId: user.id };
  }

  async function safeUpload(companyId: string) {
    const id = randomUUID();
    await prisma.attachment.create({
      data: {
        id, entityType: PORTFOLIO_ENTITY_TYPE, entityId: companyId, filename: 'p.png', mimeType: 'image/png',
        sizeBytes: 10, storageKey: `company_portfolio/${companyId}/${id}/clean-${randomUUID()}.png`, status: 'SAFE',
      },
    });
    return id;
  }

  afterAll(async () => {
    if (!url) return;
    await prisma.attachment.deleteMany({
      where: { entityType: PORTFOLIO_ENTITY_TYPE, OR: companyIds.map((c) => ({ storageKey: { startsWith: `company_portfolio/${c}/` } })) },
    });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it('incarcarea altei firme e refuzata si nu se creeaza lucrarea', async () => {
    const a = await firm('a');
    const b = await firm('b');
    const foreign = await safeUpload(b.companyId);
    await expect(service.addPortfolioItem(a.userId, { title: 'Bucatarie', attachmentId: foreign })).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
    expect(await prisma.companyPortfolioItem.count({ where: { companyId: a.companyId } })).toBe(0);
    expect((await prisma.attachment.findUnique({ where: { id: foreign } }))?.entityId).toBe(b.companyId);
  });

  // revizuire M2: plafonul se verifica sub FOR UPDATE pe randul firmei → doua adaugari simultane
  // la limita nu trec amandoua
  it(`plafonul de ${MAX_PORTFOLIO_ITEMS} lucrari tine si la adaugari simultane`, async () => {
    const a = await firm('limit');
    await prisma.companyPortfolioItem.createMany({
      data: Array.from({ length: MAX_PORTFOLIO_ITEMS - 1 }, (_, i) => ({ companyId: a.companyId, title: `p${i}` })),
    });
    const results = await Promise.allSettled([
      service.addPortfolioItem(a.userId, { title: 'Ultima A' }),
      service.addPortfolioItem(a.userId, { title: 'Ultima B' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.companyPortfolioItem.count({ where: { companyId: a.companyId } })).toBe(MAX_PORTFOLIO_ITEMS);
  });

  it('adaugare cu poza → legatura presemnata; stergere → fara rand si fara fisier', async () => {
    const a = await firm('c');
    const upload = await safeUpload(a.companyId);
    const company = await service.addPortfolioItem(a.userId, { title: 'Dressing', attachmentId: upload });
    const item = company.portfolio[0];
    expect(item.imageUrl).toMatch(/^https:\/\/storage\/get\/company_portfolio\//);
    const row = await prisma.attachment.findUnique({ where: { id: upload } });
    expect(row?.entityId).toBe(item.id);

    storage.deleteObject.mockClear();
    await service.deletePortfolioItem(a.userId, item.id);
    expect(await prisma.attachment.findUnique({ where: { id: upload } })).toBeNull();
    expect(storage.deleteObject).toHaveBeenCalledWith(row?.storageKey);
  });
});
