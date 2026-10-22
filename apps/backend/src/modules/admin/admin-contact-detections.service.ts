import { Injectable } from '@nestjs/common';
import type {
  AdminContactDetectionPageDto,
  ContactDetectionAction,
  ContactDetectionField,
  ContactDetectionTrigger,
  ContactMatchKind,
} from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// E-admin-platform-45 (F2-16): logul datelor de contact gasite in texte libere.
// Doar citire; fragmentele sunt deja partial ascunse la scriere. Adminul vede titlul
// real al cererii (inclusiv cererile sterse, marcate requestDeleted).
@Injectable()
export class AdminContactDetectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: { page?: number; pageSize?: number; requestId?: string }): Promise<AdminContactDetectionPageDto> {
    const pageSize = Math.min(Math.max(query.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const page = Math.max(query.page ?? 1, 1);
    const where = query.requestId ? { requestId: query.requestId } : {};
    const [rows, total] = await Promise.all([
      this.prisma.requestContactDetection.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { request: { select: { title: true, status: true, deletedAt: true } } },
      }),
      this.prisma.requestContactDetection.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        requestId: r.requestId,
        requestTitle: r.request.title ?? '',
        requestStatus: r.request.status,
        requestDeleted: r.request.deletedAt !== null,
        trigger: r.trigger as ContactDetectionTrigger,
        field: r.field as ContactDetectionField,
        roomType: r.roomType,
        stepId: r.stepId,
        kinds: r.kinds as ContactMatchKind[],
        excerpt: r.excerpt,
        action: r.action as ContactDetectionAction,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }
}
