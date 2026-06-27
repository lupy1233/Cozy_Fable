import { Prisma } from '@prisma/client';
import { DEFAULT_MAX_CLAIMS, OCCUPYING_CLAIM_STATUSES } from './claims.constants';

type Tx = Prisma.TransactionClient;

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
// Doar daca cererea e intr-un status de claim (nu suprascrie ACCEPTED/EXPIRED/etc.).
export async function recomputeRequestStatusAfterClaimChange(
  tx: Tx,
  requestId: string,
  maxClaims: number = DEFAULT_MAX_CLAIMS,
): Promise<void> {
  const request = await tx.request.findUnique({ where: { id: requestId } });
  if (!request) return;
  const claimStates = ['IN_MARKETPLACE', 'CLAIMED_PARTIAL', 'CLAIMED_FULL'] as const;
  if (!claimStates.includes(request.status as (typeof claimStates)[number])) return;

  const occupied = await tx.claimSlot.count({
    where: { requestId, status: { in: OCCUPYING_CLAIM_STATUSES } },
  });
  const next =
    occupied >= maxClaims ? 'CLAIMED_FULL' : occupied > 0 ? 'CLAIMED_PARTIAL' : 'IN_MARKETPLACE';
  if (next !== request.status) {
    await tx.request.update({ where: { id: requestId }, data: { status: next } });
  }
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
  if (!request) return false;
  const claimStates = ['IN_MARKETPLACE', 'CLAIMED_PARTIAL', 'CLAIMED_FULL'] as const;
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
