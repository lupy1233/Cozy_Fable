'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useAdminDisputes, useResolveDispute } from '@/hooks/use-fulfillment';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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

  if (me.isPending) return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="page-title">{t('title')}</h1>
      {list.isSuccess && list.data.length === 0 && (
        <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      )}
      {list.data?.map((d) => (
        <div key={d.id} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5 text-sm shadow-sm">
          <div className="flex justify-between">
            <span className="font-serif text-lg">{d.companyName}</span>
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
        </div>
      ))}
    </div>
  );
}
