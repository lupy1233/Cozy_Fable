'use client';

import type { AdminUserItemDto } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAdminUsers, useBlockUser } from '@/hooks/use-admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips } from '@/components/ui/filter-chips';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError } from '@/components/ui/query-state';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Pasul 6 (audit 2026-08-23, D-L1-2): management utilizatori — cautare, filtrare pe rol,
// blocare (cu confirmare; revoca sesiunile + email) si deblocare. Adminii nu pot fi blocati.
const ROLES = ['ALL', 'CLIENT', 'COMPANY_USER', 'ADMIN'] as const;

export default function AdminUsersPage() {
  const t = useTranslations('AdminUsers');
  const [q, setQ] = useState('');
  const [role, setRole] = useState<(typeof ROLES)[number]>('ALL');
  const users = useAdminUsers(q, role === 'ALL' ? undefined : role);
  const blockUser = useBlockUser();
  const [toBlock, setToBlock] = useState<AdminUserItemDto | null>(null);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title={t('title')} />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="max-w-xs"
        />
        <FilterChips
          label={t('roleFilterLabel')}
          size="sm"
          value={role}
          onChange={(v) => v && setRole(v)}
          options={ROLES.map((r) => ({ value: r, label: t(`roleFilter.${r}`) }))}
        />
      </div>

      {users.isPending && <SkeletonTable rows={6} cols={5} />}
      {users.isError && <LoadError title={t('loadError')} onRetry={() => void users.refetch()} />}
      {users.isSuccess && users.data.length === 0 && (
        <EmptyState variant="card" size="sm" title={t('empty')} />
      )}

      {users.isSuccess && users.data.length > 0 && (
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">{t('colUser')}</th>
                <th className="px-4 py-2.5">{t('colRole')}</th>
                <th className="px-4 py-2.5">{t('colCompany')}</th>
                <th className="px-4 py-2.5">{t('colStatus')}</th>
                <th className="px-4 py-2.5 text-right">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{u.name}</span>
                    <span className="block text-xs text-muted-foreground">{u.email}</span>
                  </td>
                  <td className="px-4 py-2.5">{t(`role.${u.role}`)}</td>
                  <td className="px-4 py-2.5">{u.companyName ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    {u.blockedAt ? (
                      <Badge tone="crimson" dot>{t('blocked')}</Badge>
                    ) : u.emailVerified ? (
                      <Badge tone="sage" dot>{t('active')}</Badge>
                    ) : (
                      <Badge tone="amber" dot>{t('unverified')}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {u.role !== 'ADMIN' &&
                      (u.blockedAt ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => blockUser.mutate({ id: u.id, block: false })}
                          disabled={blockUser.isPending}
                        >
                          {t('unblock')}
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setToBlock(u)}
                          disabled={blockUser.isPending}
                        >
                          {t('block')}
                        </Button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {blockUser.isError && <p className="text-sm text-crimson">{t('actionError')}</p>}

      <Dialog open={toBlock !== null} onOpenChange={(open) => { if (!open) setToBlock(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('blockConfirmTitle', { name: toBlock?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('blockConfirmBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToBlock(null)}>
              {t('blockCancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={blockUser.isPending}
              onClick={() => {
                if (!toBlock) return;
                blockUser.mutate(
                  { id: toBlock.id, block: true },
                  { onSuccess: () => setToBlock(null) },
                );
              }}
            >
              {t('blockConfirmCta')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
