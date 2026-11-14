'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminDisputeItemDto,
  ClientFulfillmentDto,
  CompanyCompletionDto,
  CreateReviewInput,
  ExecutionStage,
  OpenProjectCaseInput,
  OpenWarrantyCaseInput,
  ProjectCaseDto,
  ResolveDisputeInput,
  RespondProjectCaseInput,
  ReviewDto,
  WarrantyWindowDto,
} from '@marketplace/shared';
import { ApiError, api } from '@/lib/api';

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
    // M1 drumul invers: proiectul s-a finalizat intre timp (409) → reincarcam starea, ca pagina
    // sa treaca pe COMPLETED (recenzie + "Raporteaza o problema" in garantie)
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'PROJECT_NOT_CLOSABLE') invalidate(qc);
    },
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

// --- e2-2: raportarea unei probleme dupa finalizare (in garantie) ---
export function useWarrantyWindow(requestId: string, enabled = true) {
  return useQuery({
    queryKey: ['fulfillment', 'warranty', requestId],
    // proiect nefinalizat → body gol / null
    queryFn: async () => (await api<WarrantyWindowDto | null>(`/requests/${requestId}/project-case/warranty`)) ?? null,
    enabled: !!requestId && enabled,
    retry: false,
  });
}

export function useOpenWarrantyCase(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OpenWarrantyCaseInput) =>
      api<ProjectCaseDto>(`/requests/${requestId}/project-case/warranty`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(qc),
  });
}

// e2 pasul 4: fisa firmei castigatoare — livrare confirmata, recenzia primita, raport deschis;
// e1 (etapa 5): plus acceptarea, prima zi de livrare, finalizarea automata si etapele
const companyCompletionKey = (requestId: string) => ['fulfillment', 'company-completion', requestId];

export function useCompanyCompletion(requestId: string, enabled = true) {
  return useQuery({
    queryKey: companyCompletionKey(requestId),
    queryFn: () => api<CompanyCompletionDto>(`/company/requests/${requestId}/completion`),
    enabled: !!requestId && enabled,
    retry: false,
  });
}

// e1-2: firma bifeaza / debifeaza o etapa informativa; serverul intoarce fisa adusa la zi
export function useSetExecutionStage(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stage, done }: { stage: ExecutionStage; done: boolean }) =>
      api<CompanyCompletionDto>(`/company/requests/${requestId}/stages/${stage}`, {
        method: 'PUT',
        body: JSON.stringify({ done }),
      }),
    onSuccess: (data) => {
      if (data) qc.setQueryData(companyCompletionKey(requestId), data);
      qc.invalidateQueries({ queryKey: ['fulfillment'] });
    },
    // etapa nu se mai poate schimba (cererea a trecut in alta stare) → reincarcam starea
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'EXECUTION_STAGE_NOT_EDITABLE') invalidate(qc);
    },
  });
}

// e1-1: clientul — persoana responsabila, datele firmei castigatoare si etapele (doar dupa acceptare)
export function useClientFulfillment(requestId: string, enabled = true) {
  return useQuery({
    queryKey: ['fulfillment', 'client', requestId],
    queryFn: async () => (await api<ClientFulfillmentDto | null>(`/requests/${requestId}/fulfillment`)) ?? null,
    enabled: !!requestId && enabled,
    retry: false,
  });
}

// firma castigatoare marcheaza livrarea
export function useMarkDelivered() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      api<{ status: string }>(`/company/requests/${requestId}/deliver`, { method: 'POST' }),
    onSuccess: () => invalidate(qc),
    // e1-3: prea devreme → reincarcam fisa (data de la care se poate marca vine de pe server)
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'DELIVERY_TOO_EARLY') invalidate(qc);
    },
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
