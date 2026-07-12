import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsString, IsUUID, Length } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { NotificationsService } from './notifications.service';
import { NotificationEmailsService } from './notification-emails.service';

class EmailPreferenceDto {
  @IsBoolean()
  enabled: boolean;
}

// Dezabonare din link-ul de email (fara login) — semnatura HMAC valideaza cererea.
class UnsubscribeDto {
  @IsUUID()
  uid: string;

  @IsString()
  @Length(64, 64)
  sig: string;
}

// Notificari in-app pentru orice utilizator autentificat (client/firma/admin).
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly emails: NotificationEmailsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.notifications.listForUser(user.sub);
  }

  @Get('unread-count')
  unread(@CurrentUser() user: AccessTokenPayload) {
    return this.notifications.unreadCount(user.sub);
  }

  // preferinta de emailuri (Q4, idee 5): opt-out global per utilizator
  @Get('email-preference')
  emailPreference(@CurrentUser() user: AccessTokenPayload) {
    return this.emails.getPreference(user.sub);
  }

  @Patch('email-preference')
  setEmailPreference(@CurrentUser() user: AccessTokenPayload, @Body() dto: EmailPreferenceDto) {
    return this.emails.setPreference(user.sub, dto.enabled);
  }

  // dezabonare din email, fara login (link semnat HMAC in footer)
  @Public()
  @Post('unsubscribe')
  async unsubscribe(@Body() dto: UnsubscribeDto) {
    const ok = await this.emails.unsubscribe(dto.uid, dto.sig);
    return { ok };
  }

  @Post(':id/read')
  read(@CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user.sub, id);
  }

  @Post('read-all')
  readAll(@CurrentUser() user: AccessTokenPayload) {
    return this.notifications.markAllRead(user.sub);
  }
}
