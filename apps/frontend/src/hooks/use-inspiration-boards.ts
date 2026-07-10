'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  InspirationBoardDetailDto,
  InspirationBoardDto,
  InspirationSaveDto,
} from '@marketplace/shared';
import { api } from '@/lib/api';
import { useMe } from './use-auth';

// Colectiile de salvari (item 8, stil Pinterest). Server state exclusiv in
// TanStack Query (invarianta 3.6).

const KEY = ['inspiration-boards'] as const;

export function useBoards(enabled = true) {
  const me = useMe();
  return useQuery({
    queryKey: [...KEY, 'list'],
    queryFn: () => api<InspirationBoardDto[]>('/inspiration/boards'),
    enabled: enabled && !!me.data,
    retry: false,
  });
}

export function useBoardDetail(id: string) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    queryFn: () => api<InspirationBoardDetailDto>(`/inspiration/boards/${id}`),
    enabled: !!id,
    retry: false,
  });
}

// toate salvarile utilizatorului — starea "Salvat" pe pin-uri
export function useSavedRefs() {
  const me = useMe();
  return useQuery({
    queryKey: [...KEY, 'saved'],
    queryFn: () => api<InspirationSaveDto[]>('/inspiration/boards/saved'),
    enabled: !!me.data,
    retry: false,
  });
}

function useInvalidateBoards() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function useCreateBoard() {
  const invalidate = useInvalidateBoards();
  return useMutation({
    mutationFn: (name: string) =>
      api<InspirationBoardDto>('/inspiration/boards', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: invalidate,
  });
}

export function useRenameBoard(id: string) {
  const invalidate = useInvalidateBoards();
  return useMutation({
    mutationFn: (name: string) =>
      api<void>(`/inspiration/boards/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    onSuccess: invalidate,
  });
}

export function useDeleteBoard() {
  const invalidate = useInvalidateBoards();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/inspiration/boards/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useSavePhoto() {
  const invalidate = useInvalidateBoards();
  return useMutation({
    mutationFn: (v: { boardId: string; photoId: string }) =>
      api<void>(`/inspiration/boards/${v.boardId}/items`, {
        method: 'POST',
        body: JSON.stringify({ photoId: v.photoId }),
      }),
    onSuccess: invalidate,
  });
}

export function useUnsavePhoto() {
  const invalidate = useInvalidateBoards();
  return useMutation({
    mutationFn: (v: { boardId: string; photoId: string }) =>
      api<void>(`/inspiration/boards/${v.boardId}/items/${v.photoId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
