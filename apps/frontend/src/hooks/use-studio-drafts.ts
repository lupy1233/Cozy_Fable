'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  StudioDraftData,
  StudioDraftDetailDto,
  StudioDraftSummaryDto,
} from '@marketplace/shared';
import { api } from '@/lib/api';
import { useMe } from './use-auth';

// Drafturile Studio 3D din cont (mod Sims). Server state exclusiv in
// TanStack Query (invarianta 3.6); snapshotul de salvat vine din
// studio-store.snapshot(), incarcarea trece prin studio-store.loadSnapshot.

const KEY = ['studio-drafts'] as const;

export function useStudioDrafts(enabled = true) {
  const me = useMe();
  return useQuery({
    queryKey: [...KEY, 'list'],
    queryFn: () => api<StudioDraftSummaryDto[]>('/studio/drafts'),
    enabled: enabled && !!me.data,
    retry: false,
  });
}

function useInvalidateDrafts() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

// creare sau actualizare, dupa cum exista id (draftul "incarcat" curent)
export function useSaveStudioDraft() {
  const invalidate = useInvalidateDrafts();
  return useMutation({
    mutationFn: (v: { id?: string; name: string; data: StudioDraftData }) =>
      v.id
        ? api<StudioDraftSummaryDto>(`/studio/drafts/${v.id}`, {
            method: 'PUT',
            body: JSON.stringify({ name: v.name, data: v.data }),
          })
        : api<StudioDraftSummaryDto>('/studio/drafts', {
            method: 'POST',
            body: JSON.stringify({ name: v.name, data: v.data }),
          }),
    onSuccess: invalidate,
  });
}

export function useLoadStudioDraft() {
  return useMutation({
    mutationFn: (id: string) => api<StudioDraftDetailDto>(`/studio/drafts/${id}`),
  });
}

export function useDeleteStudioDraft() {
  const invalidate = useInvalidateDrafts();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/studio/drafts/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
