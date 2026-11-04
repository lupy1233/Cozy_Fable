import { HttpException } from '@nestjs/common';
import { ERROR_CODES } from '@marketplace/shared';
import { Prisma, PrismaClient } from '@prisma/client';
import { TX_PROFILES, type TxProfile } from './tx-options';

// Prisma P2034: "Transaction failed due to a write conflict or a deadlock" (Serializable).
// E-company-2: acelasi esec venit dintr-un $queryRaw (ex. SELECT ... FOR UPDATE pe cerere dupa
// ce concurentul a comis un UPDATE pe ea) ajunge ca P2010 cu SQLSTATE 40001 / 40P01 in meta.
export function isSerializationFailure(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code === 'P2034') return true;
  const sqlState = (e.meta as { code?: unknown } | undefined)?.code;
  return e.code === 'P2010' && (sqlState === '40001' || sqlState === '40P01');
}

// E-company-2 (R2-INVARIANTS-5): 3 reincercari (4 incercari) cu pauza aleatoare 20-80 ms,
// ca doua tranzactii care se ciocnesc sa nu se reia in acelasi ritm.
export const SERIALIZATION_RETRIES = 3;

// L0-B — ruleaza o tranzactie Serializable cu retry la serialization failure (P2034);
// daca si ultima incercare pica → 409 CONCURRENT_MODIFICATION (nu 500). Folosit de runTx
// pe profilele critical/claim (claim, accept, oferte, retrageri, sla-breach, claim-assign).
export async function withSerializationRetry<T>(
  fn: () => Promise<T>,
  retries = SERIALIZATION_RETRIES,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isSerializationFailure(e)) throw e;
      if (attempt >= retries) {
        throw new HttpException(
          { code: ERROR_CODES.CONCURRENT_MODIFICATION, message: 'Concurrent modification, please retry' },
          409,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 20 + Math.floor(Math.random() * 61)));
    }
  }
}

type TxHost = Pick<PrismaClient, '$transaction'>;

// E-admin-platform-54 — singurul punct prin care codul de domeniu deschide o tranzactie
// interactiva (regula ESLint interzice $transaction direct). Profilul fixeaza izolarea,
// maxWait/timeout si retry-ul la serialization failure; fn se poate rula de mai multe ori
// pe profilele cu retry → fara efecte in afara lui tx si fara stare exterioara mutata.
// Functie libera (nu metoda pe PrismaService) ca mock-urile `$transaction: jest.fn((fn) => fn(tx))`
// din specuri sa mearga neschimbate.
export function runTx<T>(
  prisma: TxHost,
  profile: TxProfile,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const { retrySerialization, ...options } = TX_PROFILES[profile];
  const once = () => prisma.$transaction(fn, options);
  return retrySerialization ? withSerializationRetry(once) : once();
}

// Varianta batch (lista de operatii, un singur round-trip; fara timeout interactiv).
export function runTxBatch(prisma: TxHost, ops: Prisma.PrismaPromise<unknown>[]): Promise<unknown[]> {
  return prisma.$transaction(ops);
}
