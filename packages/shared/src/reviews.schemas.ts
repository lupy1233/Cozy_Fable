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
