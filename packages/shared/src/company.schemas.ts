import { z } from 'zod';
import { COMPANY_MEMBER_ROLES, OFFER_FIELD_KEYS } from './enums';
import type { CompanyPermission } from './company-permissions';
import type { DashboardActionItemDto } from './dashboard.schemas';

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
  // E-company-19: platitor TVA declarat de firma (OWNER/MANAGER, auditat)
  isVatPayer: z.boolean().optional(),
  // E-company-24: email de facturare optional (proforma + facturi, ex. contabilul); '' sau null = sters
  billingEmail: z
    .union([z.string().trim().toLowerCase().email('billingEmailInvalid').max(254), z.literal('')])
    .nullable()
    .optional(),
});
export type CompanyProfileUpdateInput = z.infer<typeof companyProfileUpdateSchema>;

// E-client-9 (DECIZIE NECESARA PO): raza minima = celula grilei de confidentialitate
// (~2 km) — punctele cererilor sunt aproximate pe grila, o raza mai mica nu inseamna nimic.
export const MIN_COVERAGE_RADIUS_KM = 2;
// Chei system_settings (E-client-9): plafon locatii per firma + schimbari pe 24h (rolling).
export const SETTING_COMPANY_LOCATIONS_MAX = 'company_locations_max';
export const SETTING_COMPANY_LOCATION_CHANGES_PER_DAY = 'company_location_changes_per_day';

export const companyLocationSchema = z.object({
  addressText: z.string().trim().min(3, 'addressTooShort').max(300),
  county: z.string().trim().min(2, 'countyTooShort').max(100),
  city: z.string().trim().min(2, 'cityTooShort').max(100),
  lat: latSchema,
  lng: lngSchema,
  coverageRadiusKm: z.number().min(MIN_COVERAGE_RADIUS_KM, 'radiusTooSmall').max(1000),
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
  // E-company-19: platitor TVA → cod TVA (RO + cifre) pe facturi
  isVatPayer: boolean;
  // E-company-24: doar OWNER/MANAGER; null pentru angajati
  billingEmail: string | null;
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
  // E-admin-platform-58: permisiunile rolului meu (COMPANY_ROLE_PERMISSIONS); FE foloseste can()
  permissions: CompanyPermission[];
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
  // E-admin-platform-44 — "De facut acum" (preluari neatribuite, termene SLA apropiate)
  actions: DashboardActionItemDto[];
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
