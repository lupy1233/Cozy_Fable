import {
  type AttachmentDto,
  BUDGET_RANGE_FACTOR,
  BUDGET_RON_PER_POINT,
  type ClientDashboardStatsDto,
  contactPreferencesSchema,
  ERROR_CODES,
  maxAttachmentsForRequest,
  type PresignUploadResultDto,
  type RequestDraftCreatedDto,
  type RequestDto,
  type RequestListItemDto,
  sortByRoomOrder,
} from '@marketplace/shared';
import { ConfiguratorService, type ProcessedRoom } from './configurator.service';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request as RequestModel, RequestStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { createHash, randomBytes } from 'crypto';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QUEUE_REQUEST_EXPIRATION } from '../../infra/queues/queues.module';
import { SizingService } from '../sizing/sizing.service';
import { InspirationService } from '../inspiration/inspiration.service';
import { GeoService } from '../geo/geo.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreditsService } from '../billing/credits.service';
import {
  ConfiguratorRoomInputDto,
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
    private readonly configurator: ConfiguratorService,
    private readonly uploads: UploadsService,
    private readonly inspiration: InspirationService,
    private readonly calendar: BusinessCalendarService,
    private readonly eventBus: EventBusService,
    private readonly credits: CreditsService,
    @InjectQueue(QUEUE_REQUEST_EXPIRATION) private readonly expirationQueue: Queue,
  ) {}

  // Cap de marime pentru starea bruta a wizard-ului salvata pe draft.
  private static readonly MAX_CONFIGURATOR_STATE_CHARS = 200_000;

  private serializeConfiguratorState(state: unknown): Prisma.InputJsonValue | undefined {
    if (state === undefined) return undefined;
    const json = JSON.stringify(state);
    if (json.length > RequestsService.MAX_CONFIGURATOR_STATE_CHARS) {
      throw new BadRequestException({
        code: ERROR_CODES.CONFIGURATOR_STATE_TOO_LARGE,
        message: 'Configurator state exceeds the maximum allowed size',
      });
    }
    return state as Prisma.InputJsonValue;
  }

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
        deadlineBucket: patch?.deadlineBucket,
        includesPaidDesign: patch?.includesPaidDesign ?? false,
        hasOwnProject: patch?.hasOwnProject ?? false,
        addressText: patch?.addressText,
        county: patch?.county,
        city: patch?.city,
        configuratorState: this.serializeConfiguratorState(patch?.configuratorState),
      },
    });
    // in draft NU materializam camerele (dims derivate incomplete); starea wizard-ului
    // traieste in configuratorState. Doar preferintele de contact se persista imediat.
    if (patch?.contactPreferences) {
      await this.writeContactPreferences(this.prisma, request.id, patch.contactPreferences);
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
    const configuratorState = this.serializeConfiguratorState(dto.configuratorState);
    await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: request.id },
        data: {
          title: dto.title,
          description: dto.description,
          budgetRange: dto.budgetRange,
          deadlineBucket: dto.deadlineBucket,
          includesPaidDesign: dto.includesPaidDesign,
          hasOwnProject: dto.hasOwnProject,
          addressText: dto.addressText,
          county: dto.county,
          city: dto.city,
          configuratorState,
        },
      });
      // draftul nu materializeaza camere; doar contact preferences se pot salva incremental
      if (dto.contactPreferences) {
        await this.writeContactPreferences(tx, request.id, dto.contactPreferences);
      }
    });
    return this.toDto(request.id);
  }

  // ---- publicare ----

  async publish(
    token: string,
    dto: CreateRequestContentDto,
    userId: string | null,
  ): Promise<RequestDto> {
    // Publicarea trimite cererea in marketplace (firmele o revendica, apoi chat/oferte),
    // deci necesita un cont — draftul se poate completa anonim, dar nu se poate publica.
    if (!userId) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication required to publish a request',
      });
    }
    const request = await this.findByToken(token);
    if (request.status !== 'DRAFT') {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_NOT_EDITABLE,
        message: 'Request already published',
      });
    }

    // valideaza raspunsurile + deriva camere/items/scoring (sursa de adevar server)
    const processed = this.configurator.processRooms(dto.rooms);
    this.assertContactFormats(dto.contactPreferences);
    await this.inspiration.assertSelectable(dto.inspirationPhotoIds ?? []);
    await this.assertRoomAttachments(
      request.id,
      this.configurator.collectUploadAttachmentIds(processed.rooms),
    );
    const geo = await this.geo.geocode(dto.addressText, dto.city, dto.county);
    const sizing = await this.sizing.compute({
      scoreEntries: processed.scoreEntries,
      budgetRange: dto.budgetRange,
      includesPaidDesign: dto.includesPaidDesign,
    });

    const now = new Date();
    const expiresAt = this.calendar.addWorkingDays(now, EXPIRATION_WORKING_DAYS);

    await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: request.id },
        data: {
          ...this.scalarData(dto),
          title: this.resolveTitle(dto, processed.rooms),
          // leaga draftul (posibil anonim) de contul care publica
          clientUserId: userId,
          lat: geo.lat,
          lng: geo.lng,
          sizeScore: sizing.score,
          projectSize: sizing.size,
          creditCost: sizing.creditCost,
          status: 'IN_MARKETPLACE',
          publishedAt: now,
          expiresAt,
          // starea bruta a wizard-ului nu mai e necesara: answers sunt canonice pe camere
          configuratorState: Prisma.DbNull,
        },
      });
      await this.writeRooms(tx, request.id, processed.rooms);
      await this.writeContactPreferences(tx, request.id, dto.contactPreferences);
      await this.writeInspirationPhotos(tx, request.id, dto.inspirationPhotoIds);
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

  // varianta token (device-ul care a creat draftul)
  async edit(token: string, dto: CreateRequestContentDto): Promise<RequestDto> {
    const request = await this.findByToken(token);
    return this.editRequest(request, dto);
  }

  // varianta autentificata (proprietarul, de pe orice device)
  async editForClient(userId: string, id: string, dto: CreateRequestContentDto): Promise<RequestDto> {
    const request = await this.findOwnedRequest(userId, id);
    return this.editRequest(request, dto);
  }

  private async editRequest(request: RequestModel, dto: CreateRequestContentDto): Promise<RequestDto> {
    const editCounters = this.assertEditableAndCount(request);

    const processed = this.configurator.processRooms(dto.rooms);
    this.assertContactFormats(dto.contactPreferences);
    await this.inspiration.assertSelectable(dto.inspirationPhotoIds ?? []);
    await this.assertRoomAttachments(
      request.id,
      this.configurator.collectUploadAttachmentIds(processed.rooms),
    );
    const addressChanged =
      request.addressText !== dto.addressText ||
      request.city !== dto.city ||
      request.county !== dto.county;
    const geo = addressChanged
      ? await this.geo.geocode(dto.addressText, dto.city, dto.county)
      : { lat: request.lat, lng: request.lng };
    const sizing = await this.sizing.compute({
      scoreEntries: processed.scoreEntries,
      budgetRange: dto.budgetRange,
      includesPaidDesign: dto.includesPaidDesign,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: request.id },
        data: {
          ...this.scalarData(dto),
          title: this.resolveTitle(dto, processed.rooms),
          lat: geo.lat,
          lng: geo.lng,
          sizeScore: sizing.score,
          projectSize: sizing.size,
          creditCost: sizing.creditCost,
          lastEditAt: new Date(),
          ...editCounters,
        },
      });
      await this.writeRooms(tx, request.id, processed.rooms);
      await this.writeContactPreferences(tx, request.id, dto.contactPreferences);
      await this.writeInspirationPhotos(tx, request.id, dto.inspirationPhotoIds);
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
      include: {
        rooms: { select: { roomType: true } },
        claims: { select: { status: true } },
        quotes: { select: { status: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      title: r.title ?? '',
      budgetRange: r.budgetRange ?? 'UNDISCLOSED',
      city: r.city ?? '',
      county: r.county ?? '',
      // marimea proiectului nu se afiseaza clientului (doar firmelor)
      size: null,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      roomTypes: r.rooms.map((room) => room.roomType),
      activeClaims: r.claims.filter((c) => c.status === 'ACTIVE' || c.status === 'OFFER_SENT')
        .length,
      quotesCount: r.quotes.filter((q) => q.status !== 'DRAFT').length,
    }));
  }

  async getForClient(userId: string, id: string): Promise<RequestDto> {
    await this.findOwnedRequest(userId, id);
    return this.toDto(id);
  }

  // Cererea exista, nu e stearsa si apartine clientului curent (ownership).
  private async findOwnedRequest(userId: string, id: string): Promise<RequestModel> {
    const request = await this.prisma.request.findUnique({ where: { id } });
    if (!request || request.deletedAt) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });
    }
    if (request.clientUserId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not your request' });
    }
    return request;
  }

  // Statistici agregate pentru dashboardul clientului.
  async dashboardStatsForClient(userId: string): Promise<ClientDashboardStatsDto> {
    const where = { clientUserId: userId, deletedAt: null };
    const [total, grouped, offersReceived, activeClaims, recent] = await Promise.all([
      this.prisma.request.count({ where }),
      this.prisma.request.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.quote.count({
        where: {
          status: { in: ['SENT', 'ACCEPTED'] },
          request: { clientUserId: userId, deletedAt: null },
        },
      }),
      this.prisma.claimSlot.count({
        where: {
          status: { in: ['ACTIVE', 'OFFER_SENT'] },
          request: { clientUserId: userId, deletedAt: null },
        },
      }),
      this.prisma.request.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
    ]);

    const byStatus: ClientDashboardStatsDto['byStatus'] = {};
    for (const g of grouped) byStatus[g.status] = g._count._all;

    return {
      totalRequests: total,
      byStatus,
      offersReceived,
      activeClaims,
      recent: recent.map((r) => ({
        id: r.id,
        title: r.title ?? '',
        status: r.status,
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
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
    return this.uploads.presign(ENTITY_TYPE_REQUEST, request.id, dto, await this.attachmentCap(request));
  }

  async confirmAttachment(token: string, attachmentId: string): Promise<AttachmentDto> {
    const request = await this.requireAttachmentEditable(token);
    return this.uploads.confirm(ENTITY_TYPE_REQUEST, request.id, attachmentId);
  }

  async removeAttachment(token: string, attachmentId: string): Promise<void> {
    const request = await this.requireAttachmentEditable(token);
    return this.uploads.remove(ENTITY_TYPE_REQUEST, request.id, attachmentId);
  }

  // ---- atasamente pe cererea proprie (client autentificat, fara token) ----
  // Editarea de pe alt device: tokenul draftului e stocat doar ca hash, deci
  // proprietarul autentificat primeste rute echivalente scope-uite pe ownership.

  async presignAttachmentForClient(
    userId: string,
    id: string,
    dto: PresignAttachmentDto,
  ): Promise<PresignUploadResultDto> {
    const request = await this.findOwnedRequest(userId, id);
    this.assertAttachmentEditableStatus(request);
    return this.uploads.presign(ENTITY_TYPE_REQUEST, request.id, dto, await this.attachmentCap(request));
  }

  async confirmAttachmentForClient(
    userId: string,
    id: string,
    attachmentId: string,
  ): Promise<AttachmentDto> {
    const request = await this.findOwnedRequest(userId, id);
    this.assertAttachmentEditableStatus(request);
    return this.uploads.confirm(ENTITY_TYPE_REQUEST, request.id, attachmentId);
  }

  async removeAttachmentForClient(userId: string, id: string, attachmentId: string): Promise<void> {
    const request = await this.findOwnedRequest(userId, id);
    this.assertAttachmentEditableStatus(request);
    return this.uploads.remove(ENTITY_TYPE_REQUEST, request.id, attachmentId);
  }

  // ---- helpers ----

  // Cap dinamic de atasamente per cerere: bufferul de la nivel de cerere +
  // schitele si snapshotul 3D al fiecarei camere (feedback PO 2026-07-13:
  // limita e 7 fisiere PER CAMERA, nu 10 per formular). In DRAFT camerele nu
  // sunt materializate in request_rooms — traiesc in configuratorState
  // (snapshotul wizard-ului), de unde citim doar numarul lor.
  private async attachmentCap(request: RequestModel): Promise<number> {
    const persisted = await this.prisma.requestRoom.count({ where: { requestId: request.id } });
    const state = request.configuratorState;
    const draft =
      state && typeof state === 'object' && !Array.isArray(state) &&
      Array.isArray((state as Record<string, unknown>).roomInstances)
        ? ((state as Record<string, unknown>).roomInstances as unknown[]).length
        : 0;
    return maxAttachmentsForRequest(Math.max(persisted, draft));
  }

  private async requireAttachmentEditable(token: string): Promise<RequestModel> {
    const request = await this.findByToken(token);
    this.assertAttachmentEditableStatus(request);
    return request;
  }

  private assertAttachmentEditableStatus(request: RequestModel): void {
    if (!ATTACHMENT_EDITABLE_STATUSES.includes(request.status)) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_NOT_EDITABLE,
        message: 'Attachments cannot be changed in this state',
      });
    }
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

  // Campuri scalare comune publish/edit. Titlul NU e aici: e rezolvat separat
  // (auto-generat cand lipseste din payload — fluxul configurator nu il trimite).
  private scalarData(dto: CreateRequestContentDto) {
    return {
      description: dto.description ?? '',
      budgetRange: dto.budgetRange,
      budgetEstimateRon: dto.budgetEstimateRon ?? null,
      deadlineBucket: dto.deadlineBucket ?? null,
      includesPaidDesign: dto.includesPaidDesign,
      hasOwnProject: dto.hasOwnProject,
      addressText: dto.addressText,
      county: dto.county,
      city: dto.city,
      country: dto.country ?? 'RO',
    };
  }

  // Estimare de buget pre-publish (F5, item 18): scorul camerelor completate —
  // fara bucket-ul de buget (ar fi circular) si fara design platit (se aleg
  // dupa) — inmultit cu BUDGET_RON_PER_POINT; plafonul sliderului = 3× baza.
  async estimate(rooms: ConfiguratorRoomInputDto[]): Promise<{
    score: number;
    minRon: number;
    maxRon: number;
  }> {
    const processed = this.configurator.processRooms(rooms);
    const sizing = await this.sizing.compute({
      scoreEntries: processed.scoreEntries,
      budgetRange: 'UNDISCLOSED',
      includesPaidDesign: false,
    });
    const minRon = sizing.score * BUDGET_RON_PER_POINT;
    return { score: sizing.score, minRon, maxRon: minRon * BUDGET_RANGE_FACTOR };
  }

  // Eticheta RO per tip camera pentru titlul generat automat (singular/plural).
  // Titlul stocat e sursa de adevar (RO); frontendul poate randa varianta localizata
  // din rooms[] + city unde are datele.
  private static readonly ROOM_TITLE_LABELS: Record<string, { one: string; many: string }> = {
    KITCHEN: { one: 'Bucătărie', many: 'Bucătării' },
    BATHROOM: { one: 'Baie', many: 'Băi' },
    BEDROOM: { one: 'Dormitor', many: 'Dormitoare' },
    LIVING: { one: 'Living', many: 'Living-uri' },
    OFFICE: { one: 'Birou', many: 'Birouri' },
    DRESSING: { one: 'Dressing', many: 'Dressing-uri' },
    PIECES: { one: 'Piese individuale', many: 'Piese individuale' },
    HALLWAY: { one: 'Hol', many: 'Holuri' },
    PANTRY: { one: 'Debara', many: 'Debarale' },
    LAUNDRY: { one: 'Spălătorie', many: 'Spălătorii' },
    BALCONY: { one: 'Balcon', many: 'Balcoane' },
    PIECE_WARDROBE: { one: 'Dulap', many: 'Dulapuri' },
    PIECE_TV_UNIT: { one: 'Comodă TV', many: 'Comode TV' },
    PIECE_BOOKCASE: { one: 'Bibliotecă', many: 'Biblioteci' },
    PIECE_BED: { one: 'Pat', many: 'Paturi' },
    PIECE_DESK: { one: 'Birou', many: 'Birouri' },
    PIECE_DRESSER: { one: 'Comodă', many: 'Comode' },
    PIECE_TABLE: { one: 'Masă', many: 'Mese' },
    PIECE_SHOE_CABINET: { one: 'Pantofar', many: 'Pantofare' },
    PIECE_NIGHTSTAND: { one: 'Noptiere', many: 'Noptiere' },
    PIECE_BENCH: { one: 'Băncuță', many: 'Băncuțe' },
  };

  private buildRequestTitle(rooms: ProcessedRoom[], city: string): string {
    const counts = new Map<string, number>();
    for (const room of rooms) counts.set(room.roomType, (counts.get(room.roomType) ?? 0) + 1);
    const parts = [...counts.entries()].map(([type, n]) => {
      const label = RequestsService.ROOM_TITLE_LABELS[type] ?? { one: type, many: type };
      return n === 1 ? label.one : `${n} ${label.many}`;
    });
    const base = parts.join(' + ');
    const full = city ? `${base} — ${city}` : base;
    return full.slice(0, 200);
  }

  private resolveTitle(dto: CreateRequestContentDto, rooms: ProcessedRoom[]): string {
    const manual = dto.title?.trim();
    return manual && manual.length >= 4 ? manual : this.buildRequestTitle(rooms, dto.city);
  }

  // Attachment id-urile din step-urile 'upload' (schita per camera) trebuie sa
  // apartina cererii curente — inchide clasa de atac "id-uri fabricate/straine".
  private async assertRoomAttachments(requestId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const unique = [...new Set(ids)];
    const rows = await this.prisma.attachment.findMany({
      where: { id: { in: unique }, entityType: ENTITY_TYPE_REQUEST, entityId: requestId },
      select: { status: true },
    });
    if (rows.length !== unique.length) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Sketch attachments do not belong to this request',
      });
    }
    // un fisier respins la scanare nu poate pleca in marketplace — clientul il
    // vede marcat cu eroare in wizard si il poate elimina (item 10)
    if (rows.some((r) => r.status === 'BLOCKED')) {
      throw new BadRequestException({
        code: ERROR_CODES.FILE_SCAN_BLOCKED,
        message: 'A blocked attachment is referenced by a room sketch',
      });
    }
  }

  // Formatul valorilor de contact (email valid / telefon RO) — aceeasi schema
  // partajata ca in frontend; class-validator verifica doar forma de transport.
  private assertContactFormats(
    contacts: CreateRequestContentDto['contactPreferences'],
  ): void {
    const parsed = contactPreferencesSchema.safeParse(contacts);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Contact preferences invalid',
        details: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      });
    }
  }

  // Inlocuieste camerele derivate + itemele lor. Fiecare camera pastreaza in plus
  // answers-ul brut si flowVersion (sursa de adevar pentru randarea detaliu).
  private async writeRooms(
    tx: Prisma.TransactionClient,
    requestId: string,
    rooms: ProcessedRoom[],
  ): Promise<void> {
    await tx.requestRoom.deleteMany({ where: { requestId } });
    for (const room of rooms) {
      await tx.requestRoom.create({
        data: {
          requestId,
          roomType: room.roomType,
          lengthM: room.derived.lengthM,
          widthM: room.derived.widthM,
          heightM: room.derived.heightM,
          answers: room.answers as Prisma.InputJsonValue,
          flowVersion: room.flowVersion,
          items: {
            create: room.derived.items.map((it) => ({
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

  private async writeContactPreferences(
    tx: Prisma.TransactionClient,
    requestId: string,
    contactPreferences: CreateRequestContentDto['contactPreferences'],
  ): Promise<void> {
    await tx.requestContactPreference.deleteMany({ where: { requestId } });
    await tx.requestContactPreference.createMany({
      data: contactPreferences.map((c) => ({
        requestId,
        channel: c.channel,
        value: c.value,
      })),
    });
  }

  // pozele din galerie alese ca inspiratie (F6, item 3) — inlocuire completa;
  // validitatea (publicate, nesterse) e verificata inainte de tranzactie
  private async writeInspirationPhotos(
    tx: Prisma.TransactionClient,
    requestId: string,
    photoIds: string[] | undefined,
  ): Promise<void> {
    if (photoIds === undefined) return;
    await tx.requestInspirationPhoto.deleteMany({ where: { requestId } });
    const unique = [...new Set(photoIds)];
    if (unique.length > 0) {
      await tx.requestInspirationPhoto.createMany({
        data: unique.map((photoId) => ({ requestId, photoId })),
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
        contactPreferences: true,
        inspirationPhotos: { select: { photoId: true } },
      },
    });
    const attachments = await this.uploads.listForEntity(ENTITY_TYPE_REQUEST, id);

    return {
      id: request.id,
      status: request.status,
      title: request.title ?? '',
      description: request.description ?? '',
      budgetRange: request.budgetRange ?? 'UNDISCLOSED',
      budgetEstimateRon: request.budgetEstimateRon,
      deadlineBucket: request.deadlineBucket,
      includesPaidDesign: request.includesPaidDesign,
      hasOwnProject: request.hasOwnProject,
      addressText: request.addressText ?? '',
      county: request.county ?? '',
      city: request.city ?? '',
      country: request.country,
      // Marimea/costul in credite si coordonatele NU sunt informatii de client:
      // ele privesc firmele (marketplace) si adminul. DTO-ul de proprietar le ascunde.
      lat: null,
      lng: null,
      sizing: null,
      preClaimEditsUsed: request.preClaimEditsUsed,
      postClaimEditsUsed: request.postClaimEditsUsed,
      publishedAt: request.publishedAt?.toISOString() ?? null,
      expiresAt: request.expiresAt?.toISOString() ?? null,
      repostUsed: request.repostUsed,
      createdAt: request.createdAt.toISOString(),
      configuratorState: (request.configuratorState ?? null) as unknown,
      // createdAt e identic pentru toate camerele unei publicari (aceeasi tranzactie),
      // deci orderBy-ul din query nu e determinist — ordinea canonica vine din ROOM_ORDER
      rooms: sortByRoomOrder(request.rooms).map((r) => ({
        id: r.id,
        roomType: r.roomType,
        lengthM: r.lengthM,
        widthM: r.widthM,
        heightM: r.heightM,
        answers: (r.answers ?? null) as Record<string, unknown> | null,
        flowVersion: r.flowVersion,
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
      })),
      attachments,
      inspirationPhotoIds: request.inspirationPhotos.map((p) => p.photoId),
    };
  }
}
