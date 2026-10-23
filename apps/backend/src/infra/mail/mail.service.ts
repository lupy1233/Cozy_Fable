import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { safeErrorSummary } from '../../common/logging/safe-error';
import { domainsAligned, parseMailbox } from '../../config/mail-rules';

export interface MailSendOptions {
  // Reply-To = SUPPORT_EMAIL, opt-in per email: nu pe chat/oferte, ca raspunsurile cu
  // continut privat de proiect sa nu ajunga in inboxul de suport.
  replyToSupport?: boolean;
  // E-company-24: documente atasate (proforma/factura PDF); continutul nu se logheaza niciodata
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}

@Injectable()
export class MailService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  readonly supportEmail: string | null;
  private readonly production: boolean;
  private readonly allowDev: boolean;
  private readonly host: string;
  private readonly port: number;

  constructor(private readonly config: ConfigService) {
    this.from = config.getOrThrow<string>('MAIL_FROM');
    this.supportEmail = config.get<string>('SUPPORT_EMAIL') ?? null;
    this.production = config.get<string>('NODE_ENV') === 'production';
    this.allowDev = config.get<boolean>('SMTP_ALLOW_DEV_HOST') === true;
    this.host = config.getOrThrow<string>('SMTP_HOST');
    this.port = config.getOrThrow<number>('SMTP_PORT');
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    const secure = config.get<boolean>('SMTP_SECURE') ?? false;
    this.transporter = createTransport({
      host: this.host,
      port: this.port,
      // dev (Mailpit): fara TLS si fara auth; prod: SMTP_SECURE=true (465) sau
      // STARTTLS impus (587) + SMTP_USER/PASS
      secure,
      requireTLS: this.production && !this.allowDev && !secure,
      auth: user && pass ? { user, pass } : undefined,
      // un SMTP care nu raspunde nu tine workerul de notificari agatat
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
  }

  get fromAddress(): string {
    return this.from;
  }

  async send(to: string, subject: string, html: string, opts: MailSendOptions = {}): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html,
      ...(opts.replyToSupport && this.supportEmail ? { replyTo: this.supportEmail } : {}),
      ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
    });
  }

  // Conexiune + autentificare SMTP; intoarce doar clasificarea erorii, niciodata
  // mesajul brut al providerului (poate contine adrese/userul SMTP).
  async verifyConnection(): Promise<{ ok: boolean; error: string | null }> {
    try {
      await this.transporter.verify();
      return { ok: true, error: null };
    } catch (e) {
      return { ok: false, error: safeErrorSummary(e) };
    }
  }

  // Non-blocant: un SMTP cazut la boot se logheaza, dar nu opreste site-ul.
  onApplicationBootstrap(): void {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    void this.verifyConnection().then((res) => {
      if (res.ok) this.logger.log(`SMTP verify ok host=${this.host}:${this.port}`);
      else this.logger.warn(`SMTP verify a esuat ${res.error ?? ''}`);
    });
    // doar in productie: in dev expeditorul si site-ul sunt intentionat pe domenii diferite
    if (!this.production || this.allowDev) return;
    const mailbox = parseMailbox(this.from);
    const siteHost = hostnameOf(this.config.get<string>('FRONTEND_ORIGIN'));
    if (mailbox && siteHost && !domainsAligned(mailbox.domain, siteHost)) {
      this.logger.warn(
        `MAIL_FROM (${mailbox.domain}) nu e pe domeniul site-ului (${siteHost}) — verifica SPF/DKIM/DMARC la provider`,
      );
    }
  }
}

function hostnameOf(origin: string | undefined): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}
