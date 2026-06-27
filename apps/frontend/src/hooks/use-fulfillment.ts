'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminDisputeItemDto, CreateReviewInput, ResolveDisputeInput, ReviewDto } from '@marketplace/shared';
import { api } from '@/lib/api';

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['quotes'] });
  qc.invalidateQueries({ queryKey: ['request'] });
  qc.invalidateQueries({ queryKey: ['fulfillment'] });
}

// firma castigatoare marcheaza livrarea
export function useMarkDelivered() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      api<{ status: string }>(`/company/requests/${requestId}/deliver`, { method: 'POST' }),
    onSuccess: () => invalidate(qc),
  });
}

// client confirma livrarea → COMPLETED
export function useConfirmDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      api<{ status: string }>(`/requests/${requestId}/confirm-delivery`, { method: 'POST' }),
    onSuccess: () => invalidate(qc),
  });
}

export function useReview(requestId: string) {
  return useQuery({
    queryKey: ['fulfillment', 'review', requestId],
    queryFn: () => api<ReviewDto | null>(`/requests/${requestId}/review`),
    enabled: !!requestId,
    retry: false,
  });
}

export function useCreateReview(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReviewInput) =>
      api<ReviewDto>(`/requests/${requestId}/review`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidate(qc),
  });
}

// --- admin disputes ---
export function useAdminDisputes() {
  return useQuery({
    queryKey: ['admin', 'disputes'],
    queryFn: () => api<AdminDisputeItemDto[]>('/admin/disputes'),
    retry: false,
  });
}

export function useResolveDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string } & ResolveDisputeInput) =>
      api<{ id: string; status: string }>(`/admin/disputes/${input.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ status: input.status, resolutionNote: input.resolutionNote }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'disputes'] }),
  });
}
