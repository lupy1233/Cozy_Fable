import type { PrismaClient } from '@prisma/client';
import { CDN, PINS } from '../../../prisma/inspiration-catalog';
import { seedGreenInspiration } from '../../../prisma/seed-green-inspiration';

const greenEnv: NodeJS.ProcessEnv = {
  DEPLOYMENT_SLOT: 'green', GREEN_ISOLATED_PREVIEW: 'true',
  DATABASE_URL: 'postgresql://preview:secret@green-postgres.railway.internal/green_preview',
  REDIS_HOST: 'green-redis.railway.internal', S3_BUCKET: 'green-preview',
  SMTP_HOST: 'green-mail.railway.internal', RUN_GREEN_INSPIRATION: '1',
};
type Photo = { imageUrl: string; companyId: string; published: boolean; deletedAt: Date | null };

function fixture() {
  const companies: { id: string; status: string; deletedAt: Date | null }[] = [];
  const photos: Photo[] = [];
  const db = {
    company: {
      findMany: jest.fn(async () => companies),
      create: jest.fn(async () => { const company = { id: 'source', status: 'APPROVED', deletedAt: null }; companies.push(company); return company; }),
    },
    inspirationPhoto: {
      findMany: jest.fn(async ({ where }: { where: { imageUrl: { in: string[] } } }) => photos.filter((photo) => where.imageUrl.in.includes(photo.imageUrl))),
      createMany: jest.fn(async ({ data }: { data: Photo[] }) => { photos.push(...data.map((photo) => ({ ...photo, deletedAt: null }))); return { count: data.length }; }),
    },
    $queryRaw: jest.fn(async () => []),
  };
  const transaction = jest.fn(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db));
  return { companies, photos, db, transaction, prisma: { ...db, $transaction: transaction } as unknown as PrismaClient };
}

describe('isolated Green curated inspiration seed', () => {
  it.each([
    { DEPLOYMENT_SLOT: 'blue' }, { GREEN_ISOLATED_PREVIEW: 'false' },
    { DATABASE_URL: 'postgresql://preview:secret@Postgres.railway.internal/green_preview' },
    { DATABASE_URL: 'postgresql://preview:secret@green-postgres.railway.internal/railway' },
    { REDIS_HOST: 'redis.railway.internal' }, { S3_BUCKET: 'uploads' },
    { SMTP_HOST: 'smtp.example.com' }, { STRIPE_SECRET_KEY: 'configured' },
    { RUN_GREEN_INSPIRATION: undefined },
  ])('rejects unsafe target/opt-in before querying: %p', async (patch) => {
    const { prisma, db, transaction } = fixture();
    await expect(seedGreenInspiration(prisma, { ...greenEnv, ...patch }, true)).rejects.toThrow();
    expect(db.company.findMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('reports the exact curated data plan without writes', async () => {
    const { prisma, db, transaction } = fixture();
    await expect(seedGreenInspiration(prisma, { ...greenEnv, RUN_GREEN_INSPIRATION: undefined })).resolves.toEqual({
      mode: 'dry-run', curated: 70, companyCreates: 1, photoCreates: 70, alreadyPresent: 0,
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(db.company.create).not.toHaveBeenCalled();
    expect(db.inspirationPhoto.createMany).not.toHaveBeenCalled();
  });

  it('inserts only curated photos, keeps unrelated content, and makes repeat runs no-ops', async () => {
    const { prisma, db, photos } = fixture();
    const unrelated = { imageUrl: 'https://example.com/existing.jpg', companyId: 'existing', published: false, deletedAt: null };
    photos.push(unrelated);
    expect(await seedGreenInspiration(prisma, greenEnv, true)).toMatchObject({ companyCreates: 1, photoCreates: 70 });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.company.create).toHaveBeenCalledTimes(1);
    const inserted = db.inspirationPhoto.createMany.mock.calls[0][0].data;
    expect(inserted).toHaveLength(PINS.length);
    expect(new Set(inserted.map((photo) => photo.imageUrl)).size).toBe(70);
    expect(inserted.every((photo) => photo.companyId === 'source' && photo.published)).toBe(true);
    expect(photos[0]).toBe(unrelated);
    expect(await seedGreenInspiration(prisma, greenEnv, true)).toMatchObject({ companyCreates: 0, photoCreates: 0, alreadyPresent: 70 });
    expect(db.inspirationPhoto.createMany).toHaveBeenCalledTimes(1);
  });

  it.each(['BLOCKED', 'PENDING'])('does not approve an existing %s attribution company', async (status) => {
    const { prisma, companies, db } = fixture();
    companies.push({ id: 'source', status, deletedAt: null });
    await expect(seedGreenInspiration(prisma, greenEnv, true)).rejects.toThrow('needs review');
    expect(db.company.create).not.toHaveBeenCalled();
    expect(db.inspirationPhoto.createMany).not.toHaveBeenCalled();
  });

  it.each([
    { companyId: 'other', published: true, deletedAt: null },
    { companyId: 'source', published: false, deletedAt: null },
    { companyId: 'source', published: true, deletedAt: new Date('2026-01-01') },
  ])('preserves existing attribution and publication decisions: %p', async (photo) => {
    const { prisma, companies, photos, db } = fixture();
    companies.push({ id: 'source', status: 'APPROVED', deletedAt: null });
    photos.push({ imageUrl: `${CDN}/${PINS[0].img}`, ...photo });
    await expect(seedGreenInspiration(prisma, greenEnv, true)).rejects.toThrow('need review');
    expect(db.inspirationPhoto.createMany).not.toHaveBeenCalled();
  });
});
