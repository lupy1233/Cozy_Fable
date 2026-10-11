import {
  type AttachmentDto,
  BUDGET_RANGE_FACTOR,
  BUDGET_RON_PER_POINT,
  type ClientDashboardStatsDto,
  type DashboardActionItemDto,
  sortDashboardActions,
  contactPreferencesSchema,
  ERROR_CODES,
  maxAttachmentsForRequest,
  mergeAccountEmail,
  PRE_CLAIM_CONTACT_TEXT_POLICIES,
  type PreClaimContactTextPolicy,
  type ContactDetectionAction,
  type ContactDetectionTrigger,
  SETTING_PRE_CLAIM_CONTACT_TEXT_POLICY,
  type PresignUploadResultDto,
  type RequestDraftCreatedDto,
  type RequestDto,
  type RequestListItemDto,
  type RequestStudioSceneData,
  type RequestVisibilityContactHolderDto,
  type RequestVisibilityDto,
  sortByRoomOrder,
} from '@marketplace/shared';
import { ConfiguratorService, type ProcessedRoom } from './configurator.service';
import {
  assertInspirationRooms,
  inspirationNotesForScreening,
  inspirationRows,
  readInspirationSelection,
  type InspirationSelection,
} from './inspiration-selection';
import { assertStudioNightstands, parsePublicationScenes, resolvePublicationScenes } from './studio-publication';
import { normalizeBudget, projectFileCount } from './publish-rules';
import { screenRequestText, type ContactScreeningRow } from './contact-screening';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request as RequestModel, RequestStatus, RoomType } from '@prisma/client';
import { Queue } from 'bullmq';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { QUEUE_REQUEST_EXPIRATION } from '../../infra/queues/queues.module';
import { SizingService } from '../sizing/sizing.service';
import { InspirationService } from '../inspiration/inspiration.service';
import { GeoService } from '../geo/geo.service';
import { UploadsService } from '../uploads/uploads.service';
import { ClaimSettlementService } from '../billing/claim-settlement.service';
import { SettingsService } from '../../common/settings/settings.service';
import { SETTING_DEFAULTS } from '../../common/settings/setting-defaults';
import {
  ACCEPTABLE_REQUEST_STATUSES,
  OCCUPYING_CLAIM_STATUSES,
  SETTING_CLAIMS_OPEN_AFTER_FIRST_OFFER,
  claimableStatuses,
} from '../claims/claims.constants';
import { readClaimContactAccessSettings, resolveClaimContextAccess } from '../quotes/claim-context-access';
import { AUTO_COMPLETE_DAYS } from '../fulfillment/fulfillment.service';
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
import { requestExpiryReminderAt, scheduleRequestExpiryReminder } from './request-expiry-reminder';

// Statusuri in care editarea e blocata pentru ca exista deja oferte/negociere.
const OFFER_LOCKED_STATUSES: RequestStatus[] = [
  'OFFERS_RECEIVED',
  'NEGOTIATION',
  'ACCEPTED',
  'IN_EXECUTION',
  'DELIVERED_BY_COMPANY',
];
const POST_CLAIM_STATUSES: RequestStatus[] = ['CLAIMED_PARTIAL', 'CLAIMED_FULL'];

