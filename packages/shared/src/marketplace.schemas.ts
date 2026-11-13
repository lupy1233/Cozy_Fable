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
// (assigned_to_user_id). Lipsa => slot neatribuit (cap manager 4.9) — doar pentru
// proprietar/manager ("Atribui mai tarziu"); angajatul cu acces complet preia mereu pentru
// el (a5, PO 2026-11-13). UI-ul trimite implicit id-ul celui care preia.
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

// --- Cerere care nu mai poate fi preluata (a1, PO 2026-11-13) ---
// De ce o cerere publicata nu mai e in piata: locuri ocupate, oferta acceptata, regula primei
// oferte (doar cu comutatorul din Admin oprit), expirata sau inchisa din alt motiv.
export const MARKETPLACE_CLOSED_REASONS = [
  'SLOTS_FULL',
  'OFFER_ACCEPTED',
  'FIRST_OFFER_RULE',
  'EXPIRED',
  'CLOSED',
] as const;
export type MarketplaceClosedReason = (typeof MARKETPLACE_CLOSED_REASONS)[number];

// details pe eroarea REQUEST_NO_LONGER_CLAIMABLE (GET /marketplace/requests/:id). Se trimite
// doar firmelor care acopera cererea pe raza (si nu sunt excluse) — celelalte primesc NOT_FOUND.
// myClaimSlotId = ultima preluare a firmei pe cerere (link spre fisa de lucru), daca exista.
export interface RequestNoLongerClaimableDetails {
  reason: MarketplaceClosedReason;
  myClaimSlotId: string | null;
}

// Cardul "Cine vede cererea" al clientului: motivul cand proiectul nu mai e in piata
// (null cat e vizibil). Optional: un slot vechi nu trimite campul.
export interface RequestVisibilityClosedReasonDto {
  marketplaceClosedReason?: MarketplaceClosedReason | null;
}

// Detaliu cerere in marketplace (pre-claim): include camerele, fara date de contact (4.2).
export interface MarketplaceDetailDto extends MarketplaceItemDto {
  // a5: termenul de raspuns estimat daca firma preia acum (aceleasi zile lucratoare ca la
  // preluare); null fara marime. Optional: un slot vechi nu trimite campul.
  estimatedSlaDeadlineAt?: string | null;
  // a5: cel care se uita are deja o preluare activa fara oferta → nu poate fi responsabil
  // pe inca una (4.9); dialogul ii spune inainte de confirmare.
  viewerHasActiveClaimWithoutOffer?: boolean;
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
