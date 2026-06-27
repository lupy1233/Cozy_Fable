// Enum-uri canonice din docs/04 §5.5 — folosite VERBATIM in DB, API si UI.

export const PROJECT_SIZES = ['SMALL', 'MEDIUM', 'LARGE'] as const;
export type ProjectSize = (typeof PROJECT_SIZES)[number];

export const COMPANY_MEMBER_ROLES = ['OWNER', 'MANAGER', 'EMPLOYEE_TRUSTED', 'EMPLOYEE_MANAGED'] as const;
export type CompanyMemberRole = (typeof COMPANY_MEMBER_ROLES)[number];

export const CLAIM_SLOT_STATUSES = [
  'ACTIVE',
  'OFFER_SENT',
  'CANCELLED_UNASSIGNED',
  'CANCELLED_BY_CLIENT',
  'WITHDRAWN_VOLUNTARY',
  'WITHDRAWN',
  'SLA_EXPIRED',
  'COMPLETED',
] as const;
export type ClaimSlotStatus = (typeof CLAIM_SLOT_STATUSES)[number];

// clarification_requests.status (Sprint 7). 4.11.
export const CLARIFICATION_STATUSES = ['PENDING', 'ANSWERED'] as const;
export type ClarificationStatus = (typeof CLARIFICATION_STATUSES)[number];

// Sprint 8 (nedefinite verbatim in docs/04, confirmate in sesiune).
export const REVIEW_DISPUTE_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'] as const;
export type ReviewDisputeStatus = (typeof REVIEW_DISPUTE_STATUSES)[number];

export const BILLING_ORDER_TYPES = ['SUBSCRIPTION', 'CREDIT_PACKAGE'] as const;
export type BillingOrderType = (typeof BILLING_ORDER_TYPES)[number];

export const BILLING_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
export type BillingOrderStatus = (typeof BILLING_ORDER_STATUSES)[number];

export const WITHDRAWAL_REASON_TYPES = [
  'CLIENT_UNRESPONSIVE_48H',
  'REQUEST_MODIFIED_POST_CLAIM',
  'CLIENT_CONTACT_INVALID',
  'CLIENT_REQUESTED_CANCELLATION',
  'VOLUNTARY_NO_REASON',
  'CUSTOM',
] as const;
export type WithdrawalReasonType = (typeof WITHDRAWAL_REASON_TYPES)[number];

export const WITHDRAWAL_STATUSES = [
  'AUTO_APPROVED',
  'PENDING_ADMIN_REVIEW',
  'ADMIN_APPROVED',
  'ADMIN_REJECTED',
] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export const CONSULTATION_INVITE_STATUSES = [
  'PENDING_CLIENT',
  'ACCEPTED',
  'DECLINED',
  'COMPLETED',
  'EXPIRED',
] as const;
export type ConsultationInviteStatus = (typeof CONSULTATION_INVITE_STATUSES)[number];

