'use client';

import type { AttachmentDto, ClaimQuoteContextDto } from '@marketplace/shared';
import {
  CalendarClock,
  Mail,
  MapPin,
  Phone,
  Timer,
  UserRound,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { companyCan } from '@/lib/company-permissions';
import { useMe } from '@/hooks/use-auth';
import { useMyCompany } from '@/hooks/use-company';
import { useAssignClaim } from '@/hooks/use-marketplace';
import { useClaimContext } from '@/hooks/use-quotes';
import { useMarkDelivered } from '@/hooks/use-fulfillment';
import { isFirmRules, useFirmRules } from '@/hooks/use-legal';
import { useRealtimeSync } from '@/hooks/use-socket';
import { useNow } from '@/hooks/use-now';
import { useRelativeTime } from '@/lib/relative-time';
import { slaPhase, slaPhaseClass, useDurationLeft, useSlaDateFormat } from '@/lib/sla-deadline';
import { AttachmentThumb } from '@/components/configurator/attachment-item';
import { RequestInspirationByRoom } from '@/components/configurator/request-inspiration-by-room';
import { RoomSpecCard, RoomSpecNav } from '@/components/configurator/room-spec-card';
import { StudioScenesButton } from '@/components/studio/scene-button';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ContactSafeText } from '@/components/ui/contact-safe-text';
import { Select } from '@/components/ui/select';
import { ChatPanel } from '../../../_components/chat-panel';
import { AgreementCard } from '../../../_components/agreement-card';
import { ClaimLifecyclePanel } from '../../../_components/claim-lifecycle-panel';
import { ActionConfirmDialog } from '../../../_components/action-confirm-dialog';
import { ProjectCasePanel } from '../../../_components/project-case-panel';
import { OfferBuilder } from '../../../_components/offer-builder';
import { OfferCard } from '../../../_components/offer-card';

