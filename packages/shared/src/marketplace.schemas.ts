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
import type { AttachmentDto, RequestInspirationPhotoDto, RequestRoomDto } from './request.schemas';
import type { RequestStudioSceneDto } from './studio.schemas';

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

// --- Distanta pre-claim (E-client-9) ---
// Benzile de distanta aratate firmelor inainte de claim.
export const MARKETPLACE_DISTANCE_BANDS = ['UNDER_5', 'FROM_5_TO_15', 'FROM_15_TO_30', 'OVER_30'] as const;
export type MarketplaceDistanceBand = (typeof MARKETPLACE_DISTANCE_BANDS)[number];

export function marketplaceDistanceBand(km: number): MarketplaceDistanceBand {
  if (km < 5) return 'UNDER_5';
  if (km < 15) return 'FROM_5_TO_15';
  if (km < 30) return 'FROM_15_TO_30';
  return 'OVER_30';
}

// Ce vad firmele: km intregi (KM, implicit) sau doar banda (BAND) — system_settings.
export const MARKETPLACE_DISTANCE_DISPLAY_MODES = ['KM', 'BAND'] as const;
export type MarketplaceDistanceDisplayMode = (typeof MARKETPLACE_DISTANCE_DISPLAY_MODES)[number];
export const SETTING_MARKETPLACE_DISTANCE_DISPLAY = 'marketplace_distance_display';

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
  // Ambele calculate din punctul APROXIMAT al cererii (grila ~2 km, E-client-9):
  // km intregi (null cand setarea e BAND) + banda, trimisa mereu.
  distanceKm: number | null;
  distanceBand: MarketplaceDistanceBand;
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
  // pozele de inspiratie alese de client (F6); detaliile din GET /inspiration?ids=
  inspirationPhotoIds: string[];
  // E-client-34: aceleasi poze cu notita (mascata) si camera
  inspirationPhotos: RequestInspirationPhotoDto[];
  // atasamentele cererii cu URL-uri presigned (PO r6): schitele per camera si
  // snapshotul PNG al pieselor 3D — continut de proiect, nu date de contact (4.2)
  attachments: AttachmentDto[];
  // camerele 3D din Studio atasate la publish (feedback PO r3) — read-only
  studioScenes?: RequestStudioSceneDto[];
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

// Cererea asa cum o vede o firma cu claim (subset din RequestDto, fara contact
// pana cand preferinta clientului permite — Sprint 6 servire date contact).
