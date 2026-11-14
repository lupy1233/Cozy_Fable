import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { safeErrorSummary } from '../../common/logging/safe-error';
import { ConfigService } from '@nestjs/config';
import { Language } from '@prisma/client';
import { MailService } from '../../infra/mail/mail.service';
import { supportLineHtml } from '../../infra/mail/mail-footer';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { BillingDocumentsService, type BillingEmailExtras } from '../billing/billing-documents.service';
import { BILLING_MANAGER_ROLES, billingManagerIds } from '../billing/billing-recipients';
import { CLAIM_COMPANY_EMAIL_EVENTS, claimCompanyEmailRecipients } from './notification-rules';

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
  // E-admin-platform-3: proiect blocat / anulat, termene de livrare, oferte expirate
  'project.case_opened',
  'project.cancelled',
  'project.delivery_reminder',
  'project.overdue',
  'quote.expired', // doar clientul — vezi recipientsFor()
  'quote.expired_closed',
  'quote.extension_requested',
  // E-admin-platform-44: termene apropiate (cerere nepreluata, atribuire, SLA oferta)
  'request.expiry_reminder',
  'claim.assign_warning',
  'sla.expiring_soon',
  // E-company-24: plata prin transfer bancar (payment.marked_paid = doar clopotelul adminilor)
  'payment.transfer_instructions',
  'payment.transfer_reminder',
  'payment.auto_cancelled',
  // a4 (2026-11-13): varianta noua → clientul; cerere de modificare → firma (vezi recipientsFor);
  // refuzul ofertei → firma, cu motivul
  'quote.updated',
  'quote.declined',
  // a6 (2026-11-14): cerere publicata fara nicio firma in zona → adminii (tintele)
  'request.no_coverage',
  // e4 (2026-11-14): o firma a renuntat la preluare → clientul (tinta unica)
  'request.company_withdrew',
  // g1 (etapa 9): publicarea → clientul (doar e-mail); finalizarea si recenzia → firma;
  // e3: intrebarea firmei → clientul, raspunsul clientului si editarea dupa preluare → firma.
  // La firma: responsabilul preluarii + proprietar/manageri (CLAIM_COMPANY_EMAIL_EVENTS).
  // request.new_in_area NU e aici: e-mailul firmei e rezumatul zilnic (sendNewRequestsDigest).
  'request.published',
  'delivery.confirmed',
  'review.created',
  'clarification.asked',
  'clarification.answered',
  'request.edited_after_claim',
]);

// g1-2: rezumatul zilnic arata cel mult atatea cereri (restul = „si inca N”)
const DIGEST_MAX_ITEMS = 20;

export interface NewRequestDigestItem {
  requestId: string;
  // titlul / localitatea asa cum le vede firma in marketplace (titlul deja mascat)
  title: string;
  city: string;
  county: string;
}

// a4: motivele refuzului (PO a4-2), in limba destinatarului
const DECLINE_REASON_TEXT: Record<string, { ro: string; en: string }> = {
  PRICE: { ro: 'prețul', en: 'the price' },
  DELIVERY_TERM: { ro: 'termenul de livrare', en: 'the delivery time' },
  OTHER_COMPANY: { ro: 'a ales altă firmă', en: 'chose another company' },
  GAVE_UP: { ro: 'renunță la cerere', en: 'is dropping the request' },
};

// E-company-24: evenimentele de facturare ajung (clopotel + email) doar la OWNER/MANAGER —
// filtrul de aici acopera si intentiile outbox scrise inainte de deploy (tinte = toata echipa).
const BILLING_MANAGER_EVENTS = new Set([
  'payment.confirmed',
  'subscription.expiring',
  'payment.transfer_instructions',
  'payment.transfer_reminder',
  'payment.auto_cancelled',
]);

// E-company-24: copia pentru emailul de facturare al firmei (contabil) = doar documentele
// (proforma la comanda, factura la confirmare), o singura data per eveniment.
const BILLING_CONTACT_EVENTS = new Set(['payment.transfer_instructions', 'payment.confirmed']);

// E-admin-platform-1: Reply-To = SUPPORT_EMAIL doar pe emailurile de cont/facturare/dispute.
// NU pe chat, oferte, preluari, livrari: raspunsul ar trimite continut privat de proiect
// in inboxul de suport.
const SUPPORT_REPLY_EVENTS = new Set([
  'company.approved',
  'company.rejected',
  'company.suspended',
  'company.unsuspended',
  'payment.confirmed',
  'subscription.expiring',
  'withdrawal.decided',
  'project.case_opened',
  'project.cancelled',
  'payment.transfer_instructions',
  'payment.transfer_reminder',
  'payment.auto_cancelled',
]);

// claim.withdrawn: email DOAR cand firma pierde bani/puncte (sau decontarea e decisa de
// platforma); restul raman pe clopotel.
const EMAILED_WITHDRAW_REASONS = new Set([
  'SLA_EXPIRED',
  'REQUEST_ACCEPTED_OTHER_OFFER',
  // E-admin-platform-3 (textul depinde de `refunded`)
  'PROJECT_CANCELLED',
  'OFFER_EXPIRED_UNDECIDED',
]);

// data calendaristica YYYY-MM-DD afisata in limba destinatarului (fara deplasare de fus)
function formatDateOnly(value: unknown, ro: boolean): string {
  const text = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  return new Date(`${text}T12:00:00Z`).toLocaleDateString(ro ? 'ro-RO' : 'en-GB', { timeZone: 'Europe/Bucharest' });
}

function formatInstant(value: unknown, ro: boolean): string {
  if (typeof value !== 'string') return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString(ro ? 'ro-RO' : 'en-GB', { timeZone: 'Europe/Bucharest' });
}

