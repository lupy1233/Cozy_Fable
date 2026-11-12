'use client';

import type { AttachmentDto, ClaimQuoteContextDto } from '@marketplace/shared';
import { Mail, MapPin, Paperclip, Phone, Timer, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { companyCan } from '@/lib/company-permissions';
import { latestVersion } from '@/lib/quote-version';
import { cn } from '@/lib/utils';
import { useMe } from '@/hooks/use-auth';
import { useMessages, useThreads } from '@/hooks/use-chat';
import { useMyCompany } from '@/hooks/use-company';
import { useAssignClaim } from '@/hooks/use-marketplace';
import { useClaimContext } from '@/hooks/use-quotes';
import { useMarkDelivered } from '@/hooks/use-fulfillment';
import { isFirmRules, useFirmRules } from '@/hooks/use-legal';
import { useRealtimeSync } from '@/hooks/use-socket';
import { useNow } from '@/hooks/use-now';
import { useRelativeTime } from '@/lib/relative-time';
import { slaPhase, useDurationLeft, useSlaDateFormat } from '@/lib/sla-deadline';
import { AttachmentThumb } from '@/components/configurator/attachment-item';
import { RequestInspirationByRoom } from '@/components/configurator/request-inspiration-by-room';
import { RoomSpecCard, RoomSpecNav } from '@/components/configurator/room-spec-card';
import { StudioScenesButton } from '@/components/studio/scene-button';
import { Avatar } from '@/components/ui/avatar';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList, SkeletonPage } from '@/components/ui/skeleton';
import { ContactSafeText } from '@/components/ui/contact-safe-text';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { ChatPanel } from '../../../_components/chat-panel';
import { AgreementCard } from '../../../_components/agreement-card';
import { ClaimLifecyclePanel } from '../../../_components/claim-lifecycle-panel';
import { ActionConfirmDialog } from '../../../_components/action-confirm-dialog';
import { FirmRulesLink } from '../../../_components/firm-rules-link';
import { ProjectCasePanel } from '../../../_components/project-case-panel';
import { OfferBuilder } from '../../../_components/offer-builder';
import { OfferCard } from '../../../_components/offer-card';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Taburile fisei (design 2026-11). Valorile apar si in URL (?tab=), deci raman stabile.
const TAB_IDS = ['offer', 'chat', 'project', 'lifecycle'] as const;
type TabId = (typeof TAB_IDS)[number];

// Tabul deschis implicit = cel cu pasul urmator al firmei: fara oferta, cu o modificare ceruta,
// cu oferta expirata sau acceptata (livrare / caz raportat) → "Oferta"; oferta trimisa si nimic
// de facut pe ea → "Conversatie" (se asteapta clientul, discutia e pasul urmator).
function nextStepTab(c: ClaimQuoteContextDto): TabId {
  const q = c.quote;
  if (!q || !c.threadId || q.status !== 'SENT') return 'offer';
  const pendingChange = q.versions.some((v) => v.changeRequest?.status === 'PENDING');
  return pendingChange || latestVersion(q)?.isExpired ? 'offer' : 'chat';
}

// ?tab= din URL (linkurile fara parametru cad pe tabul implicit). Citit o singura data, la
// montarea fisei — fisa se monteaza doar in browser, dupa ce contextul a fost incarcat.
function readUrlTab(): TabId | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('tab');
  return TAB_IDS.find((id) => id === raw) ?? null;
}

// Fisa de lucru a firmei pe o preluare (design 2026-11): antet cu starea preluarii, bara de
// lucru (atribuire + termen SLA + buget), apoi taburi — oferta, conversatia, proiectul
// clientului, clarificari si retragere — cu clientul si ultimele mesaje mereu alaturi.
export default function CompanyClaimPage() {
  const t = useTranslations('Quotes');
  const params = useParams<{ claimSlotId: string }>();
  const claimSlotId = params.claimSlotId;
  const router = useRouter();
  const me = useMe();
  const ctx = useClaimContext(claimSlotId);
  const company = useMyCompany();
  useRealtimeSync();

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'COMPANY_USER') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (ctx.isPending) {
    return <SkeletonPage variant="detail" />;
  }
  if (ctx.isError || !ctx.data) {
    return (
      <EmptyState
        variant="card"
        tone="error"
        title={t('notFound')}
        action={
          <Link href="/marketplace/claims" className="text-sm text-walnut hover:underline">
            ← {t('backToClaims')}
          </Link>
        }
      />
    );
  }

  const c = ctx.data;
  const isManager = company.data?.myRole === 'OWNER' || company.data?.myRole === 'MANAGER';
  // E-company-3: preluare inchisa sau cerere stearsa → doar rezumatul (lipsa = FULL, imagine veche)
  if (c.visibility === 'REDACTED' || c.visibility === 'TOMBSTONE') {
    return <ClosedClaimSummary ctx={c} />;
  }
  return <ClaimWorkspace ctx={c} isManager={isManager} />;
}

