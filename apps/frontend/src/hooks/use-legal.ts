'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
  type AuthUser,
  type FirmRulesDto,
  type LegalOperatorDto,
} from '@marketplace/shared';
import { api } from '@/lib/api';

export type PublishedOperator = Extract<LegalOperatorDto, { published: true }>;

// E-admin-platform-2: identitatea operatorului vine din Admin → Setari; publicata doar dupa
// ce PO seteaza legal_identity_published. Mock-urile e2e pot intoarce [] sau 401 → verificam forma.
export function isPublishedOperator(d: unknown): d is PublishedOperator {
  return !!d && typeof d === 'object' && (d as { published?: unknown }).published === true;
}

export function useLegalOperator() {
  return useQuery({
    queryKey: ['legal', 'operator'],
    queryFn: () => api<LegalOperatorDto>('/legal/operator').then((r) => r ?? null),
    staleTime: 10 * 60_000,
    retry: false,
  });
}

// E-company-9: valorile in vigoare din "Reguli pentru firme" (GET /legal/firm-rules, publica).
// Mock-urile e2e pot intoarce [] sau 401 → verificam forma inainte sa afisam numere.
export function isFirmRules(d: unknown): d is FirmRulesDto {
  if (!d || typeof d !== 'object') return false;
  const r = d as Partial<FirmRulesDto>;
  return !!r.verification && !!r.trial && !!r.claims && !!r.sla && !!r.withdrawals && !!r.penalties && !!r.delivery;
}

export function useFirmRules() {
  return useQuery({
    queryKey: ['legal', 'firm-rules'],
    queryFn: () => api<FirmRulesDto>('/legal/firm-rules').then((r) => r ?? null),
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

export function useAcceptLegal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ id: string }>('/legal/accept', {
        method: 'POST',
        body: JSON.stringify({ termsVersion: LEGAL_TERMS_VERSION, privacyVersion: LEGAL_PRIVACY_VERSION }),
      }),
    onSuccess: () => {
      qc.setQueryData<AuthUser | undefined>(['auth', 'me'], (u) =>
        u ? { ...u, needsLegalAcceptance: false } : u,
      );
      void qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}
