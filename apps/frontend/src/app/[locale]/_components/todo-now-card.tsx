'use client';

import { useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';
import type { DashboardActionItemDto, DashboardActionKind } from '@marketplace/shared';
import { Link } from '@/i18n/routing';
import { useRelativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// E-admin-platform-44 — "De facut acum": primul bloc pe dashboard (client si firma).
// Fiecare rand are un singur link — butonul lui — spre pagina unde se rezolva actiunea.
// Primul rand (termenul cel mai apropiat) poarta actiunea principala a ecranului.

// termene care costa ceva daca sunt ratate (expirare / anulare / penalizare)
const URGENT_KINDS = new Set<DashboardActionKind>(['SLA_DUE_SOON', 'UNASSIGNED_CLAIM', 'REQUEST_EXPIRING']);

// cum se citeste termenul fiecarui tip de actiune
const DUE_KEY: Record<DashboardActionKind, 'due' | 'autoConfirm' | 'autoCancel' | 'expires'> = {
  OFFERS_TO_REVIEW: 'due',
  DELIVERY_TO_CONFIRM: 'autoConfirm',
  CLARIFICATION_TO_ANSWER: 'due',
  REQUEST_EXPIRING: 'expires',
  UNASSIGNED_CLAIM: 'autoCancel',
  SLA_DUE_SOON: 'due',
};

export function todoHref(item: DashboardActionItemDto): string {
  switch (item.kind) {
    case 'OFFERS_TO_REVIEW':
    case 'DELIVERY_TO_CONFIRM':
    case 'CLARIFICATION_TO_ANSWER':
      return `/requests/${item.requestId}/offers`;
    case 'REQUEST_EXPIRING':
      return `/requests/${item.requestId}`;
    case 'UNASSIGNED_CLAIM':
    case 'SLA_DUE_SOON':
      return item.claimSlotId ? `/marketplace/claims/${item.claimSlotId}` : '/marketplace/claims';
  }
}

// numarul de ordine al randului, cu cifre romane (primul rand primeste „!”)
function toRoman(n: number): string {
  const table: [number, string][] = [
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let rest = n;
  let out = '';
  for (const [value, glyph] of table) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

export function TodoNowCard({
  items,
  emptyAction,
}: {
  items: DashboardActionItemDto[];
  /** actiune optionala afisata langa mesajul de lista goala */
  emptyAction?: ReactNode;
}) {
  const t = useTranslations('Dashboard.todo');
  const relative = useRelativeTime();
  const baseId = useId();

  return (
    <Card as="section" padding="none" aria-labelledby="todo-now-title" className="shadow">
      <div className="px-5 pb-3.5 pt-5 sm:px-6">
        <h2 id="todo-now-title" className="heading-section">
          {t('title')}
        </h2>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border px-5 py-4 sm:px-6">
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
          {emptyAction}
        </div>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {items.map((item, index) => {
            const first = index === 0;
            const urgent = URGENT_KINDS.has(item.kind);
            const when = item.dueAt ? relative(item.dueAt) : null;
            const glyph = first ? '!' : toRoman(index + 1);
            const textId = `${baseId}-row-${index}`;
            return (
              <li
                key={`${item.kind}-${item.claimSlotId ?? item.requestId}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-6"
              >
                <span
                  aria-hidden
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-full font-serif',
                    glyph.length > 3 ? 'text-xs' : glyph.length > 2 ? 'text-sm' : 'text-lg',
                    first
                      ? 'bg-crimson-soft text-crimson'
                      : urgent
                        ? 'bg-amber-soft text-amber'
                        : 'bg-walnut-soft text-walnut',
                  )}
                >
                  {glyph}
                </span>
                {/* baza de 200px: pe 360px textul ramane langa cerc, iar butonul coboara pe randul lui */}
                <div id={textId} className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                  <span className="font-semibold">{t(`kind.${item.kind}`, { count: item.count ?? 1 })}</span>
                  <span className="break-words text-muted-foreground">
                    {item.title || '—'}
                    {when && (
                      <>
                        {' · '}
                        <span
                          className={cn(
                            'font-mono text-xs',
                            urgent && (first ? 'text-crimson' : 'text-amber'),
                          )}
                        >
                          {t(DUE_KEY[item.kind], { when })}
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <Button asChild variant={first ? 'walnut' : 'outline'} size="lg" className="h-11">
                  <Link href={todoHref(item)} aria-describedby={textId}>
                    {t(`cta.${item.kind}`)}
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
