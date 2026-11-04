import { z } from 'zod';
import {
  CLAIM_SLOT_STATUSES,
  CLARIFICATION_STATUSES,
  WITHDRAWAL_REASON_TYPES,
  WITHDRAWAL_STATUSES,
} from './enums';
import type { WithdrawalReasonType } from './enums';

// Sprint 7 — SLA / clarificari / anulare-retragere claim / penalizari (4.11/4.12/4.15).

// --- retragere/anulare claim (4.15) ---
// E-company-6: rezultatul calculat de server pentru un motiv de retragere (discriminator
// de DTO, NU enum de DB). NOT_ELIGIBLE = motiv automat inca neindeplinit.
export const WITHDRAWAL_OUTCOMES = [
  'REFUND',
  'CONSUME_AND_PENALTY',
  'ADMIN_REVIEW',
  'NOT_ELIGIBLE',
] as const;
export type WithdrawalOutcome = (typeof WITHDRAWAL_OUTCOMES)[number];

export const requestWithdrawalSchema = z
  .object({
    reasonType: z.enum(WITHDRAWAL_REASON_TYPES),
    customReason: z.string().trim().max(2000).optional(),
    // E-company-6: rezultatul confirmat de firma in dialog (doar VOLUNTARY_NO_REASON);
    // daca intre timp s-a schimbat (gratia a expirat) → 409 WITHDRAWAL_OUTCOME_CHANGED.
    expectedOutcome: z.enum(['REFUND', 'CONSUME_AND_PENALTY']).optional(),
  })
  .refine((d) => d.reasonType !== 'CUSTOM' || (d.customReason && d.customReason.length >= 3), {
    message: 'customReasonRequired',
    path: ['customReason'],
  });
export type RequestWithdrawalInput = z.infer<typeof requestWithdrawalSchema>;

// admin decide pe retragerile CUSTOM (PENDING_ADMIN_REVIEW).
export const reviewWithdrawalSchema = z.object({
  approve: z.boolean(),
  adminNote: z.string().trim().max(2000).optional(),
});
export type ReviewWithdrawalInput = z.infer<typeof reviewWithdrawalSchema>;

// --- clarificari (4.11): firma intreaba clientul, SLA pe pauza +1 zi lucratoare ---
export const requestClarificationSchema = z.object({
  questionText: z.string().trim().min(3, 'clarificationTooShort').max(2000),
});
export type RequestClarificationInput = z.infer<typeof requestClarificationSchema>;

export const answerClarificationSchema = z.object({
  answerText: z.string().trim().min(1, 'answerRequired').max(2000),
});
export type AnswerClarificationInput = z.infer<typeof answerClarificationSchema>;

// --- DTO-uri raspuns ---
export interface ClaimWithdrawalDto {
  id: string;
  claimSlotId: string;
  reasonType: (typeof WITHDRAWAL_REASON_TYPES)[number];
  status: (typeof WITHDRAWAL_STATUSES)[number];
  customReason: string | null;
  refunded: boolean;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ClarificationRequestDto {
  id: string;
  claimSlotId: string;
  questionText: string;
  answerText: string | null;
  status: (typeof CLARIFICATION_STATUSES)[number];
  answeredAt: string | null;
  createdAt: string;
}

// Penalizari firma: sold rolling 180 zile + status suspendare (4.12).
export interface PenaltyEventDto {
  id: string;
  ruleKey: string;
  points: number;
  reason: string | null;
  appliedAt: string;
  expiresAt: string;
}

export interface CompanyPenaltyStatusDto {
  activePoints: number;
  threshold: number;
  suspended: boolean;
  suspendedUntil: string | null;
  events: PenaltyEventDto[];
}

// E-company-6: previzualizare read-only a consecintelor retragerii (GET /claims/:id/withdraw-preview).
// E-company-3: de ce un motiv auto-validat nu e (inca) eligibil — UI-ul arata ce are de facut firma.
export const WITHDRAWAL_NOT_ELIGIBLE_REASONS = [
  'FIRM_MESSAGE_REQUIRED',
  'WAITING_48H',
  'REQUEST_NOT_EDITED',
  'OFFER_SENT_AFTER_EDIT',
] as const;
export type WithdrawalNotEligibleReason = (typeof WITHDRAWAL_NOT_ELIGIBLE_REASONS)[number];

export interface ClaimWithdrawalReasonPreviewDto {
  reasonType: WithdrawalReasonType;
  outcome: WithdrawalOutcome;
  // CLIENT_UNRESPONSIVE_48H: momentul de la care devine eligibil (null daca e deja / nu se aplica)
  eligibleFrom: string | null;
  // E-company-3: null pentru motivele eligibile si pentru REFUND/ADMIN_REVIEW/CONSUME
  notEligibleReason: WithdrawalNotEligibleReason | null;
}

export interface ClaimWithdrawalPreviewDto {
  claimSlotId: string;
  blockedCode: 'FORBIDDEN' | 'CLAIM_NOT_WITHDRAWABLE' | 'WITHDRAWAL_ALREADY_PENDING' | null;
  claimCostCredits: number;
  graceEndsAt: string;
  withinGrace: boolean;
  // slotul are o oferta trimisa (OFFER_SENT) care se retrage odata cu preluarea
  offerWillBeWithdrawn: boolean;
  penalty: {
    lateWithdrawalPoints: number;
    activePoints: number;
    threshold: number;
    suspensionMonths: number;
  };
  // ordinea = WITHDRAWAL_REASON_TYPES
  reasons: ClaimWithdrawalReasonPreviewDto[];
  pendingWithdrawal: ClaimWithdrawalDto | null;
  computedAt: string;
}

// Item pentru admin: retrageri CUSTOM in asteptarea deciziei.
export interface AdminWithdrawalItemDto {
  id: string;
  claimSlotId: string;
  companyName: string;
  requestTitle: string;
  reasonType: (typeof WITHDRAWAL_REASON_TYPES)[number];
  customReason: string | null;
  status: (typeof WITHDRAWAL_STATUSES)[number];
  createdAt: string;
}

// SLA pe un claim (afisaj firma/client).
