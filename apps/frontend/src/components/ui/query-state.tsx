'use client';
import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLoadingTimeout } from '@/hooks/use-loading-timeout';
import { Button } from './button';
import { EmptyState } from './empty-state';

// LoadError — eroare de incarcare (sau incarcare prea lunga) cu „Reincearca".
export function LoadError({
  onRetry,
  title,
  hint,
  slow,
  className,
}: {
  onRetry: () => void;
  title?: string;
  hint?: string;
  slow?: boolean;
  className?: string;
}) {
  const t = useTranslations('Common.loadState');
  return (
    <EmptyState
      tone="error"
      role="alert"
      variant="card"
      size="sm"
      icon={AlertTriangle}
      title={title ?? (slow ? t('slowTitle') : t('errorTitle'))}
      hint={hint ?? (slow ? t('slowHint') : t('errorHint'))}
      className={className}
      action={
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden />
          {t('retry')}
        </Button>
      }
    />
  );
}

export interface QueryStateProps {
  /** ex. me.isPending || list.isPending */
  pending: boolean;
  /** truthy → errorFallback ?? <LoadError/> */
  error?: unknown;
  onRetry: () => void;
  skeleton: React.ReactNode;
  errorFallback?: React.ReactNode;
  timeoutMs?: number;
  /** randat cand nu e pending si nu e eroare */
  children?: React.ReactNode;
}

// QueryState — skeleton cat timp se incarca; dupa LOADING_TIMEOUT_MS devine LoadError
// cu „Reincearca"; la eroare arata errorFallback sau LoadError.
export function QueryState({ pending, error, onRetry, skeleton, errorFallback, timeoutMs, children }: QueryStateProps) {
  const { timedOut, restart } = useLoadingTimeout(pending, timeoutMs);
  if (pending) {
    if (timedOut) {
      return (
        <LoadError
          slow
          onRetry={() => {
            restart();
            onRetry();
          }}
        />
      );
    }
    return <>{skeleton}</>;
  }
  if (error) return <>{errorFallback ?? <LoadError onRetry={onRetry} />}</>;
  return <>{children}</>;
}
