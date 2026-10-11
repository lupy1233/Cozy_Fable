import sharp from 'sharp';
import { NEUTRAL_STORAGE_KEY, UploadsService } from './uploads.service';

const base = { id: 'a1', entityType: 'REQUEST', entityId: 'r1', filename: 'plan.pdf', mimeType: 'application/pdf', sizeBytes: 100, storageKey: 'key', status: 'PENDING_UPLOAD', createdAt: new Date() };
function setup(overrides = {}) {
  let attachment: typeof base | null = { ...base, ...overrides };
  const db = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    attachment: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(undefined),
      findFirst: jest.fn(async ({ where }) => attachment && (!where.status || where.status === attachment.status) ? attachment : null),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(async ({ where, data }) => {
        if (!attachment || where.status && where.status !== attachment.status) return { count: 0 };
        attachment = { ...attachment, ...data }; return { count: 1 };
      }),
      delete: jest.fn(async () => { attachment = null; }),
    },
  };
  const prisma = { ...db, $transaction: jest.fn(async (fn) => fn(db)) };
  const storage = {
    headObject: jest.fn().mockResolvedValue({ sizeBytes: 100, mimeType: 'application/pdf', etag: 'etag' }),
    sealObject: jest.fn().mockResolvedValue(undefined),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    getPresignedUploadUrl: jest.fn().mockResolvedValue('https://storage/upload'),
    getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://storage/download'),
    getObjectBytes: jest.fn(),
    putObject: jest.fn().mockResolvedValue(undefined),
  };
  const queue = { add: jest.fn().mockResolvedValue(undefined), getJob: jest.fn().mockResolvedValue(null) };
  return { prisma, storage, queue, service: new UploadsService(prisma as never, storage as never, queue as never) };
}

describe('upload integrity and scanning', () => {
  it('reserves the cap inside the same transaction and sanitizes the upload key', async () => {
    const { service, prisma } = setup();
    const result = await service.presign('REQUEST', 'r1', { filename: 'plan etaj.pdf', sizeBytes: 100, mimeType: 'application/pdf' });
    expect(result.storageKey).toMatch(/plan_etaj.pdf$/);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.attachment.count.mock.invocationCallOrder[0]);
    prisma.attachment.count.mockResolvedValue(10);
    await expect(service.presign('REQUEST', 'r1', base, 10)).rejects.toMatchObject({ response: { code: 'FILE_LIMIT_REACHED' } });
    expect(prisma.attachment.create).toHaveBeenCalledTimes(1);
  });

  it('checks MIME and actual bytes before creating an immutable sealed copy', async () => {
    const { service, storage, queue } = setup();
    const result = await service.confirm('REQUEST', 'r1', 'a1');
    expect(result.status).toBe('PENDING_SCAN');
    expect(result.downloadUrl).toBeNull();
    // E-client-9: cheia sigilata nu mai contine numele fisierului
    expect(storage.sealObject).toHaveBeenCalledWith('key', expect.stringMatching(/^request\/r1\/a1\/sealed-[0-9a-f-]{36}\.pdf$/), 'etag');
    expect(queue.add).toHaveBeenCalledWith('scan.upload', { attachmentId: 'a1' }, expect.objectContaining({ delay: 2000, attempts: 3 }));
    await service.scan('a1');
    const ready = await service.confirm('REQUEST', 'r1', 'a1');
    expect(ready.status).toBe('SAFE');
    expect(ready.downloadUrl).toBe('https://storage/download');
    expect(storage.sealObject).toHaveBeenCalledTimes(1);
  });

  it.each([{ sizeBytes: 101, mimeType: 'application/pdf' }, { sizeBytes: 100, mimeType: 'text/html' }])('rejects mismatched stored metadata %o', async (metadata) => {
    const { service, storage } = setup();
    storage.headObject.mockResolvedValue({ ...metadata, etag: 'etag' });
    await expect(service.confirm('REQUEST', 'r1', 'a1')).rejects.toMatchObject({ status: 400 });
    expect(storage.sealObject).not.toHaveBeenCalled();
    expect((await service.confirm('REQUEST', 'r1', 'a1')).status).toBe('BLOCKED');
  });

  it('a missing object cannot be confirmed', async () => {
    const { service, storage } = setup();
    storage.headObject.mockResolvedValue(null);
    await expect(service.confirm('REQUEST', 'r1', 'a1')).rejects.toMatchObject({ response: { code: 'UPLOAD_NOT_FOUND_IN_STORAGE' } });
  });

  it('Redis failure preserves PENDING_SCAN and reconciliation retries it', async () => {
    const { service, queue, prisma } = setup();
    queue.add.mockRejectedValueOnce(new Error('Redis down'));
    expect((await service.confirm('REQUEST', 'r1', 'a1')).status).toBe('PENDING_SCAN');
    prisma.attachment.findMany.mockResolvedValueOnce([{ id: 'a1' }]);
    await service.reconcileScans();
    expect(queue.add).toHaveBeenCalledTimes(2);
  });

  it('malware mock blocks the sealed object and repeated/deleted jobs have no effect', async () => {
    const { service, prisma } = setup({ filename: 'plan-malware.pdf', status: 'PENDING_SCAN' });
    await service.scan('a1');
    expect((await service.confirm('REQUEST', 'r1', 'a1')).status).toBe('BLOCKED');
    await service.scan('a1');
    expect(prisma.attachment.updateMany).toHaveBeenCalledTimes(1);
    await service.remove('REQUEST', 'r1', 'a1');
    await service.scan('a1');
    expect(prisma.attachment.updateMany).toHaveBeenCalledTimes(1);
  });

  it('relink rejects foreign and pending attachments', async () => {
    const { service, prisma } = setup();
    await expect(service.relink(['foreign'], 'MESSAGE', 'thread', 'message')).rejects.toMatchObject({ status: 404 });
    prisma.attachment.findMany.mockResolvedValue([{ id: 'a1', status: 'PENDING_SCAN' }]);
    await expect(service.relink(['a1'], 'MESSAGE', 'thread', 'message')).rejects.toMatchObject({ response: { code: 'FILE_SCAN_BLOCKED' } });
  });
});

