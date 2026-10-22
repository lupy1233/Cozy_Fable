import { Prisma } from '@prisma/client';
import { SETTING_DEFAULTS } from '../../common/settings/setting-defaults';
import {
  ASSIGN_WARNING_BEFORE_DEADLINE_MS,
  OCCUPYING_CLAIM_STATUSES,
  SLA_GRACE_MS,
  SLA_WARNING_BEFORE_MS,
} from './claims.constants';

type Tx = Prisma.TransactionClient;

// E-admin-platform-10 — max_claims_per_request citit IN tranzactie (4.8). Valoare lipsa,
// nenumerica sau < 1 → fallback SETTING_DEFAULTS (acelasi cu pagina publica /firm-rules).
export async function readMaxClaims(tx: Tx): Promise<number> {
  const row = await tx.systemSetting.findUnique({ where: { key: 'max_claims_per_request' } });
  const n = row ? Number.parseInt(row.value, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : SETTING_DEFAULTS.max_claims_per_request;
}

// E-admin-platform-54: helperii de retry au trecut in infra/prisma/tx.ts (runTx pe profile);
// re-exportati aici pentru importurile existente.
export { isSerializationFailure, SERIALIZATION_RETRIES, withSerializationRetry } from '../../infra/prisma/tx';

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

// E-admin-platform-44 — avertizarea sla.expiring_soon (SLA_WARNING_BEFORE_MS inainte de termen).
// jobId include termenul: o clarificare care muta termenul programeaza un warning nou.
export function slaWarningJobOptions(claimSlotId: string, slaDeadlineAt: Date) {
  return {
    delay: Math.max(0, slaDeadlineAt.getTime() - SLA_WARNING_BEFORE_MS - Date.now()),
    jobId: `sla-warn-${claimSlotId}-${slaDeadlineAt.getTime()}`,
    removeOnComplete: true as const,
    removeOnFail: 1000,
  };
}

// E-company-13 — reminderul de la inceputul gratiei (la sla_deadline_at). jobId fara ':'
// (BullMQ) si cu termenul: o clarificare care muta termenul programeaza un reminder nou.
export function slaGraceWarningJobOptions(claimSlotId: string, slaDeadlineAt: Date) {
  return {
    delay: Math.max(0, slaDeadlineAt.getTime() - Date.now()),
    jobId: `sla-grace-warn-${claimSlotId}-${slaDeadlineAt.getTime()}`,
    removeOnComplete: true as const,
    removeOnFail: 1000,
  };
}

// E-company-13 — cheia outbox a reminderului de gratie (un singur rand per slot + termen).
export const slaGraceWarningEventKey = (claimSlotId: string, deadlineMs: number) =>
  `sla.expiring_soon:grace:${claimSlotId}:${deadlineMs}`;

// E-admin-platform-44 — avertizarea claim.assign_warning la +30 min (4.9 / D2).
export function assignWarningJobOptions(claimSlotId: string, assignDeadlineAt: Date) {
  return {
    delay: Math.max(0, assignDeadlineAt.getTime() - ASSIGN_WARNING_BEFORE_DEADLINE_MS - Date.now()),
    jobId: `claim-assign-warn-${claimSlotId}`,
    removeOnComplete: true as const,
    removeOnFail: 1000,
  };
}

// E-admin-platform-44 — cine primeste avertizarile de termen: OWNER/MANAGER (doar ei pot
// atribui) + cine a preluat; cu includeAssignee si responsabilul. Fara duplicate.
// Doar membrii CURENTI ai firmei: un fost angajat (scos din firma) nu mai primeste nimic.
export async function claimAlertTargets(
  db: Pick<Tx, 'companyMember'>,
  claim: { companyId: string; claimedByUserId: string | null; assignedToUserId: string | null },
  includeAssignee: boolean,
): Promise<string[]> {
  const extra = [claim.claimedByUserId, includeAssignee ? claim.assignedToUserId : null]
    .filter((id): id is string => !!id);
  const members = await db.companyMember.findMany({
    where: {
      companyId: claim.companyId,
      OR: [{ role: { in: ['OWNER', 'MANAGER'] } }, ...(extra.length ? [{ userId: { in: extra } }] : [])],
    },
    select: { userId: true, role: true },
  });
  const current = new Set(members.map((m) => m.userId));
  const ids = members.filter((m) => m.role === 'OWNER' || m.role === 'MANAGER').map((m) => m.userId);
  for (const id of extra) if (current.has(id)) ids.push(id);
  return [...new Set(ids)];
}

// E-company-6: momentul in care procesorul SLA expira preluarea (termen + 12h gratie).
// null cand nu exista termen sau SLA e pe pauza (procesorul sare peste sloturile pe pauza).
export function slaBreachAt(deadline: Date | null, pausedAt: Date | null): Date | null {
  if (!deadline || pausedAt) return null;
  return new Date(deadline.getTime() + SLA_GRACE_MS);
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
// E-admin-platform-10: fara maxClaims explicit, pragul CLAIMED_FULL vine din system_settings
// (citit LENES, doar cand chiar se scrie un CLAIMED_* — bugetul de 10 s al tranzactiei).
export async function recomputeRequestStatusAfterClaimChange(
  tx: Tx,
  requestId: string,
  opts?: { republishExpiresAt?: Date },
  maxClaims?: number,
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

  const max = maxClaims ?? (await readMaxClaims(tx));
  const next = occupied >= max ? 'CLAIMED_FULL' : 'CLAIMED_PARTIAL';
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
