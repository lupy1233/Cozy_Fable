'use client';

import { useTranslations } from 'next-intl';
import { useAdminJobs, useRetryJob } from '@/hooks/use-admin';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError } from '@/components/ui/query-state';
import { SkeletonList } from '@/components/ui/skeleton';

export default function AdminJobsPage() {
  const t = useTranslations('Admin');
  const jobs = useAdminJobs();
  const retry = useRetryJob();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('nav.jobs')} />
      {jobs.isPending && <SkeletonList rows={3} variant="cards" />}
      {jobs.isError && <LoadError onRetry={() => void jobs.refetch()} />}
      {jobs.isSuccess && jobs.data.length === 0 && (
        <EmptyState variant="card" size="sm" title={t('jobs.empty')} />
      )}
      {jobs.data?.map((j) => (
        <Card
          key={`${j.queue}-${j.id}`}
          tone="crimson"
          padding="sm"
          className="flex items-center justify-between text-sm"
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
        </Card>
      ))}
    </div>
  );
}
