'use client';

import type { ConfiguratorContentInput, RequestDto } from '@marketplace/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// f6-2 (PO): "Republica cu modificari" — cererea expirata primeste continutul din formular si
// revine in piata intr-un singur pas (o singura data; nu consuma din editari). Aceleasi chei de
// cache ca editarea (useEditRequestById) si republicarea identica (useRepostRequest).
export function useRepostWithChangesById(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: ConfiguratorContentInput) =>
      api<RequestDto>(`/requests/${id}/repost-with-changes`, {
        method: 'POST',
        body: JSON.stringify(content),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['request', id], data);
      qc.invalidateQueries({ queryKey: ['request', id, 'visibility'] });
      qc.invalidateQueries({ queryKey: ['requests', 'mine'] });
      qc.invalidateQueries({ queryKey: ['requests', 'dashboard-stats'] });
    },
  });
}
