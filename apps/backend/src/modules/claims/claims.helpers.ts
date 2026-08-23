import { HttpException } from '@nestjs/common';
import { ERROR_CODES } from '@marketplace/shared';
import { Prisma } from '@prisma/client';
import { DEFAULT_MAX_CLAIMS, OCCUPYING_CLAIM_STATUSES, SLA_GRACE_MS } from './claims.constants';

type Tx = Prisma.TransactionClient;

// Prisma P2034: "Transaction failed due to a write conflict or a deadlock" (Serializable).
export function isSerializationFailure(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034';
}

// L0-B — ruleaza o tranzactie Serializable cu retry la serialization failure (P2034);
// daca si ultima incercare pica → 409 CONCURRENT_MODIFICATION (nu 500). Folosit la claim
// si la acceptarea ofertei (3.1: ambele schimba sloturile active sub lock pe cerere).
export async function withSerializationRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
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
    }
  }
}

// Optiunile jobului de verificare SLA (4.11): jobId include deadline-ul ca timestamp →
// reprogramarea (clarificare / retragere oferta) adauga un job nou, iar cel vechi se
// auto-ignora in procesor. Folosit de ClaimsService si QuotesService (withdrawQuote).
export function slaBreachJobOptions(claimSlotId: string, slaDeadlineAt: Date) {
  return {
    delay: Math.max(0, slaDeadlineAt.getTime() + SLA_GRACE_MS - Date.now()),
    jobId: `sla-${claimSlotId}-${slaDeadlineAt.getTime()}`,
    removeOnComplete: true as const,
  };
}

// L0-B — cand un slot OFFER_SENT se inchide (retragere auto/admin, voluntar, accept pe alta
// oferta), ofertele lui inca deschise (SENT/EXPIRED) nu mai pot fi acceptate de client:
// → WITHDRAWN (retragere) sau SUPERSEDED (accept pe alta oferta) + thread read-only.
export async function closeOpenQuotesForSlot(
  tx: Tx,
  claimSlotId: string,
  finalStatus: 'WITHDRAWN' | 'SUPERSEDED',
): Promise<number> {
  const res = await tx.quote.updateMany({
    where: { claimSlotId, status: { in: ['SENT', 'EXPIRED'] } },
    data:
      finalStatus === 'WITHDRAWN'
        ? { status: 'WITHDRAWN', withdrawnAt: new Date() }
        : { status: 'SUPERSEDED' },
  });
  await tx.chatThread.updateMany({ where: { claimSlotId }, data: { readOnly: true } });
  return res.count;
}

// Distanta Haversine in km (3.8) — folosita la verificarea ariei de acoperire in tranzactie.
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Recalcul status cerere dupa o schimbare de claim (3.1):
//  occupied == max → CLAIMED_FULL; 0 < occupied < max → CLAIMED_PARTIAL; 0 → IN_MARKETPLACE.
// Pasul 5 (audit 2026-08-23, F4/F5) — acopera si OFFERS_RECEIVED/NEGOTIATION:
//  - 0 ocupanti → cererea REVINE in piata; cu opts.republishExpiresAt primeste si ceas NOU
//    de expirare (inainte ramanea zombie: nu revenea, nu expira, firmele n-o vedeau).
//    APELANTUL programeaza jobul de expirare DUPA commit, cu valoarea intoarsa.
//  - ocupanti dar nicio oferta deschisa (SENT/EXPIRED) pe sloturi vii → coboara la CLAIMED_*.
// Nu suprascrie ACCEPTED/EXPIRED/DELIVERED/etc.
export async function recomputeRequestStatusAfterClaimChange(
  tx: Tx,
  requestId: string,
  opts?: { republishExpiresAt?: Date },
  maxClaims: number = DEFAULT_MAX_CLAIMS,
): Promise<{ republishedExpiresAt: Date | null }> {
  const none = { republishedExpiresAt: null };
  const request = await tx.request.findUnique({ where: { id: requestId } });
  if (!request || request.deletedAt) return none;
  const claimStates = [
    'IN_MARKETPLACE',
    'CLAIMED_PARTIAL',
    'CLAIMED_FULL',
    'OFFERS_RECEIVED',
    'NEGOTIATION',
  ] as const;
  if (!claimStates.includes(request.status as (typeof claimStates)[number])) return none;

  const occupied = await tx.claimSlot.count({
    where: { requestId, status: { in: OCCUPYING_CLAIM_STATUSES } },
  });

  if (occupied === 0) {
    if (request.status === 'IN_MARKETPLACE') return none;
    const expiresAt = opts?.republishExpiresAt ?? null;
    await tx.request.update({
      where: { id: requestId },
      data: { status: 'IN_MARKETPLACE', ...(expiresAt ? { expiresAt } : {}) },
    });
    return { republishedExpiresAt: expiresAt };
  }

  if (request.status === 'OFFERS_RECEIVED' || request.status === 'NEGOTIATION') {
    const openQuotes = await tx.quote.count({
      where: {
        requestId,
        status: { in: ['SENT', 'EXPIRED'] },
        claimSlot: { status: { in: OCCUPYING_CLAIM_STATUSES } },
      },
    });
    if (openQuotes > 0) return none; // raman oferte vii → statusul de negociere ramane
  }

  const next = occupied >= maxClaims ? 'CLAIMED_FULL' : 'CLAIMED_PARTIAL';
  if (next !== request.status) {
    await tx.request.update({ where: { id: requestId }, data: { status: next } });
  }
  return none;
}

// 4.11 / Î20 / D-v6-13 — dupa ce un claim rateaza SLA, daca cererea nu mai are claim activ:
// re-publicare IN_MARKETPLACE cu ceas nou, excluderea firmelor care au ratat (SLA_BREACH),
// fara consum de repost. Returneaza true daca s-a re-publicat.
export async function republishAfterMassBreach(
  tx: Tx,
  requestId: string,
  newExpiresAt: Date,
): Promise<boolean> {
  const request = await tx.request.findUnique({ where: { id: requestId } });
  if (!request || request.deletedAt) return false;
  // Pasul 5 (F4): si OFFERS_RECEIVED/NEGOTIATION se pot goli de ocupanti (retragere de
  // oferta + SLA ratat) — fara ele, re-publicarea promisa de 4.11 nu se intampla niciodata.
  const claimStates = [
    'IN_MARKETPLACE',
    'CLAIMED_PARTIAL',
    'CLAIMED_FULL',
    'OFFERS_RECEIVED',
    'NEGOTIATION',
  ] as const;
  if (!claimStates.includes(request.status as (typeof claimStates)[number])) return false;

  const occupied = await tx.claimSlot.count({
    where: { requestId, status: { in: OCCUPYING_CLAIM_STATUSES } },
  });
  if (occupied > 0) return false; // inca exista firme active → nu re-publicam

  // Exclude firmele care au ratat SLA pe aceasta cerere (nu pot re-claima).
  const breached = await tx.claimSlot.findMany({
    where: { requestId, status: 'SLA_EXPIRED' },
    select: { companyId: true },
    distinct: ['companyId'],
  });
  for (const b of breached) {
    await tx.requestCompanyExclusion.upsert({
      where: { requestId_companyId: { requestId, companyId: b.companyId } },
      update: {},
      create: { requestId, companyId: b.companyId, reason: 'SLA_BREACH' },
    });
  }
  await tx.request.update({
    where: { id: requestId },
    data: { status: 'IN_MARKETPLACE', expiresAt: newExpiresAt },
  });
  return true;
}
