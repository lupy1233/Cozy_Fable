'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useContactDetections } from '@/hooks/use-admin';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError } from '@/components/ui/query-state';
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
  const tr = useTranslations('Requests');
  const [page, setPage] = useState(1);
  const list = useContactDetections(page);
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('title')} subtitle={t('hint')} />

      {list.isPending && <SkeletonTable rows={6} cols={7} />}
      {list.isError && <LoadError title={t('loadError')} onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.items.length === 0 && (
        <EmptyState variant="card" size="sm" title={t('empty')} />
      )}

      {list.data && list.data.items.length > 0 && (
        <>
          <Card padding="none" className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{t('col.date')}</TH>
                  <TH>{t('col.request')}</TH>
                  <TH>{t('col.field')}</TH>
                  <TH>{t('col.kinds')}</TH>
                  <TH>{t('col.excerpt')}</TH>
                  <TH>{t('col.action')}</TH>
                  <TH>{t('col.trigger')}</TH>
                </TR>
              </THead>
              <TBody>
                {list.data.items.map((d) => (
                  <TR key={d.id}>
                    <TD className="whitespace-nowrap text-muted-foreground">
                      {new Date(d.createdAt).toLocaleString()}
                    </TD>
                    <TD className="min-w-48">
                      <div className="font-medium">{d.requestTitle || '—'}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <StatusBadge status={d.requestStatus} label={tr(`statusValue.${d.requestStatus}`)} />
                        {d.requestDeleted && <Badge tone="crimson">{t('deleted')}</Badge>}
                      </div>
                    </TD>
                    <TD className="text-muted-foreground">
                      {t(`fields.${d.field}`)}
                      {d.stepId && <div className="font-mono text-meta text-muted-2">{d.stepId}</div>}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {d.kinds.map((k) => (
                          <Badge key={k} tone="outline">
                            {t(`kinds.${k}`)}
                          </Badge>
                        ))}
                      </div>
                    </TD>
                    <TD className="max-w-md whitespace-pre-wrap break-words font-mono text-xs">{d.excerpt}</TD>
                    <TD>
                      <Badge tone={ACTION_TONE[d.action] ?? 'muted'}>{t(`actions.${d.action}`)}</Badge>
                    </TD>
                    <TD className="text-muted-foreground">{t(`triggers.${d.trigger}`)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
          <div className="flex items-center gap-3 text-sm">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              ←
            </Button>
            <span className="font-mono text-xs text-muted-foreground">
              {page} / {totalPages} · {list.data.total}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
