import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';

type HistoricalReadReason = 'EMAIL_UNIQUENESS' | 'ISSUED_INVOICE' | 'AUTHORIZED_QUOTE_DOCUMENT';
const historicalRead = new AsyncLocalStorage<HistoricalReadReason>();

// Bypass exclusiv in codul server, dupa autorizarea documentului; niciun flag din request.
export function withDeletedRecords<T>(reason: HistoricalReadReason, read: () => Promise<T>): Promise<T> {
  // PrismaPromise e lazy: trebuie asteptat IN context, nu returnat in afara lui.
  return historicalRead.run(reason, async () => await read());
}

const MODELS = new Set(['User', 'Company', 'Request', 'InspirationPhoto']);
const READS = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy']);

export const softDeleteReads: Prisma.Middleware = async (params, next) => {
  if (params.model && MODELS.has(params.model) && READS.has(params.action) && !historicalRead.getStore()) {
    params.args ??= {};
    const where = params.args.where ?? {};
    const and = where.AND == null ? [] : Array.isArray(where.AND) ? where.AND : [where.AND];
    // Prisma 5 pastreaza cheia unica la nivelul superior; AND nu permite ocolirea cu OR.
    params.args.where = { ...where, AND: [...and, { deletedAt: null }] };
  }
  return next(params);
};