function ClaimWorkspace({ ctx: c, isManager }: { ctx: ClaimQuoteContextDto; isManager: boolean }) {
  const t = useTranslations('Quotes');
  const tm = useTranslations('Marketplace');
  const threads = useThreads('company');
  const panelId = useId();
  const tabsRef = useRef<HTMLDivElement>(null);
  // tabul se fixeaza la montare: nu sare singur cand contextul se reimprospateaza (ex. dupa trimiterea ofertei)
  const [tab, setTab] = useState<TabId>(() => readUrlTab() ?? nextStepTab(c));
  const hasChat = !!c.threadId;
  const current: TabId = tab === 'chat' && !hasChat ? 'offer' : tab;
  // mesaje necitite pe conversatia acestei preluari (acelasi contor ca in lista de preluari)
  const unread = threads.data?.find((th) => th.claimSlotId === c.claimSlotId)?.unreadCount ?? 0;

  // E-admin-platform-3: castigatorul vede acordul si poate raporta un proiect blocat
  const isWinner = c.quote?.status === 'ACCEPTED';
  const projectActive = c.requestStatus === 'ACCEPTED' || c.requestStatus === 'IN_EXECUTION';

  const selectTab = (next: TabId) => {
    setTab(next);
    // tabul ramane in URL fara navigare (reincarcarea si linkul copiat pastreaza tabul)
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState(null, '', url);
  };
  const openChat = () => {
    selectTab('chat');
    // pe mobil cardul "Ultimele mesaje" e sub panou: readucem taburile in ecran
    tabsRef.current?.scrollIntoView({ block: 'nearest' });
  };

  const tabs: { value: TabId; label: ReactNode }[] = [
    { value: 'offer', label: t('offerSection') },
    ...(hasChat
      ? [
          {
            value: 'chat' as const,
            label: (
              <span className="inline-flex items-center gap-1.5">
                {t('workspace.tabChat')}
                {unread > 0 && (
                  <>
                    <span
                      aria-hidden
                      className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-crimson px-1 font-mono text-meta leading-none tracking-normal text-white"
                    >
                      {unread}
                    </span>
                    <span className="sr-only">{tm('myClaims.newMessages', { n: unread })}</span>
                  </>
                )}
              </span>
            ),
          },
        ]
      : []),
    { value: 'project', label: t('workspace.tabProject') },
    { value: 'lifecycle', label: t('workspace.tabLifecycle') },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <ClaimHeader ctx={c} />

      <WorkBar ctx={c} />

      <div ref={tabsRef} className="scroll-mt-24">
        <Tabs
          tabs={tabs}
          current={current}
          onChange={(value) => {
            const next = TAB_IDS.find((id) => id === value);
            if (next) selectTab(next);
          }}
          panelId={panelId}
          label={t('workspace.tabsLabel')}
          className="mb-0 flex-wrap"
        />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        {/* Toate panourile raman montate (cele inactive sunt doar ascunse): oferta inceputa,
            intrebarea scrisa sau mesajul neterminat nu se pierd cand firma schimba tabul. */}
        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={`${panelId}-tab-${current}`}
          className="min-w-0 flex-[999_1_560px]"
        >
          <div className={current === 'offer' ? 'flex flex-col gap-4' : 'hidden'}>
            {isWinner && c.quote && <AgreementCard quote={c.quote} requestStatus={c.requestStatus} mode="company" />}
            {c.quote ? (
              <OfferCard
                quote={c.quote}
                mode="company"
                includesPaidDesign={c.includesPaidDesign}
                rooms={c.rooms}
                firmActions={c.firmActions}
                slaPaused={c.slaPaused}
                headingLevel="h2"
              />
            ) : (
              <OfferBuilder
                kind="create"
                claimSlotId={c.claimSlotId}
                includesPaidDesign={c.includesPaidDesign}
                rooms={c.rooms}
              />
            )}
            {/* E-company-1: livrarea o marcheaza doar OWNER/MANAGER, pe castigator inca deschis */}
            {c.quote?.status === 'ACCEPTED' &&
              c.claimStatus === 'OFFER_SENT' &&
              (c.requestStatus === 'ACCEPTED' || c.requestStatus === 'IN_EXECUTION') &&
              isManager && <DeliverButton requestId={c.requestId} />}
            {isWinner && (projectActive || c.projectCase?.status === 'CLOSED_PROJECT_CANCELLED') && (
              <ProjectCasePanel
                requestId={c.requestId}
                mode="company"
                projectCase={c.projectCase}
                canAct={isManager && projectActive}
              />
            )}
          </div>

          {c.threadId && (
            <div className={current === 'chat' ? 'flex flex-col' : 'hidden'}>
              <h2 className="sr-only">{t('workspace.tabChat')}</h2>
              <ChatPanel
                threadId={c.threadId}
                mode="company"
                counterpartName={c.client?.name || undefined}
                messagesClassName="min-h-[320px] max-h-[60vh]"
              />
            </div>
          )}

          <div className={current === 'project' ? 'flex flex-col gap-6' : 'hidden'}>
            <section className="flex flex-col gap-3">
              <h2 className="heading-section">{t('workspace.roomsSection')}</h2>
              {/* camera 3D din Studio (feedback PO r3) — amplasarea clientului */}
              <StudioScenesButton scenes={c.detail.studioScenes} />
              <RoomSpecNav rooms={c.detail.rooms} />
              {c.detail.rooms.map((room, i) => (
                <RoomSpecCard key={room.id} room={room} index={i + 1} attachments={c.detail.attachments} />
              ))}
            </section>

            {/* inspiratia clientului, grupata pe camere, langa camere (E-client-34) */}
            <RequestInspirationByRoom photos={c.detail.inspirationPhotos} rooms={c.detail.rooms} />

            <GeneralFiles ctx={c} />
          </div>

          <div className={current === 'lifecycle' ? 'flex flex-col' : 'hidden'}>
            <ClaimLifecyclePanel ctx={c} />
          </div>
        </div>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <ClientCard ctx={c} />
          {c.threadId && current !== 'chat' && <RecentMessages threadId={c.threadId} onOpenChat={openChat} />}
          <ClientNote ctx={c} />
        </aside>
      </div>
    </div>
  );
}

