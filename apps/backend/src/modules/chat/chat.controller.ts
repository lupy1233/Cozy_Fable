import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { CompanyApprovedGuard } from '../../common/guards/company-approved.guard';
import { CurrentCompany } from '../../common/company-context/current-company.decorator';
import type { CompanyContext } from '../../common/company-context/company-context';
import { ChatService } from './chat.service';
import { PresignChatAttachmentDto, SendMessageDto } from './dto/chat.dto';

// Chat client (4.14). Clientul autentificat care detine cererea (request.client_user_id).
@Controller('chat')
@Roles(UserRole.CLIENT)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('threads')
  listThreads(@CurrentUser() user: AccessTokenPayload) {
    return this.chat.listThreadsForClient(user.sub);
  }

  @Get('threads/:id/messages')
  listMessages(@CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.listMessages(id, user.sub, 'CLIENT');
  }

  @Post('threads/:id/messages')
  send(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.sendMessage(id, user.sub, 'CLIENT', dto);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:id/attachments')
  presign(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignChatAttachmentDto,
  ) {
    return this.chat.presignAttachment(id, user.sub, 'CLIENT', dto);
  }

  @Post('threads/:id/attachments/:attachmentId/confirm')
  confirm(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.chat.confirmAttachment(id, attachmentId, user.sub, 'CLIENT');
  }
}

// Chat firma (4.14). Membru al firmei care a dat claim-ul.
@Controller('company/chat')
@Roles(UserRole.COMPANY_USER)
@UseGuards(CompanyApprovedGuard)
export class CompanyChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('threads')
  listThreads(@CurrentCompany() ctx: CompanyContext) {
    return this.chat.listThreadsForCompany(ctx.companyId);
  }

  @Get('threads/:id/messages')
  listMessages(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chat.listMessages(id, user.sub, 'COMPANY', ctx.companyId);
  }

  @Post('threads/:id/messages')
  send(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.sendMessage(id, user.sub, 'COMPANY', dto, ctx.companyId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('threads/:id/attachments')
  presign(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignChatAttachmentDto,
  ) {
    return this.chat.presignAttachment(id, user.sub, 'COMPANY', dto, ctx.companyId);
  }

  @Post('threads/:id/attachments/:attachmentId/confirm')
  confirm(
    @CurrentCompany() ctx: CompanyContext,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.chat.confirmAttachment(id, attachmentId, user.sub, 'COMPANY', ctx.companyId);
  }
}
