import { z } from 'zod';

// Sprint 9 — consola admin (4.19): KPI, audit viewer, settings, jobs.

export interface AdminKpiDto {
  companiesByStatus: Record<string, number>;
  requestsByStatus: Record<string, number>;
  activeClaims: number;
  openDisputes: number;
  pendingPayments: number;
  activeSubscriptions: number;
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
export const updateSettingSchema = z.object({ value: z.string().max(500) });
export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;

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

export const updatePlanSchema = z.object({
  priceRon: z.number().int().positive().optional(),
  includedCredits: z.number().int().min(0).optional(),
  marketplaceGatingDelayMin: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const updateThresholdSchema = z.object({
  minScore: z.number().int().min(0).optional(),
  maxScore: z.number().int().min(0).nullable().optional(),
  creditCost: z.number().int().min(0).optional(),
});
export type UpdateThresholdInput = z.infer<typeof updateThresholdSchema>;
