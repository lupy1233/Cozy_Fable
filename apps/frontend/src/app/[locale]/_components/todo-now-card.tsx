'use client';

import {
  AlarmClock,
  Hourglass,
  Inbox,
  MessageCircleQuestion,
  PackageCheck,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DashboardActionItemDto, DashboardActionKind } from '@marketplace/shared';
import { Link } from '@/i18n/routing';
import { useRelativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

// E-admin-platform-44 — "De facut acum": primul bloc pe dashboard (client si firma).
// Fiecare element e un singur link spre pagina unde se rezolva actiunea.

const KIND_ICON: Record<DashboardActionKind, LucideIcon> = {
  OFFERS_TO_REVIEW: Inbox,
  DELIVERY_TO_CONFIRM: PackageCheck,
  CLARIFICATION_TO_ANSWER: MessageCircleQuestion,
  REQUEST_EXPIRING: Hourglass,
  UNASSIGNED_CLAIM: UserPlus,
  SLA_DUE_SOON: AlarmClock,
};

// termene care costa ceva daca sunt ratate (expirare / anulare / penalizare)
const URGENT_KINDS = new Set<DashboardActionKind>(['SLA_DUE_SOON', 'UNASSIGNED_CLAIM', 'REQUEST_EXPIRING']);

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

export function TodoNowCard({ items }: { items: DashboardActionItemDto[] }) {
  const t = useTranslations('Dashboard.todo');
  const relative = useRelativeTime();

  return (
    <Card as="section" aria-labelledby="todo-now-title">
      <h2 id="todo-now-title" className="heading-card mb-3">
        {t('title')}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-2">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind];
            const urgent = URGENT_KINDS.has(item.kind);
            const when = item.dueAt ? relative(item.dueAt) : null;
            return (
              <li key={`${item.kind}-${item.claimSlotId ?? item.requestId}`}>
                <Link
                  href={todoHref(item)}
                  className="flex min-w-0 items-center gap-3 rounded-md py-2.5 hover:bg-walnut-soft/60"
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      urgent ? 'bg-crimson-soft text-crimson' : 'bg-walnut-soft text-walnut',
                    )}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">
                      {t(`kind.${item.kind}`, { count: item.count ?? 1 })}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{item.title || '—'}</span>
                  </span>
                  {when && (
                    <span className={cn('shrink-0 text-xs', urgent ? 'text-crimson' : 'text-muted-foreground')}>
                      {item.kind === 'DELIVERY_TO_CONFIRM' ? t('autoConfirm', { when }) : t('due', { when })}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
