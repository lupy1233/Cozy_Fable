import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { safeErrorSummary } from '../../common/logging/safe-error';
import { BillingReadinessService } from './billing-readiness.service';
import { InvoicePdfService, orderRef } from './invoice-pdf.service';
import { isDocumentRenderFailed } from './pdf-browser';

export interface BillingEmailExtras {
  orderRef: string;
  totalRon: number;
  orderType: string;
  // datele pentru transfer (null = datele fiscale nu sunt gata → emailul trimite spre portofel)
  transfer: { sellerName: string; cui: string; iban: string } | null;
  cancelAt: string | null;
  attachment: { filename: string; content: Buffer; contentType: 'application/pdf' } | null;
}

const DOCUMENT_EVENTS = new Set([
  'payment.transfer_instructions',
  'payment.transfer_reminder',
  'payment.auto_cancelled',
  'payment.confirmed',
]);
// evenimentele la care atasamentul e proforma (g4)
const PROFORMA_EVENTS = new Set(['payment.transfer_instructions', 'payment.transfer_reminder']);
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 20;

// E-company-24 — rehidrateaza la livrare (workerul de notificari, slotul activ) datele unui
// email de facturare: referinta, suma, IBAN-ul si PDF-ul atasat (proforma / factura). Payloadul
// outbox tine doar id-uri. Procesorul trimite emailul per destinatar, deci PDF-ul randat se
// memoreaza scurt (fara N randari Puppeteer). Un PDF care nu se poate randa NU opreste emailul.
@Injectable()
export class BillingDocumentsService {
  private readonly logger = new Logger(BillingDocumentsService.name);
  private readonly cache = new Map<string, { at: number; pdf: { content: Buffer; filename: string } }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly readiness: BillingReadinessService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  // g4 (etapa 7): dupa ce un e-mail de transfer cu proforma ATASATA chiar a plecat, comanda tine
  // minte momentul (o singura data) — portofelul spune „ti-am trimis proforma” doar atunci.
  // Best-effort: un esec aici nu trebuie sa retrimita e-mailul.
  async markProformaEmailed(type: string, payload: Record<string, unknown>, extras: BillingEmailExtras | null): Promise<void> {
    if (!PROFORMA_EVENTS.has(type) || !extras?.attachment) return;
    const orderId = typeof payload.orderId === 'string' ? payload.orderId : null;
    if (!orderId) return;
    try {
      await this.prisma.mockBillingOrder.updateMany({
        where: { id: orderId, proformaEmailedAt: null },
        data: { proformaEmailedAt: new Date() },
      });
    } catch (e) {
      this.logger.warn(`proforma ${orderId}: marcajul de trimitere nu s-a salvat: ${safeErrorSummary(e)}`);
    }
  }

  async prepare(type: string, payload: Record<string, unknown>): Promise<BillingEmailExtras | null> {
    if (!DOCUMENT_EVENTS.has(type)) return null;
    const orderId = typeof payload.orderId === 'string' ? payload.orderId : null;
    if (!orderId) return null;
    const order = await this.prisma.mockBillingOrder.findUnique({ where: { id: orderId } });
    if (!order || order.companyId !== payload.companyId) return null;

    const readiness = await this.readiness.check();
    const transfer = readiness.ready
      ? { sellerName: readiness.seller.name, cui: readiness.seller.cui, iban: readiness.seller.iban }
      : null;

    let attachment: BillingEmailExtras['attachment'] = null;
    const wantsProforma =
      PROFORMA_EVENTS.has(type) &&
      order.status === 'PENDING' &&
      !order.testMode &&
      readiness.ready;
    const wantsInvoice = type === 'payment.confirmed' && order.status === 'CONFIRMED' && order.invoiceNumber !== null;
    if (wantsProforma || wantsInvoice) {
      const kind = wantsProforma ? 'proforma' : 'invoice';
      try {
        const pdf = await this.cached(`${kind}:${order.id}`, () =>
          wantsProforma ? this.invoicePdf.proformaForOrder(order) : this.invoicePdf.invoiceForOrder(order),
        );
        attachment = { filename: pdf.filename, content: pdf.content, contentType: 'application/pdf' };
      } catch (e) {
        // emailul pleaca oricum, fara atasament (textul indeamna la descarcare din portofel).
        // g4: esecul de randare l-a raportat deja InvoicePdfService (jurnal + clopotel admini);
        // aici doar celelalte motive (ex. comanda nu mai e in asteptare).
        if (!isDocumentRenderFailed(e)) {
          this.logger.warn(`${kind} ${order.id} nu s-a putut atasa la email: ${safeErrorSummary(e)}`);
        }
      }
    }

    return {
      orderRef: orderRef(order.id),
      totalRon: Number(order.totalRon),
      orderType: order.orderType,
      transfer,
      cancelAt: typeof payload.cancelAt === 'string' ? payload.cancelAt : null,
      attachment,
    };
  }

  private async cached(
    key: string,
    render: () => Promise<{ pdf: Buffer; fileName: string }>,
  ): Promise<{ content: Buffer; filename: string }> {
    const now = Date.now();
    for (const [k, v] of this.cache) if (now - v.at > CACHE_TTL_MS) this.cache.delete(k);
    const hit = this.cache.get(key);
    if (hit) return hit.pdf;
    const { pdf, fileName } = await render();
    const entry = { content: pdf, filename: fileName };
    if (this.cache.size >= CACHE_MAX) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { at: now, pdf: entry });
    return entry;
  }
}