// E-admin-platform-44 — data + ora (Bucuresti) a unui termen ISO, in limba destinatarului
function formatDateTime(value: unknown, ro: boolean): string {
  if (typeof value !== 'string') return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString(ro ? 'ro-RO' : 'en-GB', {
    timeZone: 'Europe/Bucharest',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// suma in lei cu 2 zecimale, in limba destinatarului (glosar etapa 8: „lei” si in engleza)
function formatRon(value: unknown, ro: boolean): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return `${new Intl.NumberFormat(ro ? 'ro-RO' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} lei`;
}

// m7 (revizie g1): in romana „de” apare cand ultimele doua cifre sunt 0 sau 20–99
// (2–19 cereri, 101–119 cereri, dar 20 / 100 / 120 de cereri)
export function roNeedsDe(n: number): boolean {
  const lastTwo = Math.abs(Math.trunc(n)) % 100;
  return n !== 0 && (lastTwo === 0 || lastTwo >= 20);
}

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
    private readonly billingDocs: BillingDocumentsService,
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
    retryOnFailure = false,
  ): Promise<void> {
    if (!EMAILED_EVENTS.has(type) || targets.length === 0) return;
    const recipients = (await this.recipientsFor(type, targets, payload)).filter((id) => targets.includes(id));
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

    // E-company-24: suma/IBAN/referinta + PDF-ul atasat (proforma/factura), o data per apel
    const extras = await this.billingDocs.prepare(type, payload);
    const attachments = extras?.attachment ? [extras.attachment] : undefined;
    const origin = this.config.getOrThrow<string>('FRONTEND_ORIGIN');
    let delivered = false;
    for (const user of users) {
      const lang = user.languagePreference === Language.EN ? 'en' : 'ro';
      const content = this.buildContent(type, payload, lang, user.id, extras);
      if (!content) continue;
      const html = this.wrapHtml(user, content, origin, lang);
      try {
        await this.mail.send(user.email, content.subject, html, {
          replyToSupport: SUPPORT_REPLY_EVENTS.has(type),
          ...(attachments ? { attachments } : {}),
        });
        delivered = true;
      } catch (e) {
        if (retryOnFailure) {
          if (delivered) await this.billingDocs.markProformaEmailed(type, payload, extras);
          throw e;
        }
        // best-effort: notificarea in-app exista deja; nu esuam jobul
        this.logger.warn(`email ${type} catre ${user.id} a esuat: ${safeErrorSummary(e)}`);
      }
    }
    // g4: proforma atasata a plecat macar la un destinatar → comanda tine minte
    if (delivered) await this.billingDocs.markProformaEmailed(type, payload, extras);
  }

  // E-company-24 — copia pentru adresa de facturare a firmei (ex. contabilul): doar documentele,
  // o singura data per eveniment (marcaj durabil pe outbox). Fara link de dezabonare (nu e cont)
  // si fara buton de login. Eroarea SMTP urca: jobul se reincearca, iar marcajul se scrie doar dupa trimitere.
  async sendBillingContactCopy(eventId: string, type: string, payload: Record<string, unknown>): Promise<void> {
    if (!BILLING_CONTACT_EVENTS.has(type)) return;
    const companyId = typeof payload.companyId === 'string' ? payload.companyId : null;
    if (!companyId) return;
    const event = await this.prisma.domainEventOutbox.findUnique({
      where: { id: eventId },
      select: { billingContactEmailedAt: true },
    });
    if (!event || event.billingContactEmailedAt) return;
    // citire top-level: firma stearsa (soft) nu mai primeste nimic
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, billingEmail: true },
    });
    const to = company?.billingEmail?.trim().toLowerCase();
    if (!company || !to) return;
    // adresa unui OWNER/MANAGER primeste deja emailul normal
    const managers = await this.prisma.companyMember.findMany({
      where: { companyId, role: { in: [...BILLING_MANAGER_ROLES] } },
      select: { user: { select: { email: true } } },
    });
    if (managers.some((m) => m.user.email.trim().toLowerCase() === to)) return;

    const extras = await this.billingDocs.prepare(type, payload);
    const content = this.buildContent(type, { ...payload, companyName: company.name }, 'ro', '', extras);
    if (!content) return;
    await this.mail.send(to, content.subject, this.wrapBillingContactHtml(content, company.name), {
      replyToSupport: true,
      ...(extras?.attachment ? { attachments: [extras.attachment] } : {}),
    });
    // g4 (revizie m5): copia pentru contabil NU marcheaza proforma ca trimisa — portofelul ii
    // spune firmei „ti-am trimis proforma”, adevarat doar daca a ajuns la OWNER/MANAGER
    await this.prisma.domainEventOutbox.updateMany({
      where: { id: eventId, billingContactEmailedAt: null },
      data: { billingContactEmailedAt: new Date() },
    });
  }

  // g1-2 (PO): rezumatul zilnic „cereri noi in zona ta” — un singur e-mail pe firma, catre
  // proprietar + manageri (conturi active, e-mail confirmat, nedezabonati). Doar ce vede firma
  // in marketplace inainte de preluare: titlul mascat + localitatea; fara date de contact,
  // adresa exacta sau numele clientului. Eroarea SMTP se logheaza (nu se reia: fara dubluri).
  // Intoarce cate e-mailuri au plecat.
  async sendNewRequestsDigest(
    company: { id: string; name: string },
    items: NewRequestDigestItem[],
  ): Promise<number> {
    if (items.length === 0) return 0;
    const managerIds = await billingManagerIds(this.prisma, company.id);
    if (managerIds.length === 0) return 0;
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: managerIds },
        deletedAt: null,
        emailNotificationsEnabled: true,
        emailVerifiedAt: { not: null },
      },
      select: { id: true, email: true, name: true, languagePreference: true },
    });
    const origin = this.config.getOrThrow<string>('FRONTEND_ORIGIN');
    let sent = 0;
    for (const user of users) {
      const lang = user.languagePreference === Language.EN ? 'en' : 'ro';
      const content = this.buildDigestContent(company.name, items, lang, origin);
      try {
        await this.mail.send(user.email, content.subject, this.wrapHtml(user, content, origin, lang), { replyToSupport: false });
        sent += 1;
      } catch (e) {
        this.logger.warn(`rezumat cereri noi catre ${user.id} a esuat: ${safeErrorSummary(e)}`);
      }
    }
    return sent;
  }

  private buildDigestContent(
    companyName: string,
    items: NewRequestDigestItem[],
    lang: 'ro' | 'en',
    origin: string,
  ): EmailContent {
    const ro = lang === 'ro';
    const n = items.length;
    const countText = ro
      ? n === 1 ? 'o cerere nouă' : `${n} ${roNeedsDe(n) ? 'de ' : ''}cereri noi`
      : n === 1 ? 'one new request' : `${n} new requests`;
    const shown = items.slice(0, DIGEST_MAX_ITEMS);
    const list = shown
      .map((item) => {
        const place = [item.city, item.county]
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
          .filter((v) => v.length > 0)
          .map((v) => esc(v))
          .join(', ');
        const href = `${origin}/${lang}/marketplace/${encodeURIComponent(item.requestId)}`;
        return `<li style="margin: 6px 0;"><a href="${href}">${esc(item.title)}</a>${place ? ` — ${place}` : ''}</li>`;
      })
      .join('');
    const more = n - shown.length;
    const moreLine = more > 0
      ? ro
        ? `<p>Și încă ${more} în lista cererilor disponibile.</p>`
        : `<p>And ${more} more in the list of available requests.</p>`
      : '';
    return {
      subject: ro ? `Cereri noi în zona ta — ${countText}` : `New requests in your area — ${countText}`,
      intro: ro
        ? `În ultimele 24 de ore au apărut ${countText} în zona firmei <strong>${esc(companyName)}</strong>:</p><ul style="padding-left: 18px;">${list}</ul>${moreLine}<p>Datele de contact ale clientului se văd după preluare.`
        : `In the last 24 hours, ${countText} appeared in <strong>${esc(companyName)}</strong>'s area:</p><ul style="padding-left: 18px;">${list}</ul>${moreLine}<p>The client's contact details become visible after you claim a request.`,
      cta: ro ? 'Vezi cererile disponibile' : 'See available requests',
      path: `/${lang}/marketplace`,
    };
  }

  // Cine primeste EMAIL (in-app primesc toate tintele; emailul e mai selectiv).
  private async recipientsFor(
    type: string,
    targets: string[],
    payload: Record<string, unknown>,
  ): Promise<string[]> {
    const clientUserId = typeof payload.clientUserId === 'string' ? payload.clientUserId : null;
    if (BILLING_MANAGER_EVENTS.has(type)) {
      const companyId = typeof payload.companyId === 'string' ? payload.companyId : null;
      if (!companyId) return [];
      const managers = await this.prisma.companyMember.findMany({
        where: { companyId, role: { in: [...BILLING_MANAGER_ROLES] } },
        select: { userId: true },
      });
      const managerIds = new Set(managers.map((m) => m.userId));
      return targets.filter((id) => managerIds.has(id));
    }
    // g1-1 (PO): evenimentele unei preluari catre firma → responsabilul + proprietar/manageri
    const toClaimCompany = async (): Promise<string[]> => {
      const companyId = typeof payload.companyId === 'string' ? payload.companyId : null;
      if (!companyId) return [];
      const allowed = await claimCompanyEmailRecipients(this.prisma, {
        companyId,
        claimSlotId: typeof payload.claimSlotId === 'string' ? payload.claimSlotId : null,
        requestId: typeof payload.requestId === 'string' ? payload.requestId : null,
      });
      return targets.filter((id) => allowed.has(id) && id !== clientUserId);
    };
    switch (type) {
      // cerere preluata / oferta noua → DOAR clientul
      // g1: cererea publicata; e3: intrebarea firmei → DOAR clientul
      case 'claim.created':
      case 'quote.created':
      case 'request.published':
      case 'clarification.asked':
        return clientUserId ? [clientUserId] : [];
      // mesaj nou → doar partea CEALALTA a conversatiei; la firma doar responsabilul + conducerea
      case 'message.created':
        if (payload.senderRole === 'COMPANY') return clientUserId ? [clientUserId] : [];
        return (await toClaimCompany()).filter((id) => id !== payload.senderUserId);
      // a4: quote.updated trimite e-mail DOAR la varianta noua (clientului) si la cererea de
      // modificare (firmei); restul actualizarilor raman pe clopotel
      case 'quote.updated':
        if (payload.kind === 'NEW_VERSION') return clientUserId ? [clientUserId] : [];
        if (payload.kind !== 'CHANGE_REQUESTED') return [];
        return toClaimCompany();
      default:
        break;
    }
    // oferta acceptata / refuzata, raspunsul clientului, editarea dupa preluare, finalizarea,
    // recenzia → firma (clientul a facut chiar el actiunea)
    if (CLAIM_COMPANY_EMAIL_EVENTS.has(type)) return toClaimCompany();
    switch (type) {
      // inchidere de claim → email doar cand firma pierde bani/puncte
      case 'claim.withdrawn':
        return EMAILED_WITHDRAW_REASONS.has(String(payload.reason ?? '')) ? targets : [];
      // E-admin-platform-3: expirarea ofertei — emailul e reminderul CLIENTULUI (firma are clopotel)
      case 'quote.expired':
        return clientUserId ? [clientUserId] : [];
      // raport pe proiect → email doar CELEILALTE parti (adminii au clopotel + /admin/requests)
      case 'project.case_opened': {
        if (payload.openedBy === 'COMPANY') return clientUserId ? [clientUserId] : [];
        const companyId = typeof payload.companyId === 'string' ? payload.companyId : null;
        if (!companyId) return [];
        const members = await this.prisma.companyMember.findMany({
          where: { companyId },
          select: { userId: true },
        });
        const memberIds = new Set(members.map((m) => m.userId));
        return targets.filter((id) => memberIds.has(id));
      }
      default:
        return targets;
    }
  }

  private buildContent(
    type: string,
    payload: Record<string, unknown>,
    lang: 'ro' | 'en',
    recipientId: string,
    extras: BillingEmailExtras | null = null,
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
      // a4 (2026-11-13)
      case 'quote.updated': {
        if (payload.kind === 'NEW_VERSION') {
          const n = Number(payload.version);
          const label = Number.isFinite(n) && n > 0 ? (ro ? ` (varianta ${n})` : ` (version ${n})`) : '';
          return {
            subject: ro
              ? `Variantă nouă a ofertei — ${requestTitle}`
              : `New version of an offer — ${requestTitle}`,
            intro: ro
              ? `Firma <strong>${companyName}</strong> ți-a trimis o variantă nouă a ofertei${label} pentru „${requestTitle}”. Variantele anterioare rămân vizibile, ca să le poți compara.`
              : `The company <strong>${companyName}</strong> sent you a new version of its offer${label} for “${requestTitle}”. The earlier versions stay visible so you can compare them.`,
            cta: ro ? 'Vezi oferta' : 'View the offer',
            path: `/${lang}/requests/${requestId}/offers`,
          };
        }
        if (payload.kind === 'CHANGE_REQUESTED') {
          return {
            subject: ro
              ? `Clientul cere o modificare a ofertei — ${requestTitle}`
              : `The client asks for a change to your offer — ${requestTitle}`,
            intro: ro
              ? `Clientul a cerut o modificare a ofertei firmei <strong>${companyName}</strong> pentru „${requestTitle}”. Cererea apare și în conversație. Poți trimite o variantă nouă sau poți refuza modificarea din fișa preluării.`
              : `The client asked for a change to <strong>${companyName}</strong>'s offer for “${requestTitle}”. The request also appears in the conversation. You can send a new version or decline the change from the claim page.`,
            cta: ro ? 'Deschide preluarea' : 'Open the claim',
            path: claimsPath,
          };
        }
        return null;
      }
      case 'quote.declined': {
        const reasonKey = String(payload.reason ?? '');
        const reasonText = DECLINE_REASON_TEXT[reasonKey]?.[lang] ?? '';
        const note = typeof payload.note === 'string' && payload.note.trim() ? esc(payload.note.trim()) : '';
        const consumed = payload.consumed !== false;
        const reasonLine = reasonText
          ? ro ? ` Motivul indicat: ${esc(reasonText)}.` : ` Reason given: ${esc(reasonText)}.`
          : '';
        const noteLine = note ? (ro ? ` Mesajul clientului: „${note}”.` : ` The client's message: “${note}”.`) : '';
        const creditsLine = consumed
          ? ro ? ' Creditele rezervate pentru această preluare s-au consumat.' : ' The credits reserved for this claim were consumed.'
          : '';
        return {
          subject: ro
            ? `Clientul a refuzat oferta — ${requestTitle}`
            : `The client declined your offer — ${requestTitle}`,
          intro: ro
            ? `Clientul a refuzat oferta firmei <strong>${companyName}</strong> pentru „${requestTitle}”, așa că preluarea s-a închis.${reasonLine}${noteLine}${creditsLine}`
            : `The client declined <strong>${companyName}</strong>'s offer for “${requestTitle}”, so the claim was closed.${reasonLine}${noteLine}${creditsLine}`,
          cta: ro ? 'Vezi preluarea' : 'View the claim',
          path: claimsPath,
        };
      }
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
          // g1: firma ajunge direct pe fisa preluarii (conversatia cererii), nu pe lista de mesaje
          path: isClientRecipient
            ? `/${lang}/requests/${requestId}/offers`
            : claimSlotId && payload.teamChat !== true
              ? claimsPath
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
          cta: ro ? 'Deschide comanda' : 'Open the order',
          path: claimsPath,
        };
      case 'claim.withdrawn': {
        const reason = String(payload.reason ?? '');
        const settledRefund = payload.refunded === true;
        if (reason === 'PROJECT_CANCELLED') {
          return {
            subject: ro
              ? `Comanda a fost anulată — ${requestTitle}`
              : `The order was cancelled — ${requestTitle}`,
            intro: ro
              ? `Echipa Cozy Home a închis comanda „${requestTitle}”. ${
                  settledRefund
                    ? 'Creditele rezervate pentru această preluare ți-au fost returnate.'
                    : 'Creditele rezervate pentru această preluare s-au consumat.'
                }`
              : `The Cozy Home team closed the order “${requestTitle}”. ${
                  settledRefund
                    ? 'The credits reserved for this claim were refunded.'
                    : 'The credits reserved for this claim were consumed.'
                }`,
            cta: ro ? 'Vezi preluarea' : 'View the claim',
            path: claimsPath,
          };
        }
        if (reason === 'OFFER_EXPIRED_UNDECIDED') {
          return {
            subject: ro
              ? `Preluare închisă — oferta a expirat — ${requestTitle}`
              : `Claim closed — the offer expired — ${requestTitle}`,
            intro: ro
              ? `Oferta ta pentru „${requestTitle}” a expirat fără o decizie a clientului, așa că preluarea s-a închis automat. ${
                  settledRefund ? 'Creditele rezervate ți-au fost returnate.' : 'Creditele rezervate s-au consumat.'
                }`
              : `Your offer for “${requestTitle}” expired without a decision from the client, so the claim was closed automatically. ${
                  settledRefund ? 'Your reserved credits were refunded.' : 'Your reserved credits were consumed.'
                }`,
            cta: ro ? 'Vezi preluările' : 'View your claims',
            path: claimsPath,
          };
        }
        if (reason === 'SLA_EXPIRED') {
          return {
            subject: ro
              ? `Termenul de răspuns a fost depășit — ${requestTitle}`
              : `The response deadline was missed — ${requestTitle}`,
            intro: ro
              ? `Preluarea cererii „${requestTitle}” s-a închis pentru că termenul de răspuns a fost depășit. Creditele rezervate s-au consumat, iar firma a primit puncte de penalizare.`
              : `Your claim on “${requestTitle}” closed because the response deadline was missed. The reserved credits were consumed and the company received penalty points.`,
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
            ? `Comanda a fost livrată — confirmă primirea — ${requestTitle}`
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
            ? `Firma <strong>${companyName}</strong> a fost verificată și aprobată. Poți prelua cereri din „Cereri disponibile”.`
            : `The company <strong>${companyName}</strong> was verified and approved. You can now claim requests from “Available requests”.`,
          cta: ro ? 'Vezi cererile disponibile' : 'See available requests',
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
        // E-company-19: data in Europe/Bucharest (invarianta 3.3), nu in fusul serverului
        const suspendedUntil = payload.suspendedUntil instanceof Date ? payload.suspendedUntil.toISOString() : payload.suspendedUntil;
        const until = formatInstant(suspendedUntil, ro);
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
        // copia pentru contabil (fara cont, recipientId gol) nu trimite spre portofel
        const inWallet = recipientId !== '';
        return {
          subject: ro ? `Plata a fost confirmată` : `Your payment was confirmed`,
          intro: ro
            ? `Plata pentru ${isSubscription ? 'abonament' : 'pachetul de credite'} a fost confirmată${
                invoice
                  ? extras?.attachment
                    ? `, iar factura <strong>${invoice}</strong> este atașată acestui email${inWallet ? ' (o găsești și în portofel)' : ''}`
                    : `, iar factura <strong>${invoice}</strong> este disponibilă în portofel`
                  : ''
              }.`
            : `Your ${isSubscription ? 'subscription' : 'credit package'} payment was confirmed${
                invoice
                  ? extras?.attachment
                    ? ` and invoice <strong>${invoice}</strong> is attached to this email${inWallet ? " (you'll also find it in your wallet)" : ''}`
                    : ` and invoice <strong>${invoice}</strong> is available in your wallet`
                  : ''
              }.`,
          cta: ro ? 'Deschide portofelul' : 'Open your wallet',
          path: `/${lang}/marketplace/wallet`,
        };
      }
      // E-company-24 — plata prin transfer bancar (Stripe oprit)
      case 'payment.transfer_instructions':
      case 'payment.transfer_reminder': {
        const ref = esc(extras?.orderRef ?? '');
        const isSubscription = (extras?.orderType ?? payload.orderType) === 'SUBSCRIPTION';
        const what = ro
          ? isSubscription ? 'abonament' : 'pachet de credite'
          : isSubscription ? 'subscription' : 'credit package';
        const t = extras?.transfer;
        const details = t
          ? ro
            ? `<br/>Beneficiar: <strong>${esc(t.sellerName)}</strong><br/>CUI: ${esc(t.cui)}<br/>IBAN: <strong>${esc(t.iban)}</strong><br/>Suma: <strong>${esc(formatRon(extras?.totalRon, true))}</strong><br/>Detalii plată: „Comanda ${ref}”`
            : `<br/>Beneficiary: <strong>${esc(t.sellerName)}</strong><br/>Tax ID (CUI): ${esc(t.cui)}<br/>IBAN: <strong>${esc(t.iban)}</strong><br/>Amount: <strong>${esc(formatRon(extras?.totalRon, false))}</strong><br/>Payment reference: “Comanda ${ref}”`
          : ro
            ? '<br/>Datele bancare sunt în portofel.'
            : '<br/>The bank details are in your wallet.';
        const attached = extras?.attachment
          ? ro
            ? '<br/><br/>Factura proformă este atașată.'
            : '<br/><br/>The proforma invoice is attached.'
          : '';
        const activate = ro
          ? ' Activăm creditele sau abonamentul după ce confirmăm încasarea.'
          : " We'll activate the credits or subscription once we confirm the payment.";
        if (type === 'payment.transfer_instructions') {
          return {
            subject: ro
              ? `Datele pentru plata prin transfer — plata ${ref}`
              : `Bank transfer details — payment ${ref}`,
            intro: ro
              ? `Plata <strong>${ref}</strong> (${what}) așteaptă transferul bancar:${details}${attached}${attached ? '' : '<br/><br/>'}${activate}`
              : `Payment <strong>${ref}</strong> (${what}) is awaiting your bank transfer:${details}${attached}${attached ? '' : '<br/><br/>'}${activate}`,
            cta: ro ? 'Deschide portofelul' : 'Open your wallet',
            path: `/${lang}/marketplace/wallet`,
          };
        }
        const cancelAt = formatDateTime(extras?.cancelAt ?? payload.cancelAt, ro);
        const cancelLine = cancelAt
          ? ro
            ? `<br/><br/>Dacă banii nu ajung până la ${esc(cancelAt)}, plata în așteptare se anulează automat.`
            : `<br/><br/>If the money doesn't arrive by ${esc(cancelAt)}, the pending payment is cancelled automatically.`
          : '';
        return {
          subject: ro ? `Plata ${ref} așteaptă transferul` : `Payment ${ref} is awaiting your transfer`,
          intro: ro
            ? `Plata <strong>${ref}</strong> (${what}) așteaptă încă transferul bancar:${details}${attached}${cancelLine}<br/><br/>Dacă ai plătit deja, apasă „Am plătit” în portofel.`
            : `Payment <strong>${ref}</strong> (${what}) is still awaiting your bank transfer:${details}${attached}${cancelLine}<br/><br/>If you've already paid, press “I've paid” in your wallet.`,
          cta: ro ? 'Deschide portofelul' : 'Open your wallet',
          path: `/${lang}/marketplace/wallet`,
        };
      }
      case 'payment.auto_cancelled': {
        const ref = esc(extras?.orderRef ?? '');
        const n = Number(payload.expiryDays ?? 0);
        return {
          subject: ro
            ? `Plata ${ref} a fost anulată — banii nu au ajuns`
            : `Payment ${ref} was cancelled — money not received`,
          intro: ro
            ? `Nu am primit banii în ${n} ${n === 1 ? 'zi' : 'zile'}, așa că am anulat plata în așteptare <strong>${ref}</strong>. Dacă ai plătit deja, răspunde la acest email și verificăm.<br/><br/>Poți porni oricând o plată nouă din portofel.`
            : `We didn't receive the money within ${n} ${n === 1 ? 'day' : 'days'}, so we cancelled the pending payment <strong>${ref}</strong>. If you've already paid, reply to this email and we'll check.<br/><br/>You can start a new payment from your wallet at any time.`,
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
              }. Prelungește-l din portofel ca să păstrezi accesul la cererile disponibile.`
            : `The subscription of <strong>${companyName}</strong> expires in ${days} ${
                days === 1 ? 'day' : 'days'
              }. Renew it from your wallet to keep access to available requests.`,
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
            ? `Suspendarea firmei <strong>${companyName}</strong> a fost ridicată. Poți prelua din nou cereri din „Cereri disponibile”.`
            : `The suspension of <strong>${companyName}</strong> was lifted. You can claim requests from “Available requests” again.`,
          cta: ro ? 'Vezi cererile disponibile' : 'See available requests',
          path: `/${lang}/marketplace`,
        };
      // --- E-admin-platform-3 ---
      case 'quote.expired': {
        const autoClose = formatInstant(payload.autoCloseAt, ro);
        return {
          subject: ro ? `O ofertă a expirat — ${requestTitle}` : `An offer has expired — ${requestTitle}`,
          intro: ro
            ? `Oferta firmei <strong>${companyName}</strong> pentru „${requestTitle}” a expirat și nu mai poate fi acceptată. Poți cere firmei să o prelungească din pagina ofertelor.${
                autoClose ? ` Dacă nu se întâmplă nimic până pe ${esc(autoClose)}, preluarea firmei se închide automat.` : ''
              }`
            : `The offer from <strong>${companyName}</strong> for “${requestTitle}” has expired and can no longer be accepted. You can ask the company to extend it from the offers page.${
                autoClose ? ` If nothing happens by ${esc(autoClose)}, the company's claim will be closed automatically.` : ''
              }`,
          cta: ro ? 'Cere prelungirea' : 'Ask for an extension',
          path: `/${lang}/requests/${requestId}/offers`,
        };
      }
      case 'quote.expired_closed':
        return {
          subject: ro
            ? `O ofertă expirată a fost închisă — ${requestTitle}`
            : `An expired offer was closed — ${requestTitle}`,
          intro: ro
            ? `Oferta firmei <strong>${companyName}</strong> pentru „${requestTitle}” a expirat fără o decizie și a fost închisă. Cererea ta rămâne activă.`
            : `The offer from <strong>${companyName}</strong> for “${requestTitle}” expired without a decision and was closed. Your request stays active.`,
          cta: ro ? 'Vezi cererea' : 'View the request',
          path: `/${lang}/requests/${requestId}/offers`,
        };
      case 'quote.extension_requested':
        return {
          subject: ro
            ? `Clientul cere prelungirea ofertei — ${requestTitle}`
            : `The client asks to extend the offer — ${requestTitle}`,
          intro: ro
            ? `Clientul a cerut prelungirea ofertei expirate a firmei <strong>${companyName}</strong> pentru „${requestTitle}”. Poți prelungi valabilitatea sau trimite o ofertă nouă din fișa preluării.`
            : `The client asked <strong>${companyName}</strong> to extend its expired offer for “${requestTitle}”. You can extend the validity or send a new offer from the claim page.`,
          cta: ro ? 'Deschide preluarea' : 'Open the claim',
          path: claimsPath,
        };
      case 'project.case_opened': {
        // reclamatie dupa finalizare (in garantie): nu e o propunere de anulare, deci alt text
        if (payload.reason === 'WARRANTY_CLAIM') {
          return {
            subject: ro
              ? `Clientul a raportat o problemă după finalizare — ${requestTitle}`
              : `The client reported a problem after completion — ${requestTitle}`,
            intro: ro
              ? `Clientul a raportat o problemă cu mobilierul livrat pentru „${requestTitle}”. Echipa Cozy Home analizează raportul și te contactează.`
              : `The client reported a problem with the furniture delivered for “${requestTitle}”. The Cozy Home team is reviewing the report and will contact you.`,
            cta: ro ? 'Deschide preluarea' : 'Open the claim',
            path: claimsPath,
          };
        }
        const toClient = payload.openedBy === 'COMPANY';
        return {
          subject: ro
            ? `S-a raportat o problemă cu comanda — ${requestTitle}`
            : `A problem was reported with the order — ${requestTitle}`,
          intro: ro
            ? `${
                toClient ? `Firma <strong>${companyName}</strong>` : 'Clientul'
              } a raportat o problemă cu comanda „${requestTitle}”. Spune-ne dacă ești de acord cu anularea de comun acord sau dacă comanda continuă.`
            : `${
                toClient ? `The company <strong>${companyName}</strong>` : 'The client'
              } reported a problem with the order “${requestTitle}”. Let us know whether you agree to cancel by mutual agreement or the order continues.`,
          cta: ro ? 'Răspunde' : 'Respond',
          path: toClient ? `/${lang}/requests/${requestId}/offers` : claimsPath,
        };
      }
      case 'project.cancelled':
        return {
          subject: ro
            ? `Comanda a fost anulată — ${requestTitle}`
            : `The order was cancelled — ${requestTitle}`,
          intro: ro
            ? `Echipa Cozy Home a închis comanda „${requestTitle}” cu firma <strong>${companyName}</strong>.`
            : `The Cozy Home team closed the order “${requestTitle}” with <strong>${companyName}</strong>.`,
          cta: ro ? 'Vezi cererea' : 'View the request',
          path: `/${lang}/requests/${requestId}/offers`,
        };
      case 'project.delivery_reminder': {
        const date = esc(formatDateOnly(payload.deliveryDate, ro));
        return {
          subject: ro
            ? `Se apropie data livrării — ${requestTitle}`
            : `The delivery date is coming up — ${requestTitle}`,
          intro: ro
            ? `Data de livrare stabilită în oferta acceptată pentru „${requestTitle}” este ${date}. Dacă termenul se schimbă, anunță clientul în conversație.`
            : `The delivery date agreed in the accepted offer for “${requestTitle}” is ${date}. If the date changes, let the client know in the conversation.`,
          cta: ro ? 'Deschide comanda' : 'Open the order',
          path: claimsPath,
        };
      }
      case 'project.overdue': {
        const date = esc(formatDateOnly(payload.deliveryDate, ro));
        const isClientRecipient = payload.clientUserId === recipientId;
        return {
          subject: ro
            ? `Data de livrare a trecut — ${requestTitle}`
            : `The delivery date has passed — ${requestTitle}`,
          intro: ro
            ? `Data de livrare din oferta acceptată pentru „${requestTitle}” (${date}) a trecut. Stabiliți în conversație noul termen.`
            : `The delivery date in the accepted offer for “${requestTitle}” (${date}) has passed. Agree on a new date in the conversation.`,
          cta: ro ? 'Deschide conversația' : 'Open the conversation',
          path: isClientRecipient ? `/${lang}/requests/${requestId}/offers` : claimsPath,
        };
      }
      // e4: o firma a renuntat la preluare — fara numele firmei; cererea e din nou in piata
      case 'request.company_withdrew':
        return {
          subject: ro
            ? `O firmă a renunțat la cererea ta — ${requestTitle}`
            : `A company stepped back from your request — ${requestTitle}`,
          intro: ro
            ? `O firmă a renunțat la cererea „${requestTitle}”. Cererea e din nou disponibilă pentru alte firme; nu trebuie să faci nimic.`
            : `A company stepped back from your request “${requestTitle}”. The request is available to other companies again; you don't need to do anything.`,
          cta: ro ? 'Vezi cererea' : 'View the request',
          path: `/${lang}/requests/${requestId}`,
        };
      case 'request.expired':
        return {
          subject: ro
            ? `Cererea ta a expirat — ${requestTitle}`
            : `Your request expired — ${requestTitle}`,
          intro: ro
            ? `Cererea „${requestTitle}” a stat 5 zile lucrătoare la dispoziția firmelor din zonă fără să fie preluată și a expirat. O poți republica din pagina cererii.`
            : `Your request “${requestTitle}” was open to companies in your area for 5 working days without being claimed and has expired. You can repost it from the request page.`,
          cta: ro ? 'Vezi cererea' : 'View the request',
          path: `/${lang}/requests/${requestId}`,
        };
      // E-admin-platform-44 — 4.4: reminder catre client, cererea inca nepreluata
      case 'request.expiry_reminder': {
        const date = esc(formatDateTime(payload.expiresAt, ro));
        return {
          subject: ro
            ? `Cererea ta expiră curând — ${requestTitle}`
            : `Your request expires soon — ${requestTitle}`,
          intro: ro
            ? `Nicio firmă nu a preluat încă cererea „${requestTitle}”. Dacă rămâne nepreluată, expiră pe ${date}. Verifică dacă descrierea, dimensiunile și pozele sunt complete.`
            : `No company has claimed your request “${requestTitle}” yet. If it stays unclaimed, it expires on ${date}. Check that the description, measurements and photos are complete.`,
          cta: ro ? 'Vezi cererea' : 'View the request',
          path: `/${lang}/requests/${requestId}`,
        };
      }
      // E-admin-platform-44 — 4.9 / D2: warning la +30 min, preluare neatribuita
      case 'claim.assign_warning': {
        const date = esc(formatDateTime(payload.assignDeadlineAt, ro));
        return {
          subject: ro
            ? `Atribuie preluarea — ${requestTitle}`
            : `Assign the claim — ${requestTitle}`,
          intro: ro
            ? `Preluarea cererii „${requestTitle}” nu este atribuită nimănui din echipă. Dacă nu o atribui până la ${date}, se anulează automat, iar creditele rezervate revin în portofel.`
            : `The claim on “${requestTitle}” isn't assigned to anyone on your team. If you don't assign it by ${date}, it is cancelled automatically and the reserved credits go back to your wallet.`,
          cta: ro ? 'Atribuie acum' : 'Assign now',
          path: claimsPath,
        };
      }
      // E-admin-platform-44 — 4.11: termenul ofertei se apropie (24h inainte)
      case 'sla.expiring_soon': {
        const date = esc(formatDateTime(payload.slaDeadlineAt, ro));
        // E-company-13 — al doilea reminder: termenul a trecut, a inceput gratia (pana la slaBreachAt)
        if (payload.phase === 'GRACE') {
          const breachDate = esc(formatDateTime(payload.slaBreachAt, ro));
          return {
            subject: ro
              ? `Termenul ofertei a trecut — ${requestTitle}`
              : `Your offer deadline has passed — ${requestTitle}`,
            intro: ro
              ? `Termenul pentru oferta la „${requestTitle}” a trecut (${date}). Mai poți trimite oferta până la ${breachDate}, cât durează perioada de grație. După aceea, preluarea se închide, creditele rezervate se consumă și firma primește puncte de penalizare.`
              : `The deadline for your offer on “${requestTitle}” has passed (${date}). You can still send it until ${breachDate}, during the grace period. After that the claim closes, the reserved credits are consumed and your company gets penalty points.`,
            cta: ro ? 'Trimite oferta acum' : 'Send the offer now',
            path: claimsPath,
          };
        }
        return {
          subject: ro
            ? `Termenul ofertei se apropie — ${requestTitle}`
            : `Your offer deadline is close — ${requestTitle}`,
          intro: ro
            ? `Termenul pentru oferta la „${requestTitle}” este ${date}. Trimite oferta până atunci: după perioada de grație, preluarea se închide, creditele rezervate se consumă și firma primește puncte de penalizare.`
            : `The deadline for your offer on “${requestTitle}” is ${date}. Send it by then: after the grace period the claim closes, the reserved credits are consumed and your company gets penalty points.`,
          cta: ro ? 'Trimite oferta' : 'Send the offer',
          path: claimsPath,
        };
      }
      // a6 (2026-11-14): echipa Cozy Home afla ca o cerere noua nu are nicio firma pe raza
      case 'request.no_coverage': {
        const place = [payload.city, payload.county]
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
          .filter((v) => v.length > 0)
          .map((v) => esc(v))
          .join(', ');
        return {
          subject: ro
            ? `Cerere nouă fără nicio firmă în zonă${place ? ` — ${place}` : ''}`
            : `New request with no company in the area${place ? ` — ${place}` : ''}`,
          intro: ro
            ? `Cererea „${requestTitle}”${place ? ` din <strong>${place}</strong>` : ''} a fost publicată, dar nicio firmă cu abonament activ nu lucrează pe raza ei. Clientul a fost anunțat că echipa caută o firmă în zonă.`
            : `The request “${requestTitle}”${place ? ` in <strong>${place}</strong>` : ''} was published, but no company with an active subscription works within its area. The client was told that the team is looking for a company there.`,
          cta: ro ? 'Vezi cererea în Admin' : 'View the request in Admin',
          path: `/${lang}/admin/requests/${requestId}`,
        };
      }
      // g1 (etapa 9): clientul afla ca cererea e publicata si pana cand ramane disponibila
      case 'request.published': {
        const until = esc(formatDateTime(payload.expiresAt, ro));
        return {
          subject: ro
            ? `Cererea ta e publicată — ${requestTitle}`
            : `Your request is published — ${requestTitle}`,
          intro: ro
            ? `Cererea „${requestTitle}” e publicată, iar firmele din zona ta o pot vedea.${
                until ? ` Rămâne disponibilă până pe ${until}.` : ''
              } Te anunțăm când o firmă o preia.`
            : `Your request “${requestTitle}” is published and companies in your area can see it.${
                until ? ` It stays open until ${until}.` : ''
              } We'll let you know when a company claims it.`,
          cta: ro ? 'Vezi cererea' : 'View the request',
          path: `/${lang}/requests/${requestId}`,
        };
      }
      // g1: finalizarea comenzii → firma (confirmata de client sau automat dupa 14 zile)
      case 'delivery.confirmed': {
        const auto = payload.autoCompleted === true;
        return {
          subject: ro
            ? `Comanda a fost finalizată — ${requestTitle}`
            : `The order is completed — ${requestTitle}`,
          intro: ro
            ? auto
              ? `Au trecut 14 zile de la livrarea comenzii „${requestTitle}” fără o confirmare din partea clientului, așa că am finalizat-o automat.`
              : `Clientul a confirmat primirea comenzii „${requestTitle}”. Comanda firmei <strong>${companyName}</strong> e finalizată.`
            : auto
              ? `14 days passed since the order “${requestTitle}” was delivered without a confirmation from the client, so we completed it automatically.`
              : `The client confirmed receipt of the order “${requestTitle}”. <strong>${companyName}</strong>'s order is completed.`,
          cta: ro ? 'Deschide comanda' : 'Open the order',
          path: claimsPath,
        };
      }
      // g1: recenzia clientului → firma
      case 'review.created': {
        const rating = Number(payload.rating);
        const stars = Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
        const disputed = payload.disputed === true;
        const starsText = stars
          ? ro
            ? ` de ${stars} ${stars === 1 ? 'stea' : 'stele'}`
            : ` of ${stars} ${stars === 1 ? 'star' : 'stars'}`
          : '';
        const disputeLine = disputed
          ? ro
            ? ' Pentru că nota e sub 3 stele, echipa Cozy Home analizează recenzia.'
            : ' Because the rating is below 3 stars, the Cozy Home team is reviewing it.'
          : '';
        return {
          subject: ro
            ? `Ai primit o recenzie — ${requestTitle}`
            : `You received a review — ${requestTitle}`,
          intro: ro
            ? `Clientul a lăsat o recenzie${starsText} firmei <strong>${companyName}</strong> pentru comanda „${requestTitle}”.${disputeLine}`
            : `The client left a review${starsText} for <strong>${companyName}</strong> on the order “${requestTitle}”.${disputeLine}`,
          cta: ro ? 'Deschide comanda' : 'Open the order',
          path: claimsPath,
        };
      }
      // e3: intrebarea firmei → clientul (doar numele firmei, care a preluat deja cererea)
      case 'clarification.asked':
        return {
          subject: ro
            ? `Firma ${companyName} are o întrebare la cererea ta — ${requestTitle}`
            : `${companyName} has a question about your request — ${requestTitle}`,
          intro: ro
            ? `Firma <strong>${companyName}</strong> are o întrebare la cererea „${requestTitle}”. Răspunde din pagina cererii, ca firma să poată pregăti oferta.`
            : `The company <strong>${companyName}</strong> has a question about your request “${requestTitle}”. Answer it from the request page so the company can prepare its offer.`,
          cta: ro ? 'Răspunde la întrebare' : 'Answer the question',
          path: `/${lang}/requests/${requestId}`,
        };
      // e3: raspunsul clientului → firma
      case 'clarification.answered':
        return {
          subject: ro
            ? `Clientul a răspuns la întrebare — ${requestTitle}`
            : `The client answered your question — ${requestTitle}`,
          intro: ro
            ? `Clientul a răspuns la întrebarea firmei <strong>${companyName}</strong> despre „${requestTitle}”. Răspunsul e în fișa preluării.`
            : `The client answered <strong>${companyName}</strong>'s question about “${requestTitle}”. The answer is on the claim page.`,
          cta: ro ? 'Vezi răspunsul' : 'View the answer',
          path: claimsPath,
        };
      // e3: clientul a modificat cererea dupa preluare → firma
      case 'request.edited_after_claim':
        return {
          subject: ro
            ? `Clientul a modificat cererea — ${requestTitle}`
            : `The client changed the request — ${requestTitle}`,
          intro: ro
            ? `Clientul a modificat cererea „${requestTitle}” preluată de firma <strong>${companyName}</strong>. Verifică detaliile noi în fișa preluării înainte să trimiți oferta.`
            : `The client changed the request “${requestTitle}” claimed by <strong>${companyName}</strong>. Check the new details on the claim page before you send your offer.`,
          cta: ro ? 'Vezi modificările' : 'View the changes',
          path: claimsPath,
        };
      default:
        return null;
    }
  }

  // Copia pentru contabil: fara buton (nu are cont) si fara dezabonare (nu e utilizator).
  private wrapBillingContactHtml(content: EmailContent, companyName: string): string {
    return `
      <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #2b2b2b;">
        <p style="letter-spacing: 0.12em; font-size: 12px; color: #8a7355;">COZY HOME</p>
        <p>Bună ziua,</p>
        <p>${content.intro}</p>
        <hr style="border: none; border-top: 1px solid #e5ded4; margin: 28px 0 12px;" />
        ${supportLineHtml('ro', this.mail.supportEmail ?? null)}
        <p style="font-size: 11px; color: #999;">
          Primiți acest email pentru că firma ${esc(companyName)} v-a trecut ca adresă de facturare în Cozy Home.
        </p>
      </div>`;
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
        ${supportLineHtml(lang, this.mail.supportEmail ?? null)}
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
