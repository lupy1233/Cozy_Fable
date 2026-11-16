import type { Prisma } from '@prisma/client';
import { BILLING_MANAGER_ROLES } from '../billing/billing-recipients';

// g1 (etapa 9) — regulile comune ale notificarilor (clopotel + e-mail).

// Evenimente doar pe e-mail: randul din `notifications` exista (tine minte livrarea e-mailului,
// exact-o-data), dar NU apare in clopotel si nu intra in numarul de necitite.
// request.published: clientul a publicat chiar el cererea.
export const EMAIL_ONLY_EVENTS: ReadonlySet<string> = new Set(['request.published']);

// Cel care a facut actiunea (payload.actorUserId) nu primeste nici clopotel, nici e-mail.
// Singurul loc unde se aplica: procesorul cozii de notificari.
export function withoutActor(userIds: string[], payload: Record<string, unknown>): string[] {
  const actor = typeof payload.actorUserId === 'string' ? payload.actorUserId : null;
  return actor ? userIds.filter((id) => id !== actor) : userIds;
}

// g1-1 (PO): la evenimentele unei preluari, din firma primesc E-MAIL doar responsabilul preluarii
// (claim_slots.assigned_to_user_id) + proprietarul si managerii; ceilalti membri au doar clopotelul.
// message.created intra aici doar cand scrie clientul (vezi recipientsFor).
export const CLAIM_COMPANY_EMAIL_EVENTS: ReadonlySet<string> = new Set([
  'message.created',
  'quote.accepted',
  'quote.updated', // doar CHANGE_REQUESTED (cererea de modificare a clientului)
  'quote.declined',
  'clarification.answered',
  'request.edited_after_claim',
  'delivery.confirmed',
  'review.created',
]);

type Db = Pick<Prisma.TransactionClient, 'companyMember' | 'claimSlot'>;

// Responsabilul preluarii + OWNER/MANAGER (conturi nesterse, neblocate). Fara responsabil →
// doar OWNER/MANAGER. Slotul se cauta dupa claimSlotId; payload-urile vechi fara slot cad pe
// ultima preluare a firmei pe cerere.
export async function claimCompanyEmailRecipients(
  db: Db,
  p: { companyId: string; claimSlotId?: string | null; requestId?: string | null },
): Promise<Set<string>> {
  const managers = await db.companyMember.findMany({
    where: {
      companyId: p.companyId,
      role: { in: [...BILLING_MANAGER_ROLES] },
      user: { deletedAt: null, blockedAt: null },
    },
    select: { userId: true },
  });
  const ids = new Set(managers.map((m) => m.userId));
  const slot = p.claimSlotId
    ? await db.claimSlot.findUnique({
        where: { id: p.claimSlotId },
        select: { assignedToUserId: true, companyId: true },
      })
    : p.requestId
      ? await db.claimSlot.findFirst({
          where: { requestId: p.requestId, companyId: p.companyId },
          orderBy: { createdAt: 'desc' },
          select: { assignedToUserId: true, companyId: true },
        })
      : null;
  if (slot?.assignedToUserId && slot.companyId === p.companyId) ids.add(slot.assignedToUserId);
  return ids;
}
