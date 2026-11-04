'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BoardItemMetaInput,
  InspirationBoardDetailDto,
  InspirationBoardDto,
  InspirationBoardItemMetaDto,
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
// E-client-34: o poza poate fi in mai multe colectii, deci starea e o multime de perechi
// (photoId, boardId) si rollback-ul e INVERSUL operatiei pe acea pereche — nu restaurarea
// unui snapshot, ca doua bife rapide sa nu se anuleze reciproc.
const SAVED_KEY = [...KEY, 'saved'] as const;

type Pair = { photoId: string; boardId: string };

const samePair = (a: Pair, b: Pair) => a.photoId === b.photoId && a.boardId === b.boardId;
const withPair = (refs: InspirationSaveDto[], p: Pair): InspirationSaveDto[] =>
  refs.some((r) => samePair(r, p)) ? refs : [...refs, { photoId: p.photoId, boardId: p.boardId }];
const withoutPair = (refs: InspirationSaveDto[], p: Pair): InspirationSaveDto[] =>
  refs.filter((r) => !samePair(r, p));

function useOptimisticSaved() {
  const qc = useQueryClient();
  const change = (update: (refs: InspirationSaveDto[]) => InspirationSaveDto[]) =>
    qc.setQueryData<InspirationSaveDto[]>(SAVED_KEY, (old) => update(old ?? []));
  return {
    async apply(update: (refs: InspirationSaveDto[]) => InspirationSaveDto[]) {
      await qc.cancelQueries({ queryKey: SAVED_KEY });
      change(update);
    },
    // inversul operatiei pe perechea afectata (la eroare)
    undo(update: (refs: InspirationSaveDto[]) => InspirationSaveDto[]) {
      change(update);
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
    onMutate: (v) => opt.apply((refs) => withPair(refs, v)),
    onError: (_e, v) => opt.undo((refs) => withoutPair(refs, v)),
    onSettled: () => opt.settle(),
  });
}

export function useUnsavePhoto() {
  const opt = useOptimisticSaved();
  return useMutation({
    mutationFn: (v: { boardId: string; photoId: string }) =>
      api<void>(`/inspiration/boards/${v.boardId}/items/${v.photoId}`, { method: 'DELETE' }),
    onMutate: (v) => opt.apply((refs) => withoutPair(refs, v)),
    onError: (_e, v) => opt.undo((refs) => withPair(refs, v)),
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
    // scoate doar perechea (poza, colectia sursa); alte colectii ale pozei raman
    onMutate: (v) =>
      opt.apply((refs) =>
        withPair(withoutPair(refs, { photoId: v.photoId, boardId: v.boardId }), {
          photoId: v.photoId,
          boardId: v.targetBoardId,
        }),
      ),
    onError: (_e, v) =>
      opt.undo((refs) =>
        withPair(withoutPair(refs, { photoId: v.photoId, boardId: v.targetBoardId }), {
          photoId: v.photoId,
          boardId: v.boardId,
        }),
      ),
    onSettled: () => opt.settle(),
  });
}

// E-client-34: notita / camera unei salvari din colectie (PATCH), null sterge valoarea.
export function useUpdateBoardItem(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { photoId: string } & BoardItemMetaInput) => {
      const { photoId, ...patch } = v;
      return api<InspirationBoardItemMetaDto>(`/inspiration/boards/${boardId}/items/${photoId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, 'detail', boardId] }),
  });
}
