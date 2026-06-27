'use client';

import { useTranslations } from 'next-intl';
import { useAdminJobs, useRetryJob } from '@/hooks/use-admin';
import { Button } from '@/components/ui/button';

export default function AdminJobsPage() {
  const t = useTranslations('Admin');
  const jobs = useAdminJobs();
  const retry = useRetryJob();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="page-title">{t('nav.jobs')}</h1>
      {jobs.isSuccess && jobs.data.length === 0 && (
        <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
          {t('jobs.empty')}
        </p>
      )}
      {jobs.data?.map((j) => (
        <div
          key={`${j.queue}-${j.id}`}
          className="flex items-center justify-between rounded-xl border border-crimson/25 bg-crimson-soft p-4 text-sm"
        >
          <div>
            <p className="font-mono font-medium">
              {j.queue} · {j.name}
            </p>
            <p className="text-xs text-crimson">{j.failedReason ?? '—'}</p>
            <p className="text-xs text-muted-foreground">
              {t('jobs.attempts')}: {j.attemptsMade}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => retry.mutate({ queue: j.queue, id: j.id })}
            disabled={retry.isPending}
          >
            {t('jobs.retry')}
          </Button>
        </div>
      ))}
    </div>
  );
}
