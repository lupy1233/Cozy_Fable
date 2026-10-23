import type { Prisma } from '@prisma/client';
import { softDeleteReads, withDeletedRecords } from './soft-delete';

describe('soft-delete automatic read policy', () => {
  const params = (model = 'User', action = 'findUnique', args = { where: { id: 'u1', OR: [{ deletedAt: { not: null } }, {}] } }) => ({ model, action, args, dataPath: [], runInTransaction: false }) as Prisma.MiddlewareParams;

  it.each(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy'])('filters %s without weakening existing conditions', async (action) => {
    const next = jest.fn().mockResolvedValue(null);
    await softDeleteReads(params('User', action), next);
    expect(next.mock.calls[0][0].args.where).toMatchObject({ id: 'u1', AND: [{ deletedAt: null }] });
  });

  it.each(['User', 'Company', 'Request', 'InspirationPhoto'])('covers actual soft-deletable model %s', async (model) => {
    const next = jest.fn().mockResolvedValue([]);
    await softDeleteReads(params(model, 'findMany', undefined), next);
    expect(next.mock.calls[0][0].args.where.AND).toContainEqual({ deletedAt: null });
  });

  it('retains historical access only inside the explicitly scoped callback', async () => {
    const historical = jest.fn().mockResolvedValue(null);
    const active = jest.fn().mockResolvedValue(null);
    await Promise.all([
      withDeletedRecords('ISSUED_INVOICE', async () => { await Promise.resolve(); return softDeleteReads(params('Company'), historical); }),
      softDeleteReads(params('Company'), active),
    ]);
    expect(historical.mock.calls[0][0].args.where.AND).toBeUndefined();
    expect(active.mock.calls[0][0].args.where.AND).toEqual([{ deletedAt: null }]);
  });

  it('does not rewrite mutations, audit records or unrelated historical entities', async () => {
    for (const input of [params('User', 'update'), params('AuditLog'), params('Quote')]) {
      const next = jest.fn().mockResolvedValue(null);
      await softDeleteReads(input, next);
      expect(next.mock.calls[0][0].args.where.AND).toBeUndefined();
    }
  });
});
