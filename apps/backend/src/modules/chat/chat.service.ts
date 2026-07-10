import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ERROR_CODES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  type ChatThreadDto,
  type MessageDto,
  type PresignUploadResultDto,
  type SendMessageInput,
} from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { UploadsService, type PresignInput } from '../uploads/uploads.service';

const ATTACHMENT_ENTITY = 'MESSAGE';

interface ThreadContext {
  threadId: string;
  claimSlotId: string;
  requestId: string;
  requestTitle: string;
  companyId: string;
  companyName: string;
  clientUserId: string | null;
  readOnly: boolean;
  negotiationEndedByCompany: boolean;
}

// Sprint 6 — chat post-claim (4.14). Mesajele si evenimentele realtime sunt private:
// se emit DOAR catre participanti (client + membrii firmei), prin EventBusService (3.5).
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly eventBus: EventBusService,
  ) {}

  // --- autorizare participant ---

  // Client: detine cererea. Firma: e membru al firmei care a dat claim-ul.
  private async loadThreadForUser(
    threadId: string,
    userId: string,
    role: 'CLIENT' | 'COMPANY',
    companyId?: string,
  ): Promise<ThreadContext> {
    const thread = await this.prisma.chatThread.findUnique({
      where: { id: threadId },
      include: { claimSlot: { include: { request: true, company: true } } },
    });
    if (!thread) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Thread not found' });
    }
    const slot = thread.claimSlot;
    const ctx: ThreadContext = {
      threadId: thread.id,
      claimSlotId: slot.id,
      requestId: slot.requestId,
      requestTitle: slot.request.title ?? '',
      companyId: slot.companyId,
      companyName: slot.company.name,
      clientUserId: slot.request.clientUserId,
      readOnly: thread.readOnly,
      negotiationEndedByCompany: thread.negotiationEndedByCompany,
    };
    if (role === 'CLIENT') {
      if (ctx.clientUserId !== userId) {
        throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not your thread' });
      }
    } else {
      if (!companyId || ctx.companyId !== companyId) {
        throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not your thread' });
      }
    }
    return ctx;
  }

  // Participantii thread-ului = client (daca exista) + toti membrii firmei (emisie realtime).
  private async participantUserIds(ctx: ThreadContext): Promise<string[]> {
    const members = await this.prisma.companyMember.findMany({
      where: { companyId: ctx.companyId },
      select: { userId: true },
    });
    const ids = members.map((m) => m.userId);
    if (ctx.clientUserId) ids.push(ctx.clientUserId);
    return ids;
  }

  // --- liste ---

  // include comun: relatiile pentru DTO + ultimul mesaj (preview conversatie)
  private readonly threadInclude = {
    claimSlot: { include: { request: true, company: true } },
    messages: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  };

  async listThreadsForClient(userId: string): Promise<ChatThreadDto[]> {
    const threads = await this.prisma.chatThread.findMany({
      where: { claimSlot: { request: { clientUserId: userId } } },
      include: this.threadInclude,
      orderBy: { createdAt: 'desc' },
    });
    return threads.map((t) => this.toThreadDto(t));
  }

  async listThreadsForCompany(companyId: string): Promise<ChatThreadDto[]> {
    const threads = await this.prisma.chatThread.findMany({
      where: { claimSlot: { companyId } },
      include: this.threadInclude,
      orderBy: { createdAt: 'desc' },
    });
    return threads.map((t) => this.toThreadDto(t));
  }

  async listMessages(
    threadId: string,
    userId: string,
    role: 'CLIENT' | 'COMPANY',
    companyId?: string,
  ): Promise<MessageDto[]> {
    await this.loadThreadForUser(threadId, userId, role, companyId);
    const messages = await this.prisma.message.findMany({
      where: { chatThreadId: threadId },
      orderBy: { createdAt: 'asc' },
    });
    return this.mapMessages(messages, userId);
  }

  // --- trimitere mesaj ---

  async sendMessage(
    threadId: string,
    userId: string,
    role: 'CLIENT' | 'COMPANY',
    dto: SendMessageInput,
    companyId?: string,
  ): Promise<MessageDto> {
    const ctx = await this.loadThreadForUser(threadId, userId, role, companyId);
    if (ctx.readOnly) {
      throw new HttpException(
        { code: ERROR_CODES.THREAD_READ_ONLY, message: 'Thread is read-only' },
        409,
      );
    }
    const body = dto.body?.trim() || null;
    const attachmentIds = dto.attachmentIds ?? [];
    if (!body && attachmentIds.length === 0) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Message needs text or attachment',
      });
    }
    if (attachmentIds.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      throw new BadRequestException({
        code: ERROR_CODES.FILE_LIMIT_REACHED,
        message: 'Too many attachments',
      });
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { chatThreadId: threadId, senderUserId: userId, body },
      });
      if (attachmentIds.length > 0) {
        // muta atasamentele din bucket-ul thread-ului pe mesajul nou.
        await this.uploads.relink(attachmentIds, ATTACHMENT_ENTITY, threadId, created.id, tx);
      }
      // last_client_message_at (folosit de CLIENT_UNRESPONSIVE_48H, 4.15 Sprint 7).
      if (role === 'CLIENT') {
        await tx.chatThread.update({
          where: { id: threadId },
          data: { lastClientMessageAt: created.createdAt },
        });
      }
      return created;
    });

    const [dtoMsg] = await this.mapMessages([message], userId);
    const targets = await this.participantUserIds(ctx);
    // payload cu context afisabil (titlul cererii + firma + rolul expeditorului):
    // notificarile pot construi un titlu clar si un deep-link (item 5)
    await this.eventBus.publish(
      'message.created',
      {
        threadId,
        messageId: message.id,
        senderUserId: userId,
        senderRole: role,
        requestId: ctx.requestId,
        requestTitle: ctx.requestTitle,
        companyName: ctx.companyName,
      },
      targets,
    );
    return dtoMsg;
  }

  // --- upload in chat (presigned, 3.4; bucket temporar = threadId) ---

  async presignAttachment(
    threadId: string,
    userId: string,
    role: 'CLIENT' | 'COMPANY',
    input: PresignInput,
    companyId?: string,
  ): Promise<PresignUploadResultDto> {
    const ctx = await this.loadThreadForUser(threadId, userId, role, companyId);
    if (ctx.readOnly) {
      throw new HttpException(
        { code: ERROR_CODES.THREAD_READ_ONLY, message: 'Thread is read-only' },
        409,
      );
    }
    return this.uploads.presign(ATTACHMENT_ENTITY, threadId, input, MAX_ATTACHMENTS_PER_MESSAGE);
  }

  async confirmAttachment(
    threadId: string,
    attachmentId: string,
    userId: string,
    role: 'CLIENT' | 'COMPANY',
    companyId?: string,
  ) {
    await this.loadThreadForUser(threadId, userId, role, companyId);
    return this.uploads.confirm(ATTACHMENT_ENTITY, threadId, attachmentId);
  }

  // --- mapping ---

  private async mapMessages(
    messages: { id: string; chatThreadId: string; senderUserId: string; body: string | null; createdAt: Date }[],
    viewerUserId: string,
  ): Promise<MessageDto[]> {
    const senderIds = [...new Set(messages.map((m) => m.senderUserId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    return Promise.all(
      messages.map(async (m) => ({
        id: m.id,
        chatThreadId: m.chatThreadId,
        senderUserId: m.senderUserId,
        senderName: nameById.get(m.senderUserId) ?? 'Utilizator',
        isMine: m.senderUserId === viewerUserId,
        body: m.body,
        attachments: await this.uploads.listForEntity(ATTACHMENT_ENTITY, m.id),
        createdAt: m.createdAt.toISOString(),
      })),
    );
  }

  private toThreadDto(t: {
    id: string;
    claimSlotId: string;
    readOnly: boolean;
    negotiationEndedByCompany: boolean;
    createdAt: Date;
    claimSlot: {
      requestId: string;
      companyId: string;
      status: string;
      request: { title: string | null; clientUserId: string | null };
      company: { name: string };
    };
    messages: { body: string | null; senderUserId: string; createdAt: Date }[];
  }): ChatThreadDto {
    const last = t.messages[0];
    return {
      id: t.id,
      claimSlotId: t.claimSlotId,
      requestId: t.claimSlot.requestId,
      requestTitle: t.claimSlot.request.title ?? '',
      companyId: t.claimSlot.companyId,
      companyName: t.claimSlot.company.name,
      readOnly: t.readOnly,
      negotiationEndedByCompany: t.negotiationEndedByCompany,
      claimStatus: t.claimSlot.status,
      lastMessage: last
        ? {
            body: last.body,
            senderRole:
              last.senderUserId === t.claimSlot.request.clientUserId ? 'CLIENT' : 'COMPANY',
            createdAt: last.createdAt.toISOString(),
          }
        : null,
      createdAt: t.createdAt.toISOString(),
    };
  }
}
