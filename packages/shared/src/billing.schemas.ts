import { z } from 'zod';
import {
  BILLING_ORDER_STATUSES,
  BILLING_ORDER_TYPES,
  SUBSCRIPTION_PLAN_TIERS,
  SUBSCRIPTION_STATUSES,
} from './enums';

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
export const paymentWebhookSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['CONFIRMED', 'CANCELLED']),
});
export type PaymentWebhookInput = z.infer<typeof paymentWebhookSchema>;

// Sursa confirmarii unei comenzi: admin (transfer bancar), webhook (mock istoric), stripe.
export const PAYMENT_SOURCES = ['admin', 'webhook', 'stripe'] as const;
export type PaymentSource = (typeof PAYMENT_SOURCES)[number];

export interface CreditPackageDto {
  id: string;
  credits: number;
  priceRon: number;
}

// Planuri de abonament vizibile firmei (GET /billing/plans) — doar cele active.
export interface SubscriptionPlanDto {
  id: string;
  tier: (typeof SUBSCRIPTION_PLAN_TIERS)[number];
  priceRon: number; // fara TVA
  includedCredits: number;
  gatingDelayMinutes: number;
}

// GET /billing/subscription — abonamentul activ + cate zile mai are.
export interface SubscriptionDetailDto {
  id: string;
  planId: string;
  tier: (typeof SUBSCRIPTION_PLAN_TIERS)[number];
  status: (typeof SUBSCRIPTION_STATUSES)[number];
  isTrial: boolean;
  startedAt: string;
  expiresAt: string;
  daysLeft: number; // ceil; 0 cand expira azi
  gatingDelayMinutes: number;
}

// Instructiuni de plata (doar cand Stripe e dezactivat): transfer bancar catre platforma,
// referinta = numarul comenzii.
export interface PaymentInstructionsDto {
  stripeEnabled: boolean;
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
  planTier: (typeof SUBSCRIPTION_PLAN_TIERS)[number] | null;
  baseAmountRon: number;
  vatRate: number;
  vatAmountRon: number;
  totalRon: number;
  paymentSource: string | null;
  hasStripeSession: boolean;
  invoiceLabel: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export interface BillingOrderDto {
  id: string;
  orderType: (typeof BILLING_ORDER_TYPES)[number];
  status: (typeof BILLING_ORDER_STATUSES)[number];
  planTier: (typeof SUBSCRIPTION_PLAN_TIERS)[number] | null;
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

export interface AdminSubscriptionItemDto {
  id: string;
  companyId: string;
  companyName: string;
  planId: string;
  tier: (typeof SUBSCRIPTION_PLAN_TIERS)[number];
  status: (typeof SUBSCRIPTION_STATUSES)[number];
  isTrial: boolean;
  startedAt: string;
  expiresAt: string;
  daysLeft: number;
  isCurrent: boolean; // ACTIVE si neexpirat
}
