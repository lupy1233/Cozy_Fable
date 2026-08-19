'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClaimSlotDto,
  CreateClaimInput,
  CreditWalletDto,
  MarketplaceDetailDto,
  MarketplaceItemDto,
  SubscriptionDetailDto,
} from '@marketplace/shared';
import { api } from '@/lib/api';

const MARKET_KEY = ['marketplace', 'requests'] as const;
const MY_CLAIMS_KEY = ['claims', 'mine'] as const;
const WALLET_KEY = ['billing', 'wallet'] as const;
const SUBSCRIPTION_KEY = ['billing', 'subscription'] as const;

export function useMarketplace() {
  return useQuery({
    queryKey: MARKET_KEY,
    queryFn: () => api<MarketplaceItemDto[]>('/marketplace/requests'),
    retry: false,
  });
}

export function useMarketplaceDetail(id: string) {
  return useQuery({
    queryKey: [...MARKET_KEY, id],
    queryFn: () => api<MarketplaceDetailDto>(`/marketplace/requests/${id}`),
    enabled: !!id,
    retry: false,
  });
}

// Claim — POST critic cu Idempotency-Key (invarianta 3.2).
export function useClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClaimInput) =>
      api<ClaimSlotDto>('/claims', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MARKET_KEY });
      qc.invalidateQueries({ queryKey: MY_CLAIMS_KEY });
      qc.invalidateQueries({ queryKey: WALLET_KEY });
    },
  });
}

export function useAssignClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { claimId: string; assignToUserId: string }) =>
      api<ClaimSlotDto>(`/claims/${input.claimId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assignToUserId: input.assignToUserId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MY_CLAIMS_KEY });
      // workspace-ul claim-ului (PO r6) isi ia atribuirea din contextul quotes
      qc.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

export function useMyClaims() {
  return useQuery({
    queryKey: MY_CLAIMS_KEY,
    queryFn: () => api<ClaimSlotDto[]>('/claims/mine'),
    retry: false,
  });
}

export function useWallet() {
  return useQuery({
    queryKey: WALLET_KEY,
    queryFn: () => api<CreditWalletDto>('/billing/wallet'),
    retry: false,
  });
}

// Abonamentul activ (cu daysLeft); fara abonament backendul raspunde cu body gol →
// api() da undefined, pe care TanStack v5 il respinge → normalizam la null.
export function useSubscription() {
  return useQuery({
    queryKey: SUBSCRIPTION_KEY,
    queryFn: () => api<SubscriptionDetailDto | null>('/billing/subscription').then((s) => s ?? null),
    retry: false,
  });
}