// Antetul fisei: inapoi la preluari, titlul cererii si starea preluarii langa titlu.
function ClaimHeader({ ctx, subtitle }: { ctx: ClaimQuoteContextDto; subtitle?: ReactNode }) {
  const t = useTranslations('Quotes');
  const tm = useTranslations('Marketplace');
  return (
    <header className="flex flex-col gap-2">
      <Link
        href="/marketplace/claims"
        className="inline-flex min-h-11 items-center self-start text-sm text-walnut hover:text-walnut-deep hover:underline"
      >
        ← {t('backToClaims')}
      </Link>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="page-title min-w-0 break-words">
          <ContactSafeText text={ctx.requestTitle} />
        </h1>
        <StatusBadge status={ctx.claimStatus} label={tm(`claimStatus.${ctx.claimStatus}`)} />
      </div>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </header>
  );
}

// E-company-3 (docs/03 4.2): preluarea nu mai ocupa locul (REDACTED) sau clientul a sters
// cererea (TOMBSTONE) — titlul, localitatea, stadiul si oferta proprie, fara actiuni, chat,
// date de contact, camere sau fisiere.
function ClosedClaimSummary({ ctx: c }: { ctx: ClaimQuoteContextDto }) {
  const t = useTranslations('Quotes');
  const isWinner = c.quote?.status === 'ACCEPTED';
  const place = [c.detail.city, c.detail.county].filter(Boolean).join(', ');
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <ClaimHeader
        ctx={c}
        subtitle={
          place ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" />
              {place}
            </span>
          ) : undefined
        }
      />

      <Card tone="muted" padding="sm" className="text-sm text-muted-foreground">
        {t(c.visibility === 'TOMBSTONE' ? 'workspace.tombstoneNotice' : 'workspace.redactedNotice')}
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="heading-section">{t('offerSection')}</h2>
        {isWinner && c.quote && <AgreementCard quote={c.quote} requestStatus={c.requestStatus} mode="company" />}
        {c.quote ? (
          <OfferCard
            quote={c.quote}
            mode="company"
            includesPaidDesign={c.includesPaidDesign}
            rooms={c.rooms}
            readOnly
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t('workspace.noOwnOffer')}</p>
        )}
        {isWinner && c.projectCase && (
          <ProjectCasePanel requestId={c.requestId} mode="company" projectCase={c.projectCase} canAct={false} />
        )}
      </section>
    </div>
  );
}

