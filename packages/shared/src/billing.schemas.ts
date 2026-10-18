import { z } from 'zod';
import {
  BILLING_ORDER_STATUSES,
  BILLING_ORDER_TYPES,
  SUBSCRIPTION_STATUSES,
  type EInvoiceStatus,
} from './enums';
import type { SellerField, SellerProblemReason } from './fiscal';
import type { PlanCode, PlanFeaturesDto } from './plan-features';

// Sprint 8 — achizitie credite/abonament + facturare RO (4.16/4.17/3.7).
// Sprint L0-D (2026-08-19) — plata reala prin Stripe Checkout; calea "confirmare admin"
// ramane fallback pentru transfer bancar.

export const purchaseCreditsSchema = z.object({
  creditPackageId: z.string().uuid(),
});
export type PurchaseCreditsInput = z.infer<typeof purchaseCreditsSchema>;

export const purchaseSubscriptionSchema = z.object({
  planId: z.string().uuid(),
});
export type PurchaseSubscriptionInput = z.infer<typeof purchaseSubscriptionSchema>;

// 3.7 — webhook plata mock (istoric): HMAC-SHA256 in header + payload semnat.
// Sursa confirmarii unei comenzi: admin (transfer bancar), webhook (mock istoric), stripe.
export const PAYMENT_SOURCES = ['admin', 'webhook', 'stripe'] as const;
export type PaymentSource = (typeof PAYMENT_SOURCES)[number];

// E-admin-platform-58: vatRate/vatRon/totalRon calculate in backend (Decimal half-up, aceeasi
// formula ca la comanda) — frontendul nu mai recalculeaza TVA-ul.
export interface CreditPackageDto {
  id: string;
  credits: number;
  priceRon: number; // fara TVA
  vatRate: number; // % (setarea vat_rate la momentul citirii)
  vatRon: number;
  totalRon: number;
}

// Planuri de abonament vizibile firmei (GET /billing/plans) — doar cele active.
// E-admin-platform-58: `tier` poarta codul planului (PlanCode); pentru SILVER/GOLD/PLATINUM
// valoarea e identica cu vechiul enum.
export interface SubscriptionPlanDto {
  id: string;
  tier: PlanCode;
  nameRo: string | null;
  nameEn: string | null;
  priceRon: number; // fara TVA
  isFree: boolean; // priceRon = 0 → nu se cumpara online (doar grant admin / trial_plan)
  vatRate: number;
  vatRon: number;
  totalRon: number;
  includedCredits: number;
  gatingDelayMinutes: number;
  features: PlanFeaturesDto;
}

// GET /billing/entitlements (E-admin-platform-58) — ce ii da firmei abonamentul activ.
// Fara abonament activ: planId/planCode null si toate functiile dezactivate.
export interface EntitlementsDto {
  planId: string | null;
  planCode: PlanCode | null;
  nameRo: string | null;
  nameEn: string | null;
  isFree: boolean;
  isTrial: boolean;
  expiresAt: string | null;
  gatingDelayMinutes: number | null;
  features: PlanFeaturesDto;
}

// GET /billing/subscription — abonamentul activ + cate zile mai are.
export interface SubscriptionDetailDto {
  id: string;
  planId: string;
  tier: PlanCode;
  status: (typeof SUBSCRIPTION_STATUSES)[number];
  isTrial: boolean;
  startedAt: string;
  expiresAt: string;
  daysLeft: number; // ceil; 0 cand expira azi
  gatingDelayMinutes: number;
}

// Instructiuni de plata (doar cand Stripe e dezactivat): transfer bancar catre platforma,
// referinta = numarul comenzii. E-admin-platform-4: bankTransfer = null cat timp datele
// fiscale ale platformei nu sunt complete (billingReady false).
export interface PaymentInstructionsDto {
  stripeEnabled: boolean;
  stripeMode: 'live' | 'test' | null;
  billingReady: boolean;
  vatRate: number; // % — pentru afisarea "pret + TVA = total" inainte de comanda
  bankTransfer: {
    sellerName: string;
    cui: string;
    iban: string;
  } | null;
}

