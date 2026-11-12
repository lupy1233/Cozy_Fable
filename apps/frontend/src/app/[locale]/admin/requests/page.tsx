'use client';

import { ADMIN_REQUEST_FILTERS, type AdminRequestFilter } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useAdminRequests } from '@/hooks/use-admin';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError } from '@/components/ui/query-state';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { CodeUnder, ListPager, Pill, SearchBox, daysSinceDateOnly } from '../_components/core-list-parts';

// Contorul unui tab = totalul listei lui (prima pagina, acelasi hook si aceeasi cheie de query
// ca lista). Se monteaza doar pentru admin, ca alt rol sa nu loveasca API-ul de patru ori.
function TabCount({ filter }: { filter: AdminRequestFilter }) {
  const total = useAdminRequests(filter, 1).data?.total;
  if (total === undefined) return null;
  return <span className="ml-1.5 font-mono text-xs tracking-normal">{total}</span>;
}

// E-admin-platform-3 — proiectele acceptate: in lucru, cu caz raportat, intarziate.
// Detaliul (/admin/requests/[id]) are cronologia, creditele si inchiderea auditata.
export default function AdminRequestsPage() {
  const t = useTranslations('Admin.requests');
  const tr = useTranslations('Requests');
  const format = useFormatter();
  const router = useRouter();
  const me = useMe();
  const [filter, setFilter] = useState<AdminRequestFilter>('accepted');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const list = useAdminRequests(filter, page);
  const isAdmin = me.data?.role === 'ADMIN';

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  const fmtDate = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: 'medium' }) : '—');
  const fmtDay = (d: string | null) =>
    d ? format.dateTime(new Date(`${d}T12:00:00`), { dateStyle: 'medium' }) : '—';

  // endpoint-ul nu are parametru de cautare: filtram randurile paginii incarcate
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const items = list.data?.items ?? [];
    if (!q) return items;
    return items.filter((r) =>
      [r.title, r.clientName, r.winnerCompanyName].some((v) => !!v && v.toLowerCase().includes(q)),
    );
  }, [list.data, q]);

  return (
    <div className="flex w-full max-w-[1180px] flex-col gap-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* wrap-reverse: pe ecran ingust cautarea urca deasupra, iar taburile raman lipite de linie
          (cu wrap-reverse, items-start inseamna aliniere la baza randului) */}
      <div className="flex flex-wrap-reverse items-start justify-between gap-x-6 gap-y-3 border-b border-border">
        <Tabs
          panelId="admin-requests-results"
          label={t('title')}
          current={filter}
          onChange={(v) => {
            setFilter(v as AdminRequestFilter);
            setPage(1);
          }}
          className="mb-0 flex-wrap border-b-0"
          tabs={ADMIN_REQUEST_FILTERS.map((v) => ({
            value: v,
            label: (
              <>
                {t(`filter.${v}`)}
                {isAdmin && <TabCount filter={v} />}
              </>
            ),
          }))}
        />
        <SearchBox
          value={query}
          onChange={setQuery}
          label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
          className="mb-2"
        />
      </div>

      <div
        id="admin-requests-results"
        role="tabpanel"
        aria-labelledby={`admin-requests-results-tab-${filter}`}
        tabIndex={0}
        className="flex flex-col gap-4"
      >
        {list.isPending && <SkeletonTable rows={6} cols={6} />}
        {list.isError && <LoadError title={t('loadError')} onRetry={() => void list.refetch()} />}
        {list.isSuccess && list.data.items.length === 0 && (
          <EmptyState variant="card" size="sm" title={t('empty')} />
        )}
        {list.isSuccess && list.data.items.length > 0 && rows.length === 0 && (
          <EmptyState
            variant="card"
            size="sm"
            title={t('noMatch')}
            action={
              <Button variant="outline" size="lg" onClick={() => setQuery('')}>
                {t('clearSearch')}
              </Button>
            }
          />
        )}
        {list.data && rows.length > 0 && (
          <Card padding="none" className="overflow-hidden">
            <Table className="min-w-[880px]">
              <THead>
                <TR>
                  <TH scope="col" className="bg-surface-2">{t('col.title')}</TH>
                  <TH scope="col" className="bg-surface-2">{t('col.flags')}</TH>
                  <TH scope="col" className="bg-surface-2">{t('col.status')}</TH>
                  <TH scope="col" className="bg-surface-2">{t('col.parties')}</TH>
                  <TH scope="col" className="bg-surface-2">{t('col.deliveryDate')}</TH>
                  <TH scope="col" className="bg-surface-2">
                    <span className="sr-only">{t('col.actions')}</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => {
                  const title = r.title || tr('untitled');
                  const lateDays = r.overdue && r.deliveryDate ? daysSinceDateOnly(r.deliveryDate) : 0;
                  return (
                    <TR key={r.id}>
                      <TD className="align-middle">
                        <Link href={`/admin/requests/${r.id}`} className="font-semibold text-foreground hover:underline">
                          {title}
                        </Link>
                        {r.acceptedAt && (
                          <div className="data-mono text-muted-foreground">
                            {t('acceptedOn', { date: fmtDate(r.acceptedAt) })}
                          </div>
                        )}
                      </TD>
                      <TD className="align-middle">
                        <div className="flex flex-wrap gap-1.5">
                          {r.openCase && (
                            <Pill tone="amber" strong>
                              {t('flag.openCase')}
                            </Pill>
                          )}
                          {r.overdue && (
                            <Pill tone="crimson" strong>
                              {t('flag.overdue')}
                            </Pill>
                          )}
                        </div>
                      </TD>
                      <TD className="align-middle">
                        <CodeUnder code={r.status}>
                          <StatusBadge status={r.status} label={tr(`statusValue.${r.status}`)} />
                        </CodeUnder>
                      </TD>
                      <TD className="align-middle">
                        <div>{r.clientName ?? '—'}</div>
                        <div className="text-ui text-muted-foreground">{r.winnerCompanyName ?? '—'}</div>
                      </TD>
                      <TD
                        className={cn(
                          'data-mono whitespace-nowrap align-middle',
                          r.overdue ? 'text-crimson' : 'text-muted-foreground',
                        )}
                      >
                        {fmtDay(r.deliveryDate)}
                        {lateDays > 0 && <> · {t('overdueBy', { days: lateDays })}</>}
                      </TD>
                      <TD className="text-right align-middle">
                        <Button asChild variant="outline" size="lg">
                          <Link href={`/admin/requests/${r.id}`} aria-label={`${t('open')} — ${title}`}>
                            {t('open')}
                          </Link>
                        </Button>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>
        )}
        {list.data && list.data.items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* cautarea vede doar pagina incarcata; o spunem cand mai sunt si alte pagini */}
            <p className="text-xs text-muted-foreground">{q && pages > 1 ? t('searchPageOnly') : null}</p>
            <ListPager summary={t('pageOf', { page, pages })} page={page} pages={pages} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
