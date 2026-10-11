import { QuoteValidityProcessor } from './quote-validity.processor';

// R3 (audit 2026-08-23): expirarea valabilitatii NU are voie sa suprascrie o oferta
// acceptata intre citirea din tranzactie si scriere — updateMany conditionat pe SENT;
// count 0 → no-op complet (fara notificare, fara schimbare de status).
// E-admin-platform-3: expirarea scrie in outbox `quote.expired` (cheie determinista, tinte =
// clientul + membrii firmei) si programeaza inchiderea automata DOAR daca e activata.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const VALID_UNTIL = new Date(Date.now() - 1000);

function makeProcessor(quoteOverrides: Any = {}, settingsValues: Record<string, string> = {}) {
  const tx: Any = {
    quoteVersion: {
      findUnique: jest.fn().mockResolvedValue({ id: 'v1', quoteId: 'q1', validUntil: VALID_UNTIL }),
    },
    quote: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'q1',
        requestId: 'r1',
        claimSlotId: 's1',
        companyId: 'c1',
        status: 'SENT',
        versions: [{ id: 'v1', version: 1 }],
        request: { clientUserId: 'u-client' },
        ...quoteOverrides,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma: Any = { $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)) };
  const quotes: Any = { participantsFor: jest.fn().mockResolvedValue(['m1', 'u-client']) };
  const outbox: Any = { record: jest.fn().mockResolvedValue(undefined) };
  const settings: Any = {
    getString: jest.fn(async (key: string, fallback: string) => settingsValues[key] ?? fallback),
    getInt: jest.fn(async (key: string, fallback: number) => (settingsValues[key] ? Number(settingsValues[key]) : fallback)),
  };
  const queue: Any = { add: jest.fn().mockResolvedValue(undefined) };
  const proc = new QuoteValidityProcessor(prisma, quotes, outbox, settings, queue);
  return { proc, tx, quotes, outbox, queue };
}

const job: Any = { data: { quoteVersionId: 'v1' } };

describe('QuoteValidityProcessor (R3 + E-admin-platform-3)', () => {
  it('expira oferta SENT cu updateMany conditionat + quote.expired determinist catre participanti', async () => {
    const { proc, tx, outbox, queue } = makeProcessor();
    await proc.process(job);
    expect(tx.quote.updateMany).toHaveBeenCalledWith({
      where: { id: 'q1', status: 'SENT' },
      data: { status: 'EXPIRED' },
    });
    expect(outbox.record).toHaveBeenCalledTimes(1);
    expect(outbox.record).toHaveBeenCalledWith(
      tx,
      `quote.expired:v1:${VALID_UNTIL.getTime()}`,
      'quote.expired',
      expect.objectContaining({ quoteId: 'q1', requestId: 'r1', claimSlotId: 's1', clientUserId: 'u-client', autoCloseAt: null }),
      ['m1', 'u-client'],
    );
    // inchiderea automata e oprita implicit → niciun job de decontare
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('inchidere automata activata (REFUND, 14 zile) → autoCloseAt in payload + job determinist', async () => {
    const { proc, outbox, queue } = makeProcessor({}, {
      expired_offer_autoclose_enabled: 'true',
      expired_offer_autoclose_credit_outcome: 'REFUND',
      expired_offer_autoclose_days: '14',
    });
    await proc.process(job);
    const autoCloseAt = new Date(VALID_UNTIL.getTime() + 14 * 24 * 60 * 60 * 1000);
    expect(outbox.record.mock.calls[0][3]).toMatchObject({ autoCloseAt: autoCloseAt.toISOString() });
    expect(queue.add).toHaveBeenCalledWith('settle', { quoteId: 'q1' }, expect.objectContaining({ jobId: `oes-q1-${VALID_UNTIL.getTime()}` }));
  });

  it('activata dar rezultat UNSET → tratata ca oprita (fara data, fara job)', async () => {
    const { proc, outbox, queue } = makeProcessor({}, { expired_offer_autoclose_enabled: 'true' });
    await proc.process(job);
    expect(outbox.record.mock.calls[0][3]).toMatchObject({ autoCloseAt: null });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('RACE: oferta acceptata intre citire si scriere (count 0) → no-op, nicio notificare', async () => {
    const { proc, tx, outbox, queue } = makeProcessor();
    tx.quote.updateMany.mockResolvedValue({ count: 0 });
    await proc.process(job);
    expect(outbox.record).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('oferta deja ne-SENT la citire → nu incearca update', async () => {
    const { proc, tx, outbox } = makeProcessor({ status: 'ACCEPTED' });
    await proc.process(job);
    expect(tx.quote.updateMany).not.toHaveBeenCalled();
    expect(outbox.record).not.toHaveBeenCalled();
  });
});
