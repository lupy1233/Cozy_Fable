import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ERROR_CODES,
  MAX_ATTACHMENTS_PER_QUOTE,
  MAX_QUOTE_VERSIONS,
  MAX_VALIDITY_EXTENSIONS,
  type AttachmentDto,
  type ClaimContactRevealPolicy,
  type ClaimQuoteContextDto,
  type CreateConsultationInviteInput,
  type CreateQuoteInput,
  type ExtendValidityInput,
  type ExtraQuoteVersionInput,
  type PresignUploadResultDto,
  type QuoteDto,
  type RequestQuoteChangeInput,
  type RequestStudioSceneData,
  type ReviseQuoteInput,
  type RespondConsultationInviteInput,
  type WithdrawQuoteInput,
  sortByRoomOrder,
} from '@marketplace/shared';
import {
  Prisma,
  type CompanyMemberRole,
  type QuoteCurrency,
  type RequestStatus,
  type RoomType,
} from '@prisma/client';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { getIdempotentOperation, lockIdempotentOperation, saveIdempotentResult } from '../../common/idempotency/idempotent-operation';
import { OutboxService } from '../outbox/outbox.service';
import { randomUUID } from 'node:crypto';
import { SettingsService } from '../../common/settings/settings.service';
import { SETTING_DEFAULTS } from '../../common/settings/setting-defaults';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import {
  QUEUE_CLAIM_ASSIGN,
  QUEUE_CONSULTATION_EXPIRY,
  QUEUE_PROJECT_DEADLINES,
  QUEUE_QUOTE_VALIDITY,
  QUEUE_SLA_BREACH,
} from '../../infra/queues/queues.module';
import type { CompanyContext } from '../../common/company-context/company-context';
import { UploadsService, type PresignInput } from '../uploads/uploads.service';
import { maskFreeText, maskRoomForFirm, maskSceneData, maskSceneName } from '../../common/privacy/contact-masking';
import { ClaimSettlementService } from '../billing/claim-settlement.service';
import {
  ACCEPTABLE_REQUEST_STATUSES,
  DEFAULT_DELIVERY_REMINDER_DAYS_BEFORE,
  OCCUPYING_CLAIM_STATUSES,
  OPEN_CLAIM_STATUSES,
  SETTING_DELIVERY_REMINDER_DAYS_BEFORE,
  SLA_GRACE_WARNING_JOB,
  SLA_WARNING_JOB,
} from '../claims/claims.constants';
import {
  recomputeRequestStatusAfterClaimChange,
  slaBreachAt,
  slaBreachJobOptions,
  slaGraceWarningJobOptions,
  slaWarningJobOptions,
} from '../claims/claims.helpers';
import type { ClaimAssignJob } from '../claims/claim-assign.processor';
import type { SlaBreachJob } from '../claims/sla-breach.processor';
import {
  DEFAULT_CONSULTATION_DAYS,
  DEFAULT_EUR_RON_RATE,
  DEFAULT_VALIDITY_DAYS,
  QUOTE_ATTACHMENT_ENTITY,
  SETTING_CONSULTATION_DAYS,
  SETTING_EUR_RON_RATE,
  SETTING_VALIDITY_DAYS,
  WITHDRAW_WINDOW_WORKING_DAYS,
} from './quotes.constants';
import { touchedFieldKeys } from './quotes.helpers';
import { readClaimContactAccessSettings, resolveClaimContextAccess, type ClaimContextAccess } from './claim-context-access';
import type { OfferFieldsDto } from './dto/quote.dto';
import type { QuoteValidityJob } from './quote-validity.processor';
import type { ConsultationExpiryJob } from './consultation-expiry.processor';
import {
  scheduleProjectDeadlineJobs,
  toDateOnly,
  type ProjectDeadlineJob,
} from '../fulfillment/project-deadlines';
import { toProjectCaseDto } from '../fulfillment/project-cases.service';
import { safeErrorSummary } from '../../common/logging/safe-error';
import {
  QUOTE_DTO_INCLUDE,
  QUOTE_INCLUDE,
  nonExtraCount,
  pendingChangeCount,
  toQuoteDto,
  withChangeRequest,
  withChangeStatus,
  withExtension,
  withInvite,
  withInviteStatus,
  withNewVersion,
  withStatus,
  type QuoteFull,
  type QuoteFullWithRequest,
  type RoomPriceInput,
} from './quote-dto.mapper';
import {
  assertLockedRule,
  assertQuoteRule,
  isRequestOpenForOffers,
  lockRequestRow,
  readLockedQuoteState,
  type LockedQuoteState,
  type LockedRequest,
  type QuoteAction,
} from './quote-lock';

type Tx = Prisma.TransactionClient;

// E-company-3: adresa invitatiei la consultatie poate fi locuinta clientului — se goleste
// oriunde contactele clientului nu sunt vizibile acestui membru.
function stripConsultationAddress(quote: QuoteDto): QuoteDto {
  return {
    ...quote,
    consultationInvites: quote.consultationInvites.map((inv) => ({ ...inv, locationAddress: '' })),
  };
}
type RoomTypes = Map<string, RoomPriceInput['roomType']>;
// Pre-citiri facute IN AFARA tranzactiei (cursul + atasamentele versiunilor existente).
type Preloaded = { rate: number; attachments: Map<string, AttachmentDto[]> };
type MutationOutcome<T> = { result: T; next: QuoteFull; attachments?: Map<string, AttachmentDto[]> };

