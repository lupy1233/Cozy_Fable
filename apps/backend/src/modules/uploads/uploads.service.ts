import {
  type AttachmentDto,
  ERROR_CODES,
  MAX_ATTACHMENTS_PER_REQUEST,
  MAX_ATTACHMENT_BYTES,
  ALLOWED_ATTACHMENT_MIME,
  type PresignUploadResultDto,
} from '@marketplace/shared';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, type Attachment } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { StorageService } from '../../infra/storage/storage.service';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QUEUE_UPLOADS } from '../../infra/queues/queues.module';
import { isSanitizableImage, sanitizeImage } from './image-sanitizer';

const UPLOAD_URL_TTL_SECONDS = 15 * 60;

// E-client-9 (C7-3): cheile de dupa confirm/scan NU mai contin numele fisierului (poate
// contine numele/adresa clientului); extensia vine din MIME-ul verificat.
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
};
export function extForMime(mimeType: string): string {
  return EXT_BY_MIME[mimeType] ?? 'bin';
}
// Numele aratat firmelor pre-claim (marketplace, fisa de lucru): pozitia in lista + extensia.
export function neutralAttachmentName(index: number, mimeType: string): string {
  return `attachment-${index + 1}.${extForMime(mimeType)}`;
}
// cheie neutra: .../<attachmentId>/(clean|sealed)-<uuid>.<ext>
export const NEUTRAL_STORAGE_KEY = /\/(clean|sealed)-[0-9a-f-]{36}(\.[a-z0-9]+)?$/;
const LEGACY_SANITIZE_BATCH = 50;

// Campurile din randul attachments de care are nevoie DTO-ul public.
export type AttachmentRow = Pick<
  Attachment,
  'id' | 'filename' | 'mimeType' | 'sizeBytes' | 'status' | 'storageKey' | 'createdAt'
>;

export interface PresignInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

