'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useMyRequests } from '@/hooks/use-requests';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';

export default function MyRequestsPage() {
  const t = useTranslations('Requests');
  const router = useRouter();
  const me = useMe();
  const list = useMyRequests();

  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);

  if (me.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="page-title">{t('myRequests')}</h1>
        <Button asChild variant="walnut">
          <Link href="/requests/new">{t('newTitle')}</Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <Table>
          <THead>
            <TR>
              <TH>{t('field.title')}</TH>
              <TH>{t('status')}</TH>
              <TH>{t('size')}</TH>
              <TH>{t('field.city')}</TH>
              <TH>{t('expiresAt')}</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {list.data?.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-10 text-center text-muted-foreground">
                  {t('empty')}
                </TD>
              </TR>
            )}
            {list.data?.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium">{r.title}</TD>
                <TD>
                  <StatusBadge status={r.status} label={t(`statusValue.${r.status}`)} />
                </TD>
                <TD>{r.size ? t(`sizeValue.${r.size}`) : '—'}</TD>
                <TD>{r.city}</TD>
                <TD className="text-muted-foreground">
                  {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : '—'}
                </TD>
                <TD>
                  <Link href={`/requests/${r.id}`} className="text-walnut hover:underline">
                    {t('view')}
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
