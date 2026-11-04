import { Injectable, NotFoundException } from '@nestjs/common';
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
    eventId?: string,
  ): Promise<void> {
    if (userIds.length === 0) return;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        payload: payload as Prisma.InputJsonValue,
        eventId,
      })),
      skipDuplicates: true,
    });
  }

  async pendingEmailRecipients(eventId: string, userIds: string[]): Promise<string[]> {
    const rows = await this.prisma.notification.findMany({ where: { eventId, userId: { in: userIds }, emailDeliveredAt: null }, select: { userId: true } });
    return rows.map((row) => row.userId);
  }

  async markEmailDelivered(eventId: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { eventId, userId, emailDeliveredAt: null }, data: { emailDeliveredAt: new Date() } });
  }

  async completeEvent(eventId: string): Promise<void> {
    await this.prisma.domainEventOutbox.updateMany({ where: { id: eventId, completedAt: null }, data: { completedAt: new Date() } });
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
}
