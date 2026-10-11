import { Prisma } from '@prisma/client';
import {
  InvoicePdfService,
  buildInvoiceHtml,
  buildProformaHtml,
  orderRef,
  proformaFileName,
  buyerFiscalCode,
  buyerFromCompany,
  buyerFromSnapshot,
  invoiceDescription,
  invoiceFileName,
  paymentMethodLabel,
  type InvoiceBuyer,
  type InvoiceOrder,
} from './invoice-pdf.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { PaymentsService } from './payments.service';
import type { BillingReadinessService } from './billing-readiness.service';
import type { SettingsService } from '../../common/settings/settings.service';

// E-company-19 — continutul facturii (functii pure, fara Puppeteer): data emiterii in
// Europe/Bucharest, cod TVA client, U.M./Cant./pret unitar, "Achitat", nume fisier.

/* eslint-disable @typescript-eslint/no-explicit-any */

const SELLER = {
  name: 'Platforma SRL',
  cui: 'RO12345674',
  regCom: 'J40/1/2026',
  address: 'Str. Reala 1, Bucuresti',
  iban: 'RO08TEST0000000000000001',
};

function order(over: Partial<InvoiceOrder> = {}): InvoiceOrder {
  return {
    orderType: 'CREDIT_PACKAGE',
    credits: 10,
    baseAmountRon: new Prisma.Decimal('100.00'),
    vatRate: new Prisma.Decimal('21.00'),
    vatAmountRon: new Prisma.Decimal('21.00'),
    totalRon: new Prisma.Decimal('121.00'),
    invoiceSeries: 'MM',
    invoiceNumber: 42,
    confirmedAt: new Date('2026-03-01T23:30:00Z'),
    paidAt: null,
    status: 'CONFIRMED',
    sellerSnapshot: SELLER,
    paymentSource: 'admin',
    stripePaymentIntentId: null,
    ...over,
  };
}

const BUYER: InvoiceBuyer = { name: 'A Mobila Premium', cui: '7850265', regCom: 'J40/2/2020', address: 'Bucuresti', isVatPayer: true };

describe('buildInvoiceHtml', () => {
  it('(a) data emiterii in Europe/Bucharest: 23:30 UTC = 02.03.2026', () => {
    const html = buildInvoiceHtml(order(), BUYER, 'Pachet 10 credite marketplace');
    expect(html).toContain('Data emiterii: 02.03.2026');
    expect(html).toContain('Seria MM nr. 42');
  });

  it('(b) cumparatorul din snapshot apare pe factura (nu firma live)', () => {
    const buyer = buyerFromSnapshot({ name: 'Vechi SRL', cui: '12345678', regCom: 'J1/1/2020', address: 'Iasi', isVatPayer: false });
    const html = buildInvoiceHtml(order(), buyer, 'x');
    expect(html).toContain('Vechi SRL');
    expect(html).toContain('Reg. Com. J1/1/2020');
  });

  it('(c) cod TVA pentru platitori, CUI simplu altfel; snapshot v1 cu RO → platitor', () => {
    expect(buildInvoiceHtml(order(), { ...BUYER, isVatPayer: true }, 'x')).toContain('Cod TVA RO7850265');
    const plain = buildInvoiceHtml(order(), { ...BUYER, cui: '12345678', isVatPayer: false }, 'x');
    expect(plain).toContain('CUI 12345678');
    expect(plain).not.toContain('Cod TVA');
    const v1 = buyerFromSnapshot({ name: 'Mobila, "Premium" SRL', cui: 'RO40298306', regCom: 'J12/3/2020', address: 'Cluj' });
    expect(v1?.isVatPayer).toBe(true);
    expect(buildInvoiceHtml(order(), v1, 'x')).toContain('Cod TVA RO40298306');
    expect(buildInvoiceHtml(order(), v1, 'x')).toContain('Mobila, &quot;Premium&quot; SRL');
  });

  it('(d) platita cu cardul: Achitat + metoda + data + referinta, fara IBAN', () => {
    const html = buildInvoiceHtml(
      order({ paymentSource: 'stripe', paidAt: new Date('2026-03-01T23:30:00Z'), stripePaymentIntentId: 'pi_123' }),
      BUYER,
      'x',
    );
    expect(html).toContain('Achitat');
    expect(html).toContain('card (Stripe)');
    expect(html).toContain('02.03.2026');
    expect(html).toContain('pi_123');
    expect(html).toContain('Rest de plată');
    expect(html).toContain('Total factură');
    expect(html).not.toContain('IBAN');
    expect(html).not.toContain('Total de plată');
  });

  it('(e) transfer bancar: metoda + IBAN furnizorului', () => {
    const html = buildInvoiceHtml(order({ paymentSource: 'admin' }), BUYER, 'x');
    expect(html).toContain('transfer bancar');
    expect(html).toContain(`IBAN ${SELLER.iban}`);
  });

  it('(f) tabelul de linii are U.M., Cant., pret unitar fara TVA', () => {
    const html = buildInvoiceHtml(order(), BUYER, 'x');
    expect(html).toContain('U.M.');
    expect(html).toContain('Cant.');
    expect(html).toContain('Preț unitar');
    expect(html).toContain('<td>buc</td>');
  });
});

