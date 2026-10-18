import { HttpException, Injectable, NotFoundException, type OnModuleDestroy } from '@nestjs/common';
import { ERROR_CODES } from '@marketplace/shared';
import type { MockBillingOrder } from '@prisma/client';
import type { Browser } from 'puppeteer';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { withDeletedRecords } from '../../infra/prisma/soft-delete';
import { formatBucharestDate } from '../../infra/calendar/bucharest-format';
import { PaymentsService } from './payments.service';
import { BillingReadinessService } from './billing-readiness.service';
import type { SellerSnapshot } from './billing-readiness';
import { SettingsService } from '../../common/settings/settings.service';
import { SETTING_BANK_TRANSFER_EXPIRY_DAYS, transferExpiresAt } from './bank-transfer.constants';

// puppeteer 25 e ESM-only; pastram import-ul dinamic real (vezi quote-pdf.service).
const loadPuppeteer = new Function('return import("puppeteer")') as () => Promise<
  typeof import('puppeteer')
>;

export interface InvoiceBuyer {
  name: string;
  cui: string;
  regCom: string;
  address: string;
  // E-company-19: platitor TVA → pe factura apare codul de TVA (prefix RO)
  isVatPayer: boolean;
}

// Campurile comenzii folosite de sablonul facturii (functie pura, testata fara Puppeteer).
export type InvoiceOrder = Pick<
  MockBillingOrder,
  | 'orderType'
  | 'credits'
  | 'baseAmountRon'
  | 'vatRate'
  | 'vatAmountRon'
  | 'totalRon'
  | 'invoiceSeries'
  | 'invoiceNumber'
  | 'confirmedAt'
  | 'paidAt'
  | 'status'
  | 'sellerSnapshot'
  | 'paymentSource'
  | 'stripePaymentIntentId'
>;

// Descrierea serviciului de pe factura (PDF + registrul CSV pentru contabil).
// E-company-19: abonamentul include perioada facturata; comenzile vechi (fara perioada) nu o afiseaza.
export function invoiceDescription(
  order: Pick<MockBillingOrder, 'orderType' | 'credits'> &
    Partial<Pick<MockBillingOrder, 'servicePeriodStart' | 'servicePeriodEnd'>>,
  tier: string | null = null, // codul planului (E-admin-platform-58)
): string {
  if (order.orderType === 'CREDIT_PACKAGE') return `Pachet ${order.credits} credite marketplace`;
  const base = `Abonament marketplace ${tier ?? ''} — ${order.credits ?? 0} credite incluse`.replace(/\s+/g, ' ');
  const start = order.servicePeriodStart;
  const end = order.servicePeriodEnd;
  return start && end ? `${base}, perioada ${formatBucharestDate(start)} – ${formatBucharestDate(end)}` : base;
}

// E-admin-platform-4 — cumparatorul inghetat la confirmare (buyer_snapshot); comenzile vechi
// (fara snapshot) citesc firma live, inclusiv stearsa (factura emisa).
// Snapshot v1 (fara isVatPayer, cui salvat cu prefix RO) → platitor daca cui incepe cu RO.
export function buyerFromSnapshot(snapshot: unknown): InvoiceBuyer | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const s = snapshot as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    name: str(s.name),
    cui: str(s.cui),
    regCom: str(s.regCom),
    address: str(s.address),
    isVatPayer: s.isVatPayer === true || /^RO/i.test(str(s.cui).trim()),
  };
}

export function buyerFromCompany(
  company: { name: string; cui: string; regComNumber: string; addressText: string; isVatPayer?: boolean } | null,
): InvoiceBuyer | null {
  return company
    ? {
        name: company.name,
        cui: company.cui,
        regCom: company.regComNumber,
        address: company.addressText,
        isVatPayer: !!company.isVatPayer || /^RO/i.test(company.cui.trim()),
      }
    : null;
}

// Codul fiscal tiparit: 'RO' + cifre pentru platitorii de TVA (cod de TVA), altfel doar CUI-ul.
export function buyerFiscalCode(b: InvoiceBuyer): string {
  const digits = b.cui.trim().toUpperCase().replace(/^RO/, '');
  return b.isVatPayer ? `RO${digits}` : digits;
}

// Metoda de plata dupa payment_source ('webhook' = mock istoric).
export function paymentMethodLabel(source: string | null): string {
  switch (source) {
    case 'stripe':
      return 'card (Stripe)';
    case 'admin':
      return 'transfer bancar';
    case 'webhook':
      return 'plată online';
    default:
      return '';
  }
}

