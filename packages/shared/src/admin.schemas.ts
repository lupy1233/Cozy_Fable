import { z } from 'zod';
import type {
  ContactDetectionAction,
  ContactDetectionField,
  ContactDetectionTrigger,
  ContactMatchKind,
} from './contact-detection';
import type { RequestStatus } from './enums';
import { PLAN_CODE_RE, type PlanCode, type PlanFeaturesDto } from './plan-features';

// Sprint 9 — consola admin (4.19): KPI, audit viewer, settings, jobs.

export interface AdminKpiDto {
  companiesByStatus: Record<string, number>;
  requestsByStatus: Record<string, number>;
  activeClaims: number;
  openDisputes: number;
  pendingPayments: number;
  activeSubscriptions: number;
  // E-admin-platform-58: abonamente active (activeSubscriptionWhere) pe codul planului
  activeSubscriptionsByPlan: { code: PlanCode; count: number }[];
  totalCreditsBalance: number;
  totalCreditsReserved: number;
  revenueRon: number; // suma totalurilor comenzilor CONFIRMED
  auditEntries: number;
}

export interface AuditLogDto {
  id: string;
  userId: string | null;
  role: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export interface AuditLogPageDto {
  items: AuditLogDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SettingDto {
  key: string;
  value: string;
}

export interface PenaltyRuleDto {
  id: string;
  ruleKey: string;
  points: number;
  isActive: boolean;
}

export interface JobDto {
  id: string;
  queue: string;
  name: string;
  failedReason: string | null;
  attemptsMade: number;
  timestamp: string | null;
}

// --- inputs (Zod) ---
export const updatePenaltyRuleSchema = z.object({
  points: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePenaltyRuleInput = z.infer<typeof updatePenaltyRuleSchema>;

export const upsertCreditPackageSchema = z.object({
  credits: z.number().int().positive().max(100000),
  priceRon: z.number().int().positive().max(10000000),
  isActive: z.boolean().optional(),
});
export type UpsertCreditPackageInput = z.infer<typeof upsertCreditPackageSchema>;

// E-admin-platform-58 — planuri ca date. Pretul 0 e permis (plan gratuit: nu se cumpara online,
// se acorda de admin sau prin trial_plan). `code` e identitatea planului si nu se mai schimba.
export interface AdminPlanDto {
  id: string;
  code: PlanCode;
  tier: PlanCode; // = code (compatibilitate FE vechi)
  nameRo: string | null;
  nameEn: string | null;
  priceRon: number;
  includedCredits: number;
  marketplaceGatingDelayMin: number;
  isActive: boolean;
  isFree: boolean;
  features: PlanFeaturesDto;
}

export interface AdminCreditPackageDto {
  id: string;
  credits: number;
  priceRon: number;
  isActive: boolean;
}

export interface AdminThresholdDto {
  id: string;
  size: string;
  minScore: number;
  maxScore: number | null;
}

const planNameSchema = z.string().trim().max(60);

export const createPlanSchema = z.object({
  code: z.string().regex(PLAN_CODE_RE),
  nameRo: planNameSchema.optional(),
  nameEn: planNameSchema.optional(),
  priceRon: z.number().int().min(0).max(10_000_000),
  includedCredits: z.number().int().min(0).max(100000),
  marketplaceGatingDelayMin: z.number().int().min(0).max(2_147_483_647),
  isActive: z.boolean().optional(),
  // obligatoriu: accesul la marketplace e o alegere explicita la crearea planului
  features: z.object({
    MARKETPLACE_ACCESS: z.object({ enabled: z.boolean() }),
  }),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

const planFeatureInputSchema = z.object({
  enabled: z.boolean(),
  limit: z.number().int().min(0).max(2_147_483_647).nullable().optional(),
});

export const updatePlanSchema = z.object({
  priceRon: z.number().int().min(0).max(10_000_000).optional(),
  includedCredits: z.number().int().min(0).max(2_147_483_647).optional(),
  marketplaceGatingDelayMin: z.number().int().min(0).max(2_147_483_647).optional(),
  isActive: z.boolean().optional(),
  nameRo: planNameSchema.nullable().optional(),
  nameEn: planNameSchema.nullable().optional(),
  features: z
    .object({
      MARKETPLACE_ACCESS: planFeatureInputSchema.optional(),
    })
    .optional(),
});
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const updateThresholdSchema = z.object({
  minScore: z.number().int().min(0).optional(),
  maxScore: z.number().int().min(0).nullable().optional(),
});
export type UpdateThresholdInput = z.infer<typeof updateThresholdSchema>;

// Pasul 6 (audit 2026-08-23, D-L1-2): management utilizatori in consola admin.
export interface AdminUserItemDto {
  id: string;
  email: string;
  name: string;
  role: 'CLIENT' | 'COMPANY_USER' | 'ADMIN';
  companyName: string | null;
  emailVerified: boolean;
  blockedAt: string | null;
  createdAt: string;
}

// POST /admin/mail/test — trimis doar catre adresa adminului care apasa butonul.
export interface AdminMailTestResultDto {
  ok: boolean;
  to: string;
  from: string;
  replyTo: string | null;
  error: string | null;
}

// E-admin-platform-25 - calendarul de lucru (sarbatori mobile + punti admin). Sarbatorile
// fixe vin automat din date-holidays; tabelul tine doar mobilele si override-urile.
export interface CalendarHolidayDto {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  isWorkingDay: boolean;
  createdAt: string;
}

export interface CalendarCoverageDto {
  year: number;
  expected: string[];
  missing: string[];
}

export interface AdminCalendarDto {
  year: number;
  holidays: CalendarHolidayDto[];
  fixedHolidays: { date: string; name: string }[];
  coverage: CalendarCoverageDto[];
}

export interface CalendarCheckDto {
  from: string;
  workingDays: number;
  deadlineDate: string;
  deadlineAt: string;
}

export const createCalendarHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(2).max(120),
  isWorkingDay: z.boolean(),
});
export type CreateCalendarHolidayInput = z.infer<typeof createCalendarHolidaySchema>;

export const updateCalendarHolidaySchema = createCalendarHolidaySchema
  .pick({ name: true, isWorkingDay: true })
  .partial();
export type UpdateCalendarHolidayInput = z.infer<typeof updateCalendarHolidaySchema>;

// E-admin-platform-25 - punctele optiunilor din chestionar (project_sizing_config).
// Doar randurile existente se editeaza; valorile 0..100.
export interface SizingWeightDto {
  id: string;
  key: string;
  option: string;
  weight: number;
}

export const sizingWeightChangesSchema = z.object({
  changes: z
    .array(z.object({ id: z.string().uuid(), weight: z.number().int().min(0).max(100) }))
    .min(1)
    .max(200),
});
export type SizingWeightChangesInput = z.infer<typeof sizingWeightChangesSchema>;

export type SizingSizeCounts = Record<'SMALL' | 'MEDIUM' | 'LARGE', number>;

export interface SizingPreviewExampleDto {
  requestId: string;
  currentSize: 'SMALL' | 'MEDIUM' | 'LARGE';
  proposedSize: 'SMALL' | 'MEDIUM' | 'LARGE';
  currentCreditCost: number;
  proposedCreditCost: number;
}

export interface SizingPreviewDto {
  sampleSize: number;
  skipped: number;
  current: SizingSizeCounts;
  proposed: SizingSizeCounts;
  changedSize: number;
  changedCreditCost: number;
  avgCreditCostCurrent: number;
  avgCreditCostProposed: number;
  examples: SizingPreviewExampleDto[]; // max 20, doar cererile care se schimba
}

export interface SizingWeightsUpdateResultDto {
  count: number;
  items: { id: string; weight: number; previousWeight: number | null }[];
}

// E-admin-platform-45 — date de contact detectate in texte libere (log read-only).
// excerpt e deja partial ascuns; adminul vede titlul real al cererii.
export interface AdminContactDetectionDto {
  id: string;
  requestId: string;
  requestTitle: string;
  requestStatus: RequestStatus;
  requestDeleted: boolean;
  trigger: ContactDetectionTrigger;
  field: ContactDetectionField;
  roomType: string | null;
  stepId: string | null;
  kinds: ContactMatchKind[];
  excerpt: string;
  action: ContactDetectionAction;
  createdAt: string;
}

export interface AdminContactDetectionPageDto {
  items: AdminContactDetectionDto[];
  total: number;
  page: number;
  pageSize: number;
}
