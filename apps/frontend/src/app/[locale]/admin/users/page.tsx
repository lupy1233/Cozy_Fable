'use client';

import type { AdminUserItemDto } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAdminUsers, useBlockUser } from '@/hooks/use-admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
      <h1 className="page-title">{t('title')}</h1>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="max-w-xs"
        />
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={
              r === role
                ? 'rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background'
                : 'rounded-full border border-border-2 bg-surface px-3 py-1.5 text-xs transition-colors hover:bg-secondary'
            }
          >
            {t(`roleFilter.${r}`)}
          </button>
        ))}
      </div>

      {users.isPending && <p className="py-10 text-center text-muted-foreground">…</p>}
      {users.isError && <p className="py-10 text-center text-sm text-crimson">{t('loadError')}</p>}
      {users.isSuccess && users.data.length === 0 && (
        <p className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      )}

      {users.isSuccess && users.data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
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
        </div>
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
