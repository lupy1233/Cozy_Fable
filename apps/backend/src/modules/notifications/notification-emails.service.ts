import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Language } from '@prisma/client';
import { MailService } from '../../infra/mail/mail.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

// Emailuri pentru evenimentele de domeniu (Q4 + L1 audit 2026-08-23). Trimise din worker-ul
// cozii de notificari (nu blocheaza requestul); esecul unui email NU esueaza jobul (altfel
// retry-ul ar duplica notificarile in-app). Opt-out: users.email_notifications_enabled,
// cu link de dezabonare semnat HMAC in footer (fara login).
// REGULI (IMPACT eveniment nou): orice valoare interpolata trece prin esc(); terminologia
// este "firma", NU "atelier" (regula permanenta PO).

const EMAILED_EVENTS = new Set([
  'quote.created',
  'message.created',
  'claim.created',
  // L1 (audit 2026-08-23)
  'quote.accepted',
  'claim.withdrawn', // doar motivele cu pierdere de bani — vezi recipientsFor()
  'delivery.marked',
  'company.approved',
  'company.rejected',
  'company.suspended',
  'withdrawal.decided',
  'payment.confirmed',
  'subscription.expiring',
  'request.expired',
  // Pasul 5 (audit 2026-08-23)
  'delivery.autocompleted',
  'company.unsuspended',
]);

// claim.withdrawn: email DOAR cand firma pierde bani/puncte; restul raman pe clopotel.
const EMAILED_WITHDRAW_REASONS = new Set(['SLA_EXPIRED', 'REQUEST_ACCEPTED_OTHER_OFFER']);