describe('invoiceDescription / invoiceFileName / helpers', () => {
  it('(g) abonament cu perioada (date Bucuresti); fara perioada → fara "perioada"', () => {
    const sub = {
      orderType: 'SUBSCRIPTION' as const,
      credits: 30,
      servicePeriodStart: new Date('2026-10-01T08:00:00Z'),
      servicePeriodEnd: new Date('2026-10-31T08:00:00Z'),
    };
    expect(invoiceDescription(sub, 'GOLD')).toBe('Abonament marketplace GOLD — 30 credite incluse, perioada 01.10.2026 – 31.10.2026');
    const old = { ...sub, servicePeriodStart: null, servicePeriodEnd: null };
    expect(invoiceDescription(old, 'GOLD')).toBe('Abonament marketplace GOLD — 30 credite incluse');
    expect(invoiceDescription(old, null)).toBe('Abonament marketplace — 30 credite incluse');
    expect(invoiceDescription({ orderType: 'CREDIT_PACKAGE', credits: 50 })).toBe('Pachet 50 credite marketplace');
  });

  it('(h) numele fisierului factura-{serie}-{numar}.pdf, seria curatata', () => {
    expect(invoiceFileName({ invoiceSeries: 'MM', invoiceNumber: 42 })).toBe('factura-MM-42.pdf');
    expect(invoiceFileName({ invoiceSeries: 'M M/..', invoiceNumber: 7 })).toBe('factura-MM-7.pdf');
    expect(invoiceFileName({ invoiceSeries: 'A"\r\nB', invoiceNumber: 1 })).toBe('factura-AB-1.pdf');
  });

  it('metoda de plata si codul fiscal', () => {
    expect(paymentMethodLabel('webhook')).toBe('plată online');
    expect(paymentMethodLabel(null)).toBe('');
    expect(buyerFiscalCode({ ...BUYER, cui: 'ro7850265', isVatPayer: false })).toBe('7850265');
    expect(buyerFromCompany({ name: 'X', cui: '7850265', regComNumber: 'J', addressText: 'A', isVatPayer: true })?.isVatPayer).toBe(true);
    expect(buyerFromCompany({ name: 'X', cui: '7850265', regComNumber: 'J', addressText: 'A' })?.isVatPayer).toBe(false);
  });
});

