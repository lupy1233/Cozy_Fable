'use client';

import type { CompanyPenaltyStatusDto } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { firmRulesChunk } from '../../../_components/firm-rules-link';

// Penalizari: punctele active fata de pragul de suspendare + evenimentele care inca numara.
export function PenaltiesSection({
  status,
  className,
}: {
  status: CompanyPenaltyStatusDto;
  className?: string;
}) {
  const tp = useTranslations('Penalties');
  const format = useFormatter();
  const percent =
    status.threshold > 0 ? Math.min(100, Math.round((status.activePoints / status.threshold) * 100)) : 0;
  const atLimit = status.suspended || percent >= 100;

  return (
    <section
      id="penalties"
      aria-labelledby="wallet-penalties-title"
      className={cn('flex min-w-0 scroll-mt-24 flex-col gap-4', className)}
    >
      <h2 id="wallet-penalties-title" className="font-serif text-2xl leading-tight">
        {tp('title')}
      </h2>
      <Card
        tone={status.suspended ? 'crimson' : 'default'}
        padding="none"
        className="flex flex-col gap-3 px-6 py-5"
      >
        <p className="text-sm">
          <span className="font-serif text-3xl leading-none">{status.activePoints}</span>{' '}
          {tp('pointsRest', { threshold: status.threshold })}
        </p>
        <div
          role="img"
          aria-label={tp('points', { active: status.activePoints, threshold: status.threshold })}
          className={cn('h-2 rounded-full', status.suspended ? 'bg-surface' : 'bg-background')}
        >
          {/* latimea vine din date (puncte active / prag) */}
          <span
            className={cn('block h-2 rounded-full', atLimit ? 'bg-crimson' : 'bg-amber')}
            style={{ width: `${percent}%` }}
          />
        </div>
        {status.suspended && (
          <p className="text-sm font-medium text-crimson">
            {tp('suspended', {
              until: status.suspendedUntil
                ? format.dateTime(new Date(status.suspendedUntil), { dateStyle: 'medium' })
                : '',
            })}
          </p>
        )}
        {status.events.length > 0 && (
          <ul className="flex flex-col gap-1 text-ui text-ink-2">
            {status.events.map((e) => (
              <li key={e.id}>
                {tp.has(`rule.${e.ruleKey}`) ? tp(`rule.${e.ruleKey}`) : e.ruleKey} · {e.points} {tp('pts')} ·{' '}
                {tp('expires')} {format.dateTime(new Date(e.expiresAt), { dateStyle: 'medium' })}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm font-medium">{tp.rich('rulesLink', { rules: firmRulesChunk('penalties') })}</p>
      </Card>
    </section>
  );
}