// E-client-9 (C7-3) — poze fara EXIF/GPS, chei si nume neutre pentru firme.
describe('image sanitizing and neutral names (E-client-9)', () => {
  const jpegWithGps = () =>
    sharp({ create: { width: 16, height: 16, channels: 3, background: '#aa8866' } })
      .jpeg()
      .withExif({ IFD0: { Copyright: 'Ana' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '44/1 26/1 0/1' } })
      .toBuffer();

  it('scanul unei imagini scrie o cheie curata fara EXIF si actualizeaza sizeBytes', async () => {
    const input = await jpegWithGps();
    const sealed = 'request/r1/a1/sealed-11111111-1111-4111-8111-111111111111.jpg';
    const { service, storage, prisma } = setup({
      filename: 'Str Aviatorilor 10 Ana.jpg', mimeType: 'image/jpeg', sizeBytes: input.length,
      storageKey: sealed, status: 'PENDING_SCAN',
    });
    storage.headObject.mockResolvedValue({ sizeBytes: input.length, mimeType: 'image/jpeg', etag: 'etag' });
    storage.getObjectBytes.mockResolvedValue(input);
    await service.scan('a1');
    expect(storage.putObject).toHaveBeenCalledTimes(1);
    const [cleanKey, body, contentType] = storage.putObject.mock.calls[0];
    expect(cleanKey).toMatch(/^request\/r1\/a1\/clean-[0-9a-f-]{36}\.jpg$/);
    expect(cleanKey).toMatch(NEUTRAL_STORAGE_KEY);
    expect(contentType).toBe('image/jpeg');
    expect((await sharp(body).metadata()).exif).toBeUndefined();
    expect(prisma.attachment.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: { status: 'SAFE', storageKey: cleanKey, sizeBytes: body.length } }));
    const ready = await service.confirm('REQUEST', 'r1', 'a1');
    expect(ready.status).toBe('SAFE');
    expect(ready.sizeBytes).toBe(body.length);
    expect(storage.deleteObject).toHaveBeenCalledWith(sealed);
  });

  it('imagine corupta → BLOCKED, fara scriere in storage', async () => {
    const { service, storage } = setup({ filename: 'poza.jpg', mimeType: 'image/jpeg', sizeBytes: 10, status: 'PENDING_SCAN' });
    storage.headObject.mockResolvedValue({ sizeBytes: 10, mimeType: 'image/jpeg', etag: 'etag' });
    storage.getObjectBytes.mockResolvedValue(Buffer.from('not-a-jpeg'));
    await service.scan('a1');
    expect(storage.putObject).not.toHaveBeenCalled();
    expect((await service.confirm('REQUEST', 'r1', 'a1')).status).toBe('BLOCKED');
  });

  it('eroarea de storage la citire urca (retry BullMQ), randul ramane PENDING_SCAN', async () => {
    const { service, storage, prisma } = setup({ filename: 'poza.jpg', mimeType: 'image/jpeg', sizeBytes: 10, status: 'PENDING_SCAN' });
    storage.headObject.mockResolvedValue({ sizeBytes: 10, mimeType: 'image/jpeg', etag: 'etag' });
    storage.getObjectBytes.mockRejectedValue(new Error('S3 down'));
    await expect(service.scan('a1')).rejects.toThrow('S3 down');
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
  });

  it('PDF → SAFE fara re-encodare', async () => {
    const { service, storage } = setup({ status: 'PENDING_SCAN' });
    await service.scan('a1');
    expect(storage.getObjectBytes).not.toHaveBeenCalled();
    expect(storage.putObject).not.toHaveBeenCalled();
    expect((await service.confirm('REQUEST', 'r1', 'a1')).status).toBe('SAFE');
  });

  it('listForEntity cu neutralNames → attachment-N.ext si Content-Disposition neutru', async () => {
    const { service, prisma, storage } = setup();
    prisma.attachment.findMany.mockResolvedValue([
      { ...base, id: 'x1', filename: 'Ana Popescu Str Aviatorilor.jpg', mimeType: 'image/jpeg', status: 'SAFE' },
      { ...base, id: 'x2', filename: 'plan casa Popescu.pdf', status: 'SAFE' },
      { ...base, id: 'x3', filename: 'in scan.png', mimeType: 'image/png', status: 'PENDING_SCAN' },
    ]);
    const neutral = await service.listForEntity('REQUEST', 'r1', undefined, { neutralNames: true });
    expect(neutral.map((a) => a.filename)).toEqual(['attachment-1.jpg', 'attachment-2.pdf', 'attachment-3.png']);
    expect(neutral[2].downloadUrl).toBeNull();
    expect(storage.getPresignedDownloadUrl).toHaveBeenCalledWith('key', { downloadName: 'attachment-1.jpg' });
    expect(storage.getPresignedDownloadUrl).toHaveBeenCalledWith('key', { downloadName: 'attachment-2.pdf' });
    // proprietarul pastreaza numele original
    const owner = await service.listForEntity('REQUEST', 'r1');
    expect(owner[0].filename).toBe('Ana Popescu Str Aviatorilor.jpg');
  });

  it('jobul legacy re-cheie randurile REQUEST SAFE: imaginea curatata, PDF-ul copiat in cheie neutra', async () => {
    const input = await jpegWithGps();
    type Row = typeof base;
    const rows: Record<string, Row> = {
      l1: { ...base, id: 'l1', filename: 'Ana.jpg', mimeType: 'image/jpeg', sizeBytes: input.length, storageKey: 'request/r1/l1/Ana.jpg', status: 'SAFE' },
      l2: { ...base, id: 'l2', filename: 'plan Ana.pdf', storageKey: 'request/r1/l2/plan_Ana.pdf.sealed-22222222-2222-4222-8222-222222222222', status: 'SAFE' },
    };
    const oldPdfKey = rows.l2.storageKey;
    const { service, storage, prisma } = setup();
    prisma.attachment.findMany.mockResolvedValue(Object.values(rows));
    prisma.attachment.updateMany.mockImplementation(async ({ where, data }: { where: { id: string; status: string; storageKey: string }; data: Partial<Row> }) => {
      const row = rows[where.id];
      if (!row || row.status !== where.status || row.storageKey !== where.storageKey) return { count: 0 };
      rows[where.id] = { ...row, ...data };
      return { count: 1 };
    });
    storage.headObject.mockResolvedValue({ sizeBytes: 100, mimeType: 'x', etag: 'etag' });
    storage.getObjectBytes.mockResolvedValue(input);
    const res = await service.sanitizeLegacyRequestAttachments(50);
    expect(res).toEqual({ more: false });
    expect(prisma.attachment.findMany.mock.calls[0][0].where).toMatchObject({ entityType: 'REQUEST', status: 'SAFE' });
    expect(rows.l1.storageKey).toMatch(/^request\/r1\/l1\/clean-[0-9a-f-]{36}\.jpg$/);
    expect(rows.l1.sizeBytes).not.toBe(input.length);
    expect(rows.l2.storageKey).toMatch(/^request\/r1\/l2\/sealed-[0-9a-f-]{36}\.pdf$/);
    expect(storage.sealObject).toHaveBeenCalledWith(oldPdfKey, rows.l2.storageKey, 'etag');
    expect(storage.deleteObject).toHaveBeenCalledWith('request/r1/l1/Ana.jpg');
    expect(storage.deleteObject).toHaveBeenCalledWith(oldPdfKey);
    // pagina plina → cursor pentru urmatorul job
    prisma.attachment.findMany.mockResolvedValue([rows.l1, rows.l2]);
    expect(await service.sanitizeLegacyRequestAttachments(2)).toEqual({ more: true, cursor: 'l2' });
  });
});
