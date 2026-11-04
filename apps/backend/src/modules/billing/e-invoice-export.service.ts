import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import { withDeletedRecords } from '../../infra/prisma/soft-delete';
import { buyerFiscalCode, buyerFromCompany, buyerFromSnapshot, invoiceDescription } from './invoice-pdf.service';

export const E_INVOICE_CSV_HEADER = [
  'invoice',
  'issue_date',
  'buyer_name',
  'buyer_cui',
  'buyer_reg_com',
  'buyer_address',
  'description',
  'base_ron',
  'vat_rate',
  'vat_ron',
  'total_ron',
  'payment_source',
  'e_invoice_status',
  'anaf_upload_id',
] as const;

// Celulele care incep cu = + - @ TAB CR sunt interpretate ca formule in Excel/Sheets.
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const money = (v: Prisma.Decimal | number) => Number(v).toFixed(2);

export const UTF8_BOM = String.fromCharCode(0xfeff);

// E-admin-platform-4 — registrul lunar al facturilor confirmate (ruta manuala e-Factura):
// contabilul il foloseste pentru incarcarea in SPV. Luna = calendar Europe/Bucharest pe
// confirmed_at (invarianta 3.3). Nu se logheaza nimic din datele cumparatorului.
@Injectable()
export class EInvoiceExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: BusinessCalendarService,
  ) {}

  monthRange(month: string): { from: Date; to: Date } {
    const [year, mon] = month.split('-').map(Number);
    const next = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`;
    return {
      from: this.calendar.bucharestWallClock(`${month}-01`, 0),
      to: this.calendar.bucharestWallClock(`${next}-01`, 0),
    };
  }

  async monthCsv(month: string): Promise<Buffer> {
    const { from, to } = this.monthRange(month);
    const [orders, plans] = await Promise.all([
      withDeletedRecords('ISSUED_INVOICE', () =>
        this.prisma.mockBillingOrder.findMany({
          where: { status: 'CONFIRMED', testMode: false, invoiceNumber: { not: null }, confirmedAt: { gte: from, lt: to } },
          orderBy: [{ invoiceSeries: 'asc' }, { invoiceNumber: 'asc' }],
          include: { company: { select: { name: true, cui: true, regComNumber: true, addressText: true, isVatPayer: true } } },
        }),
      ),
      this.prisma.subscriptionPlan.findMany({ select: { id: true, code: true } }),
    ]);
    const tiers = new Map<string, string>(plans.map((p) => [p.id, p.code]));
    const lines = [E_INVOICE_CSV_HEADER.join(',')];
    for (const o of orders) {
      const buyer = buyerFromSnapshot(o.buyerSnapshot) ?? buyerFromCompany(o.company);
      const eInvoiceStatus = o.eInvoiceStatus ?? 'PENDING';
      lines.push(
        [
          `${o.invoiceSeries}-${o.invoiceNumber}`,
          o.confirmedAt ? this.calendar.todayInBucharest(o.confirmedAt) : '',
          buyer?.name,
          // E-company-19: codul fiscal exact ca pe factura (RO + cifre doar la platitorii de TVA)
          buyer ? buyerFiscalCode(buyer) : '',
          buyer?.regCom,
          buyer?.address,
          invoiceDescription(o, o.planId ? (tiers.get(o.planId) ?? null) : null),
          money(o.baseAmountRon),
          money(o.vatRate),
          money(o.vatAmountRon),
          money(o.totalRon),
          o.paymentSource,
          eInvoiceStatus,
          o.anafUploadId,
        ]
          .map(csvCell)
          .join(','),
      );
    }
    // BOM UTF-8 ca Excel sa afiseze corect diacriticele; CRLF conform RFC 4180
    return Buffer.from(`${UTF8_BOM}${lines.join('\r\n')}\r\n`, 'utf8');
  }
}
