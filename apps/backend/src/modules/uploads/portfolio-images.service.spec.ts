import sharp from 'sharp';
import { detectImageMime } from './image-sanitizer';
import { MAX_STAGED_PORTFOLIO_UPLOADS, PortfolioImagesService } from './portfolio-images.service';
import { PORTFOLIO_ENTITY_TYPE, UploadsService } from './uploads.service';

// h1 (etapa 11): pozele din portofoliul firmei — cale noua de fisiere PUBLICE.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = {
  id: string; entityType: string; entityId: string; filename: string; mimeType: string;
  sizeBytes: number; storageKey: string; status: string; createdAt: Date;
};

const matches = (row: Row, where: any = {}): boolean =>
  Object.entries(where).every(([k, v]: [string, any]) => {
    const value = (row as any)[k];
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('in' in v) return v.in.includes(value);
      if ('lt' in v) return value < v.lt;
      if ('not' in v) return value !== v.not;
    }
    return value === v;
  });

function setup(initial: Row[] = []) {
  let rows: Row[] = initial.map((r) => ({ ...r }));
  const db: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    attachment: {
      count: jest.fn(async ({ where }) => rows.filter((r) => matches(r, where)).length),
      create: jest.fn(async ({ data }) => { rows.push({ createdAt: new Date(), ...data }); return data; }),
      findFirst: jest.fn(async ({ where }) => rows.find((r) => matches(r, where)) ?? null),
      findMany: jest.fn(async ({ where }) => rows.filter((r) => matches(r, where))),
      updateMany: jest.fn(async ({ where, data }) => {
        const hit = rows.filter((r) => matches(r, where));
        rows = rows.map((r) => (matches(r, where) ? { ...r, ...data } : r));
        return { count: hit.length };
      }),
      deleteMany: jest.fn(async ({ where }) => {
        const before = rows.length;
        rows = rows.filter((r) => !matches(r, where));
        return { count: before - rows.length };
      }),
      delete: jest.fn(),
    },
  };
  const prisma = { ...db, $transaction: jest.fn(async (fn: any) => fn(db)) };
  const storage = {
    headObject: jest.fn(),
    sealObject: jest.fn().mockResolvedValue(undefined),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    getPresignedUploadUrl: jest.fn().mockResolvedValue('https://storage/upload'),
    getPresignedDownloadUrl: jest.fn(async (key: string) => `https://storage/get/${key}`),
    getObjectBytes: jest.fn(),
    putObject: jest.fn().mockResolvedValue(undefined),
  };
  const queue = { add: jest.fn().mockResolvedValue(undefined), getJob: jest.fn().mockResolvedValue(null) };
  const uploads = new UploadsService(prisma as never, storage as never, queue as never);
  const service = new PortfolioImagesService(prisma as never, uploads, storage as never);
  return { service, uploads, prisma, storage, rows: () => rows };
}

const staged = (over: Partial<Row> = {}): Row => ({
  id: 'a1', entityType: PORTFOLIO_ENTITY_TYPE, entityId: 'c1', filename: 'lucrare.png', mimeType: 'image/png',
  sizeBytes: 100, storageKey: 'company_portfolio/c1/a1/clean-x.png', status: 'SAFE', createdAt: new Date(), ...over,
});

const png = () => sharp({ create: { width: 4, height: 4, channels: 3, background: '#a0522d' } }).png().toBuffer();
const jpeg = () => sharp({ create: { width: 4, height: 4, channels: 3, background: '#a0522d' } }).jpeg().toBuffer();

