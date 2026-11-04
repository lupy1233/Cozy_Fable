import { Prisma } from '@prisma/client';
import { BillingDocumentsService } from './billing-documents.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { BillingReadinessService } from './billing-readiness.service';
import type { InvoicePdfService } from './invoice-pdf.service';

// E-company-24 — datele rehidratate pentru emailurile de facturare + PDF memorat (fara N randari).

/* eslint-disable @typescript-eslint/no-explicit-any */

const SELLER = { name: 'Platforma SRL', cui: 'RO12345674', regCom: 'J40/1/2026', address: 'Bucuresti', iban: 'RO08TEST0000000000000001' };
const ORDER_ID = 'abcdef12-3456-4789-8abc-def012345678';

function build(orderOver: Partial<any> = {}, ready = true) {
  const order = {
    id: ORDER_ID,
    companyId: 'c1',
    orderType: 'CREDIT_PACKAGE',
    status: 'PENDING',
    testMode: false,
    invoiceNumber: null,
    totalRon: new Prisma.Decimal('121.00'),
    ...orderOver,
  };
  const prisma: any = { mockBillingOrder: { findUnique: jest.fn().mockResolvedValue(order) } };
  const readiness = { check: jest.fn().mockResolvedValue({ ready, problems: [], seller: SELLER }) };
  const invoicePdf = {
    proformaForOrder: jest.fn().mockResolvedValue({ pdf: Buffer.from('%PDF proforma'), fileName: 'proforma-ABCDEF12.pdf' }),
    invoiceForOrder: jest.fn().mockResolvedValue({ pdf: Buffer.from('%PDF factura'), fileName: 'factura-MM-42.pdf' }),
  };
  const service = new BillingDocumentsService(
    prisma as PrismaService,
    readiness as unknown as BillingReadinessService,
    invoicePdf as unknown as InvoicePdfService,
  );
  return { service, prisma, invoicePdf };
}

describe('BillingDocumentsService.prepare', () => {
  it('transfer_instructions: referinta, suma, IBAN + proforma atasata; randata o singura data pentru mai multi destinatari', async () => {
    const { service, invoicePdf } = build();
    const payload = { orderId: ORDER_ID, companyId: 'c1' };
    const a = await service.prepare('payment.transfer_instructions', payload);
    const b = await service.prepare('payment.transfer_instructions', payload);
    expect(a).toMatchObject({
      orderRef: 'ABCDEF12',
      totalRon: 121,
      orderType: 'CREDIT_PACKAGE',
      transfer: { sellerName: 'Platforma SRL', cui: 'RO12345674', iban: SELLER.iban },
      attachment: { filename: 'proforma-ABCDEF12.pdf', contentType: 'application/pdf' },
    });
    expect(b?.attachment?.content).toBe(a?.attachment?.content);
    expect(invoicePdf.proformaForOrder).toHaveBeenCalledTimes(1);
  });

  it('payment.confirmed cu numar fiscal → factura atasata; auto_cancelled → fara atasament', async () => {
    const { service, invoicePdf } = build({ status: 'CONFIRMED', invoiceNumber: 42 });
    const res = await service.prepare('payment.confirmed', { orderId: ORDER_ID, companyId: 'c1' });
    expect(res?.attachment?.filename).toBe('factura-MM-42.pdf');
    expect(invoicePdf.invoiceForOrder).toHaveBeenCalledTimes(1);

    const cancelled = build({ status: 'CANCELLED' });
    const c = await cancelled.service.prepare('payment.auto_cancelled', { orderId: ORDER_ID, companyId: 'c1' });
    expect(c?.attachment).toBeNull();
    expect(cancelled.invoicePdf.proformaForOrder).not.toHaveBeenCalled();
  });

  it('randarea PDF pica → emailul pleaca fara atasament; date fiscale lipsa → transfer null, fara proforma', async () => {
    const { service, invoicePdf } = build();
    invoicePdf.proformaForOrder.mockRejectedValueOnce(new Error('chromium'));
    const res = await service.prepare('payment.transfer_instructions', { orderId: ORDER_ID, companyId: 'c1' });
    expect(res?.attachment).toBeNull();
    expect(res?.transfer?.iban).toBe(SELLER.iban);

    const notReady = build({}, false);
    const r2 = await notReady.service.prepare('payment.transfer_instructions', { orderId: ORDER_ID, companyId: 'c1' });
    expect(r2?.transfer).toBeNull();
    expect(r2?.attachment).toBeNull();
    expect(notReady.invoicePdf.proformaForOrder).not.toHaveBeenCalled();
  });

  it('tip nerelevant, comanda lipsa sau a altei firme → null', async () => {
    const { service, prisma } = build();
    await expect(service.prepare('quote.created', { orderId: ORDER_ID, companyId: 'c1' })).resolves.toBeNull();
    await expect(service.prepare('payment.transfer_instructions', { orderId: ORDER_ID, companyId: 'c2' })).resolves.toBeNull();
    prisma.mockBillingOrder.findUnique.mockResolvedValueOnce(null);
    await expect(service.prepare('payment.transfer_instructions', { orderId: ORDER_ID, companyId: 'c1' })).resolves.toBeNull();
  });
});
