'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import { useAdminWithdrawals, useReviewWithdrawal } from '@/hooks/use-claims-lifecycle';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError } from '@/components/ui/query-state';
import { SkeletonList, SkeletonPage } from '@/components/ui/skeleton';

export default function AdminWithdrawalsPage() {
  const t = useTranslations('AdminWithdrawals');
  const tl = useTranslations('Lifecycle');
  const router = useRouter();
  const me = useMe();
  const list = useAdminWithdrawals();
  const review = useReviewWithdrawal();
  const [notes, setNotes] = useState<Record<string, string>>({});
  // E-company-1: aprobarea refuzata (ex. slotul a castigat intre timp) → mesajul mapat, ca adminul sa respinga
  const errCode = review.error ? (review.error instanceof ApiError ? review.error.code : 'INTERNAL_ERROR') : null;
  const errText = errCode
    ? tl.has(`apiErrors.${errCode}`)
      ? tl(`apiErrors.${errCode}`)
      : tl('apiErrors.INTERNAL_ERROR')
    : null;

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (me.isPending) {
    return <SkeletonPage variant="list" />;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title={t('title')} />
      {list.isPending && <SkeletonList rows={3} variant="cards" />}
      {list.isError && <LoadError onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.length === 0 && (
        <EmptyState variant="card" size="sm" title={t('empty')} />
      )}
      {list.data?.map((w) => (
        <Card key={w.id} className="flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="heading-card">{w.companyName}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {new Date(w.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{w.requestTitle}</p>
          <p className="text-sm">
            {tl(`reason.${w.reasonType}`)}: <em>{w.customReason}</em>
          </p>
          <Input
            value={notes[w.id] ?? ''}
            onChange={(e) => setNotes((n) => ({ ...n, [w.id]: e.target.value }))}
            placeholder={t('notePlaceholder')}
          />
          <div className="flex gap-2">
            <Button
              onClick={() => review.mutate({ id: w.id, approve: true, adminNote: notes[w.id] })}
              disabled={review.isPending}
              className="bg-sage text-white hover:brightness-110"
            >
              {t('approve')}
            </Button>
            <Button
              variant="outline"
              onClick={() => review.mutate({ id: w.id, approve: false, adminNote: notes[w.id] })}
              disabled={review.isPending}
            >
              {t('reject')}
            </Button>
          </div>
          {errText && review.variables?.id === w.id && <p className="text-sm text-crimson">{errText}</p>}
        </Card>
      ))}
    </div>
  );
}