describe('PortfolioImagesService — incarcare (h1)', () => {
  it.each([
    ['application/pdf', 'lucrare.pdf'],
    ['application/zip', 'lucrari.zip'],
    ['image/svg+xml', 'logo.svg'],
    ['text/html', 'pagina.html'],
    ['', 'poza.heic'],
  ])('refuza %s cu FILE_TYPE_NOT_ALLOWED, fara rand si fara legatura', async (mimeType, filename) => {
    const { service, prisma, storage } = setup();
    await expect(service.presign('c1', { filename, mimeType, sizeBytes: 100 })).rejects.toMatchObject({
      status: 400,
      response: { code: 'FILE_TYPE_NOT_ALLOWED' },
    });
    expect(prisma.attachment.create).not.toHaveBeenCalled();
    expect(storage.getPresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('refuza fisierul prea mare cu FILE_TOO_LARGE', async () => {
    const { service, storage } = setup();
    await expect(
      service.presign('c1', { filename: 'mare.jpg', mimeType: 'image/jpeg', sizeBytes: 30 * 1024 * 1024 }),
    ).rejects.toMatchObject({ response: { code: 'FILE_TOO_LARGE' } });
    expect(storage.getPresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('cheia o face serverul, in spatiul firmei proprii', async () => {
    const { service, rows } = setup();
    const res = await service.presign('c1', { filename: '../../c2/evil.png', mimeType: 'image/png', sizeBytes: 100 });
    expect(res.storageKey).toMatch(new RegExp(`^company_portfolio/c1/${res.attachmentId}/`));
    expect(res.storageKey).not.toContain('/c2/');
    expect(rows()[0]).toMatchObject({ entityType: PORTFOLIO_ENTITY_TYPE, entityId: 'c1', status: 'PENDING_UPLOAD' });
  });

  it('plafon de incarcari neatasate; cele abandonate (peste o ora) se sterg cu tot cu fisier', async () => {
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const { service, rows, storage } = setup([
      staged({ id: 'old1', storageKey: 'company_portfolio/c1/old1/x.png', createdAt: old, status: 'PENDING_UPLOAD' }),
    ]);
    for (let i = 0; i < MAX_STAGED_PORTFOLIO_UPLOADS; i += 1) {
      await service.presign('c1', { filename: `p${i}.png`, mimeType: 'image/png', sizeBytes: 100 });
    }
    expect(storage.deleteObject).toHaveBeenCalledWith('company_portfolio/c1/old1/x.png');
    expect(rows().some((r) => r.id === 'old1')).toBe(false);
    await expect(service.presign('c1', { filename: 'extra.png', mimeType: 'image/png', sizeBytes: 100 })).rejects.toMatchObject({
      response: { code: 'FILE_LIMIT_REACHED' },
    });
  });

  it('confirmarea unei incarcari din alta firma → NOT_FOUND, fara atingere in storage', async () => {
    const { service, storage } = setup([staged({ entityId: 'c2', status: 'PENDING_UPLOAD' })]);
    await expect(service.confirm('c1', 'a1')).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
    expect(storage.headObject).not.toHaveBeenCalled();
    expect(storage.sealObject).not.toHaveBeenCalled();
  });
});

describe('PortfolioImagesService — verificarea dupa continut la scan (h1)', () => {
  async function scanWith(bytes: Buffer, mimeType = 'image/png') {
    const ctx = setup([staged({ status: 'PENDING_SCAN', mimeType, storageKey: 'company_portfolio/c1/a1/sealed-y.png', sizeBytes: bytes.length })]);
    ctx.storage.headObject.mockResolvedValue({ sizeBytes: bytes.length, mimeType, etag: 'e' });
    ctx.storage.getObjectBytes.mockResolvedValue(bytes);
    await ctx.uploads.scan('a1');
    return ctx;
  }

  it('HTML declarat drept PNG → BLOCKED, fara cheie curata', async () => {
    const { rows, storage } = await scanWith(Buffer.from('<html><script>alert(1)</script></html>'));
    expect(rows()[0].status).toBe('BLOCKED');
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('SVG declarat drept PNG → BLOCKED', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>');
    const { rows } = await scanWith(svg);
    expect(rows()[0].status).toBe('BLOCKED');
  });

  it('JPEG declarat drept PNG (extensie schimbata) → BLOCKED', async () => {
    const { rows } = await scanWith(await jpeg());
    expect(rows()[0].status).toBe('BLOCKED');
  });

  it('PNG adevarat → SAFE, re-encodat (fara metadate) intr-o cheie noua din spatiul firmei', async () => {
    const { rows, storage } = await scanWith(await png());
    expect(rows()[0].status).toBe('SAFE');
    expect(rows()[0].storageKey).toMatch(/^company_portfolio\/c1\/a1\/clean-[0-9a-f-]{36}\.png$/);
    expect(storage.putObject).toHaveBeenCalledTimes(1);
  });
});

describe('PortfolioImagesService — atasare, inlocuire, legaturi (h1)', () => {
  it('muta incarcarea SAFE pe lucrare si intoarce cheile pozei vechi', async () => {
    const { service, prisma, rows } = setup([
      staged({ id: 'new', storageKey: 'company_portfolio/c1/new/clean-n.png' }),
      staged({ id: 'old', entityId: 'item1', storageKey: 'company_portfolio/c1/old/clean-o.png' }),
    ]);
    const keys = await service.attachInTx(prisma as never, 'c1', 'item1', 'new');
    expect(keys).toEqual(['company_portfolio/c1/old/clean-o.png']);
    expect(rows().map((r) => [r.id, r.entityId])).toEqual([['new', 'item1']]);
  });

  it('incarcarea altei firme nu se poate atasa (NOT_FOUND)', async () => {
    const { service, prisma } = setup([staged({ entityId: 'c2' })]);
    await expect(service.attachInTx(prisma as never, 'c1', 'item1', 'a1')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('o incarcare neverificata inca nu se poate atasa (FILE_SCAN_BLOCKED)', async () => {
    const { service, prisma } = setup([staged({ status: 'PENDING_SCAN' })]);
    await expect(service.attachInTx(prisma as never, 'c1', 'item1', 'a1')).rejects.toMatchObject({
      response: { code: 'FILE_SCAN_BLOCKED' },
    });
  });

  it('legaturile publice: presigned GET doar pentru pozele SAFE ale lucrarilor', async () => {
    const { service } = setup([
      staged({ id: 'p1', entityId: 'item1', storageKey: 'k1' }),
      staged({ id: 'p2', entityId: 'item2', storageKey: 'k2', status: 'BLOCKED' }),
    ]);
    const urls = await service.urlsForItems(['item1', 'item2']);
    expect(Object.fromEntries(urls)).toEqual({ item1: 'https://storage/get/k1' });
  });
});

describe('PortfolioImagesService — dupa revizuirea de securitate (h1)', () => {
  it('1. un atasament de CERERE (sau chat / inspiratie) nu se poate atasa pe lucrare → 404, randul neatins', async () => {
    const { service, prisma, rows } = setup([
      staged({ id: 'req1', entityType: 'REQUEST', entityId: 'c1', storageKey: 'request/c1/req1/clean-r.png' }),
      staged({ id: 'msg1', entityType: 'MESSAGE', entityId: 'c1', storageKey: 'message/c1/msg1/clean-m.png' }),
    ]);
    for (const id of ['req1', 'msg1']) {
      await expect(service.attachInTx(prisma as never, 'c1', 'item1', id)).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
    }
    expect(rows().map((r) => [r.id, r.entityType, r.entityId])).toEqual([
      ['req1', 'REQUEST', 'c1'],
      ['msg1', 'MESSAGE', 'c1'],
    ]);
  });

  it('2. poza deja legata de alta lucrare a aceleiasi firme nu se poate "fura" → 404', async () => {
    const { service, prisma, rows } = setup([staged({ id: 'a1', entityId: 'item-other' })]);
    await expect(service.attachInTx(prisma as never, 'c1', 'item1', 'a1')).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
    expect(rows()[0].entityId).toBe('item-other');
  });

  async function scanWith(bytes: Buffer, mimeType: string) {
    const ctx = setup([staged({ status: 'PENDING_SCAN', mimeType, storageKey: 'company_portfolio/c1/a1/sealed-y', sizeBytes: bytes.length })]);
    ctx.storage.headObject.mockResolvedValue({ sizeBytes: bytes.length, mimeType, etag: 'e' });
    ctx.storage.getObjectBytes.mockResolvedValue(bytes);
    await ctx.uploads.scan('a1');
    return ctx;
  }

  it('3a. WebP cu antet RIFF corect, dar continut nedecodabil → BLOCKED', async () => {
    const fake = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x20, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(24, 0x41)]);
    const { rows, storage } = await scanWith(fake, 'image/webp');
    expect(rows()[0].status).toBe('BLOCKED');
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('3b. poliglot JPEG + HTML la coada → SAFE, dar fisierul public e re-encodat, fara coada', async () => {
    const polyglot = Buffer.concat([await jpeg(), Buffer.from('<html><script>alert(1)</script></html>')]);
    const { rows, storage } = await scanWith(polyglot, 'image/jpeg');
    expect(rows()[0].status).toBe('SAFE');
    const written: Buffer = storage.putObject.mock.calls[0][1];
    expect(written.includes(Buffer.from('<script>'))).toBe(false);
    expect(detectImageMime(written)).toBe('image/jpeg');
  });

  it('4. confirmarea repetata dupa SAFE nu da legatura de descarcare', async () => {
    const { service } = setup([staged({ status: 'SAFE' })]);
    const first = await service.confirm('c1', 'a1');
    const again = await service.confirm('c1', 'a1');
    expect(first.downloadUrl).toBeNull();
    expect(again.downloadUrl).toBeNull();
    expect(again.status).toBe('SAFE');
  });

  it('m2 (7.): un rand atasat intre citire si stergere NU e sters de curatarea incarcarilor abandonate', async () => {
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const ctx = setup([staged({ id: 'late', createdAt: old, storageKey: 'company_portfolio/c1/late/clean-l.png' })]);
    const realFindMany = ctx.prisma.attachment.findMany.getMockImplementation()!;
    ctx.prisma.attachment.findMany.mockImplementationOnce(async (args: any) => {
      const snapshot = await realFindMany(args);
      // alta cerere ataseaza randul unei lucrari exact acum
      await ctx.prisma.attachment.updateMany({ where: { id: 'late' }, data: { entityId: 'item1' } });
      return snapshot;
    });
    await ctx.service.presign('c1', { filename: 'n.png', mimeType: 'image/png', sizeBytes: 100 });
    expect(ctx.rows().find((r) => r.id === 'late')).toMatchObject({ entityId: 'item1' });
    expect(ctx.storage.deleteObject).not.toHaveBeenCalledWith('company_portfolio/c1/late/clean-l.png');
  });

  it('m3: atasarea ia blocarea pe lucrare; o mutare concurenta a aceleiasi poze → 404 (updateMany conditionat)', async () => {
    const ctx = setup([staged({ id: 'a1' })]);
    const realFindMany = ctx.prisma.attachment.findMany.getMockImplementation()!;
    // relink citeste randul ca neatasat, dar intre timp alta cerere l-a mutat pe alta lucrare
    ctx.prisma.attachment.findMany
      .mockImplementationOnce(realFindMany) // poza veche a lucrarii
      .mockImplementationOnce(async (args: any) => {
        const snapshot = await realFindMany(args);
        await ctx.prisma.attachment.updateMany({ where: { id: 'a1' }, data: { entityId: 'item-other' } });
        return snapshot;
      });
    await expect(ctx.service.attachInTx(ctx.prisma as never, 'c1', 'item1', 'a1')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
    expect(ctx.rows()[0].entityId).toBe('item-other');
    const lockSql = ctx.prisma.$queryRaw.mock.calls.map((c: any[]) => c.slice(1).join(' ')).join(' ');
    expect(lockSql).toContain('portfolio_item:item1');
  });

  it('m9: esecul stergerii din storage scrie cheia in jurnal', async () => {
    const { service, storage } = setup();
    const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
    storage.deleteObject.mockRejectedValue(new Error('down'));
    await service.deleteObjects(['company_portfolio/c1/a1/clean-x.png']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('company_portfolio/c1/a1/clean-x.png'));
  });
});

describe('detectImageMime', () => {
  it('recunoaste JPEG / PNG / WebP dupa continut, nimic altceva', async () => {
    expect(detectImageMime(await jpeg())).toBe('image/jpeg');
    expect(detectImageMime(await png())).toBe('image/png');
    const webp = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).webp().toBuffer();
    expect(detectImageMime(webp)).toBe('image/webp');
    expect(detectImageMime(Buffer.from('<svg></svg>'))).toBeNull();
    expect(detectImageMime(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(detectImageMime(Buffer.alloc(0))).toBeNull();
  });
});