// Randul mare al termenului: "Mai sunt 1 zi si 4 ore" / "Mai sunt 5 ore" / "Mai este o ora".
// `count` alege doar acordul verbului (este / sunt); durata propriu-zisa vine in `left`.
function useSlaLeftLine(): (ms: number) => string {
  const t = useTranslations('Quotes');
  const durationLeft = useDurationLeft();
  return (ms: number) => {
    if (ms >= DAY_MS) {
      const days = Math.floor(ms / DAY_MS);
      const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
      return t('workspace.slaLeft', {
        count: hours === 0 ? days : 2,
        left: t('workspace.daysHours', { days, hours }),
      });
    }
    // aceeasi rotunjire ca useDurationLeft: >= 1h → ore (in sus), altfel minute (minim 1)
    const count = ms >= HOUR_MS ? Math.ceil(ms / HOUR_MS) : Math.max(1, Math.ceil(ms / 60_000));
    return t('workspace.slaLeft', { count, left: durationLeft(ms) });
  };
}

type SlaTone = 'idle' | 'amber' | 'crimson' | 'info';
// regula de culoare din design: chihlimbar = e randul firmei, carmin = termen depasit,
// albastru = pauza (se asteapta clientul)
const SLA_CELL: Record<SlaTone, string> = {
  idle: 'bg-surface',
  amber: 'bg-amber-soft text-amber',
  crimson: 'bg-crimson-soft text-crimson',
  info: 'bg-info-soft text-info',
};

