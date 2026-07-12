'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useMyClaims } from '@/hooks/use-marketplace';
import { useThreads } from '@/hooks/use-chat';
import { useRealtimeSync } from '@/hooks/use-socket';
import { StatusBadge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { useRelativeTime } from '@/lib/relative-time';

// Pagina dedicata claim-urilor firmei (mutata din wallet): cine a preluat,
// cui e atribuit, cand, in ce stadiu e si linkuri catre oferta/cerere.
export default function CompanyClaimsPage() {
  const t = useTranslations('Marketplace');
  const tr = useTranslations('Requests');
  const router = useRouter();
  const me = useMe();
  const claims = useMyClaims();
  const threads = useThreads('company');
  const relTime = useRelativeTime();
  useRealtimeSync();

  // mesaje necitite per claim (idee 1 PO r2) — thread-ul e legat de claim slot
  const unreadByClaim = useMemo(
    () => new Map((threads.data ?? []).map((th) => [th.claimSlotId, th.unreadCount])),
    [threads.data],
  );

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'COMPANY_USER') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (me.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{t('myClaims.title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('myClaims.subtitle')}</p>
        </div>
        <Link href="/marketplace" className="text-sm text-walnut hover:underline">
          ← {t('back')}
        </Link>
      </div>

      {claims.isSuccess && claims.data.length === 0 && (
        <p className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-muted-foreground">
          {t('myClaims.empty')}
        </p>
      )}

      {claims.data && claims.data.length > 0 && (
        <div className="rounded-xl border border-border bg-surface shadow-sm">
          <Table>
            <THead>
              <TR>
                <TH>{t('myClaims.request')}</TH>
                <TH>{t('myClaims.claimedBy')}</TH>
                <TH>{t('myClaims.assignedTo')}</TH>
                <TH>{t('myClaims.when')}</TH>
                <TH>{t('myClaims.stage')}</TH>
                <TH>{t('myClaims.sla')}</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {claims.data.map((c) => (
                <TR key={c.id}>
                  <TD className="max-w-[220px]">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="truncate">{c.requestTitle || '—'}</span>
                      {(unreadByClaim.get(c.id) ?? 0) > 0 && (
                        <span
                          title={t('myClaims.newMessages', { n: unreadByClaim.get(c.id) })}
                          className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-crimson px-1 text-[10px] font-bold leading-none text-white"
                        >
                          {unreadByClaim.get(c.id)}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {tr(`sizeValue.${c.projectSizeSnapshot}`)} · {c.claimCostCreditsSnapshot}{' '}
                      {t('credits')}
                    </span>
                  </TD>
                  <TD>{c.claimedByName ?? '—'}</TD>
                  <TD>
                    {c.assignedToName ?? (
                      <span className="text-amber">{t('myClaims.unassigned')}</span>
                    )}
                  </TD>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {relTime(c.createdAt)}
                  </TD>
                  <TD>
                    <StatusBadge status={c.status} label={t(`claimStatus.${c.status}`)} />
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">
                    {c.slaDeadlineAt ? new Date(c.slaDeadlineAt).toLocaleString() : '—'}
                    {c.slaPaused && ` · ${t('myClaims.slaPaused')}`}
                  </TD>
                  <TD>
                    <div className="flex gap-3 whitespace-nowrap">
                      <Link
                        href={`/marketplace/claims/${c.id}`}
                        className="text-walnut hover:underline"
                      >
                        {t('manageOffer')}
                      </Link>
                      <Link
                        href={`/marketplace/${c.requestId}`}
                        className="text-muted-foreground hover:underline"
                      >
                        {t('view')}
                      </Link>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
