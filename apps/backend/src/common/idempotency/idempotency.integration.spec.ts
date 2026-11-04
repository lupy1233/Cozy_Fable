import { type ExecutionContext } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { from, lastValueFrom } from 'rxjs';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { lockIdempotentOperation, saveIdempotentResult } from './idempotent-operation';
import { testDatabaseUrl } from '../../test/db-guard';

// E-admin-platform-14: doar host local (garda db-guard), altfel testele refuza sa porneasca
const url = testDatabaseUrl();
(url ? describe : describe.skip)('transactional idempotency against PostgreSQL', () => {
  const prisma = new PrismaService(url ? { datasources: { db: { url } } } : undefined);
  const owner = randomUUID();
  const interceptor = new IdempotencyInterceptor({ getAllAndOverride: () => ({ transactional: true }) } as never, prisma);
  const effects = () => prisma.attachment.count({ where: { entityType: 'IDEMPOTENCY_TEST', entityId: owner } });
  afterEach(async () => {
    await prisma.attachment.deleteMany({ where: { entityType: 'IDEMPOTENCY_TEST', entityId: owner } });
    await prisma.idempotencyKey.deleteMany({ where: { userId: owner } });
  });
  afterAll(async () => prisma.$disconnect());

  function call(key: string, fail: 'before-commit' | 'after-commit' | null = null) {
    const response = { statusCode: 201, status: jest.fn() };
    const req = { user: { sub: owner }, method: 'POST', originalUrl: '/test/idempotent', path: '/test/idempotent', headers: { 'idempotency-key': key }, body: { value: 1 } };
    const context = { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => req, getResponse: () => response }) } as unknown as ExecutionContext;
    const handler = { handle: () => from((async () => {
      const result = await prisma.$transaction(async (tx) => {
        await lockIdempotentOperation(tx);
        const effect = await tx.attachment.create({ data: { entityType: 'IDEMPOTENCY_TEST', entityId: owner, filename: 'test.pdf', mimeType: 'application/pdf', sizeBytes: 1, storageKey: `test/${randomUUID()}` } });
        const dto = { id: effect.id, status: 'created' };
        await saveIdempotentResult(tx, dto);
        if (fail === 'before-commit') throw new Error('process interrupted before commit');
        return dto;
      });
      if (fail === 'after-commit') throw new Error('queue failed after commit');
      return result;
    })()) };
    return { promise: lastValueFrom(interceptor.intercept(context, handler)), response };
  }

  it('simultaneous same-key requests commit one effect and replay the exact original status/body', async () => {
    const key = randomUUID();
    const a = call(key); const b = call(key);
    const [first, second] = await Promise.all([a.promise, b.promise]);
    expect(second).toEqual(first);
    expect(await effects()).toBe(1);
    expect(b.response.status).toHaveBeenCalledWith(201);
  });

  it('an interrupted transaction rolls back both effect and receipt; same key safely resumes', async () => {
    const key = randomUUID();
    await expect(call(key, 'before-commit').promise).rejects.toThrow('before commit');
    expect(await effects()).toBe(0);
    expect((await prisma.idempotencyKey.findFirst({ where: { userId: owner } }))?.responseStatus).toBe(0);
    await call(key).promise;
    expect(await effects()).toBe(1);
  });

  it('an interruption after commit returns the saved success and never reexecutes the effect', async () => {
    const key = randomUUID();
    const first = await call(key, 'after-commit').promise;
    expect(await call(key).promise).toEqual(first);
    expect(await effects()).toBe(1);
  });

  it('expired completed receipts permit exactly one new operation during concurrent retries', async () => {
    const key = randomUUID();
    await call(key).promise;
    await prisma.idempotencyKey.updateMany({ where: { userId: owner }, data: { expiresAt: new Date(Date.now() - 1) } });
    const [a, b] = await Promise.all([call(key).promise, call(key).promise]);
    expect(a).toEqual(b);
    expect(await effects()).toBe(2);
  });
});
