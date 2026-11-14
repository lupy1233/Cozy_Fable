import { z } from 'zod';
import { REVIEW_DISPUTE_STATUSES, type ExecutionStage } from './enums';

// Sprint 8 — review post-COMPLETED + dispute (4.18).

export const createReviewSchema = z.object({
  rating: z.number().int().min(1, 'ratingInvalid').max(5, 'ratingInvalid'),
  comment: z.string().trim().max(2000).optional().or(z.literal('')),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

// admin rezolva disputa (status final + nota).
export const resolveDisputeSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  resolutionNote: z.string().trim().max(2000).optional().or(z.literal('')),
});
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

export interface ReviewDto {
  id: string;
  requestId: string;
  companyId: string;
  rating: number;
  comment: string | null;
  disputed: boolean;
  createdAt: string;
}

// e2 pasul 4 — fisa firmei castigatoare: livrarea confirmata + recenzia primita + raportul
// deschis al clientului (in starea livrata sau in garantie). Doar firma castigatoare il citeste.
export interface CompanyCompletionDto {
  requestId: string;
  requestStatus: string;
  deliveredAt: string | null;
  // null la cererile finalizate inainte de coloana completed_at
  completedAt: string | null;
  review: { rating: number; comment: string | null; disputed: boolean; createdAt: string } | null;
  openCase: { reason: string; note: string | null; createdAt: string } | null;
  // review m5: aceleasi reguli ca fisa de lucru — fara acces la datele clientului, comentariul
  // recenziei si nota raportului vin null
  clientTextsHidden: boolean;
  // e1 (PO 2026-11-13): momentul acceptarii ofertei firmei (quotes.accepted_at)
  acceptedAt: string | null;
  // acceptedAt + delivery_min_days_after_accept; null cand setarea e 0 sau nu exista acceptare
  earliestDeliveryAt: string | null;
  // finalizarea automata a livrarii neconfirmate (ceasul repornit dupa un caz inchis);
  // null daca cererea nu e DELIVERED_BY_COMPANY sau ceasul e oprit de un caz deschis
  autoCompleteAt: string | null;
  // mereu toate cele 4 etape, in ordinea EXECUTION_STAGES
  stages: ExecutionStageDto[];
}

// e1-2: etapa informativa bifata de firma castigatoare, vizibila clientului.
export interface ExecutionStageDto {
  stage: ExecutionStage;
  done: boolean;
  completedAt: string | null;
  completedByName: string | null;
}

// PUT company/requests/:id/stages/:stage
export const updateExecutionStageSchema = z.object({ done: z.boolean() });
export type UpdateExecutionStageInput = z.infer<typeof updateExecutionStageSchema>;

// e1-1: GET requests/:id/fulfillment — doar clientul cererii. company / contact = null si
// stages = [] cat nu exista oferta acceptata; doar datele firmei castigatoare.
export interface ClientFulfillmentDto {
  requestId: string;
  acceptedAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  autoCompleteAt: string | null;
  company: {
    name: string;
    cui: string | null;
    addressText: string | null;
    city: string | null;
    county: string | null;
  } | null;
  contact: { name: string; email: string; phone: string | null } | null;
  stages: ExecutionStageDto[];
}

export interface AdminDisputeItemDto {
  id: string;
  reviewId: string;
  requestId: string;
  companyName: string;
  rating: number;
  comment: string | null;
  status: (typeof REVIEW_DISPUTE_STATUSES)[number];
  resolutionNote: string | null;
  createdAt: string;
}
