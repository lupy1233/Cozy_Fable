import { randomUUID } from 'crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';

const endpoint = process.env.TEST_S3_ENDPOINT;
(endpoint ? describe : describe.skip)('upload sealing against isolated S3/MinIO', () => {
  jest.setTimeout(20_000);
  const settings: Record<string, string> = {
    S3_ENDPOINT: endpoint!, S3_REGION: 'us-east-1',
    S3_BUCKET: process.env.TEST_S3_BUCKET ?? 'uploads',
    S3_ACCESS_KEY: process.env.TEST_S3_ACCESS_KEY ?? 'minioadmin',
    S3_SECRET_KEY: process.env.TEST_S3_SECRET_KEY ?? 'minioadmin',
  };
  const storage = new StorageService({ getOrThrow: (key: string) => settings[key], get: (key: string) => settings[key] } as never);
  const client = new S3Client({ endpoint, region: settings.S3_REGION, forcePathStyle: true, credentials: { accessKeyId: settings.S3_ACCESS_KEY, secretAccessKey: settings.S3_SECRET_KEY } });
  const prefix = `integration-tests/${randomUUID()}`;
  const keys = [`${prefix}/source`, `${prefix}/sealed`, `${prefix}/stale`];
  afterAll(async () => {
    for (const key of keys) await storage.deleteObject(key);
    client.destroy();
    storage.onModuleDestroy();
  });
  it('copies only the inspected ETag and later PUTs cannot change the sealed object', async () => {
    const source = keys[0];
    const putUrl = await storage.getPresignedUploadUrl(source, 'application/pdf', 4);
    const put = await fetch(putUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: 'test' });
    expect(put.ok).toBe(true);
    const head = await storage.headObject(source);
    expect(head).toMatchObject({ mimeType: 'application/pdf', sizeBytes: 4 });
    await storage.sealObject(source, keys[1], head!.etag);
    await client.send(new PutObjectCommand({ Bucket: settings.S3_BUCKET, Key: source, ContentType: 'text/html', Body: 'changed content' }));
    const sealed = await storage.headObject(keys[1]);
    expect(sealed).toMatchObject({ mimeType: 'application/pdf', sizeBytes: 4, etag: head!.etag });
    await expect(storage.sealObject(source, keys[2], head!.etag)).rejects.toMatchObject({ $metadata: { httpStatusCode: 412 } });
  });
  it('returns null only for absent objects', async () => {
    expect(await storage.headObject(keys[2])).toBeNull();
  });
});
