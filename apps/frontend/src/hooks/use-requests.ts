'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AnswerMap,
  AttachmentDto,
  BudgetEstimateDto,
  ClientDashboardStatsDto,
  ConfiguratorContentInput,
  PresignUploadInput,
  PresignUploadResultDto,
  RequestDraftCreatedDto,
  RequestDraftPatchInput,
  RequestDto,
  RequestListItemDto,
  RoomType,
} from '@marketplace/shared';
import { api } from '@/lib/api';

const draftKey = (token: string) => ['request', 'draft', token] as const;
const MINE_KEY = ['requests', 'mine'] as const;

// Tinta operatiilor pe atasamente: draft (secret = token) sau cererea proprie
// (autentificat, dupa publish — editare de pe orice device).
export type AttachmentTarget =
  | { kind: 'draft'; token: string }
  | { kind: 'request'; id: string };

const attachmentsBase = (t: AttachmentTarget) =>
  t.kind === 'draft' ? `/requests/drafts/${t.token}/attachments` : `/requests/${t.id}/attachments`;

const targetQueryKey = (t: AttachmentTarget) =>
  t.kind === 'draft' ? draftKey(t.token) : (['request', t.id] as const);

// --- draft anonim cu token ---
export function useCreateDraft() {
  return useMutation({
    mutationFn: (patch: RequestDraftPatchInput = {}) =>
      api<RequestDraftCreatedDto>('/requests/drafts', {
        method: 'POST',
        body: JSON.stringify(patch),
      }),
  });
}

export function useDraft(token: string | null) {
  return useQuery({
    queryKey: draftKey(token ?? ''),
    queryFn: () => api<RequestDto>(`/requests/drafts/${token}`),
    enabled: !!token,
    retry: false,
  });
}

export function usePatchDraft(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: RequestDraftPatchInput) =>
      api<RequestDto>(`/requests/drafts/${token}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: (data) => qc.setQueryData(draftKey(token), data),
  });
}

export function usePublishDraft(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: ConfiguratorContentInput) =>
      api<RequestDto>(`/requests/drafts/${token}/publish`, {
        method: 'POST',
        body: JSON.stringify(content),
      }),
    onSuccess: (data) => {
      qc.setQueryData(draftKey(token), data);
      // seed pentru pagina de detalii: redirectul de dupa publish randeaza
      // instant din cache in loc sa refaca fetch-ul complet
      qc.setQueryData(['request', data.id], data);
      qc.invalidateQueries({ queryKey: MINE_KEY });
    },
  });
}

export function useEditRequest(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: ConfiguratorContentInput) =>
      api<RequestDto>(`/requests/drafts/${token}/edit`, {
        method: 'POST',
        body: JSON.stringify(content),
      }),
    onSuccess: (data) => {
      qc.setQueryData(draftKey(token), data);
      qc.setQueryData(['request', data.id], data);
      qc.invalidateQueries({ queryKey: MINE_KEY });
    },
  });
}

export function useRepostRequest(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<RequestDto>(`/requests/drafts/${token}/repost`, { method: 'POST' }),
    onSuccess: (data) => {
      qc.setQueryData(draftKey(token), data);
      qc.setQueryData(['request', data.id], data);
      qc.invalidateQueries({ queryKey: MINE_KEY });
    },
  });
}

// --- atasamente: presign → PUT direct in storage → confirm (draft SAU cerere proprie) ---
export function useUploadAttachmentFor(target: AttachmentTarget) {
  const qc = useQueryClient();
  const base = attachmentsBase(target);
  return useMutation({
    mutationFn: async (file: File): Promise<AttachmentDto> => {
      const input: PresignUploadInput = {
        filename: file.name,
        mimeType: file.type as PresignUploadInput['mimeType'],
        sizeBytes: file.size,
      };
      const presign = await api<PresignUploadResultDto>(base, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error('upload failed');
      return api<AttachmentDto>(`${base}/${presign.attachmentId}/confirm`, { method: 'POST' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: targetQueryKey(target) }),
  });
}

export function useRemoveAttachmentFor(target: AttachmentTarget) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      api<void>(`${attachmentsBase(target)}/${attachmentId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: targetQueryKey(target) }),
  });
}

// Lista de atasamente a tintei (draft sau cerere), din query-ul potrivit.
export function useAttachmentsFor(target: AttachmentTarget): AttachmentDto[] {
  const draft = useDraft(target.kind === 'draft' ? target.token : null);
  const request = useRequest(target.kind === 'request' ? target.id : '');
  return (target.kind === 'draft' ? draft.data?.attachments : request.data?.attachments) ?? [];
}

// wrappers compat (fluxul draft existent)
export function useUploadAttachment(token: string) {
  return useUploadAttachmentFor({ kind: 'draft', token });
}

export function useRemoveAttachment(token: string) {
  return useRemoveAttachmentFor({ kind: 'draft', token });
}

// Estimarea de buget din scorul camerelor (F5, item 18) — cheia de query e
// continutul camerelor: se recalculeaza doar cand raspunsurile chiar se schimba.
export function useBudgetEstimate(
  rooms: { roomType: RoomType; flowVersion: number; answers: AnswerMap }[],
) {
  const payload = rooms.map((r) => ({
    roomType: r.roomType,
    flowVersion: r.flowVersion,
    answers: r.answers,
  }));
  const key = JSON.stringify(payload);
  return useQuery({
    queryKey: ['requests', 'estimate', key],
    queryFn: () =>
      api<BudgetEstimateDto>('/requests/estimate', {
        method: 'POST',
        body: JSON.stringify({ rooms: payload }),
      }),
    enabled: rooms.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

// Î17 — clientul sterge cererea (soft delete + anulare claim-uri + refund).
export function useDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/requests/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MINE_KEY }),
  });
}

// --- liste client autenticat ---
export function useMyRequests() {
  return useQuery({
    queryKey: MINE_KEY,
    queryFn: () => api<RequestListItemDto[]>('/requests'),
    retry: false,
  });
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: ['request', id],
    queryFn: () => api<RequestDto>(`/requests/${id}`),
    enabled: !!id,
  });
}

// Statistici pentru dashboardul clientului.
export function useClientDashboardStats(enabled = true) {
  return useQuery({
    queryKey: ['requests', 'dashboard-stats'],
    queryFn: () => api<ClientDashboardStatsDto>('/requests/dashboard-stats'),
    enabled,
    staleTime: 30_000,
  });
}

// Editare autentificata a cererii proprii (orice device, fara token de draft).
export function useEditRequestById(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: ConfiguratorContentInput) =>
      api<RequestDto>(`/requests/${id}/edit`, {
        method: 'POST',
        body: JSON.stringify(content),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['request', id], data);
      qc.invalidateQueries({ queryKey: MINE_KEY });
      qc.invalidateQueries({ queryKey: ['requests', 'dashboard-stats'] });
    },
  });
}
