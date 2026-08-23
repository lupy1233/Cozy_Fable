import { QuoteValidityProcessor } from './quote-validity.processor';

// R3 (audit 2026-08-23): expirarea valabilitatii NU are voie sa suprascrie o oferta
// acceptata intre citirea din tranzactie si scriere — updateMany conditionat pe SENT;
// count 0 → no-op complet (fara publish, fara schimbare de status).

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

function makeProcessor(quoteOverrides: Any = {}) {
  const tx: Any = {
    quoteVersion: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'v1',
        quoteId: 'q1',
        validUntil: new Date(Date.now() - 1000),
      }),
    },
    quote: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'q1',
        status: 'SENT',
        versions: [{ id: 'v1', version: 1 }],
        ...quoteOverrides,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma: Any = { $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)) };
  const quotes: Any = { publishQuoteUpdated: jest.fn().mockResolvedValue(undefined) };
  const proc = new QuoteValidityProcessor(prisma, quotes);
  return { proc, tx, quotes };
}

const job: Any = { data: { quoteVersionId: 'v1' } };

describe('QuoteValidityProcessor (R3, audit 2026-08-23)', () => {
  it('expira oferta SENT cu updateMany conditionat pe SENT + publica actualizarea', async () => {
    const { proc, tx, quotes } = makeProcessor();
    await proc.process(job);
    expect(tx.quote.updateMany).toHaveBeenCalledWith({
      where: { id: 'q1', status: 'SENT' },
      data: { status: 'EXPIRED' },
    });
    expect(quotes.publishQuoteUpdated).toHaveBeenCalledWith('q1');
  });

  it('RACE: oferta acceptata intre citire si scriere (count 0) → no-op, nu publica nimic', async () => {
    const { proc, tx, quotes } = makeProcessor();
    tx.quote.updateMany.mockResolvedValue({ count: 0 });
    await proc.process(job);
    expect(quotes.publishQuoteUpdated).not.toHaveBeenCalled();
  });

  it('oferta deja ne-SENT la citire → nu incearca update', async () => {
    const { proc, tx, quotes } = makeProcessor({ status: 'ACCEPTED' });
    await proc.process(job);
    expect(tx.quote.updateMany).not.toHaveBeenCalled();
    expect(quotes.publishQuoteUpdated).not.toHaveBeenCalled();
  });
});
