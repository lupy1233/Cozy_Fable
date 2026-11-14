'use client';

import type { CreditHistoryItemDto } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { APP_TIME_ZONE } from '@/lib/sla-deadline';
import { cn } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';

// h3 (etapa 9): istoricul miscarilor de credite — cele mai noi primele, cu "Vezi mai multe".
// Suma = schimbarea creditelor disponibile; schimbarea rezervatelor apare separat cand exista.
export function CreditHistorySection({
  pending,
  error,
  items,
  hasMore,
  loadingMore,
  onLoadMore,
  className,
}: {
  pending: boolean;
  error: boolean;
  items: CreditHistoryItemDto[] | undefined;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  className?: string;
}) {
  const tb = useTranslations('Billing');
  const format = useFormatter();
  const signed = (n: number) => format.number(n, { signDisplay: 'exceptZero' });
  const reasonText = (i: CreditHistoryItemDto) =>
    i.reason && (i.kind === 'REFUND' || i.kind === 'CONSUME') && tb.has(`history.reason.${i.reason}`)
      ? tb(`history.reason.${i.reason}`)
      : null;

  return (
    <section
      id="history"
      aria-labelledby="wallet-history-title"
      className={cn('flex min-w-0 scroll-mt-24 flex-col gap-4', className)}
    >
      <h2 id="wallet-history-title" className="font-serif text-2xl leading-tight">
        {tb('history.title')}
      </h2>
      <Card padding="none" className="overflow-hidden">
        {pending && (
          <div className="p-5">
            <SkeletonList rows={3} />
          </div>
        )}
        {error && !pending && (
          <Alert tone="crimson" role="alert" className="m-5">
            {tb('history.loadFailed')}
          </Alert>
        )}
        {!pending && !error && items?.length === 0 && (
          <EmptyState size="sm" variant="plain" title={tb('history.empty')} />
        )}
        {items && items.length > 0 && (
          <ul className="divide-y divide-border" aria-label={tb('history.title')}>
            {items.map((i) => {
              const reason = reasonText(i);
              return (
                <li
                  key={i.id}
                  className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 px-5 py-3.5"
                  data-testid="credit-history-row"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">{tb(`history.kind.${i.kind}`)}</span>
                    {reason && <span className="text-ui text-muted-foreground">{reason}</span>}
                    {i.claimSlotId && i.requestId && (
                      <Link
                        href={`/marketplace/claims/${i.claimSlotId}`}
                        className="inline-flex min-h-11 items-center self-start text-sm text-walnut underline-offset-4 hover:underline sm:min-h-0"
                      >
                        {i.requestTitle?.trim() || tb('history.untitledRequest')}
                      </Link>
                    )}
                    <span className="data-mono text-muted-foreground">
                      {format.dateTime(new Date(i.createdAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: APP_TIME_ZONE,
                      })}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 text-right">
                    <span
                      className={cn(
                        'font-mono text-sm font-semibold',
                        i.availableDelta > 0 && 'text-sage',
                        i.availableDelta < 0 && 'text-crimson',
                      )}
                    >
                      {tb('history.amount', { amount: signed(i.availableDelta) })}
                    </span>
                    {i.reservedDelta !== 0 && (
                      <span className="text-xs text-muted-foreground">
                        {tb('history.reservedChange', { amount: signed(i.reservedDelta) })}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {tb('history.after', {
                        available: format.number(i.availableAfter),
                        reserved: format.number(i.reservedAfter),
                      })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {hasMore && (
          <div className="border-t border-border px-5 py-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={loadingMore}
              aria-busy={loadingMore}
              onClick={onLoadMore}
            >
              {tb('history.loadMore')}
            </Button>
          </div>
        )}
      </Card>
      <p className="text-ui text-muted-foreground">{tb('history.hint')}</p>
    </section>
  );
}
