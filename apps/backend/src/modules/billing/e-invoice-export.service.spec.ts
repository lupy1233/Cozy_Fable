import { Prisma } from '@prisma/client';
import { E_INVOICE_CSV_HEADER, EInvoiceExportService, UTF8_BOM, csvCell } from './e-invoice-export.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';

// E-admin-platform-4 — registrul lunar pentru contabil (CSV RFC 4180, BOM, anti formula-injection).

/* eslint-disable @typescript-eslint/no-explicit-any */

function order(over: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    companyId: 'c1',
    orderType: 'CREDIT_PACKAGE',
    status: 'CONFIRMED',
    planId: null,
    credits: 50,
    baseAmountRon: new Prisma.Decimal('400'),
    vatRate: new Prisma.Decimal('21'),
    vatAmountRon: new Prisma.Decimal('84'),
    totalRon: new Prisma.Decimal('484'),
    invoiceSeries: 'MM',
    invoiceNumber: 5,
    paymentSource: 'admin',
    confirmedAt: new Date('2026-09-30T22:30:00Z'), // 1 oct 01:30 in Bucuresti
    eInvoiceStatus: 'PENDING',
    anafUploadId: null,
    buyerSnapshot: { name: 'Mobila, "Premium" SRL', cui: 'RO40298306', regCom: 'J12/3/2020', address: 'Cluj' },
    company: { name: 'Live name', cui: 'X', regComNumber: 'Y', addressText: 'Z' },
    ...over,
  };
}

function build(rows: unknown[]) {
  const prisma: any = {
    mockBillingOrder: { findMany: jest.fn().mockResolvedValue(rows) },
    subscriptionPlan: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const calendar = {
    bucharestWallClock: jest.fn((d: string) => new Date(`${d}T00:00:00+03:00`)),
    todayInBucharest: jest.fn(() => '2026-10-01'),
  } as unknown as BusinessCalendarService;
  return { prisma, calendar, service: new EInvoiceExportService(prisma as PrismaService, calendar) };
}

describe('EInvoiceExportService', () => {
  it('antet, BOM, CRLF si ghilimele RFC 4180 pentru virgula/ghilimele din numele cumparatorului', async () => {
    const { service } = build([order()]);
    const csv = (await service.monthCsv('2026-10')).toString('utf8');
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe(E_INVOICE_CSV_HEADER.join(','));
    expect(lines[1]).toBe('MM-5,2026-10-01,"Mobila, ""Premium"" SRL",RO40298306,J12/3/2020,Cluj,Pachet 50 credite marketplace,400.00,21.00,84.00,484.00,admin,PENDING,');
    expect(lines[2]).toBe('');
  });

  it('neutralizeaza formula-injection (= + - @) cu apostrof', async () => {
    const { service } = build([order({ buyerSnapshot: { name: '=HYPERLINK("x")', cui: '+1', regCom: '-2', address: '@SUM(A1)' } })]);
    const csv = (await service.monthCsv('2026-10')).toString('utf8');
    expect(csv).toContain(`"'=HYPERLINK(""x"")",'+1,'-2,'@SUM(A1)`);
    expect(csvCell('\tcmd')).toBe(`'\tcmd`);
  });

  it('fara buyer_snapshot (comenzi vechi) → firma citita live; luna in Europe/Bucharest, fara comenzi test', async () => {
    const { service, prisma, calendar } = build([order({ buyerSnapshot: null, eInvoiceStatus: null })]);
    const csv = (await service.monthCsv('2026-12')).toString('utf8');
    expect(csv).toContain('MM-5,2026-10-01,Live name,X,Y,Z,');
    expect(csv).toContain(',PENDING,');
    expect(calendar.bucharestWallClock).toHaveBeenCalledWith('2026-12-01', 0);
    expect(calendar.bucharestWallClock).toHaveBeenCalledWith('2027-01-01', 0);
    expect(prisma.mockBillingOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'CONFIRMED', testMode: false, invoiceNumber: { not: null } }),
    }));
  });

  it('E-company-19: buyer_cui = codul fiscal tiparit pe factura (RO doar la platitorii de TVA)', async () => {
    const { service } = build([
      order({ invoiceNumber: 6, buyerSnapshot: { name: 'Neplatitor SRL', cui: '12345678', regCom: 'J1/1/2020', address: 'Iasi', isVatPayer: false } }),
      order({ invoiceNumber: 7, buyerSnapshot: { name: 'Platitor SRL', cui: '7850265', regCom: 'J2/2/2020', address: 'Arad', isVatPayer: true } }),
    ]);
    const csv = (await service.monthCsv('2026-10')).toString('utf8');
    expect(csv).toContain('MM-6,2026-10-01,Neplatitor SRL,12345678,');
    expect(csv).toContain('MM-7,2026-10-01,Platitor SRL,RO7850265,');
  });
});
