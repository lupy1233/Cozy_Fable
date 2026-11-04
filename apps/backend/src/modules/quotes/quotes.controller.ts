import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { CurrentCompany } from '../../common/company-context/current-company.decorator';
import type { CompanyContext } from '../../common/company-context/company-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { QuotesService } from './quotes.service';
import { QuotePdfService } from './quote-pdf.service';
import {
  AcceptQuoteDto,
  CreateConsultationInviteDto,
  CreateQuoteDto,
  ExtendValidityDto,
  ExtraQuoteVersionDto,
  PresignQuoteAttachmentDto,
  RequestQuoteChangeDto,
  RespondConsultationInviteDto,
  ReviseQuoteDto,
  WithdrawQuoteDto,
} from './dto/quote.dto';

// Ofertare — firma (4.13). Membru non-managed; permisiunile pe campuri se verifica in service.
@Controller('quotes')
@Roles(UserRole.COMPANY_USER)
@UseGuards(CompanyApprovedGuard)
@UseInterceptors(AuditInterceptor)
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly pdf: QuotePdfService,
  ) {}

  // POST critic — Idempotency-Key (invarianta 3.2).
  @Post()
  @Audit('QUOTE_CREATED', 'quote')
  @Idempotent({ transactional: true })
  @UseInterceptors(IdempotencyInterceptor)
  create(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.quotes.createQuote(ctx, user.sub, dto);
  }

  @Get('mine')
  listMine(@CurrentCompany() ctx: CompanyContext) {
    return this.quotes.listQuotesForCompany(ctx);
  }

  @Get('by-claim/:claimSlotId')
  claimContext(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('claimSlotId', ParseUUIDPipe) claimSlotId: string,
  ) {
    // E-company-3: vizibilitatea contactelor depinde de membrul care citeste
    return this.quotes.getClaimContext(ctx, user.sub, claimSlotId);
  }

  @Get(':id')
  getOne(@CurrentCompany() ctx: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.getQuoteForCompany(ctx, id);
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="oferta.pdf"')
  async pdfFor(@CurrentCompany() ctx: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    return new StreamableFile(await this.pdf.generateForCompany(ctx, id));
  }

  @Post(':id/revise')
  @Audit('QUOTE_REVISED', 'quote')
  @Idempotent({ transactional: true })
  @UseInterceptors(IdempotencyInterceptor)
  revise(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviseQuoteDto,
  ) {
    return this.quotes.reviseQuote(ctx, user.sub, id, dto);
  }

  @Post(':id/extra')
  @Audit('QUOTE_EXTRA_VERSION_CREATED', 'quote')
  @Idempotent({ transactional: true })
  @UseInterceptors(IdempotencyInterceptor)
  extra(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtraQuoteVersionDto,
  ) {
    return this.quotes.extraVersion(ctx, user.sub, id, dto);
  }

  @Post(':id/reoffer')
  @Audit('QUOTE_REOFFERED', 'quote')
  @Idempotent({ transactional: true })
  @UseInterceptors(IdempotencyInterceptor)
  reoffer(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtraQuoteVersionDto,
  ) {
    return this.quotes.reofferModify(ctx, user.sub, id, dto);
  }

  @Post(':id/extend-validity')
  @Audit('QUOTE_VALIDITY_EXTENDED', 'quote')
  extend(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendValidityDto,
  ) {
    return this.quotes.extendValidity(ctx, user.sub, id, dto);
  }

  @Post(':id/withdraw')
  @Audit('QUOTE_WITHDRAWN', 'quote')
  withdraw(
    @CurrentCompany() ctx: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WithdrawQuoteDto,
  ) {
    return this.quotes.withdrawQuote(ctx, id, dto);
  }

  @Post(':id/end-negotiation')
  @Audit('QUOTE_NEGOTIATION_ENDED', 'quote')
  endNegotiation(@CurrentCompany() ctx: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.endNegotiation(ctx, id);
  }

  @Post(':id/changes/:changeId/reject')
  @Audit('QUOTE_CHANGE_REJECTED', 'quote')
  rejectChange(
    @CurrentCompany() ctx: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('changeId', ParseUUIDPipe) changeId: string,
  ) {
    return this.quotes.rejectChange(ctx, id, changeId);
  }

  @Post(':id/consultation-invites')
  @Audit('CONSULTATION_INVITED', 'quote')
  invite(
    @CurrentCompany() ctx: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateConsultationInviteDto,
  ) {
    return this.quotes.createConsultationInvite(ctx, id, dto);
  }

  // Upload atasamente oferta (bucket = claimSlotId, inainte de trimitere). Rate limit 30/min (3.13).
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('claims/:claimSlotId/attachments')
  presignAttachment(
    @CurrentCompany() ctx: CompanyContext,
    @Param('claimSlotId', ParseUUIDPipe) claimSlotId: string,
    @Body() dto: PresignQuoteAttachmentDto,
  ) {
    return this.quotes.presignQuoteAttachment(ctx, claimSlotId, dto);
  }

  @Post('claims/:claimSlotId/attachments/:attachmentId/confirm')
  confirmAttachment(
    @CurrentCompany() ctx: CompanyContext,
    @Param('claimSlotId', ParseUUIDPipe) claimSlotId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.quotes.confirmQuoteAttachment(ctx, claimSlotId, attachmentId);
  }
}

// Ofertare — client (4.13). Clientul autentificat care detine cererea.
@Controller('client/quotes')
@Roles(UserRole.CLIENT)
@UseInterceptors(AuditInterceptor)
export class ClientQuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly pdf: QuotePdfService,
  ) {}

  @Get('request/:requestId')
  listForRequest(
    @CurrentUser() user: AccessTokenPayload,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.quotes.listQuotesForRequestClient(user.sub, requestId);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.getQuoteForClient(user.sub, id);
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="oferta.pdf"')
  async pdfFor(@CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return new StreamableFile(await this.pdf.generateForClient(user.sub, id));
  }

  @Post('changes')
  @Audit('QUOTE_CHANGE_REQUESTED', 'quote')
  requestChange(@CurrentUser() user: AccessTokenPayload, @Body() dto: RequestQuoteChangeDto) {
    return this.quotes.requestChange(user.sub, dto);
  }

  @Post(':id/accept')
  @Audit('QUOTE_ACCEPTED', 'quote')
  @Idempotent({ transactional: true })
  @UseInterceptors(IdempotencyInterceptor)
  accept(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptQuoteDto,
  ) {
    // E-client-1: clientul confirma exact versiunea vazuta (409 QUOTE_VERSION_CHANGED altfel)
    return this.quotes.acceptQuote(user.sub, id, dto.quoteVersionId);
  }

  // E-admin-platform-3: clientul cere firmei prelungirea unei oferte EXPIRED (idempotent).
  @Post(':id/request-extension')
  @HttpCode(200)
  @Audit('QUOTE_EXTENSION_REQUESTED', 'quote')
  requestExtension(@CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.requestExtension(user.sub, id);
  }

  @Post('consultation-invites/:inviteId/respond')
  @Audit('CONSULTATION_RESPONDED', 'consultation_invite')
  respondInvite(
    @CurrentUser() user: AccessTokenPayload,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
    @Body() dto: RespondConsultationInviteDto,
  ) {
    return this.quotes.respondConsultationInvite(user.sub, inviteId, dto);
  }
}
