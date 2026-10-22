import type { Prisma } from '@prisma/client';

// E-company-24: emailurile/notificarile de facturare = doar cine poate deschide comenzi si
// facturi (CompanyManagerGuard: OWNER/MANAGER); conturile sterse/blocate nu primesc nimic.
export const BILLING_MANAGER_ROLES = ['OWNER', 'MANAGER'] as const;

export async function billingManagerIds(
  db: Pick<Prisma.TransactionClient, 'companyMember'>,
  companyId: string,
): Promise<string[]> {
  const rows = await db.companyMember.findMany({
    where: {
      companyId,
      role: { in: [...BILLING_MANAGER_ROLES] },
      user: { deletedAt: null, blockedAt: null },
    },
    select: { userId: true },
  });
  return [...new Set(rows.map((r) => r.userId))];
}
