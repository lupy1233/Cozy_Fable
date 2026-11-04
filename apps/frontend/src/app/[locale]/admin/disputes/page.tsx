'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useAdminDisputes, useResolveDispute } from '@/hooks/use-fulfillment';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError } from '@/components/ui/query-state';
import { SkeletonList, SkeletonPage } from '@/components/ui/skeleton';

export default function AdminDisputesPage() {
  const t = useTranslations('AdminDisputes');
  const router = useRouter();
  const me = useMe();
  const list = useAdminDisputes();
  const resolve = useResolveDispute();
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (me.isPending) return <SkeletonPage variant="list" />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title={t('title')} />
      {list.isPending && <SkeletonList rows={3} variant="cards" />}
      {list.isError && <LoadError onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.length === 0 && (
        <EmptyState variant="card" size="sm" title={t('empty')} />
      )}
      {list.data?.map((d) => (
        <Card key={d.id} className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="heading-card">{d.companyName}</span>
            <span className="text-brass">
              {'★'.repeat(d.rating)}
              {'☆'.repeat(5 - d.rating)}
            </span>
          </div>
          {d.comment && <p className="text-muted-foreground">“{d.comment}”</p>}
          <Input
            value={notes[d.id] ?? ''}
            onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))}
            placeholder={t('notePlaceholder')}
          />
          <div className="flex gap-2">
            <Button
              onClick={() => resolve.mutate({ id: d.id, status: 'RESOLVED', resolutionNote: notes[d.id] })}
              disabled={resolve.isPending}
              className="bg-sage text-white hover:brightness-110"
            >
              {t('resolve')}
            </Button>
            <Button
              variant="outline"
              onClick={() => resolve.mutate({ id: d.id, status: 'DISMISSED', resolutionNote: notes[d.id] })}
              disabled={resolve.isPending}
            >
              {t('dismiss')}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
