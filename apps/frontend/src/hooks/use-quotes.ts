'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AcceptQuoteInput,
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
  WithdrawQuoteInput,
} from '@marketplace/shared';
import { api, ApiError } from '@/lib/api';
import { useIdempotentApi } from './use-idempotent-api';

const QUOTES_KEY = ['quotes'] as const;

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: QUOTES_KEY });
  qc.invalidateQueries({ queryKey: ['chat'] });
  // mutatiile pe oferte schimba si statusul cererii (OFFERS_RECEIVED/NEGOTIATION/ACCEPTED) —
  // fara invalidare, fisa si listele aratau statusul vechi dupa accept (audit 2026-08-23, P0 UX)
  qc.invalidateQueries({ queryKey: ['request'] });
  qc.invalidateQueries({ queryKey: ['requests'] });
}

// ===== firma =====
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
  const request = useIdempotentApi();
  return useMutation({
    mutationFn: (input: CreateQuoteInput) =>
      request<QuoteDto>('/quotes', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidate(qc),
  });
}

export function useReviseQuote(quoteId: string) {
  const qc = useQueryClient();
  const request = useIdempotentApi();
  return useMutation({
    mutationFn: (input: ReviseQuoteInput) =>
      request<QuoteDto>(`/quotes/${quoteId}/revise`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(qc),
  });
}

export function useExtraVersion(quoteId: string) {
  const qc = useQueryClient();
  const request = useIdempotentApi();
  return useMutation({
    mutationFn: (input: ExtraQuoteVersionInput) =>
      request<QuoteDto>(`/quotes/${quoteId}/extra`, {
        method: 'POST',
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
  const request = useIdempotentApi();
  return useMutation({
    mutationFn: (input: ExtraQuoteVersionInput) =>
      request<QuoteDto>(`/quotes/${quoteId}/reoffer`, {
        method: 'POST',
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
    // E-company-6: acknowledgeSlaBreach cand retragerea expira imediat preluarea
    mutationFn: (input: WithdrawQuoteInput = {}) =>
      api<QuoteDto>(`/quotes/${quoteId}/withdraw`, { method: 'POST', body: JSON.stringify(input) }),
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
    // E-client-1: un tab lasat deschis (ex. peste noapte) se reimprospateaza la revenire
    refetchOnWindowFocus: true,
  });
}

// E-client-1: oferta proaspata la deschiderea dialogului de acceptare — clientul confirma
// ultima versiune reala, nu cea din cache.
export function useClientQuote(quoteId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...QUOTES_KEY, 'client', quoteId],
    queryFn: () => api<QuoteDto>(`/client/quotes/${quoteId}`),
    enabled: enabled && !!quoteId,
    staleTime: 0,
    refetchOnMount: 'always',
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
  const request = useIdempotentApi();
  return useMutation({
    // E-client-1: se trimite versiunea vazuta; versiune noua intre timp → 409 QUOTE_VERSION_CHANGED
    mutationFn: ({ quoteId, quoteVersionId }: { quoteId: string } & AcceptQuoteInput) =>
      request<QuoteDto>(`/client/quotes/${quoteId}/accept`, {
        method: 'POST',
        body: JSON.stringify({ quoteVersionId }),
      }),
    onSuccess: () => invalidate(qc),
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'QUOTE_VERSION_CHANGED') invalidate(qc);
    },
  });
}

// E-admin-platform-3: clientul cere firmei prelungirea unei oferte EXPIRED (repetarea e no-op).
export function useRequestExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quoteId: string) =>
      api<QuoteDto>(`/client/quotes/${quoteId}/request-extension`, { method: 'POST' }),
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
