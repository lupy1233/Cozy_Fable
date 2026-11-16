'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const UNSUSPEND_REASON_MIN = 3;

export type UnsuspendResult = {
  id: string;
  status: string;
  // punctele de penalizare active anulate la ridicare (raspuns PO k2-1)
  penaltyPoints: number;
  count: number;
};

// Etapa 12 (k2): ridicarea suspendarii trimite motivul (min 3 caractere, ca la respingere).
// Inlocuieste useUnsuspendCompany din hooks/use-company.ts, care trimitea cererea fara corp.
export function useUnsuspendCompanyWithReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      api<UnsuspendResult>(`/admin/companies/${input.id}/unsuspend`, {
        method: 'POST',
        body: JSON.stringify({ reason: input.reason.trim() }),
      }),
    onSuccess: (_d, input) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'companies'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'companies', 'detail', input.id] });
    },
  });
}
