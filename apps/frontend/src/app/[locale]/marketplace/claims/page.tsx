'use client';

import type { ClaimSlotDto, ClaimSlotStatus } from '@marketplace/shared';
import { Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useMyCompany } from '@/hooks/use-company';
import { useMyClaims } from '@/hooks/use-marketplace';
import { useThreads } from '@/hooks/use-chat';
import { isFirmRules, useFirmRules } from '@/hooks/use-legal';
import { useRealtimeSync } from '@/hooks/use-socket';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips } from '@/components/ui/filter-chips';
import { PageHeader } from '@/components/ui/page-header';
import { QueryState } from '@/components/ui/query-state';
import { Select } from '@/components/ui/select';
import { SkeletonPage, SkeletonTable } from '@/components/ui/skeleton';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { useNow } from '@/hooks/use-now';
import { companyCan } from '@/lib/company-permissions';
import { useRelativeTime } from '@/lib/relative-time';
import { compareClaimUrgency, slaPhase, timeLeftUnits, useSlaDateFormat } from '@/lib/sla-deadline';
import { cn } from '@/lib/utils';
import { AccessBlocked } from '../_components/access-blocked';

// Pagina dedicata preluarilor firmei: cine a preluat, cui e atribuita, in ce stadiu e si
// cat mai e pana la termen. Design 2026-11 (canvas): filtre pe stadiu, numaratoare inversa
// pe termenul SLA, urgentele sus, un singur pas pe rand (fisa de lucru).
type Stage = 'toOffer' | 'offerSent' | 'closed';
type StageFilter = 'all' | Stage;
const STAGES: StageFilter[] = ['all', 'toOffer', 'offerSent', 'closed'];

const stageOf = (status: ClaimSlotStatus): Stage =>
  status === 'ACTIVE' ? 'toOffer' : status === 'OFFER_SENT' ? 'offerSent' : 'closed';

// filtrul "Atribuita lui": oricine / neatribuite / id-ul unui coleg
const ANY = 'ANY';
const NONE = 'NONE';

// Culoarea starii: nuc = in lucru la firma, albastru = asteapta clientul, cerneala =
// finalizata, carmin = termen ratat; restul (anulari, retrageri) raman gri.
type Tone = NonNullable<BadgeProps['tone']>;
const CLAIM_TONE: Partial<Record<ClaimSlotStatus, Tone>> = {
  ACTIVE: 'walnut',
  OFFER_SENT: 'info',
  COMPLETED: 'ink',
  SLA_EXPIRED: 'crimson',
};

const TH_CLASS = 'bg-surface-2 px-4 text-meta';
const TD_CLASS = 'px-4 align-middle';

