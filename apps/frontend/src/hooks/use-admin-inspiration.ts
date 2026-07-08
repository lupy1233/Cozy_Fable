'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InspirationPhotoDto, InspirationPhotoInput, PresignUploadResultDto } from '@marketplace/shared';
import { api } from '@/lib/api';

// Administrarea galeriei de inspiratie (F6, item 3).

const KEY = ['admin', 'inspiration'] as const;

export function useAdminInspiration() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api<InspirationPhotoDto[]>('/admin/inspiration'),
    retry: false,
  });
}

export function useCreateInspiration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InspirationPhotoInput) =>
      api<InspirationPhotoDto>('/admin/inspiration', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateInspiration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<InspirationPhotoInput> }) =>
      api<InspirationPhotoDto>(`/admin/inspiration/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['inspiration'] });
    },
  });
}

export function useDeleteInspiration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/admin/inspiration/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['inspiration'] });
    },
  });
}

// upload imagine: presign → PUT direct in storage → confirm (invarianta 3.4)
export function useUploadInspirationImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const presign = await api<PresignUploadResultDto>(`/admin/inspiration/${id}/image/presign`, {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, mimeType: file.type, sizeBytes: file.size }),
      });
      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error('upload failed');
      return api<InspirationPhotoDto>(`/admin/inspiration/${id}/image/confirm`, {
        method: 'POST',
        body: JSON.stringify({ attachmentId: presign.attachmentId }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['inspiration'] });
    },
  });
}