// E-admin-platform-44 — lista "De facut acum" a clientului
const DAY_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_EXPIRING_LOOKAHEAD_MS = 14 * DAY_MS;
const DASHBOARD_ACTIONS_MAX = 20;
// E-admin-platform-45 (security close): max randuri BLOCKED logate pe cerere intr-o ora.
const BLOCKED_DETECTION_LOG_CAP_PER_HOUR = 100;
// Atasamentele se pot modifica cat timp cererea nu e terminala.
const ATTACHMENT_EDITABLE_STATUSES: RequestStatus[] = [
  'DRAFT',
  'IN_MARKETPLACE',
  'CLAIMED_PARTIAL',
  'CLAIMED_FULL',
];

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
    private readonly sizing: SizingService,
    private readonly configurator: ConfiguratorService,
    private readonly uploads: UploadsService,
    private readonly inspiration: InspirationService,
    private readonly calendar: BusinessCalendarService,
    private readonly outbox: OutboxService,
    private readonly settlement: ClaimSettlementService,
    @InjectQueue(QUEUE_REQUEST_EXPIRATION) private readonly expirationQueue: Queue,
    private readonly settings: SettingsService,
  ) {}

  // Cap de marime pentru starea bruta a wizard-ului salvata pe draft.
  private static readonly MAX_CONFIGURATOR_STATE_CHARS = 600_000;

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

  // callerId obligatoriu: fiecare apelant decide explicit (null = anonim).
  private async findByToken(token: string, callerId: string | null): Promise<RequestModel> {
    const request = await this.prisma.request.findUnique({
      where: { draftTokenHash: this.hashToken(token) },
    });
    // o cerere stearsa (soft delete / ciorna aruncata) nu mai e accesibila prin token
    if (!request || request.deletedAt) {
      throw new NotFoundException({
        code: ERROR_CODES.DRAFT_TOKEN_INVALID,
        message: 'Draft token invalid',
      });
    }
    // tokenul e secretul unei CIORNE: dupa publicare nu mai deschide nimic; un alt cont
    // logat nu vede ciorna altcuiva (404, fara enumerare)
    if (
      request.status !== 'DRAFT' ||
      (callerId !== null && request.clientUserId !== null && request.clientUserId !== callerId)
    ) {
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

  async getDraft(token: string, callerId: string | null): Promise<RequestDto> {
    const request = await this.findByToken(token, callerId);
    return this.toDto(request.id);
  }

  // "Incepe o cerere noua" (PO r5): ciorna abandonata se arunca, nu ramane in DB
  // la nesfarsit. Soft delete, doar pe status DRAFT — dupa asta tokenul nu mai
  // rezolva nimic (findByToken respinge cererile sterse).
  async discardDraft(token: string, callerId: string | null): Promise<{ ok: true }> {
    const request = await this.findByToken(token, callerId);
    if (request.status !== 'DRAFT') {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_NOT_EDITABLE,
        message: 'Only drafts can be discarded',
      });
    }
    await this.prisma.request.update({
      where: { id: request.id },
      // tokenul moare odata cu ciorna (draft_token_hash NULL pe orice rand sters/publicat)
      data: { deletedAt: new Date(), draftTokenHash: null },
    });
    return { ok: true };
  }

  async patchDraft(token: string, dto: PatchDraftDto, callerId: string | null): Promise<RequestDto> {
    const request = await this.findByToken(token, callerId);
    if (request.status !== 'DRAFT') {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_NOT_EDITABLE,
        message: 'Only drafts can be patched; use edit after publishing',
      });
    }
    const configuratorState = this.serializeConfiguratorState(dto.configuratorState);
    await runTx(this.prisma, 'write', async (tx) => {
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
          // ciorna anonima salvata de un user logat devine a lui (fill as guest, login to publish)
          ...(callerId && !request.clientUserId ? { clientUserId: callerId } : {}),
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
    rawDto: CreateRequestContentDto,
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
    const request = await this.findByToken(token, userId);
    if (request.status !== 'DRAFT') {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_NOT_EDITABLE,
        message: 'Request already published',
      });
    }
    // bucket-ul de buget derivat din estimarea RON (acelasi dto merge in
    // scalarData, sizing si snapshotul de versiune)
    const dto = normalizeBudget(rawDto);

    // valideaza raspunsurile + deriva camere/items/scoring (sursa de adevar server)
    const processed = this.configurator.processRooms(dto.rooms, {
      ownProject: dto.hasOwnProject,
      designBrief: dto.includesPaidDesign,
    });
    // emailul contului e mereu prima cale de comunicare (PO r5) — FE il blocheaza,
    // serverul il garanteaza (prepend + dedupe + plafoane) inainte de validarea formatelor
    const contacts = await this.withAccountEmail(userId, dto.contactPreferences);
    this.assertContactFormats(contacts);
    // E-client-34: poze de inspiratie cu notita + camera (inspirationPhotoIds ramane acceptat)
    const inspirationSelection = readInspirationSelection(dto);
    assertInspirationRooms(inspirationSelection, processed.rooms);
    await this.inspiration.assertSelectable(inspirationSelection?.map((s) => s.photoId) ?? []);
    await this.assertRoomAttachments(request.id, processed.rooms);
    if (dto.hasOwnProject === true) {
      await this.assertProjectFile(request.id, new Set(this.configurator.collectUploadAttachmentIds(processed.rooms)));
    }

    // Payloadul live evita cursa cu autosave; vechii clienti folosesc draftul.
    // Parsat inainte de geocodare/sizing: o scena invalida nu costa apeluri externe.
    const studioScenes = dto.studioScenes === undefined
      ? this.extractStudioScenes(request.configuratorState) : parsePublicationScenes(dto.studioScenes);
    assertStudioNightstands(studioScenes, processed.rooms);
    // E-admin-platform-45: contacte in texte libere — inainte de geocodare (BLOCK nu costa apeluri externe)
    const contactScreen = await this.screenContacts(
      request.id,
      'PUBLISH',
      dto,
      processed.rooms,
      inspirationNotesForScreening(inspirationSelection, processed.rooms),
    );

    const geo = await this.geo.geocode(dto.addressText, dto.city, dto.county, dto.country);
    const sizing = await this.sizing.compute({
      scoreEntries: processed.scoreEntries,
      budgetRange: dto.budgetRange,
      includesPaidDesign: dto.includesPaidDesign,
    });

    const now = new Date();
    const expiresAt = this.calendar.addWorkingDays(now, EXPIRATION_WORKING_DAYS);

    await runTx(this.prisma, 'write', async (tx) => {
      await tx.request.update({
        where: { id: request.id },
        data: {
          ...this.scalarData(dto),
          title: this.resolveTitle(dto, processed.rooms, contactScreen.titleHasContact),
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
          // tokenul de draft moare la publicare (SEC2-4); proprietarul lucreaza pe rutele autentificate :id
          draftTokenHash: null,
        },
      });
      const roomIds = await this.writeRooms(tx, request.id, processed.rooms);
      await this.writeContactPreferences(tx, request.id, contacts);
      await this.writeInspirationPhotos(tx, request.id, inspirationSelection, roomIds);
      await this.writeStudioScenes(tx, request.id, resolvePublicationScenes(studioScenes, processed.rooms, roomIds));
      await this.writeVersion(tx, request.id, dto);
      if (contactScreen.rows.length > 0) {
        await tx.requestContactDetection.createMany({ data: contactScreen.rows });
      }
      await this.outbox.record(tx, `request.published:${request.id}`, 'request.status_changed', { requestId: request.id, status: 'IN_MARKETPLACE' }, []);
    });

    await this.scheduleExpiration(request.id, expiresAt);

    return this.toDto(request.id);
  }

  // ---- editare post-publicare (3 pre-claim / 1 post-claim) ----

  // proprietarul autentificat, de pe orice device (tokenul de draft moare la publicare)
  async editForClient(userId: string, id: string, dto: CreateRequestContentDto): Promise<RequestDto> {
    const request = await this.findOwnedRequest(userId, id);
    return this.editRequest(request, dto);
  }

  private async editRequest(request: RequestModel, rawDto: CreateRequestContentDto): Promise<RequestDto> {
    const editCounters = this.assertEditableAndCount(request);
    const dto = normalizeBudget(rawDto);

    const processed = this.configurator.processRooms(dto.rooms, {
      ownProject: dto.hasOwnProject,
      designBrief: dto.includesPaidDesign,
    });
    const contacts = await this.withAccountEmail(request.clientUserId, dto.contactPreferences);
    this.assertContactFormats(contacts);
    const inspirationSelection = readInspirationSelection(dto);
    assertInspirationRooms(inspirationSelection, processed.rooms);
    await this.inspiration.assertSelectable(inspirationSelection?.map((s) => s.photoId) ?? []);
    await this.assertRoomAttachments(request.id, processed.rooms);
    if (dto.hasOwnProject === true) {
      await this.assertProjectFile(request.id, new Set(this.configurator.collectUploadAttachmentIds(processed.rooms)));
    }
    const studioScenes = dto.studioScenes === undefined
      ? parsePublicationScenes((await this.prisma.requestStudioScene.findMany({ where: { requestId: request.id } })).map((s) => s.data))
      : parsePublicationScenes(dto.studioScenes);
    assertStudioNightstands(studioScenes, processed.rooms);
    // E-admin-platform-45: BLOCK refuza inainte de geocodare si fara sa consume editarea
    const contactScreen = await this.screenContacts(
      request.id,
      'EDIT',
      dto,
      processed.rooms,
      inspirationNotesForScreening(inspirationSelection, processed.rooms),
    );

    const addressChanged =
      request.addressText !== dto.addressText ||
      request.city !== dto.city ||
      request.county !== dto.county ||
      request.country !== (dto.country ?? 'RO');
    const geo = addressChanged
      ? await this.geo.geocode(dto.addressText, dto.city, dto.county, dto.country)
      : { lat: request.lat, lng: request.lng };
    const sizing = await this.sizing.compute({
      scoreEntries: processed.scoreEntries,
      budgetRange: dto.budgetRange,
      includesPaidDesign: dto.includesPaidDesign,
    });

    await runTx(this.prisma, 'write', async (tx) => {
      await tx.request.update({
        where: { id: request.id },
        data: {
          ...this.scalarData(dto),
          title: this.resolveTitle(dto, processed.rooms, contactScreen.titleHasContact),
          lat: geo.lat,
          lng: geo.lng,
          sizeScore: sizing.score,
          projectSize: sizing.size,
          creditCost: sizing.creditCost,
          lastEditAt: new Date(),
          ...editCounters,
        },
      });
      const roomIds = await this.writeRooms(tx, request.id, processed.rooms);
      await this.writeStudioScenes(tx, request.id, resolvePublicationScenes(studioScenes, processed.rooms, roomIds));
      await this.writeContactPreferences(tx, request.id, contacts);
      await this.writeInspirationPhotos(tx, request.id, inspirationSelection, roomIds);
      await this.writeVersion(tx, request.id, dto);
      if (contactScreen.rows.length > 0) {
        await tx.requestContactDetection.createMany({ data: contactScreen.rows });
      }
      await this.outbox.record(tx, `request.edited:${request.id}:${randomUUID()}`, 'request.status_changed', { requestId: request.id, status: request.status, edited: true }, []);
    });

    return this.toDto(request.id);
  }

  // ---- repost cerere expirata (o singura data) ----

  // repost din contul proprietarului, de pe orice device (docs/03 4.4: o singura data, manual)
  async repostForClient(userId: string, id: string): Promise<RequestDto> {
    const request = await this.findOwnedRequest(userId, id);
    return this.repostRequest(request);
  }

  private async repostRequest(request: RequestModel): Promise<RequestDto> {
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

    const reposted = await runTx(this.prisma, 'write', async (tx) => {
      // updateMany conditionat: dublu-click / doua device-uri → un singur repost, un singur eveniment
      const res = await tx.request.updateMany({
        where: { id: request.id, status: 'EXPIRED', repostUsed: false, deletedAt: null },
        data: { status: 'IN_MARKETPLACE', repostUsed: true, publishedAt: now, expiresAt },
      });
      if (res.count !== 1) return false;
      await this.outbox.record(tx, `request.reposted:${request.id}`, 'request.status_changed', { requestId: request.id, status: 'IN_MARKETPLACE', reposted: true }, []);
      return true;
    });
    if (!reposted) {
      throw new BadRequestException({
        code: ERROR_CODES.REPOST_ALREADY_USED,
        message: 'Repost already used',
      });
    }

    await this.scheduleExpiration(request.id, expiresAt);

    return this.toDto(request.id);
  }

  // ---- liste client autenticat ----

  // Ciornele NU apar in "Cererile mele" (PO r5): sunt goale, fara actiuni, si se
  // acumuleaza la fiecare "Incepe o cerere noua". Reluarea unei ciorne se face
  // din configurator (dialogul de resume, token in localStorage), nu din lista.
  async listForClient(userId: string): Promise<RequestListItemDto[]> {
    const rows = await this.prisma.request.findMany({
      where: { clientUserId: userId, deletedAt: null, status: { not: 'DRAFT' } },
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

  // E-client-9 (C7-16, docs/03 4.2): cardul "Cine vede cererea". Proiectul e in marketplace cat
  // timp cererea e claimabila (aceleasi reguli ca SQL-ul din marketplace, fara raza — clientul nu
  // stie firmele din zona); contactele le au doar firmele cu slot ocupant, evaluate cu exact
  // functia fisei de lucru (resolveClaimContextAccess) → cardul nu poate contrazice ce primesc
  // firmele. Doar citire (GET, sigur pe slotul standby).
  async getVisibilityForClient(userId: string, id: string): Promise<RequestVisibilityDto> {
    const request = await this.findOwnedRequest(userId, id);
    const [openAfterFirstOffer, maxClaims, [revealPolicy], slots] = await Promise.all([
      this.settings.getBool(SETTING_CLAIMS_OPEN_AFTER_FIRST_OFFER, SETTING_DEFAULTS.claims_open_after_first_offer),
      this.settings.getInt('max_claims_per_request', SETTING_DEFAULTS.max_claims_per_request),
      readClaimContactAccessSettings(this.settings),
      this.prisma.claimSlot.findMany({
        where: { requestId: id, status: { in: OCCUPYING_CLAIM_STATUSES } },
        include: { company: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const projectVisibleInMarketplace =
      claimableStatuses(openAfterFirstOffer).includes(request.status) &&
      request.publishedAt !== null &&
      request.lat !== null &&
      request.lng !== null &&
      slots.length < maxClaims;
    const now = Date.now();
    const contactHolders: RequestVisibilityContactHolderDto[] = [];
    for (const slot of slots) {
      const access = resolveClaimContextAccess({
        slotStatus: slot.status,
        requestDeletedAt: request.deletedAt,
        slotCreatedAt: slot.createdAt,
        slotUpdatedAt: slot.updatedAt,
        requestDeliveredAt: request.deliveredAt,
        claimedByUserId: slot.claimedByUserId,
        assignedToUserId: slot.assignedToUserId,
        // conducerea firmei: accesul maxim pe care il poate avea firma
        memberRole: 'OWNER',
        actingUserId: slot.claimedByUserId,
        revealPolicy,
        retentionDays: 0,
        now,
      });
      if (access.visibility !== 'FULL') continue;
      contactHolders.push({
        claimSlotId: slot.id,
        companyName: slot.company.name,
        claimStatus: slot.status as RequestVisibilityContactHolderDto['claimStatus'],
        claimedAt: slot.createdAt.toISOString(),
        contactsVisibleFrom: access.clientVisibleFrom?.toISOString() ?? null,
      });
    }
    return { requestId: id, projectVisibleInMarketplace, contactHolders };
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

  // Statistici agregate pentru dashboardul clientului (fara ciorne, ca lista).
  async dashboardStatsForClient(userId: string): Promise<ClientDashboardStatsDto> {
    const where = {
      clientUserId: userId,
      deletedAt: null,
      status: { not: 'DRAFT' as RequestStatus },
    };
    const now = new Date();
    const [total, grouped, offersReceived, activeClaims, recent, toReview, toConfirm, pendingClarifications, expiring] = await Promise.all([
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
      // E-admin-platform-44 — "De facut acum": (a) oferte de analizat
      this.prisma.request.findMany({
        where: {
          clientUserId: userId,
          deletedAt: null,
          status: { in: ACCEPTABLE_REQUEST_STATUSES },
          quotes: { some: { status: 'SENT' } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: { id: true, title: true, _count: { select: { quotes: { where: { status: 'SENT' } } } } },
      }),
      // (b) livrare de confirmat (se confirma automat dupa AUTO_COMPLETE_DAYS)
      this.prisma.request.findMany({
        where: { clientUserId: userId, deletedAt: null, status: 'DELIVERED_BY_COMPANY' },
        orderBy: { deliveredAt: 'asc' },
        take: 10,
        select: { id: true, title: true, deliveredAt: true },
      }),
      // (c) clarificari care asteapta raspunsul clientului
      this.prisma.clarificationRequest.findMany({
        where: {
          status: 'PENDING',
          claimSlot: { status: 'ACTIVE', request: { clientUserId: userId, deletedAt: null } },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: { claimSlot: { select: { requestId: true, request: { select: { title: true } } } } },
      }),
      // (d) cereri inca nepreluate, aproape de expirare (fereastra reminderului 4.4)
      this.prisma.request.findMany({
        where: {
          clientUserId: userId,
          deletedAt: null,
          status: 'IN_MARKETPLACE',
          expiresAt: { gt: now, lte: new Date(now.getTime() + DASHBOARD_EXPIRING_LOOKAHEAD_MS) },
        },
        orderBy: { expiresAt: 'asc' },
        take: 10,
        select: { id: true, title: true, expiresAt: true },
      }),
    ]);

    const byStatus: ClientDashboardStatsDto['byStatus'] = {};
    for (const g of grouped) byStatus[g.status] = g._count._all;

    const actions: DashboardActionItemDto[] = [];
    for (const r of toReview) {
      actions.push({ kind: 'OFFERS_TO_REVIEW', requestId: r.id, claimSlotId: null, title: r.title ?? '', count: r._count.quotes, dueAt: null });
    }
    for (const r of toConfirm) {
      const dueAt = r.deliveredAt ? new Date(r.deliveredAt.getTime() + AUTO_COMPLETE_DAYS * DAY_MS).toISOString() : null;
      actions.push({ kind: 'DELIVERY_TO_CONFIRM', requestId: r.id, claimSlotId: null, title: r.title ?? '', count: null, dueAt });
    }
    const byRequest = new Map<string, DashboardActionItemDto>();
    for (const c of pendingClarifications) {
      const existing = byRequest.get(c.claimSlot.requestId);
      if (existing) existing.count = (existing.count ?? 0) + 1;
      else byRequest.set(c.claimSlot.requestId, {
        kind: 'CLARIFICATION_TO_ANSWER',
        requestId: c.claimSlot.requestId,
        claimSlotId: null,
        title: c.claimSlot.request.title ?? '',
        count: 1,
        dueAt: null,
      });
    }
    actions.push(...byRequest.values());
    for (const r of expiring) {
      if (!r.expiresAt || requestExpiryReminderAt(this.calendar, r.expiresAt).getTime() > now.getTime()) continue;
      actions.push({ kind: 'REQUEST_EXPIRING', requestId: r.id, claimSlotId: null, title: r.title ?? '', count: null, dueAt: r.expiresAt.toISOString() });
    }

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
      actions: sortDashboardActions(actions).slice(0, DASHBOARD_ACTIONS_MAX),
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
    // Invarianta 3.1 (R8, audit 2026-08-23): stergerea schimba numarul de sloturi active →
    // Serializable + FOR UPDATE pe cerere (acelasi lock ca la claim/accept), altfel un claim
    // comis intre findMany si scrierea lui deletedAt lasa un slot ACTIVE pe o cerere stearsa,
    // cu creditele RESERVED blocate pe veci (procesoarele ies no-op pe deleted_at).
    await runTx(this.prisma, 'claim', async (tx) => {
      const locked = await tx.$queryRaw<
        { id: string; status: RequestStatus; deleted_at: Date | null }[]
      >`SELECT id, status, deleted_at FROM requests WHERE id = ${id} FOR UPDATE`;
      const req = locked[0];
      if (!req || req.deleted_at !== null) {
        throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });
      }
      if (!deletable.includes(req.status)) {
        throw new BadRequestException({
          code: ERROR_CODES.REQUEST_NOT_DELETABLE,
          message: 'Request cannot be deleted in this state',
        });
      }
      const claims = await tx.claimSlot.findMany({
        where: { requestId: id, status: { in: ['ACTIVE', 'OFFER_SENT'] } },
      });
      const closed: typeof claims = [];
      for (const c of claims) {
        // tranzitie conditionata (settle): slot decontat intre timp pe alta cale (retragere/SLA)
        // → nedecontat, fara refund dublu (audit 2026-08-23); ofertele deschise ale slotului
        // nu mai pot fi acceptate, chat read-only (L0-B).
        const res = await this.settlement.settle(tx, {
          claimSlotId: c.id,
          from: ['ACTIVE', 'OFFER_SENT'],
          to: 'CANCELLED_BY_CLIENT',
          outcome: 'REFUND',
          reason: 'REQUEST_DELETED_BY_CLIENT',
          quotes: 'WITHDRAWN',
          slot: c,
        });
        if (!res.settled) continue;
        closed.push(c);
        const members = await tx.companyMember.findMany({ where: { companyId: c.companyId }, select: { userId: true } });
        await this.outbox.record(tx, `request.deleted:claim:${c.id}`, 'claim.withdrawn', {
          claimSlotId: c.id, requestId: id, reason: 'CANCELLED_BY_CLIENT', refunded: res.refunded,
        }, members.map((member) => member.userId));
      }
      await tx.request.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.outbox.record(tx, `request.deleted:${id}`, 'request.status_changed', { requestId: id, deleted: true }, []);
      return closed;
    });
    return { ok: true };
  }

  // ---- atasamente (delegare la UploadsService) ----

  async presignAttachment(
    token: string,
    dto: PresignAttachmentDto,
    callerId: string | null,
  ): Promise<PresignUploadResultDto> {
    const request = await this.requireAttachmentEditable(token, callerId);
    return this.uploads.presign(ENTITY_TYPE_REQUEST, request.id, dto, await this.attachmentCap(request));
  }

  async confirmAttachment(
    token: string,
    attachmentId: string,
    callerId: string | null,
  ): Promise<AttachmentDto> {
    const request = await this.requireAttachmentEditable(token, callerId);
    return this.uploads.confirm(ENTITY_TYPE_REQUEST, request.id, attachmentId);
  }

  async removeAttachment(token: string, attachmentId: string, callerId: string | null): Promise<void> {
    const request = await this.requireAttachmentEditable(token, callerId);
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

  private async requireAttachmentEditable(token: string, callerId: string | null): Promise<RequestModel> {
    const request = await this.findByToken(token, callerId);
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
    // designBrief=true (validare partiala): estimarea e informativa, nu punctul
    // de publish — camerele fara dimensiuni (proiect propriu) nu o blocheaza
    const processed = this.configurator.processRooms(rooms, { designBrief: true });
    const sizing = await this.sizing.compute({
      scoreEntries: processed.scoreEntries,
      budgetRange: 'UNDISCLOSED',
      includesPaidDesign: false,
    });
    // E-admin-platform-14 / PO r5 V1: minimul = scorul de BAZA (doar camerele), deci
    // costul = minRon/1000 chiar daca adminul schimba ponderea BUDGET:UNDISCLOSED.
    const minRon = sizing.baseScore * BUDGET_RON_PER_POINT;
    return { score: sizing.baseScore, minRon, maxRon: minRon * BUDGET_RANGE_FACTOR };
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
    PIECE_SIDEBOARD: { one: 'Bufet', many: 'Bufete' },
    PIECE_WALL_CABINET: { one: 'Corp suspendat', many: 'Corpuri suspendate' },
    PIECE_BATHROOM_VANITY: { one: 'Mobilier lavoar', many: 'Corpuri lavoar' },
    PIECE_ENTRYWAY: { one: 'Mobilier hol', many: 'Piese pentru hol' },
    PIECE_SOFA: { one: 'Canapea', many: 'Canapele' },
    PIECE_ARMCHAIR: { one: 'Fotoliu', many: 'Fotolii' },
    PIECE_OTTOMAN: { one: 'Taburet tapițat', many: 'Taburete tapițate' },
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

  // Un titlu manual cu date de contact e inlocuit cu titlul automat (E-admin-platform-45):
  // titlul ajunge la firme si in notificari, unde mascarea la citire nu ajunge.
  private resolveTitle(dto: CreateRequestContentDto, rooms: ProcessedRoom[], titleHasContact = false): string {
    const manual = dto.title?.trim();
    if (titleHasContact) return this.buildRequestTitle(rooms, dto.city);
    return manual && manual.length >= 4 ? manual : this.buildRequestTitle(rooms, dto.city);
  }

  // E-admin-platform-45 (F2-16, docs/03 4.2): telefoane/emailuri/linkuri in texte libere.
  // MASK (implicit, DECIZIE NECESARA PO): textul se salveaza neschimbat, firmele fara acces
  // la contacte vad tokenul (mascare la citire); randurile de log se scriu in tranzactia
  // de publicare/editare. BLOCK: 400 REQUEST_CONTACT_INFO_IN_TEXT cu detalii per camp,
  // randurile BLOCKED se scriu separat (tranzactia nu mai porneste). Titlul nu blocheaza.
  private async screenContacts(
    requestId: string,
    trigger: ContactDetectionTrigger,
    dto: CreateRequestContentDto,
    rooms: ProcessedRoom[],
    inspirationNotes: { photoId: string; note: string; roomType: RoomType | null }[] = [],
  ): Promise<{ rows: Prisma.RequestContactDetectionCreateManyInput[]; titleHasContact: boolean }> {
    const screen = screenRequestText({ manualTitle: dto.title, description: dto.description, rooms, inspirationNotes });
    if (screen.rows.length === 0) return { rows: [], titleHasContact: false };

    const raw = await this.settings.getString(
      SETTING_PRE_CLAIM_CONTACT_TEXT_POLICY,
      SETTING_DEFAULTS.pre_claim_contact_text_policy,
    );
    const policy: PreClaimContactTextPolicy = (PRE_CLAIM_CONTACT_TEXT_POLICIES as readonly string[]).includes(raw)
      ? (raw as PreClaimContactTextPolicy)
      : 'MASK';
    const toData = (row: ContactScreeningRow, action: ContactDetectionAction): Prisma.RequestContactDetectionCreateManyInput => ({
      requestId,
      trigger,
      field: row.field,
      roomType: row.roomType,
      stepId: row.stepId,
      kinds: row.kinds,
      excerpt: row.excerpt,
      action,
    });

    if (policy === 'BLOCK' && screen.blockingDetails.length > 0) {
      const data = screen.rows.map((row) => toData(row, row.hideable ? 'BLOCKED' : 'FLAGGED'));
      // plafon anti-bucla: reincercarile repetate ale aceleiasi cereri nu umfla tabela de log
      const recentBlocked = await this.prisma.requestContactDetection.count({
        where: { requestId, action: 'BLOCKED', createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      });
      if (recentBlocked < BLOCKED_DETECTION_LOG_CAP_PER_HOUR) {
        await this.prisma.requestContactDetection.createMany({ data });
      }
      this.logger.warn(`contact info in free text: request=${requestId} trigger=${trigger} rows=${data.length} action=BLOCKED`);
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_CONTACT_INFO_IN_TEXT,
        message: 'Free text contains contact details',
        details: screen.blockingDetails,
      });
    }

    const rows = screen.rows.map((row) =>
      toData(row, !row.hideable ? 'FLAGGED' : row.field === 'TITLE' ? 'TITLE_REPLACED' : 'MASKED'),
    );
    this.logger.log(`contact info in free text: request=${requestId} trigger=${trigger} rows=${rows.length} action=${policy}`);
    return { rows, titleHasContact: screen.titleHasContact };
  }

  // Attachment id-urile din step-urile 'upload' (schita per camera, snapshot3d)
  // trebuie sa apartina cererii curente — inchide clasa de atac "id-uri
  // fabricate/straine". Erorile poarta {roomIndex, stepId, messageKey}, ca
  // sumarul din FE sa trimita clientul direct la pasul cu fisierul lipsa.
  private async assertRoomAttachments(requestId: string, rooms: ProcessedRoom[]): Promise<void> {
    const refs = this.configurator.collectUploadAttachmentRefs(rooms);
    if (refs.length === 0) return;
    const unique = [...new Set(refs.map((r) => r.id))];
    const rows = await this.prisma.attachment.findMany({
      where: { id: { in: unique }, entityType: ENTITY_TYPE_REQUEST, entityId: requestId },
      select: { id: true, status: true },
    });
    const statusById = new Map(rows.map((r) => [r.id, r.status]));
    const missing = refs.filter((r) => !statusById.has(r.id));
    if (missing.length > 0) {
      throw new BadRequestException({
        code: ERROR_CODES.CONFIGURATOR_ANSWERS_INVALID,
        message: 'Sketch attachments are unavailable',
        details: missing.map((r) => ({ roomIndex: r.roomIndex, stepId: r.stepId, messageKey: 'validation.fileUnavailable' })),
      });
    }
    // un fisier respins la scanare nu poate pleca in marketplace — clientul il
    // vede marcat cu eroare in wizard si il poate elimina (item 10)
    const blocked = refs.filter((r) => statusById.get(r.id) === 'BLOCKED');
    if (blocked.length > 0) {
      throw new BadRequestException({
        code: ERROR_CODES.FILE_SCAN_BLOCKED,
        message: 'A blocked attachment is referenced by a room sketch',
        details: blocked.map((r) => ({ roomIndex: r.roomIndex, stepId: r.stepId, messageKey: 'validation.answerInvalid' })),
      });
    }
  }

  // "Am deja un proiect" (docs/03 4.1: clientul ataseaza proiectul propriu):
  // cel putin un fisier SAFE al cererii pe care nu il refera nicio camera.
  private async assertProjectFile(requestId: string, referencedIds: Set<string>): Promise<void> {
    const rows = await this.prisma.attachment.findMany({
      where: { entityType: ENTITY_TYPE_REQUEST, entityId: requestId },
      select: { id: true, status: true },
    });
    if (projectFileCount(rows, referencedIds) === 0) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_PROJECT_FILE_REQUIRED,
        message: 'Own project requires at least one project file',
      });
    }
  }

  // Emailul contului e intotdeauna prima cale de comunicare (PO r5, 2026-07-13):
  // orice varianta a lui trimisa de client se scoate (dedupe case-insensitive),
  // apoi se pune pe pozitia 0. Restul contactelor (email secundar / telefoane)
  // raman in ordinea trimisa; surplusul peste plafoane (max 4, max 2 per canal)
  // se taie de mergeAccountEmail (shared, acelasi helper ca sumarul din FE).
  private async withAccountEmail(
    userId: string | null,
    contacts: CreateRequestContentDto['contactPreferences'],
  ): Promise<CreateRequestContentDto['contactPreferences']> {
    if (!userId) return contacts;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const merged = mergeAccountEmail(contacts, user?.email);
    // fallback pentru clienti vechi: FE arata deja ce s-a scos; aici doar numarul (fara PII)
    if (merged.dropped.length > 0) {
      this.logger.debug(`withAccountEmail dropped ${merged.dropped.length} contact(s) over the caps`);
    }
    return merged.contacts as CreateRequestContentDto['contactPreferences'];
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

  // Pastreaza identitatile existente la editare; id-uri straine nu pot selecta alte cereri.
  // Numar constant de query-uri indiferent de camere/piese (id-uri generate aici +
  // createMany), nu 3 per camera: tranzactia plateste fiecare round-trip cu latenta
  // aplicatie-Postgres (vezi TX_PROFILES.write in infra/prisma/tx-options.ts).
  private async writeRooms(
    tx: Prisma.TransactionClient,
    requestId: string,
    rooms: ProcessedRoom[],
  ): Promise<Map<string, string>> {
    const existing = await tx.requestRoom.findMany({ where: { requestId }, select: { id: true } });
    const ownedIds = new Set(existing.map((r) => r.id));
    const keptIds: string[] = [];
    const sourceIds = new Map<string, string>();
    const toCreate: Prisma.RequestRoomCreateManyInput[] = [];
    const toUpdate: { id: string; data: Prisma.RequestRoomUpdateManyMutationInput }[] = [];
    const items: Prisma.RequestRoomItemCreateManyInput[] = [];
    for (const room of rooms) {
      const existingId = room.sourceLocalId && ownedIds.has(room.sourceLocalId) ? room.sourceLocalId : undefined;
      const id = existingId ?? randomUUID();
      const data = {
        roomType: room.roomType,
        lengthM: room.derived.lengthM,
        widthM: room.derived.widthM,
        heightM: room.derived.heightM,
        answers: room.answers as Prisma.InputJsonValue,
        flowVersion: room.flowVersion,
      };
      if (existingId) toUpdate.push({ id, data });
      else toCreate.push({ id, requestId, ...data });
      keptIds.push(id);
      if (room.sourceLocalId) sourceIds.set(room.sourceLocalId, id);
      for (const it of room.derived.items) {
        items.push({
          roomId: id,
          name: it.name,
          material: it.material,
          systems: it.systems,
          description: it.description,
          quantity: it.quantity,
        });
      }
    }
    // camerele nepastrate pleaca cu itemele lor (cascade); camerele rescrise isi refac itemele
    await tx.requestRoom.deleteMany({ where: { requestId, id: { notIn: keptIds } } });
    if (toUpdate.length > 0) {
      await tx.requestRoomItem.deleteMany({ where: { roomId: { in: toUpdate.map((u) => u.id) } } });
      for (const u of toUpdate) {
        await tx.requestRoom.updateMany({ where: { id: u.id, requestId }, data: u.data });
      }
    }
    if (toCreate.length > 0) await tx.requestRoom.createMany({ data: toCreate });
    if (items.length > 0) await tx.requestRoomItem.createMany({ data: items });
    return sourceIds;
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

  // pozele din galerie alese ca inspiratie (F6, item 3) — inlocuire completa, cu notita si
  // camera (E-client-34: roomIds = harta sourceLocalId -> id din writeRooms);
  // validitatea (publicate, nesterse) e verificata inainte de tranzactie
  private async writeInspirationPhotos(
    tx: Prisma.TransactionClient,
    requestId: string,
    selection: InspirationSelection[] | undefined,
    roomIds: Map<string, string>,
  ): Promise<void> {
    if (selection === undefined) return;
    await tx.requestInspirationPhoto.deleteMany({ where: { requestId } });
    if (selection.length > 0) {
      await tx.requestInspirationPhoto.createMany({ data: inspirationRows(requestId, selection, roomIds) });
    }
  }

  private async writeVersion(
    tx: Prisma.TransactionClient,
    requestId: string,
    dto: CreateRequestContentDto,
  ): Promise<void> {
    const count = await tx.requestVersion.count({ where: { requestId } });
    // createMany: fara SELECT-ul de citire inapoi pe care il face create (un round-trip mai putin)
    await tx.requestVersion.createMany({
      data: [{ requestId, version: count + 1, snapshot: dto as unknown as Prisma.InputJsonValue }],
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
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    ).catch(() => this.logger.warn(`expiration schedule deferred to reconciliation for ${requestId}`));
    // E-admin-platform-44 — reminderul 4.4 catre client (best-effort; sweep-ul e plasa)
    await scheduleRequestExpiryReminder(this.expirationQueue, this.calendar, requestId, expiresAt);
  }

  // Citire compatibila a drafturilor vechi, fara pierderea tacuta a scenelor.
  private extractStudioScenes(state: unknown): RequestStudioSceneData[] {
    if (!state || typeof state !== 'object' || Array.isArray(state)) return [];
    const raw = (state as Record<string, unknown>).studioScenes;
    return parsePublicationScenes(raw);
  }

  private async writeStudioScenes(
    tx: Prisma.TransactionClient,
    requestId: string,
    scenes: RequestStudioSceneData[],
  ): Promise<void> {
    await tx.requestStudioScene.deleteMany({ where: { requestId } });
    if (scenes.length === 0) return;
    await tx.requestStudioScene.createMany({
      data: scenes.map((data) => ({
        requestId,
        name: data.scene.name,
        data: data as unknown as Prisma.InputJsonValue,
      })),
    });
  }

  private async toDto(id: string): Promise<RequestDto> {
    const request = await this.prisma.request.findUniqueOrThrow({
      where: { id },
      include: {
        rooms: { include: { items: true }, orderBy: { createdAt: 'asc' } },
        contactPreferences: true,
        inspirationPhotos: { select: { photoId: true, note: true, requestRoomId: true } },
        studioScenes: { orderBy: { createdAt: 'asc' } },
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
      cancelledAt: request.cancelledAt?.toISOString() ?? null,
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
      // text brut: DTO-ul de proprietar
      inspirationPhotos: request.inspirationPhotos.map((p) => ({
        photoId: p.photoId,
        note: p.note,
        requestRoomId: p.requestRoomId,
      })),
      studioScenes: request.studioScenes.map((s) => ({
        id: s.id,
        name: s.name,
        data: s.data as unknown as RequestStudioSceneData,
      })),
    };
  }
}
