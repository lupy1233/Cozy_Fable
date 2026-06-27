import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { NotificationsService } from './notifications.service';

// Notificari in-app pentru orice utilizator autentificat (client/firma/admin).
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.notifications.listForUser(user.sub);
  }

  @Get('unread-count')
  unread(@CurrentUser() user: AccessTokenPayload) {
    return this.notifications.unreadCount(user.sub);
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
