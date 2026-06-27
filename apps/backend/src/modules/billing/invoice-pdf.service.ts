import { HttpException, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ERROR_CODES } from '@marketplace/shared';
import type { Browser } from 'puppeteer';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PaymentsService } from './payments.service';

// puppeteer 25 e ESM-only; pastram import-ul dinamic real (vezi quote-pdf.service).
const loadPuppeteer = new Function('return import("puppeteer")') as () => Promise<
  typeof import('puppeteer')
>;

// 4.17 — factura mock conforma RO (serie-numar, TVA snapshot, furnizor=platforma).
@Injectable()
export class InvoicePdfService implements OnModuleDestroy {
  private readonly logger = new Logger(InvoicePdfService.name);
  private browser: Browser | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
  }

  async generate(companyId: string, orderId: string): Promise<Buffer> {
    const order = await this.payments.getOrderForCompany(companyId, orderId);
    if (order.status !== 'CONFIRMED' || order.invoiceNumber === null) {
      throw new HttpException(
        { code: ERROR_CODES.PAYMENT_NOT_FOUND, message: 'Invoice not issued yet' },
        409,
      );
    }
    const buyer = await this.prisma.company.findUnique({ where: { id: companyId } });
    const html = this.buildHtml(order, buyer);

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

  private money(n: unknown): string {
    return `${new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n))} RON`;
  }

  private buildHtml(
    order: {
      orderType: string;
      credits: number | null;
      baseAmountRon: unknown;
      vatRate: unknown;
      vatAmountRon: unknown;
      totalRon: unknown;
      invoiceSeries: string | null;
      invoiceNumber: number | null;
      confirmedAt: Date | null;
      sellerSnapshot: unknown;
    },
    buyer: { name: string; cui: string; regComNumber: string; addressText: string } | null,
  ): string {
    const esc = (s: string | null | undefined) =>
      (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    const seller = (order.sellerSnapshot ?? {}) as {
      name?: string; cui?: string; regCom?: string; address?: string; iban?: string;
    };
    const desc =
      order.orderType === 'CREDIT_PACKAGE'
        ? `Pachet ${order.credits} credite marketplace`
        : `Abonament marketplace (${order.credits} credite incluse)`;
    const date = order.confirmedAt ? new Date(order.confirmedAt).toLocaleDateString('ro-RO') : '';

    return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><style>
      * { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; }
      body { font-size: 12px; }
      h1 { font-size: 22px; margin: 0; }
      .muted { color: #6b7280; font-size: 11px; }
      .row { display: flex; justify-content: space-between; gap: 24px; }
      .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin-top: 12px; flex: 1; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
      td.num, th.num { text-align: right; white-space: nowrap; }
      .totals { margin-top: 12px; margin-left: auto; width: 50%; }
      .totals td { border: none; padding: 4px 8px; }
      .total-row td { border-top: 2px solid #111827; font-size: 15px; font-weight: 700; }
    </style></head><body>
      <div class="row" style="align-items:flex-start">
        <div><h1>Factură</h1><div class="muted">Seria ${esc(order.invoiceSeries)} nr. ${order.invoiceNumber} · ${date}</div></div>
        <div class="muted" style="text-align:right">Document mock (MVP) · conform structurii Cod Fiscal RO</div>
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
          <div class="muted">CUI ${esc(buyer?.cui)} · ${esc(buyer?.regComNumber)}</div>
          <div class="muted">${esc(buyer?.addressText)}</div>
        </div>
      </div>
      <table>
        <tr><th>Descriere serviciu</th><th class="num">Bază</th><th class="num">TVA (${Number(order.vatRate)}%)</th><th class="num">Total</th></tr>
        <tr>
          <td>${esc(desc)}</td>
          <td class="num">${this.money(order.baseAmountRon)}</td>
          <td class="num">${this.money(order.vatAmountRon)}</td>
          <td class="num">${this.money(order.totalRon)}</td>
        </tr>
      </table>
      <table class="totals">
        <tr><td>Bază impozabilă</td><td class="num">${this.money(order.baseAmountRon)}</td></tr>
        <tr><td>TVA ${Number(order.vatRate)}%</td><td class="num">${this.money(order.vatAmountRon)}</td></tr>
        <tr class="total-row"><td>Total de plată</td><td class="num">${this.money(order.totalRon)}</td></tr>
      </table>
    </body></html>`;
  }
}
