import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CLAIM_TX_TIMEOUT_MS, TX_PROFILES } from './tx-options';
import { runTx, runTxBatch } from './tx';

// E-admin-platform-54 — politica unica de tranzactii (runTx pe profile).
const knownError = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('tx failed', { code, clientVersion: 'test', meta });

function host(impl?: (fn: unknown, opts?: unknown) => Promise<unknown>) {
  const tx = { marker: 'tx' };
  const $transaction: jest.Mock = jest.fn(impl ?? (async (fn: any) => (typeof fn === 'function' ? fn(tx) : fn)));
  return { prisma: { $transaction } as any, $transaction, tx };
}

describe('runTx (E-admin-platform-54)', () => {
  it('claim profile keeps the invariant 3.1 values (Serializable, 10 s)', () => {
    expect(CLAIM_TX_TIMEOUT_MS).toBe(10_000);
    expect(TX_PROFILES.claim).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 10_000,
      retrySerialization: true,
    });
  });

  it.each(['read', 'write', 'critical', 'claim'] as const)('passes the %s profile options to $transaction', async (profile) => {
    const { prisma, $transaction, tx } = host();
    const fn = jest.fn(async (t: unknown) => (t === tx ? 'ok' : 'wrong tx'));

    await expect(runTx(prisma, profile, fn)).resolves.toBe('ok');

    const { retrySerialization: _ignored, ...expected } = TX_PROFILES[profile];
    expect($transaction).toHaveBeenCalledWith(fn, expected);
    expect($transaction.mock.calls[0][1]).not.toHaveProperty('retrySerialization');
  });

  it('write profile is READ COMMITTED (no isolation level) with the 20 s ceiling', () => {
    expect(TX_PROFILES.write.isolationLevel).toBeUndefined();
    expect(TX_PROFILES.write.timeout).toBe(20_000);
    expect(TX_PROFILES.critical.isolationLevel).toBe(Prisma.TransactionIsolationLevel.Serializable);
    expect(TX_PROFILES.read.isolationLevel).toBe(Prisma.TransactionIsolationLevel.RepeatableRead);
  });

  it('write does not retry a serialization failure', async () => {
    const err = knownError('P2034');
    const { prisma, $transaction } = host(async () => {
      throw err;
    });

    await expect(runTx(prisma, 'write', jest.fn())).rejects.toBe(err);
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it.each(['claim', 'critical'] as const)('%s retries P2034 and succeeds on a later attempt', async (profile) => {
    let calls = 0;
    const { prisma, $transaction } = host(async () => {
      calls++;
      if (calls < 3) throw knownError('P2034');
      return 'done';
    });

    await expect(runTx(prisma, profile, jest.fn())).resolves.toBe('done');
    expect($transaction).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['P2034', undefined],
    ['P2010', { code: '40001' }],
  ] as const)('claim: %s exhausts 3 retries (4 attempts) → 409 CONCURRENT_MODIFICATION', async (code, meta) => {
    const { prisma, $transaction } = host(async () => {
      throw knownError(code, meta as Record<string, unknown> | undefined);
    });

    const err = await runTx(prisma, 'claim', jest.fn()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(409);
    expect((err as HttpException).getResponse()).toMatchObject({ code: 'CONCURRENT_MODIFICATION' });
    expect($transaction).toHaveBeenCalledTimes(4);
  });

  it.each(['P2028', 'P2024'])('does not retry %s (the filter answers 503, the FE retries once)', async (code) => {
    const err = knownError(code);
    const { prisma, $transaction } = host(async () => {
      throw err;
    });

    await expect(runTx(prisma, 'claim', jest.fn())).rejects.toBe(err);
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it('runTxBatch forwards the operation list without options', async () => {
    const { prisma, $transaction } = host(async (ops: any) => ops.map((_: unknown, i: number) => i));
    const ops = [Promise.resolve(1), Promise.resolve(2)] as unknown as Prisma.PrismaPromise<unknown>[];

    await expect(runTxBatch(prisma, ops)).resolves.toEqual([0, 1]);
    expect($transaction).toHaveBeenCalledWith(ops);
    expect($transaction.mock.calls[0]).toHaveLength(1);
  });
});
