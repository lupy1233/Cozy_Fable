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
  // L0-B: slot nealese inchis la acceptarea altei oferte pe aceeasi cerere (4.14).
  'CANCELLED_REQUEST_ACCEPTED',
  // E-admin-platform-3: slotul castigator la anularea proiectului (admin) / oferta expirata
  // fara decizie inchisa automat (setari).
  'CANCELLED_PROJECT',
  'CANCELLED_OFFER_EXPIRED',
] as const;
export type ClaimSlotStatus = (typeof CLAIM_SLOT_STATUSES)[number];

// E-admin-platform-3 — request_project_cases (verbatim cu enum-urile Prisma).
export const PROJECT_CASE_REASONS = [
  'FIRM_UNRESPONSIVE',
  'CLIENT_UNRESPONSIVE',
  'MUTUAL_CANCEL_REQUEST',
  'OTHER',
] as const;
export type ProjectCaseReason = (typeof PROJECT_CASE_REASONS)[number];
export const PROJECT_CASE_OPENED_BY = ['CLIENT', 'COMPANY'] as const;
export type ProjectCaseOpenedBy = (typeof PROJECT_CASE_OPENED_BY)[number];
export const PROJECT_CASE_STATUSES = ['OPEN', 'CLOSED_PROJECT_CANCELLED', 'DISMISSED'] as const;
export type ProjectCaseStatus = (typeof PROJECT_CASE_STATUSES)[number];
export const PROJECT_CASE_RESPONSES = ['CONFIRMED_CANCEL', 'CONTESTED'] as const;
export type ProjectCaseResponse = (typeof PROJECT_CASE_RESPONSES)[number];
export const SETTLEMENT_OUTCOMES = ['REFUND', 'CONSUME'] as const;
export type SettlementOutcome = (typeof SETTLEMENT_OUTCOMES)[number];
// motivele permise fiecarei parti (clientul nu poate spune "clientul nu raspunde" si invers)
export const CLIENT_CASE_REASONS = ['FIRM_UNRESPONSIVE', 'MUTUAL_CANCEL_REQUEST', 'OTHER'] as const;
export const COMPANY_CASE_REASONS = ['CLIENT_UNRESPONSIVE', 'MUTUAL_CANCEL_REQUEST', 'OTHER'] as const;

// clarification_requests.status (Sprint 7). 4.11.
export const CLARIFICATION_STATUSES = ['PENDING', 'ANSWERED'] as const;

// Sprint 8 (nedefinite verbatim in docs/04, confirmate in sesiune).
export const REVIEW_DISPUTE_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'] as const;

export const BILLING_ORDER_TYPES = ['SUBSCRIPTION', 'CREDIT_PACKAGE'] as const;

export const BILLING_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
export type BillingOrderStatus = (typeof BILLING_ORDER_STATUSES)[number];

// E-admin-platform-4 â€” stare raportare e-Factura per comanda (paritate cu enum Prisma e_invoice_status)
export const E_INVOICE_STATUSES = ['PENDING', 'UPLOADED', 'VALIDATED', 'REJECTED', 'NOT_REQUIRED'] as const;
export type EInvoiceStatus = (typeof E_INVOICE_STATUSES)[number];

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

export const CONSULTATION_INVITE_STATUSES = [
  'PENDING_CLIENT',
  'ACCEPTED',
  'DECLINED',
  'COMPLETED',
  'EXPIRED',
] as const;

export const CURRENCIES = ['RON', 'EUR'] as const;

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
  // E-admin-platform-3: proiect anulat dupa acceptare (inchis de admin)
  'CANCELLED',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const LANGUAGES = ['RO', 'EN'] as const;
export type Language = (typeof LANGUAGES)[number];

export const PENALTY_SCOPES = ['EMPLOYEE', 'COMPANY'] as const;
export type PenaltyScope = (typeof PENALTY_SCOPES)[number];

