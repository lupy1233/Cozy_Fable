import { performance } from 'node:perf_hooks';
import type { Prisma } from '@prisma/client';
import { slowQueryLogger } from './slow-query';

const params = {
  model: 'User',
  action: 'findMany',
  args: { where: { email: 'private@example.invalid' } },
  dataPath: [],
  runInTransaction: false,
} as unknown as Prisma.MiddlewareParams;

describe('slowQueryLogger (E-admin-platform-8)', () => {
  let now: jest.SpyInstance;
  let clock = 0;

  beforeEach(() => {
    clock = 0;
    now = jest.spyOn(performance, 'now').mockImplementation(() => clock);
  });
  afterEach(() => now.mockRestore());

  const nextTaking = (ms: number, result: unknown = []) => jest.fn(async () => {
    clock += ms;
    return result;
  });

  it('logs model, action and duration for a slow query, never the args', async () => {
    const log = jest.fn();
    await expect(slowQueryLogger(log)(params, nextTaking(350, ['row']))).resolves.toEqual(['row']);
    expect(log).toHaveBeenCalledTimes(1);
    const line = log.mock.calls[0][0] as string;
    expect(line).toContain('model=User action=findMany ms=350');
    expect(line).not.toContain('private@');
    expect(line).not.toContain('where');
  });

  it('does not log a fast query', async () => {
    const log = jest.fn();
    await slowQueryLogger(log)(params, nextTaking(10));
    expect(log).not.toHaveBeenCalled();
  });

  it('logs a slow failing query and rethrows its error', async () => {
    const log = jest.fn();
    const failure = new Error('db');
    const next = jest.fn(async () => {
      clock += 400;
      throw failure;
    });
    await expect(slowQueryLogger(log)({ ...params, model: undefined, action: 'queryRaw' } as never, next)).rejects.toBe(failure);
    expect(log).toHaveBeenCalledWith('slow query model=raw action=queryRaw ms=400');
  });
});
