'use client';

import type { AdminCompanyListItemDto } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useAdminCompanies } from '@/hooks/use-company';
import { useRelativeTime } from '@/lib/relative-time';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips } from '@/components/ui/filter-chips';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError, QueryState } from '@/components/ui/query-state';
import { SkeletonPage, SkeletonTable } from '@/components/ui/skeleton';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { CompanyStatusBadge, RiskFlagPills } from '../_components/company-status';
import { ListPager, SearchBox, pageSlice } from '../_components/core-list-parts';

const STATUSES = [
  { key: '', label: 'filterAll' },
  { key: 'PENDING_VERIFICATION', label: 'filterPending' },
  { key: 'APPROVED', label: 'filterApproved' },
  { key: 'REJECTED', label: 'filterRejected' },
  { key: 'SUSPENDED', label: 'filterSuspended' },
] as const;

const PAGE_SIZE = 20;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Cele care asteapta o decizie stau sus, de la cea mai veche; restul raman in ordinea
// serverului (cele mai noi intai).
function pendingFirst(rows: AdminCompanyListItemDto[]): AdminCompanyListItemDto[] {
  const pending = rows
    .filter((c) => c.status === 'PENDING_VERIFICATION')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return [...pending, ...rows.filter((c) => c.status !== 'PENDING_VERIFICATION')];
}

const compact = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export default function AdminCompaniesPage() {
  const t = useTranslations('AdminCompanies');
  const tList = useTranslations('Admin.list');
  const format = useFormatter();
  const relative = useRelativeTime();
  const router = useRouter();
  const me = useMe();
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  // filtrul de status merge la server (parametrul existent); cautarea si paginarea se fac
  // pe client, peste randurile incarcate (endpoint-ul nu are parametri pentru ele)
  const list = useAdminCompanies(status || undefined);
  // contoarele pastilelor: lista nefiltrata (aceeasi cerere ca „Toate”, deci din cache cand e activa)
  const all = useAdminCompanies(undefined);

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  const counts = useMemo(() => {
    if (!all.data) return null;
    const byStatus: Record<string, number> = {};
    for (const c of all.data) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    return { total: all.data.length, byStatus };
  }, [all.data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = pendingFirst(list.data ?? []);
    if (!q) return sorted;
    return sorted.filter((c) => c.name.toLowerCase().includes(q) || compact(c.cui).includes(compact(q)));
  }, [list.data, query]);

  if (me.isPending || me.data?.role !== 'ADMIN') {
    return (
      <QueryState pending onRetry={() => void me.refetch()} skeleton={<SkeletonPage variant="table" />} />
    );
  }

  const paged = pageSlice(rows, page, PAGE_SIZE);
  const fmtCreated = (iso: string) => {
    const d = new Date(iso);
    // inscrierile recente se citesc mai usor relativ („acum 2 zile”); cele vechi, ca data
    return Date.now() - d.getTime() < WEEK_MS ? relative(d) : format.dateTime(d, { dateStyle: 'medium' });
  };

  return (
    <div className="flex w-full max-w-[1180px] flex-col gap-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <FilterChips
          label={t('filterLabel')}
          value={status}
          onChange={(v) => {
            setStatus(v ?? '');
            setPage(1);
          }}
          className="[&>button]:min-h-10"
          options={STATUSES.map((s) => ({
            value: s.key as string,
            label: t(s.label),
            count: counts ? (s.key === '' ? counts.total : (counts.byStatus[s.key] ?? 0)) : undefined,
          }))}
        />
        <SearchBox
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
        />
      </div>

      {list.isPending && <SkeletonTable rows={6} cols={6} />}
      {list.isError && <LoadError onRetry={() => void list.refetch()} />}

      {list.isSuccess && rows.length === 0 && (
        <EmptyState
          variant="card"
          size="sm"
          title={query.trim() ? t('noMatch') : t('empty')}
          action={
            query.trim() ? (
              <Button variant="outline" size="lg" onClick={() => setQuery('')}>
                {t('clearSearch')}
              </Button>
            ) : undefined
          }
        />
      )}

      {list.isSuccess && rows.length > 0 && (
        <>
          <Card padding="none" className="overflow-hidden">
            <Table className="min-w-[860px]">
              <THead>
                <TR>
                  <TH scope="col" className="bg-surface-2">{t('name')}</TH>
                  <TH scope="col" className="bg-surface-2">{t('city')}</TH>
                  <TH scope="col" className="bg-surface-2">{t('status')}</TH>
                  <TH scope="col" className="bg-surface-2">{t('riskFlags')}</TH>
                  <TH scope="col" className="bg-surface-2">{t('registered')}</TH>
                  <TH scope="col" className="bg-surface-2">
                    <span className="sr-only">{t('actions')}</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {paged.items.map((c) => {
                  const pending = c.status === 'PENDING_VERIFICATION';
                  return (
                    <TR key={c.id}>
                      <TD className="align-middle">
                        <Link href={`/admin/companies/${c.id}`} className="font-semibold text-foreground hover:underline">
                          {c.name}
                        </Link>
                        <div className="data-mono text-muted-foreground">
                          {t('cui')} {c.cui}
                        </div>
                      </TD>
                      <TD className="align-middle">
                        {c.city}, {c.county}
                      </TD>
                      <TD className="align-middle">
                        <CompanyStatusBadge status={c.status} />
                      </TD>
                      <TD className="align-middle">
                        <RiskFlagPills flags={c.riskFlags} />
                      </TD>
                      <TD className="data-mono whitespace-nowrap align-middle text-muted-foreground">
                        <time dateTime={c.createdAt} title={format.dateTime(new Date(c.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}>
                          {fmtCreated(c.createdAt)}
                        </time>
                      </TD>
                      <TD className="text-right align-middle">
                        {/* firma in asteptare = randul cere o decizie → butonul plin; restul doar se consulta */}
                        <Button asChild variant={pending ? 'default' : 'outline'} size="lg">
                          <Link
                            href={`/admin/companies/${c.id}`}
                            aria-label={`${pending ? t('verify') : t('view')} — ${c.name}`}
                          >
                            {pending ? t('verify') : t('view')}
                          </Link>
                        </Button>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>

          <ListPager
            summary={tList('range', { from: paged.from, to: paged.to, total: rows.length })}
            page={paged.current}
            pages={paged.pages}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