export default function CompanyClaimsPage() {
  const t = useTranslations('Marketplace');
  const tr = useTranslations('Requests');
  const router = useRouter();
  const me = useMe();
  const claims = useMyClaims();
  const threads = useThreads('company');
  // cine poate atribui (OWNER/MANAGER) primeste pasul "Alege responsabilul"
  const company = useMyCompany(me.data?.role === 'COMPANY_USER');
  const firmRules = useFirmRules();
  const relTime = useRelativeTime();
  // E-company-13: numaratoarea si culoarea termenului avanseaza fara reload
  const now = useNow(30_000);
  useRealtimeSync();
  const [stage, setStage] = useState<StageFilter>('all');
  const [assignee, setAssignee] = useState<string>(ANY);

  const rules = isFirmRules(firmRules.data) ? firmRules.data : null;
  const canAssign = companyCan(company.data, 'CLAIMS_ASSIGN');

  // mesaje necitite per claim (idee 1 PO r2) — thread-ul e legat de claim slot
  const unreadByClaim = useMemo(
    () => new Map((threads.data ?? []).map((th) => [th.claimSlotId, th.unreadCount])),
    [threads.data],
  );

  // colegii care au preluari atribuite (pentru filtru), in ordine alfabetica
  const assignees = useMemo(() => {
    const byId = new Map<string, string>();
    for (const c of claims.data ?? []) {
      if (c.assignedToUserId && c.assignedToName) byId.set(c.assignedToUserId, c.assignedToName);
    }
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [claims.data]);
  const hasUnassigned = useMemo(
    () => (claims.data ?? []).some((c) => !c.assignedToUserId),
    [claims.data],
  );

  // responsabilul ingusteaza lista; numerele de pe pastile se calculeaza peste ea
  const scoped = useMemo(
    () =>
      (claims.data ?? []).filter((c) =>
        assignee === ANY ? true : assignee === NONE ? !c.assignedToUserId : c.assignedToUserId === assignee,
      ),
    [claims.data, assignee],
  );
  const counts = useMemo(() => {
    const n: Record<StageFilter, number> = { all: scoped.length, toOffer: 0, offerSent: 0, closed: 0 };
    for (const c of scoped) n[stageOf(c.status)] += 1;
    return n;
  }, [scoped]);
  // urgentele sus: fara responsabil, apoi termenul cel mai apropiat, apoi restul
  const rows = useMemo(
    () => scoped.filter((c) => stage === 'all' || stageOf(c.status) === stage).sort(compareClaimUrgency),
    [scoped, stage],
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
      <PageHeader title={t('myClaims.title')} subtitle={t('myClaims.subtitle')} />

      {claims.isPending && <SkeletonTable rows={5} cols={6} />}
      {claims.isError && <AccessBlocked error={claims.error} onRetry={() => void claims.refetch()} />}
      {claims.isSuccess && claims.data.length === 0 && (
        <EmptyState
          variant="card"
          icon={Inbox}
          title={t('myClaims.empty')}
          action={
            <Button asChild variant="walnut">
              <Link href="/marketplace">{t('myClaims.emptyCta')}</Link>
            </Button>
          }
        />
      )}

      {claims.data && claims.data.length > 0 && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <FilterChips
              label={t('myClaims.filterLabel')}
              value={stage}
              onChange={(v) => v && setStage(v)}
              options={STAGES.map((s) => ({ value: s, label: t(`myClaims.filter.${s}`), count: counts[s] }))}
              className="[&>button]:min-h-10"
            />
            <div className="flex flex-col gap-1">
              <label htmlFor="pr-who" className="text-xs text-muted-foreground">
                {t('myClaims.assignedTo')}
              </label>
              <Select
                id="pr-who"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="min-w-[180px]"
              >
                <option value={ANY}>{t('myClaims.assigneeAny')}</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                {hasUnassigned && <option value={NONE}>{t('myClaims.assigneeNone')}</option>}
              </Select>
            </div>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              variant="card"
              icon={Inbox}
              title={t('myClaims.emptyFiltered')}
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStage('all');
                    setAssignee(ANY);
                  }}
                >
                  {t('resetFilters')}
                </Button>
              }
            />
          ) : (
            <Card padding="none" className="overflow-hidden">
              <Table className="min-w-[920px]">
                <THead>
                  <TR>
                    <TH scope="col" className={TH_CLASS}>
                      {t('myClaims.request')}
                    </TH>
                    <TH scope="col" className={TH_CLASS}>
                      {t('myClaims.assignedTo')}
                    </TH>
                    <TH scope="col" className={TH_CLASS}>
                      {t('myClaims.stage')}
                    </TH>
                    <TH scope="col" className={TH_CLASS}>
                      {t('myClaims.sla')}
                    </TH>
                    <TH scope="col" className={TH_CLASS}>
                      {t('myClaims.claimed')}
                    </TH>
                    <TH scope="col" className={TH_CLASS}>
                      <span className="sr-only">{t('myClaims.actions')}</span>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((c) => {
                    const unread = unreadByClaim.get(c.id) ?? 0;
                    const active = c.status === 'ACTIVE';
                    const unassigned = !c.assignedToUserId;
                    const href = `/marketplace/claims/${c.id}`;
                    // un singur pas pe rand, dupa stare
                    const cta = active
                      ? unassigned
                        ? canAssign
                          ? 'assign'
                          : 'open'
                        : 'writeOffer'
                      : c.status === 'OFFER_SENT'
                        ? 'offerAndChat'
                        : 'open';
                    return (
                      <TR key={c.id}>
                        <TD className={cn(TD_CLASS, 'max-w-[280px]')}>
                          <div className="flex items-center gap-2">
                            <Link
                              href={href}
                              className="min-w-0 font-semibold text-foreground underline-offset-4 hover:text-walnut hover:underline"
                            >
                              {c.requestTitle || '—'}
                            </Link>
                            {unread > 0 && (
                              <span
                                title={t('myClaims.newMessages', { n: unread })}
                                className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-crimson px-1 font-mono text-meta leading-none text-primary-foreground"
                              >
                                <span aria-hidden>{unread}</span>
                                <span className="sr-only">{t('myClaims.newMessages', { n: unread })}</span>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {tr(`sizeValue.${c.projectSizeSnapshot}`)} ·{' '}
                            {t('availableCredits', { n: c.claimCostCreditsSnapshot })}
                          </div>
                        </TD>
                        <TD className={TD_CLASS}>
                          {c.assignedToName ??
                            (unassigned ? (
                              <span className={active ? 'font-semibold text-crimson' : 'text-muted-foreground'}>
                                {t('myClaims.unassigned')}
                              </span>
                            ) : (
                              '—'
                            ))}
                        </TD>
                        <TD className={TD_CLASS}>
                          <Badge tone={CLAIM_TONE[c.status] ?? 'muted'} dot>
                            {t(`claimStatus.${c.status}`)}
                          </Badge>
                        </TD>
                        <TD className={TD_CLASS}>
                          <SlaCell
                            claim={c}
                            now={now}
                            assignMinutes={rules?.claims.assignDeadlineMinutes ?? null}
                          />
                        </TD>
                        <TD className={TD_CLASS}>
                          <div>{c.claimedByName ?? '—'}</div>
                          <div className="data-mono whitespace-nowrap text-muted-foreground">
                            {relTime(c.createdAt)}
                          </div>
                        </TD>
                        <TD className={cn(TD_CLASS, 'whitespace-nowrap text-right')}>
                          <Button asChild variant={cta === 'assign' ? 'walnut' : 'outline'} size="lg">
                            <Link href={href}>{t(`myClaims.cta.${cta}`)}</Link>
                          </Button>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function SlaLines({
  primary,
  secondary,
  className,
}: {
  primary: string;
  secondary?: string | null;
  className?: string;
}) {
  return (
    <>
      <div className={className}>{primary}</div>
      {secondary && <div className="data-mono text-muted-foreground">{secondary}</div>}
    </>
  );
}

// E-company-13: termenul conteaza doar cat preluarea e ACTIVA (dupa oferta nu se mai aplica).
// Lista nu are nici momentul penalizarii, nici termenul de atribuire: dupa termen apare doar
// "depasit" (fara numaratoare de gratie), iar fara responsabil apare regula, nu un ceas.
function SlaCell({
  claim,
  now,
  assignMinutes,
}: {
  claim: ClaimSlotDto;
  now: number;
  assignMinutes: number | null;
}) {
  const t = useTranslations('Marketplace');
  const tu = useTranslations('Legal.firmRules.units');
  const fmtSla = useSlaDateFormat();
  const date = claim.slaDeadlineAt ? fmtSla(claim.slaDeadlineAt) : null;
  const dash = <span className="text-muted-foreground">—</span>;

  if (claim.status === 'OFFER_SENT') {
    return (
      <SlaLines
        primary={t('myClaims.slaOfferSent')}
        secondary={t('myClaims.slaNotApplicable')}
        className="text-muted-foreground"
      />
    );
  }
  if (claim.status === 'SLA_EXPIRED') {
    return <SlaLines primary={t('myClaims.slaMissed')} secondary={date} className="font-semibold text-crimson" />;
  }
  if (claim.status !== 'ACTIVE') return dash;

  // fara responsabil: preluarea se anuleaza automat — mai urgent decat termenul ofertei
  if (!claim.assignedToUserId) {
    return (
      <SlaLines
        primary={
          assignMinutes != null
            ? t('myClaims.slaUnassignedRule', { minutes: tu('minute', { n: assignMinutes }) })
            : t('myClaims.slaUnassigned')
        }
        secondary={date ? t('myClaims.offerBy', { date }) : null}
        className="font-semibold text-crimson"
      />
    );
  }
  if (!claim.slaDeadlineAt) return dash;
  if (claim.slaPaused) {
    return <SlaLines primary={t('myClaims.slaPausedLine')} secondary={date} className="text-info" />;
  }

  // fara breachAt in lista, termenul trecut e direct "depasit"
  const phase = slaPhase(claim.slaDeadlineAt, null, now);
  if (phase === 'GRACE' || phase === 'BREACHED') {
    return <SlaLines primary={t('myClaims.slaOverdue')} secondary={date} className="font-semibold text-crimson" />;
  }

  const [first, second] = timeLeftUnits(Date.parse(claim.slaDeadlineAt) - now);
  if (!first) return dash;
  const left = second
    ? t('myClaims.slaLeftTwo', {
        a: tu(first.unit, { n: first.n }),
        b: tu(second.unit, { n: second.n }),
      })
    : t('myClaims.slaLeftOne', { a: tu(first.unit, { n: first.n }), count: first.n });
  return (
    <SlaLines
      primary={left}
      secondary={date}
      // chihlimbar in ultimele ore dinaintea termenului (acelasi prag ca emailul de avertizare)
      className={phase === 'SOON' ? 'font-semibold text-amber' : 'font-medium'}
    />
  );
}
