'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useAdminWithdrawals, useReviewWithdrawal } from '@/hooks/use-claims-lifecycle';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function AdminWithdrawalsPage() {
  const t = useTranslations('AdminWithdrawals');
  const tl = useTranslations('Lifecycle');
  const router = useRouter();
  const me = useMe();
  const list = useAdminWithdrawals();
  const review = useReviewWithdrawal();
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (me.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="page-title">{t('title')}</h1>
      {list.isSuccess && list.data.length === 0 && (
        <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      )}
      {list.data?.map((w) => (
        <div key={w.id} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex justify-between">
            <span className="font-serif text-lg">{w.companyName}</span>
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
        </div>
      ))}
    </div>
  );
}
