'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminWithdrawalItemDto,
  AnswerClarificationInput,
  ClaimWithdrawalDto,
  ClarificationRequestDto,
  RequestClarificationInput,
  RequestWithdrawalInput,
  ReviewWithdrawalInput,
} from '@marketplace/shared';
import { api } from '@/lib/api';

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['lifecycle'] });
  qc.invalidateQueries({ queryKey: ['quotes'] });
  qc.invalidateQueries({ queryKey: ['claims'] });
  qc.invalidateQueries({ queryKey: ['penalties'] });
}

// --- clarificari ---
export function useClaimClarifications(claimSlotId: string) {
  return useQuery({
    queryKey: ['lifecycle', 'clarifications', 'claim', claimSlotId],
    queryFn: () => api<ClarificationRequestDto[]>(`/claims/${claimSlotId}/clarifications`),
    enabled: !!claimSlotId,
    retry: false,
  });
}

export function useClientClarifications(requestId: string) {
  return useQuery({
    queryKey: ['lifecycle', 'clarifications', 'request', requestId],
    queryFn: () => api<ClarificationRequestDto[]>(`/client/clarifications/request/${requestId}`),
    enabled: !!requestId,
    retry: false,
  });
}

export function useRequestClarification(claimSlotId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestClarificationInput) =>
      api<ClarificationRequestDto>(`/claims/${claimSlotId}/clarifications`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useAnswerClarification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string } & AnswerClarificationInput) =>
      api<ClarificationRequestDto>(`/client/clarifications/${input.id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ answerText: input.answerText }),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

// --- retrageri (firma) ---
export function useClaimWithdrawals(claimSlotId: string) {
  return useQuery({
    queryKey: ['lifecycle', 'withdrawals', claimSlotId],
    queryFn: () => api<ClaimWithdrawalDto[]>(`/claims/${claimSlotId}/withdrawals`),
    enabled: !!claimSlotId,
    retry: false,
  });
}

export function useWithdrawClaim(claimSlotId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestWithdrawalInput) =>
      api<ClaimWithdrawalDto>(`/claims/${claimSlotId}/withdraw`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

// --- admin ---
export function useAdminWithdrawals() {
  return useQuery({
    queryKey: ['admin', 'withdrawals'],
    queryFn: () => api<AdminWithdrawalItemDto[]>('/admin/withdrawals'),
    retry: false,
  });
}

export function useReviewWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string } & ReviewWithdrawalInput) =>
      api<ClaimWithdrawalDto>(`/admin/withdrawals/${input.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ approve: input.approve, adminNote: input.adminNote }),
      }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
      void v;
    },
  });
}
