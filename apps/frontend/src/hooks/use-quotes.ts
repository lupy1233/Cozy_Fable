'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClaimQuoteContextDto,
  CreateConsultationInviteInput,
  CreateQuoteInput,
  ExtendValidityInput,
  ExtraQuoteVersionInput,
  QuoteDto,
  RejectQuoteChangeInput,
  RequestQuoteChangeInput,
  RespondConsultationInviteInput,
  ReviseQuoteInput,
} from '@marketplace/shared';
import { api } from '@/lib/api';

const QUOTES_KEY = ['quotes'] as const;
const idem = () => ({ 'Idempotency-Key': crypto.randomUUID() });

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: QUOTES_KEY });
  qc.invalidateQueries({ queryKey: ['chat'] });
}

// ===== firma =====
export function useCompanyQuotes() {
  return useQuery({
    queryKey: [...QUOTES_KEY, 'company'],
    queryFn: () => api<QuoteDto[]>('/quotes/mine'),
    retry: false,
  });
}

export function useClaimContext(claimSlotId: string) {
  return useQuery({
    queryKey: [...QUOTES_KEY, 'claim', claimSlotId],
    queryFn: () => api<ClaimQuoteContextDto>(`/quotes/by-claim/${claimSlotId}`),
    enabled: !!claimSlotId,
    retry: false,
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuoteInput) =>
      api<QuoteDto>('/quotes', { method: 'POST', headers: idem(), body: JSON.stringify(input) }),
    onSuccess: () => invalidate(qc),
  });
}

export function useReviseQuote(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviseQuoteInput) =>
      api<QuoteDto>(`/quotes/${quoteId}/revise`, {
        method: 'POST',
        headers: idem(),
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(qc),
  });
}

export function useExtraVersion(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ExtraQuoteVersionInput) =>
      api<QuoteDto>(`/quotes/${quoteId}/extra`, {
        method: 'POST',
        headers: idem(),
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(qc),
  });
}

export function useRejectChange(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RejectQuoteChangeInput) =>
      api<QuoteDto>(`/quotes/${quoteId}/changes/${input.changeRequestId}/reject`, { method: 'POST' }),
    onSuccess: () => invalidate(qc),
  });
}

export function useReoffer(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ExtraQuoteVersionInput) =>
      api<QuoteDto>(`/quotes/${quoteId}/reoffer`, {
        method: 'POST',
        headers: idem(),
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(qc),
  });
}

export function useExtendValidity(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ExtendValidityInput) =>
      api<QuoteDto>(`/quotes/${quoteId}/extend-validity`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(qc),
  });
}

export function useWithdrawQuote(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<QuoteDto>(`/quotes/${quoteId}/withdraw`, { method: 'POST' }),
    onSuccess: () => invalidate(qc),
  });
}

export function useEndNegotiation(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<QuoteDto>(`/quotes/${quoteId}/end-negotiation`, { method: 'POST' }),
    onSuccess: () => invalidate(qc),
  });
}

export function useCreateConsultationInvite(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConsultationInviteInput) =>
      api<QuoteDto>(`/quotes/${quoteId}/consultation-invites`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(qc),
  });
}

// ===== client =====
export function useRequestQuotes(requestId: string) {
  return useQuery({
    queryKey: [...QUOTES_KEY, 'request', requestId],
    queryFn: () => api<QuoteDto[]>(`/client/quotes/request/${requestId}`),
    enabled: !!requestId,
    retry: false,
  });
}

export function useRequestChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestQuoteChangeInput) =>
      api<QuoteDto>('/client/quotes/changes', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidate(qc),
  });
}

export function useAcceptQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quoteId: string) =>
      api<QuoteDto>(`/client/quotes/${quoteId}/accept`, { method: 'POST', headers: idem() }),
    onSuccess: () => invalidate(qc),
  });
}

export function useRespondConsultationInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { inviteId: string } & RespondConsultationInviteInput) =>
      api<QuoteDto>(`/client/quotes/consultation-invites/${input.inviteId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ accept: input.accept, clientResponseText: input.clientResponseText }),
      }),
    onSuccess: () => invalidate(qc),
  });
}
