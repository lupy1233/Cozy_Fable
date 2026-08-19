import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ERROR_CODES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  type ChatThreadDto,
  type MessageDto,
  type PresignUploadResultDto,
  type SendMessageInput,
  type TeamThreadDto,
} from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { EventBusService } from '../../infra/event-bus/event-bus.service';
import { UploadsService, type PresignInput } from '../uploads/uploads.service';
import { MessageCryptoService } from './message-crypto.service';

const ATTACHMENT_ENTITY = 'MESSAGE';

// Context comun pentru ambele tipuri de thread (PO r6): CLAIM (client ↔ firma,
// campurile cererii setate) si TEAM (chat intern de firma — fara cerere/client).
interface ThreadContext {
  threadId: string;
  threadType: 'CLAIM' | 'TEAM';
  claimSlotId: string | null;
  requestId: string | null;
  requestTitle: string | null;
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
    private readonly crypto: MessageCryptoService,
  ) {}

  // --- autorizare participant ---

  // Client: detine cererea (doar threaduri CLAIM). Firma: e membru al firmei
  // care a dat claim-ul, respectiv al firmei threadului TEAM.
  private async loadThreadForUser(
    threadId: string,
    userId: string,
    role: 'CLIENT' | 'COMPANY',
    companyId?: string,
  ): Promise<ThreadContext> {
    const thread = await this.prisma.chatThread.findUnique({
      where: { id: threadId },
      include: {
        claimSlot: { include: { request: true, company: true } },
        company: { select: { name: true } },
      },
    });
    if (!thread) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Thread not found' });
    }

    if (thread.threadType === 'TEAM') {
      // chatul intern: DOAR membrii firmei; clientii nu au ce cauta aici
      if (role !== 'COMPANY' || !companyId || thread.companyId !== companyId) {
        throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not your thread' });
      }
      return {
        threadId: thread.id,
        threadType: 'TEAM',
        claimSlotId: null,
        requestId: null,
        requestTitle: null,
        companyId: thread.companyId,
        companyName: thread.company?.name ?? '',
        clientUserId: null,
        readOnly: thread.readOnly,
        negotiationEndedByCompany: false,
      };
    }

    const slot = thread.claimSlot;
    if (!slot) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Thread not found' });
    }
    const ctx: ThreadContext = {
      threadId: thread.id,
      threadType: 'CLAIM',
      claimSlotId: slot.id,
      requestId: slot.requestId,
      requestTitle: slot.request.title ?? '',
      companyId: slot.companyId,
      companyName: slot.company.name,
      clientUserId: slot.request.clientUserId,
      // cerere stearsa de client (soft delete 3.12) → conversatia e inchisa (L0-B)
      readOnly: thread.readOnly || slot.request.deletedAt !== null,
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
      where: { threadType: 'CLAIM', claimSlot: { request: { clientUserId: userId } } },
      include: this.threadInclude,
      orderBy: { createdAt: 'desc' },
    });
    const unread = await this.unreadByThread(threads.map((t) => t.id), userId);
    return this.toThreadDtos(threads, unread);
  }

  async listThreadsForCompany(companyId: string, userId: string): Promise<ChatThreadDto[]> {
    const threads = await this.prisma.chatThread.findMany({
      where: { threadType: 'CLAIM', claimSlot: { companyId } },
      include: this.threadInclude,
      orderBy: { createdAt: 'desc' },
    });
    const unread = await this.unreadByThread(threads.map((t) => t.id), userId);
    return this.toThreadDtos(threads, unread);
  }

  // Chatul intern al firmei (PO r6): un singur thread TEAM per firma, creat
  // la prima accesare (upsert pe company_id unique — sigur la accese paralele).
  async getTeamThread(companyId: string, userId: string): Promise<TeamThreadDto> {
    const thread = await this.prisma.chatThread.upsert({
      where: { companyId },
      update: {},
      create: { companyId, threadType: 'TEAM' },
    });
    const unread = await this.unreadByThread([thread.id], userId);
    return { id: thread.id, unreadCount: unread.get(thread.id) ?? 0 };
  }

  // Necitite per thread pentru utilizatorul curent (idee 1 PO r2): mesajele
  // ALTORA mai noi decat chat_thread_reads.last_read_at (sau toate, fara rand).
  // O singura interogare pentru toata lista.
  private async unreadByThread(
    threadIds: string[],
    userId: string,
  ): Promise<Map<string, number>> {
    if (threadIds.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<{ chat_thread_id: string; unread: number }[]>`
      SELECT m.chat_thread_id, COUNT(*)::int AS unread
      FROM messages m
      LEFT JOIN chat_thread_reads r
        ON r.chat_thread_id = m.chat_thread_id AND r.user_id = ${userId}
      WHERE m.chat_thread_id IN (${Prisma.join(threadIds)})
        AND m.sender_user_id <> ${userId}
        AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
      GROUP BY m.chat_thread_id
    `;
    return new Map(rows.map((r) => [r.chat_thread_id, r.unread]));
  }

  // Marcheaza conversatia citita "pana acum" pentru utilizatorul curent.
  async markThreadRead(
    threadId: string,
    userId: string,
    role: 'CLIENT' | 'COMPANY',
    companyId?: string,
  ): Promise<void> {
    await this.loadThreadForUser(threadId, userId, role, companyId);
    const now = new Date();
    await this.prisma.chatThreadRead.upsert({
      where: { chatThreadId_userId: { chatThreadId: threadId, userId } },
      create: { chatThreadId: threadId, userId, lastReadAt: now },
      update: { lastReadAt: now },
    });
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
      // corpul se cripteaza la stocare (PO r6) — DTO-ul intoarce mereu clarul
      const created = await tx.message.create({
        data: { chatThreadId: threadId, senderUserId: userId, body: this.crypto.encrypt(body) },
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
    // notificarile pot construi un titlu clar si un deep-link (item 5).
    // TEAM: fara cerere/client → emailul de "mesaj nou" nu pleaca (clientUserId
    // null), notificarile in-app merg la ceilalti membri.
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
        teamChat: ctx.threadType === 'TEAM',
        // emailul de "mesaj nou" merge doar la partea cealalta (Q4, idee 5)
        clientUserId: ctx.clientUserId,
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
        // stocat criptat (PO r6); mesajele istorice in clar trec neatinse
        body: this.crypto.decrypt(m.body),
        attachments: await this.uploads.listForEntity(ATTACHMENT_ENTITY, m.id),
        createdAt: m.createdAt.toISOString(),
      })),
    );
  }

  // listele expun DOAR threadurile CLAIM (where-ul filtreaza threadType);
  // guard-ul pe claimSlot exista pentru tipul Prisma (nullable dupa PO r6)
  private toThreadDtos(
    threads: Array<{
      id: string;
      claimSlotId: string | null;
      readOnly: boolean;
      negotiationEndedByCompany: boolean;
      createdAt: Date;
      claimSlot: {
        requestId: string;
        companyId: string;
        status: string;
        request: { title: string | null; clientUserId: string | null };
        company: { name: string };
      } | null;
      messages: { body: string | null; senderUserId: string; createdAt: Date }[];
    }>,
    unread: Map<string, number>,
  ): ChatThreadDto[] {
    return threads.flatMap((t) => {
      const slot = t.claimSlot;
      if (!slot || !t.claimSlotId) return [];
      const last = t.messages[0];
      return [
        {
          id: t.id,
          claimSlotId: t.claimSlotId,
          requestId: slot.requestId,
          requestTitle: slot.request.title ?? '',
          companyId: slot.companyId,
          companyName: slot.company.name,
          readOnly: t.readOnly,
          negotiationEndedByCompany: t.negotiationEndedByCompany,
          claimStatus: slot.status,
          unreadCount: unread.get(t.id) ?? 0,
          lastMessage: last
            ? {
                body: this.crypto.decrypt(last.body),
                senderRole: (last.senderUserId === slot.request.clientUserId
                  ? 'CLIENT'
                  : 'COMPANY') as 'CLIENT' | 'COMPANY',
                createdAt: last.createdAt.toISOString(),
              }
            : null,
          createdAt: t.createdAt.toISOString(),
        },
      ];
    });
  }
}
