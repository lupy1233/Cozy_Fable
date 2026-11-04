import { z } from 'zod';
import {
  CLAIM_SLOT_STATUSES,
  PROJECT_CASE_OPENED_BY,
  PROJECT_CASE_REASONS,
  PROJECT_CASE_RESPONSES,
  PROJECT_CASE_STATUSES,
  QUOTE_STATUSES,
  REQUEST_STATUSES,
  SETTLEMENT_OUTCOMES,
} from './enums';

// E-admin-platform-3 — proiect acceptat blocat: raportare (client / firma castigatoare),
// raspunsul celeilalte parti, inchiderea de catre admin cu decontare explicita.

const optionalNote = z.string().trim().max(1000).optional();

// Partea care raporteaza; motivele permise fiecarei parti se valideaza in service.
export const openProjectCaseSchema = z.object({
  reason: z.enum(PROJECT_CASE_REASONS),
  note: optionalNote,
});
export type OpenProjectCaseInput = z.infer<typeof openProjectCaseSchema>;

// Cealalta parte confirma anularea de comun acord sau contesta raportul.
export const respondProjectCaseSchema = z.object({
  confirmCancel: z.boolean(),
  note: optionalNote,
});
export type RespondProjectCaseInput = z.infer<typeof respondProjectCaseSchema>;

// Adminul inchide proiectul: rezultatul creditelor e ales EXPLICIT (fara valoare implicita).
export const closeProjectSchema = z.object({
  creditOutcome: z.enum(SETTLEMENT_OUTCOMES),
  adminNote: z.string().trim().min(10).max(1000),
});
export type CloseProjectInput = z.infer<typeof closeProjectSchema>;

export const dismissProjectCaseSchema = z.object({
  adminNote: z.string().trim().min(10).max(1000),
});
export type DismissProjectCaseInput = z.infer<typeof dismissProjectCaseSchema>;

export const ADMIN_REQUEST_FILTERS = ['accepted', 'openCases', 'overdue', 'all'] as const;
export type AdminRequestFilter = (typeof ADMIN_REQUEST_FILTERS)[number];

// --- DTO-uri raspuns ---

export interface ProjectCaseDto {
  id: string;
  requestId: string;
  claimSlotId: string;
  openedBy: (typeof PROJECT_CASE_OPENED_BY)[number];
  reason: (typeof PROJECT_CASE_REASONS)[number];
  note: string | null;
  status: (typeof PROJECT_CASE_STATUSES)[number];
  response: (typeof PROJECT_CASE_RESPONSES)[number] | null;
  responseNote: string | null;
  respondedAt: string | null;
  creditOutcome: (typeof SETTLEMENT_OUTCOMES)[number] | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface AdminRequestListItemDto {
  id: string;
  title: string;
  status: (typeof REQUEST_STATUSES)[number];
  clientName: string | null;
  winnerCompanyName: string | null;
  acceptedAt: string | null;
  // data de livrare din ultima versiune a ofertei acceptate (YYYY-MM-DD)
  deliveryDate: string | null;
  overdue: boolean;
  openCase: boolean;
  updatedAt: string;
}

export interface AdminRequestListPageDto {
  items: AdminRequestListItemDto[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminRequestSlotDto {
  id: string;
  companyId: string;
  companyName: string;
  status: (typeof CLAIM_SLOT_STATUSES)[number];
  claimCostCreditsSnapshot: number;
  createdAt: string;
  withdrawnAt: string | null;
}

export interface AdminRequestQuoteDto {
  id: string;
  claimSlotId: string;
  companyName: string;
  status: (typeof QUOTE_STATUSES)[number];
  acceptedAt: string | null;
  price: number;
  currency: string;
  deliveryDate: string | null;
  deliveryTerm: string | null;
  validUntil: string;
}

export interface AdminCreditMovementDto {
  id: string;
  companyName: string;
  type: string;
  amount: number;
  reason: string | null;
  claimSlotId: string | null;
  createdAt: string;
}

// Cronologia proiectului: `kind` e tradus in FE (Admin.requests.timeline.<kind>),
// `params` poarta doar coduri/nume afisabile (fara text liber din note).
export const ADMIN_TIMELINE_KINDS = [
  'REQUEST_CREATED',
  'REQUEST_PUBLISHED',
  'CLAIMED',
  'SLOT_CLOSED',
  'QUOTE_VERSION_SENT',
  'QUOTE_ACCEPTED',
  'DELIVERED',
  'PROJECT_CANCELLED',
  'CREDIT_MOVEMENT',
  'CASE_OPENED',
  'CASE_RESPONDED',
  'CASE_RESOLVED',
  'AUDIT',
] as const;
export type AdminTimelineKind = (typeof ADMIN_TIMELINE_KINDS)[number];

export interface AdminTimelineEntryDto {
  at: string;
  kind: AdminTimelineKind;
  params: Record<string, string | number | null>;
}

export interface AdminRequestDetailDto {
  id: string;
  title: string;
  status: (typeof REQUEST_STATUSES)[number];
  createdAt: string;
  publishedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  client: { id: string; name: string; email: string } | null;
  winner: { companyId: string; companyName: string; claimSlotId: string } | null;
  deliveryDate: string | null;
  overdue: boolean;
  slots: AdminRequestSlotDto[];
  quotes: AdminRequestQuoteDto[];
  creditMovements: AdminCreditMovementDto[];
  cases: ProjectCaseDto[];
  timeline: AdminTimelineEntryDto[];
  closable: boolean;
}
