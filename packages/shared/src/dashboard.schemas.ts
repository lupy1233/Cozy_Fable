// E-admin-platform-44 — lista "De facut acum" de pe dashboard (client + firma) si pragul
// de avertizare SLA folosit si de backend (job warn-sla) si de dashboard.

// plan aprobat Sprint 19 (E-admin-platform-44): sla.expiring_soon cu 24h inainte de sla_deadline_at
export const SLA_WARNING_BEFORE_HOURS = 24;

export const DASHBOARD_ACTION_KINDS = [
  'OFFERS_TO_REVIEW',
  'DELIVERY_TO_CONFIRM',
  'CLARIFICATION_TO_ANSWER',
  'REQUEST_EXPIRING',
  'UNASSIGNED_CLAIM',
  'SLA_DUE_SOON',
] as const;
export type DashboardActionKind = (typeof DASHBOARD_ACTION_KINDS)[number];

export interface DashboardActionItemDto {
  kind: DashboardActionKind;
  requestId: string;
  // doar pentru actiunile firmei (fisa preluarii); null la client
  claimSlotId: string | null;
  title: string;
  // numarul de elemente grupate (oferte / intrebari); null cand nu se aplica
  count: number | null;
  // termenul (ISO) — null cand actiunea nu are termen
  dueAt: string | null;
}

// Ordinea listei: termenul cel mai apropiat primul; fara termen la final (ordinea stabila).
export function sortDashboardActions<T extends Pick<DashboardActionItemDto, 'dueAt'>>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.dueAt === b.dueAt) return 0;
    if (a.dueAt === null) return 1;
    if (b.dueAt === null) return -1;
    return Date.parse(a.dueAt) - Date.parse(b.dueAt);
  });
}