export const CURRENCIES = ['RON', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const OFFER_FIELD_KEYS = ['PRICE', 'DELIVERY_TERM', 'DELIVERY_DATE', 'WARRANTY', 'DESCRIPTION'] as const;
export type OfferFieldKey = (typeof OFFER_FIELD_KEYS)[number];

export const COMPANY_STATUSES = ['PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

// Nume canonic confirmat in Sprint 0: IN_MARKETPLACE (nu PUBLISHED).
export const REQUEST_STATUSES = [
  'DRAFT',
  'IN_MARKETPLACE',
  'CLAIMED_PARTIAL',
  'CLAIMED_FULL',
  'OFFERS_RECEIVED',
  'NEGOTIATION',
  'ACCEPTED',
  'IN_EXECUTION',
  'DELIVERED_BY_COMPANY',
  'COMPLETED',
  'DISPUTED',
  'EXPIRED',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const LANGUAGES = ['RO', 'EN'] as const;
export type Language = (typeof LANGUAGES)[number];

export const PENALTY_SCOPES = ['EMPLOYEE', 'COMPANY'] as const;
export type PenaltyScope = (typeof PENALTY_SCOPES)[number];

export const ROOM_TYPES = ['KITCHEN', 'DRESSING', 'LIVING', 'OFFICE', 'BEDROOM', 'BATHROOM'] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const MATERIALS = ['PAL', 'MDF', 'LEMN_MASIV'] as const;
export type Material = (typeof MATERIALS)[number];

export const ITEM_SYSTEMS = ['PUSH', 'GLISANTE', 'BUTON_PRESIUNE'] as const;
export type ItemSystem = (typeof ITEM_SYSTEMS)[number];

export const ATTACHMENT_STATUSES = ['PENDING_UPLOAD', 'PENDING_SCAN', 'SAFE', 'BLOCKED'] as const;
export type AttachmentStatus = (typeof ATTACHMENT_STATUSES)[number];

export const BUDGET_RANGES = ['UNDER_5K', 'FROM_5K_TO_15K', 'OVER_15K'] as const;
export type BudgetRange = (typeof BUDGET_RANGES)[number];

// Dimensiunea camerei pe metri liniari (length_m) — folosita la scoring.
export const ROOM_SIZE_BUCKETS = ['UNDER_2M', 'FROM_2_TO_4M', 'OVER_4M'] as const;
export type RoomSizeBucket = (typeof ROOM_SIZE_BUCKETS)[number];

// Cantitatea de iteme per camera — folosita la scoring.
export const ITEM_QUANTITY_BUCKETS = ['QTY_1', 'QTY_2_3', 'QTY_4_PLUS'] as const;
export type ItemQuantityBucket = (typeof ITEM_QUANTITY_BUCKETS)[number];

// docs/04 §5.3 + 4.16 — planuri abonament (tier + gating delay 0/30/60 min).
export const SUBSCRIPTION_PLAN_TIERS = ['SILVER', 'GOLD', 'PLATINUM'] as const;
export type SubscriptionPlanTier = (typeof SUBSCRIPTION_PLAN_TIERS)[number];

// Starea abonamentului firmei. Creditele raman valabile 3 luni dupa EXPIRED (4.16).
export const SUBSCRIPTION_STATUSES = ['ACTIVE', 'EXPIRED', 'CANCELLED'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// docs/04 §5.1 credit_transactions — tipuri de miscare in portofel (4.8).
// RESERVE la claim, REFUND la anulare valida/edit post-claim, CONSUME la finalizare,
// GRANT la trial/top-up.
export const CREDIT_TRANSACTION_TYPES = ['GRANT', 'RESERVE', 'REFUND', 'CONSUME'] as const;
export type CreditTransactionType = (typeof CREDIT_TRANSACTION_TYPES)[number];

// docs/04 §5.2 request_company_exclusions — motiv excludere de la re-claim (4.11).
export const REQUEST_EXCLUSION_REASONS = ['SLA_BREACH'] as const;
export type RequestExclusionReason = (typeof REQUEST_EXCLUSION_REASONS)[number];

// Status oferta (Sprint 6; nedefinit verbatim in docs/04, confirmat in sesiune).
// SUPERSEDED = inlocuita de o versiune mai noua sau de oferta acceptata a altei firme.
export const QUOTE_STATUSES = ['DRAFT', 'SENT', 'WITHDRAWN', 'EXPIRED', 'ACCEPTED', 'SUPERSEDED'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

// Status cerere de modificare a clientului (4.13). FULFILLED = firma a raspuns cu versiune
// noua; REJECTED = firma a refuzat (nu consuma slot; clientul nu poate cere aceeasi modificare).
export const QUOTE_CHANGE_REQUEST_STATUSES = ['PENDING', 'FULFILLED', 'REJECTED'] as const;
export type QuoteChangeRequestStatus = (typeof QUOTE_CHANGE_REQUEST_STATUSES)[number];
