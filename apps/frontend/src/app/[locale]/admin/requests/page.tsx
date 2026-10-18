'use client';

import { ADMIN_REQUEST_FILTERS, type AdminRequestFilter } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useAdminRequests } from '@/hooks/use-admin';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError } from '@/components/ui/query-state';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';

// E-admin-platform-3 — proiectele acceptate: in lucru, cu caz raportat, intarziate.
// Detaliul (/admin/requests/[id]) are cronologia, creditele si inchiderea auditata.
export default function AdminRequestsPage() {
  const t = useTranslations('Admin.requests');
  const tr = useTranslations('Requests');
  const router = useRouter();
  const me = useMe();
  const [filter, setFilter] = useState<AdminRequestFilter>('accepted');
  const [page, setPage] = useState(1);
  const list = useAdminRequests(filter, page);

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');
  const fmtDay = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString() : '—');

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Tabs
        panelId="admin-requests-results"
        label={t('title')}
        current={filter}
        onChange={(v) => {
          setFilter(v as AdminRequestFilter);
          setPage(1);
        }}
        tabs={ADMIN_REQUEST_FILTERS.map((v) => ({ value: v, label: t(`filter.${v}`) }))}
      />

      <div id="admin-requests-results" role="tabpanel" aria-labelledby={`admin-requests-results-tab-${filter}`} tabIndex={0}>
        {list.isPending && <SkeletonTable rows={6} cols={7} />}
        {list.isError && <LoadError title={t('loadError')} onRetry={() => void list.refetch()} />}
        {list.isSuccess && list.data.items.length === 0 && (
          <EmptyState variant="card" size="sm" title={t('empty')} />
        )}
        {list.data && list.data.items.length > 0 && (
          <Card padding="none">
            <Table>
              <THead>
                <TR>
                  <TH>{t('col.title')}</TH>
                  <TH>{t('col.status')}</TH>
                  <TH>{t('col.client')}</TH>
                  <TH>{t('col.company')}</TH>
                  <TH>{t('col.acceptedAt')}</TH>
                  <TH>{t('col.deliveryDate')}</TH>
                  <TH>{t('col.flags')}</TH>
                </TR>
              </THead>
              <TBody>
                {list.data.items.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/admin/requests/${r.id}`} className="font-medium text-walnut hover:underline">
                        {r.title || tr('untitled')}
                      </Link>
                    </TD>
                    <TD>
                      <StatusBadge status={r.status} label={tr(`statusValue.${r.status}`)} />
                    </TD>
                    <TD>{r.clientName ?? '—'}</TD>
                    <TD>{r.winnerCompanyName ?? '—'}</TD>
                    <TD className="whitespace-nowrap">{fmtDate(r.acceptedAt)}</TD>
                    <TD className="whitespace-nowrap">{fmtDay(r.deliveryDate)}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {r.openCase && <Badge tone="amber">{t('flag.openCase')}</Badge>}
                        {r.overdue && <Badge tone="crimson">{t('flag.overdue')}</Badge>}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        )}
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-end gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('prev')}
            </Button>
            <span className="text-muted-foreground">{t('pageOf', { page, pages })}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              {t('next')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
