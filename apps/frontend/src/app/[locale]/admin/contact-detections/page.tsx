'use client';

import {
  CONTACT_DETECTION_ACTIONS,
  CONTACT_MATCH_KINDS,
  type ContactDetectionAction,
  type ContactMatchKind,
} from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Link } from '@/i18n/routing';
import { useContactDetections } from '@/hooks/use-admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError } from '@/components/ui/query-state';
import { Select } from '@/components/ui/select';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

// E-admin-platform-45 (F2-16): telefoane/emailuri/linkuri gasite in textele libere ale
// cererilor la publicare/editare. Lista read-only; fragmentele vin partial ascunse de server.
const ACTION_TONE = {
  MASKED: 'sage',
  BLOCKED: 'crimson',
  TITLE_REPLACED: 'amber',
  FLAGGED: 'muted',
} as const;

export default function AdminContactDetectionsPage() {
  const t = useTranslations('Admin.contactDetections');
  const ta = useTranslations('Admin');
  const tr = useTranslations('Requests');
  const format = useFormatter();
  const [page, setPage] = useState(1);
  // API-ul are doar paginare → filtrele se aplica pe client, peste pagina incarcata
  const [kind, setKind] = useState<ContactMatchKind | ''>('');
  const [action, setAction] = useState<ContactDetectionAction | ''>('');
  const list = useContactDetections(page);
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  const items = list.data?.items;
  const rows = useMemo(
    () => (items ?? []).filter((d) => (!kind || d.kinds.includes(kind)) && (!action || d.action === action)),
    [items, kind, action],
  );
  const filtered = kind !== '' || action !== '';
  const clearFilters = () => {
    setKind('');
    setAction('');
  };

  return (
    <div className="flex w-full max-w-[1180px] flex-col gap-6">
      <PageHeader title={t('title')} subtitle={<span className="block max-w-3xl text-lead">{t('hint')}</span>} />

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <Field label={t('col.kinds')} className="w-full sm:w-48">
          <Select className="h-11" value={kind} onChange={(e) => setKind(e.target.value as ContactMatchKind | '')}>
            <option value="">{t('filter.allKinds')}</option>
            {CONTACT_MATCH_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('col.action')} className="w-full sm:w-56">
          <Select
            className="h-11"
            value={action}
            onChange={(e) => setAction(e.target.value as ContactDetectionAction | '')}
          >
            <option value="">{t('filter.allActions')}</option>
            {CONTACT_DETECTION_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`actions.${a}`)}
              </option>
            ))}
          </Select>
        </Field>
        {list.data && (
          <span className="inline-flex h-11 items-center font-mono text-xs text-muted-foreground sm:ml-auto">
            {t('total', { n: list.data.total })}
          </span>
        )}
      </div>
      {filtered && items && items.length > 0 && (
        <p className="-mt-3 text-xs text-muted-foreground">
          {t('filter.pageNote', { shown: rows.length, loaded: items.length })}
        </p>
      )}

      {list.isPending && <SkeletonTable rows={6} cols={5} />}
      {list.isError && <LoadError title={t('loadError')} onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.items.length === 0 && <EmptyState variant="card" size="sm" title={t('empty')} />}
      {list.isSuccess && list.data.items.length > 0 && rows.length === 0 && (
        <EmptyState
          variant="card"
          size="sm"
          title={t('filter.emptyFiltered')}
          action={
            <Button variant="outline" size="sm" onClick={clearFilters}>
              {t('filter.clear')}
            </Button>
          }
        />
      )}

      {rows.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <Table className="min-w-[860px] [&_th]:bg-surface-2">
            <THead>
              <TR>
                <TH scope="col">{t('col.when')}</TH>
                <TH scope="col">{t('col.request')}</TH>
                <TH scope="col">{t('col.where')}</TH>
                <TH scope="col">{t('col.found')}</TH>
                <TH scope="col">{t('col.done')}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((d) => {
                const title = d.requestTitle || tr('untitled');
                return (
                  <TR key={d.id}>
                    <TD className="whitespace-nowrap">
                      <span className="block font-mono text-xs">
                        {format.dateTime(new Date(d.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                      <span className="block text-xs text-muted-foreground">{t(`moment.${d.trigger}`)}</span>
                    </TD>
                    <TD className="min-w-48">
                      {d.requestDeleted ? (
                        <span className="font-semibold">{title}</span>
                      ) : (
                        <Link
                          href={`/admin/requests/${d.requestId}`}
                          className="font-semibold underline-offset-4 hover:text-walnut hover:underline"
                        >
                          {title}
                        </Link>
                      )}
                      <span className="block text-xs text-muted-foreground">
                        {tr(`statusValue.${d.requestStatus}`)}
                        {d.requestDeleted && (
                          <>
                            {' · '}
                            <span className="text-crimson">{t('deleted')}</span>
                          </>
                        )}
                      </span>
                    </TD>
                    <TD>
                      {t(`fields.${d.field}`)}
                      {d.stepId && <span className="block font-mono text-meta text-muted-2">{d.stepId}</span>}
                    </TD>
                    <TD>
                      <span className="flex flex-wrap gap-1">
                        {d.kinds.map((k) => (
                          <span
                            key={k}
                            className="rounded-full border border-border-2 px-2 py-px text-xs text-muted-foreground"
                          >
                            {t(`kinds.${k}`)}
                          </span>
                        ))}
                      </span>
                      <span className="mt-1.5 block max-w-md whitespace-pre-wrap font-mono text-xs [overflow-wrap:anywhere]">
                        {d.excerpt}
                      </span>
                    </TD>
                    <TD>
                      <Badge tone={ACTION_TONE[d.action] ?? 'muted'} dot>
                        {t(`actions.${d.action}`)}
                      </Badge>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}

      {list.data && (totalPages > 1 || page > 1) && (
        <nav aria-label={ta('list.pagination')} className="flex flex-wrap items-center justify-end gap-3">
          <span className="data-mono text-muted-foreground" aria-live="polite">
            {ta('requests.pageOf', { page, pages: totalPages })}
          </span>
          <Button variant="outline" size="lg" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            {ta('list.prev')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            {ta('list.next')}
          </Button>
        </nav>
      )}
    </div>
  );
}