const DAY_MS = 24 * 60 * 60 * 1000;
// Tranzitii inainte ale statusului cererii (nu da inapoi): din ce statusuri urca la tinta.
const FORWARD_FROM: Record<'OFFERS_RECEIVED' | 'NEGOTIATION', RequestStatus[]> = {
  OFFERS_RECEIVED: ['CLAIMED_PARTIAL', 'CLAIMED_FULL'],
  NEGOTIATION: ['CLAIMED_PARTIAL', 'CLAIMED_FULL', 'OFFERS_RECEIVED'],
};

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly outbox: OutboxService,
    private readonly calendar: BusinessCalendarService,
    private readonly uploads: UploadsService,
    private readonly settlement: ClaimSettlementService,
    @InjectQueue(QUEUE_QUOTE_VALIDITY) private readonly validityQueue: Queue<QuoteValidityJob>,
    @InjectQueue(QUEUE_CONSULTATION_EXPIRY)
    private readonly consultationQueue: Queue<ConsultationExpiryJob>,
    // cozile de claim (globale, QueuesModule): reprogramare SLA la retragerea ofertei si
    // curatare best-effort a joburilor sloturilor inchise la accept (L0-B).
    @InjectQueue(QUEUE_SLA_BREACH) private readonly slaQueue: Queue<SlaBreachJob>,
    @InjectQueue(QUEUE_CLAIM_ASSIGN) private readonly assignQueue: Queue<ClaimAssignJob>,
    // E-admin-platform-3: reminder de livrare + termen depasit, programate dupa accept
    @InjectQueue(QUEUE_PROJECT_DEADLINES) private readonly deadlinesQueue: Queue<ProjectDeadlineJob>,
  ) {}

  // ===== COMPANY: trimitere oferta v1 =====
  // E-company-2: slotul trece ACTIVE → OFFER_SENT DOAR printr-un updateMany conditionat, sub
  // lock-ul pe cerere — un slot inchis intre timp (SLA ratat, neatribuit, retras, accept pe alta
  // oferta) nu mai poate fi "inviat" si decontat a doua oara. Chitanta e construita in memorie.
  async createQuote(
    ctx: CompanyContext,
    actingUserId: string,
    dto: CreateQuoteInput,
  ): Promise<QuoteDto> {
    this.assertNotManaged(ctx);
    const slot = await this.prisma.claimSlot.findUnique({
      where: { id: dto.claimSlotId },
      include: { request: true },
    });
    if (!slot || slot.companyId !== ctx.companyId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Claim not found' });
    }
    if (slot.status !== 'ACTIVE') {
      throw new HttpException(
        { code: ERROR_CODES.QUOTE_ALREADY_SENT, message: 'Claim already has an offer' },
        409,
      );
    }
    this.assertRequestOpenForOffers(slot.request);
    this.assertDesignFee(dto, slot.request.includesPaidDesign);
    await this.assertFieldPermissions(ctx.companyId, ctx.memberRole, dto);
    const roomTypes = await this.assertRoomPrices(slot.requestId, dto);

    const validityDays = await this.resolveValidityDays(dto.validityDays);
    const validUntil = new Date(Date.now() + validityDays * DAY_MS);
    const currency: QuoteCurrency = dto.currency ?? 'RON';
    const [rate, company] = await Promise.all([
      this.eurRonRate(),
      this.prisma.company.findUnique({ where: { id: ctx.companyId }, select: { name: true } }),
    ]);
    const quoteId = randomUUID();

    const { receipt, versionId } = await this.runQuoteTransaction(async (tx) => {
      await lockIdempotentOperation(tx);
      const req = await lockRequestRow(tx, slot.requestId);
      if (!req || !isRequestOpenForOffers({ status: req.status, deletedAt: req.deleted_at })) {
        throw new HttpException(
          { code: ERROR_CODES.REQUEST_NOT_OPEN_FOR_OFFERS, message: 'Request no longer accepts offers' },
          409,
        );
      }
      // slot ACTIVE → OFFER_SENT + quoteId denormalizat (elibereaza indexul 1-claim-fara-oferta);
      // count 0 = slotul a primit oferta / a fost inchis intre timp → nimic nu se scrie.
      const moved = await tx.claimSlot.updateMany({
        where: { id: slot.id, companyId: ctx.companyId, status: 'ACTIVE' },
        data: { status: 'OFFER_SENT', quoteId },
      });
      if (moved.count === 0) {
        throw new HttpException(
          { code: ERROR_CODES.QUOTE_ALREADY_SENT, message: 'Claim already has an offer or is closed' },
          409,
        );
      }
      const quote = await tx.quote.create({
        data: {
          id: quoteId,
          claimSlotId: slot.id,
          requestId: slot.requestId,
          companyId: ctx.companyId,
          currency,
          status: 'SENT',
        },
      });
      const version = await tx.quoteVersion.create({
        data: this.versionData(quoteId, 1, false, dto, actingUserId, validUntil),
      });
      const roomPrices = await this.writeRoomPrices(tx, version.id, dto.roomPrices, roomTypes);
      const attachments = await this.relinkAttachments(tx, dto.attachmentIds, slot.id, version.id);
      await this.bumpRequestForward(tx, req, 'OFFERS_RECEIVED');
      await this.recordQuoteEvent(tx, 'quote.created', {
        quoteId,
        requestId: slot.requestId,
        companyId: ctx.companyId,
        clientUserId: req.client_user_id,
      });
      const full = withNewVersion(
        { ...quote, company: { name: company?.name ?? '' }, versions: [], consultationInvites: [] },
        version,
        roomPrices,
      );
      const dtoOut = toQuoteDto(full, new Map([[version.id, attachments]]), rate);
      if (getIdempotentOperation()?.transactional) await saveIdempotentResult(tx, dtoOut);
      return { receipt: dtoOut, versionId: version.id };
    });

    await this.scheduleValidityJob(versionId, validUntil);
    return receipt;
  }

  // ===== CLIENT: cerere de modificare =====
  async requestChange(userId: string, dto: RequestQuoteChangeInput): Promise<QuoteDto> {
    const version = await this.prisma.quoteVersion.findUnique({
      where: { id: dto.quoteVersionId },
      select: { id: true, quoteId: true },
    });
    if (!version) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Quote version not found' });
    }
    const quote = await this.loadQuoteFull(version.quoteId);
    this.assertClientOwnsRequest(quote.request.clientUserId, userId);
    // fast-fail; re-verificat sub lock (inclusiv thread / ultima versiune / limita / PENDING)
    assertQuoteRule('REQUEST_CHANGE', { quoteStatus: quote.status, request: quote.request });
    const thread = await this.threadForQuote(quote.claimSlotId);
    if (thread?.negotiationEndedByCompany) {
      throw new HttpException(
        { code: ERROR_CODES.NEGOTIATION_ENDED, message: 'Negotiation ended' },
        409,
      );
    }
    // change request doar pe ultima versiune
    if (this.latestVersion(quote.versions).id !== version.id) {
      throw new HttpException(
        { code: ERROR_CODES.VALIDATION_ERROR, message: 'Not the latest version' },
        409,
      );
    }
    // block dupa v3 (4.13): nu se mai pot cere modificari care ar genera o versiune noua.
    if (nonExtraCount(quote.versions) >= MAX_QUOTE_VERSIONS) {
      throw this.versionLimitReached();
    }
    // o singura cerere PENDING odata
    if (pendingChangeCount(quote) > 0) throw this.changeAlreadyPending();
    // aceeasi modificare refuzata nu poate fi reluata (4.13) — istoricul e append-only, deci
    // verificarea pe snapshot e suficienta.
    const rejectedSame = quote.versions.some((v) =>
      v.changeRequests.some((c) => c.status === 'REJECTED' && c.requestedText === dto.requestedText),
    );
    if (rejectedSame) {
      throw new HttpException(
        { code: ERROR_CODES.CHANGE_REQUEST_ALREADY_REJECTED, message: 'Change already rejected' },
        409,
      );
    }

    const pre = await this.preload(quote);
    const { dto: out } = await this.lockedQuoteMutation(quote, 'REQUEST_CHANGE', async (tx, s, req, current) => {
      if (s.negotiation_ended_by_company) {
        throw new HttpException(
          { code: ERROR_CODES.NEGOTIATION_ENDED, message: 'Negotiation ended' },
          409,
        );
      }
      if (s.latest_version_id !== version.id) {
        throw new HttpException(
          { code: ERROR_CODES.VALIDATION_ERROR, message: 'Not the latest version' },
          409,
        );
      }
      if (s.non_extra_count >= MAX_QUOTE_VERSIONS) throw this.versionLimitReached();
      if (s.pending_changes > 0) throw this.changeAlreadyPending();
      const row = await tx.quoteChangeRequest.create({
        data: { quoteVersionId: version.id, clientUserId: userId, requestedText: dto.requestedText },
      });
      await this.bumpRequestForward(tx, req, 'NEGOTIATION');
      return { result: row.id, next: withChangeRequest(current, version.id, row) };
    }, pre);
    return out;
  }

  // ===== COMPANY: raspuns la modificare cu versiune noua =====
  async reviseQuote(
    ctx: CompanyContext,
    actingUserId: string,
    quoteId: string,
    dto: ReviseQuoteInput,
  ): Promise<QuoteDto> {
    this.assertNotManaged(ctx);
    const quote = await this.loadCompanyQuote(quoteId, ctx.companyId);
    assertQuoteRule('REVISE', { quoteStatus: quote.status, request: quote.request });
    this.assertDesignFee(dto, quote.request.includesPaidDesign);
    await this.assertFieldPermissions(ctx.companyId, ctx.memberRole, dto);

    const change = await this.prisma.quoteChangeRequest.findUnique({
      where: { id: dto.changeRequestId },
    });
    const versionIds = new Set(quote.versions.map((v) => v.id));
    if (!change || !versionIds.has(change.quoteVersionId) || change.status !== 'PENDING') {
      throw this.changeNotPending();
    }
    if (nonExtraCount(quote.versions) >= MAX_QUOTE_VERSIONS) throw this.versionLimitReached();
    const validityDays = await this.resolveValidityDays(dto.validityDays);
    const validUntil = new Date(Date.now() + validityDays * DAY_MS);
    const roomTypes = await this.assertRoomPrices(quote.requestId, dto);
    const pre = await this.preload(quote);

    const { result: versionId, dto: out } = await this.lockedQuoteMutation(quote, 'REVISE', async (tx, s, _req, current) => {
      if (s.non_extra_count >= MAX_QUOTE_VERSIONS) throw this.versionLimitReached();
      const respondedAt = new Date();
      const fulfilled = await tx.quoteChangeRequest.updateMany({
        where: { id: change.id, status: 'PENDING', quoteVersion: { quoteId: quote.id } },
        data: { status: 'FULFILLED', respondedAt },
      });
      if (fulfilled.count === 0) throw this.changeNotPending();
      const version = await tx.quoteVersion.create({
        data: this.versionData(quote.id, (s.max_version ?? 0) + 1, false, dto, actingUserId, validUntil),
      });
      const roomPrices = await this.writeRoomPrices(tx, version.id, dto.roomPrices, roomTypes);
      const attachments = await this.relinkAttachments(tx, dto.attachmentIds, quote.claimSlotId, version.id);
      const updatedAt = await this.reopenQuote(tx, quote.id);
      const next = withStatus(
        withNewVersion(withChangeStatus(current, change.id, 'FULFILLED', respondedAt), version, roomPrices),
        'SENT',
        { updatedAt },
      );
      return { result: version.id, next, attachments: new Map([[version.id, attachments]]) };
    }, pre);

    await this.scheduleValidityJob(versionId, validUntil);
    return out;
  }

  // ===== COMPANY: refuza modificarea (nu consuma slot) =====
  async rejectChange(ctx: CompanyContext, quoteId: string, changeRequestId: string): Promise<QuoteDto> {
    this.assertNotManaged(ctx);
    const quote = await this.loadCompanyQuote(quoteId, ctx.companyId);
    assertQuoteRule('REJECT_CHANGE', { quoteStatus: quote.status, request: quote.request });
    const versionIds = new Set(quote.versions.map((v) => v.id));
    const change = await this.prisma.quoteChangeRequest.findUnique({ where: { id: changeRequestId } });
    if (!change || !versionIds.has(change.quoteVersionId) || change.status !== 'PENDING') {
      throw this.changeNotPending();
    }
    const pre = await this.preload(quote);
    const { dto: out } = await this.lockedQuoteMutation(quote, 'REJECT_CHANGE', async (tx, _s, _req, current) => {
      const respondedAt = new Date();
      const rejected = await tx.quoteChangeRequest.updateMany({
        where: { id: change.id, status: 'PENDING', quoteVersion: { quoteId: quote.id } },
        data: { status: 'REJECTED', respondedAt },
      });
      if (rejected.count === 0) throw this.changeNotPending();
      return { result: null, next: withChangeStatus(current, change.id, 'REJECTED', respondedAt) };
    }, pre);
    return out;
  }

  // ===== COMPANY: a 4-a varianta voluntara (peste limita; block UI optiunea a) =====
  async extraVersion(
    ctx: CompanyContext,
    actingUserId: string,
    quoteId: string,
    dto: ExtraQuoteVersionInput,
  ): Promise<QuoteDto> {
    this.assertNotManaged(ctx);
    const quote = await this.loadCompanyQuote(quoteId, ctx.companyId);
    assertQuoteRule('EXTRA', { quoteStatus: quote.status, request: quote.request });
    this.assertDesignFee(dto, quote.request.includesPaidDesign);
    await this.assertFieldPermissions(ctx.companyId, ctx.memberRole, dto);
    if (nonExtraCount(quote.versions) < MAX_QUOTE_VERSIONS) throw this.extraOnlyAfterLimit();
    const validityDays = await this.resolveValidityDays(dto.validityDays);
    const validUntil = new Date(Date.now() + validityDays * DAY_MS);
    const roomTypes = await this.assertRoomPrices(quote.requestId, dto);
    const pre = await this.preload(quote);

    const { result: versionId, dto: out } = await this.lockedQuoteMutation(quote, 'EXTRA', async (tx, s, _req, current) => {
      if (s.non_extra_count < MAX_QUOTE_VERSIONS) throw this.extraOnlyAfterLimit();
      const version = await tx.quoteVersion.create({
        data: this.versionData(quote.id, (s.max_version ?? 0) + 1, true, dto, actingUserId, validUntil),
      });
      const roomPrices = await this.writeRoomPrices(tx, version.id, dto.roomPrices, roomTypes);
      const attachments = await this.relinkAttachments(tx, dto.attachmentIds, quote.claimSlotId, version.id);
      // conditionat pe SENT/EXPIRED: o varianta extra nu mai redeschide o oferta retrasa/acceptata
      const reopened = await tx.quote.updateMany({
        where: { id: quote.id, status: { in: ['SENT', 'EXPIRED'] } },
        data: { extraVersionsCount: { increment: 1 }, status: 'SENT' },
      });
      if (reopened.count === 0) throw this.notModifiable();
      const next = withStatus(withNewVersion(current, version, roomPrices), 'SENT', {
        extraVersionsCountDelta: 1,
        updatedAt: new Date(),
      });
      return { result: version.id, next, attachments: new Map([[version.id, attachments]]) };
    }, pre);

    await this.scheduleValidityJob(versionId, validUntil);
    return out;
  }

  // ===== COMPANY: Buton B reofertare — versiune noua initiata de firma la expirare (D4) =====
  // Consuma slot (versiune non-extra). Daca sunt deja 3 → block (extra/consultanta/end).
  async reofferModify(
    ctx: CompanyContext,
    actingUserId: string,
    quoteId: string,
    dto: ExtraQuoteVersionInput,
  ): Promise<QuoteDto> {
    this.assertNotManaged(ctx);
    const quote = await this.loadCompanyQuote(quoteId, ctx.companyId);
    assertQuoteRule('REOFFER', { quoteStatus: quote.status, request: quote.request });
    this.assertDesignFee(dto, quote.request.includesPaidDesign);
    await this.assertFieldPermissions(ctx.companyId, ctx.memberRole, dto);
    if (nonExtraCount(quote.versions) >= MAX_QUOTE_VERSIONS) throw this.versionLimitReached();
    const validityDays = await this.resolveValidityDays(dto.validityDays);
    const validUntil = new Date(Date.now() + validityDays * DAY_MS);
    const roomTypes = await this.assertRoomPrices(quote.requestId, dto);
    const pre = await this.preload(quote);

    const { result: versionId, dto: out } = await this.lockedQuoteMutation(quote, 'REOFFER', async (tx, s, _req, current) => {
      if (s.non_extra_count >= MAX_QUOTE_VERSIONS) throw this.versionLimitReached();
      const version = await tx.quoteVersion.create({
        data: this.versionData(quote.id, (s.max_version ?? 0) + 1, false, dto, actingUserId, validUntil),
      });
      const roomPrices = await this.writeRoomPrices(tx, version.id, dto.roomPrices, roomTypes);
      const attachments = await this.relinkAttachments(tx, dto.attachmentIds, quote.claimSlotId, version.id);
      const updatedAt = await this.reopenQuote(tx, quote.id);
      const next = withStatus(withNewVersion(current, version, roomPrices), 'SENT', { updatedAt });
      return { result: version.id, next, attachments: new Map([[version.id, attachments]]) };
    }, pre);

    await this.scheduleValidityJob(versionId, validUntil);
    return out;
  }

  // ===== COMPANY: Buton A reofertare — extinde valabilitatea (max 2 × N zile) =====
  async extendValidity(
    ctx: CompanyContext,
    actingUserId: string,
    quoteId: string,
    dto: ExtendValidityInput,
  ): Promise<QuoteDto> {
    this.assertNotManaged(ctx);
    const quote = await this.loadCompanyQuote(quoteId, ctx.companyId);
    assertQuoteRule('EXTEND', { quoteStatus: quote.status, request: quote.request });
    if (this.latestVersion(quote.versions).validityExtensions.length >= MAX_VALIDITY_EXTENSIONS) {
      throw this.extensionLimitReached();
    }
    const days = dto.days ?? (await this.resolveValidityDays(undefined));
    const pre = await this.preload(quote);

    const { result, dto: out } = await this.lockedQuoteMutation(quote, 'EXTEND', async (tx, s, _req, current) => {
      if (s.latest_extensions >= MAX_VALIDITY_EXTENSIONS) throw this.extensionLimitReached();
      const latestId = s.latest_version_id as string;
      // din randul blocat, nu din snapshot (regula neschimbata: previous + days)
      const previous = s.latest_valid_until as Date;
      const newValidUntil = new Date(previous.getTime() + days * DAY_MS);
      const ext = await tx.quoteValidityExtension.create({
        data: {
          quoteVersionId: latestId,
          extendedByDays: days,
          extendedByUserId: actingUserId,
          previousValidUntil: previous,
          newValidUntil,
        },
      });
      await tx.quoteVersion.update({ where: { id: latestId }, data: { validUntil: newValidUntil } });
      const updatedAt = await this.reopenQuote(tx, quote.id);
      const next = withStatus(withExtension(current, latestId, ext, newValidUntil), 'SENT', { updatedAt });
      return { result: { latestId, newValidUntil }, next };
    }, pre);

    await this.scheduleValidityJob(result.latestId, result.newValidUntil);
    return out;
  }

  // ===== COMPANY: retragere oferta in 1 zi lucratoare =====
  // E-company-2 (WF1-17): daca membrul atribuit are deja ALT claim activ fara oferta, slotul
  // nu poate redeveni ACTIVE fara oferta (regula 4.9 / indexul partial unic) → 409
  // ASSIGNED_USER_HAS_ACTIVE_CLAIM, verificat sub lock INAINTE de orice scriere.
  // E-company-6: dupa termenul SLA + 12h gratie retragerea expira IMEDIAT preluarea (re-armarea
  // jobului SLA de mai jos) → firma trebuie sa confirme explicit (acknowledgeSlaBreach).
  async withdrawQuote(ctx: CompanyContext, quoteId: string, dto: WithdrawQuoteInput = {}): Promise<QuoteDto> {
    this.assertNotManaged(ctx);
    const quote = await this.loadCompanyQuote(quoteId, ctx.companyId);
    assertQuoteRule('WITHDRAW', { quoteStatus: quote.status, request: quote.request });
    this.assertWithdrawWindow(this.latestVersion(quote.versions).sentAt);
    const pre = await this.preload(quote);

    const { state, dto: out } = await this.lockedQuoteMutation(quote, 'WITHDRAW', async (tx, s, _req, current) => {
      this.assertWithdrawWindow(s.latest_sent_at as Date);
      // E-company-6: regula ramane neschimbata (L0-B, 4.11: SLA-ul curge din nou la termenul
      // existent); doar cerem confirmare explicita, verificata sub lock, INAINTE de orice scriere.
      // O fereastra noua de re-ofertare dupa retragere = DECIZIE NECESARA PO.
      const breachAt = slaBreachAt(s.sla_deadline_at, s.sla_paused_at);
      if (breachAt && Date.now() >= breachAt.getTime() && !dto.acknowledgeSlaBreach) {
        throw new HttpException(
          {
            code: ERROR_CODES.QUOTE_WITHDRAW_SLA_ACK_REQUIRED,
            message: 'SLA already breached; withdrawing expires the claim',
            details: { slaBreachAt: breachAt.toISOString() },
          },
          409,
        );
      }
      if (s.assigned_to_user_id) {
        const busy = await tx.$queryRaw<{ id: string; company_id: string }[]>`
          SELECT id, company_id FROM claim_slots
          WHERE assigned_to_user_id = ${s.assigned_to_user_id} AND status = 'ACTIVE'
            AND quote_id IS NULL AND id <> ${s.claim_slot_id}
          LIMIT 1`;
        if (busy.length > 0) {
          throw new HttpException(
            {
              code: ERROR_CODES.ASSIGNED_USER_HAS_ACTIVE_CLAIM,
              message: 'Assignee already has another claim without an offer',
              // id-ul slotului doar daca e al aceleiasi firme
              details: busy[0].company_id === s.company_id ? { busyClaimSlotId: busy[0].id } : undefined,
            },
            409,
          );
        }
      }
      const withdrawnAt = new Date();
      // updateMany conditionat (clasa biletului de decontare, audit 2026-08-23): acceptul
      // concurent poate comite ACCEPTED — retragerea nu are voie sa-l suprascrie.
      const q = await tx.quote.updateMany({
        where: { id: quote.id, status: { in: ['SENT', 'EXPIRED'] } },
        data: { status: 'WITHDRAWN', withdrawnAt },
      });
      if (q.count === 0) throw this.notModifiable();
      // slotul redevine ACTIVE fara oferta (firma poate trimite o noua oferta).
      const slot = await tx.claimSlot.updateMany({
        where: { id: s.claim_slot_id, status: 'OFFER_SENT' },
        data: { status: 'ACTIVE', quoteId: null },
      });
      if (slot.count === 0) throw this.notModifiable();
      // Pasul 5 (F4): fara nicio oferta deschisa ramasa pe cerere, statusul coboara din
      // OFFERS_RECEIVED/NEGOTIATION la CLAIMED_* (slotul ramane ocupant → fara republish).
      await recomputeRequestStatusAfterClaimChange(tx, s.request_id);
      return { result: null, next: withStatus(current, 'WITHDRAWN', { withdrawnAt, updatedAt: withdrawnAt }) };
    }, pre);
    // L0-B: SLA-ul curge din nou pe slot (4.11) — (re)programeaza verificarea de ratare la
    // deadline-ul existent. Acelasi jobId → no-op daca jobul initial inca asteapta; daca a
    // rulat deja ca no-op (slot era OFFER_SENT) se adauga unul nou (delay 0 daca e depasit).
    if (state.sla_deadline_at) {
      await this.slaQueue.add(
        'breach',
        { claimSlotId: state.claim_slot_id },
        slaBreachJobOptions(state.claim_slot_id, state.sla_deadline_at),
      ).catch(() => this.logger.warn('SLA scheduling deferred to reconciliation'));
      // E-admin-platform-44 — re-inarmeaza si avertizarea (no-op daca termenul a trecut)
      await this.slaQueue.add(
        SLA_WARNING_JOB,
        { claimSlotId: state.claim_slot_id, slaDeadlineAt: state.sla_deadline_at.toISOString() },
        slaWarningJobOptions(state.claim_slot_id, state.sla_deadline_at),
      ).catch(() => this.logger.warn('SLA warning scheduling deferred to reconciliation'));
      // E-company-13 — si reminderul de gratie (procesorul iese no-op daca gratia s-a terminat)
      await this.slaQueue.add(
        SLA_GRACE_WARNING_JOB,
        { claimSlotId: state.claim_slot_id, slaDeadlineAt: state.sla_deadline_at.toISOString() },
        slaGraceWarningJobOptions(state.claim_slot_id, state.sla_deadline_at),
      ).catch(() => this.logger.warn('SLA grace warning scheduling deferred to reconciliation'));
    }
    return out;
  }

  // ===== COMPANY: incheie negocierea online (chat read-only ambii; D3) =====
  async endNegotiation(ctx: CompanyContext, quoteId: string): Promise<QuoteDto> {
    this.assertNotManaged(ctx);
    const quote = await this.loadCompanyQuote(quoteId, ctx.companyId);
    assertQuoteRule('END_NEGOTIATION', { quoteStatus: quote.status, request: quote.request });
    const pre = await this.preload(quote);
    const { dto: out } = await this.lockedQuoteMutation(quote, 'END_NEGOTIATION', async (tx, _s, _req, current) => {
      await tx.chatThread.update({
        where: { claimSlotId: quote.claimSlotId },
        data: { negotiationEndedByCompany: true, readOnly: true },
      });
      return { result: null, next: current };
    }, pre);
    return out;
  }

  // ===== COMPANY: invitatie consultanta fizica (block optiunea b; expira +7 zile) =====
  async createConsultationInvite(
    ctx: CompanyContext,
    quoteId: string,
    dto: CreateConsultationInviteInput,
  ): Promise<QuoteDto> {
    this.assertNotManaged(ctx);
    const quote = await this.loadCompanyQuote(quoteId, ctx.companyId);
    assertQuoteRule('CONSULTATION_INVITE', { quoteStatus: quote.status, request: quote.request });
    if (nonExtraCount(quote.versions) < MAX_QUOTE_VERSIONS) throw this.consultationOnlyAfterLimit();
    const days = await this.settings.getInt(SETTING_CONSULTATION_DAYS, DEFAULT_CONSULTATION_DAYS);
    const expiresAt = new Date(Date.now() + days * DAY_MS);
    const pre = await this.preload(quote);

    const { result: invite, dto: out } = await this.lockedQuoteMutation(quote, 'CONSULTATION_INVITE', async (tx, s, _req, current) => {
      if (s.non_extra_count < MAX_QUOTE_VERSIONS) throw this.consultationOnlyAfterLimit();
      const row = await tx.physicalConsultationInvite.create({
        data: {
          quoteId: quote.id,
          companyId: ctx.companyId,
          locationAddress: dto.locationAddress,
          proposedDatetime: new Date(dto.proposedDatetime),
          alternativeDatetimes: dto.alternativeDatetimes ?? undefined,
          expiresAt,
        },
      });
      return { result: row, next: withInvite(current, row) };
    }, pre);
    await this.scheduleConsultationJob(invite.id, expiresAt);
    return out;
  }

  // ===== CLIENT: raspuns la invitatie consultanta =====
  async respondConsultationInvite(
    userId: string,
    inviteId: string,
    dto: RespondConsultationInviteInput,
  ): Promise<QuoteDto> {
    const invite = await this.prisma.physicalConsultationInvite.findUnique({
      where: { id: inviteId },
      include: { quote: { include: { request: true } } },
    });
    if (!invite) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Invite not found' });
    }
    this.assertClientOwnsRequest(invite.quote.request.clientUserId, userId);
    if (invite.status !== 'PENDING_CLIENT') throw this.inviteAlreadyAnswered();
    if (invite.expiresAt.getTime() < Date.now()) throw this.inviteExpired();
    const quote = await this.loadQuoteFull(invite.quoteId);
    const pre = await this.preload(quote);

    const { dto: out } = await this.lockedQuoteMutation(quote, 'CONSULTATION_RESPOND', async (tx, _s, _req, current) => {
      const respondedAt = new Date();
      const patch = {
        status: dto.accept ? ('ACCEPTED' as const) : ('DECLINED' as const),
        clientResponseText: dto.clientResponseText || null,
        respondedAt,
      };
      const answered = await tx.physicalConsultationInvite.updateMany({
        where: { id: invite.id, quoteId: invite.quoteId, status: 'PENDING_CLIENT', expiresAt: { gt: respondedAt } },
        data: patch,
      });
      if (answered.count === 0) {
        const cur = await tx.physicalConsultationInvite.findUnique({ where: { id: invite.id } });
        if (cur?.status === 'PENDING_CLIENT') throw this.inviteExpired();
        throw this.inviteAlreadyAnswered();
      }
      return { result: null, next: withInviteStatus(current, invite.id, patch) };
    }, pre);
    return out;
  }

  // ===== CLIENT: acceptare oferta =====
  // L0-B: verificarile autoritative ruleaza IN tranzactie, sub SELECT ... FOR UPDATE pe cerere
  // (3.1 — acceptul schimba sloturile active): a doua acceptare / doua accept-uri concurente
  // pe oferte diferite → 409. Sloturile nealese se inchid imediat (4.14):
  //  - OFFER_SENT (a ofertat si a pierdut) → pay-to-play: credite CONSUMATE, oferta SUPERSEDED;
  //  - ACTIVE fara oferta → credite REFUND (decizie PO 2026-08-19);
  // ambele → CANCELLED_REQUEST_ACCEPTED + chat read-only + notificare tintita firmei.
  // E-company-2: slotul castigator trebuie sa fie inca OFFER_SENT; chitanta se construieste in
  // memorie (fara ~11 query-uri in tranzactia Serializable de 10 s).
  // E-client-1: clientul trimite versiunea vazuta; doar ultima versiune se poate accepta —
  // verificat inainte de tranzactie SI sub lock (firma poate revizui cat e deschis dialogul).
  async acceptQuote(userId: string, quoteId: string, quoteVersionId: string): Promise<QuoteDto> {
    const quote = await this.loadQuoteFull(quoteId);
    this.assertClientOwnsRequest(quote.request.clientUserId, userId);
    if (!quote.versions.some((v) => v.id === quoteVersionId)) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Version does not belong to this quote',
      });
    }
    // fast-fail in afara tranzactiei; re-verificat sub lock mai jos
    this.assertQuoteAcceptable(quote.status, this.latestVersion(quote.versions).validUntil);
    const latest = this.latestVersion(quote.versions);
    if (latest.id !== quoteVersionId) throw this.versionChanged(latest);
    const pre = await this.preload(quote);

    const { losers: closedSlots, deliveryDate, receipt } = await runTx(this.prisma, 'claim', async (tx) => {
      await lockIdempotentOperation(tx);
      const locked = await tx.$queryRaw<
        { id: string; status: RequestStatus; deleted_at: Date | null }[]
      >`SELECT id, status, deleted_at FROM requests WHERE id = ${quote.requestId} FOR UPDATE`;
      const req = locked[0];
      if (!req || req.deleted_at !== null) {
        throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });
      }
      if (!ACCEPTABLE_REQUEST_STATUSES.includes(req.status)) {
        throw new HttpException(
          { code: ERROR_CODES.QUOTE_ACCEPT_NOT_ALLOWED, message: 'Request not open for acceptance' },
          409,
        );
      }
      // starea reala a ofertei sub lock (status + valabilitatea ultimei versiune + slotul)
      const fresh = await tx.quote.findUnique({
        where: { id: quote.id },
        include: {
          versions: { select: { id: true, version: true, validUntil: true, deliveryDate: true } },
          claimSlot: { select: { status: true } },
        },
      });
      if (!fresh) {
        throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Quote not found' });
      }
      this.assertQuoteAcceptable(fresh.status, this.latestVersion(fresh.versions).validUntil);
      // slotul castigator inchis intre timp (SLA ratat / retras) → oferta nu mai e acceptabila
      if (fresh.claimSlot.status !== 'OFFER_SENT') {
        throw new HttpException(
          { code: ERROR_CODES.QUOTE_ACCEPT_NOT_ALLOWED, message: 'Offer slot is no longer open' },
          409,
        );
      }
      // E-client-1: versiune noua trimisa intre deschiderea dialogului si confirmare → 409
      // (rollback; interceptorul salveaza 4xx ca rezultat al cheii de idempotenta)
      const lockedLatest = this.latestVersion(fresh.versions);
      if (lockedLatest.id !== quoteVersionId) throw this.versionChanged(lockedLatest);
      const acceptedAt = new Date();
      const accepted = await tx.quote.updateMany({
        where: { id: quote.id, status: 'SENT' },
        data: { status: 'ACCEPTED', acceptedAt, acceptedVersionId: quoteVersionId },
      });
      if (accepted.count === 0) {
        throw new HttpException(
          { code: ERROR_CODES.QUOTE_ACCEPT_NOT_ALLOWED, message: 'Quote not acceptable' },
          409,
        );
      }
      await tx.request.update({ where: { id: quote.requestId }, data: { status: 'ACCEPTED' } });

      const losers = await tx.claimSlot.findMany({
        where: {
          requestId: quote.requestId,
          id: { not: quote.claimSlotId },
          status: { in: OPEN_CLAIM_STATUSES },
        },
      });
      // E-admin-platform-15: pierzatorii se inchid prin settle() cu from = statusul citit sub
      // FOR UPDATE (Serializable) → acelasi rezultat ca inainte (OFFER_SENT → CONSUME, ACTIVE →
      // REFUND), plus biletul conditionat ca plasa. claim.withdrawn doar pentru cei decontati.
      const settledLosers: { slot: (typeof losers)[number]; refunded: boolean }[] = [];
      for (const slot of losers) {
        const offerSent = slot.status === 'OFFER_SENT';
        const res = await this.settlement.settle(tx, {
          claimSlotId: slot.id,
          from: [slot.status],
          to: 'CANCELLED_REQUEST_ACCEPTED',
          outcome: offerSent ? 'CONSUME' : 'REFUND',
          reason: offerSent ? 'OFFER_LOST' : 'REQUEST_ACCEPTED_OTHER_OFFER',
          quotes: offerSent ? 'SUPERSEDED' : 'CHAT_READ_ONLY',
          slot,
        });
        if (res.settled) settledLosers.push({ slot, refunded: res.refunded });
      }
      // plasa de siguranta: orice alta oferta deschisa pe cerere (slot deja inchis pe
      // alta cale, date vechi) nu mai poate fi acceptata.
      await tx.quote.updateMany({
        where: { requestId: quote.requestId, id: { not: quote.id }, status: { in: ['SENT', 'EXPIRED'] } },
        data: { status: 'SUPERSEDED' },
      });
      await this.outbox.record(tx, `quote.accepted:${quote.id}`, 'quote.accepted', {
        quoteId: quote.id, requestId: quote.requestId, companyId: quote.companyId,
        claimSlotId: quote.claimSlotId,
      }, await this.participantsForRequest(quote.requestId, tx));
      for (const { slot, refunded } of settledLosers) {
        const members = await tx.companyMember.findMany({ where: { companyId: slot.companyId }, select: { userId: true } });
        await this.outbox.record(tx, `quote.accepted:${quote.id}:claim:${slot.id}`, 'claim.withdrawn', {
          claimSlotId: slot.id, requestId: quote.requestId,
          reason: 'REQUEST_ACCEPTED_OTHER_OFFER', refunded,
        }, members.map((member) => member.userId));
      }
      await this.outbox.record(tx, `quote.accepted:${quote.id}:status`, 'request.status_changed', { requestId: quote.requestId }, []);
      // chitanta in memorie; snapshot vechi (versiune noua / alta mutatie intre timp) → recitire rara
      let base: QuoteFull = quote;
      let attachments = pre.attachments;
      if (fresh.updatedAt?.getTime() !== quote.updatedAt?.getTime() || fresh.versions.length !== quote.versions.length) {
        base = await this.loadQuoteDtoFull(quote.id, tx);
        attachments = await this.uploads.listForEntities(QUOTE_ATTACHMENT_ENTITY, base.versions.map((v) => v.id), tx);
      }
      const dto = toQuoteDto(
        withStatus(base, 'ACCEPTED', { acceptedAt, updatedAt: acceptedAt, acceptedVersionId: quoteVersionId }),
        attachments,
        pre.rate,
      );
      if (getIdempotentOperation()?.transactional) await saveIdempotentResult(tx, dto);
      return { losers: settledLosers.map((l) => l.slot), deliveryDate: toDateOnly(lockedLatest.deliveryDate), receipt: dto };
    });

    // joburile sloturilor inchise (SLA / atribuire 1h) — best-effort; procesoarele ies
    // oricum no-op pe slot inchis / cerere ACCEPTED.
    await this.dropClaimJobs(closedSlots);
    // E-admin-platform-3: termenele proiectului (reminder firma + termen depasit) — best-effort,
    // sweep-ul de reconciliere e plasa.
    if (deliveryDate) await this.scheduleDeadlines(quote.requestId, deliveryDate);

    return receipt;
  }

  private async scheduleDeadlines(requestId: string, deliveryDate: string): Promise<void> {
    try {
      const daysBefore = await this.settings.getInt(
        SETTING_DELIVERY_REMINDER_DAYS_BEFORE,
        DEFAULT_DELIVERY_REMINDER_DAYS_BEFORE,
      );
      await scheduleProjectDeadlineJobs(this.deadlinesQueue, this.calendar, requestId, deliveryDate, daysBefore);
    } catch {
      this.logger.warn(`Project deadline scheduling deferred to reconciliation for ${requestId}`);
    }
  }

  // ===== CLIENT: cere prelungirea unei oferte EXPIRED (E-admin-platform-3) =====
  // Nu schimba starea ofertei: anunta firma (care decide Buton A / reofertare). Un singur
  // anunt per versiune — repetarea e un no-op idempotent care intoarce oferta curenta.
  async requestExtension(userId: string, quoteId: string): Promise<QuoteDto> {
    const quote = await this.loadQuoteFull(quoteId);
    this.assertClientOwnsRequest(quote.request.clientUserId, userId);
    if (
      quote.status !== 'EXPIRED' ||
      quote.request.deletedAt !== null ||
      !ACCEPTABLE_REQUEST_STATUSES.includes(quote.request.status)
    ) {
      throw new HttpException(
        { code: ERROR_CODES.QUOTE_EXTENSION_NOT_REQUESTABLE, message: 'Extension can only be requested on an expired offer' },
        409,
      );
    }
    const latest = this.latestVersion(quote.versions);
    await runTx(this.prisma, 'write', async (tx) => {
      const res = await tx.quoteVersion.updateMany({
        where: { id: latest.id, extensionRequestedAt: null },
        data: { extensionRequestedAt: new Date() },
      });
      if (res.count !== 1) return;
      const members = await tx.companyMember.findMany({
        where: { companyId: quote.companyId },
        select: { userId: true },
      });
      await this.outbox.record(tx, `quote.extension_requested:${latest.id}`,
        'quote.extension_requested',
        { quoteId: quote.id, requestId: quote.requestId, claimSlotId: quote.claimSlotId, companyId: quote.companyId },
        members.map((m) => m.userId),
      );
    });
    return this.getQuoteDto(quote.id);
  }

  // ===== COMPANY: upload atasamente oferta (bucket = claimSlotId, pre-trimitere) =====
  async presignQuoteAttachment(
    ctx: CompanyContext,
    claimSlotId: string,
    input: PresignInput,
  ): Promise<PresignUploadResultDto> {
    await this.assertOwnSlot(ctx, claimSlotId);
    return this.uploads.presign(QUOTE_ATTACHMENT_ENTITY, claimSlotId, input, MAX_ATTACHMENTS_PER_QUOTE);
  }

  async confirmQuoteAttachment(ctx: CompanyContext, claimSlotId: string, attachmentId: string) {
    await this.assertOwnSlot(ctx, claimSlotId);
    return this.uploads.confirm(QUOTE_ATTACHMENT_ENTITY, claimSlotId, attachmentId);
  }

  // ===== citiri =====
  // Context complet pentru pagina firmei pe un claim (oferta curenta + date formular).
  // PO r6: workspace-ul firmei post-claim primeste tot contextul dintr-un apel —
  // detaliul cererii (camere cu answers pentru spec-carduri/viewer 3D, atasamente
  // presigned inclusiv snapshotul PNG, adresa completa), contactul clientului
  // (DOAR cat timp slotul e ocupant — 4.2 rework r6) si atribuirea (4.9).
  // E-company-3: accesul e decis de resolveClaimContextAccess — slot neocupant = rezumat
  // (REDACTED), cerere stearsa = TOMBSTONE, angajatul limitat vede contactele doar pe
  // preluarile proprii; niciun mod limitat nu presemneaza fisiere si nu intoarce raspunsuri/scene.
  async getClaimContext(
    ctx: CompanyContext,
    actingUserId: string,
    claimSlotId: string,
  ): Promise<ClaimQuoteContextDto> {
    const slot = await this.prisma.claimSlot.findUnique({
      where: { id: claimSlotId },
      include: {
        request: {
          include: {
            rooms: { include: { items: true }, orderBy: { createdAt: 'asc' } },
            contactPreferences: true,
            inspirationPhotos: { select: { photoId: true, note: true, requestRoomId: true } },
            studioScenes: { orderBy: { createdAt: 'asc' } },
          },
        },
        chatThread: true,
        claimedBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    if (!slot || slot.companyId !== ctx.companyId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Claim not found' });
    }
    const req = slot.request;
    const now = Date.now();
    // include-ul imbricat ocoleste middleware-ul de soft delete → deletedAt e vizibil aici
    const occupying = OCCUPYING_CLAIM_STATUSES.includes(slot.status) && !req.deletedAt;
    const [revealPolicy, retentionDays] = occupying
      ? await this.readContactAccessSettings()
      : ([SETTING_DEFAULTS.claim_contact_reveal_policy, SETTING_DEFAULTS.completed_claim_contact_retention_days] as const);
    const access = resolveClaimContextAccess({
      slotStatus: slot.status,
      requestDeletedAt: req.deletedAt,
      slotCreatedAt: slot.createdAt,
      slotUpdatedAt: slot.updatedAt,
      requestDeliveredAt: req.deliveredAt,
      claimedByUserId: slot.claimedByUserId,
      assignedToUserId: slot.assignedToUserId,
      memberRole: ctx.memberRole,
      actingUserId,
      revealPolicy,
      retentionDays,
      now,
    });
    if (access.visibility !== 'FULL') return this.buildLimitedClaimContext(slot, access);

    const open = await this.prisma.quote.findFirst({
      where: { claimSlotId, status: { not: 'WITHDRAWN' } },
      orderBy: { createdAt: 'desc' },
    });
    const [attachments, clientUser, projectCase, rawQuoteDto, validityExtensionDays] = await Promise.all([
      // E-client-9: nume neutre si pe fisa de lucru (acelasi fisier ca in marketplace)
      this.uploads.listForEntity('REQUEST', slot.requestId, undefined, { neutralNames: true }),
      req.clientUserId && access.clientVisible
        ? this.prisma.user.findUnique({
            where: { id: req.clientUserId },
            select: { name: true },
          })
        : null,
      open?.status === 'ACCEPTED'
        ? this.prisma.requestProjectCase.findFirst({ where: { claimSlotId }, orderBy: { createdAt: 'desc' } })
        : null,
      open ? this.getQuoteDto(open.id) : null,
      this.resolveValidityDays(undefined),
    ]);
    // adresa consultatiei poate fi chiar locuinta clientului → ascunsa odata cu contactele
    const quoteDto = rawQuoteDto && !access.clientVisible ? stripConsultationAddress(rawQuoteDto) : rawQuoteDto;
    // E-company-6: fereastra de retragere calculata EXACT ca assertWithdrawWindow (UI = server)
    const withdrawable =
      quoteDto && (quoteDto.status === 'SENT' || quoteDto.status === 'EXPIRED') && quoteDto.versions.length > 0;
    const quoteWithdrawWindowEndsAt = withdrawable
      ? this.calendar
          .addWorkingDays(new Date(this.latestVersion(quoteDto.versions).sentAt), WITHDRAW_WINDOW_WORKING_DAYS)
          .toISOString()
      : null;
    const rooms = sortByRoomOrder(req.rooms);
    // E-admin-platform-45 (docs/03 4.2): membrul fara acces la contacte (EMPLOYEE_MANAGED
    // neatribuit, AFTER_GRACE) nu primeste nici contactele scrise in texte libere
    const hideText = !access.clientVisible;
    const text = (s: string | null | undefined) => (hideText ? maskFreeText(s) : (s ?? ''));
    const detailRooms = rooms.map((r) => ({
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
    }));
    return {
      claimSlotId,
      requestId: slot.requestId,
      requestTitle: text(req.title),
      includesPaidDesign: req.includesPaidDesign,
      threadId: slot.chatThread?.id ?? null,
      claimStatus: slot.status,
      requestStatus: req.status,
      claimedAt: slot.createdAt.toISOString(),
      slaDeadlineAt: slot.slaDeadlineAt?.toISOString() ?? null,
      slaPaused: slot.slaPausedAt !== null,
      rooms: rooms.map((r) => ({ id: r.id, roomType: r.roomType })),
      quote: quoteDto,
      detail: {
        description: text(req.description),
        budgetRange: req.budgetRange ?? 'UNDISCLOSED',
        budgetEstimateRon: req.budgetEstimateRon,
        deadlineBucket: req.deadlineBucket,
        hasOwnProject: req.hasOwnProject,
        // contactul si adresa completa doar cand acest membru are voie (E-company-3)
        addressText: access.clientVisible ? (req.addressText ?? '') : '',
        city: req.city ?? '',
        county: req.county ?? '',
        country: req.country,
        rooms: hideText ? detailRooms.map((r) => maskRoomForFirm(r)) : detailRooms,
        attachments,
        inspirationPhotoIds: req.inspirationPhotos.map((p) => p.photoId),
        // E-client-34: notita bruta doar cu acces la contacte, altfel mascata
        inspirationPhotos: req.inspirationPhotos.map((p) => ({
          photoId: p.photoId,
          note: p.note == null ? null : text(p.note),
          requestRoomId: p.requestRoomId,
        })),
        // camerele 3D din Studio (feedback PO r3) — aceeasi vedere read-only
        // ca in marketplace, disponibila si in fisa de lucru post-claim
        studioScenes: req.studioScenes.map((s) => ({
          id: s.id,
          name: hideText ? maskSceneName(s.name) : s.name,
          data: hideText
            ? maskSceneData(s.data as unknown as RequestStudioSceneData)
            : (s.data as unknown as RequestStudioSceneData),
        })),
      },
      client: access.clientVisible
        ? {
            name: clientUser?.name ?? '',
            contacts: req.contactPreferences.map((c) => ({
              id: c.id,
              channel: c.channel,
              value: c.value,
            })),
          }
        : null,
      assignment: {
        claimedBy: slot.claimedBy
          ? { userId: slot.claimedBy.id, name: slot.claimedBy.name }
          : null,
        assignedTo: slot.assignedTo
          ? { userId: slot.assignedTo.id, name: slot.assignedTo.name }
          : null,
        assignDeadlineAt: slot.assignDeadlineAt?.toISOString() ?? null,
      },
      // E-admin-platform-3: cazurile se deschid doar pe slotul castigator
      projectCase: projectCase ? toProjectCaseDto(projectCase) : null,
      firmActions: {
        claimCostCredits: slot.claimCostCreditsSnapshot,
        slaBreachAt: slaBreachAt(slot.slaDeadlineAt, slot.slaPausedAt)?.toISOString() ?? null,
        quoteWithdrawWindowEndsAt,
        validityExtensionDays,
      },
      visibility: 'FULL',
      clientHiddenReason: access.clientHiddenReason,
      clientVisibleFrom: access.clientVisibleFrom?.toISOString() ?? null,
    };
  }

  // E-company-3: setarile de acces la contacte; valoare necunoscuta = implicit (W1).
  // E-client-9: logica e partajata cu cardul "Cine vede cererea" (requests.service).
  private readContactAccessSettings(): Promise<[ClaimContactRevealPolicy, number]> {
    return readClaimContactAccessSettings(this.settings);
  }

  // E-company-3 (docs/03 4.2): preluare care nu mai ocupa slotul (REDACTED) sau cerere stearsa
  // (TOMBSTONE). Doar titlul, localitatea (publica si inainte de claim), statusurile, ofertele
  // proprii si atribuirea — fara atasamente presemnate, raspunsuri, scene 3D, chat sau contacte.
  private async buildLimitedClaimContext(
    slot: {
      id: string;
      requestId: string;
      status: ClaimQuoteContextDto['claimStatus'];
      createdAt: Date;
      claimCostCreditsSnapshot: number;
      request: {
        title: string | null;
        includesPaidDesign: boolean;
        status: RequestStatus;
        city: string | null;
        county: string | null;
        country: string;
        rooms: { id: string; roomType: RoomType; createdAt: Date }[];
      };
      claimedBy: { id: string; name: string } | null;
      assignedTo: { id: string; name: string } | null;
    },
    access: ClaimContextAccess,
  ): Promise<ClaimQuoteContextDto> {
    const redacted = access.visibility === 'REDACTED';
    const req = slot.request;
    // istoricul ofertei proprii, inclusiv WITHDRAWN
    const latest = await this.prisma.quote.findFirst({
      where: { claimSlotId: slot.id },
      orderBy: { createdAt: 'desc' },
    });
    const [rawQuoteDto, projectCase, validityExtensionDays] = await Promise.all([
      latest ? this.getQuoteDto(latest.id) : null,
      redacted && latest?.status === 'ACCEPTED'
        ? this.prisma.requestProjectCase.findFirst({ where: { claimSlotId: slot.id }, orderBy: { createdAt: 'desc' } })
        : null,
      this.resolveValidityDays(undefined),
    ]);
    return {
      claimSlotId: slot.id,
      requestId: slot.requestId,
      // E-admin-platform-45: vederea limitata nu are acces la contacte → titlul se mascheaza
      requestTitle: maskFreeText(req.title),
      includesPaidDesign: req.includesPaidDesign,
      threadId: null,
      claimStatus: slot.status,
      requestStatus: req.status,
      claimedAt: slot.createdAt.toISOString(),
      slaDeadlineAt: null,
      slaPaused: false,
      // tipul camerelor ramane doar ca eticheta pentru preturile proprii per camera
      rooms: redacted ? sortByRoomOrder(req.rooms).map((r) => ({ id: r.id, roomType: r.roomType })) : [],
      quote: rawQuoteDto ? stripConsultationAddress(rawQuoteDto) : null,
      detail: {
        description: '',
        budgetRange: 'UNDISCLOSED',
        budgetEstimateRon: null,
        deadlineBucket: null,
        hasOwnProject: false,
        addressText: '',
        city: redacted ? (req.city ?? '') : '',
        county: redacted ? (req.county ?? '') : '',
        country: req.country,
        rooms: [],
        attachments: [],
        inspirationPhotoIds: [],
        inspirationPhotos: [],
        studioScenes: [],
      },
      client: null,
      assignment: {
        claimedBy: slot.claimedBy ? { userId: slot.claimedBy.id, name: slot.claimedBy.name } : null,
        assignedTo: slot.assignedTo ? { userId: slot.assignedTo.id, name: slot.assignedTo.name } : null,
        assignDeadlineAt: null,
      },
      projectCase: projectCase ? toProjectCaseDto(projectCase) : null,
      firmActions: {
        claimCostCredits: slot.claimCostCreditsSnapshot,
        slaBreachAt: null,
        quoteWithdrawWindowEndsAt: null,
        validityExtensionDays,
      },
      visibility: access.visibility,
      clientHiddenReason: access.clientHiddenReason,
      clientVisibleFrom: null,
    };
  }

  async getQuoteForCompany(ctx: CompanyContext, quoteId: string): Promise<QuoteDto> {
    await this.loadCompanyQuote(quoteId, ctx.companyId);
    return this.getQuoteDto(quoteId);
  }

  async getQuoteForClient(userId: string, quoteId: string): Promise<QuoteDto> {
    const quote = await this.loadQuoteFull(quoteId);
    this.assertClientOwnsRequest(quote.request.clientUserId, userId);
    return this.getQuoteDto(quoteId);
  }

  // Toate ofertele firmelor pentru o cerere (clientul vede pana la 3 oferte).
  async listQuotesForRequestClient(userId: string, requestId: string): Promise<QuoteDto[]> {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found' });
    }
    this.assertClientOwnsRequest(request.clientUserId, userId);
    const quotes = await this.prisma.quote.findMany({
      where: { requestId, status: { not: 'WITHDRAWN' } },
      orderBy: { createdAt: 'asc' },
      include: QUOTE_DTO_INCLUDE,
    });
    return this.toQuoteDtos(quotes);
  }

  async listQuotesForCompany(ctx: CompanyContext): Promise<QuoteDto[]> {
    const quotes = await this.prisma.quote.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { createdAt: 'desc' },
      include: QUOTE_DTO_INCLUDE,
    });
    return this.toQuoteDtos(quotes);
  }

  // E-company-2: o lista = 1 query de oferte + 1 de atasamente (inainte N × (include + presign)).
  private async toQuoteDtos(quotes: QuoteFull[]): Promise<QuoteDto[]> {
    if (quotes.length === 0) return [];
    const [rate, attachments] = await Promise.all([
      this.eurRonRate(),
      this.uploads.listForEntities(
        QUOTE_ATTACHMENT_ENTITY,
        quotes.flatMap((q) => q.versions.map((v) => v.id)),
      ),
    ]);
    const now = Date.now();
    return quotes.map((q) => toQuoteDto(q, attachments, rate, now));
  }

  // ===== helpers interne =====

  // E-company-2 — singura cale de scriere pentru actiunile pe o oferta existenta:
  //  chitanta idempotenta (FOR UPDATE) → cererea (FOR UPDATE, 3.1) → starea blocata a ofertei
  //  (1 statement) → tabela de reguli → mutatia (conditii pe starea BLOCATA, nu pe snapshot) →
  //  evenimentul outbox → chitanta construita in memorie. Serializable + retry la P2034.
  private async lockedQuoteMutation<T>(
    snapshot: QuoteFullWithRequest,
    action: QuoteAction,
    run: (tx: Tx, s: LockedQuoteState, req: LockedRequest, current: QuoteFull) => Promise<MutationOutcome<T>>,
    pre: Preloaded,
  ): Promise<{ result: T; dto: QuoteDto; state: LockedQuoteState }> {
    return this.runQuoteTransaction(async (tx) => {
      await lockIdempotentOperation(tx);
      const req = await lockRequestRow(tx, snapshot.requestId);
      const s = await readLockedQuoteState(tx, snapshot.id);
      if (!req || !s) {
        throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Quote not found' });
      }
      assertLockedRule(action, s, req);
      let current: QuoteFull = snapshot;
      let attachments = pre.attachments;
      if (this.isStale(snapshot, s)) {
        // cale rara: alta mutatie a comis intre citirea din afara si lock → baza proaspata
        current = await this.loadQuoteDtoFull(snapshot.id, tx);
        attachments = await this.uploads.listForEntities(
          QUOTE_ATTACHMENT_ENTITY,
          current.versions.map((v) => v.id),
          tx,
        );
      }
      const outcome = await run(tx, s, req, current);
      await this.recordQuoteEvent(tx, 'quote.updated', {
        quoteId: s.id,
        requestId: s.request_id,
        companyId: s.company_id,
        clientUserId: req.client_user_id,
      });
      const merged = outcome.attachments ? new Map([...attachments, ...outcome.attachments]) : attachments;
      const dto = toQuoteDto(outcome.next, merged, pre.rate);
      if (getIdempotentOperation()?.transactional) await saveIdempotentResult(tx, dto);
      return { result: outcome.result, dto, state: s };
    });
  }

  // Serializable + plafon de scriere + retry P2034 (3 reincercari cu jitter); P2002 pe
  // indexurile de plasa → coduri de domeniu.
  private async runQuoteTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      return await runTx(this.prisma, 'critical', fn);
    } catch (e) {
      throw this.mapUniqueViolation(e);
    }
  }

  private mapUniqueViolation(e: unknown): unknown {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return e;
    const raw = e.meta?.target;
    const target = Array.isArray(raw) ? raw.map(String).join(',') : String(raw ?? '');
    if (target.includes('quotes_one_live_per_claim_slot') || target === 'claim_slot_id') {
      return new HttpException(
        { code: ERROR_CODES.QUOTE_ALREADY_SENT, message: 'Claim already has an offer' },
        409,
      );
    }
    if (target.includes('quote_change_requests_one_pending_per_version') || target === 'quote_version_id') {
      return this.changeAlreadyPending();
    }
    if (target.includes('claim_slots_one_active_unoffered_per_assignee') || target === 'assigned_to_user_id') {
      return new HttpException(
        {
          code: ERROR_CODES.ASSIGNED_USER_HAS_ACTIVE_CLAIM,
          message: 'Assignee already has another claim without an offer',
        },
        409,
      );
    }
    return e;
  }

  private isStale(snapshot: QuoteFull, s: LockedQuoteState): boolean {
    const latest = this.latestVersion(snapshot.versions);
    return (
      s.updated_at.getTime() !== snapshot.updatedAt.getTime() ||
      s.version_count !== snapshot.versions.length ||
      s.pending_changes !== pendingChangeCount(snapshot) ||
      s.latest_extensions !== latest.validityExtensions.length ||
      s.invite_count !== snapshot.consultationInvites.length
    );
  }

  private async preload(quote: QuoteFull): Promise<Preloaded> {
    const [rate, attachments] = await Promise.all([
      this.eurRonRate(),
      this.uploads.listForEntities(QUOTE_ATTACHMENT_ENTITY, quote.versions.map((v) => v.id)),
    ]);
    return { rate, attachments };
  }

  // Redeschide oferta (EXPIRED → SENT) conditionat; bump-uieste si updated_at (santinela
  // de prospetime a snapshot-ului). count 0 = oferta a iesit din SENT/EXPIRED intre timp.
  private async reopenQuote(tx: Tx, quoteId: string): Promise<Date> {
    const updatedAt = new Date();
    const res = await tx.quote.updateMany({
      where: { id: quoteId, status: { in: ['SENT', 'EXPIRED'] } },
      data: { status: 'SENT', updatedAt },
    });
    if (res.count === 0) throw this.notModifiable();
    return updatedAt;
  }

  // Tranzitie inainte a statusului cererii, din statusul citit sub lock (fara recitire);
  // updateMany conditionat pastreaza semantica "nu da inapoi".
  private async bumpRequestForward(
    tx: Tx,
    req: LockedRequest,
    target: keyof typeof FORWARD_FROM,
  ): Promise<void> {
    const from = FORWARD_FROM[target];
    if (!from.includes(req.status)) return;
    await tx.request.updateMany({
      where: { id: req.id, status: { in: from } },
      data: { status: target },
    });
  }

  private assertWithdrawWindow(sentAt: Date): void {
    const deadline = this.calendar.addWorkingDays(sentAt, WITHDRAW_WINDOW_WORKING_DAYS);
    if (Date.now() > deadline.getTime()) {
      throw new HttpException(
        { code: ERROR_CODES.QUOTE_WITHDRAW_WINDOW_CLOSED, message: 'Withdraw window closed' },
        409,
      );
    }
  }

  private notModifiable(): HttpException {
    return new HttpException(
      { code: ERROR_CODES.QUOTE_NOT_MODIFIABLE, message: 'Offer cannot be changed in its current state' },
      409,
    );
  }

  // E-client-1: clientul a confirmat o versiune care nu mai e ultima; details = doar id-uri
  // (chitanta de idempotenta ramane mica, frontend-ul reciteste oferta oricum)
  private versionChanged(v: { id: string; version: number }): HttpException {
    return new HttpException(
      {
        code: ERROR_CODES.QUOTE_VERSION_CHANGED,
        message: 'A newer offer version exists',
        details: { currentVersionId: v.id, currentVersion: v.version },
      },
      409,
    );
  }

  private versionLimitReached(): HttpException {
    return new HttpException(
      { code: ERROR_CODES.QUOTE_VERSION_LIMIT_REACHED, message: 'Version limit reached' },
      409,
    );
  }

  private changeAlreadyPending(): HttpException {
    return new HttpException(
      { code: ERROR_CODES.VALIDATION_ERROR, message: 'A change request is already pending' },
      409,
    );
  }

  private changeNotPending(): HttpException {
    return new HttpException(
      { code: ERROR_CODES.CHANGE_REQUEST_NOT_PENDING, message: 'No pending change request' },
      409,
    );
  }

  private extraOnlyAfterLimit(): HttpException {
    return new HttpException(
      { code: ERROR_CODES.VALIDATION_ERROR, message: 'Extra version allowed only after the limit' },
      409,
    );
  }

  private consultationOnlyAfterLimit(): HttpException {
    return new HttpException(
      { code: ERROR_CODES.VALIDATION_ERROR, message: 'Consultation invite allowed only after the limit' },
      409,
    );
  }

  private extensionLimitReached(): HttpException {
    return new HttpException(
      { code: ERROR_CODES.VALIDITY_EXTENSION_LIMIT_REACHED, message: 'Extension limit reached' },
      409,
    );
  }

  private inviteAlreadyAnswered(): HttpException {
    return new HttpException(
      { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invite already answered' },
      409,
    );
  }

  private inviteExpired(): HttpException {
    return new HttpException(
      { code: ERROR_CODES.CONSULTATION_INVITE_EXPIRED, message: 'Invite expired' },
      409,
    );
  }

  private assertNotManaged(ctx: CompanyContext): void {
    if (ctx.memberRole === 'EMPLOYEE_MANAGED') {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Managed employees cannot send offers' });
    }
  }

  // L0-B — masina de stari: firma poate trimite/revizui/reoferta DOAR cat timp cererea e in
  // CLAIMED_*/OFFERS_RECEIVED/NEGOTIATION si nu e stearsa (soft delete).
  private assertRequestOpenForOffers(request: { status: RequestStatus; deletedAt: Date | null }): void {
    if (!isRequestOpenForOffers(request)) {
      throw new HttpException(
        { code: ERROR_CODES.REQUEST_NOT_OPEN_FOR_OFFERS, message: 'Request no longer accepts offers' },
        409,
      );
    }
  }

  private assertQuoteAcceptable(status: string, validUntil: Date): void {
    if (status !== 'SENT') {
      throw new HttpException(
        { code: ERROR_CODES.QUOTE_ACCEPT_NOT_ALLOWED, message: 'Quote not acceptable' },
        409,
      );
    }
    if (validUntil.getTime() < Date.now()) {
      throw new HttpException({ code: ERROR_CODES.QUOTE_EXPIRED, message: 'Quote expired' }, 409);
    }
  }

  // Curata joburile intarziate ale sloturilor inchise (best-effort, in afara tranzactiei).
  private async dropClaimJobs(
    slots: { id: string; status: string; slaDeadlineAt: Date | null }[],
  ): Promise<void> {
    for (const slot of slots) {
      try {
        if (slot.slaDeadlineAt) {
          await this.slaQueue.remove(slaBreachJobOptions(slot.id, slot.slaDeadlineAt).jobId);
          await this.slaQueue.remove(slaWarningJobOptions(slot.id, slot.slaDeadlineAt).jobId);
          await this.slaQueue.remove(slaGraceWarningJobOptions(slot.id, slot.slaDeadlineAt).jobId);
        }
        if (slot.status === 'ACTIVE') {
          await this.assignQueue.remove(`claim-assign-${slot.id}`);
          await this.assignQueue.remove(`claim-assign-warn-${slot.id}`);
        }
      } catch (e) {
        this.logger.warn(`could not drop claim jobs for slot ${slot.id}: ${safeErrorSummary(e)}`);
      }
    }
  }

  private assertClientOwnsRequest(clientUserId: string | null, userId: string): void {
    if (clientUserId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not your request' });
    }
  }

  private assertDesignFee(dto: OfferFieldsDto | CreateQuoteInput, includesPaidDesign: boolean): void {
    if (dto.designFee != null && !includesPaidDesign) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Design fee not allowed for this request',
      });
    }
  }

  // Matrice permisiuni campuri oferta per rol (4.13 / Î5).
  private async assertFieldPermissions(
    companyId: string,
    role: CompanyMemberRole,
    dto: OfferFieldsDto,
  ): Promise<void> {
    const perms = await this.prisma.companyOfferFieldPermission.findMany({
      where: { companyId, role },
    });
    const allowed = new Set(perms.filter((p) => p.canEdit).map((p) => p.fieldKey));
    const touched = touchedFieldKeys(dto);
    const denied = touched.filter((k) => !allowed.has(k));
    if (denied.length > 0) {
      throw new ForbiddenException({
        code: ERROR_CODES.OFFER_FIELD_NOT_EDITABLE,
        message: 'You cannot edit some offer fields',
        details: { fields: denied },
      });
    }
  }

  private async assertOwnSlot(ctx: CompanyContext, claimSlotId: string): Promise<void> {
    const slot = await this.prisma.claimSlot.findUnique({ where: { id: claimSlotId } });
    if (!slot || slot.companyId !== ctx.companyId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Claim not found' });
    }
  }

  // Defalcarea pe camere (F7, item 22): daca firma o trimite, trebuie sa
  // acopere TOATE camerele cererii (fara duplicate) si suma sa egaleze price.
  // E-company-2: intoarce si roomType per camera (chitanta in memorie, fara recitire).
  private async assertRoomPrices(
    requestId: string,
    dto: { price: number; roomPrices?: { requestRoomId: string; price: number }[] },
  ): Promise<RoomTypes> {
    const roomTypes: RoomTypes = new Map();
    if (!dto.roomPrices || dto.roomPrices.length === 0) return roomTypes;
    const rooms = await this.prisma.requestRoom.findMany({
      where: { requestId },
      select: { id: true, roomType: true },
    });
    for (const r of rooms) roomTypes.set(r.id, r.roomType);
    const seen = new Set<string>();
    for (const rp of dto.roomPrices) {
      if (!roomTypes.has(rp.requestRoomId) || seen.has(rp.requestRoomId)) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Room prices must reference each request room exactly once',
        });
      }
      seen.add(rp.requestRoomId);
    }
    if (seen.size !== roomTypes.size) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Room prices must cover all rooms of the request',
      });
    }
    const sum = dto.roomPrices.reduce((acc, rp) => acc + rp.price, 0);
    if (Math.abs(sum - dto.price) > 0.01) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Room prices must sum to the total price',
      });
    }
    return roomTypes;
  }

  // Id-uri generate in aplicatie → un singur createMany si randurile pentru chitanta.
  private async writeRoomPrices(
    tx: Tx,
    quoteVersionId: string,
    roomPrices: { requestRoomId: string; price: number }[] | undefined,
    roomTypes: RoomTypes,
  ): Promise<RoomPriceInput[]> {
    if (!roomPrices || roomPrices.length === 0) return [];
    const rows = roomPrices.map((rp) => ({
      id: randomUUID(),
      requestRoomId: rp.requestRoomId,
      price: rp.price,
      roomType: roomTypes.get(rp.requestRoomId) as RoomPriceInput['roomType'],
    }));
    await tx.quoteVersionRoomPrice.createMany({
      data: rows.map((rp) => ({
        id: rp.id,
        quoteVersionId,
        requestRoomId: rp.requestRoomId,
        price: new Prisma.Decimal(rp.price),
      })),
    });
    return rows;
  }

  private versionData(
    quoteId: string,
    version: number,
    isExtra: boolean,
    dto: OfferFieldsDto,
    actingUserId: string,
    validUntil: Date,
  ): Prisma.QuoteVersionUncheckedCreateInput {
    return {
      quoteId,
      version,
      isExtra,
      price: new Prisma.Decimal(dto.price),
      designFee: dto.designFee != null ? new Prisma.Decimal(dto.designFee) : null,
      deliveryTerm: dto.deliveryTerm || null,
      deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : null,
      warranty: dto.warranty || null,
      description: dto.description,
      validUntil,
      createdByUserId: actingUserId,
    };
  }

  private async relinkAttachments(
    tx: Tx,
    attachmentIds: string[] | undefined,
    fromSlotId: string,
    toVersionId: string,
  ): Promise<AttachmentDto[]> {
    if (!attachmentIds || attachmentIds.length === 0) return [];
    const rows = await this.uploads.relink(attachmentIds, QUOTE_ATTACHMENT_ENTITY, fromSlotId, toVersionId, tx);
    return this.uploads.toAttachmentDtos(rows);
  }

  private async loadCompanyQuote(quoteId: string, companyId: string): Promise<QuoteFullWithRequest> {
    const quote = await this.loadQuoteFull(quoteId);
    if (quote.companyId !== companyId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Quote not found' });
    }
    return quote;
  }

  private async loadQuoteFull(quoteId: string, db: Tx = this.prisma): Promise<QuoteFullWithRequest> {
    const quote = await db.quote.findUnique({
      where: { id: quoteId },
      include: QUOTE_INCLUDE,
    });
    if (!quote) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Quote not found' });
    }
    return quote;
  }

  private async loadQuoteDtoFull(quoteId: string, db: Tx = this.prisma): Promise<QuoteFull> {
    const quote = await db.quote.findUnique({
      where: { id: quoteId },
      include: QUOTE_DTO_INCLUDE,
    });
    if (!quote) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Quote not found' });
    }
    return quote;
  }

  private async threadForQuote(claimSlotId: string) {
    return this.prisma.chatThread.findUnique({ where: { claimSlotId } });
  }

  private latestVersion<T extends { version: number }>(versions: T[]): T {
    return versions.reduce((a, b) => (b.version > a.version ? b : a));
  }

  private async resolveValidityDays(requested?: number): Promise<number> {
    if (requested && requested > 0) return requested;
    return this.settings.getInt(SETTING_VALIDITY_DAYS, DEFAULT_VALIDITY_DAYS);
  }

  private async eurRonRate(): Promise<number> {
    return this.settings.getNumber(SETTING_EUR_RON_RATE, DEFAULT_EUR_RON_RATE);
  }

  private async scheduleValidityJob(quoteVersionId: string, validUntil: Date): Promise<void> {
    const delay = Math.max(0, validUntil.getTime() - Date.now());
    await this.validityQueue.add(
      'expire',
      { quoteVersionId },
      { delay, jobId: `qv-${quoteVersionId}-${validUntil.getTime()}`, removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    ).catch(() => this.logger.warn('Quote validity scheduling deferred to reconciliation'));
  }

  private async scheduleConsultationJob(inviteId: string, expiresAt: Date): Promise<void> {
    const delay = Math.max(0, expiresAt.getTime() - Date.now());
    await this.consultationQueue.add(
      'expire',
      { inviteId },
      { delay, jobId: `ci-${inviteId}`, removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    ).catch(() => this.logger.warn('Consultation scheduling deferred to reconciliation'));
  }

  // Tintele unei oferte (3.5): membrii firmei + clientul cererii.
  private async quoteTargets(db: Tx, companyId: string, clientUserId: string | null): Promise<string[]> {
    const members = await db.companyMember.findMany({
      where: { companyId },
      select: { userId: true },
    });
    const ids = members.map((m) => m.userId);
    if (clientUserId) ids.push(clientUserId);
    return ids;
  }

  // Participanti pentru emisie realtime privata (3.5): client + membrii firmei ofertei.
  private async participantsForQuote(quoteId: string, db: Tx = this.prisma): Promise<string[]> {
    const quote = await db.quote.findUnique({
      where: { id: quoteId },
      select: { companyId: true, request: { select: { clientUserId: true } } },
    });
    if (!quote) return [];
    return this.quoteTargets(db, quote.companyId, quote.request.clientUserId);
  }

  // Toti participantii cererii (client + membrii tuturor firmelor cu claim).
  private async participantsForRequest(requestId: string, db: Tx = this.prisma): Promise<string[]> {
    const request = await db.request.findUnique({
      where: { id: requestId },
      select: { clientUserId: true },
    });
    const claims = await db.claimSlot.findMany({
      where: { requestId },
      select: { companyId: true },
    });
    const companyIds = [...new Set(claims.map((c) => c.companyId))];
    const members = await db.companyMember.findMany({
      where: { companyId: { in: companyIds } },
      select: { userId: true },
    });
    const ids = members.map((m) => m.userId);
    if (request?.clientUserId) ids.push(request.clientUserId);
    return ids;
  }

  // E-admin-platform-3: tintele (client + membrii firmei) pentru evenimentele scrise de workeri.
  async participantsFor(quoteId: string, db: Tx = this.prisma): Promise<string[]> {
    return this.participantsForQuote(quoteId, db);
  }

  // Folosit de worker-e (expirare valabilitate / invitatie) pentru a notifica participantii.
  async publishQuoteUpdated(quoteId: string, db: Tx = this.prisma): Promise<void> {
    const quote = await db.quote.findUnique({
      where: { id: quoteId },
      select: { requestId: true, companyId: true, request: { select: { clientUserId: true } } },
    });
    if (!quote) return;
    await this.recordQuoteEvent(db, 'quote.updated', {
      quoteId,
      requestId: quote.requestId,
      companyId: quote.companyId,
      clientUserId: quote.request.clientUserId,
    });
  }

  // Aceleasi chei/tipuri/tinte ca inainte; payload doar cu id-uri — requestTitle/companyName
  // sunt re-hidratate de dispatcher-ul outbox (record() oricum le scoate). 2 round-trip-uri.
  private async recordQuoteEvent(
    db: Tx,
    event: 'quote.created' | 'quote.updated',
    p: { quoteId: string; requestId: string; companyId: string; clientUserId: string | null },
  ): Promise<void> {
    const targets = await this.quoteTargets(db, p.companyId, p.clientUserId);
    await this.outbox.record(
      db,
      `${event}:${p.quoteId}:${randomUUID()}`,
      event,
      {
        quoteId: p.quoteId,
        requestId: p.requestId,
        companyId: p.companyId,
        // destinatarul emailului "oferta noua" (Q4, idee 5)
        clientUserId: p.clientUserId,
      },
      targets,
    );
  }

  // ===== mapare DTO =====
  // E-company-2: 1 query pentru oferta + 1 pentru atasamentele tuturor versiunilor; maparea e
  // pura (quote-dto.mapper.ts).
  async getQuoteDto(quoteId: string, eurRonRate?: number, db: Tx = this.prisma): Promise<QuoteDto> {
    const quote = await this.loadQuoteDtoFull(quoteId, db);
    const [rate, attachments] = await Promise.all([
      eurRonRate ?? this.eurRonRate(),
      this.uploads.listForEntities(QUOTE_ATTACHMENT_ENTITY, quote.versions.map((v) => v.id), db),
    ]);
    return toQuoteDto(quote, attachments, rate);
  }
}
