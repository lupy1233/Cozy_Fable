import { z } from 'zod';
import {
  CLAIM_SLOT_STATUSES,
  CLARIFICATION_STATUSES,
  WITHDRAWAL_REASON_TYPES,
  WITHDRAWAL_STATUSES,
} from './enums';

// Sprint 7 — SLA / clarificari / anulare-retragere claim / penalizari (4.11/4.12/4.15).

// --- retragere/anulare claim (4.15) ---
export const requestWithdrawalSchema = z
  .object({
    reasonType: z.enum(WITHDRAWAL_REASON_TYPES),
    customReason: z.string().trim().max(2000).optional(),
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
export interface ClaimSlaDto {
  status: (typeof CLAIM_SLOT_STATUSES)[number];
  slaDeadlineAt: string | null;
  slaPaused: boolean;
}
