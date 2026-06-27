import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, type NotificationDto, type UnreadCountDto } from '@marketplace/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Persista o notificare per destinatar (apelat de processor-ul cozii de notificari).
  async createForUsers(
    userIds: string[],
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (userIds.length === 0) return;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        payload: payload as Prisma.InputJsonValue,
      })),
    });
  }

  async listForUser(userId: string): Promise<NotificationDto[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      payload: (n.payload as Record<string, unknown> | null) ?? null,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async unreadCount(userId: string): Promise<UnreadCountDto> {
    const unread = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return { unread };
  }

  async markRead(userId: string, id: string): Promise<void> {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== userId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Notification not found' });
    }
    if (n.readAt) return;
    await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  // Guard de tip: aruncat daca cineva incearca sa marcheze notificarea altcuiva (defensiv).
  assertOwner(ownerId: string, userId: string): void {
    if (ownerId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not your notification' });
    }
  }
}
