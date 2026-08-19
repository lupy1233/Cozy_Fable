'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminBillingOrderItemDto,
  AdminSubscriptionItemDto,
  BillingOrderDto,
  CreditPackageDto,
  GrantSubscriptionInput,
  PaymentInstructionsDto,
  PurchaseResultDto,
  SubscriptionPlanDto,
} from '@marketplace/shared';
import { api } from '@/lib/api';

const idem = () => ({ 'Idempotency-Key': crypto.randomUUID() });

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

// Instructiuni transfer bancar — doar cand Stripe e dezactivat (altfel bankTransfer = null).
export function usePaymentInstructions() {
  return useQuery({
    queryKey: ['billing', 'payment-instructions'],
    queryFn: () => api<PaymentInstructionsDto>('/billing/payment-instructions'),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useBillingOrders() {
  return useQuery({
    queryKey: BILLING_ORDERS_KEY,
    queryFn: () => api<BillingOrderDto[]>('/billing/orders'),
    retry: false,
  });
}

// POST critic (3.2) — raspuns { order, checkoutUrl }; checkoutUrl null = transfer bancar.
export function usePurchaseCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (creditPackageId: string) =>
      api<PurchaseResultDto>('/billing/credits/purchase', {
        method: 'POST',
        headers: idem(),
        body: JSON.stringify({ creditPackageId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BILLING_ORDERS_KEY }),
  });
}

export function usePurchaseSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) =>
      api<PurchaseResultDto>('/billing/subscription/purchase', {
        method: 'POST',
        headers: idem(),
        body: JSON.stringify({ planId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BILLING_ORDERS_KEY }),
  });
}

// "Continua plata" — sesiune Checkout noua pentru o comanda PENDING.
export function useOrderCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      api<PurchaseResultDto>(`/billing/orders/${orderId}/checkout`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BILLING_ORDERS_KEY }),
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
