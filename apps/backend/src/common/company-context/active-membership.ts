import type { Prisma } from '@prisma/client';

// Relatiile incluse nu trec prin middleware Prisma; verificarea apartenentei este explicita.
export function activeMembershipWhere(userId: string): Prisma.CompanyMemberWhereUniqueInput {
  return { userId, company: { deletedAt: null }, user: { deletedAt: null, blockedAt: null } };
}