// Anti HTML-injection in emailuri: numele firmelor/titlurile cererilor vin de la utilizatori.
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
    const recipients = await this.recipientsFor(type, targets, payload);
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

  // Cine primeste EMAIL (in-app primesc toate tintele; emailul e mai selectiv).
  private async recipientsFor(
    type: string,
    targets: string[],
    payload: Record<string, unknown>,
  ): Promise<string[]> {
    const clientUserId = typeof payload.clientUserId === 'string' ? payload.clientUserId : null;
    switch (type) {
      // cerere preluata / oferta noua → DOAR clientul
      case 'claim.created':
      case 'quote.created':
        return clientUserId ? [clientUserId] : [];
      // mesaj nou → doar partea CEALALTA a conversatiei
      case 'message.created':
        return payload.senderRole === 'COMPANY'
          ? clientUserId
            ? [clientUserId]
            : []
          : targets.filter((id) => id !== payload.senderUserId && id !== clientUserId);
      // oferta acceptata → membrii firmei CASTIGATOARE (clientul a facut chiar el actiunea)
      case 'quote.accepted': {
        const companyId = typeof payload.companyId === 'string' ? payload.companyId : null;
        if (!companyId) return [];
        const members = await this.prisma.companyMember.findMany({
          where: { companyId },
          select: { userId: true },
        });
        const memberIds = new Set(members.map((m) => m.userId));
        return targets.filter((id) => memberIds.has(id));
      }
      // inchidere de claim → email doar cand firma pierde bani/puncte
      case 'claim.withdrawn':
        return EMAILED_WITHDRAW_REASONS.has(String(payload.reason ?? '')) ? targets : [];
      default:
        return targets;
    }
  }

  private buildContent(
    type: string,
    payload: Record<string, unknown>,
    lang: 'ro' | 'en',
    recipientId: string,
  ): EmailContent | null {
    const requestTitle = esc(payload.requestTitle);
    const companyName = esc(payload.companyName);
    const requestId = String(payload.requestId ?? '');
    const claimSlotId = String(payload.claimSlotId ?? '');
    const ro = lang === 'ro';
    const claimsPath = claimSlotId
      ? `/${lang}/marketplace/claims/${claimSlotId}`
      : `/${lang}/marketplace/claims`;

    switch (type) {
      case 'quote.created':
        return {
          subject: ro
            ? `Ofertă nouă la cererea ta — ${requestTitle}`
            : `New offer on your request — ${requestTitle}`,
          intro: ro
            ? `Firma <strong>${companyName}</strong> ți-a trimis o ofertă pentru „${requestTitle}”.`
            : `The company <strong>${companyName}</strong> sent you an offer for “${requestTitle}”.`,
          cta: ro ? 'Vezi oferta' : 'View the offer',
          path: `/${lang}/requests/${requestId}/offers`,
        };
      case 'claim.created':
        return {
          subject: ro
            ? `Cererea ta a fost preluată — ${requestTitle}`
            : `Your request was claimed — ${requestTitle}`,
          intro: ro
            ? `Firma <strong>${companyName}</strong> a preluat cererea ta „${requestTitle}” și o poate oferta.`
            : `The company <strong>${companyName}</strong> claimed your request “${requestTitle}” and can now quote it.`,
          cta: ro ? 'Vezi conversațiile' : 'View conversations',
          path: `/${lang}/requests/${requestId}/offers`,
        };
      case 'message.created': {
        const fromCompany = payload.senderRole === 'COMPANY';
        // clientul primeste link la conversatiile cererii; firma la preluari
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
            : `/${lang}/marketplace/messages`,
        };
      }
      case 'quote.accepted':
        return {
          subject: ro
            ? `Oferta ta a fost acceptată — ${requestTitle}`
            : `Your offer was accepted — ${requestTitle}`,
          intro: ro
            ? `Clientul a acceptat oferta firmei <strong>${companyName}</strong> pentru „${requestTitle}”. Stabiliți detaliile execuției în conversație.`
            : `The client accepted <strong>${companyName}</strong>'s offer for “${requestTitle}”. Agree on the execution details in the conversation.`,
          cta: ro ? 'Deschide lucrarea' : 'Open the job',
          path: claimsPath,
        };
      case 'claim.withdrawn': {
        const reason = String(payload.reason ?? '');
        if (reason === 'SLA_EXPIRED') {
          return {
            subject: ro
              ? `Termenul de ofertare a fost depășit — ${requestTitle}`
              : `The quoting deadline was missed — ${requestTitle}`,
            intro: ro
              ? `Preluarea cererii „${requestTitle}” s-a închis pentru că termenul SLA a fost depășit. Creditele rezervate s-au consumat, iar firma a primit puncte de penalizare.`
              : `Your claim on “${requestTitle}” closed because the SLA deadline was missed. The reserved credits were consumed and the company received penalty points.`,
            cta: ro ? 'Vezi preluările' : 'View your claims',
            path: claimsPath,
          };
        }
        // REQUEST_ACCEPTED_OTHER_OFFER
        const refunded = payload.refunded === true;
        return {
          subject: ro
            ? `Clientul a ales altă ofertă — ${requestTitle}`
            : `The client chose another offer — ${requestTitle}`,
          intro: ro
            ? `Cererea „${requestTitle}” a fost atribuită altei firme. ${
                refunded
                  ? 'Creditele rezervate ți-au fost returnate (nu apucaseși să trimiți o ofertă).'
                  : 'Creditele rezervate s-au consumat (ai ofertat, iar clientul a ales altă firmă).'
              }`
            : `The request “${requestTitle}” was awarded to another company. ${
                refunded
                  ? 'Your reserved credits were refunded (you had not sent an offer yet).'
                  : 'Your reserved credits were consumed (you quoted and the client chose another company).'
              }`,
          cta: ro ? 'Vezi preluările' : 'View your claims',
          path: claimsPath,
        };
      }
      case 'delivery.marked':
        return {
          subject: ro
            ? `Lucrarea a fost livrată — confirmă primirea — ${requestTitle}`
            : `Your order was delivered — confirm receipt — ${requestTitle}`,
          intro: ro
            ? `Firma <strong>${companyName}</strong> a marcat livrarea la „${requestTitle}”. Confirmă primirea ca să finalizezi comanda și să poți lăsa o recenzie.`
            : `The company <strong>${companyName}</strong> marked “${requestTitle}” as delivered. Confirm receipt to complete the order and leave a review.`,
          cta: ro ? 'Confirmă livrarea' : 'Confirm delivery',
          path: `/${lang}/requests/${requestId}/offers`,
        };
      case 'company.approved':
        return {
          subject: ro
            ? `Firma ta a fost aprobată pe Cozy Home`
            : `Your company was approved on Cozy Home`,
          intro: ro
            ? `Firma <strong>${companyName}</strong> a fost verificată și aprobată. Poți prelua cereri din marketplace.`
            : `The company <strong>${companyName}</strong> was verified and approved. You can now claim requests from the marketplace.`,
          cta: ro ? 'Deschide marketplace-ul' : 'Open the marketplace',
          path: `/${lang}/marketplace`,
        };
      case 'company.rejected': {
        const reason = esc(payload.reason);
        return {
          subject: ro
            ? `Înregistrarea firmei a fost respinsă`
            : `Your company registration was rejected`,
          intro: ro
            ? `Înregistrarea firmei <strong>${companyName}</strong> a fost respinsă.${
                reason ? ` Motiv: „${reason}”.` : ''
              }`
            : `The registration of <strong>${companyName}</strong> was rejected.${
                reason ? ` Reason: “${reason}”.` : ''
              }`,
          cta: ro ? 'Vezi detaliile' : 'View details',
          path: `/${lang}/company`,
        };
      }
      case 'company.suspended': {
        const until = payload.suspendedUntil
          ? new Date(String(payload.suspendedUntil)).toLocaleDateString(ro ? 'ro-RO' : 'en-GB')
          : '';
        return {
          subject: ro ? `Firma ta a fost suspendată` : `Your company was suspended`,
          intro: ro
            ? `Firma <strong>${companyName}</strong> a fost suspendată${
                until ? ` până la ${until}` : ''
              } din cauza punctelor de penalizare acumulate. În această perioadă nu poți prelua cereri noi.`
            : `The company <strong>${companyName}</strong> was suspended${
                until ? ` until ${until}` : ''
              } because of accumulated penalty points. You cannot claim new requests during this period.`,
          cta: ro ? 'Vezi penalizările' : 'View penalties',
          path: `/${lang}/company`,
        };
      }
      case 'withdrawal.decided': {
        const approved = payload.approved === true;
        return {
          subject: ro
            ? `Retragerea preluării a fost ${approved ? 'aprobată' : 'respinsă'} — ${requestTitle}`
            : `Your claim withdrawal was ${approved ? 'approved' : 'rejected'} — ${requestTitle}`,
          intro: ro
            ? approved
              ? `Retragerea preluării la „${requestTitle}” a fost aprobată — creditele rezervate ți-au fost returnate.`
              : `Retragerea preluării la „${requestTitle}” a fost respinsă — preluarea rămâne activă, iar termenele curg în continuare.`
            : approved
              ? `Your withdrawal on “${requestTitle}” was approved — the reserved credits were refunded.`
              : `Your withdrawal on “${requestTitle}” was rejected — the claim stays active and the deadlines keep running.`,
          cta: ro ? 'Vezi preluarea' : 'View the claim',
          path: claimsPath,
        };
      }
      case 'payment.confirmed': {
        const invoice =
          payload.invoiceSeries && payload.invoiceNumber
            ? `${esc(payload.invoiceSeries)}-${esc(payload.invoiceNumber)}`
            : '';
        const isSubscription = payload.orderType === 'SUBSCRIPTION';
        return {
          subject: ro ? `Plata a fost confirmată` : `Your payment was confirmed`,
          intro: ro
            ? `Plata pentru ${isSubscription ? 'abonament' : 'pachetul de credite'} a fost confirmată${
                invoice ? `, iar factura <strong>${invoice}</strong> este disponibilă în portofel` : ''
              }.`
            : `Your ${isSubscription ? 'subscription' : 'credit package'} payment was confirmed${
                invoice ? ` and invoice <strong>${invoice}</strong> is available in your wallet` : ''
              }.`,
          cta: ro ? 'Deschide portofelul' : 'Open your wallet',
          path: `/${lang}/marketplace/wallet`,
        };
      }
      case 'subscription.expiring': {
        const days = Number(payload.daysLeft ?? 0);
        return {
          subject: ro
            ? `Abonamentul expiră în ${days} ${days === 1 ? 'zi' : 'zile'}`
            : `Your subscription expires in ${days} ${days === 1 ? 'day' : 'days'}`,
          intro: ro
            ? `Abonamentul firmei <strong>${companyName}</strong> expiră în ${days} ${
                days === 1 ? 'zi' : 'zile'
              }. Prelungește-l din portofel ca să păstrezi accesul la marketplace.`
            : `The subscription of <strong>${companyName}</strong> expires in ${days} ${
                days === 1 ? 'day' : 'days'
              }. Renew it from your wallet to keep marketplace access.`,
          cta: ro ? 'Prelungește abonamentul' : 'Renew the subscription',
          path: `/${lang}/marketplace/wallet`,
        };
      }
      case 'delivery.autocompleted':
        return {
          subject: ro
            ? `Comanda a fost finalizată automat — ${requestTitle}`
            : `Your order was completed automatically — ${requestTitle}`,
          intro: ro
            ? `Au trecut 14 zile de la livrarea „${requestTitle}” fără o confirmare, așa că am finalizat comanda automat. Poți lăsa o recenzie despre colaborare.`
            : `14 days passed since “${requestTitle}” was delivered without a confirmation, so we completed the order automatically. You can leave a review about the collaboration.`,
          cta: ro ? 'Lasă o recenzie' : 'Leave a review',
          path: `/${lang}/requests/${requestId}/offers`,
        };
      case 'company.unsuspended':
        return {
          subject: ro
            ? `Suspendarea firmei a fost ridicată`
            : `Your company's suspension was lifted`,
          intro: ro
            ? `Suspendarea firmei <strong>${companyName}</strong> a fost ridicată. Poți prelua din nou cereri din marketplace.`
            : `The suspension of <strong>${companyName}</strong> was lifted. You can claim requests from the marketplace again.`,
          cta: ro ? 'Deschide marketplace-ul' : 'Open the marketplace',
          path: `/${lang}/marketplace`,
        };
      case 'request.expired':
        return {
          subject: ro
            ? `Cererea ta a expirat — ${requestTitle}`
            : `Your request expired — ${requestTitle}`,
          intro: ro
            ? `Cererea „${requestTitle}” a stat 5 zile lucrătoare în marketplace fără să fie preluată și a expirat. O poți republica din pagina cererii.`
            : `Your request “${requestTitle}” spent 5 working days in the marketplace without being claimed and has expired. You can repost it from the request page.`,
          cta: ro ? 'Vezi cererea' : 'View the request',
          path: `/${lang}/requests/${requestId}`,
        };
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
        <p>${ro ? 'Salut' : 'Hi'} ${esc(user.name)},</p>
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
