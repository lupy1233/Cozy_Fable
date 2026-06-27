import {
  Body,
  Controller,
  Get,
  Header,
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
  CreateConsultationInviteDto,
  CreateQuoteDto,
  ExtendValidityDto,
  ExtraQuoteVersionDto,
  PresignQuoteAttachmentDto,
  RequestQuoteChangeDto,
  RespondConsultationInviteDto,
  ReviseQuoteDto,
} from './dto/quote.dto';

// Ofertare — firma (4.13). Membru non-managed; permisiunile pe campuri se verifica in service.
@Controller('quotes')
@Roles(UserRole.COMPANY_USER)
@UseGuards(CompanyApprovedGuard)
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly pdf: QuotePdfService,
  ) {}

  // POST critic — Idempotency-Key (invarianta 3.2).
  @Post()
  @Idempotent()
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
    @Param('claimSlotId', ParseUUIDPipe) claimSlotId: string,
  ) {
    return this.quotes.getClaimContext(ctx, claimSlotId);
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
  @Idempotent()
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
  @Idempotent()
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
  @Idempotent()
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
  extend(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendValidityDto,
  ) {
    return this.quotes.extendValidity(ctx, user.sub, id, dto);
  }

  @Post(':id/withdraw')
  withdraw(@CurrentCompany() ctx: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.withdrawQuote(ctx, id);
  }

  @Post(':id/end-negotiation')
  endNegotiation(@CurrentCompany() ctx: CompanyContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.endNegotiation(ctx, id);
  }

  @Post(':id/changes/:changeId/reject')
  rejectChange(
    @CurrentCompany() ctx: CompanyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('changeId', ParseUUIDPipe) changeId: string,
  ) {
    return this.quotes.rejectChange(ctx, id, changeId);
  }

  @Post(':id/consultation-invites')
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
  requestChange(@CurrentUser() user: AccessTokenPayload, @Body() dto: RequestQuoteChangeDto) {
    return this.quotes.requestChange(user.sub, dto);
  }

  @Post(':id/accept')
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  accept(@CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.acceptQuote(user.sub, id);
  }

  @Post('consultation-invites/:inviteId/respond')
  respondInvite(
    @CurrentUser() user: AccessTokenPayload,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
    @Body() dto: RespondConsultationInviteDto,
  ) {
    return this.quotes.respondConsultationInvite(user.sub, inviteId, dto);
  }
}
