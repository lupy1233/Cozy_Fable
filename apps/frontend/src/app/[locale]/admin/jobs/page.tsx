'use client';

import type { JobDto } from '@marketplace/shared';
import { AlertTriangle, Check } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { useAdminJobs, useRetryJob } from '@/hooks/use-admin';
import { useRelativeTime } from '@/lib/relative-time';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError } from '@/components/ui/query-state';
import { SkeletonList } from '@/components/ui/skeleton';

// rezultatul ultimei reincercari, aratat ca mesaj de stare deasupra listei
type Notice = { kind: 'one' } | { kind: 'all'; ok: number; failed: number } | { kind: 'error' };

// Joburile esuate (BullMQ) cu reincercare. „Reincearca toate” apeleaza aceeasi reincercare,
// pe rand, pentru fiecare job din lista incarcata (nu exista un endpoint de grup).
export default function AdminJobsPage() {
  const t = useTranslations('Admin');
  const format = useFormatter();
  const relative = useRelativeTime();
  const jobs = useAdminJobs();
  const retry = useRetryJob();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);

  const count = jobs.data?.length ?? 0;
  const oldest = (jobs.data ?? []).reduce<string | null>(
    (min, j) => (j.timestamp && (!min || j.timestamp < min) ? j.timestamp : min),
    null,
  );
  const busy = retry.isPending || bulkRunning;
  const queueLabel = (queue: string) => (t.has(`jobs.queues.${queue}`) ? t(`jobs.queues.${queue}`) : queue);
  const strong = (chunks: ReactNode) => <span className="font-semibold text-crimson">{chunks}</span>;

  const retryOne = (j: JobDto) => {
    setNotice(null);
    retry.mutate(
      { queue: j.queue, id: j.id },
      {
        onSuccess: () => setNotice({ kind: 'one' }),
        onError: () => setNotice({ kind: 'error' }),
      },
    );
  };

  const retryAll = async () => {
    const targets = jobs.data ?? [];
    setNotice(null);
    setBulkRunning(true);
    let ok = 0;
    let failed = 0;
    for (const j of targets) {
      try {
        await retry.mutateAsync({ queue: j.queue, id: j.id });
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    setBulkRunning(false);
    setConfirmAll(false);
    setNotice({ kind: 'all', ok, failed });
  };

  return (
    <div className="flex w-full max-w-[920px] flex-col gap-6">
      <PageHeader
        title={t('nav.jobs')}
        subtitle={
          <span className="block text-lead">
            {t('jobs.subtitle')}
            {count > 0 && (
              <>
                {' '}
                {oldest
                  ? t.rich('jobs.failedSummary', { n: count, when: relative(oldest), b: strong })
                  : t.rich('jobs.failedSummaryNoDate', { n: count, b: strong })}
              </>
            )}
          </span>
        }
        actions={
          count > 1 && (
            <Button
              variant="outline"
              className="h-11 border-foreground px-5"
              disabled={busy}
              onClick={() => setConfirmAll(true)}
            >
              {t('jobs.retryAll')}
            </Button>
          )
        }
      />

      {notice?.kind === 'one' && (
        <Alert tone="sage" role="status" icon={<Check aria-hidden />} title={t('jobs.retried')}>
          {t('jobs.retriedHint')}
        </Alert>
      )}
      {notice?.kind === 'all' && (
        <Alert
          tone={notice.failed > 0 ? 'amber' : 'sage'}
          role="status"
          icon={notice.failed > 0 ? <AlertTriangle aria-hidden /> : <Check aria-hidden />}
          title={t('jobs.retriedAll', { ok: notice.ok })}
        >
          {notice.failed > 0 ? t('jobs.retryAllFailed', { failed: notice.failed }) : t('jobs.retriedHint')}
        </Alert>
      )}
      {notice?.kind === 'error' && (
        <Alert tone="crimson" role="alert" icon={<AlertTriangle aria-hidden />}>
          {t('jobs.retryFailed')}
        </Alert>
      )}

      {jobs.isPending && <SkeletonList rows={3} variant="cards" />}
      {jobs.isError && <LoadError onRetry={() => void jobs.refetch()} />}
      {jobs.isSuccess && jobs.data.length === 0 && (
        <EmptyState variant="dashed" title={t('jobs.empty')} hint={t('jobs.emptyHint')} />
      )}

      {jobs.data?.map((j) => (
        <Card key={`${j.queue}-${j.id}`} as="article" padding="none" className="flex flex-col border-crimson/30">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border px-6 py-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="text-lead font-semibold">{queueLabel(j.queue)}</h2>
              <div className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {j.queue} · {j.name} · #{j.id}
              </div>
            </div>
            <div className="text-right">
              {j.timestamp && (
                <div className="whitespace-nowrap font-mono text-xs">
                  <span className="sr-only">{t('jobs.queuedAt')} </span>
                  {format.dateTime(new Date(j.timestamp), { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                {t('jobs.attempts')}: {j.attemptsMade}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4">
            <div className="min-w-0 flex-[1_1_360px] rounded-md bg-crimson-soft px-3 py-2.5 font-mono text-xs text-crimson [overflow-wrap:anywhere]">
              {j.failedReason ?? t('jobs.noReason')}
            </div>
            <Button className="h-11 px-5" onClick={() => retryOne(j)} disabled={busy}>
              {t('jobs.retry')}
            </Button>
          </div>
        </Card>
      ))}

      {/* Reincearca toate: confirmare cu ce urmeaza */}
      <Dialog open={confirmAll} onOpenChange={(open) => !open && !bulkRunning && setConfirmAll(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('jobs.retryAllTitle')}</DialogTitle>
            <DialogDescription>{t('jobs.retryAllBody', { n: count })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={bulkRunning} onClick={() => setConfirmAll(false)}>
              {t('jobs.back')}
            </Button>
            <Button disabled={bulkRunning || count === 0} onClick={() => void retryAll()}>
              {t('jobs.retryAllCta')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
