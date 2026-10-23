'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useMyClaims } from '@/hooks/use-marketplace';
import { useThreads } from '@/hooks/use-chat';
import { useRealtimeSync } from '@/hooks/use-socket';
import { StatusBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { QueryState } from '@/components/ui/query-state';
import { SkeletonPage, SkeletonTable } from '@/components/ui/skeleton';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { useNow } from '@/hooks/use-now';
import { useRelativeTime } from '@/lib/relative-time';
import { slaPhase, useSlaDateFormat } from '@/lib/sla-deadline';
import { AccessBlocked } from '../_components/access-blocked';

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
  const fmtSla = useSlaDateFormat();
  // E-company-13: culoarea termenului (chihlimbar / rosu) avanseaza fara reload
  const now = useNow(60_000);
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
    return <QueryState pending onRetry={() => void me.refetch()} skeleton={<SkeletonPage variant="table" />} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: '/marketplace', label: t('back') }}
        title={t('myClaims.title')}
        subtitle={t('myClaims.subtitle')}
      />

      {claims.isPending && <SkeletonTable rows={5} cols={7} />}
      {claims.isError && <AccessBlocked error={claims.error} onRetry={() => void claims.refetch()} />}
      {claims.isSuccess && claims.data.length === 0 && (
        <EmptyState variant="card" title={t('myClaims.empty')} />
      )}

      {claims.data && claims.data.length > 0 && (
        <Card padding="none">
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
                          title={t('myClaims.newMessages', { n: unreadByClaim.get(c.id) ?? 0 })}
                          className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-crimson px-1 text-micro font-bold leading-none text-white"
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
                  <TD className={'whitespace-nowrap text-xs ' + slaCellClass(c, now)}>
                    {c.status === 'ACTIVE' && c.slaDeadlineAt ? (
                      <>
                        {fmtSla(c.slaDeadlineAt)}
                        {c.slaPaused && ` · ${t('myClaims.slaPaused')}`}
                      </>
                    ) : (
                      '—'
                    )}
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
        </Card>
      )}
    </div>
  );
}

// E-company-13: SLA doar pe preluarile ACTIVE (dupa oferta nu mai conteaza). Lista nu are
// momentul penalizarii, deci aici nu exista numaratoare de gratie: doar culoarea.
function slaCellClass(
  c: { status: string; slaDeadlineAt: string | null; slaPaused: boolean },
  now: number,
): string {
  if (c.status !== 'ACTIVE' || !c.slaDeadlineAt || c.slaPaused) return 'text-muted-foreground';
  const phase = slaPhase(c.slaDeadlineAt, null, now);
  if (phase === 'SOON') return 'text-amber';
  if (phase === 'GRACE' || phase === 'BREACHED') return 'text-crimson';
  return 'text-muted-foreground';
}
