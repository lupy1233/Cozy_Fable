import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { Browser } from 'puppeteer';
import type { QuoteDto, QuoteVersionDto } from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { CompanyContext } from '../../common/company-context/company-context';
import { QuotesService } from './quotes.service';

// puppeteer 25 e ESM-only. TS (module=commonjs) transforma `import()` in `require()`, ceea ce
// arunca ERR_REQUIRE_ESM. `new Function` pastreaza import-ul dinamic real (nedownlevelat).
const loadPuppeteer = new Function('return import("puppeteer")') as () => Promise<
  typeof import('puppeteer')
>;

// Sprint 6 — PDF oferta (decizie Sprint-0 §9: puppeteer). Dubla afisare RON/EUR (D-v6-12),
// linie design_fee (D-v6-11). Documentul reflecta versiunea curenta a ofertei.
@Injectable()
export class QuotePdfService implements OnModuleDestroy {
  private readonly logger = new Logger(QuotePdfService.name);
  private browser: Browser | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
  }

  async generateForCompany(ctx: CompanyContext, quoteId: string): Promise<Buffer> {
    const dto = await this.quotes.getQuoteForCompany(ctx, quoteId);
    return this.render(dto);
  }

  async generateForClient(userId: string, quoteId: string): Promise<Buffer> {
    const dto = await this.quotes.getQuoteForClient(userId, quoteId);
    return this.render(dto);
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    // import lazy: Chromium porneste doar la prima generare.
    const puppeteer = (await loadPuppeteer()).default;
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    return this.browser;
  }

  private async render(dto: QuoteDto): Promise<Buffer> {
    const request = await this.prisma.request.findUnique({
      where: { id: dto.requestId },
      select: { title: true, addressText: true, city: true, county: true },
    });
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
      select: { name: true, cui: true, regComNumber: true, addressText: true },
    });
    const current = dto.versions.reduce((a, b) => (b.version > a.version ? b : a));
    const html = this.buildHtml(dto, current, {
      requestTitle: request?.title ?? '',
      requestLocation: [request?.city, request?.county].filter(Boolean).join(', '),
      companyName: company?.name ?? dto.companyName,
      companyCui: company?.cui ?? '',
      companyReg: company?.regComNumber ?? '',
      companyAddress: company?.addressText ?? '',
    });

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

  private money(amount: number | null, currency: string): string {
    if (amount == null) return '—';
    return `${new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} ${currency}`;
  }

  private buildHtml(
    dto: QuoteDto,
    v: QuoteVersionDto,
    extra: {
      requestTitle: string;
      requestLocation: string;
      companyName: string;
      companyCui: string;
      companyReg: string;
      companyAddress: string;
    },
  ): string {
    const esc = (s: string | null | undefined) =>
      (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    const altCurrency = dto.currency === 'RON' ? 'EUR' : 'RON';
    const priceMain = this.money(v.price, dto.currency);
    const priceAlt = this.money(dto.currency === 'RON' ? v.priceEur : v.priceRon, altCurrency);
    const designMain = v.designFee != null ? this.money(v.designFee, dto.currency) : null;
    const designAlt =
      v.designFee != null
        ? this.money(dto.currency === 'RON' ? v.designFeeEur : v.designFeeRon, altCurrency)
        : null;

    const designRow = designMain
      ? `<tr><td>Proiectare (design)</td><td class="num">${designMain}<div class="alt">${designAlt}</div></td></tr>`
      : '';

    return `<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><style>
  * { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; }
  body { font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: #6b7280; font-size: 11px; }
  .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin-top: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  td { padding: 6px 4px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  td.num { text-align: right; font-weight: 600; white-space: nowrap; }
  .alt { font-weight: 400; color: #6b7280; font-size: 10px; }
  .total td { border-top: 2px solid #111827; border-bottom: none; font-size: 14px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; }
  .tag { display: inline-block; background: #eef2ff; color: #3730a3; border-radius: 6px; padding: 2px 8px; font-size: 10px; }
</style></head><body>
  <div class="header">
    <div>
      <h1>Ofertă</h1>
      <div class="muted">Versiunea ${v.version}${v.isExtra ? ' (suplimentară)' : ''} · ${esc(dto.status)}</div>
    </div>
    <div style="text-align:right">
      <div class="tag">Curs informativ 1 EUR = ${dto.eurRonRate} RON</div>
      <div class="muted" style="margin-top:6px">Valabil până la: ${new Date(v.validUntil).toLocaleDateString('ro-RO')}</div>
    </div>
  </div>

  <div class="box">
    <strong>${esc(extra.companyName)}</strong>
    <div class="muted">CUI ${esc(extra.companyCui)} · ${esc(extra.companyReg)}</div>
    <div class="muted">${esc(extra.companyAddress)}</div>
  </div>

  <div class="box">
    <div><strong>Proiect:</strong> ${esc(extra.requestTitle)}</div>
    <div class="muted">${esc(extra.requestLocation)}</div>
  </div>

  <div class="box">
    <table>
      <tr><td>Preț lucrare</td><td class="num">${priceMain}<div class="alt">${priceAlt}</div></td></tr>
      ${designRow}
      <tr><td>Termen livrare</td><td class="num">${esc(v.deliveryTerm) || '—'}</td></tr>
      <tr><td>Dată livrare estimată</td><td class="num">${v.deliveryDate ? new Date(v.deliveryDate).toLocaleDateString('ro-RO') : '—'}</td></tr>
      <tr><td>Garanție</td><td class="num">${esc(v.warranty) || '—'}</td></tr>
    </table>
  </div>

  <div class="box">
    <strong>Descriere</strong>
    <div style="margin-top:6px; white-space:pre-wrap">${esc(v.description)}</div>
  </div>

  <p class="muted" style="margin-top:18px">
    Sumă contractuală exprimată în ${dto.currency}. Valoarea în ${altCurrency} este informativă,
    calculată la cursul fix configurat. Document generat automat (mock MVP).
  </p>
</body></html>`;
  }
}
