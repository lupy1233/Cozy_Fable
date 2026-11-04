'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminBillingOrderItemDto,
  AdminSubscriptionItemDto,
  BillingOrderDto,
  BillingReadinessDto,
  CreditPackageDto,
  EntitlementsDto,
  GrantSubscriptionInput,
  PaymentInstructionsDto,
  PurchaseResultDto,
  SellerDetailsDto,
  SubscriptionPlanDto,
  UpdateEInvoiceInput,
} from '@marketplace/shared';
import { api } from '@/lib/api';
import { useIdempotentApi } from './use-idempotent-api';

export const BILLING_ORDERS_KEY = ['billing', 'orders'] as const;

export function useCreditPackages() {
  return useQuery({
    queryKey: ['billing', 'packages'],
    queryFn: () => api<CreditPackageDto[]>('/billing/credit-packages'),
    retry: false,
  });
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => api<SubscriptionPlanDto[]>('/billing/plans'),
    retry: false,
  });
}

// E-admin-platform-58: ce ii da firmei planul activ (functii). Endpointul raspunde mereu cu
// body, dar normalizam totusi la null (gotcha api() body gol → undefined in TanStack v5).
export const ENTITLEMENTS_KEY = ['billing', 'entitlements'] as const;
export function useEntitlements(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ENTITLEMENTS_KEY,
    queryFn: () => api<EntitlementsDto | null>('/billing/entitlements').then((e) => e ?? null),
    retry: false,
  });
}

// Instructiuni transfer bancar — doar cand Stripe e dezactivat (altfel bankTransfer = null).
// `enabled=false` pentru angajati: endpoint-ul cere OWNER/MANAGER (CompanyManagerGuard).
export function usePaymentInstructions(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['billing', 'payment-instructions'],
    queryFn: () => api<PaymentInstructionsDto>('/billing/payment-instructions'),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useBillingOrders(enabled = true) {
  return useQuery({
    enabled,
    queryKey: BILLING_ORDERS_KEY,
    queryFn: () => api<BillingOrderDto[]>('/billing/orders'),
    retry: false,
  });
}

// POST critic (3.2) — raspuns { order, checkoutUrl }; checkoutUrl null = transfer bancar.
export function usePurchaseCredits() {
  const qc = useQueryClient();
  const request = useIdempotentApi();
  return useMutation({
    mutationFn: (creditPackageId: string) =>
      request<PurchaseResultDto>('/billing/credits/purchase', {
        method: 'POST',
        body: JSON.stringify({ creditPackageId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BILLING_ORDERS_KEY }),
  });
}

export function usePurchaseSubscription() {
  const qc = useQueryClient();
  const request = useIdempotentApi();
  return useMutation({
    mutationFn: (planId: string) =>
      request<PurchaseResultDto>('/billing/subscription/purchase', {
        method: 'POST',
        body: JSON.stringify({ planId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BILLING_ORDERS_KEY }),
  });
}

// "Continua plata" — sesiune Checkout noua pentru o comanda PENDING.
export function useOrderCheckout() {
  const qc = useQueryClient();
  const request = useIdempotentApi();
  return useMutation({
    mutationFn: (orderId: string) =>
      request<PurchaseResultDto>(`/billing/orders/${orderId}/checkout`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BILLING_ORDERS_KEY }),
  });
}

// E-company-24: "Am platit" (transfer bancar) — marcaj idempotent pe server, anunta adminii.
export function useMarkOrderPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      api<BillingOrderDto>(`/billing/orders/${orderId}/mark-paid`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing'] }),
  });
}

// --- admin ---
export function useAdminPayments(status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED') {
  return useQuery({
    queryKey: ['admin', 'payments', status ?? 'all'],
    queryFn: () =>
      api<AdminBillingOrderItemDto[]>(`/admin/payments${status ? `?status=${status}` : ''}`),
    retry: false,
  });
}

export function useConfirmPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      api<BillingOrderDto>(`/admin/payments/${orderId}/confirm`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'payments'] });
      qc.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
      qc.invalidateQueries({ queryKey: ['admin', 'billing'] });
    },
  });
}

export function useCancelPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      api<BillingOrderDto>(`/admin/payments/${orderId}/cancel`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'payments'] }),
  });
}

// E-admin-platform-4 — date fiscale platforma + stare facturare + e-Factura (ruta manuala).
export function useBillingReadiness() {
  return useQuery({
    queryKey: ['admin', 'billing', 'readiness'],
    queryFn: () => api<BillingReadinessDto>('/admin/billing/readiness'),
    retry: false,
    staleTime: 60_000,
  });
}

export function useSellerDetails() {
  return useQuery({
    queryKey: ['admin', 'billing', 'seller'],
    queryFn: () => api<SellerDetailsDto>('/admin/billing/seller'),
    retry: false,
  });
}

export function useUpdateSellerDetails() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SellerDetailsDto) =>
      api<BillingReadinessDto>('/admin/billing/seller', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'billing'] });
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
  });
}

export function useUpdateEInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, ...input }: UpdateEInvoiceInput & { orderId: string }) =>
      api<AdminBillingOrderItemDto>(`/admin/payments/${orderId}/e-invoice`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'payments'] });
      qc.invalidateQueries({ queryKey: ['admin', 'billing'] });
    },
  });
}

export function useAdminSubscriptions(companyId?: string) {
  return useQuery({
    queryKey: ['admin', 'subscriptions', companyId ?? 'all'],
    queryFn: () =>
      api<AdminSubscriptionItemDto[]>(
        `/admin/subscriptions${companyId ? `?companyId=${companyId}` : ''}`,
      ),
    retry: false,
  });
}

export function useGrantSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GrantSubscriptionInput) =>
      api<AdminSubscriptionItemDto>('/admin/subscriptions/grant', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'subscriptions'] }),
  });
}
