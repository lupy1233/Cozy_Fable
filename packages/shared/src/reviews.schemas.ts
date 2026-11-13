import { z } from 'zod';
import { REVIEW_DISPUTE_STATUSES } from './enums';

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