describe('InvoicePdfService — rezolvarea cumparatorului', () => {
  function build() {
    const prisma: any = {
      company: { findUnique: jest.fn().mockResolvedValue({ name: 'Live SRL', cui: 'RO7850265', regComNumber: 'J1', addressText: 'A', isVatPayer: true }) },
      subscriptionPlan: { findUnique: jest.fn().mockResolvedValue({ tier: 'GOLD', code: 'GOLD' }) },
    };
    const readiness = { assertReady: jest.fn().mockResolvedValue(SELLER) };
    const settings = { getInt: jest.fn().mockResolvedValue(0) };
    const service = new InvoicePdfService(
      prisma as PrismaService,
      {} as PaymentsService,
      readiness as unknown as BillingReadinessService,
      settings as unknown as SettingsService,
    );
    return { prisma, service, readiness, settings };
  }

  it('buyer_snapshot setat → firma live NU se citeste (redenumirea ulterioara nu schimba factura)', async () => {
    const { prisma, service } = build();
    const buyer = await service.resolveBuyer({ companyId: 'c1', buyerSnapshot: { name: 'A Mobila Premium', cui: '7850265', regCom: 'J1', address: 'A', isVatPayer: true } });
    expect(buyer?.name).toBe('A Mobila Premium');
    expect(prisma.company.findUnique).not.toHaveBeenCalled();
  });

  it('fara snapshot (factura veche) → firma live, cu isVatPayer', async () => {
    const { prisma, service } = build();
    const buyer = await service.resolveBuyer({ companyId: 'c1', buyerSnapshot: null });
    expect(buyer).toMatchObject({ name: 'Live SRL', isVatPayer: true });
    expect(prisma.company.findUnique).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ isVatPayer: true }) }));
  });

  it('factura neemisa → 409; emisa → HTML cu descrierea abonamentului', async () => {
    const { service } = build();
    const base = { ...order(), id: 'o1', companyId: 'c1', planId: 'p1', buyerSnapshot: { name: 'S', cui: '1', regCom: 'J', address: 'A', isVatPayer: false } } as any;
    await expect(service.invoiceHtml({ ...base, status: 'PENDING' })).rejects.toMatchObject({ status: 409 });
    const html = await service.invoiceHtml({ ...base, orderType: 'SUBSCRIPTION', credits: 30, servicePeriodStart: null, servicePeriodEnd: null });
    expect(html).toContain('Abonament marketplace GOLD — 30 credite incluse');
  });

  it('E-company-24: proforma doar pe comenzi PENDING non-test (409 altfel); termenul din bank_transfer_expiry_days', async () => {
    const { service, settings, readiness } = build();
    const pending = {
      ...order(),
      id: PROFORMA_ID,
      companyId: 'c1',
      planId: null,
      status: 'PENDING',
      testMode: false,
      stripeSessionId: null,
      stripeCheckoutAttempt: null,
      paymentClaimedAt: null,
      createdAt: new Date('2026-03-01T10:00:00Z'),
      buyerSnapshot: null,
    } as any;
    await expect(service.proformaHtml({ ...pending, status: 'CONFIRMED' })).rejects.toMatchObject({ status: 409 });
    await expect(service.proformaHtml({ ...pending, testMode: true })).rejects.toMatchObject({ status: 409 });
    const html = await service.proformaHtml(pending);
    expect(readiness.assertReady).toHaveBeenCalled();
    expect(html).toContain('Live SRL'); // cumparatorul live (fara snapshot pe PENDING)
    expect(html).not.toContain('Valabilă până la');
    settings.getInt.mockResolvedValue(5);
    expect(await service.proformaHtml(pending)).toContain('Valabilă până la 06.03.2026');
    // firma a apasat "Am platit" → fara termen de anulare
    expect(await service.proformaHtml({ ...pending, paymentClaimedAt: new Date() })).not.toContain('Valabilă până la');
  });
});

const PROFORMA_ID = 'abcdef12-3456-4789-8abc-def012345678';

describe('E-company-24 — buildProformaHtml', () => {
  const proformaOrder = {
    id: PROFORMA_ID,
    createdAt: new Date('2026-03-01T23:30:00Z'),
    orderType: 'CREDIT_PACKAGE' as const,
    credits: 10,
    baseAmountRon: new Prisma.Decimal('100.00'),
    vatRate: new Prisma.Decimal('21.00'),
    vatAmountRon: new Prisma.Decimal('21.00'),
    totalRon: new Prisma.Decimal('121.00'),
  };

  it('proforma: fara serie fiscala, cu referinta comenzii, IBAN, total de plata si mentiunea fiscala', () => {
    const html = buildProformaHtml(proformaOrder, BUYER, SELLER, 'Pachet 10 credite marketplace', null);
    expect(orderRef(PROFORMA_ID)).toBe('ABCDEF12');
    expect(html).toContain('Factură proformă');
    expect(html).toContain('Nr. ABCDEF12');
    expect(html).toContain('Data: 02.03.2026');
    expect(html).toContain(SELLER.iban);
    expect(html).toContain('Comanda ABCDEF12');
    expect(html).toContain('Total de plată');
    expect(html).toContain('fără valoare fiscală');
    expect(html).toContain('Cod TVA RO7850265');
    expect(html).not.toContain('Seria');
    expect(html).not.toContain('Valabilă până la');
    expect(buildProformaHtml(proformaOrder, BUYER, SELLER, 'x', new Date('2026-03-05T22:30:00Z'))).toContain('Valabilă până la 06.03.2026');
    expect(proformaFileName(PROFORMA_ID)).toBe('proforma-ABCDEF12.pdf');
  });

  it('proforma: valorile sunt escapate (numele cumparatorului, descrierea)', () => {
    const html = buildProformaHtml(proformaOrder, { ...BUYER, name: '<script>alert(1)</script> "SRL"' }, SELLER, '<b>x</b>', null);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &quot;SRL&quot;');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('factura ramane neschimbata (fara mentiunile proformei)', () => {
    const html = buildInvoiceHtml(order(), BUYER, 'x');
    expect(html).toContain('<h1>Factură</h1>');
    expect(html).toContain('Seria MM nr. 42');
    expect(html).not.toContain('proformă');
    expect(html).not.toContain('fără valoare fiscală');
    expect(html).toContain('.paid { margin-top: 14px;');
  });
});