export interface AdminBillingOrderItemDto {
  id: string;
  companyId: string;
  companyName: string;
  orderType: (typeof BILLING_ORDER_TYPES)[number];
  status: (typeof BILLING_ORDER_STATUSES)[number];
  credits: number | null;
  planTier: PlanCode | null;
  baseAmountRon: number;
  vatRate: number;
  vatAmountRon: number;
  totalRon: number;
  paymentSource: string | null;
  hasStripeSession: boolean;
  invoiceLabel: string | null;
  createdAt: string;
  confirmedAt: string | null;
  testMode: boolean;
  eInvoiceStatus: EInvoiceStatus | null;
  anafUploadId: string | null;
  anafDownloadId: string | null;
  eInvoiceUpdatedAt: string | null;
  // E-company-24: firma a apasat "Am platit" (transfer bancar); undefined in chitantele vechi
  paymentClaimedAt: string | null;
}

export interface BillingOrderDto {
  id: string;
  orderType: (typeof BILLING_ORDER_TYPES)[number];
  status: (typeof BILLING_ORDER_STATUSES)[number];
  planTier: PlanCode | null;
  credits: number | null;
  baseAmountRon: number;
  vatRate: number;
  vatAmountRon: number;
  totalRon: number;
  invoiceSeries: string | null;
  invoiceNumber: number | null;
  invoiceLabel: string | null; // SERIE-NUMAR daca emisa
  paymentSource: string | null;
  hasStripeSession: boolean; // exista o sesiune Checkout (poate fi expirata)
  createdAt: string;
  confirmedAt: string | null;
  testMode: boolean; // comanda Stripe in mod test — fara numar fiscal
  // E-company-24 (transfer bancar): "Am platit" apasat + termenul anularii automate (null = oprita).
  // Chitantele de idempotenta vechi nu au campurile — FE trateaza undefined ca null.
  paymentClaimedAt: string | null;
  transferExpiresAt: string | null;
}

// Raspunsul la purchase / checkout: comanda + URL-ul Stripe Checkout (null = Stripe dezactivat,
// firma plateste prin transfer bancar si adminul confirma).
export interface PurchaseResultDto {
  order: BillingOrderDto;
  checkoutUrl: string | null;
}

// Admin: acordare/prelungire abonament fara plata (vanzare asistata, compensatii).
export const grantSubscriptionSchema = z.object({
  companyId: z.string().uuid(),
  planId: z.string().uuid(),
  days: z.number().int().min(1).max(366).default(30),
  includeCredits: z.boolean().default(false),
  note: z.string().trim().max(500).optional(),
});
export type GrantSubscriptionInput = z.infer<typeof grantSubscriptionSchema>;

// E-admin-platform-4 — datele furnizorului (platforma) de pe facturi, editate din Admin.
export interface SellerDetailsDto {
  name: string;
  cui: string;
  regCom: string;
  address: string;
  iban: string;
}

export interface BillingReadinessDto {
  ready: boolean;
  problems: { field: SellerField; reason: SellerProblemReason }[];
  stripeMode: 'live' | 'test' | null;
  eInvoicePendingCount: number;
}

// Ruta manuala e-Factura: adminul/contabilul inregistreaza ce a facut in SPV.
export const updateEInvoiceSchema = z
  .object({
    status: z.enum(['PENDING', 'UPLOADED', 'VALIDATED', 'REJECTED']),
    anafUploadId: z.string().trim().regex(/^\d{1,20}$/).optional(),
    anafDownloadId: z.string().trim().regex(/^\d{1,20}$/).optional(),
  })
  .refine((v) => (v.status !== 'UPLOADED' && v.status !== 'VALIDATED') || !!v.anafUploadId, 'anafUploadId required');
export type UpdateEInvoiceInput = z.infer<typeof updateEInvoiceSchema>;

export interface AdminSubscriptionItemDto {
  id: string;
  companyId: string;
  companyName: string;
  planId: string;
  tier: PlanCode;
  status: (typeof SUBSCRIPTION_STATUSES)[number];
  isTrial: boolean;
  startedAt: string;
  expiresAt: string;
  daysLeft: number;
  isCurrent: boolean; // ACTIVE si neexpirat
}
