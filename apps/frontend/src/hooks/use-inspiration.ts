'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { InspirationFilters, InspirationPhotoDto } from '@marketplace/shared';
import { api } from '@/lib/api';

// Galeria de inspiratie (F6): listare publica cu filtre CSV; cheia de query
// contine filtrele, deci schimbarile de filtre refolosesc cache-ul per combinatie.

function toQuery(filters: InspirationFilters): string {
  const params = new URLSearchParams();
  if (filters.roomType) params.set('type', filters.roomType);
  if (filters.colors?.length) params.set('colors', filters.colors.join(','));
  if (filters.materials?.length) params.set('materials', filters.materials.join(','));
  if (filters.systems?.length) params.set('systems', filters.systems.join(','));
  if (filters.ids?.length) params.set('ids', filters.ids.join(','));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useInspiration(filters: InspirationFilters = {}, enabled = true) {
  const qs = toQuery(filters);
  return useQuery({
    queryKey: ['inspiration', qs],
    queryFn: () => api<InspirationPhotoDto[]>(`/inspiration${qs}`),
    enabled,
    staleTime: 60_000,
  });
}

// pozele alese pe o cerere (detaliu client / marketplace firma)
export function useInspirationByIds(ids: string[]) {
  return useInspiration({ ids }, ids.length > 0);
}

export const INSPIRATION_PAGE_SIZE = 40;

// Galeria principala cu infinite scroll (idee 6 PO r2): pagini de cate 40,
// offset stabil (sortare cu id ca tiebreak pe server). Ultima pagina se
// recunoaste dupa lungimea sub pageSize.
export function useInfiniteInspiration(filters: InspirationFilters = {}) {
  const qs = toQuery(filters);
  const sep = qs ? '&' : '?';
  return useInfiniteQuery({
    queryKey: ['inspiration', 'infinite', qs],
    queryFn: ({ pageParam }) =>
      api<InspirationPhotoDto[]>(
        `/inspiration${qs}${sep}limit=${INSPIRATION_PAGE_SIZE}&offset=${pageParam}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length < INSPIRATION_PAGE_SIZE ? undefined : pages.length * INSPIRATION_PAGE_SIZE,
    staleTime: 60_000,
  });
}
