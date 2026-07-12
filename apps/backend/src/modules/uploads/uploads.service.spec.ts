import { UploadsService } from './uploads.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { StorageService } from '../../infra/storage/storage.service';

// Fluxul presigned (invarianta 3.4): presign → PUT direct → confirm cu scan mock.

function makeDeps(opts: {
  count?: number;
  attachment?: Record<string, unknown> | null;
  objectExists?: boolean;
}) {
  const prisma = {
    attachment: {
      count: jest.fn().mockResolvedValue(opts.count ?? 0),
      create: jest.fn().mockResolvedValue(undefined),
      findFirst: jest.fn().mockResolvedValue(opts.attachment ?? null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 'a1',
          filename: 'x.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
          storageKey: 'k',
          createdAt: new Date(),
          ...data,
        }),
      ),
      updateMany: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const storage = {
    getPresignedUploadUrl: jest.fn().mockResolvedValue('https://minio/put'),
    getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://minio/get'),
    objectExists: jest.fn().mockResolvedValue(opts.objectExists ?? true),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return {
    service: new UploadsService(prisma as PrismaService, storage as StorageService),
    prisma,
    storage,
  };
}

const input = { filename: 'plan etaj.pdf', mimeType: 'application/pdf', sizeBytes: 1000 };

describe('UploadsService.presign', () => {
  it('respinge cu FILE_LIMIT_REACHED cand limita per entitate e atinsa', async () => {
    const { service } = makeDeps({ count: 10 });
    await expect(service.presign('REQUEST', 'r1', input, 10)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FILE_LIMIT_REACHED' }),
    });
  });

  it('creeaza rand PENDING_UPLOAD cu cheie sanitizata si intoarce URL presigned', async () => {
    const { service, prisma, storage } = makeDeps({ count: 0 });
    const res = await service.presign('REQUEST', 'r1', input);
    expect(prisma.attachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING_UPLOAD', filename: 'plan etaj.pdf' }),
      }),
    );
    // numele din cheia de storage nu contine spatii (sanitizat)
    expect(res.storageKey).toMatch(/^request\/r1\/.+\/plan_etaj.pdf$/);
    expect(res.uploadUrl).toBe('https://minio/put');
    expect(storage.getPresignedUploadUrl).toHaveBeenCalledWith(res.storageKey, 'application/pdf', 1000);
  });
});

describe('UploadsService.confirm (scan mock, invarianta 3.4)', () => {
  const base = {
    id: 'a1',
    entityType: 'REQUEST',
    entityId: 'r1',
    mimeType: 'application/pdf',
    sizeBytes: 100,
    storageKey: 'k',
    createdAt: new Date(),
  };

  it('numele cu "malware" → BLOCKED', async () => {
    const { service, prisma } = makeDeps({ attachment: { ...base, filename: 'plan-malware.pdf' } });
    const dto = await service.confirm('REQUEST', 'r1', 'a1');
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'BLOCKED' } }),
    );
    expect(dto.downloadUrl).toBeNull(); // fisier blocat nu primeste URL de download
  });

  it('nume curat → SAFE cu URL de download', async () => {
    const { service } = makeDeps({ attachment: { ...base, filename: 'plan.pdf' } });
    const dto = await service.confirm('REQUEST', 'r1', 'a1');
    expect(dto.status).toBe('SAFE');
    expect(dto.downloadUrl).toBe('https://minio/get');
  });

  it('obiect lipsa in storage → UPLOAD_NOT_FOUND_IN_STORAGE', async () => {
    const { service } = makeDeps({
      attachment: { ...base, filename: 'plan.pdf' },
      objectExists: false,
    });
    await expect(service.confirm('REQUEST', 'r1', 'a1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'UPLOAD_NOT_FOUND_IN_STORAGE' }),
    });
  });
});

describe('UploadsService.relink', () => {
  it('atasament ne-SAFE → FILE_SCAN_BLOCKED (nu poate fi atasat mesajului/ofertei)', async () => {
    const { service, prisma } = makeDeps({});
    prisma.attachment.findMany.mockResolvedValue([{ id: 'a1', status: 'PENDING_SCAN' }]);
    await expect(service.relink(['a1'], 'MESSAGE', 'th1', 'm1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FILE_SCAN_BLOCKED' }),
    });
  });

  it('id strain de bucket-ul sursa → NOT_FOUND (nu poti fura atasamentele altcuiva)', async () => {
    const { service, prisma } = makeDeps({});
    prisma.attachment.findMany.mockResolvedValue([]);
    await expect(service.relink(['a1'], 'MESSAGE', 'th1', 'm1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'NOT_FOUND' }),
    });
  });
});