// Atasamente generice (entity_type/entity_id). Sprint 4: entity_type='REQUEST'.
// Invarianta 3.4: doar presigned URLs; fisierele nu trec prin Nest.
// MVP: scan mock la confirm (fara AV real) — SAFE, sau BLOCKED daca numele
// contine "malware" (invarianta 3.4). Clientul vede doar eroarea, nu statusul OK.
// E-client-9: scanul re-encodeaza imaginile (fara EXIF/GPS) in chei neutre.
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(QUEUE_UPLOADS) private readonly queue: Queue,
  ) {}

  private sanitizeFilename(name: string): string {
    return name.replace(/[^\w.-]+/g, '_').slice(0, 200);
  }

  private neutralKey(
    a: Pick<Attachment, 'id' | 'mimeType'> & { entityType: string; entityId: string },
    kind: 'clean' | 'sealed',
  ): string {
    return `${a.entityType.toLowerCase()}/${a.entityId}/${a.id}/${kind}-${randomUUID()}.${extForMime(a.mimeType)}`;
  }

  async presign(
    entityType: string,
    entityId: string,
    input: PresignInput,
    maxCount: number = MAX_ATTACHMENTS_PER_REQUEST,
  ): Promise<PresignUploadResultDto> {
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_ATTACHMENT_BYTES) throw new BadRequestException({ code: ERROR_CODES.FILE_TOO_LARGE, message: 'Invalid file size' });
    if (!(ALLOWED_ATTACHMENT_MIME as readonly string[]).includes(input.mimeType)) throw new BadRequestException({ code: ERROR_CODES.FILE_TYPE_NOT_ALLOWED, message: 'Unsupported file type' });

    const attachmentId = randomUUID();
    const storageKey = `${entityType.toLowerCase()}/${entityId}/${attachmentId}/${this.sanitizeFilename(input.filename)}`;

    await runTx(this.prisma, 'write', async (tx) => {
      // Aceeasi cheie pentru toate presign-urile concurente ale entitatii.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${entityType}:${entityId}`}, 0))::text`;
      const count = await tx.attachment.count({ where: { entityType, entityId } });
      if (count >= maxCount) throw new BadRequestException({ code: ERROR_CODES.FILE_LIMIT_REACHED, message: 'Attachment limit reached' });
      await tx.attachment.create({
      data: {
        id: attachmentId,
        entityType,
        entityId,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storageKey,
        status: 'PENDING_UPLOAD',
      },
      });
    });

    const uploadUrl = await this.storage.getPresignedUploadUrl(
      storageKey,
      input.mimeType,
      input.sizeBytes,
    );

    return { attachmentId, uploadUrl, storageKey, expiresInSeconds: UPLOAD_URL_TTL_SECONDS };
  }

  async confirm(entityType: string, entityId: string, attachmentId: string): Promise<AttachmentDto> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, entityType, entityId },
    });
    if (!attachment) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Attachment not found' });
    }

    if (attachment.status !== 'PENDING_UPLOAD') {
      if (attachment.status === 'PENDING_SCAN') await this.enqueueScan(attachment.id);
      return this.toDto(attachment);
    }
    const head = await this.storage.headObject(attachment.storageKey);
    if (!head) {
      throw new BadRequestException({
        code: ERROR_CODES.UPLOAD_NOT_FOUND_IN_STORAGE,
        message: 'Object not found in storage',
      });
    }

    if (head.sizeBytes !== attachment.sizeBytes || head.sizeBytes > MAX_ATTACHMENT_BYTES || head.mimeType.toLowerCase().trim() !== attachment.mimeType.toLowerCase().trim()) {
      await this.prisma.attachment.updateMany({ where: { id: attachmentId, status: 'PENDING_UPLOAD' }, data: { status: 'BLOCKED' } });
      throw new BadRequestException({ code: ERROR_CODES.FILE_TYPE_NOT_ALLOWED, message: 'Stored file metadata does not match the upload declaration' });
    }
    // PUT-ul semnat ramane reutilizabil 15 min: scanam o copie inaccesibila acelui PUT.
    // E-client-9: cheia sigilata e neutra (fara numele fisierului).
    const sealedKey = this.neutralKey({ ...attachment, entityType, entityId }, 'sealed');
    await this.storage.sealObject(attachment.storageKey, sealedKey, head.etag);
    const changed = await this.prisma.attachment.updateMany({
      where: { id: attachmentId, entityType, entityId, status: 'PENDING_UPLOAD', storageKey: attachment.storageKey },
      data: { status: 'PENDING_SCAN', storageKey: sealedKey },
    });
    if (changed.count === 0) await this.storage.deleteObject(sealedKey).catch(() => undefined);
    else await this.storage.deleteObject(attachment.storageKey).catch(() => undefined);
    const updated = await this.prisma.attachment.findFirst({ where: { id: attachmentId, entityType, entityId } });
    if (!updated) throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Attachment not found' });
    if (updated.status === 'PENDING_SCAN') await this.enqueueScan(attachmentId);
    return this.toDto(updated);
  }

  async enqueueScan(attachmentId: string): Promise<void> {
    try {
      const jobId = `scan-${attachmentId}`;
      const existing = await this.queue.getJob(jobId);
      if (existing && await existing.getState() === 'failed') await existing.retry();
      else await this.queue.add('scan.upload', { attachmentId }, { jobId, delay: 2000, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 1000 });
    } catch {
      // PENDING_SCAN este intentia durabila; reconcilierea reia dupa revenirea Redis.
      this.logger.warn(`Scan scheduling deferred for attachment ${attachmentId}`);
    }
  }

  async scan(attachmentId: string): Promise<void> {
    const attachment = await this.prisma.attachment.findFirst({ where: { id: attachmentId, status: 'PENDING_SCAN' } });
    if (!attachment) return;
    const head = await this.storage.headObject(attachment.storageKey);
    const blocked = !head || head.sizeBytes !== attachment.sizeBytes || head.mimeType.toLowerCase().trim() !== attachment.mimeType.toLowerCase().trim() || attachment.filename.toLowerCase().includes('malware');
    // E-client-9 (C7-3): imaginile se re-encodeaza (fara EXIF/GPS) intr-o cheie curata; SAFE
    // inseamna "cheia curata a trecut scanul". Erorile de storage urca → retry BullMQ.
    if (!blocked && isSanitizableImage(attachment.mimeType)) {
      const result = await this.writeCleanImage(attachment, 'PENDING_SCAN');
      if (result === 'REJECTED') {
        await this.prisma.attachment.updateMany({ where: { id: attachmentId, status: 'PENDING_SCAN', storageKey: attachment.storageKey }, data: { status: 'BLOCKED' } });
      }
      return;
    }
    await this.prisma.attachment.updateMany({ where: { id: attachmentId, status: 'PENDING_SCAN', storageKey: attachment.storageKey }, data: { status: blocked ? 'BLOCKED' : 'SAFE' } });
  }

  // Re-encodeaza imaginea din cheia curenta intr-o cheie noua `clean-<uuid>` si muta randul pe ea
  // (conditionat pe status + cheia veche → joburile repetate/concurente nu au efect).
  // REJECTED = imagine nedecodabila / peste limita (fara scriere).
  private async writeCleanImage(
    a: Attachment,
    expectedStatus: 'PENDING_SCAN' | 'SAFE',
  ): Promise<'DONE' | 'STALE' | 'REJECTED'> {
    if (!isSanitizableImage(a.mimeType)) return 'REJECTED';
    const bytes = await this.storage.getObjectBytes(a.storageKey, MAX_ATTACHMENT_BYTES);
    let out: Buffer;
    try {
      out = await sanitizeImage(bytes, a.mimeType);
    } catch {
      this.logger.warn(`Image sanitize failed for attachment ${a.id}`);
      return 'REJECTED';
    }
    if (out.length > MAX_ATTACHMENT_BYTES) return 'REJECTED';
    const cleanKey = this.neutralKey(a, 'clean');
    await this.storage.putObject(cleanKey, out, a.mimeType);
    const changed = await this.prisma.attachment.updateMany({
      where: { id: a.id, status: expectedStatus, storageKey: a.storageKey },
      data: { ...(expectedStatus === 'PENDING_SCAN' ? { status: 'SAFE' as const } : {}), storageKey: cleanKey, sizeBytes: out.length },
    });
    if (changed.count === 0) {
      await this.storage.deleteObject(cleanKey).catch(() => undefined);
      return 'STALE';
    }
    await this.deleteIfUnreferenced(a.storageKey);
    return 'DONE';
  }

  // Obiectul inlocuit se sterge best-effort, doar daca niciun alt rand nu il mai refera
  // (seed-urile vechi pot partaja aceeasi cheie intre randuri).
  private async deleteIfUnreferenced(storageKey: string): Promise<void> {
    const refs = await this.prisma.attachment.count({ where: { storageKey } }).catch(() => 1);
    if (refs === 0) await this.storage.deleteObject(storageKey).catch(() => undefined);
  }

  // E-client-9 (C7-3): fisierele REQUEST deja SAFE, incarcate inainte de curatare (cheie cu numele
  // original, poze cu EXIF). Imaginile → re-encodare in cheie curata; PDF/ZIP sau imagini
  // nedecodabile → copie in cheie neutra `sealed-<uuid>`. Paginat pe id; intoarce cursorul.
  async sanitizeLegacyRequestAttachments(
    batch = LEGACY_SANITIZE_BATCH,
    afterId?: string,
  ): Promise<{ more: boolean; cursor?: string }> {
    const rows = await this.prisma.attachment.findMany({
      where: {
        entityType: 'REQUEST',
        status: 'SAFE',
        NOT: [{ storageKey: { contains: '/clean-' } }, { storageKey: { contains: '/sealed-' } }],
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      orderBy: { id: 'asc' },
      take: batch,
    });
    for (const row of rows) {
      if (NEUTRAL_STORAGE_KEY.test(row.storageKey)) continue;
      try {
        await this.neutralizeLegacy(row);
      } catch {
        // obiect lipsa/storage indisponibil: randul ramane pe cheia veche, reluat la urmatorul boot
        this.logger.warn(`Legacy attachment neutralization deferred for ${row.id}`);
      }
    }
    return rows.length === batch ? { more: true, cursor: rows[rows.length - 1].id } : { more: false };
  }

  private async neutralizeLegacy(row: Attachment): Promise<void> {
    const head = await this.storage.headObject(row.storageKey);
    if (!head) {
      this.logger.warn(`Legacy attachment object missing for ${row.id}`);
      return;
    }
    if (isSanitizableImage(row.mimeType)) {
      const result = await this.writeCleanImage(row, 'SAFE');
      if (result !== 'REJECTED') return;
    }
    const sealedKey = this.neutralKey(row, 'sealed');
    await this.storage.sealObject(row.storageKey, sealedKey, head.etag);
    const changed = await this.prisma.attachment.updateMany({
      where: { id: row.id, status: 'SAFE', storageKey: row.storageKey },
      data: { storageKey: sealedKey },
    });
    if (changed.count === 0) await this.storage.deleteObject(sealedKey).catch(() => undefined);
    else await this.deleteIfUnreferenced(row.storageKey);
  }

  async reconcileScans(): Promise<void> {
    let cursor: string | undefined;
    do {
      const rows = await this.prisma.attachment.findMany({ where: { status: 'PENDING_SCAN' }, orderBy: { id: 'asc' }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true } });
      for (const row of rows) await this.enqueueScan(row.id);
      cursor = rows.length === 100 ? rows[rows.length - 1].id : undefined;
    } while (cursor);
  }

  async remove(entityType: string, entityId: string, attachmentId: string): Promise<void> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, entityType, entityId },
    });
    if (!attachment) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Attachment not found' });
    }
    await this.storage.deleteObject(attachment.storageKey).catch(() => undefined);
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
  }

  // Reataseaza atasamente uploadate intr-un "bucket" temporar (ex: thread/slot) la entitatea
  // finala (mesaj/versiune oferta). Valideaza apartenenta + SAFE. Folosit de chat/oferte.
  // E-company-2: intoarce randurile mutate (cu entityId = toEntityId) — chitanta ofertei se
  // construieste in memorie, fara o recitire in tranzactie.
  async relink(
    attachmentIds: string[],
    entityType: string,
    fromEntityId: string,
    toEntityId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Attachment[]> {
    if (attachmentIds.length === 0) return [];
    const db = tx ?? this.prisma;
    const rows = await db.attachment.findMany({
      where: { id: { in: attachmentIds }, entityType, entityId: fromEntityId },
    });
    if (rows.length !== attachmentIds.length) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Attachment not found' });
    }
    if (rows.some((r) => r.status !== 'SAFE')) {
      throw new BadRequestException({
        code: ERROR_CODES.FILE_SCAN_BLOCKED,
        message: 'Attachment not ready',
      });
    }
    await db.attachment.updateMany({
      where: { id: { in: attachmentIds } },
      data: { entityId: toEntityId },
    });
    return rows
      .map((r) => ({ ...r, entityId: toEntityId }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  // E-client-9: neutralNames → firmele (marketplace, fisa de lucru) vad `attachment-N.ext`, si in
  // Content-Disposition; proprietarul si chatul pastreaza numele original.
  async listForEntity(
    entityType: string,
    entityId: string,
    tx?: Prisma.TransactionClient,
    opts?: { neutralNames?: boolean },
  ): Promise<AttachmentDto[]> {
    const rows = await (tx ?? this.prisma).attachment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(
      rows.map((r, i) => this.toDto(r, opts?.neutralNames ? neutralAttachmentName(i, r.mimeType) : undefined)),
    );
  }

  // E-company-2: un singur query pentru atasamentele mai multor entitati (ex. versiunile unei
  // oferte) in loc de N; grupate pe entityId, in ordinea createdAt.
  async listForEntities(
    entityType: string,
    entityIds: string[],
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Map<string, AttachmentDto[]>> {
    const byEntity = new Map<string, AttachmentDto[]>();
    if (entityIds.length === 0) return byEntity;
    const rows = await db.attachment.findMany({
      where: { entityType, entityId: { in: entityIds } },
      orderBy: { createdAt: 'asc' },
    });
    const dtos = await this.toAttachmentDtos(rows);
    rows.forEach((row, i) => {
      const list = byEntity.get(row.entityId) ?? [];
      list.push(dtos[i]);
      byEntity.set(row.entityId, list);
    });
    return byEntity;
  }

  // Presign-ul e local (semnatura HMAC, fara retea) → sigur si pentru randuri deja citite.
  async toAttachmentDtos(rows: AttachmentRow[]): Promise<AttachmentDto[]> {
    return Promise.all(rows.map((r) => this.toDto(r)));
  }

  private async toDto(a: AttachmentRow, neutralName?: string): Promise<AttachmentDto> {
    const filename = neutralName ?? a.filename;
    // cheile sunt neutre → numele de salvare vine din Content-Disposition (original sau neutru)
    const downloadUrl =
      a.status === 'SAFE'
        ? await this.storage.getPresignedDownloadUrl(a.storageKey, { downloadName: filename })
        : null;
    return {
      id: a.id,
      filename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      status: a.status as AttachmentDto['status'],
      downloadUrl,
      createdAt: a.createdAt.toISOString(),
    };
  }
}
