'use client';

import type { AdminUserItemDto } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { CodeUnder, ListPager, SearchBox, pageSlice } from '../_components/core-list-parts';

// Pasul 6 (audit 2026-08-23, D-L1-2): management utilizatori — cautare, filtrare pe rol,
// blocare (cu confirmare; revoca sesiunile + email) si deblocare. Adminii nu pot fi blocati.
const ROLES = ['ALL', 'CLIENT', 'COMPANY_USER', 'ADMIN'] as const;

const PAGE_SIZE = 25;
// GET /admin/users intoarce cel mult atatea conturi (cele mai noi intai), fara total
const SERVER_LIST_CAP = 100;

type PendingAction = { user: AdminUserItemDto; block: boolean };

export default function AdminUsersPage() {
  const t = useTranslations('AdminUsers');
  const tList = useTranslations('Admin.list');
  const format = useFormatter();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<(typeof ROLES)[number]>('ALL');
  const [page, setPage] = useState(1);
  // cautarea si rolul merg la server (parametrii existenti); paginarea e pe client
  const users = useAdminUsers(q, role === 'ALL' ? undefined : role);
  const blockUser = useBlockUser();
  // blocarea SI deblocarea cer confirmare; `action` ramane setat in animatia de inchidere
  const [action, setAction] = useState<PendingAction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const askConfirm = (user: AdminUserItemDto, block: boolean) => {
    blockUser.reset();
    setAction({ user, block });
    setConfirmOpen(true);
  };

  const rows = users.data ?? [];
  const paged = pageSlice(rows, page, PAGE_SIZE);
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium' });

  return (
    <div className="flex w-full max-w-[1180px] flex-col gap-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
          className="sm:w-auto sm:max-w-[420px] sm:flex-[1_1_320px]"
        />
        <FilterChips
          label={t('roleFilterLabel')}
          value={role}
          onChange={(v) => {
            if (!v) return;
            setRole(v);
            setPage(1);
          }}
          className="[&>button]:min-h-10"
          options={ROLES.map((r) => ({ value: r, label: t(`roleFilter.${r}`) }))}
        />
      </div>

      {users.isPending && <SkeletonTable rows={6} cols={6} />}
      {users.isError && <LoadError title={t('loadError')} onRetry={() => void users.refetch()} />}
      {users.isSuccess && rows.length === 0 && <EmptyState variant="card" size="sm" title={t('empty')} />}

      {users.isSuccess && rows.length > 0 && (
        <>
          <Card padding="none" className="overflow-hidden">
            <Table className="min-w-[860px]">
              <THead>
                <TR>
                  <TH scope="col" className="bg-surface-2">{t('colUser')}</TH>
                  <TH scope="col" className="bg-surface-2">{t('colRole')}</TH>
                  <TH scope="col" className="bg-surface-2">{t('colCompany')}</TH>
                  <TH scope="col" className="bg-surface-2">{t('colStatus')}</TH>
                  <TH scope="col" className="bg-surface-2">{t('colRegistered')}</TH>
                  <TH scope="col" className="bg-surface-2 text-right">{t('colActions')}</TH>
                </TR>
              </THead>
              <TBody>
                {paged.items.map((u) => (
                  <TR key={u.id}>
                    <TD className="align-middle">
                      <div className="font-semibold">{u.name}</div>
                      <div className="break-all text-ui text-muted-foreground">{u.email}</div>
                    </TD>
                    <TD className="align-middle">
                      <CodeUnder code={u.role}>
                        <span>{t(`role.${u.role}`)}</span>
                      </CodeUnder>
                    </TD>
                    <TD className={u.companyName ? 'align-middle' : 'align-middle text-muted-foreground'}>
                      {u.companyName ?? '—'}
                    </TD>
                    <TD className="align-middle">
                      {u.blockedAt ? (
                        <span className="inline-flex flex-col items-start gap-1">
                          <Badge tone="crimson" dot>{t('blocked')}</Badge>
                          <span className="data-mono text-muted-foreground">
                            {t('blockedSince', { date: date(u.blockedAt) })}
                          </span>
                        </span>
                      ) : u.emailVerified ? (
                        <Badge tone="sage" dot>{t('active')}</Badge>
                      ) : (
                        <Badge tone="amber" dot>{t('unverified')}</Badge>
                      )}
                    </TD>
                    <TD className="data-mono whitespace-nowrap align-middle text-muted-foreground">
                      <time dateTime={u.createdAt}>{date(u.createdAt)}</time>
                    </TD>
                    <TD className="text-right align-middle">
                      {u.role !== 'ADMIN' &&
                        (u.blockedAt ? (
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => askConfirm(u, false)}
                            disabled={blockUser.isPending}
                            aria-label={`${t('unblock')} — ${u.name}`}
                          >
                            {t('unblockOpen')}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="lg"
                            className="border-crimson/40 text-crimson hover:border-crimson hover:bg-crimson-soft"
                            onClick={() => askConfirm(u, true)}
                            disabled={blockUser.isPending}
                            aria-label={`${t('block')} — ${u.name}`}
                          >
                            {t('blockOpen')}
                          </Button>
                        ))}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {rows.length >= SERVER_LIST_CAP ? t('capNote', { count: SERVER_LIST_CAP }) : null}
            </p>
            <ListPager
              summary={tList('range', { from: paged.from, to: paged.to, total: rows.length })}
              page={paged.current}
              pages={paged.pages}
              onPage={setPage}
            />
          </div>
        </>
      )}
      {blockUser.isError && !confirmOpen && (
        <p role="alert" className="text-sm text-crimson">
          {t('actionError')}
        </p>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !blockUser.isPending) setConfirmOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action?.block === false
                ? t('unblockConfirmTitle', { name: action.user.name })
                : t('blockConfirmTitle', { name: action?.user.name ?? '' })}
            </DialogTitle>
            <DialogDescription>
              {action?.block === false ? t('unblockConfirmBody') : t('blockConfirmBody')}
            </DialogDescription>
          </DialogHeader>
          {blockUser.isError && (
            <p role="alert" className="text-sm text-crimson">
              {t('actionError')}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setConfirmOpen(false)} disabled={blockUser.isPending}>
              {t('blockCancel')}
            </Button>
            <Button
              variant={action?.block === false ? 'default' : 'destructive'}
              size="lg"
              disabled={blockUser.isPending}
              onClick={() => {
                if (!action) return;
                blockUser.mutate(
                  { id: action.user.id, block: action.block },
                  { onSuccess: () => setConfirmOpen(false) },
                );
              }}
            >
              {action?.block === false ? t('unblockConfirmCta') : t('blockConfirmCta')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
