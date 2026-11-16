'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';
import { useAdminPlans } from '@/hooks/use-admin';
import { useAdminSubscriptions } from '@/hooks/use-billing';
import { planDisplayName } from '@/lib/plan-label';
import { Badge, TierBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadError } from '@/components/ui/query-state';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

// Zona „Abonamente”: lista abonamentelor (curente si expirate), asa cum vine de la server.
export function SubscriptionsZone() {
  const t = useTranslations('AdminPayments');
  const format = useFormatter();
  const locale = useLocale();
  const titleId = useId();
  const plans = useAdminPlans();
  const subs = useAdminSubscriptions();
  const planName = (planId: string, code: string) => {
    const p = plans.data?.find((x) => x.id === planId);
    return p ? planDisplayName(p, locale) : code;
  };
  const fmtDay = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium' });

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2">
        <h2 id={titleId} className="heading-section">
          {t('subscriptions.title')}
        </h2>
        {subs.data && <span className="font-mono text-xs text-muted-foreground">{subs.data.length}</span>}
      </div>

      {subs.isPending && <SkeletonTable rows={5} cols={4} />}
      {subs.isError && <LoadError onRetry={() => void subs.refetch()} />}
      {subs.isSuccess && subs.data.length === 0 && (
        <EmptyState variant="card" size="sm" title={t('subscriptions.empty')} />
      )}
      {subs.data && subs.data.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <Table className="min-w-[640px] [&_th]:bg-surface-2">
            <THead>
              <TR>
                <TH scope="col">{t('col.company')}</TH>
                <TH scope="col">{t('subscriptions.plan')}</TH>
                <TH scope="col">{t('subscriptions.period')}</TH>
                <TH scope="col">{t('col.status')}</TH>
              </TR>
            </THead>
            <TBody>
              {subs.data.map((s) => (
                <TR key={s.id}>
                  <TD className="font-semibold">{s.companyName}</TD>
                  <TD>
                    <span className="flex flex-wrap items-center gap-2">
                      <TierBadge tier={s.tier} label={planName(s.planId, s.tier)} />
                      {s.isTrial && <Badge tone="amber">{t('subscriptions.trial')}</Badge>}
                    </span>
                  </TD>
                  <TD className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {fmtDay(s.startedAt)} → {fmtDay(s.expiresAt)}
                  </TD>
                  <TD>
                    {s.isCurrent ? (
                      <Badge tone={s.daysLeft <= 7 ? 'amber' : 'sage'} dot>
                        {t('subscriptions.daysLeft', { n: s.daysLeft })}
                      </Badge>
                    ) : (
                      <Badge tone="muted">{t('subscriptions.expired')}</Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </section>
  );
}
