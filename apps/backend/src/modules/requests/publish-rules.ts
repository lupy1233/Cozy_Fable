import { resolveBudgetFields } from '@marketplace/shared';
import type { CreateRequestContentDto } from './dto/request.dto';

// Reguli pure de publish/edit (E-client-2), testabile fara Prisma.

// Bucket-ul de buget e derivat din estimarea RON (docs/04): serverul ignora
// bucket-ul trimis cand exista estimare. Acelasi obiect alimenteaza scalarData,
// sizing.compute si snapshotul de versiune, deci toate raman consecvente.
export function normalizeBudget<T extends Pick<CreateRequestContentDto, 'budgetRange' | 'budgetEstimateRon'>>(dto: T): T {
  const resolved = resolveBudgetFields(dto.budgetRange, dto.budgetEstimateRon);
  return { ...dto, budgetRange: resolved.budgetRange, budgetEstimateRon: resolved.budgetEstimateRon ?? undefined };
}

// Fisierele de proiect = atasamente SAFE ale cererii pe care nu le refera nicio
// camera (nici schita, nici snapshot3d) — aceeasi regula ca in sumarul din FE.
export function projectFileCount(
  attachments: { id: string; status: string }[],
  referencedIds: Set<string>,
): number {
  return attachments.filter((a) => a.status === 'SAFE' && !referencedIds.has(a.id)).length;
}
