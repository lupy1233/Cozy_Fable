import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Language } from '@prisma/client';
import { MailService } from '../../infra/mail/mail.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

// Q4 (idee 5 PO r2): emailuri pentru cele TREI evenimente aprobate — oferta
// noua, mesaj nou, cerere preluata. Trimise din worker-ul cozii de notificari
// (nu blocheaza requestul); esecul unui email NU esueaza jobul (altfel retry-ul
// ar duplica notificarile in-app). Opt-out: users.email_notifications_enabled,
// cu link de dezabonare semnat HMAC in footer (fara login).

const EMAILED_EVENTS = new Set(['quote.created', 'message.created', 'claim.created']);

interface EmailContent {
  subject: string;
  intro: string;
  cta: string;
  path: string;
}

@Injectable()
export class NotificationEmailsService {
  private readonly logger = new Logger(NotificationEmailsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  // --- dezabonare semnata (fara login) ---

  signUnsubscribe(userId: string): string {
    const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    return createHmac('sha256', secret).update(`unsubscribe:${userId}`).digest('hex');
  }

  verifyUnsubscribe(userId: string, sig: string): boolean {
    const expected = this.signUnsubscribe(userId);
    if (sig.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  }

  async unsubscribe(userId: string, sig: string): Promise<boolean> {
    if (!this.verifyUnsubscribe(userId, sig)) return false;
    await this.prisma.user.updateMany({
      where: { id: userId },
      data: { emailNotificationsEnabled: false },
    });
    return true;
  }

  async getPreference(userId: string): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailNotificationsEnabled: true },
    });
    return { enabled: user?.emailNotificationsEnabled ?? true };
  }

  async setPreference(userId: string, enabled: boolean): Promise<{ enabled: boolean }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailNotificationsEnabled: enabled },
    });
    return { enabled };
  }

  // --- trimiterea per eveniment ---

  async sendForEvent(
    type: string,
    targets: string[],
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!EMAILED_EVENTS.has(type) || targets.length === 0) return;

    // cerere preluata / oferta noua → DOAR clientul; mesaj nou → doar partea
    // CEALALTA a conversatiei (colegii expeditorului nu primesc email pentru
    // mesajul propriei firme; in-app ramane pentru toti)
    let recipients = targets;
    const clientUserId = typeof payload.clientUserId === 'string' ? payload.clientUserId : null;
    if (type === 'claim.created' || type === 'quote.created') {
      recipients = clientUserId ? [clientUserId] : [];
    } else if (type === 'message.created') {
      recipients =
        payload.senderRole === 'COMPANY'
          ? clientUserId
            ? [clientUserId]
            : []
          : targets.filter((id) => id !== payload.senderUserId && id !== clientUserId);
    }
    if (recipients.length === 0) return;

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: recipients },
        deletedAt: null,
        emailNotificationsEnabled: true,
        emailVerifiedAt: { not: null },
      },
      select: { id: true, email: true, name: true, languagePreference: true },
    });
    if (users.length === 0) return;

    const origin = this.config.getOrThrow<string>('FRONTEND_ORIGIN');
    for (const user of users) {
      const lang = user.languagePreference === Language.EN ? 'en' : 'ro';
      const content = this.buildContent(type, payload, lang, user.id);
      if (!content) continue;
      const html = this.wrapHtml(user, content, origin, lang);
      try {
        await this.mail.send(user.email, content.subject, html);
      } catch (e) {
        // best-effort: notificarea in-app exista deja; nu esuam jobul
        this.logger.warn(`email ${type} catre ${user.id} a esuat: ${(e as Error).message}`);
      }
    }
  }

  private buildContent(
    type: string,
    payload: Record<string, unknown>,
    lang: 'ro' | 'en',
    recipientId: string,
  ): EmailContent | null {
    const requestTitle = String(payload.requestTitle ?? '');
    const companyName = String(payload.companyName ?? '');
    const requestId = String(payload.requestId ?? '');
    const ro = lang === 'ro';

    switch (type) {
      case 'quote.created':
        return {
          subject: ro
            ? `Ofertă nouă la cererea ta — ${requestTitle}`
            : `New offer on your request — ${requestTitle}`,
          intro: ro
            ? `Atelierul <strong>${companyName}</strong> ți-a trimis o ofertă pentru „${requestTitle}”.`
            : `Workshop <strong>${companyName}</strong> sent you an offer for “${requestTitle}”.`,
          cta: ro ? 'Vezi oferta' : 'View the offer',
          path: `/${lang}/requests/${requestId}/offers`,
        };
      case 'claim.created':
        return {
          subject: ro
            ? `Cererea ta a fost preluată — ${requestTitle}`
            : `Your request was claimed — ${requestTitle}`,
          intro: ro
            ? `Atelierul <strong>${companyName}</strong> a preluat cererea ta „${requestTitle}” și o poate oferta.`
            : `Workshop <strong>${companyName}</strong> claimed your request “${requestTitle}” and can now quote it.`,
          cta: ro ? 'Vezi conversațiile' : 'View conversations',
          path: `/${lang}/requests/${requestId}/offers`,
        };
      case 'message.created': {
        const fromCompany = payload.senderRole === 'COMPANY';
        // clientul primeste link la conversatiile cererii; firma la revendicari
        const isClientRecipient = fromCompany || payload.clientUserId === recipientId;
        return {
          subject: ro
            ? `Mesaj nou — ${fromCompany ? companyName : requestTitle}`
            : `New message — ${fromCompany ? companyName : requestTitle}`,
          intro: ro
            ? fromCompany
              ? `Ai un mesaj nou de la <strong>${companyName}</strong> la cererea „${requestTitle}”.`
              : `Ai un mesaj nou de la client la cererea „${requestTitle}”.`
            : fromCompany
              ? `You have a new message from <strong>${companyName}</strong> on “${requestTitle}”.`
              : `You have a new message from the client on “${requestTitle}”.`,
          cta: ro ? 'Deschide conversația' : 'Open the conversation',
          path: isClientRecipient
            ? `/${lang}/requests/${requestId}/offers`
            : `/${lang}/marketplace/claims`,
        };
      }
      default:
        return null;
    }
  }

  private wrapHtml(
    user: { id: string; name: string },
    content: EmailContent,
    origin: string,
    lang: 'ro' | 'en',
  ): string {
    const ro = lang === 'ro';
    const link = `${origin}${content.path}`;
    const unsubscribe = `${origin}/${lang}/unsubscribe?uid=${user.id}&sig=${this.signUnsubscribe(user.id)}`;
    return `
      <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #2b2b2b;">
        <p style="letter-spacing: 0.12em; font-size: 12px; color: #8a7355;">COZY HOME</p>
        <p>${ro ? 'Salut' : 'Hi'} ${user.name},</p>
        <p>${content.intro}</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background: #8a7355; color: #fff; padding: 10px 22px; text-decoration: none; border-radius: 999px;">
            ${content.cta}
          </a>
        </p>
        <p style="font-size: 12px; color: #888;">
          ${ro ? 'Sau deschide direct:' : 'Or open directly:'} <a href="${link}">${link}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e5ded4; margin: 28px 0 12px;" />
        <p style="font-size: 11px; color: #999;">
          ${
            ro
              ? 'Primești acest email pentru notificările contului tău Cozy Home.'
              : 'You receive this email for your Cozy Home account notifications.'
          }
          <a href="${unsubscribe}" style="color: #999;">${ro ? 'Dezabonează-te' : 'Unsubscribe'}</a>
        </p>
      </div>`;
  }
}
