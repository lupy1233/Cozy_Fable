'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { purgeLegacyRequestTokens } from '@/lib/session-cleanup';

// TanStack Query = single source of truth pentru server state (STATE_CONVENTIONS.md).
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // curatenie unica: cheile mm_req_token_* scrise de build-urile vechi (SEC2-4)
  useEffect(() => {
    purgeLegacyRequestTokens();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
