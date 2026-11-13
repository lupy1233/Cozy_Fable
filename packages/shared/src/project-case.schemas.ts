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

// --- e2-2: raportarea unei probleme dupa finalizare (in garantie) ---
// Fereastra = garantia scrisa in oferta acceptata, dar cel putin 24 de luni de la finalizare;
// daca garantia nu se poate citi ca durata, se aplica 24 de luni (decizia PO 2026-11-13).
export const WARRANTY_MIN_MONTHS = 24;
// plafon de siguranta pentru texte absurde ("garantie 999 ani")
const WARRANTY_MAX_MONTHS = 600;

export const openWarrantyCaseSchema = z.object({
  note: z.string().trim().min(1).max(1000),
});
export type OpenWarrantyCaseInput = z.infer<typeof openWarrantyCaseSchema>;

const NUMBER_WORDS: Record<string, number> = {
  un: 1, o: 1, unu: 1, one: 1, a: 1,
  doi: 2, doua: 2, two: 2,
  trei: 3, three: 3,
  patru: 4, four: 4,
  cinci: 5, five: 5,
  sase: 6, six: 6,
  sapte: 7, seven: 7,
  opt: 8, eight: 8,
  noua: 9, nine: 9,
  zece: 10, ten: 10,
  douasprezece: 12, twelve: 12,
};

// Citeste durata garantiei din textul liber al ofertei ("24 luni", "2 ani", "doi ani",
// "5 years"). Mai multe durate in text → cea mai lunga. Fara unitate de timp → null.
export function parseWarrantyMonths(text: string | null | undefined): number | null {
  if (!text) return null;
  const norm = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const re = /(\d+(?:[.,]\d+)?|[a-z]+)\s*(?:de\s+)?(luni|luna|months?|ani|an|years?)(?![a-z])/g;
  let best: number | null = null;
  for (const m of norm.matchAll(re)) {
    const raw = m[1];
    const qty = /^\d/.test(raw) ? Number(raw.replace(',', '.')) : NUMBER_WORDS[raw];
    if (qty === undefined || !Number.isFinite(qty) || qty <= 0) continue;
    const unit = m[2];
    const months = unit.startsWith('lun') || unit.startsWith('month') ? qty : qty * 12;
    const rounded = Math.min(WARRANTY_MAX_MONTHS, Math.round(months));
    if (rounded > 0 && (best === null || rounded > best)) best = rounded;
  }
  return best;
}

export function warrantyWindowMonths(warrantyText: string | null | undefined): number {
  return Math.max(WARRANTY_MIN_MONTHS, parseWarrantyMonths(warrantyText) ?? 0);
}

// Adauga luni calendaristice (UTC); ziua se limiteaza la ultima zi a lunii (31 ian + 1 = 28/29 feb).
export function addMonthsUtc(from: Date, months: number): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const d = new Date(from.getTime());
  d.setUTCDate(1);
  d.setUTCFullYear(y, m, Math.min(from.getUTCDate(), lastDay));
  return d;
}

export interface WarrantyWindowDto {
  // momentul finalizarii folosit ca baza
  completedAt: string;
  months: number;
  endsAt: string;
  // inca se poate raporta (now < endsAt)
  open: boolean;
}

export const ADMIN_REQUEST_FILTERS =['accepted', 'openCases', 'overdue', 'all'] as const;
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
