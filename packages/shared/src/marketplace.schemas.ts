import { z } from 'zod';
import {
  BUDGET_RANGES,
  CLAIM_SLOT_STATUSES,
  DEADLINE_BUCKETS,
  PROJECT_SIZES,
  REQUEST_STATUSES,
  SUBSCRIPTION_PLAN_TIERS,
  SUBSCRIPTION_STATUSES,
} from './enums';
import type { RequestRoomDto } from './request.schemas';

// Sprint 5 — marketplace (listare cereri pentru firme) + claim + portofel credite.

// --- Claim ---
// Optional: managerul/owner-ul poate atribui claim-ul unui angajat la creare
// (assigned_to_user_id). Lipsa => slot neatribuit (cap manager 4.9).
export const createClaimSchema = z.object({
  requestId: z.string().uuid(),
  assignToUserId: z.string().uuid().optional(),
});
export type CreateClaimInput = z.infer<typeof createClaimSchema>;

// Reatribuire claim existent unui alt membru (manager/owner).
export const assignClaimSchema = z.object({
  assignToUserId: z.string().uuid(),
});
export type AssignClaimInput = z.infer<typeof assignClaimSchema>;

// --- DTO-uri raspuns ---

// Card de cerere vizibil in marketplace pentru o firma eligibila.
// Datele de contact NU sunt incluse aici (enforce 4.2 la nivel API).
export interface MarketplaceItemDto {
  id: string;
  title: string;
  description: string;
  budgetRange: (typeof BUDGET_RANGES)[number];
  city: string;
  county: string;
  size: (typeof PROJECT_SIZES)[number] | null;
  creditCost: number | null;
  includesPaidDesign: boolean;
  hasOwnProject: boolean;
  distanceKm: number;
  publishedAt: string;
  // Transparenta gating (4.10): doar timpul scurs de la publicare, fara mentiuni de plan.
  publishedAgoMinutes: number;
  activeClaims: number;
  maxClaims: number;
  alreadyClaimedByMyCompany: boolean;
}

// Detaliu cerere in marketplace (pre-claim): include camerele, fara date de contact (4.2).
export interface MarketplaceDetailDto extends MarketplaceItemDto {
  deadlineBucket: (typeof DEADLINE_BUCKETS)[number] | null;
  rooms: RequestRoomDto[];
}

export interface ClaimSlotDto {
  id: string;
  requestId: string;
  companyId: string;
  claimedByUserId: string;
  assignedToUserId: string | null;
  status: (typeof CLAIM_SLOT_STATUSES)[number];
  projectSizeSnapshot: (typeof PROJECT_SIZES)[number];
  projectScoreSnapshot: number;
  claimCostCreditsSnapshot: number;
  chatThreadId: string;
  // SLA materializat la claim (4.11, Sprint 7). null daca slotul nu mai e in SLA.
  slaDeadlineAt: string | null;
  slaPaused: boolean;
  createdAt: string;
  // aditive (pagina dedicata de claims): titlul cererii + numele persoanelor
  requestTitle?: string | null;
  claimedByName?: string | null;
  assignedToName?: string | null;
}

export interface CreditWalletDto {
  companyId: string;
  balance: number;
  reserved: number;
  available: number;
}

export interface SubscriptionDto {
  id: string;
  tier: (typeof SUBSCRIPTION_PLAN_TIERS)[number];
  status: (typeof SUBSCRIPTION_STATUSES)[number];
  isTrial: boolean;
  startedAt: string;
  expiresAt: string;
  gatingDelayMinutes: number;
}

// Cererea asa cum o vede o firma cu claim (subset din RequestDto, fara contact
// pana cand preferinta clientului permite — Sprint 6 servire date contact).
export interface ClaimedRequestDto {
  id: string;
  status: (typeof REQUEST_STATUSES)[number];
  title: string;
  description: string;
  budgetRange: (typeof BUDGET_RANGES)[number];
  city: string;
  county: string;
  size: (typeof PROJECT_SIZES)[number] | null;
  myClaim: ClaimSlotDto;
}
