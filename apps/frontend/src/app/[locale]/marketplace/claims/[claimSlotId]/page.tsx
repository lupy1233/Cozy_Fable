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
import { useEffect } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import { useMyCompany } from '@/hooks/use-company';
import { useAssignClaim } from '@/hooks/use-marketplace';
import { useClaimContext } from '@/hooks/use-quotes';
import { useMarkDelivered } from '@/hooks/use-fulfillment';
import { useRealtimeSync } from '@/hooks/use-socket';
import { useRelativeTime } from '@/lib/relative-time';
import { AttachmentThumb } from '@/components/configurator/attachment-item';
import { RequestInspirationStrip } from '@/components/configurator/request-inspiration-strip';
import { RoomSpecCard, RoomSpecNav } from '@/components/configurator/room-spec-card';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { ChatPanel } from '../../../_components/chat-panel';
import { ClaimLifecyclePanel } from '../../../_components/claim-lifecycle-panel';
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
  useRealtimeSync();

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'COMPANY_USER') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (ctx.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }
  if (ctx.isError || !ctx.data) {
    return <p className="py-20 text-center text-muted-foreground">{t('notFound')}</p>;
  }

  const c = ctx.data;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/marketplace/claims" className="text-sm text-walnut hover:underline">
          ← {t('backToClaims')}
        </Link>
        <StatusBadge status={c.claimStatus} label={tm(`claimStatus.${c.claimStatus}`)} />
      </div>

      <h1 className="page-title">{c.requestTitle}</h1>

      <WorkBar ctx={c} />

      {/* dreapta = actiunile (mobil: primele); stanga = proiectul */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-6 lg:col-start-2 lg:row-start-1">
          <ClientCard ctx={c} />

          <section className="flex flex-col gap-3">
            <h2 className="font-serif text-xl">{t('offerSection')}</h2>
            {c.quote ? (
              <OfferCard
                quote={c.quote}
                mode="company"
                includesPaidDesign={c.includesPaidDesign}
                rooms={c.rooms}
              />
            ) : (
              <OfferBuilder
                kind="create"
                claimSlotId={c.claimSlotId}
                includesPaidDesign={c.includesPaidDesign}
                rooms={c.rooms}
              />
            )}
            {c.quote?.status === 'ACCEPTED' && <DeliverButton requestId={c.requestId} />}
          </section>

          {c.threadId && (
            <section className="flex flex-col gap-3">
              <h2 className="font-serif text-xl">{t('chatSection')}</h2>
              <ChatPanel threadId={c.threadId} mode="company" />
            </section>
          )}

          <ClaimLifecyclePanel ctx={c} />
        </div>

        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
          <ProjectCard ctx={c} />

          <section className="flex flex-col gap-3">
            <h2 className="font-serif text-xl">{t('workspace.roomsSection')}</h2>
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

          <GeneralFiles ctx={c} />

          <RequestInspirationStrip ids={c.detail.inspirationPhotoIds} />
        </div>
      </div>
    </div>
  );
}

// Bara de lucru: atribuirea (cine lucreaza — editabila de owner/manager),
// termenul SLA si costul. Neatribuit = stare de alarma (auto-anulare la 1h).
function WorkBar({ ctx }: { ctx: ClaimQuoteContextDto }) {
  const t = useTranslations('Quotes');
  const tm = useTranslations('Marketplace');
  const relTime = useRelativeTime();
  const company = useMyCompany();
  const assign = useAssignClaim();

  const canAssign =
    ctx.claimStatus === 'ACTIVE' &&
    (company.data?.myRole === 'OWNER' || company.data?.myRole === 'MANAGER');
  const unassigned = !ctx.assignment.assignedTo;
  const err = assign.error instanceof ApiError ? assign.error.code : null;

  return (
    <section
      className={
        'grid gap-4 rounded-xl border bg-surface p-4 shadow-sm sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border-2 ' +
        (unassigned && ctx.claimStatus === 'ACTIVE' ? 'border-amber/50' : 'border-border')
      }
    >
      <div className="flex flex-col gap-1.5 sm:pr-4">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-2">
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
        {unassigned && ctx.claimStatus === 'ACTIVE' && ctx.assignment.assignDeadlineAt && (
          <p className="flex items-center gap-1 text-xs text-amber">
            <Timer className="h-3.5 w-3.5" />
            {t('workspace.autoCancel', { time: relTime(ctx.assignment.assignDeadlineAt) })}
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
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-2">
          <CalendarClock className="h-3 w-3" />
          {t('workspace.slaLabel')}
        </span>
        <p className="text-sm font-medium">
          {ctx.slaDeadlineAt ? new Date(ctx.slaDeadlineAt).toLocaleString() : '—'}
        </p>
        {ctx.slaDeadlineAt && (
          <p className="text-xs text-muted-foreground">{relTime(ctx.slaDeadlineAt)}</p>
        )}
        {ctx.slaPaused && <p className="text-xs text-amber">{t('workspace.slaPaused')}</p>}
      </div>

      <div className="flex flex-col gap-1.5 sm:pl-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-2">
          {t('workspace.budgetLabel')}
        </span>
        <BudgetLine ctx={ctx} />
      </div>
    </section>
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
// vizibile DOAR cat timp claim-ul e activ pe cerere.
function ClientCard({ ctx }: { ctx: ClaimQuoteContextDto }) {
  const t = useTranslations('Quotes');
  if (!ctx.client) {
    return (
      <p className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted-foreground">
        {t('workspace.clientHidden')}
      </p>
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
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-walnut-soft font-serif text-sm text-walnut">
          {initials || <UserRound className="h-5 w-5" />}
        </span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-2">
            {t('workspace.clientSection')}
          </p>
          <h2 className="font-serif text-lg leading-tight">{ctx.client.name || '—'}</h2>
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
    </section>
  );
}

// Rezumatul proiectului: mesajul clientului + etichetele cheie.
function ProjectCard({ ctx }: { ctx: ClaimQuoteContextDto }) {
  const t = useTranslations('Quotes');
  const tm = useTranslations('Marketplace');
  const d = ctx.detail;
  if (!d.description && !ctx.includesPaidDesign && !d.hasOwnProject) return null;
  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-2">
        {t('workspace.descriptionLabel')}
      </h2>
      {d.description ? (
        <p className="whitespace-pre-wrap text-sm">{d.description}</p>
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
    </section>
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
      <h2 className="font-serif text-xl">{t('workspace.filesSection')}</h2>
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
  const deliver = useMarkDelivered();
  return (
    <Button
      variant="walnut"
      className="self-start"
      onClick={() => deliver.mutate(requestId)}
      disabled={deliver.isPending || deliver.isSuccess}
    >
      {deliver.isSuccess ? t('markedDelivered') : t('markDelivered')}
    </Button>
  );
}
