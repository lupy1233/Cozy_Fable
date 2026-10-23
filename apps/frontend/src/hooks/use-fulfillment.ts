'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminDisputeItemDto,
  CreateReviewInput,
  OpenProjectCaseInput,
  ProjectCaseDto,
  ResolveDisputeInput,
  RespondProjectCaseInput,
  ReviewDto,
} from '@marketplace/shared';
import { api } from '@/lib/api';

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['quotes'] });
  qc.invalidateQueries({ queryKey: ['request'] });
  qc.invalidateQueries({ queryKey: ['requests'] });
  qc.invalidateQueries({ queryKey: ['fulfillment'] });
}

// --- E-admin-platform-3: proiect acceptat blocat (raport / raspuns) ---
// Clientul citeste ultimul caz; firma il primeste in contextul claim-ului (useClaimContext).
export function useProjectCase(requestId: string, enabled = true) {
  return useQuery({
    queryKey: ['fulfillment', 'project-case', requestId],
    // fara caz → body gol (api() poate rezolva undefined) → normalizam la null
    queryFn: async () => (await api<ProjectCaseDto | null>(`/requests/${requestId}/project-case`)) ?? null,
    enabled: !!requestId && enabled,
    retry: false,
  });
}

export type ProjectCaseSide = 'client' | 'company';

function projectCaseBase(side: ProjectCaseSide, requestId: string): string {
  return side === 'client' ? `/requests/${requestId}/project-case` : `/company/requests/${requestId}/project-case`;
}

export function useOpenProjectCase(requestId: string, side: ProjectCaseSide) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OpenProjectCaseInput) =>
      api<ProjectCaseDto>(projectCaseBase(side, requestId), { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidate(qc),
  });
}

export function useRespondProjectCase(requestId: string, side: ProjectCaseSide) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RespondProjectCaseInput) =>
      api<ProjectCaseDto>(`${projectCaseBase(side, requestId)}/respond`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(qc),
  });
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
    // fara review inca → backend raspunde 200 cu body gol, iar api() poate
    // rezolva undefined; normalizam la null (TanStack v5 respinge undefined).
    // (Recuperat din worktree-ul stale la curatenia L2 — audit A11: regresie.)
    queryFn: async () => (await api<ReviewDto | null>(`/requests/${requestId}/review`)) ?? null,
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
