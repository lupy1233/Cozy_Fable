import { HttpException, type ExecutionContext } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { lastValueFrom, of, Subject, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

const KEY = '12345678-1234-4234-8234-123456789abc';

function setup() {
  const records = new Map<string, Record<string, any>>(); // eslint-disable-line @typescript-eslint/no-explicit-any
  const prisma = { idempotencyKey: {
    findUnique: jest.fn(async ({ where }) => records.get(JSON.stringify(where.key_endpoint))),
    deleteMany: jest.fn(async ({ where }) => {
      const id = JSON.stringify({ key: where.key, endpoint: where.endpoint });
      const row = records.get(id);
      if (row && row.responseStatus > 0 && row.expiresAt <= where.expiresAt.lte) records.delete(id);
    }),
    create: jest.fn(async ({ data }) => {
      const id = JSON.stringify({ key: data.key, endpoint: data.endpoint });
      if (records.has(id)) throw new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' });
      const row = { id, ...data };
      records.set(id, row);
      return row;
    }),
    update: jest.fn(async ({ where, data }) => Object.assign(records.get(where.id)!, data)),
  } };
  const interceptor = new IdempotencyInterceptor({ getAllAndOverride: () => true } as never, prisma as never);
  function call(handler = { handle: jest.fn(() => of({ orderId: 'order-1' })) }, overrides = {}) {
    const response = { statusCode: 201, status: jest.fn() };
    const request = { headers: { 'idempotency-key': KEY }, user: { sub: 'user-1' }, method: 'POST', originalUrl: '/api/v1/quotes/a/accept', path: '/quotes/a/accept', route: { path: '/quotes/:id/accept' }, body: { a: 1, b: 2 }, query: {}, ...overrides };
    const context = { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) } as unknown as ExecutionContext;
    return { promise: lastValueFrom(interceptor.intercept(context, handler)), response, handler };
  }
  return { call, records, prisma };
}

describe('Idempotency atomic reservation and replay', () => {
  it('does not execute a concurrent duplicate and replays saved status/body after completion', async () => {
    const { call } = setup();
    const work = new Subject<{ orderId: string }>();
    const handler = { handle: jest.fn(() => work) };
    const first = call(handler);
    // Lasa prima rezervare sa ajunga la handler.
    await new Promise((resolve) => setImmediate(resolve));
    await expect(call(handler).promise).rejects.toMatchObject({ status: 409 });
    expect(handler.handle).toHaveBeenCalledTimes(1);
    work.next({ orderId: 'order-1' }); work.complete();
    await first.promise;
    const replay = call(handler, { body: { b: 2, a: 1 } });
    await expect(replay.promise).resolves.toEqual({ orderId: 'order-1' });
    expect(replay.response.status).toHaveBeenCalledWith(201);
    expect(handler.handle).toHaveBeenCalledTimes(1);
  });

  it('binds user and body, and keeps concrete resource identities distinct', async () => {
    const { call } = setup();
    await call().promise;
    await expect(call(undefined, { user: { sub: 'user-2' } }).promise).rejects.toMatchObject({ status: 409 });
    await expect(call(undefined, { body: { a: 3 } }).promise).rejects.toMatchObject({ status: 409 });
    const otherResource = call(undefined, { originalUrl: '/api/v1/quotes/b/accept' });
    await otherResource.promise;
    expect(otherResource.handler.handle).toHaveBeenCalledTimes(1);
  });

  it('preserves unknown outcomes after handler failure or receipt write failure', async () => {
    const { call, records, prisma } = setup();
    const handler = { handle: jest.fn(() => throwError(() => new Error('queue failed after commit'))) };
    await expect(call(handler).promise).rejects.toThrow('queue failed after commit');
    const row = [...records.values()][0];
    expect(row.responseStatus).toBe(0);
    expect(row.expiresAt.getUTCFullYear()).toBe(9999);
    await expect(call(handler).promise).rejects.toMatchObject({ status: 409 });
    expect(handler.handle).toHaveBeenCalledTimes(1);
    const another = setup();
    another.prisma.idempotencyKey.update.mockRejectedValueOnce(new Error('write failed'));
    await expect(another.call().promise).rejects.toThrow('write failed');
    await expect(another.call().promise).rejects.toMatchObject({ status: 409 });
    expect(prisma.idempotencyKey.update).not.toHaveBeenCalled();
  });

  it('replays a terminal rejection without rerunning business code', async () => {
    const { call } = setup();
    const handler = { handle: jest.fn(() => throwError(() => new HttpException({ code: 'CLAIM_NOT_ALLOWED' }, 409))) };
    await expect(call(handler).promise).rejects.toMatchObject({ status: 409 });
    await expect(call(handler).promise).rejects.toMatchObject({ status: 409, response: { code: 'CLAIM_NOT_ALLOWED' } });
    expect(handler.handle).toHaveBeenCalledTimes(1);
  });
});
