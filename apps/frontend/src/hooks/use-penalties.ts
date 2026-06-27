'use client';

import { useQuery } from '@tanstack/react-query';
import type { CompanyPenaltyStatusDto } from '@marketplace/shared';
import { api } from '@/lib/api';

export function usePenaltyStatus() {
  return useQuery({
    queryKey: ['penalties', 'me'],
    queryFn: () => api<CompanyPenaltyStatusDto>('/penalties/me'),
    retry: false,
  });
}
