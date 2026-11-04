import { Prisma } from '@prisma/client';

// Plafonul tranzactiilor interactive de scriere (incidentul P2028 din 2026-09-17: aplicatia si
// Postgres in regiuni diferite, ~150 ms per round-trip, plafonul implicit Prisma de 5 s cadea la
// publicare). Setat global in PrismaService ca plasa; codul de domeniu trece prin runTx(profil).
export const WRITE_TX_OPTIONS = { maxWait: 5_000, timeout: 20_000 } as const;

// Timeout tranzactie claim (invarianta 3.1: Serializable + 10 s) — NU se schimba.
export const CLAIM_TX_TIMEOUT_MS = 10_000;

// E-admin-platform-54 — politica unica de tranzactii. Orice tranzactie noua alege un profil:
//  read     = snapshot consistent (RepeatableRead), fara scrieri
//  write    = READ COMMITTED (implicit Postgres), 20 s — scrieri obisnuite, lock-uri explicite
//  critical = Serializable, 20 s, retry la serialization failure (oferte)
//  claim    = Serializable, 10 s (3.1), retry la serialization failure (claim/accept/retrageri)
// P2028/P2024 NU se reincearca in backend: filtrul da 503 DATABASE_BUSY, FE reincearca o data.
export type TxProfile = 'read' | 'write' | 'critical' | 'claim';

export interface TxProfileOptions {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxWait: number;
  timeout: number;
  retrySerialization: boolean;
}

export const TX_PROFILES: Record<TxProfile, TxProfileOptions> = {
  read: {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    maxWait: 5_000,
    timeout: 20_000,
    retrySerialization: false,
  },
  write: { maxWait: 5_000, timeout: 20_000, retrySerialization: false },
  critical: {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5_000,
    timeout: 20_000,
    retrySerialization: true,
  },
  claim: {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5_000,
    timeout: CLAIM_TX_TIMEOUT_MS,
    retrySerialization: true,
  },
};
