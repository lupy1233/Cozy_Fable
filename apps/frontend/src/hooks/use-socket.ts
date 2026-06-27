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
  socket ??= io(SOCKET_URL, { withCredentials: true, autoConnect: true });
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
    const onAuthExpired = () => s.connect();

    s.on('message.created', onMessage);
    s.on('quote.created', onQuote);
    s.on('quote.updated', onQuote);
    s.on('quote.accepted', onQuote);
    s.on('auth_expired', onAuthExpired);

    return () => {
      s.off('message.created', onMessage);
      s.off('quote.created', onQuote);
      s.off('quote.updated', onQuote);
      s.off('quote.accepted', onQuote);
      s.off('auth_expired', onAuthExpired);
    };
  }, [qc]);
}
