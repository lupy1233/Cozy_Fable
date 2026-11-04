import { randomUUID } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { UploadsService } from './uploads.service';
import { testDatabaseUrl } from '../../test/db-guard';

// E-admin-platform-14: doar host local (garda db-guard), altfel testele refuza sa porneasca
const url = testDatabaseUrl();
(url ? describe : describe.skip)('attachment cap under PostgreSQL concurrency', () => {
  const prisma = new PrismaService(url ? { datasources: { db: { url } } } : undefined);
  const storage = { getPresignedUploadUrl: jest.fn().mockResolvedValue('https://storage/upload') };
  const uploads = new UploadsService(prisma, storage as never, {} as never);
  const entityId = randomUUID();
  afterAll(async () => {
    await prisma.attachment.deleteMany({ where: { entityType: 'UPLOAD_INTEGRATION_TEST', entityId } });
    await prisma.$disconnect();
  });
  it('only one of two concurrent presigns takes the last slot', async () => {
    const input = { filename: 'test.pdf', sizeBytes: 100, mimeType: 'application/pdf' };
    const outcomes = await Promise.allSettled([uploads.presign('UPLOAD_INTEGRATION_TEST', entityId, input, 1), uploads.presign('UPLOAD_INTEGRATION_TEST', entityId, input, 1)]);
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.attachment.count({ where: { entityType: 'UPLOAD_INTEGRATION_TEST', entityId } })).toBe(1);
  });
});
