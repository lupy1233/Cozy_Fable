'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AttachmentDto,
  PresignUploadInput,
  PresignUploadResultDto,
  RequestContentInput,
  RequestDraftCreatedDto,
  RequestDraftPatchInput,
  RequestDto,
  RequestListItemDto,
} from '@marketplace/shared';
import { api } from '@/lib/api';

const draftKey = (token: string) => ['request', 'draft', token] as const;
const MINE_KEY = ['requests', 'mine'] as const;

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
    mutationFn: (content: RequestContentInput) =>
      api<RequestDto>(`/requests/drafts/${token}/publish`, {
        method: 'POST',
        body: JSON.stringify(content),
      }),
    onSuccess: (data) => {
      qc.setQueryData(draftKey(token), data);
      qc.invalidateQueries({ queryKey: MINE_KEY });
    },
  });
}

export function useEditRequest(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: RequestContentInput) =>
      api<RequestDto>(`/requests/drafts/${token}/edit`, {
        method: 'POST',
        body: JSON.stringify(content),
      }),
    onSuccess: (data) => {
      qc.setQueryData(draftKey(token), data);
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
      qc.invalidateQueries({ queryKey: MINE_KEY });
    },
  });
}

// --- atasamente: presign → PUT direct in storage → confirm ---
export function useUploadAttachment(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<AttachmentDto> => {
      const input: PresignUploadInput = {
        filename: file.name,
        mimeType: file.type as PresignUploadInput['mimeType'],
        sizeBytes: file.size,
      };
      const presign = await api<PresignUploadResultDto>(`/requests/drafts/${token}/attachments`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error('upload failed');
      return api<AttachmentDto>(
        `/requests/drafts/${token}/attachments/${presign.attachmentId}/confirm`,
        { method: 'POST' },
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: draftKey(token) }),
  });
}

export function useRemoveAttachment(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      api<void>(`/requests/drafts/${token}/attachments/${attachmentId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: draftKey(token) }),
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
