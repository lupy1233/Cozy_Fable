'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useAdminPendingPayments, useConfirmPayment } from '@/hooks/use-billing';
import { Button } from '@/components/ui/button';

export default function AdminPaymentsPage() {
  const t = useTranslations('AdminPayments');
  const router = useRouter();
  const me = useMe();
  const list = useAdminPendingPayments();
  const confirm = useConfirmPayment();

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
      {list.data?.map((o) => (
        <div key={o.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-5 text-sm shadow-sm">
          <div>
            <p className="font-serif text-lg">{o.companyName}</p>
            <p className="text-muted-foreground">
              {t(`orderType.${o.orderType}`)} · {o.credits ?? ''} · {o.totalRon} RON
            </p>
          </div>
          <Button
            onClick={() => confirm.mutate(o.id)}
            disabled={confirm.isPending}
            className="bg-sage text-white hover:brightness-110"
          >
            {t('confirm')}
          </Button>
        </div>
      ))}
    </div>
  );
}
