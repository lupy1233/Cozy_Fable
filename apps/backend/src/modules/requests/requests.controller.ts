import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { AccessTokenPayload } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CreateRequestContentDto,
  PatchDraftDto,
  PresignAttachmentDto,
} from './dto/request.dto';
import { RequestsService } from './requests.service';

@Controller('requests')
@UseGuards(OptionalJwtAuthGuard)
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  // --- flux draft anonim cu token (Public; legat de client daca e logat) ---

  @Public()
  @Post('drafts')
  createDraft(@CurrentUser() user: AccessTokenPayload | undefined, @Body() dto: PatchDraftDto) {
    return this.requests.createDraft(user?.sub ?? null, dto);
  }

  @Public()
  @Get('drafts/:token')
  getDraft(@Param('token') token: string) {
    return this.requests.getDraft(token);
  }

  @Public()
  @Patch('drafts/:token')
  patchDraft(@Param('token') token: string, @Body() dto: PatchDraftDto) {
    return this.requests.patchDraft(token, dto);
  }

  // Publicarea necesita autentificare (decizie: "fill as guest, login to publish").
  // Ruta ramane sub OptionalJwtAuthGuard ca sa putem returna o eroare clara daca
  // utilizatorul nu e logat; serviciul leaga draftul anonim de contul care publica.
  @Public()
  @Post('drafts/:token/publish')
  publish(
    @CurrentUser() user: AccessTokenPayload | undefined,
    @Param('token') token: string,
    @Body() dto: CreateRequestContentDto,
  ) {
    return this.requests.publish(token, dto, user?.sub ?? null);
  }

  @Public()
  @Post('drafts/:token/edit')
  edit(@Param('token') token: string, @Body() dto: CreateRequestContentDto) {
    return this.requests.edit(token, dto);
  }

  @Public()
  @Post('drafts/:token/repost')
  repost(@Param('token') token: string) {
    return this.requests.repost(token);
  }

  // --- atasamente (Public, scope-uite pe token) ---

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('drafts/:token/attachments')
  presignAttachment(@Param('token') token: string, @Body() dto: PresignAttachmentDto) {
    return this.requests.presignAttachment(token, dto);
  }

  @Public()
  @Post('drafts/:token/attachments/:attachmentId/confirm')
  confirmAttachment(
    @Param('token') token: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.requests.confirmAttachment(token, attachmentId);
  }

  @Public()
  @Delete('drafts/:token/attachments/:attachmentId')
  removeAttachment(
    @Param('token') token: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.requests.removeAttachment(token, attachmentId);
  }

  // --- liste client autenticat ---

  @Roles(UserRole.CLIENT)
  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.requests.listForClient(user.sub);
  }

  // ATENTIE la ordine: ruta statica trebuie declarata INAINTE de @Get(':id').
  @Roles(UserRole.CLIENT)
  @Get('dashboard-stats')
  dashboardStats(@CurrentUser() user: AccessTokenPayload) {
    return this.requests.dashboardStatsForClient(user.sub);
  }

  @Roles(UserRole.CLIENT)
  @Get(':id')
  getOne(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.requests.getForClient(user.sub, id);
  }

  // Editare autentificata (proprietar, orice device — tokenul draftului e doar hash).
  @Roles(UserRole.CLIENT)
  @Post(':id/edit')
  editById(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: CreateRequestContentDto,
  ) {
    return this.requests.editForClient(user.sub, id, dto);
  }

  // Atasamente pe cererea proprie (echivalentul autentificat al rutelor cu token).
  @Roles(UserRole.CLIENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':id/attachments')
  presignAttachmentById(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: PresignAttachmentDto,
  ) {
    return this.requests.presignAttachmentForClient(user.sub, id, dto);
  }

  @Roles(UserRole.CLIENT)
  @Post(':id/attachments/:attachmentId/confirm')
  confirmAttachmentById(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.requests.confirmAttachmentForClient(user.sub, id, attachmentId);
  }

  @Roles(UserRole.CLIENT)
  @Delete(':id/attachments/:attachmentId')
  removeAttachmentById(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.requests.removeAttachmentForClient(user.sub, id, attachmentId);
  }

  // Î17 — clientul sterge cererea (soft delete + anulare claim-uri + refund).
  @Roles(UserRole.CLIENT)
  @Delete(':id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.requests.deleteForClient(user.sub, id);
  }
}
