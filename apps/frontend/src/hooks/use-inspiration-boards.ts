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

// Optimistic update pe starea "Salvat" (invarianta 3.6: onMutate/onError prin
// TanStack) — butonul reactioneaza instant, serverul confirma prin onSettled.
const SAVED_KEY = [...KEY, 'saved'] as const;

function useOptimisticSaved() {
  const qc = useQueryClient();
  return {
    async apply(update: (refs: InspirationSaveDto[]) => InspirationSaveDto[]) {
      await qc.cancelQueries({ queryKey: SAVED_KEY });
      const prev = qc.getQueryData<InspirationSaveDto[]>(SAVED_KEY);
      qc.setQueryData<InspirationSaveDto[]>(SAVED_KEY, (old) => update(old ?? []));
      return { prev };
    },
    rollback(ctx: { prev?: InspirationSaveDto[] } | undefined) {
      if (ctx?.prev) qc.setQueryData(SAVED_KEY, ctx.prev);
    },
    settle() {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  };
}

export function useSavePhoto() {
  const opt = useOptimisticSaved();
  return useMutation({
    mutationFn: (v: { boardId: string; photoId: string }) =>
      api<void>(`/inspiration/boards/${v.boardId}/items`, {
        method: 'POST',
        body: JSON.stringify({ photoId: v.photoId }),
      }),
    onMutate: (v) =>
      opt.apply((refs) => [
        ...refs.filter((r) => r.photoId !== v.photoId),
        { photoId: v.photoId, boardId: v.boardId },
      ]),
    onError: (_e, _v, ctx) => opt.rollback(ctx),
    onSettled: () => opt.settle(),
  });
}

export function useUnsavePhoto() {
  const opt = useOptimisticSaved();
  return useMutation({
    mutationFn: (v: { boardId: string; photoId: string }) =>
      api<void>(`/inspiration/boards/${v.boardId}/items/${v.photoId}`, { method: 'DELETE' }),
    onMutate: (v) =>
      opt.apply((refs) =>
        refs.filter((r) => !(r.photoId === v.photoId && r.boardId === v.boardId)),
      ),
    onError: (_e, _v, ctx) => opt.rollback(ctx),
    onSettled: () => opt.settle(),
  });
}

// Muta pin-ul salvat in alta colectie (idee 4 PO r2) — un singur pas in loc de
// scoate + salveaza.
export function useMovePhoto() {
  const opt = useOptimisticSaved();
  return useMutation({
    mutationFn: (v: { boardId: string; photoId: string; targetBoardId: string }) =>
      api<void>(`/inspiration/boards/${v.boardId}/items/${v.photoId}/move`, {
        method: 'POST',
        body: JSON.stringify({ targetBoardId: v.targetBoardId }),
      }),
    onMutate: (v) =>
      opt.apply((refs) => [
        ...refs.filter((r) => r.photoId !== v.photoId),
        { photoId: v.photoId, boardId: v.targetBoardId },
      ]),
    onError: (_e, _v, ctx) => opt.rollback(ctx),
    onSettled: () => opt.settle(),
  });
}