// Bara de lucru: atribuirea (cine lucreaza — editabila de owner/manager),
// termenul SLA si bugetul. Neatribuit = stare de alarma (auto-anulare la 1h).
function WorkBar({ ctx }: { ctx: ClaimQuoteContextDto }) {
  const t = useTranslations('Quotes');
  const tm = useTranslations('Marketplace');
  const tl = useTranslations('Lifecycle');
  const relTime = useRelativeTime();
  const fmtSla = useSlaDateFormat();
  const durationLeft = useDurationLeft();
  const slaLeftLine = useSlaLeftLine();
  // E-company-13: re-randare la 30 s → numaratorile ("Mai sunt 42 de minute") si fazele SLA avanseaza singure
  const now = useNow(30_000);
  const company = useMyCompany();
  const assign = useAssignClaim();
  const assignId = useId();

  const active = ctx.claimStatus === 'ACTIVE';
  // E-admin-platform-58: aceeasi regula ca ClaimsService.assign (CLAIMS_ASSIGN = OWNER/MANAGER)
  const canAssign = active && companyCan(company.data, 'CLAIMS_ASSIGN');
  const unassigned = !ctx.assignment.assignedTo;
  const err = assign.error instanceof ApiError ? assign.error.code : null;
  const assignDue =
    ctx.assignment.assignDeadlineAt != null && Date.parse(ctx.assignment.assignDeadlineAt) <= now;
  // SLA conteaza doar cat slotul e ACTIVE (procesorul SLA iese altfel) si nu e pe pauza
  const phase =
    active && ctx.slaDeadlineAt && !ctx.slaPaused
      ? slaPhase(ctx.slaDeadlineAt, ctx.firmActions.slaBreachAt, now)
      : null;
  const late = phase === 'GRACE' || phase === 'BREACHED';
  const slaTone: SlaTone =
    !active || !ctx.slaDeadlineAt ? 'idle' : ctx.slaPaused ? 'info' : late ? 'crimson' : 'amber';

  return (
    <Card
      as="section"
      aria-label={t('workspace.statusLabel')}
      padding="none"
      className={cn(
        // gap-px peste fundalul-bordura = linii fine intre celule, pe orice asezare
        'grid gap-px overflow-hidden bg-border lg:grid-cols-3',
        late ? 'border-crimson/50' : active ? 'border-amber/40' : '',
      )}
    >
      <div className="flex flex-col gap-1.5 bg-surface px-5 py-4 sm:px-6">
        {canAssign ? (
          <>
            <label htmlFor={assignId} className="label">
              {t('workspace.assignLabel')}
            </label>
            <Select
              id={assignId}
              className="h-11"
              value={ctx.assignment.assignedTo?.userId ?? ''}
              disabled={assign.isPending}
              onChange={(e) => {
                if (e.target.value) {
                  assign.mutate({ claimId: ctx.claimSlotId, assignToUserId: e.target.value });
                }
              }}
            >
              <option value="" disabled>
                {t('workspace.unassigned')}
              </option>
              {company.data?.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </Select>
          </>
        ) : (
          <>
            <span className="label">{t('workspace.assignLabel')}</span>
            <p className="font-serif text-2xl leading-tight">
              {ctx.assignment.assignedTo?.name ?? t('workspace.unassigned')}
            </p>
          </>
        )}
        {unassigned && active && ctx.assignment.assignDeadlineAt && (
          <p className={cn('flex items-center gap-1 text-xs', assignDue ? 'text-crimson' : 'text-amber')}>
            <Timer className="h-3.5 w-3.5 shrink-0" />
            {assignDue
              ? t('workspace.autoCancelDue')
              : t('workspace.autoCancel', { time: relTime(ctx.assignment.assignDeadlineAt) })}
          </p>
        )}
        {err && (
          <p className="text-xs text-crimson">
            {tm.has(`apiErrors.${err}`) ? tm(`apiErrors.${err}`) : tm('apiErrors.INTERNAL_ERROR')}
          </p>
        )}
        {ctx.assignment.claimedBy && (
          <p className="text-xs text-muted-foreground">
            {t('workspace.claimedByAt', { name: ctx.assignment.claimedBy.name, time: relTime(ctx.claimedAt) })}
          </p>
        )}
      </div>

      <div className={cn('flex flex-col gap-1.5 px-5 py-4 sm:px-6', SLA_CELL[slaTone])}>
        <span className={cn('label', slaTone !== 'idle' && 'text-current')}>{t('workspace.slaLabel')}</span>
        {!active ? (
          // oferta trimisa / preluare inchisa: termenul SLA nu mai are obiect
          <p className="text-sm text-muted-foreground">
            {ctx.claimStatus === 'OFFER_SENT' || ctx.claimStatus === 'COMPLETED'
              ? t('workspace.slaOfferSent')
              : '—'}
          </p>
        ) : !ctx.slaDeadlineAt ? (
          <p className="text-sm font-medium">—</p>
        ) : (
          <>
            <p className="font-serif text-2xl leading-tight">
              {ctx.slaPaused
                ? t('workspace.slaPaused')
                : late
                  ? t('workspace.slaOverdue')
                  : slaLeftLine(Date.parse(ctx.slaDeadlineAt) - now)}
            </p>
            {ctx.slaPaused && <p className="text-xs">{t('confirm.withdrawSlaPaused')}</p>}
            {phase === 'GRACE' && ctx.firmActions.slaBreachAt && (
              <p className="text-xs font-medium">
                {t('workspace.slaGraceLeft', {
                  left: durationLeft(Date.parse(ctx.firmActions.slaBreachAt) - now),
                })}
              </p>
            )}
            {phase === 'BREACHED' && <p className="text-xs font-medium">{t('workspace.slaBreached')}</p>}
            <p className="font-mono text-xs">
              {fmtSla(ctx.slaDeadlineAt)} ·{' '}
              <FirmRulesLink anchor="sla" className="underline underline-offset-2 hover:no-underline">
                {tl('rulesSlaLink')}
              </FirmRulesLink>
            </p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5 bg-surface px-5 py-4 sm:px-6">
        <span className="label">{t('workspace.budgetLabel')}</span>
        <BudgetLine ctx={ctx} />
      </div>
    </Card>
  );
}

function BudgetLine({ ctx }: { ctx: ClaimQuoteContextDto }) {
  const t = useTranslations('Quotes');
  const tr = useTranslations('Requests');
  const d = ctx.detail;
  return (
    <>
      <p className="font-serif text-2xl leading-tight">
        {d.budgetEstimateRon != null
          ? `${new Intl.NumberFormat('ro-RO').format(d.budgetEstimateRon)} lei`
          : tr(`budget.${d.budgetRange}`)}
      </p>
      <p className="text-xs text-muted-foreground">
        {d.deadlineBucket
          ? t('workspace.deadlineLine', { deadline: tr(`deadline.${d.deadlineBucket}`) })
          : tr('deadline.none')}
      </p>
    </>
  );
}

// Cardul clientului (PO r6): numele si caile de contact alese in cerere —
// vizibile DOAR cat timp claim-ul e activ pe cerere si doar membrilor care au voie (E-company-3).
function ClientCard({ ctx }: { ctx: ClaimQuoteContextDto }) {
  const t = useTranslations('Quotes');
  const relTime = useRelativeTime();
  const titleId = useId();
  if (!ctx.client) {
    let text: string;
    switch (ctx.clientHiddenReason) {
      case 'NOT_ASSIGNED_TO_YOU':
        text = t('workspace.clientHiddenNotAssigned');
        break;
      case 'REVEAL_PENDING':
        text = ctx.clientVisibleFrom
          ? t('workspace.clientHiddenRevealPending', { time: relTime(ctx.clientVisibleFrom) })
          : t('workspace.clientHidden');
        break;
      case 'RETENTION_EXPIRED':
        text = t('workspace.clientHiddenRetention');
        break;
      default:
        text = t('workspace.clientHidden');
    }
    return (
      <Card as="section" tone="muted" aria-labelledby={titleId} className="flex flex-col gap-1.5">
        <h2 id={titleId} className="label">
          {t('workspace.clientSection')}
        </h2>
        <p className="text-sm text-muted-foreground">{text}</p>
      </Card>
    );
  }
  const name = ctx.client.name.trim();
  return (
    <Card as="section" aria-labelledby={titleId} className="flex flex-col gap-3.5 sm:px-6">
      <div className="flex items-center gap-3.5">
        {name ? (
          <Avatar name={name} size={48} />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-walnut text-on-walnut">
            <UserRound className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <h2 id={titleId} className="label">
            {t('workspace.clientSection')}
          </h2>
          <p className="heading-section break-words">{name || '—'}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-0.5 text-sm">
        {ctx.client.contacts.map((c) => (
          <li key={c.id}>
            <a
              href={c.channel === 'EMAIL' ? `mailto:${c.value}` : `tel:${c.value}`}
              className="inline-flex min-h-10 items-center gap-2 font-medium text-walnut [overflow-wrap:anywhere] hover:text-walnut-deep hover:underline"
            >
              {c.channel === 'EMAIL' ? (
                <Mail className="h-4 w-4 shrink-0" />
              ) : (
                <Phone className="h-4 w-4 shrink-0" />
              )}
              {c.value}
            </a>
          </li>
        ))}
        {ctx.detail.addressText && (
          <li className="flex items-start gap-2 pt-2 text-ink-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              {ctx.detail.addressText}
              <span className="block text-xs text-muted-foreground">
                {ctx.detail.city}, {ctx.detail.county}
              </span>
            </span>
          </li>
        )}
      </ul>
      <p className="border-t border-border pt-3 text-xs text-muted-foreground">
        {t('workspace.clientPrivacyNote')}
      </p>
    </Card>
  );
}

// "Ultimele mesaje": ultimele doua mesaje din conversatia preluarii + drumul scurt spre tabul
// de conversatie. Nu marcheaza nimic drept citit (asta face doar panoul de chat cand e vizibil).
function RecentMessages({ threadId, onOpenChat }: { threadId: string; onOpenChat: () => void }) {
  const t = useTranslations('Quotes');
  const tmsg = useTranslations('Messages');
  const relTime = useRelativeTime();
  const messages = useMessages(threadId, 'company');
  const titleId = useId();
  const recent = (messages.data ?? []).slice(-2);
  const last = recent[recent.length - 1];
  return (
    <Card as="section" aria-labelledby={titleId} className="flex flex-col gap-3 sm:px-6">
      <h2 id={titleId} className="heading-section">
        {t('workspace.recentMessages')}
      </h2>
      {messages.isPending ? (
        <SkeletonList rows={2} variant="bubbles" />
      ) : messages.isError ? null : recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tmsg('noMessagesYet')}</p>
      ) : (
        <>
          {recent.map((m) => (
            <div
              key={m.id}
              className={cn(
                'max-w-[90%] rounded-xl px-3.5 py-2.5 text-sm',
                m.isMine ? 'self-end bg-walnut text-on-walnut' : 'self-start bg-surface-3',
              )}
            >
              {m.body ? (
                <p className="line-clamp-3 whitespace-pre-wrap break-words">{m.body}</p>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {tmsg('attachmentOnly')}
                </span>
              )}
            </div>
          ))}
          {last && (
            <p className={cn('font-mono text-meta text-muted-foreground', last.isMine && 'self-end')}>
              {last.senderName} · {relTime(last.createdAt)}
            </p>
          )}
        </>
      )}
      <Button variant="outline" size="lg" className="h-11" onClick={onOpenChat}>
        {t('workspace.replyInChat')}
      </Button>
    </Card>
  );
}

// "Mesajul clientului": descrierea cererii + etichetele cheie ale proiectului.
function ClientNote({ ctx }: { ctx: ClaimQuoteContextDto }) {
  const t = useTranslations('Quotes');
  const tm = useTranslations('Marketplace');
  const titleId = useId();
  const d = ctx.detail;
  if (!d.description && !ctx.includesPaidDesign && !d.hasOwnProject) return null;
  return (
    <Card as="section" tone="muted" aria-labelledby={titleId} className="flex flex-col gap-2 sm:px-6">
      <h2 id={titleId} className="heading-card">
        {t('workspace.descriptionLabel')}
      </h2>
      {d.description ? (
        <p className="whitespace-pre-wrap text-sm italic text-ink-2">
          <ContactSafeText text={d.description} />
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{t('workspace.noDescription')}</p>
      )}
      {(ctx.includesPaidDesign || d.hasOwnProject) && (
        <div className="mt-1 flex flex-wrap gap-2">
          {ctx.includesPaidDesign && <Badge tone="sage">{tm('includesPaidDesign')}</Badge>}
          {d.hasOwnProject && <Badge tone="outline">{tm('hasOwnProject')}</Badge>}
        </div>
      )}
    </Card>
  );
}

// Fisierele generale ale cererii (planuri/poze incarcate la nivel de cerere,
// nereferite de nicio camera — schitele per camera apar in spec-carduri).
function GeneralFiles({ ctx }: { ctx: ClaimQuoteContextDto }) {
  const t = useTranslations('Quotes');
  const referenced = new Set<string>();
  for (const room of ctx.detail.rooms) {
    for (const v of Object.values(room.answers ?? {})) {
      if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') referenced.add(x);
    }
  }
  const general: AttachmentDto[] = ctx.detail.attachments.filter((a) => !referenced.has(a.id));
  if (general.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="heading-section">{t('workspace.filesSection')}</h2>
      <div className="flex flex-wrap gap-2">
        {general.map((a) => (
          <AttachmentThumb key={a.id} attachment={a} />
        ))}
      </div>
    </section>
  );
}

function DeliverButton({ requestId }: { requestId: string }) {
  const t = useTranslations('Fulfillment');
  const tu = useTranslations('Legal.firmRules.units');
  const deliver = useMarkDelivered();
  // E-company-6: marcarea e ireversibila din aplicatie → dialog cu consecintele (D-L1-1)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const firmRules = useFirmRules();
  const rules = isFirmRules(firmRules.data) ? firmRules.data : null;
  const err = deliver.error instanceof ApiError ? deliver.error.code : null;
  const errText = err ? (t.has(`apiErrors.${err}`) ? t(`apiErrors.${err}`) : t('apiErrors.INTERNAL_ERROR')) : null;
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="walnut"
        size="lg"
        className="self-start"
        onClick={() => {
          deliver.reset();
          setConfirmOpen(true);
        }}
        disabled={deliver.isPending || deliver.isSuccess}
      >
        {deliver.isSuccess ? t('markedDelivered') : t('markDelivered')}
      </Button>
      {errText && <p className="text-sm text-crimson">{errText}</p>}
      <ActionConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('deliverConfirmTitle')}
        confirmLabel={t('deliverConfirmCta')}
        cancelLabel={t('deliverConfirmCancel')}
        pendingLabel={t('deliverConfirmPending')}
        pending={deliver.isPending}
        error={errText}
        onConfirm={() => deliver.mutate(requestId, { onSuccess: () => setConfirmOpen(false) })}
      >
        <p>
          {rules
            ? t('deliverConfirmBody', { days: tu('day', { n: rules.delivery.autoCompleteDays }) })
            : t('deliverConfirmBodyNoDays')}
        </p>
        <p className="font-medium">{t('deliverConfirmIrreversible')}</p>
      </ActionConfirmDialog>
    </div>
  );
}
