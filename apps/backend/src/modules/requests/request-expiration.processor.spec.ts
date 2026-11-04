import { RequestExpirationProcessor } from './request-expiration.processor';

describe('Request expiration durable intent', () => {
  function setup(changed = 1) {
    const tx = { request: { updateMany: jest.fn().mockResolvedValue({ count: changed }) } };
    const prisma = {
      request: { findUnique: jest.fn().mockResolvedValue({ id: 'r1', status: 'IN_MARKETPLACE', deletedAt: null, expiresAt: new Date(0), clientUserId: 'u1' }) },
      $transaction: jest.fn(async (fn: (db: typeof tx) => Promise<void>) => fn(tx)),
    };
    const outbox = { record: jest.fn().mockResolvedValue(undefined) };
    const worker = new RequestExpirationProcessor(prisma as never, outbox as never);
    return { tx, outbox, worker };
  }
  it('records private expiration and public invalidation in the same transaction', async () => {
    const { worker, outbox, tx } = setup();
    await worker.process({ data: { requestId: 'r1' } } as never);
    expect(tx.request.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'IN_MARKETPLACE', deletedAt: null, expiresAt: { lte: expect.any(Date) } }) }));
    expect(outbox.record).toHaveBeenCalledWith(tx, 'request.expired:r1:0', 'request.expired', { requestId: 'r1' }, ['u1']);
    expect(outbox.record).toHaveBeenCalledWith(tx, 'request.expired:r1:0:status', 'request.status_changed', { requestId: 'r1', status: 'EXPIRED' }, []);
  });
  it('does not record stale events after a concurrent claim or deadline extension', async () => {
    const { worker, outbox } = setup(0);
    await worker.process({ data: { requestId: 'r1' } } as never);
    expect(outbox.record).not.toHaveBeenCalled();
  });
  it('fails the transaction when intent persistence fails', async () => {
    const { worker, outbox } = setup();
    outbox.record.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(worker.process({ data: { requestId: 'r1' } } as never)).rejects.toThrow('database unavailable');
  });
});
