import { z } from 'zod';
import { BILLING_ORDER_STATUSES, BILLING_ORDER_TYPES } from './enums';

// Sprint 8 — achizitie credite/abonament + plata mock + facturare RO (4.16/4.17/3.7).

export const purchaseCreditsSchema = z.object({
  creditPackageId: z.string().uuid(),
});
export type PurchaseCreditsInput = z.infer<typeof purchaseCreditsSchema>;

export const purchaseSubscriptionSchema = z.object({
  planId: z.string().uuid(),
});
export type PurchaseSubscriptionInput = z.infer<typeof purchaseSubscriptionSchema>;

// 3.7 — webhook plata: HMAC-SHA256 in header + payload semnat.
export const paymentWebhookSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['CONFIRMED', 'CANCELLED']),
});
export type PaymentWebhookInput = z.infer<typeof paymentWebhookSchema>;

export interface CreditPackageDto {
  id: string;
  credits: number;
  priceRon: number;
}

export interface AdminBillingOrderItemDto {
  id: string;
  companyName: string;
  orderType: (typeof BILLING_ORDER_TYPES)[number];
  credits: number | null;
  totalRon: number;
  createdAt: string;
}

export interface BillingOrderDto {
  id: string;
  orderType: (typeof BILLING_ORDER_TYPES)[number];
  status: (typeof BILLING_ORDER_STATUSES)[number];
  credits: number | null;
  baseAmountRon: number;
  vatRate: number;
  vatAmountRon: number;
  totalRon: number;
  invoiceSeries: string | null;
  invoiceNumber: number | null;
  invoiceLabel: string | null; // SERIE-NUMAR daca emisa
  createdAt: string;
  confirmedAt: string | null;
}
