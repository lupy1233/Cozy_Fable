import {
  type AttachmentDto,
  ERROR_CODES,
  type PresignUploadResultDto,
  type RequestDraftCreatedDto,
  type RequestDto,
  type RequestListItemDto,
} from '@marketplace/shared';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Request as RequestModel, RequestStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { createHash, randomBytes } from 'crypto';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QUEUE_REQUEST_EXPIRATION } from '../../infra/queues/queues.module';
import { SizingService } from '../sizing/sizing.service';
import { GeoService } from '../geo/geo.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreditsService } from '../billing/credits.service';
import {
  CreateRequestContentDto,
  PatchDraftDto,
  PresignAttachmentDto,
} from './dto/request.dto';
import {
  ENTITY_TYPE_REQUEST,
  EXPIRATION_WORKING_DAYS,
  MAX_POST_CLAIM_EDITS,
  MAX_PRE_CLAIM_EDITS,
} from './requests.constants';
import type { RequestExpirationJob } from './request-expiration.processor';

// Statusuri in care editarea e blocata pentru ca exista deja oferte/negociere.
const OFFER_LOCKED_STATUSES: RequestStatus[] = [
  'OFFERS_RECEIVED',
  'NEGOTIATION',
  'ACCEPTED',
  'IN_EXECUTION',
  'DELIVERED_BY_COMPANY',
];
const POST_CLAIM_STATUSES: RequestStatus[] = ['CLAIMED_PARTIAL', 'CLAIMED_FULL'];
// Atasamentele se pot modifica cat timp cererea nu e terminala.
const ATTACHMENT_EDITABLE_STATUSES: RequestStatus[] = [
  'DRAFT',
  'IN_MARKETPLACE',
  'CLAIMED_PARTIAL',
  'CLAIMED_FULL',
];

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
    private readonly sizing: SizingService,
    private readonly uploads: UploadsService,
    private readonly calendar: BusinessCalendarService,
    private readonly eventBus: EventBusService,
    private readonly credits: CreditsService,
    @InjectQueue(QUEUE_REQUEST_EXPIRATION) private readonly expirationQueue: Queue,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async findByToken(token: string): Promise<RequestModel> {
    const request = await this.prisma.request.findUnique({
      where: { draftTokenHash: this.hashToken(token) },
    });
    if (!request) {
      throw new NotFoundException({
        code: ERROR_CODES.DRAFT_TOKEN_INVALID,
        message: 'Draft token invalid',
      });
    }
    return request;
  }

  // ---- creare / draft ----

  async createDraft(
    clientUserId: string | null,
    patch?: PatchDraftDto,
  ): Promise<RequestDraftCreatedDto> {
    const token = randomBytes(32).toString('hex');
    const request = await this.prisma.request.create({
      data: {
        clientUserId,
        draftTokenHash: this.hashToken(token),
        status: 'DRAFT',
        title: patch?.title,
        description: patch?.description,
        budgetRange: patch?.budgetRange,
        desiredDeadline: patch?.desiredDeadline ? new Date(patch.desiredDeadline) : undefined,
        includesPaidDesign: patch?.includesPaidDesign ?? false,
        hasOwnProject: patch?.hasOwnProject ?? false,
        addressText: patch?.addressText,
        county: patch?.county,
        city: patch?.city,
      },
    });
    if (patch?.rooms || patch?.contactPreferences) {
      await this.replaceChildren(this.prisma, request.id, patch);
    }
    return { id: request.id, draftToken: token };
  }

  async getDraft(token: string): Promise<RequestDto> {
    const request = await this.findByToken(token);
    return this.toDto(request.id);
  }

  async patchDraft(token: string, dto: PatchDraftDto): Promise<RequestDto> {
    const request = await this.findByToken(token);
    if (request.status !== 'DRAFT') {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_NOT_EDITABLE,
        message: 'Only drafts can be patched; use edit after publishing',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: request.id },
        data: {
          title: dto.title,
          description: dto.description,
          budgetRange: dto.budgetRange,
          desiredDeadline: dto.desiredDeadline ? new Date(dto.desiredDeadline) : undefined,
          includesPaidDesign: dto.includesPaidDesign,
          hasOwnProject: dto.hasOwnProject,
          addressText: dto.addressText,
          county: dto.county,
          city: dto.city,
        },
      });
      if (dto.rooms || dto.contactPreferences) {
        await this.replaceChildren(tx, request.id, dto);
      }
    });
    return this.toDto(request.id);
  }

  // ---- publicare ----

  async publish(token: string, dto: CreateRequestContentDto): Promise<RequestDto> {
    const request = await this.findByToken(token);
    if (request.status !== 'DRAFT') {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_NOT_EDITABLE,
        message: 'Request already published',
      });
    }

    const geo = await this.geo.geocode(dto.addressText, dto.city, dto.county);
    const sizing = await this.sizing.compute(dto);

    const now = new Date();
    const expiresAt = this.calendar.addWorkingDays(now, EXPIRATION_WORKING_DAYS);

    await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: request.id },
        data: {
          ...this.scalarData(dto),
          lat: geo.lat,
          lng: geo.lng,
          sizeScore: sizing.score,
          projectSize: sizing.size,
          creditCost: sizing.creditCost,
          status: 'IN_MARKETPLACE',
          publishedAt: now,
          expiresAt,
        },
      });
      await this.replaceChildren(tx, request.id, dto);
      await this.writeVersion(tx, request.id, dto);
    });

    await this.scheduleExpiration(request.id, expiresAt);
    await this.eventBus.publish('request.status_changed', {
      requestId: request.id,
      status: 'IN_MARKETPLACE',
    });

    return this.toDto(request.id);
  }

  // ---- editare post-publicare (3 pre-claim / 1 post-claim) ----

  async edit(token: string, dto: CreateRequestContentDto): Promise<RequestDto> {
    const request = await this.findByToken(token);
    const editCounters = this.assertEditableAndCount(request);

    const addressChanged =
      request.addressText !== dto.addressText ||
      request.city !== dto.city ||
      request.county !== dto.county;
    const geo = addressChanged
      ? await this.geo.geocode(dto.addressText, dto.city, dto.county)
      : { lat: request.lat, lng: request.lng };
    const sizing = await this.sizing.compute(dto);

    await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: request.id },
        data: {
          ...this.scalarData(dto),
          lat: geo.lat,
          lng: geo.lng,
          sizeScore: sizing.score,
          projectSize: sizing.size,
          creditCost: sizing.creditCost,
          lastEditAt: new Date(),
          ...editCounters,
        },
      });
      await this.replaceChildren(tx, request.id, dto);
      await this.writeVersion(tx, request.id, dto);
    });

    await this.eventBus.publish('request.status_changed', {
      requestId: request.id,
      status: request.status,
      edited: true,
    });

    return this.toDto(request.id);
  }

  // ---- repost cerere expirata (o singura data) ----

  async repost(token: string): Promise<RequestDto> {
    const request = await this.findByToken(token);
    if (request.status !== 'EXPIRED') {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_NOT_EDITABLE,
        message: 'Only expired requests can be reposted',
      });
    }
    if (request.repostUsed) {
      throw new BadRequestException({
        code: ERROR_CODES.REPOST_ALREADY_USED,
        message: 'Repost already used',
      });
    }

    const now = new Date();
    const expiresAt = this.calendar.addWorkingDays(now, EXPIRATION_WORKING_DAYS);

    await this.prisma.request.update({
      where: { id: request.id },
      data: {
        status: 'IN_MARKETPLACE',
        repostUsed: true,
        publishedAt: now,
        expiresAt,
      },
    });

    await this.scheduleExpiration(request.id, expiresAt);
    await this.eventBus.publish('request.status_changed', {
      requestId: request.id,
      status: 'IN_MARKETPLACE',
      reposted: true,
    });

    return this.toDto(request.id);
  }

  // ---- liste client autenticat ----

  async listForClient(userId: string): Promise<RequestListItemDto[]> {
    const rows = await this.prisma.request.findMany({
      where: { clientUserId: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      title: r.title ?? '',
      budgetRange: r.budgetRange ?? 'UNDER_5K',
      city: r.city ?? '',
      county: r.county ?? '',
      size: r.projectSize,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getForClient(userId: string, id: string): Promise<RequestDto> {
    const request = await this.prisma.request.findUnique({ where: { id } });
    if (!request || request.deletedAt) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });
    }
    if (request.clientUserId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not your request' });
    }
    return this.toDto(id);
  }

  // Î17 — clientul sterge cererea: soft delete + claim-uri active → CANCELLED_BY_CLIENT + refund.
  async deleteForClient(userId: string, id: string): Promise<{ ok: true }> {
    const request = await this.prisma.request.findUnique({ where: { id } });
    if (!request || request.deletedAt) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });
    }
    if (request.clientUserId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not your request' });
    }
    const deletable: RequestStatus[] = [
      'DRAFT', 'IN_MARKETPLACE', 'CLAIMED_PARTIAL', 'CLAIMED_FULL', 'OFFERS_RECEIVED', 'NEGOTIATION', 'EXPIRED',
    ];
    if (!deletable.includes(request.status)) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_NOT_DELETABLE,
        message: 'Request cannot be deleted in this state',
      });
    }
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const claims = await tx.claimSlot.findMany({
        where: { requestId: id, status: { in: ['ACTIVE', 'OFFER_SENT'] } },
      });
      for (const c of claims) {
        await tx.claimSlot.update({
          where: { id: c.id },
          data: { status: 'CANCELLED_BY_CLIENT', withdrawnAt: new Date() },
        });
        await this.credits.refund(
          c.companyId,
          c.claimCostCreditsSnapshot,
          'REQUEST_DELETED_BY_CLIENT',
          c.id,
          tx,
        );
      }
      await tx.request.update({ where: { id }, data: { deletedAt: new Date() } });
      return claims;
    });
    for (const c of cancelled) {
      await this.eventBus.publish('claim.withdrawn', { claimSlotId: c.id, reason: 'CANCELLED_BY_CLIENT' });
    }
    await this.eventBus.publish('request.status_changed', { requestId: id, deleted: true });
    return { ok: true };
  }

  // ---- atasamente (delegare la UploadsService) ----

  async presignAttachment(token: string, dto: PresignAttachmentDto): Promise<PresignUploadResultDto> {
    const request = await this.requireAttachmentEditable(token);
    return this.uploads.presign(ENTITY_TYPE_REQUEST, request.id, dto);
  }

  async confirmAttachment(token: string, attachmentId: string): Promise<AttachmentDto> {
    const request = await this.requireAttachmentEditable(token);
    return this.uploads.confirm(ENTITY_TYPE_REQUEST, request.id, attachmentId);
  }

  async removeAttachment(token: string, attachmentId: string): Promise<void> {
    const request = await this.requireAttachmentEditable(token);
    return this.uploads.remove(ENTITY_TYPE_REQUEST, request.id, attachmentId);
  }

  // ---- helpers ----

  private async requireAttachmentEditable(token: string): Promise<RequestModel> {
    const request = await this.findByToken(token);
    if (!ATTACHMENT_EDITABLE_STATUSES.includes(request.status)) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_NOT_EDITABLE,
        message: 'Attachments cannot be changed in this state',
      });
    }
    return request;
  }

  private assertEditableAndCount(
    request: RequestModel,
  ): { preClaimEditsUsed: number } | { postClaimEditsUsed: number } {
    if (request.status === 'IN_MARKETPLACE') {
      if (request.preClaimEditsUsed >= MAX_PRE_CLAIM_EDITS) {
        throw new BadRequestException({
          code: ERROR_CODES.EDIT_LIMIT_PRE_CLAIM_REACHED,
          message: 'Pre-claim edit limit reached',
        });
      }
      return { preClaimEditsUsed: request.preClaimEditsUsed + 1 };
    }
    if (POST_CLAIM_STATUSES.includes(request.status)) {
      if (request.postClaimEditsUsed >= MAX_POST_CLAIM_EDITS) {
        throw new BadRequestException({
          code: ERROR_CODES.EDIT_LIMIT_POST_CLAIM_REACHED,
          message: 'Post-claim edit limit reached',
        });
      }
      return { postClaimEditsUsed: request.postClaimEditsUsed + 1 };
    }
    if (OFFER_LOCKED_STATUSES.includes(request.status)) {
      throw new BadRequestException({
        code: ERROR_CODES.EDIT_BLOCKED_OFFER_RECEIVED,
        message: 'Editing blocked after offers received',
      });
    }
    throw new BadRequestException({
      code: ERROR_CODES.REQUEST_NOT_EDITABLE,
      message: 'Request is not editable in this state',
    });
  }

  private scalarData(dto: CreateRequestContentDto) {
    return {
      title: dto.title,
      description: dto.description,
      budgetRange: dto.budgetRange,
      desiredDeadline: dto.desiredDeadline ? new Date(dto.desiredDeadline) : null,
      includesPaidDesign: dto.includesPaidDesign,
      hasOwnProject: dto.hasOwnProject,
      addressText: dto.addressText,
      county: dto.county,
      city: dto.city,
    };
  }

  // Inlocuieste camerele + itemele + preferintele de contact (daca prezente in dto).
  private async replaceChildren(
    tx: Prisma.TransactionClient,
    requestId: string,
    dto: PatchDraftDto | CreateRequestContentDto,
  ): Promise<void> {
    if (dto.rooms) {
      await tx.requestRoom.deleteMany({ where: { requestId } });
      for (const room of dto.rooms) {
        await tx.requestRoom.create({
          data: {
            requestId,
            roomType: room.roomType,
            lengthM: room.lengthM,
            widthM: room.widthM,
            heightM: room.heightM,
            items: {
              create: room.items.map((it) => ({
                name: it.name,
                material: it.material,
                systems: it.systems,
                description: it.description,
                quantity: it.quantity,
              })),
            },
          },
        });
      }
    }
    if (dto.contactPreferences) {
      await tx.requestContactPreference.deleteMany({ where: { requestId } });
      await tx.requestContactPreference.createMany({
        data: dto.contactPreferences.map((c) => ({
          requestId,
          channel: c.channel,
          value: c.value,
          priority: c.priority,
        })),
      });
    }
  }

  private async writeVersion(
    tx: Prisma.TransactionClient,
    requestId: string,
    dto: CreateRequestContentDto,
  ): Promise<void> {
    const count = await tx.requestVersion.count({ where: { requestId } });
    await tx.requestVersion.create({
      data: {
        requestId,
        version: count + 1,
        snapshot: dto as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async scheduleExpiration(requestId: string, expiresAt: Date): Promise<void> {
    const delay = Math.max(0, expiresAt.getTime() - Date.now());
    await this.expirationQueue.add(
      'expire',
      { requestId } satisfies RequestExpirationJob,
      {
        delay,
        jobId: `req-exp-${requestId}-${expiresAt.getTime()}`,
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }

  private async toDto(id: string): Promise<RequestDto> {
    const request = await this.prisma.request.findUniqueOrThrow({
      where: { id },
      include: {
        rooms: { include: { items: true }, orderBy: { createdAt: 'asc' } },
        contactPreferences: { orderBy: { priority: 'asc' } },
      },
    });
    const attachments = await this.uploads.listForEntity(ENTITY_TYPE_REQUEST, id);

    return {
      id: request.id,
      status: request.status,
      title: request.title ?? '',
      description: request.description ?? '',
      budgetRange: request.budgetRange ?? 'UNDER_5K',
      desiredDeadline: request.desiredDeadline
        ? request.desiredDeadline.toISOString().slice(0, 10)
        : null,
      includesPaidDesign: request.includesPaidDesign,
      hasOwnProject: request.hasOwnProject,
      addressText: request.addressText ?? '',
      county: request.county ?? '',
      city: request.city ?? '',
      lat: request.lat,
      lng: request.lng,
      sizing:
        request.sizeScore !== null && request.projectSize !== null && request.creditCost !== null
          ? {
              score: request.sizeScore,
              size: request.projectSize,
              creditCost: request.creditCost,
            }
          : null,
      preClaimEditsUsed: request.preClaimEditsUsed,
      postClaimEditsUsed: request.postClaimEditsUsed,
      publishedAt: request.publishedAt?.toISOString() ?? null,
      expiresAt: request.expiresAt?.toISOString() ?? null,
      repostUsed: request.repostUsed,
      createdAt: request.createdAt.toISOString(),
      rooms: request.rooms.map((r) => ({
        id: r.id,
        roomType: r.roomType,
        lengthM: r.lengthM,
        widthM: r.widthM,
        heightM: r.heightM,
        items: r.items.map((it) => ({
          id: it.id,
          name: it.name,
          material: it.material,
          systems: it.systems,
          description: it.description,
          quantity: it.quantity,
        })),
      })),
      contactPreferences: request.contactPreferences.map((c) => ({
        id: c.id,
        channel: c.channel,
        value: c.value,
        priority: c.priority,
      })),
      attachments,
    };
  }
}
