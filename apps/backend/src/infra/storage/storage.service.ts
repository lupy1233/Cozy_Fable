import {
  DeleteObjectCommand,
  CopyObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { usesDefaultS3Credentials } from './storage-credentials';

// Invarianta 3.4: fisierele NU se servesc prin NestJS si NU au URL static.
// Doar presigned PUT (15 min) / GET (5 min).
const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

// nume de fisier sigur pentru header (ASCII, fara ghilimele/separatori), max 120;
// diacriticele se pierd curat ("Bucătărie" → "Bucatarie", nu "Buca_ta_rie")
export function asciiFilename(name: string): string {
  const safe = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(0, 120);
  return safe || 'file';
}

@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    const accessKeyId = config.getOrThrow<string>('S3_ACCESS_KEY');
    const secretAccessKey = config.getOrThrow<string>('S3_SECRET_KEY');
    // Doar avertisment (fara valori): abort-ul vine dupa migrarea EU si rotirea cheii (CHANGELOG, Ramas).
    if (config.get<string>('NODE_ENV') === 'production' && usesDefaultS3Credentials(accessKeyId, secretAccessKey)) {
      new Logger(StorageService.name).warn(
        'S3 foloseste credentiale implicite MinIO in productie - creeaza cheia limitata la bucket (docs/08 "Storage: cheie limitata si versionare")',
      );
    }
    this.client = new S3Client({
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      region: config.getOrThrow<string>('S3_REGION'),
      forcePathStyle: true, // necesar pentru MinIO
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  getPresignedUploadUrl(storageKey: string, mimeType: string, sizeBytes: number): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  }

  // E-client-9: downloadName (ex. nume neutru pentru firme) → Content-Disposition la descarcare,
  // ca browserul sa nu salveze fisierul sub cheia/numele original.
  getPresignedDownloadUrl(storageKey: string, opts?: { downloadName?: string }): Promise<string> {
    const downloadName = opts?.downloadName ? asciiFilename(opts.downloadName) : null;
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ...(downloadName ? { ResponseContentDisposition: `inline; filename="${downloadName}"` } : {}),
    });
    return getSignedUrl(this.client, cmd, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
  }

  // E-client-9: citire integrala pentru procesare in worker (re-encodare imagini). Plafonul
  // protejeaza memoria procesului: obiectul e deja verificat la confirm, dar nu ne bazam pe asta.
  async getObjectBytes(storageKey: string, maxBytes: number): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    if (typeof res.ContentLength === 'number' && res.ContentLength > maxBytes) {
      throw new Error('Storage object exceeds the processing limit');
    }
    if (!res.Body) throw new Error('Storage object has no body');
    const bytes = await res.Body.transformToByteArray();
    if (bytes.byteLength > maxBytes) throw new Error('Storage object exceeds the processing limit');
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  async putObject(storageKey: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      Body: body,
      ContentType: contentType,
      ContentLength: body.length,
    }));
  }

  async objectExists(storageKey: string): Promise<boolean> {
    return (await this.headObject(storageKey)) !== null;
  }

  async headObject(storageKey: string): Promise<{ sizeBytes: number; mimeType: string; etag: string } | null> {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }));
      return { sizeBytes: head.ContentLength ?? -1, mimeType: head.ContentType ?? '', etag: head.ETag ?? '' };
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
      throw error;
    }
  }

  async sealObject(sourceKey: string, sealedKey: string, etag: string): Promise<void> {
    if (!etag) throw new Error('Storage did not provide an object ETag');
    await this.client.send(new CopyObjectCommand({
      Bucket: this.bucket, Key: sealedKey,
      CopySource: `${this.bucket}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`,
      CopySourceIfMatch: etag,
    }));
  }

  async deleteObject(storageKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }

  // E-admin-platform-8: semnalul permite health-ului sa abandoneze HEAD-ul dupa timeout
  async healthCheck(signal?: AbortSignal): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }), { abortSignal: signal });
  }
}