// PIECES = piese individuale de mobilier (tab separat in configurator, fara camera).
// Extindere 2026-07-07 (decizie PO): camere noi (hol, debara, spalatorie, balcon)
// + piese ghidate individuale cu prefix PIECE_ (fiecare cu flow propriu de intrebari).
// PIECES ramane fallback-ul "Alta piesa" cu formular liber. Gruparea camera/piesa si
// ordinea fixa a intrebarilor stau in room-meta.ts (nu aici — enum VERBATIM docs/04).
export const ROOM_TYPES = [
  'KITCHEN',
  'DRESSING',
  'LIVING',
  'OFFICE',
  'BEDROOM',
  'BATHROOM',
  'PIECES',
  'HALLWAY',
  'PANTRY',
  'LAUNDRY',
  'BALCONY',
  'PIECE_WARDROBE',
  'PIECE_TV_UNIT',
  'PIECE_BOOKCASE',
  'PIECE_DESK',
  'PIECE_BED',
  'PIECE_DRESSER',
  'PIECE_TABLE',
  'PIECE_SHOE_CABINET',
  'PIECE_NIGHTSTAND',
  'PIECE_BENCH',
  'PIECE_SIDEBOARD',
  'PIECE_WALL_CABINET',
  'PIECE_BATHROOM_VANITY',
  'PIECE_ENTRYWAY',
  'PIECE_SOFA',
  'PIECE_ARMCHAIR',
  'PIECE_OTTOMAN',
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

// Extindere 2026-07-08 (feedback PO, kitchen v2): variante MDF explicite + ALTUL
// (material liber, textul vine dintr-un step conditional si intra in description).
// MDF simplu ramane pentru raspunsurile vechi, dar nu se mai ofera in flow-uri.
export const MATERIALS = [
  'PAL',
  'MDF',
  'MDF_INFOLIAT',
  'MDF_VOPSIT',
  'MDF_FURNIR',
  'LEMN_MASIV',
  'ALTUL',
] as const;
export type Material = (typeof MATERIALS)[number];

// Extindere 2026-07-08: MANER (maner clasic), GOLA (profil frezat), AVENTOS
// (ridicare verticala, doar corpuri suspendate). BUTON_PRESIUNE ramane legacy.
export const ITEM_SYSTEMS = ['PUSH', 'GLISANTE', 'BUTON_PRESIUNE', 'MANER', 'GOLA', 'AVENTOS'] as const;
export type ItemSystem = (typeof ITEM_SYSTEMS)[number];

export const ATTACHMENT_STATUSES = ['PENDING_UPLOAD', 'PENDING_SCAN', 'SAFE', 'BLOCKED'] as const;

// Culorile galeriei de inspiratie (F6 2026-07-08) — filtru pe /inspiration.
export const INSPIRATION_COLORS = [
  'WHITE',
  'BLACK',
  'GRAY',
  'BEIGE',
  'BROWN',
  'NATURAL_WOOD',
  'GREEN',
  'BLUE',
  'RED',
  'YELLOW',
  'MULTICOLOR',
] as const;
export type InspirationColor = (typeof INSPIRATION_COLORS)[number];

export const BUDGET_RANGES = ['UNDER_5K', 'FROM_5K_TO_15K', 'OVER_15K', 'UNDISCLOSED'] as const;
export type BudgetRange = (typeof BUDGET_RANGES)[number];

// Termen dorit ca interval orientativ (carduri in configurator), nu data exacta.
export const DEADLINE_BUCKETS = [
  'ASAP',
  'ONE_TO_THREE_MONTHS',
  'THREE_TO_SIX_MONTHS',
  'SIX_PLUS_MONTHS',
  'FLEXIBLE',
] as const;
export type DeadlineBucket = (typeof DEADLINE_BUCKETS)[number];

// Canale de contact permise (validate ca format email / telefon RO).
export const CONTACT_CHANNELS = ['EMAIL', 'PHONE'] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

// Dimensiunea camerei pe metri liniari (length_m) — folosita la scoring.
export const ROOM_SIZE_BUCKETS = ['UNDER_2M', 'FROM_2_TO_4M', 'OVER_4M'] as const;
export type RoomSizeBucket = (typeof ROOM_SIZE_BUCKETS)[number];

// Cantitatea de iteme per camera — folosita la scoring.
export const ITEM_QUANTITY_BUCKETS = ['QTY_1', 'QTY_2_3', 'QTY_4_PLUS'] as const;
export type ItemQuantityBucket = (typeof ITEM_QUANTITY_BUCKETS)[number];

// docs/04 §5.3 + 4.16 — planuri abonament (tier + gating delay 0/30/60 min).
// E-admin-platform-58: DOAR codurile legacy seed-uite (paritate cu enum-ul Prisma
// subscription_plan_tier, coloana legacy). Identitatea planului = subscription_plans.code
// (PlanCode, string liber validat cu PLAN_CODE_RE) — nu folosi lista pentru validarea planurilor.
export const SUBSCRIPTION_PLAN_TIERS = ['SILVER', 'GOLD', 'PLATINUM'] as const;
export type SubscriptionPlanTier = (typeof SUBSCRIPTION_PLAN_TIERS)[number];

// Starea abonamentului firmei. Creditele raman valabile 3 luni dupa EXPIRED (4.16) —
// neimplementat, DECIZIE NECESARA PO (E-company-21): creditele nu expira in cod.
export const SUBSCRIPTION_STATUSES = ['ACTIVE', 'EXPIRED', 'CANCELLED'] as const;

// docs/04 §5.1 credit_transactions — tipuri de miscare in portofel (4.8).
// RESERVE la claim, REFUND la anulare valida/edit post-claim, CONSUME la finalizare,
// GRANT la trial/top-up.
export const CREDIT_TRANSACTION_TYPES = ['GRANT', 'RESERVE', 'REFUND', 'CONSUME'] as const;

// E-admin-platform-15 — motivele din credit_transactions.reason. Coloana din DB ramane text
// (randurile istorice pot avea alte valori); lista tipeaza doar scrierile noi si alimenteaza
// viitorul extras de credite din UI. Valorile = exact stringurile scrise de cod azi.
export const CREDIT_GRANT_REASONS = ['CREDIT_PURCHASE', 'SUBSCRIPTION_CREDITS', 'TRIAL_BONUS'] as const;
export type CreditGrantReason = (typeof CREDIT_GRANT_REASONS)[number];
export const CREDIT_RESERVE_REASONS = ['CLAIM_RESERVE'] as const;
export type CreditReserveReason = (typeof CREDIT_RESERVE_REASONS)[number];
// decontarea unui RESERVE (exact un REFUND sau un CONSUME per slot, IMPACT credite pct. 2)
export const CREDIT_SETTLEMENT_REASONS = [
  'CLAIM_AUTO_CANCEL_UNASSIGNED',
  'SLA_BREACH',
  'WITHDRAWAL_CLIENT_UNRESPONSIVE_48H',
  'WITHDRAWAL_REQUEST_MODIFIED_POST_CLAIM',
  'WITHDRAWAL_VOLUNTARY_GRACE',
  'WITHDRAWAL_VOLUNTARY_LATE',
  'WITHDRAWAL_ADMIN_APPROVED',
  'OFFER_LOST',
  'REQUEST_ACCEPTED_OTHER_OFFER',
  'COMPLETED',
  'REQUEST_DELETED_BY_CLIENT',
  'PROJECT_CANCELLED_REFUND',
  'PROJECT_CANCELLED_CONSUME',
  'OFFER_EXPIRED_UNDECIDED_REFUND',
  'OFFER_EXPIRED_UNDECIDED_CONSUME',
] as const;
export type CreditSettlementReason = (typeof CREDIT_SETTLEMENT_REASONS)[number];
export const CREDIT_REASONS = [
  ...CREDIT_GRANT_REASONS,
  ...CREDIT_RESERVE_REASONS,
  ...CREDIT_SETTLEMENT_REASONS,
] as const;
export type CreditReason = (typeof CREDIT_REASONS)[number];

// docs/04 §5.2 request_company_exclusions — motiv excludere de la re-claim (4.11).
export const REQUEST_EXCLUSION_REASONS = ['SLA_BREACH'] as const;

// Status oferta (Sprint 6; nedefinit verbatim in docs/04, confirmat in sesiune).
// SUPERSEDED = inlocuita de o versiune mai noua sau de oferta acceptata a altei firme.
export const QUOTE_STATUSES = ['DRAFT', 'SENT', 'WITHDRAWN', 'EXPIRED', 'ACCEPTED', 'SUPERSEDED'] as const;

// Status cerere de modificare a clientului (4.13). FULFILLED = firma a raspuns cu versiune
// noua; REJECTED = firma a refuzat (nu consuma slot; clientul nu poate cere aceeasi modificare).
export const QUOTE_CHANGE_REQUEST_STATUSES = ['PENDING', 'FULFILLED', 'REJECTED'] as const;
