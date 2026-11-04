import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@prisma/client';

export interface IdempotentOperation { receiptId: string; responseStatus: number; transactional: boolean }
const operation = new AsyncLocalStorage<IdempotentOperation>();
export const getIdempotentOperation = () => operation.getStore();
export const withIdempotentOperation = <T>(context: IdempotentOperation, run: () => Promise<T>): Promise<T> => operation.run(context, async () => await run());

export class IdempotentReplay extends Error {
  constructor() { super('Replay committed operation result'); }
}

// Apelat primul in tranzactia de domeniu. Lock-ul ramane pana la commit/rollback.
export async function lockIdempotentOperation(tx: Prisma.TransactionClient): Promise<void> {
  const context = operation.getStore();
  if (!context?.transactional) return;
  const rows = await tx.$queryRaw<{ response_status: number }[]>`SELECT response_status FROM idempotency_keys WHERE id = ${context.receiptId} FOR UPDATE`;
  if (!rows.length) throw new Error('Idempotency receipt missing');
  if (rows[0].response_status > 0) throw new IdempotentReplay();
}

export async function saveIdempotentResult(tx: Prisma.TransactionClient, result: unknown): Promise<void> {
  const context = operation.getStore();
  if (!context?.transactional) return;
  await tx.idempotencyKey.update({ where: { id: context.receiptId }, data: {
    responseStatus: context.responseStatus,
    responseBody: result == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  } });
}

// Pentru operatii externe recuperabile (ex. checkout), checkpointul se scrie in acelasi
// commit cu entitatea creata. Statusul 0 NU este un raspuns final catre client.
export async function saveIdempotentCheckpoint(tx: Prisma.TransactionClient, checkpoint: Prisma.InputJsonObject): Promise<void> {
  const context = operation.getStore();
  if (!context?.transactional) return;
  await tx.idempotencyKey.update({ where: { id: context.receiptId }, data: { responseBody: { checkpoint }, responseStatus: 0 } });
}

export async function loadIdempotentCheckpoint(tx: Prisma.TransactionClient): Promise<Prisma.JsonObject | undefined> {
  const context = operation.getStore();
  if (!context?.transactional) return;
  const receipt = await tx.idempotencyKey.findUnique({ where: { id: context.receiptId } });
  const body = receipt?.responseBody;
  if (body && typeof body === 'object' && !Array.isArray(body) && body.checkpoint && typeof body.checkpoint === 'object' && !Array.isArray(body.checkpoint)) return body.checkpoint;
}
