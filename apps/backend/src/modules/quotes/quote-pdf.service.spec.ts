import { QuotePdfService } from './quote-pdf.service';
import { quotePdfFile } from './quotes.controller';
import { toQuoteDto } from './quote-dto.mapper';
import { makeQuoteFull } from './quotes.test-fixtures';
import { Prisma } from '@prisma/client';

// a3 / g4 (2026-11-13) — PDF-ul ofertei arata aceleasi rubrici ca tabelul si cardul: TVA (cu
// totalul cu TVA), termen, garantie, transport / montaj, ce include proiectarea, in moneda
// VARIANTEI; variantele vechi raman cu textul lor si "—" la rubricile noi.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const extra = {
  requestTitle: 'Bucatarie', requestLocation: 'Iasi', companyName: 'A Mobila', companyCui: 'RO1',
  companyReg: 'J1', companyAddress: 'Str. 1',
};

function html(full: Any): string {
  const service = new QuotePdfService({} as Any, {} as Any, {} as Any);
  const dto = toQuoteDto(full, new Map(), 5, Date.now(), 21);
  return (service as Any).buildHtml(dto, dto.versions[dto.versions.length - 1], extra);
}

describe('QuotePdfService.buildHtml — rubrici structurate', () => {
  it('varianta noua in EUR fara TVA: TVA, total cu TVA, termen, garantie, transport, montaj, proiectare', () => {
    const full = makeQuoteFull({ versions: [{}, {}] });
    full.versions[0].currency = 'RON';
    Object.assign(full.versions[1], {
      currency: 'EUR', price: new Prisma.Decimal(3900), designFee: new Prisma.Decimal(100), designIncludes: '2 randari',
      vatMode: 'VAT_EXCLUDED', deliveryTermValue: 6, deliveryTermUnit: 'WEEKS', deliveryTerm: '6 săptămâni',
      warrantyMonths: 24, warranty: '24 de luni', includesTransport: true, includesAssembly: false,
    });
    const out = html(full);
    expect(out).toContain('Prețul nu include TVA (21%)');
    expect(out).toContain('Total cu TVA');
    expect(out).toContain('4.840,00 EUR');
    expect(out).toContain('6 săptămâni');
    expect(out).toContain('24 de luni');
    expect(out).toMatch(/Transport<\/td><td class="num">Inclus în preț/);
    expect(out).toMatch(/Montaj<\/td><td class="num">Nu este inclus/);
    expect(out).toContain('Ce include proiectarea');
    expect(out).toContain('Sumă contractuală exprimată în EUR');
  });

  it('varianta veche: textul liber ramane, rubricile noi "—", fara total cu TVA', () => {
    const full = makeQuoteFull();
    Object.assign(full.versions[0], { deliveryTerm: '6 saptamani', warranty: '2 ani' });
    const out = html(full);
    expect(out).toContain('6 saptamani');
    expect(out).toContain('2 ani');
    expect(out).toMatch(/TVA<\/td><td class="num">—/);
    expect(out).not.toContain('Total cu TVA');
    expect(out).not.toContain('Ce include proiectarea');
  });
});

// g4 (etapa 7): Chrome lipsa / cazut → 503 DOCUMENT_RENDER_FAILED (JSON), alerta adminilor;
// ruta pune tipul PDF doar pe raspunsul reusit.
describe('QuotePdfService — randarea pica (g4)', () => {
  function failing() {
    const tx = { user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }]) } };
    const prisma: Any = { $transaction: jest.fn((fn: Any) => fn(tx)) };
    const outbox: Any = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new QuotePdfService(prisma, {} as Any, outbox);
    jest.spyOn(service as Any, 'getBrowser').mockRejectedValue(new Error('Could not find Chrome (ver. 149.0.7827.22)'));
    jest.spyOn((service as Any).logger, 'warn').mockImplementation(() => undefined);
    return { service, outbox };
  }

  it('Chrome lipsa → 503 cu cod propriu + clopotelul adminilor (o cheie pe zi)', async () => {
    const { service, outbox } = failing();
    await expect((service as Any).printPdf('<p>x</p>')).rejects.toMatchObject({
      status: 503,
      response: { code: 'DOCUMENT_RENDER_FAILED' },
    });
    expect(outbox.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/^documents\.pdf_failed:\d{4}-\d{2}-\d{2}$/),
      'documents.pdf_failed',
      expect.objectContaining({ kind: 'quote' }),
      ['admin-1'],
    );
  });

  it('raspunsul reusit poarta tipul PDF si numele fisierului', () => {
    const file = quotePdfFile(Buffer.from('%PDF'));
    expect(file.getHeaders()).toMatchObject({ type: 'application/pdf', disposition: 'attachment; filename="oferta.pdf"' });
  });
});
