import {
  type AttachmentDto,
  ERROR_CODES,
  MAX_ATTACHMENTS_PER_REQUEST,
  type PresignUploadResultDto,
} from '@marketplace/shared';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';

const UPLOAD_URL_TTL_SECONDS = 15 * 60;

export interface PresignInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

// Atasamente generice (entity_type/entity_id). Sprint 4: entity_type='REQUEST'.
// Invarianta 3.4: doar presigned URLs; fisierele nu trec prin Nest.
// MVP: fara scanare AV reala — la confirm trecem direct PENDING_UPLOAD → SAFE
// (statusul PENDING_SCAN/BLOCKED ramane pentru integrarea AV intr-un sprint viitor).
@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private sanitizeFilename(name: string): string {
    return name.replace(/[^\w.\-]+/g, '_').slice(0, 200);
  }

  async presign(
    entityType: string,
    entityId: string,
    input: PresignInput,
    maxCount: number = MAX_ATTACHMENTS_PER_REQUEST,
  ): Promise<PresignUploadResultDto> {
    const count = await this.prisma.attachment.count({ where: { entityType, entityId } });
    if (count >= maxCount) {
      throw new BadRequestException({
        code: ERROR_CODES.FILE_LIMIT_REACHED,
        message: 'Attachment limit reached',
      });
    }

    const attachmentId = randomUUID();
    const storageKey = `${entityType.toLowerCase()}/${entityId}/${attachmentId}/${this.sanitizeFilename(input.filename)}`;

    await this.prisma.attachment.create({
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

    const exists = await this.storage.objectExists(attachment.storageKey);
    if (!exists) {
      throw new BadRequestException({
        code: ERROR_CODES.UPLOAD_NOT_FOUND_IN_STORAGE,
        message: 'Object not found in storage',
      });
    }

    const updated = await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: { status: 'SAFE' },
    });
    return this.toDto(updated);
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
  async relink(
    attachmentIds: string[],
    entityType: string,
    fromEntityId: string,
    toEntityId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (attachmentIds.length === 0) return;
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
  }

  async listForEntity(entityType: string, entityId: string): Promise<AttachmentDto[]> {
    const rows = await this.prisma.attachment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(rows.map((r) => this.toDto(r)));
  }

  private async toDto(a: {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    status: string;
    storageKey: string;
    createdAt: Date;
  }): Promise<AttachmentDto> {
    const downloadUrl =
      a.status === 'SAFE' ? await this.storage.getPresignedDownloadUrl(a.storageKey) : null;
    return {
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      status: a.status as AttachmentDto['status'],
      downloadUrl,
      createdAt: a.createdAt.toISOString(),
    };
  }
}