// Fisa de lucru a firmei pe un claim (redesign PO r6): bara de lucru sus
// (atribuire — elementul central dupa revendicare — + SLA + stadiu), apoi
// proiectul in stanga (mesaj, buget, camere cu snapshot/viewer 3D, fisiere)
// si actiunile in dreapta (clientul cu datele de contact, oferta, chat).
export default function CompanyClaimPage() {
  const t = useTranslations('Quotes');
  const tm = useTranslations('Marketplace');
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
  // E-admin-platform-3: castigatorul vede acordul si poate raporta un proiect blocat
  const isWinner = c.quote?.status === 'ACCEPTED';
  const projectActive = c.requestStatus === 'ACCEPTED' || c.requestStatus === 'IN_EXECUTION';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        back={{ href: '/marketplace/claims', label: t('backToClaims') }}
        meta={<StatusBadge status={c.claimStatus} label={tm(`claimStatus.${c.claimStatus}`)} />}
        title={<ContactSafeText text={c.requestTitle} />}
      />

      <WorkBar ctx={c} />

      {/* dreapta = actiunile (mobil: primele); stanga = proiectul */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-6 lg:col-start-2 lg:row-start-1">
          <ClientCard ctx={c} />

          <section className="flex flex-col gap-3">
            <h2 className="heading-section">{t('offerSection')}</h2>
            {isWinner && c.quote && <AgreementCard quote={c.quote} requestStatus={c.requestStatus} mode="company" />}
            {c.quote ? (
              <OfferCard
                quote={c.quote}
                mode="company"
                includesPaidDesign={c.includesPaidDesign}
                rooms={c.rooms}
                firmActions={c.firmActions}
                slaPaused={c.slaPaused}
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
              isManager && (
                <DeliverButton requestId={c.requestId} />
              )}
            {isWinner && (projectActive || c.projectCase?.status === 'CLOSED_PROJECT_CANCELLED') && (
              <ProjectCasePanel
                requestId={c.requestId}
                mode="company"
                projectCase={c.projectCase}
                canAct={isManager && projectActive}
              />
            )}
          </section>

          {c.threadId && (
            <section className="flex flex-col gap-3">
              <h2 className="heading-section">{t('chatSection')}</h2>
              <ChatPanel threadId={c.threadId} mode="company" />
            </section>
          )}

          <ClaimLifecyclePanel ctx={c} />
        </div>

        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
          <ProjectCard ctx={c} />

          <section className="flex flex-col gap-3">
            <h2 className="heading-section">{t('workspace.roomsSection')}</h2>
            {/* camera 3D din Studio (feedback PO r3) — amplasarea clientului */}
            <StudioScenesButton scenes={c.detail.studioScenes} />
            <RoomSpecNav rooms={c.detail.rooms} />
            {c.detail.rooms.map((room, i) => (
              <RoomSpecCard
                key={room.id}
                room={room}
                index={i + 1}
                attachments={c.detail.attachments}
              />
            ))}
          </section>

          {/* inspiratia clientului, grupata pe camere, langa camere (E-client-34) */}
          <RequestInspirationByRoom photos={c.detail.inspirationPhotos} rooms={c.detail.rooms} />

          <GeneralFiles ctx={c} />
        </div>
      </div>
    </div>
  );
}

// E-company-3 (docs/03 4.2): preluarea nu mai ocupa locul (REDACTED) sau clientul a sters
// cererea (TOMBSTONE) — titlul, localitatea, stadiul si oferta proprie, fara actiuni, chat,
// date de contact, camere sau fisiere.
function ClosedClaimSummary({ ctx: c }: { ctx: ClaimQuoteContextDto }) {
  const t = useTranslations('Quotes');
  const tm = useTranslations('Marketplace');
  const isWinner = c.quote?.status === 'ACCEPTED';
  const place = [c.detail.city, c.detail.county].filter(Boolean).join(', ');
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        back={{ href: '/marketplace/claims', label: t('backToClaims') }}
        meta={<StatusBadge status={c.claimStatus} label={tm(`claimStatus.${c.claimStatus}`)} />}
        title={<ContactSafeText text={c.requestTitle} />}
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

// Bara de lucru: atribuirea (cine lucreaza — editabila de owner/manager),
// termenul SLA si costul. Neatribuit = stare de alarma (auto-anulare la 1h).
function WorkBar({ ctx }: { ctx: ClaimQuoteContextDto }) {
  const t = useTranslations('Quotes');
  const tm = useTranslations('Marketplace');
  const relTime = useRelativeTime();
  const fmtSla = useSlaDateFormat();
  const durationLeft = useDurationLeft();
  // E-company-13: re-randare la 30 s → numaratorile ("în 42 de min") si fazele SLA avanseaza singure
  const now = useNow(30_000);
  const company = useMyCompany();
  const assign = useAssignClaim();

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

  return (
    <Card
      as="section"
      padding="sm"
      className={
        'grid gap-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border-2 ' +
        (late ? 'border-crimson/50' : unassigned && active ? 'border-amber/50' : '')
      }
    >
      <div className="flex flex-col gap-1.5 sm:pr-4">
        <span className="flex items-center gap-1.5 label">
          <Users className="h-3 w-3" />
          {t('workspace.assignLabel')}
        </span>
        {canAssign ? (
          <Select
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
        ) : (
          <p className="text-sm font-medium">
            {ctx.assignment.assignedTo?.name ?? t('workspace.unassigned')}
          </p>
        )}
        {unassigned && active && ctx.assignment.assignDeadlineAt && (
          <p
            className={
              'flex items-center gap-1 text-xs ' + (assignDue ? 'text-crimson' : 'text-amber')
            }
          >
            <Timer className="h-3.5 w-3.5" />
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
            {t('workspace.claimedBy', { name: ctx.assignment.claimedBy.name })}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5 sm:px-4">
        <span className="flex items-center gap-1.5 label">
          <CalendarClock className="h-3 w-3" />
          {t('workspace.slaLabel')}
        </span>
        {!active ? (
          // oferta trimisa / preluare inchisa: termenul SLA nu mai are obiect
          <p className="text-sm text-muted-foreground">
            {ctx.claimStatus === 'OFFER_SENT' || ctx.claimStatus === 'COMPLETED'
              ? t('workspace.slaOfferSent')
              : '—'}
          </p>
        ) : (
          <>
            <p className="text-sm font-medium">{ctx.slaDeadlineAt ? fmtSla(ctx.slaDeadlineAt) : '—'}</p>
            {ctx.slaPaused && <p className="text-xs text-amber">{t('workspace.slaPaused')}</p>}
            {ctx.slaDeadlineAt && phase && (phase === 'RUNNING' || phase === 'SOON') && (
              <p className={'text-xs ' + slaPhaseClass[phase]}>{relTime(ctx.slaDeadlineAt)}</p>
            )}
            {phase === 'GRACE' && ctx.firmActions.slaBreachAt && (
              <p className="text-xs font-medium text-crimson">
                {t('workspace.slaGrace', {
                  left: durationLeft(Date.parse(ctx.firmActions.slaBreachAt) - now),
                })}
              </p>
            )}
            {phase === 'BREACHED' && (
              <p className="text-xs font-medium text-crimson">{t('workspace.slaBreached')}</p>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5 sm:pl-4">
        <span className="label">
          {t('workspace.budgetLabel')}
        </span>
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
      <p className="text-sm font-medium">
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
      <Card tone="muted" padding="sm" className="text-sm text-muted-foreground">
        {text}
      </Card>
    );
  }
  const initials = ctx.client.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <Card as="section" padding="none" className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-walnut-soft font-serif text-sm text-walnut">
          {initials || <UserRound className="h-5 w-5" />}
        </span>
        <div>
          <p className="label">
            {t('workspace.clientSection')}
          </p>
          <h2 className="heading-card leading-tight">{ctx.client.name || '—'}</h2>
        </div>
      </div>
      <ul className="flex flex-col gap-2 p-4 text-sm">
        {ctx.client.contacts.map((c) => (
          <li key={c.id}>
            <a
              href={c.channel === 'EMAIL' ? `mailto:${c.value}` : `tel:${c.value}`}
              className="inline-flex items-center gap-2 text-walnut hover:underline"
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
          <li className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {ctx.detail.addressText}
              <span className="block text-xs">
                {ctx.detail.city}, {ctx.detail.county}
              </span>
            </span>
          </li>
        )}
      </ul>
    </Card>
  );
}

// Rezumatul proiectului: mesajul clientului + etichetele cheie.
function ProjectCard({ ctx }: { ctx: ClaimQuoteContextDto }) {
  const t = useTranslations('Quotes');
  const tm = useTranslations('Marketplace');
  const d = ctx.detail;
  if (!d.description && !ctx.includesPaidDesign && !d.hasOwnProject) return null;
  return (
    <Card as="section" padding="sm">
      <h2 className="label mb-2">
        {t('workspace.descriptionLabel')}
      </h2>
      {d.description ? (
        <p className="whitespace-pre-wrap text-sm">
          <ContactSafeText text={d.description} />
        </p>
      ) : (
        <p className="text-sm text-muted-2">{t('workspace.noDescription')}</p>
      )}
      {(ctx.includesPaidDesign || d.hasOwnProject) && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {ctx.includesPaidDesign && (
            <span className="rounded-full border border-sage/40 bg-sage-soft px-2.5 py-1 text-sage">
              {tm('includesPaidDesign')}
            </span>
          )}
          {d.hasOwnProject && (
            <span className="rounded-full border border-border-2 bg-surface-2 px-2.5 py-1">
              {tm('hasOwnProject')}
            </span>
          )}
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
