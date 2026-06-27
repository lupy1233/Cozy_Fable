'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAuditLogs } from '@/hooks/use-admin';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';

export default function AdminAuditPage() {
  const t = useTranslations('Admin');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const logs = useAuditLogs(page, action ? { action } : {});
  const totalPages = logs.data ? Math.max(1, Math.ceil(logs.data.total / logs.data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="page-title">{t('nav.audit')}</h1>
      <Input
        value={action}
        onChange={(e) => {
          setAction(e.target.value);
          setPage(1);
        }}
        placeholder={t('audit.filterAction')}
        className="w-64"
      />
      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <Table>
          <THead>
            <TR>
              <TH>{t('audit.action')}</TH>
              <TH>{t('audit.entity')}</TH>
              <TH>{t('audit.role')}</TH>
              <TH>{t('audit.date')}</TH>
            </TR>
          </THead>
          <TBody>
            {logs.data?.items.map((a) => (
              <TR key={a.id}>
                <TD className="font-medium">{a.action}</TD>
                <TD className="text-muted-foreground">{a.entityType ?? '—'}</TD>
                <TD className="text-muted-foreground">{a.role ?? '—'}</TD>
                <TD className="text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          ←
        </Button>
        <span className="font-mono text-xs text-muted-foreground">
          {page} / {totalPages} · {logs.data?.total ?? 0}
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
    </div>
  );
}
