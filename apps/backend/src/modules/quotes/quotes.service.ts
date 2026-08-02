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
  type ClaimQuoteContextDto,
  type ConsultationInviteDto,
  type CreateConsultationInviteInput,
  type CreateQuoteInput,
  type ExtendValidityInput,
  type ExtraQuoteVersionInput,
  type PresignUploadResultDto,
  type QuoteDto,
  type QuoteVersionDto,
  type RequestQuoteChangeInput,
  type RequestStudioSceneData,
  type ReviseQuoteInput,
  type RespondConsultationInviteInput,
  sortByRoomOrder,
} from '@marketplace/shared';
import {
  Prisma,
  type CompanyMemberRole,
  type QuoteCurrency,
  type RequestStatus,
} from '@prisma/client';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { SettingsService } from '../../common/settings/settings.service';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import { QUEUE_CONSULTATION_EXPIRY, QUEUE_QUOTE_VALIDITY } from '../../infra/queues/queues.module';
import type { CompanyContext } from '../../common/company-context/company-context';
import { UploadsService, type PresignInput } from '../uploads/uploads.service';
import { CreditsService } from '../billing/credits.service';
import { OCCUPYING_CLAIM_STATUSES } from '../claims/claims.constants';
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
import { convertCurrency, touchedFieldKeys } from './quotes.helpers';
import type { OfferFieldsDto } from './dto/quote.dto';
import type { QuoteValidityJob } from './quote-validity.processor';
import type { ConsultationExpiryJob } from './consultation-expiry.processor';

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;
const QUOTE_INCLUDE = {
  request: true,
  company: true,
  versions: {
    orderBy: { version: 'asc' as const },
    include: {
      changeRequests: true,
      validityExtensions: true,
      // defalcarea pe camere (F7) — roomType pentru afisare directa la client
      roomPrices: { include: { room: { select: { roomType: true } } } },
    },
  },
  consultationInvites: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly eventBus: EventBusService,
    private readonly calendar: BusinessCalendarService,
    private readonly uploads: UploadsService,
    private readonly credits: CreditsService,
    @InjectQueue(QUEUE_QUOTE_VALIDITY) private readonly validityQueue: Queue<QuoteValidityJob>,
    @InjectQueue(QUEUE_CONSULTATION_EXPIRY)
    private readonly consultationQueue: Queue<ConsultationExpiryJob>,
  ) {}

  // ===== COMPANY: trimitere oferta v1 =====
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
    this.assertDesignFee(dto, slot.request.includesPaidDesign);
    await this.assertFieldPermissions(ctx.companyId, ctx.memberRole, dto);
    await this.assertRoomPrices(slot.requestId, dto);

    const validityDays = await this.resolveValidityDays(dto.validityDays);
    const validUntil = new Date(Date.now() + validityDays * DAY_MS);
    const currency: QuoteCurrency = dto.currency ?? 'RON';

    const { quote, versionId } = await this.prisma.$transaction(async (tx) => {
      const createdQuote = await tx.quote.create({
        data: {
          claimSlotId: slot.id,
          requestId: slot.requestId,
          companyId: ctx.companyId,
          currency,
          status: 'SENT',
        },
      });
      const version = await tx.quoteVersion.create({
        data: {
          quoteId: createdQuote.id,
          version: 1,
          price: new Prisma.Decimal(dto.price),
          designFee: dto.designFee != null ? new Prisma.Decimal(dto.designFee) : null,
          deliveryTerm: dto.deliveryTerm || null,
          deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : null,
          warranty: dto.warranty || null,
          description: dto.description,
          validUntil,
          createdByUserId: actingUserId,
        },
      });
      await this.writeRoomPrices(tx, version.id, dto.roomPrices);
      await this.relinkAttachments(tx, dto.attachmentIds, slot.id, version.id);
      // slot ACTIVE → OFFER_SENT + quoteId denormalizat (elibereaza indexul 1-claim-fara-oferta).
      await tx.claimSlot.update({
        where: { id: slot.id },
        data: { status: 'OFFER_SENT', quoteId: createdQuote.id },
      });
      await this.bumpRequestStatus(tx, slot.requestId, 'OFFERS_RECEIVED');
      return { quote: createdQuote, versionId: version.id };
    });

    await this.scheduleValidityJob(versionId, validUntil);
    await this.emitQuote('quote.created', quote.id);
    return this.getQuoteDto(quote.id);
  }

  // ===== CLIENT: cerere de modificare =====
  async requestChange(userId: string, dto: RequestQuoteChangeInput): Promise<QuoteDto> {
    const version = await this.prisma.quoteVersion.findUnique({
      where: { id: dto.quoteVersionId },
      include: { quote: { include: { request: true, versions: true } } },
    });
    if (!version) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Quote version not found' });
    }
    const quote = version.quote;
    this.assertClientOwnsRequest(quote.request.clientUserId, userId);
    if (quote.status !== 'SENT') {
      throw new HttpException(
        { code: ERROR_CODES.QUOTE_ACCEPT_NOT_ALLOWED, message: 'Quote not open' },
        409,
      );
    }
    const thread = await this.threadForQuote(quote.claimSlotId);
    if (thread?.negotiationEndedByCompany) {
      throw new HttpException(
        { code: ERROR_CODES.NEGOTIATION_ENDED, message: 'Negotiation ended' },
        409,
      );
    }
    // change request doar pe ultima versiune
    const latest = this.latestVersion(quote.versions);
    if (latest.id !== version.id) {
      throw new HttpException(
        { code: ERROR_CODES.VALIDATION_ERROR, message: 'Not the latest version' },
        409,
      );
    }
    // block dupa v3 (4.13): nu se mai pot cere modificari care ar genera o versiune noua.
    if (this.nonExtraCount(quote.versions) >= MAX_QUOTE_VERSIONS) {
      throw new HttpException(
        { code: ERROR_CODES.QUOTE_VERSION_LIMIT_REACHED, message: 'Version limit reached' },
        409,
      );
    }
    // o singura cerere PENDING odata
    const allVersionIds = quote.versions.map((v) => v.id);
    const pending = await this.prisma.quoteChangeRequest.findFirst({
      where: { quoteVersionId: { in: allVersionIds }, status: 'PENDING' },
    });
    if (pending) {
      throw new HttpException(
        { code: ERROR_CODES.VALIDATION_ERROR, message: 'A change request is already pending' },
        409,
      );
    }
    // aceeasi modificare refuzata nu poate fi reluata (4.13)
    const rejectedSame = await this.prisma.quoteChangeRequest.findFirst({
      where: { quoteVersionId: { in: allVersionIds }, status: 'REJECTED', requestedText: dto.requestedText },
    });
    if (rejectedSame) {
      throw new HttpException(
        { code: ERROR_CODES.CHANGE_REQUEST_ALREADY_REJECTED, message: 'Change already rejected' },
        409,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.quoteChangeRequest.create({
        data: { quoteVersionId: version.id, clientUserId: userId, requestedText: dto.requestedText },
      });
      await this.bumpRequestStatus(tx, quote.requestId, 'NEGOTIATION');
    });
    await this.emitQuote('quote.updated', quote.id);
    return this.getQuoteDto(quote.id);
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
    this.assertDesignFee(dto, quote.request.includesPaidDesign);
    await this.assertFieldPermissions(ctx.companyId, ctx.memberRole, dto);

    const change = await this.prisma.quoteChangeRequest.findUnique({
      where: { id: dto.changeRequestId },
    });
    const versionIds = new Set(quote.versions.map((v) => v.id));
    if (!change || !versionIds.has(change.quoteVersionId) || change.status !== 'PENDING') {
      throw new HttpException(
        { code: ERROR_CODES.CHANGE_REQUEST_NOT_PENDING, message: 'No pending change request' },
        409,
      );
    }
    if (this.nonExtraCount(quote.versions) >= MAX_QUOTE_VERSIONS) {
      throw new HttpException(
        { code: ERROR_CODES.QUOTE_VERSION_LIMIT_REACHED, message: 'Version limit reached' },
        409,
      );
    }
    const validityDays = await this.resolveValidityDays(dto.validityDays);
    const validUntil = new Date(Date.now() + validityDays * DAY_MS);
    await this.assertRoomPrices(quote.requestId, dto);
    const nextVersion = this.maxVersionNumber(quote.versions) + 1;

    const versionId = await this.prisma.$transaction(async (tx) => {
      await tx.quoteChangeRequest.update({
        where: { id: change.id },
        data: { status: 'FULFILLED', respondedAt: new Date() },
      });
      const version = await tx.quoteVersion.create({
        data: this.versionData(quote.id, nextVersion, false, dto, actingUserId, validUntil),
      });
      await this.writeRoomPrices(tx, version.id, dto.roomPrices);
      await this.relinkAttachments(tx, dto.attachmentIds, quote.claimSlotId, version.id);
      if (quote.status === 'EXPIRED') {
        await tx.quote.update({ where: { id: quote.id }, data: { status: 'SENT' } });
      }
      return version.id;
    });

    await this.scheduleValidityJob(versionId, validUntil);
    await this.emitQuote('quote.updated', quote.id);
    return this.getQuoteDto(quote.id);
  }

  // ===== COMPANY: refuza modificarea (nu consuma slot) =====
  async rejectChange(ctx: CompanyContext, quoteId: string, changeRequestId: string): Promise<QuoteDto> {
    this.assertNotManaged(ctx);
    const quote = await this.loadCompanyQuote(quoteId, ctx.companyId);
    const versionIds = new Set(quote.versions.map((v) => v.id));
    const change = await this.prisma.quoteChangeRequest.findUnique({ where: { id: changeRequestId } });
    if (!change || !versionIds.has(change.quoteVersionId) || change.status !== 'PENDING') {
      throw new HttpException(
        { code: ERROR_CODES.CHANGE_REQUEST_NOT_PENDING, message: 'No pending change request' },
        409,
      );
    }
    await this.prisma.quoteChangeRequest.update({
      where: { id: change.id },
      data: { status: 'REJECTED', respondedAt: new Date() },
    });
    await this.emitQuote('quote.updated', quote.id);
    return this.getQuoteDto(quote.id);
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
    this.assertDesignFee(dto, quote.request.includesPaidDesign);
    await this.assertFieldPermissions(ctx.companyId, ctx.memberRole, dto);
    if (this.nonExtraCount(quote.versions) < MAX_QUOTE_VERSIONS) {
      throw new HttpException(
        { code: ERROR_CODES.VALIDATION_ERROR, message: 'Extra version allowed only after the limit' },
        409,
      );
    }
    const validityDays = await this.resolveValidityDays(dto.validityDays);
    const validUntil = new Date(Date.now() + validityDays * DAY_MS);
    await this.assertRoomPrices(quote.requestId, dto);
    const nextVersion = this.maxVersionNumber(quote.versions) + 1;

    const versionId = await this.prisma.$transaction(async (tx) => {
      const version = await tx.quoteVersion.create({
        data: this.versionData(quote.id, nextVersion, true, dto, actingUserId, validUntil),
      });
      await this.writeRoomPrices(tx, version.id, dto.roomPrices);
      await this.relinkAttachments(tx, dto.attachmentIds, quote.claimSlotId, version.id);
      await tx.quote.update({
        where: { id: quote.id },
        data: { extraVersionsCount: { increment: 1 }, status: 'SENT' },
      });
      return version.id;
    });

    await this.scheduleValidityJob(versionId, validUntil);
    await this.emitQuote('quote.updated', quote.id);
    return this.getQuoteDto(quote.id);
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
    if (quote.status !== 'EXPIRED' && quote.status !== 'SENT') {
      throw new HttpException(
        { code: ERROR_CODES.QUOTE_ACCEPT_NOT_ALLOWED, message: 'Quote not re-offerable' },
        409,
      );
    }
    this.assertDesignFee(dto, quote.request.includesPaidDesign);
    await this.assertFieldPermissions(ctx.companyId, ctx.memberRole, dto);
    if (this.nonExtraCount(quote.versions) >= MAX_QUOTE_VERSIONS) {
      throw new HttpException(
        { code: ERROR_CODES.QUOTE_VERSION_LIMIT_REACHED, message: 'Version limit reached' },
        409,
      );
    }
    const validityDays = await this.resolveValidityDays(dto.validityDays);
    const validUntil = new Date(Date.now() + validityDays * DAY_MS);
    await this.assertRoomPrices(quote.requestId, dto);
    const nextVersion = this.maxVersionNumber(quote.versions) + 1;

    const versionId = await this.prisma.$transaction(async (tx) => {
      const version = await tx.quoteVersion.create({
        data: this.versionData(quote.id, nextVersion, false, dto, actingUserId, validUntil),
      });
      await this.writeRoomPrices(tx, version.id, dto.roomPrices);
      await this.relinkAttachments(tx, dto.attachmentIds, quote.claimSlotId, version.id);
      if (quote.status === 'EXPIRED') {
        await tx.quote.update({ where: { id: quote.id }, data: { status: 'SENT' } });
      }
      return version.id;
    });

    await this.scheduleValidityJob(versionId, validUntil);
    await this.emitQuote('quote.updated', quote.id);
    return this.getQuoteDto(quote.id);
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
    const latest = this.latestVersion(quote.versions);
    if (latest.validityExtensions.length >= MAX_VALIDITY_EXTENSIONS) {
      throw new HttpException(
        { code: ERROR_CODES.VALIDITY_EXTENSION_LIMIT_REACHED, message: 'Extension limit reached' },
        409,
      );
    }
    const days = dto.days ?? (await this.resolveValidityDays(undefined));
    const previous = latest.validUntil;
    const newValidUntil = new Date(previous.getTime() + days * DAY_MS);

    await this.prisma.$transaction(async (tx) => {
      await tx.quoteValidityExtension.create({
        data: {
          quoteVersionId: latest.id,
          extendedByDays: days,
          extendedByUserId: actingUserId,
          previousValidUntil: previous,
          newValidUntil,
        },
      });
      await tx.quoteVersion.update({ where: { id: latest.id }, data: { validUntil: newValidUntil } });
      if (quote.status === 'EXPIRED') {
        await tx.quote.update({ where: { id: quote.id }, data: { status: 'SENT' } });
      }
    });

    await this.scheduleValidityJob(latest.id, newValidUntil);
    await this.emitQuote('quote.updated', quote.id);
    return this.getQuoteDto(quote.id);
  }

  // ===== COMPANY: retragere oferta in 1 zi lucratoare =====
  async withdrawQuote(ctx: CompanyContext, quoteId: string): Promise<QuoteDto> {
    this.assertNotManaged(ctx);
    const quote = await this.loadCompanyQuote(quoteId, ctx.companyId);
    if (quote.status !== 'SENT' && quote.status !== 'EXPIRED') {
      throw new HttpException(
        { code: ERROR_CODES.QUOTE_ACCEPT_NOT_ALLOWED, message: 'Quote not withdrawable' },
        409,
      );
    }
    const latest = this.latestVersion(quote.versions);
    const deadline = this.calendar.addWorkingDays(latest.sentAt, WITHDRAW_WINDOW_WORKING_DAYS);
    if (Date.now() > deadline.getTime()) {
      throw new HttpException(
        { code: ERROR_CODES.QUOTE_WITHDRAW_WINDOW_CLOSED, message: 'Withdraw window closed' },
        409,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: quote.id },
        data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
      });
      // slotul redevine ACTIVE fara oferta (firma poate trimite o noua oferta).
      await tx.claimSlot.update({
        where: { id: quote.claimSlotId },
        data: { status: 'ACTIVE', quoteId: null },
      });
    });
    await this.emitQuote('quote.updated', quote.id);
    return this.getQuoteDto(quote.id);
  }

  // ===== COMPANY: incheie negocierea online (chat read-only ambii; D3) =====
  async endNegotiation(ctx: CompanyContext, quoteId: string): Promise<QuoteDto> {
    this.assertNotManaged(ctx);
    const quote = await this.loadCompanyQuote(quoteId, ctx.companyId);
    await this.prisma.chatThread.update({
      where: { claimSlotId: quote.claimSlotId },
      data: { negotiationEndedByCompany: true, readOnly: true },
    });
    await this.emitQuote('quote.updated', quote.id);
    return this.getQuoteDto(quote.id);
  }

  // ===== COMPANY: invitatie consultanta fizica (block optiunea b; expira +7 zile) =====
  async createConsultationInvite(
    ctx: CompanyContext,
    quoteId: string,
    dto: CreateConsultationInviteInput,
  ): Promise<QuoteDto> {
    this.assertNotManaged(ctx);
    const quote = await this.loadCompanyQuote(quoteId, ctx.companyId);
    if (this.nonExtraCount(quote.versions) < MAX_QUOTE_VERSIONS) {
      throw new HttpException(
        { code: ERROR_CODES.VALIDATION_ERROR, message: 'Consultation invite allowed only after the limit' },
        409,
      );
    }
    const days = await this.settings.getInt(SETTING_CONSULTATION_DAYS, DEFAULT_CONSULTATION_DAYS);
    const expiresAt = new Date(Date.now() + days * DAY_MS);
    const invite = await this.prisma.physicalConsultationInvite.create({
      data: {
        quoteId: quote.id,
        companyId: ctx.companyId,
        locationAddress: dto.locationAddress,
        proposedDatetime: new Date(dto.proposedDatetime),
        alternativeDatetimes: dto.alternativeDatetimes ?? undefined,
        expiresAt,
      },
    });
    await this.scheduleConsultationJob(invite.id, expiresAt);
    await this.emitQuote('quote.updated', quote.id);
    return this.getQuoteDto(quote.id);
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
    if (invite.status !== 'PENDING_CLIENT') {
      throw new HttpException(
        { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invite already answered' },
        409,
      );
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new HttpException(
        { code: ERROR_CODES.CONSULTATION_INVITE_EXPIRED, message: 'Invite expired' },
        409,
      );
    }
    await this.prisma.physicalConsultationInvite.update({
      where: { id: invite.id },
      data: {
        status: dto.accept ? 'ACCEPTED' : 'DECLINED',
        clientResponseText: dto.clientResponseText || null,
        respondedAt: new Date(),
      },
    });
    await this.emitQuote('quote.updated', invite.quoteId);
    return this.getQuoteDto(invite.quoteId);
  }

  // ===== CLIENT: acceptare oferta =====
  async acceptQuote(userId: string, quoteId: string): Promise<QuoteDto> {
    const quote = await this.loadQuoteFull(quoteId);
    this.assertClientOwnsRequest(quote.request.clientUserId, userId);
    if (quote.status !== 'SENT') {
      throw new HttpException(
        { code: ERROR_CODES.QUOTE_ACCEPT_NOT_ALLOWED, message: 'Quote not acceptable' },
        409,
      );
    }
    const latest = this.latestVersion(quote.versions);
    if (latest.validUntil.getTime() < Date.now()) {
      throw new HttpException({ code: ERROR_CODES.QUOTE_EXPIRED, message: 'Quote expired' }, 409);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: quote.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      await tx.request.update({ where: { id: quote.requestId }, data: { status: 'ACCEPTED' } });
      // ofertele celorlalte firme → SUPERSEDED; chat-urile lor read-only imediat (4.14 / Î19).
      // Creditele firmelor care pierd se CONSUMA (pay-to-play, fara refund — vezi decizie sesiune).
      const others = await tx.quote.findMany({
        where: { requestId: quote.requestId, id: { not: quote.id }, status: { in: ['SENT', 'EXPIRED'] } },
        select: { id: true, claimSlotId: true, companyId: true },
      });
      for (const o of others) {
        await tx.quote.update({ where: { id: o.id }, data: { status: 'SUPERSEDED' } });
        await tx.chatThread.update({ where: { claimSlotId: o.claimSlotId }, data: { readOnly: true } });
        const slot = await tx.claimSlot.findUnique({ where: { id: o.claimSlotId } });
        if (slot && slot.status === 'OFFER_SENT') {
          await this.credits.consume(o.companyId, slot.claimCostCreditsSnapshot, 'OFFER_LOST', slot.id, tx);
        }
      }
    });

    const targets = await this.participantsForRequest(quote.requestId);
    const display = await this.prisma.quote.findUnique({
      where: { id: quote.id },
      include: { request: { select: { title: true } }, company: { select: { name: true } } },
    });
    await this.eventBus.publish(
      'quote.accepted',
      {
        quoteId: quote.id,
        requestId: quote.requestId,
        requestTitle: display?.request.title ?? '',
        companyName: display?.company.name ?? '',
      },
      targets,
    );
    await this.eventBus.publish('request.status_changed', { requestId: quote.requestId });
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
  async getClaimContext(ctx: CompanyContext, claimSlotId: string): Promise<ClaimQuoteContextDto> {
    const slot = await this.prisma.claimSlot.findUnique({
      where: { id: claimSlotId },
      include: {
        request: {
          include: {
            rooms: { include: { items: true }, orderBy: { createdAt: 'asc' } },
            contactPreferences: true,
            inspirationPhotos: { select: { photoId: true } },
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
    const open = await this.prisma.quote.findFirst({
      where: { claimSlotId, status: { not: 'WITHDRAWN' } },
      orderBy: { createdAt: 'desc' },
    });
    const req = slot.request;
    const [attachments, clientUser] = await Promise.all([
      this.uploads.listForEntity('REQUEST', slot.requestId),
      req.clientUserId
        ? this.prisma.user.findUnique({
            where: { id: req.clientUserId },
            select: { name: true },
          })
        : null,
    ]);
    // contactul se arata doar cat timp firma e efectiv pe cerere
    const occupying = OCCUPYING_CLAIM_STATUSES.includes(slot.status);
    const rooms = sortByRoomOrder(req.rooms);
    return {
      claimSlotId,
      requestId: slot.requestId,
      requestTitle: req.title ?? '',
      includesPaidDesign: req.includesPaidDesign,
      threadId: slot.chatThread?.id ?? null,
      claimStatus: slot.status,
      slaDeadlineAt: slot.slaDeadlineAt?.toISOString() ?? null,
      slaPaused: slot.slaPausedAt !== null,
      rooms: rooms.map((r) => ({ id: r.id, roomType: r.roomType })),
      quote: open ? await this.getQuoteDto(open.id) : null,
      detail: {
        description: req.description ?? '',
        budgetRange: req.budgetRange ?? 'UNDISCLOSED',
        budgetEstimateRon: req.budgetEstimateRon,
        deadlineBucket: req.deadlineBucket,
        hasOwnProject: req.hasOwnProject,
        addressText: occupying ? (req.addressText ?? '') : '',
        city: req.city ?? '',
        county: req.county ?? '',
        country: req.country,
        rooms: rooms.map((r) => ({
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
        attachments,
        inspirationPhotoIds: req.inspirationPhotos.map((p) => p.photoId),
        // camerele 3D din Studio (feedback PO r3) — aceeasi vedere read-only
        // ca in marketplace, disponibila si in fisa de lucru post-claim
        studioScenes: req.studioScenes.map((s) => ({
          id: s.id,
          name: s.name,
          data: s.data as unknown as RequestStudioSceneData,
        })),
      },
      client: occupying
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
    });
    const rate = await this.eurRonRate();
    return Promise.all(quotes.map((q) => this.getQuoteDto(q.id, rate)));
  }

  async listQuotesForCompany(ctx: CompanyContext): Promise<QuoteDto[]> {
    const quotes = await this.prisma.quote.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { createdAt: 'desc' },
    });
    const rate = await this.eurRonRate();
    return Promise.all(quotes.map((q) => this.getQuoteDto(q.id, rate)));
  }

  // ===== helpers interne =====

  private assertNotManaged(ctx: CompanyContext): void {
    if (ctx.memberRole === 'EMPLOYEE_MANAGED') {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Managed employees cannot send offers' });
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
  private async assertRoomPrices(
    requestId: string,
    dto: { price: number; roomPrices?: { requestRoomId: string; price: number }[] },
  ): Promise<void> {
    if (!dto.roomPrices || dto.roomPrices.length === 0) return;
    const rooms = await this.prisma.requestRoom.findMany({
      where: { requestId },
      select: { id: true },
    });
    const roomIds = new Set(rooms.map((r) => r.id));
    const seen = new Set<string>();
    for (const rp of dto.roomPrices) {
      if (!roomIds.has(rp.requestRoomId) || seen.has(rp.requestRoomId)) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Room prices must reference each request room exactly once',
        });
      }
      seen.add(rp.requestRoomId);
    }
    if (seen.size !== roomIds.size) {
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
  }

  private async writeRoomPrices(
    tx: Prisma.TransactionClient,
    quoteVersionId: string,
    roomPrices: { requestRoomId: string; price: number }[] | undefined,
  ): Promise<void> {
    if (!roomPrices || roomPrices.length === 0) return;
    await tx.quoteVersionRoomPrice.createMany({
      data: roomPrices.map((rp) => ({
        quoteVersionId,
        requestRoomId: rp.requestRoomId,
        price: new Prisma.Decimal(rp.price),
      })),
    });
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
  ): Promise<void> {
    if (attachmentIds && attachmentIds.length > 0) {
      await this.uploads.relink(attachmentIds, QUOTE_ATTACHMENT_ENTITY, fromSlotId, toVersionId, tx);
    }
  }

  private async loadCompanyQuote(quoteId: string, companyId: string) {
    const quote = await this.loadQuoteFull(quoteId);
    if (quote.companyId !== companyId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Quote not found' });
    }
    return quote;
  }

  private async loadQuoteFull(quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: QUOTE_INCLUDE,
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

  private maxVersionNumber(versions: { version: number }[]): number {
    return versions.reduce((m, v) => Math.max(m, v.version), 0);
  }

  private nonExtraCount(versions: { isExtra: boolean }[]): number {
    return versions.filter((v) => !v.isExtra).length;
  }

  private async resolveValidityDays(requested?: number): Promise<number> {
    if (requested && requested > 0) return requested;
    return this.settings.getInt(SETTING_VALIDITY_DAYS, DEFAULT_VALIDITY_DAYS);
  }

  private async eurRonRate(): Promise<number> {
    return this.settings.getNumber(SETTING_EUR_RON_RATE, DEFAULT_EUR_RON_RATE);
  }

  // Tranzitii inainte ale statusului cererii (nu da inapoi).
  private async bumpRequestStatus(tx: Tx, requestId: string, target: RequestStatus): Promise<void> {
    const order: RequestStatus[] = [
      'DRAFT', 'IN_MARKETPLACE', 'CLAIMED_PARTIAL', 'CLAIMED_FULL',
      'OFFERS_RECEIVED', 'NEGOTIATION', 'ACCEPTED',
    ];
    const req = await tx.request.findUnique({ where: { id: requestId }, select: { status: true } });
    if (!req) return;
    const cur = order.indexOf(req.status);
    const next = order.indexOf(target);
    if (cur >= 0 && next > cur) {
      await tx.request.update({ where: { id: requestId }, data: { status: target } });
    }
  }

  private async scheduleValidityJob(quoteVersionId: string, validUntil: Date): Promise<void> {
    const delay = Math.max(0, validUntil.getTime() - Date.now());
    await this.validityQueue.add(
      'expire',
      { quoteVersionId },
      { delay, jobId: `qv-${quoteVersionId}-${validUntil.getTime()}`, removeOnComplete: true },
    );
  }

  private async scheduleConsultationJob(inviteId: string, expiresAt: Date): Promise<void> {
    const delay = Math.max(0, expiresAt.getTime() - Date.now());
    await this.consultationQueue.add(
      'expire',
      { inviteId },
      { delay, jobId: `ci-${inviteId}`, removeOnComplete: true },
    );
  }

  // Participanti pentru emisie realtime privata (3.5): client + membrii firmei ofertei.
  private async participantsForQuote(quoteId: string): Promise<string[]> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { request: { select: { clientUserId: true } } },
    });
    if (!quote) return [];
    const members = await this.prisma.companyMember.findMany({
      where: { companyId: quote.companyId },
      select: { userId: true },
    });
    const ids = members.map((m) => m.userId);
    if (quote.request.clientUserId) ids.push(quote.request.clientUserId);
    return ids;
  }

  // Toti participantii cererii (client + membrii tuturor firmelor cu claim).
  private async participantsForRequest(requestId: string): Promise<string[]> {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      select: { clientUserId: true },
    });
    const claims = await this.prisma.claimSlot.findMany({
      where: { requestId },
      select: { companyId: true },
    });
    const companyIds = [...new Set(claims.map((c) => c.companyId))];
    const members = await this.prisma.companyMember.findMany({
      where: { companyId: { in: companyIds } },
      select: { userId: true },
    });
    const ids = members.map((m) => m.userId);
    if (request?.clientUserId) ids.push(request.clientUserId);
    return ids;
  }

  // Folosit de worker-e (expirare valabilitate / invitatie) pentru a notifica participantii.
  async publishQuoteUpdated(quoteId: string): Promise<void> {
    await this.emitQuote('quote.updated', quoteId);
  }

  private async emitQuote(event: 'quote.created' | 'quote.updated', quoteId: string): Promise<void> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        request: { select: { title: true, clientUserId: true } },
        company: { select: { name: true } },
      },
    });
    if (!quote) return;
    const targets = await this.participantsForQuote(quoteId);
    // context afisabil pentru notificari (titlu + deep-link, item 5)
    await this.eventBus.publish(
      event,
      {
        quoteId,
        requestId: quote.requestId,
        requestTitle: quote.request.title ?? '',
        companyName: quote.company.name,
        // destinatarul emailului "oferta noua" (Q4, idee 5)
        clientUserId: quote.request.clientUserId,
      },
      targets,
    );
  }

  // ===== mapare DTO =====

  async getQuoteDto(quoteId: string, eurRonRate?: number): Promise<QuoteDto> {
    const quote = await this.loadQuoteFull(quoteId);
    const rate = eurRonRate ?? (await this.eurRonRate());
    const now = Date.now();
    const versions: QuoteVersionDto[] = await Promise.all(
      quote.versions.map(async (v) => {
        const price = Number(v.price);
        const designFee = v.designFee != null ? Number(v.designFee) : null;
        const p = convertCurrency(price, quote.currency, rate);
        const d = designFee != null ? convertCurrency(designFee, quote.currency, rate) : null;
        const pendingChange =
          v.changeRequests.find((c) => c.status === 'PENDING') ??
          v.changeRequests[v.changeRequests.length - 1] ??
          null;
        const attachments = await this.uploads.listForEntity(QUOTE_ATTACHMENT_ENTITY, v.id);
        return {
          id: v.id,
          version: v.version,
          isExtra: v.isExtra,
          price,
          designFee,
          currency: quote.currency,
          priceRon: p.ron,
          priceEur: p.eur,
          designFeeRon: d?.ron ?? null,
          designFeeEur: d?.eur ?? null,
          deliveryTerm: v.deliveryTerm,
          deliveryDate: v.deliveryDate ? v.deliveryDate.toISOString().slice(0, 10) : null,
          warranty: v.warranty,
          description: v.description,
          validUntil: v.validUntil.toISOString(),
          isExpired: v.validUntil.getTime() < now,
          validityExtensionsUsed: v.validityExtensions.length,
          createdByUserId: v.createdByUserId,
          sentAt: v.sentAt.toISOString(),
          roomPrices: v.roomPrices.map((rp) => ({
            requestRoomId: rp.requestRoomId,
            roomType: rp.room.roomType,
            price: rp.price.toNumber(),
          })),
          changeRequest: pendingChange
            ? {
                id: pendingChange.id,
                quoteVersionId: pendingChange.quoteVersionId,
                requestedText: pendingChange.requestedText,
                status: pendingChange.status,
                createdAt: pendingChange.createdAt.toISOString(),
                respondedAt: pendingChange.respondedAt?.toISOString() ?? null,
              }
            : null,
          attachments: attachments.map((a) => ({
            id: a.id,
            filename: a.filename,
            mimeType: a.mimeType,
            downloadUrl: a.downloadUrl,
          })),
        };
      }),
    );
    const consultationInvites: ConsultationInviteDto[] = quote.consultationInvites.map((i) => ({
      id: i.id,
      quoteId: i.quoteId,
      companyId: i.companyId,
      locationAddress: i.locationAddress,
      proposedDatetime: i.proposedDatetime.toISOString(),
      alternativeDatetimes: (i.alternativeDatetimes as string[] | null) ?? null,
      status: i.status,
      clientResponseText: i.clientResponseText,
      expiresAt: i.expiresAt.toISOString(),
      respondedAt: i.respondedAt?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
    }));
    const versionsUsed = this.nonExtraCount(quote.versions);
    return {
      id: quote.id,
      claimSlotId: quote.claimSlotId,
      requestId: quote.requestId,
      companyId: quote.companyId,
      companyName: quote.company.name,
      currency: quote.currency,
      status: quote.status,
      extraVersionsCount: quote.extraVersionsCount,
      versionsUsed,
      versionLimitReached: versionsUsed >= MAX_QUOTE_VERSIONS,
      eurRonRate: rate,
      versions,
      consultationInvites,
      createdAt: quote.createdAt.toISOString(),
    };
  }
}
