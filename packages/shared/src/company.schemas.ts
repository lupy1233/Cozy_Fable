import { z } from 'zod';
import { COMPANY_MEMBER_ROLES, OFFER_FIELD_KEYS } from './enums';

// Scheme Zod companii — frontend (RHF) + reutilizabile in DTO.
// Mesajele de eroare sunt chei i18n (mapate in frontend), nu text.

// CUI RO: optional prefix RO + 2..10 cifre. Validare lejera (MVP).
const cuiSchema = z
  .string()
  .trim()
  .regex(/^(RO)?\d{2,10}$/i, 'invalidCui');

// J Reg. Com.: format Jdd/dddd/yyyy (ex. J40/1234/2020). Lejer pentru MVP.
const regComSchema = z
  .string()
  .trim()
  .regex(/^J\d{1,2}\/\d{1,7}\/\d{4}$/i, 'invalidRegCom');

const latSchema = z.number().min(-90).max(90);
const lngSchema = z.number().min(-180).max(180);

export const companyOnboardingSchema = z.object({
  name: z.string().trim().min(2, 'nameTooShort').max(200),
  cui: cuiSchema,
  regComNumber: regComSchema,
  addressText: z.string().trim().min(3, 'addressTooShort').max(300),
  county: z.string().trim().min(2, 'countyTooShort').max(100),
  city: z.string().trim().min(2, 'cityTooShort').max(100),
  lat: latSchema,
  lng: lngSchema,
});
export type CompanyOnboardingInput = z.infer<typeof companyOnboardingSchema>;

export const companyProfileUpdateSchema = companyOnboardingSchema.partial().extend({
  // CUI si Reg.Com. nu se schimba post-onboarding in MVP
  cui: z.undefined().optional(),
  regComNumber: z.undefined().optional(),
});
export type CompanyProfileUpdateInput = z.infer<typeof companyProfileUpdateSchema>;

export const companyLocationSchema = z.object({
  addressText: z.string().trim().min(3, 'addressTooShort').max(300),
  county: z.string().trim().min(2, 'countyTooShort').max(100),
  city: z.string().trim().min(2, 'cityTooShort').max(100),
  lat: latSchema,
  lng: lngSchema,
  coverageRadiusKm: z.number().positive().max(1000),
});
export type CompanyLocationInput = z.infer<typeof companyLocationSchema>;

export const companyMemberInviteSchema = z.object({
  email: z.string().email('invalidEmail').max(254),
  role: z.enum(['MANAGER', 'EMPLOYEE_TRUSTED', 'EMPLOYEE_MANAGED']),
});
export type CompanyMemberInviteInput = z.infer<typeof companyMemberInviteSchema>;

export const companyMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'MANAGER', 'EMPLOYEE_TRUSTED', 'EMPLOYEE_MANAGED']),
});
export type CompanyMemberRoleInput = z.infer<typeof companyMemberRoleSchema>;

export const portfolioItemSchema = z.object({
  title: z.string().trim().min(2, 'titleTooShort').max(150),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  imageUrl: z.string().url('invalidUrl').max(2000).optional().or(z.literal('')),
});
export type PortfolioItemInput = z.infer<typeof portfolioItemSchema>;

export const offerFieldPermissionEntrySchema = z.object({
  role: z.enum(COMPANY_MEMBER_ROLES),
  fieldKey: z.enum(OFFER_FIELD_KEYS),
  canEdit: z.boolean(),
});
export const offerFieldPermissionsUpdateSchema = z.object({
  permissions: z.array(offerFieldPermissionEntrySchema).max(40),
});
export type OfferFieldPermissionEntry = z.infer<typeof offerFieldPermissionEntrySchema>;
export type OfferFieldPermissionsUpdateInput = z.infer<typeof offerFieldPermissionsUpdateSchema>;

export const companyRejectSchema = z.object({
  reason: z.string().trim().min(3, 'reasonTooShort').max(1000),
});
export type CompanyRejectInput = z.infer<typeof companyRejectSchema>;

// DTO-uri de raspuns (server → client)
export interface CompanyMemberDto {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: (typeof COMPANY_MEMBER_ROLES)[number];
  createdAt: string;
}

export interface CompanyLocationDto {
  id: string;
  addressText: string;
  county: string;
  city: string;
  lat: number;
  lng: number;
  coverageRadiusKm: number;
}

export interface PortfolioItemDto {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export interface OfferFieldPermissionDto {
  role: (typeof COMPANY_MEMBER_ROLES)[number];
  fieldKey: (typeof OFFER_FIELD_KEYS)[number];
  canEdit: boolean;
}

export type CompanyRiskFlag = 'NO_PORTFOLIO' | 'INSUFFICIENT_REVIEWS' | 'LOW_RATING';

export interface CompanyDto {
  id: string;
  name: string;
  cui: string;
  regComNumber: string;
  status: 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  addressText: string;
  county: string;
  city: string;
  lat: number;
  lng: number;
  rejectedAt: string | null;
  rejectionReason: string | null;
  suspendedUntil: string | null;
  createdAt: string;
  myRole: (typeof COMPANY_MEMBER_ROLES)[number];
  members: CompanyMemberDto[];
  locations: CompanyLocationDto[];
  portfolio: PortfolioItemDto[];
  offerFieldPermissions: OfferFieldPermissionDto[];
}

export interface AdminCompanyListItemDto {
  id: string;
  name: string;
  cui: string;
  status: CompanyDto['status'];
  city: string;
  county: string;
  createdAt: string;
  riskFlags: CompanyRiskFlag[];
  memberCount: number;
  locationCount: number;
  portfolioCount: number;
}

// Statistici pentru dashboardul firmei (agregate server-side).
export interface CompanyDashboardStatsDto {
  claimsTotal: number;
  claimsActive: number;
  claimsByStatus: Partial<Record<string, number>>;
  // claim-uri active per membru (assignedTo; null = neatribuite, afisate separat)
  perMember: { userId: string | null; name: string | null; activeClaims: number }[];
  // oferte trimise/acceptate + valoarea totala a ultimei versiuni per oferta
  quotesSent: number;
  quotesTotalRon: number;
  wallet: { balance: number; reserved: number; available: number };
  creditsConsumed7d: number;
  creditsConsumed30d: number;
  activePenaltyPoints: number;
}

// Partener afisat public pe landing (/partners): firma APPROVED + portofoliu.
// Ratingul Google vine ulterior (integrare externa) — deocamdata placeholder null.
export interface PartnerDto {
  id: string;
  name: string;
  city: string;
  county: string;
  memberSince: string;
  rating: number | null;
  portfolio: { title: string; imageUrl: string | null }[];
}