// Numele fisierului descarcat: factura-{serie}-{numar}.pdf (seria curatata, sigura in header).
export function invoiceFileName(o: { invoiceSeries: string | null; invoiceNumber: number | null }): string {
  return `factura-${(o.invoiceSeries ?? '').replace(/[^A-Za-z0-9_-]/g, '')}-${o.invoiceNumber}.pdf`;
}

// E-company-24: referinta comenzii (aceeasi in portofel, admin, email si proforma) — firma o
// scrie la detaliile transferului: „Comanda {REF}”.
export function orderRef(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function proformaFileName(id: string): string {
  return `proforma-${orderRef(id).replace(/[^A-Z0-9]/g, '')}.pdf`;
}

function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function money(n: unknown): string {
  return `${new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n))} RON`;
}

// Stilul comun factura/proforma (E-company-24: extras din sablon, iesirea facturii identica).
const INVOICE_CSS = `
      * { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; }
      body { font-size: 12px; }
      h1 { font-size: 22px; margin: 0; }
      .muted { color: #6b7280; font-size: 11px; }
      .row { display: flex; justify-content: space-between; gap: 24px; }
      .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin-top: 12px; flex: 1; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
      th { font-size: 11px; }
      th:first-child, td:first-child { white-space: nowrap; }
      td.num, th.num { text-align: right; white-space: nowrap; }
      .totals { margin-top: 12px; margin-left: auto; width: 50%; }
      .totals td { border: none; padding: 4px 8px; }
      .total-row td { border-top: 2px solid #111827; font-size: 15px; font-weight: 700; }
      .paid { margin-top: 14px; margin-left: auto; width: 50%; padding: 8px 10px; border: 1px solid #d1fae5; background: #ecfdf5; border-radius: 8px; }
    `;

// 4.17 + E-company-19 — continutul facturii: data emiterii (Bucuresti), U.M./Cant./pret unitar,
// cod TVA al clientului, "Total factură" + mentiunea de plata (factura se emite doar la plata confirmata).
export function buildInvoiceHtml(order: InvoiceOrder, buyer: InvoiceBuyer | null, desc: string): string {
  const seller = (order.sellerSnapshot ?? {}) as {
    name?: string; cui?: string; regCom?: string; address?: string; iban?: string;
  };
  const issueDate = formatBucharestDate(order.confirmedAt);
  const vatRate = Number(order.vatRate);
  // IBAN doar pe facturile platite prin transfer bancar (ramane in seller_snapshot, 4.17)
  const ibanLine =
    order.paymentSource === 'admin' && seller.iban ? `<div class="muted">IBAN ${esc(seller.iban)}</div>` : '';
  const buyerCode = buyer ? `${buyer.isVatPayer ? 'Cod TVA' : 'CUI'} ${esc(buyerFiscalCode(buyer))}` : '';
  const method = paymentMethodLabel(order.paymentSource);
  const paidDate = formatBucharestDate(order.paidAt ?? order.confirmedAt);
  const paidDetails = [
    method ? ` — ${esc(method)}` : '',
    paidDate ? `, ${esc(paidDate)}` : '',
    order.stripePaymentIntentId ? `, ref. ${esc(order.stripePaymentIntentId)}` : '',
  ].join('');
  const paidBlock =
    order.status === 'CONFIRMED'
      ? `<div class="paid">
          <div>Achitat: ${money(order.totalRon)}${paidDetails}</div>
          <div>Rest de plată: ${money(0)}</div>
        </div>`
      : '';

  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><style>${INVOICE_CSS}</style></head><body>
      <div class="row" style="align-items:flex-start">
        <div>
          <h1>Factură</h1>
          <div class="muted">Seria ${esc(order.invoiceSeries)} nr. ${order.invoiceNumber ?? ''}</div>
          <div class="muted">Data emiterii: ${esc(issueDate)}</div>
        </div>
        <div class="muted" style="text-align:right">Factură emisă electronic · valabilă fără semnătură și ștampilă (Cod Fiscal art. 319)</div>
      </div>
      <div class="row">
        <div class="box">
          <strong>Furnizor</strong>
          <div>${esc(seller.name)}</div>
          <div class="muted">CUI ${esc(seller.cui)} · ${esc(seller.regCom)}</div>
          <div class="muted">${esc(seller.address)}</div>
          ${ibanLine}
        </div>
        <div class="box">
          <strong>Client</strong>
          <div>${esc(buyer?.name)}</div>
          <div class="muted">${buyerCode}</div>
          <div class="muted">Reg. Com. ${esc(buyer?.regCom)}</div>
          <div class="muted">${esc(buyer?.address)}</div>
        </div>
      </div>
      <table>
        <tr>
          <th>Nr. crt.</th>
          <th>Denumire serviciu</th>
          <th>U.M.</th>
          <th class="num">Cant.</th>
          <th class="num">Preț unitar (fără TVA)</th>
          <th class="num">Valoare (fără TVA)</th>
          <th class="num">TVA (${vatRate}%)</th>
        </tr>
        <tr>
          <td>1</td>
          <td>${esc(desc)}</td>
          <td>buc</td>
          <td class="num">1</td>
          <td class="num">${money(order.baseAmountRon)}</td>
          <td class="num">${money(order.baseAmountRon)}</td>
          <td class="num">${money(order.vatAmountRon)}</td>
        </tr>
      </table>
      <table class="totals">
        <tr><td>Bază impozabilă</td><td class="num">${money(order.baseAmountRon)}</td></tr>
        <tr><td>TVA ${vatRate}%</td><td class="num">${money(order.vatAmountRon)}</td></tr>
        <tr class="total-row"><td>Total factură</td><td class="num">${money(order.totalRon)}</td></tr>
      </table>
      ${paidBlock}
    </body></html>`;
}

export type ProformaOrder = Pick<
  MockBillingOrder,
  'id' | 'createdAt' | 'orderType' | 'credits' | 'baseAmountRon' | 'vatRate' | 'vatAmountRon' | 'totalRon'
>;

// E-company-24 — factura proforma pentru plata prin transfer bancar. NU e document fiscal: nu
// consuma numar din seria facturilor (4.17 — numarul se aloca doar la plata confirmata);
// identificata prin referinta comenzii. Vanzatorul = datele live (assertReady), cu IBAN.
export function buildProformaHtml(
  order: ProformaOrder,
  buyer: InvoiceBuyer | null,
  seller: SellerSnapshot,
  desc: string,
  validUntil: Date | null,
): string {
  const ref = orderRef(order.id);
  const vatRate = Number(order.vatRate);
  const buyerCode = buyer ? `${buyer.isVatPayer ? 'Cod TVA' : 'CUI'} ${esc(buyerFiscalCode(buyer))}` : '';
  const validLine = validUntil ? `<div>Valabilă până la ${esc(formatBucharestDate(validUntil))}</div>` : '';

  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><style>${INVOICE_CSS}
      .pay { margin-top: 18px; padding: 10px 12px; border: 1px solid #fde68a; background: #fffbeb; border-radius: 8px; }
      .note { margin-top: 18px; font-weight: 600; }
    </style></head><body>
      <div class="row" style="align-items:flex-start">
        <div>
          <h1>Factură proformă</h1>
          <div class="muted">Nr. ${esc(ref)}</div>
          <div class="muted">Data: ${esc(formatBucharestDate(order.createdAt))}</div>
        </div>
      </div>
      <div class="row">
        <div class="box">
          <strong>Furnizor</strong>
          <div>${esc(seller.name)}</div>
          <div class="muted">CUI ${esc(seller.cui)} · ${esc(seller.regCom)}</div>
          <div class="muted">${esc(seller.address)}</div>
          <div class="muted">IBAN ${esc(seller.iban)}</div>
        </div>
        <div class="box">
          <strong>Client</strong>
          <div>${esc(buyer?.name)}</div>
          <div class="muted">${buyerCode}</div>
          <div class="muted">Reg. Com. ${esc(buyer?.regCom)}</div>
          <div class="muted">${esc(buyer?.address)}</div>
        </div>
      </div>
      <table>
        <tr>
          <th>Nr. crt.</th>
          <th>Denumire serviciu</th>
          <th>U.M.</th>
          <th class="num">Cant.</th>
          <th class="num">Preț unitar (fără TVA)</th>
          <th class="num">Valoare (fără TVA)</th>
          <th class="num">TVA (${vatRate}%)</th>
        </tr>
        <tr>
          <td>1</td>
          <td>${esc(desc)}</td>
          <td>buc</td>
          <td class="num">1</td>
          <td class="num">${money(order.baseAmountRon)}</td>
          <td class="num">${money(order.baseAmountRon)}</td>
          <td class="num">${money(order.vatAmountRon)}</td>
        </tr>
      </table>
      <table class="totals">
        <tr><td>Bază impozabilă</td><td class="num">${money(order.baseAmountRon)}</td></tr>
        <tr><td>TVA ${vatRate}%</td><td class="num">${money(order.vatAmountRon)}</td></tr>
        <tr class="total-row"><td>Total de plată</td><td class="num">${money(order.totalRon)}</td></tr>
      </table>
      <div class="pay">
        <div>Plătește prin transfer bancar în contul ${esc(seller.iban)} (${esc(seller.name)}), cu mențiunea „Comanda ${esc(ref)}”.</div>
        ${validLine}
      </div>
      <div class="note">Document fără valoare fiscală — factura se emite după confirmarea plății.</div>
    </body></html>`;
}

// 4.17 — factura conforma RO (serie-numar, TVA snapshot, furnizor=platforma), emisa la
// confirmarea platii (Stripe webhook / admin). Furnizorul vine din seller_snapshot, clientul
// din buyer_snapshot (E-admin-platform-4), ambele inghetate la emitere.
@Injectable()
export class InvoicePdfService implements OnModuleDestroy {
  private browser: Browser | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly readiness: BillingReadinessService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
  }

  async generate(companyId: string, orderId: string): Promise<{ pdf: Buffer; fileName: string }> {
    const order = await this.payments.getOrderForCompany(companyId, orderId);
    return this.render(order);
  }

  // Admin: descarcare PDF pentru orice comanda (export lunar catre contabil).
  async generateForAdmin(orderId: string): Promise<{ pdf: Buffer; fileName: string }> {
    const order = await this.prisma.mockBillingOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException({ code: ERROR_CODES.PAYMENT_NOT_FOUND, message: 'Order not found' });
    return this.render(order);
  }

  // E-company-24: proforma unei comenzi in asteptare (firma, OWNER/MANAGER).
  async generateProforma(companyId: string, orderId: string): Promise<{ pdf: Buffer; fileName: string }> {
    const order = await this.payments.getOrderForCompany(companyId, orderId);
    return this.proformaForOrder(order);
  }

  // HTML-ul proformei; 409 daca comanda nu mai asteapta plata (sau e de test), 503 fara date fiscale.
  async proformaHtml(order: MockBillingOrder): Promise<string> {
    if (order.status !== 'PENDING' || order.testMode) {
      throw new HttpException({ code: ERROR_CODES.PAYMENT_NOT_PENDING, message: 'Order is not pending' }, 409);
    }
    const seller = await this.readiness.assertReady();
    // PENDING → fara buyer_snapshot, deci firma live (cea care va aparea pe factura)
    const [buyer, plan, expiryDays] = await Promise.all([
      this.resolveBuyer(order),
      order.planId ? this.prisma.subscriptionPlan.findUnique({ where: { id: order.planId }, select: { code: true } }) : null,
      this.settings.getInt(SETTING_BANK_TRANSFER_EXPIRY_DAYS, 0),
    ]);
    return buildProformaHtml(order, buyer, seller, invoiceDescription(order, plan?.code ?? null), transferExpiresAt(order, expiryDays));
  }

  async proformaForOrder(order: MockBillingOrder): Promise<{ pdf: Buffer; fileName: string }> {
    const html = await this.proformaHtml(order);
    return { pdf: await this.renderHtml(html), fileName: proformaFileName(order.id) };
  }

  async invoiceForOrder(order: MockBillingOrder): Promise<{ pdf: Buffer; fileName: string }> {
    return this.render(order);
  }

  // Snapshot-ul de la emitere are prioritate; comenzile vechi (fara snapshot) citesc firma live.
  async resolveBuyer(order: Pick<MockBillingOrder, 'buyerSnapshot' | 'companyId'>): Promise<InvoiceBuyer | null> {
    const frozen = buyerFromSnapshot(order.buyerSnapshot);
    if (frozen) return frozen;
    const company = await withDeletedRecords('ISSUED_INVOICE', () =>
      this.prisma.company.findUnique({
        where: { id: order.companyId },
        select: { name: true, cui: true, regComNumber: true, addressText: true, isVatPayer: true },
      }),
    );
    return buyerFromCompany(company);
  }

  // HTML-ul complet al facturii (fara Puppeteer); 409 daca factura nu e emisa.
  async invoiceHtml(order: MockBillingOrder): Promise<string> {
    // comenzile test nu au numar fiscal → tot 409
    if (order.status !== 'CONFIRMED' || order.invoiceNumber === null) {
      throw new HttpException(
        { code: ERROR_CODES.PAYMENT_NOT_FOUND, message: 'Invoice not issued yet' },
        409,
      );
    }
    const [buyer, plan] = await Promise.all([
      this.resolveBuyer(order),
      order.planId ? this.prisma.subscriptionPlan.findUnique({ where: { id: order.planId }, select: { code: true } }) : null,
    ]);
    return buildInvoiceHtml(order, buyer, invoiceDescription(order, plan?.code ?? null));
  }

  private async render(order: MockBillingOrder): Promise<{ pdf: Buffer; fileName: string }> {
    const html = await this.invoiceHtml(order);
    return { pdf: await this.renderHtml(html), fileName: invoiceFileName(order) };
  }

  private async renderHtml(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    const puppeteer = (await loadPuppeteer()).default;
    this.browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    return this.browser;
  }
}
