'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminBillingOrderItemDto,
  BillingOrderDto,
  CreditPackageDto,
} from '@marketplace/shared';
import { api } from '@/lib/api';

const idem = () => ({ 'Idempotency-Key': crypto.randomUUID() });

export function useCreditPackages() {
  return useQuery({
    queryKey: ['billing', 'packages'],
    queryFn: () => api<CreditPackageDto[]>('/billing/credit-packages'),
    retry: false,
  });
}

export function useBillingOrders() {
  return useQuery({
    queryKey: ['billing', 'orders'],
    queryFn: () => api<BillingOrderDto[]>('/billing/orders'),
    retry: false,
  });
}

export function usePurchaseCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (creditPackageId: string) =>
      api<BillingOrderDto>('/billing/credits/purchase', {
        method: 'POST',
        headers: idem(),
        body: JSON.stringify({ creditPackageId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing', 'orders'] }),
  });
}

// --- admin ---
export function useAdminPendingPayments() {
  return useQuery({
    queryKey: ['admin', 'payments'],
    queryFn: () => api<AdminBillingOrderItemDto[]>('/admin/payments'),
    retry: false,
  });
}

export function useConfirmPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      api<BillingOrderDto>(`/admin/payments/${orderId}/confirm`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'payments'] }),
  });
}
