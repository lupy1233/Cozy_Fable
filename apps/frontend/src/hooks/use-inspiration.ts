'use client';

import { useQuery } from '@tanstack/react-query';
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
