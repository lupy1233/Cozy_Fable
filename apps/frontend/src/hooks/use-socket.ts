'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';

// Socket.IO pe acelasi cookie httpOnly (invarianta 3.5). La auth_expired → reconectare
// (api.ts face refresh-ul pe requesturile REST). URL-ul = baza fara prefixul /api/v1.
const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').replace(
  /\/api\/v1\/?$/,
  '',
);

let socket: Socket | null = null;
function getSocket(): Socket {
  // Baza relativa (API proxied prin Next in prod) → same-origin: io() fara URL
  socket ??= SOCKET_URL
    ? io(SOCKET_URL, { withCredentials: true, autoConnect: true })
    : io({ withCredentials: true, autoConnect: true });
  return socket;
}

// Aboneaza-te la evenimentele de domeniu si invalideaza cache-ul TanStack (single source of
// truth, 3.6). Invalidare larga pe ['chat'] / ['quotes'] — suficient pentru MVP.
export function useRealtimeSync(): void {
  const qc = useQueryClient();
  useEffect(() => {
    const s = getSocket();
    if (!s.connected) s.connect();

    const onMessage = () => {
      qc.invalidateQueries({ queryKey: ['chat'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };
    const onQuote = () => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['chat'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };
    // claim nou / schimbare de status: parcursul cererii + marketplace se refac
    const onRequestChange = () => {
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['marketplace'] });
      qc.invalidateQueries({ queryKey: ['chat'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };
    const onAuthExpired = () => s.connect();
    // L1 (audit 2026-08-23): evenimentele tintite noi — clopotelul si listele se
    // actualizeaza live, nu la poll-ul de 30s. Invalidare larga per familie de chei.
    const onClaimClosed = () => {
      qc.invalidateQueries({ queryKey: ['claims'] });
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['request'] });
      qc.invalidateQueries({ queryKey: ['marketplace'] });
      qc.invalidateQueries({ queryKey: ['chat'] });
      qc.invalidateQueries({ queryKey: ['billing'] });
      qc.invalidateQueries({ queryKey: ['lifecycle'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };
    const onDelivery = () => {
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['request'] });
      qc.invalidateQueries({ queryKey: ['claims'] });
      qc.invalidateQueries({ queryKey: ['fulfillment'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };
    const onCompany = () => {
      qc.invalidateQueries({ queryKey: ['company'] });
      qc.invalidateQueries({ queryKey: ['auth'] });
      qc.invalidateQueries({ queryKey: ['penalties'] });
      qc.invalidateQueries({ queryKey: ['marketplace'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };
    const onBilling = () => {
      qc.invalidateQueries({ queryKey: ['billing'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };
    const onBell = () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };

    s.on('message.created', onMessage);
    s.on('quote.created', onQuote);
    s.on('quote.updated', onQuote);
    s.on('quote.accepted', onQuote);
    s.on('claim.created', onRequestChange);
    s.on('request.status_changed', onRequestChange);
    s.on('claim.withdrawn', onClaimClosed);
    s.on('withdrawal.decided', onClaimClosed);
    s.on('withdrawal.reminder', onBell);
    s.on('delivery.marked', onDelivery);
    s.on('delivery.confirmed', onDelivery);
    s.on('delivery.autocompleted', onDelivery);
    s.on('review.created', onDelivery);
    s.on('request.expired', onRequestChange);
    s.on('company.approved', onCompany);
    s.on('company.rejected', onCompany);
    s.on('company.suspended', onCompany);
    s.on('company.unsuspended', onCompany);
    s.on('penalty.applied', onCompany);
    s.on('payment.confirmed', onBilling);
    s.on('subscription.expiring', onBilling);
    s.on('company.submitted', onBell);
    s.on('payment.pending', onBell);
    s.on('dispute.opened', onBell);
    s.on('auth_expired', onAuthExpired);

    return () => {
      s.off('message.created', onMessage);
      s.off('quote.created', onQuote);
      s.off('quote.updated', onQuote);
      s.off('quote.accepted', onQuote);
      s.off('claim.created', onRequestChange);
      s.off('request.status_changed', onRequestChange);
      s.off('claim.withdrawn', onClaimClosed);
      s.off('withdrawal.decided', onClaimClosed);
      s.off('withdrawal.reminder', onBell);
      s.off('delivery.marked', onDelivery);
      s.off('delivery.confirmed', onDelivery);
      s.off('delivery.autocompleted', onDelivery);
      s.off('review.created', onDelivery);
      s.off('request.expired', onRequestChange);
      s.off('company.approved', onCompany);
      s.off('company.rejected', onCompany);
      s.off('company.suspended', onCompany);
      s.off('company.unsuspended', onCompany);
      s.off('penalty.applied', onCompany);
      s.off('payment.confirmed', onBilling);
      s.off('subscription.expiring', onBilling);
      s.off('company.submitted', onBell);
      s.off('payment.pending', onBell);
      s.off('dispute.opened', onBell);
      s.off('auth_expired', onAuthExpired);
    };
  }, [qc]);
}
