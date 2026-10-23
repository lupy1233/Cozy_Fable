'use client';

import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { AuthUser } from '@marketplace/shared';
import { toast } from '@/components/ui/toaster';
import { api, ApiError } from '@/lib/api';
import { fetchMe } from './use-auth';

// E-admin-platform-54: 503 DATABASE_BUSY (backend-ul trimite Retry-After: 2)
const BUSY_RETRY_DELAY_MS = 2_000;

export interface IdempotentRunnerOptions {
  // apelat inainte de reincercarea automata (ex. toast „Serverul e ocupat, reincercam…")
  onBusyRetry?: () => void;
  busyRetryDelayMs?: number;
}

const isBusy = (error: unknown) => error instanceof ApiError && error.code === 'DATABASE_BUSY';

export function createIdempotentRunner(identity: () => Promise<string>, opts: IdempotentRunnerOptions = {}) {
  const keys = new Map<string, string>();
  return async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const userId = await identity();
    const fingerprint = JSON.stringify([userId, path, init.method ?? 'POST', init.body ?? null]);
    const key = keys.get(fingerprint) ?? crypto.randomUUID();
    keys.set(fingerprint, key);
    const send = () => api<T>(path, { ...init, headers: { ...init.headers, 'Idempotency-Key': key } });
    try {
      let result: T;
      try {
        result = await send();
      } catch (error) {
        if (!isBusy(error)) throw error;
        // DB ocupat: nimic nu s-a comis (chitanta ramane deschisa) → O SINGURA reincercare,
        // cu ACEEASI cheie, dupa Retry-After. Alte coduri nu se reincearca automat.
        opts.onBusyRetry?.();
        await new Promise((resolve) => setTimeout(resolve, opts.busyRetryDelayMs ?? BUSY_RETRY_DELAY_MS));
        result = await send();
      }
      keys.delete(fingerprint);
      return result;
    } catch (error) {
      // Fara raspuns / 5xx / rezultat necunoscut: aceeasi intentie pastreaza cheia.
      if (error instanceof ApiError && error.status < 500 && error.code !== 'IDEMPOTENCY_CONFLICT') keys.delete(fingerprint);
      throw error;
    }
  };
}

export function useIdempotentApi() {
  const qc = useQueryClient();
  const t = useTranslations('Common');
  const tRef = useRef(t);
  tRef.current = t;
  const runner = useRef<ReturnType<typeof createIdempotentRunner> | null>(null);
  runner.current ??= createIdempotentRunner(
    async () => {
      const user = qc.getQueryData<AuthUser>(['auth', 'me']) ?? (await fetchMe());
      return user.id;
    },
    { onBusyRetry: () => toast.message(tRef.current('serverBusyRetrying')) },
  );
  return runner.current;
}
