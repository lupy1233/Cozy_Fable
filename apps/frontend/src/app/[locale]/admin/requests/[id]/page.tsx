'use client';

import type {
  AdminRequestDetailDto,
  AdminTimelineEntryDto,
  AdminTimelineKind,
  ProjectCaseDto,
  SettlementOutcome,
} from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import { useAdminRequest, useCloseProject, useDismissProjectCase } from '@/hooks/use-admin';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { SkeletonPage } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CodeUnder, Pill, daysSinceDateOnly } from '../../_components/core-list-parts';

const NOTE_MIN = 10;
const NOTE_MAX = 1000;

// E-admin-platform-3 — detaliul unui proiect acceptat: parti, caz raportat, cronologie,
// preluari, miscari de credite si inchiderea DEFINITIVA (rezultatul creditelor ales
// explicit, fara valoare implicita; nota obligatorie, ramane in audit).
export default function AdminRequestDetailPage() {
  const t = useTranslations('Admin.requests');
  const tr = useTranslations('Requests');
  const format = useFormatter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const me = useMe();
  const detail = useAdminRequest(id);

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (detail.isPending) return <SkeletonPage variant="detail" />;
  if (detail.isError || !detail.data) {
    return (
      <EmptyState
        variant="card"
        title={t('notFound')}
        action={
          <Link href="/admin/requests" className="text-sm text-walnut hover:underline">
            ← {t('back')}
          </Link>
        }
      />
    );
  }
  const d = detail.data;
  const winnerSlot = d.winner ? d.slots.find((s) => s.id === d.winner!.claimSlotId) : undefined;
  // oferta castigatoare = cea acceptata de pe preluarea castigatoare
  const winnerQuote = d.winner
    ? d.quotes.find((q) => q.claimSlotId === d.winner!.claimSlotId && q.status === 'ACCEPTED')
    : undefined;
  const openCase = d.cases.find((c) => c.status === 'OPEN') ?? null;
  const lateDays = d.overdue && d.deliveryDate ? daysSinceDateOnly(d.deliveryDate) : 0;
  const dateTime = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="flex w-full max-w-[1180px] flex-col gap-6">
      <header className="flex flex-col gap-2.5">
        <Link
          href="/admin/requests"
          className="inline-flex min-h-11 items-center self-start text-sm text-walnut hover:underline"
        >
          ← {t('back')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-2.5">
            <h1 className="min-w-0 break-words font-serif text-3xl leading-tight tracking-[0.01em]">
              {d.title || tr('untitled')}
            </h1>
            <CodeUnder code={d.status}>
              <StatusBadge status={d.status} label={tr(`statusValue.${d.status}`)} />
            </CodeUnder>
            {openCase && (
              <Pill tone="amber" strong>
                {t('flag.openCase')}
              </Pill>
            )}
            {d.overdue && (
              <Pill tone="crimson" strong>
                {lateDays > 0 ? t('overdueByFlag', { days: lateDays }) : t('flag.overdue')}
              </Pill>
            )}
          </div>
          {d.closable && <CloseProjectDialog detail={d} amount={winnerSlot?.claimCostCreditsSnapshot ?? 0} />}
        </div>
      </header>

      <Card
        as="section"
        padding="none"
        aria-label={t('detail.parties')}
        className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] text-sm"
      >
        <Party label={t('detail.client')}>
          {d.client ? (
            <>
              <span className="font-semibold">{d.client.name}</span>
              <span className="break-all text-ui text-muted-foreground">{d.client.email}</span>
            </>
          ) : (
            <span>—</span>
          )}
        </Party>
        <Party label={t('detail.winner')}>
          {d.winner ? (
            <>
              <Link
                href={`/admin/companies/${d.winner.companyId}`}
                className="self-start font-semibold text-walnut hover:underline"
              >
                {d.winner.companyName}
              </Link>
              {winnerQuote && (
                <span className="text-ui text-muted-foreground">
                  {t('detail.acceptedQuote', {
                    price: `${format.number(winnerQuote.price)} ${winnerQuote.currency}`,
                  })}
                </span>
              )}
            </>
          ) : (
            <span>—</span>
          )}
        </Party>
        <Party label={t('detail.deliveryDate')}>
          <span className={cn('font-semibold', d.overdue && 'text-crimson')}>
            {d.deliveryDate
              ? format.dateTime(new Date(`${d.deliveryDate}T12:00:00`), { dateStyle: 'long' })
              : '—'}
          </span>
          {winnerSlot && (
            <span className="text-ui text-muted-foreground">
              {t('detail.claimCredits', { n: winnerSlot.claimCostCreditsSnapshot })}
            </span>
          )}
        </Party>
        {d.cancelledAt && (
          <Party label={t('detail.cancelledAt')}>
            <span className="font-semibold">{dateTime(d.cancelledAt)}</span>
          </Party>
        )}
      </Card>

      <CasesSection detail={d} />

      <div className="flex flex-wrap items-start gap-6">
        <TimelineSection entries={d.timeline} />

        <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="heading-section">{t('detail.slots')}</h2>
            <SlotsTable detail={d} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="heading-section">{t('detail.credits')}</h2>
            {d.creditMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('detail.noCredits')}</p>
            ) : (
              <Card padding="none" className="overflow-hidden">
                <Table className="min-w-[520px]">
                  <THead>
                    <TR>
                      <TH scope="col" className="bg-surface-2">{t('col.date')}</TH>
                      <TH scope="col" className="bg-surface-2">{t('col.company')}</TH>
                      <TH scope="col" className="bg-surface-2">{t('col.type')}</TH>
                      <TH scope="col" className="bg-surface-2 text-right">{t('col.amount')}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {d.creditMovements.map((m) => (
                      <TR key={m.id}>
                        <TD className="data-mono whitespace-nowrap align-middle text-muted-foreground">
                          {dateTime(m.createdAt)}
                        </TD>
                        <TD className="align-middle">{m.companyName}</TD>
                        <TD className="align-middle">
                          <div className="font-medium">
                            {t.has(`creditType.${m.type}`) ? t(`creditType.${m.type}`) : m.type}
                          </div>
                          {/* motivul din registru: cod tehnic, mic, sub eticheta */}
                          {m.reason && <div className="font-mono text-micro text-muted-foreground">{m.reason}</div>}
                        </TD>
                        <TD className="text-right align-middle font-mono text-ui tabular-nums">{m.amount}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </Card>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Party({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-6 py-4">
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

// Tonul punctului din cronologie: chihlimbar = cere atentie (caz), salvie = pas bun,
// carmin = proiect anulat, gri = restul.
const TIMELINE_DOT: Partial<Record<AdminTimelineKind, string>> = {
  CASE_OPENED: 'bg-amber',
  CASE_RESPONDED: 'bg-amber',
  QUOTE_ACCEPTED: 'bg-sage',
  DELIVERED: 'bg-sage',
  PROJECT_CANCELLED: 'bg-crimson',
};

function TimelineSection({ entries }: { entries: AdminTimelineEntryDto[] }) {
  const t = useTranslations('Admin.requests');
  const format = useFormatter();
  const titleId = useId();
  // serverul trimite cronologia de la cel mai vechi eveniment; o aratam cu cel mai nou sus
  const newestFirst = [...entries].reverse();
  return (
    <Card
      as="section"
      padding="none"
      aria-labelledby={titleId}
      className="flex min-w-0 flex-[1_1_380px] flex-col gap-4 px-6 pb-6 pt-5"
    >
      <h2 id={titleId} className="heading-section">
        {t('detail.timeline')}
      </h2>
      <ol className="flex flex-col text-sm">
        {newestFirst.map((e, i) => {
          const dot = TIMELINE_DOT[e.kind];
          const last = i === newestFirst.length - 1;
          return (
            <li key={`${e.at}-${i}`} className="flex gap-3">
              <span aria-hidden className="flex w-3 flex-none flex-col items-center">
                <span className={cn('mt-[5px] size-2.5 rounded-full', dot ?? 'bg-muted-2')} />
                {!last && <span className="w-px flex-1 bg-border" />}
              </span>
              <div className={cn('min-w-0', !last && 'pb-3.5')}>
                <div className={cn('break-words', dot && 'font-semibold')}>
                  <TimelineLabel entry={e} />
                </div>
                <time dateTime={e.at} className="data-mono block text-muted-foreground">
                  {format.dateTime(new Date(e.at), { dateStyle: 'medium', timeStyle: 'short' })}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function SlotsTable({ detail }: { detail: AdminRequestDetailDto }) {
  const t = useTranslations('Admin.requests');
  const tm = useTranslations('Marketplace');
  const tq = useTranslations('Quotes');
  const format = useFormatter();
  const quoteBySlot = new Map(detail.quotes.map((q) => [q.claimSlotId, q]));
  return (
    <Card padding="none" className="overflow-hidden">
      <Table className="min-w-[520px]">
        <THead>
          <TR>
            <TH scope="col" className="bg-surface-2">{t('col.company')}</TH>
            <TH scope="col" className="bg-surface-2">{t('col.claimStatus')}</TH>
            <TH scope="col" className="bg-surface-2">{t('col.quote')}</TH>
            <TH scope="col" className="bg-surface-2 text-right">{t('col.cost')}</TH>
          </TR>
        </THead>
        <TBody>
          {detail.slots.map((s) => {
            const q = quoteBySlot.get(s.id);
            const winner = detail.winner?.claimSlotId === s.id;
            return (
              <TR key={s.id}>
                <TD className="align-middle">
                  <div className={cn(winner && 'font-semibold')}>{s.companyName}</div>
                  <div className="data-mono text-muted-foreground">
                    {t('detail.claimedOn', {
                      date: format.dateTime(new Date(s.createdAt), { dateStyle: 'medium' }),
                    })}
                  </div>
                </TD>
                <TD className="align-middle">
                  <CodeUnder code={s.status}>
                    <span>{tm(`claimStatus.${s.status}`)}</span>
                  </CodeUnder>
                </TD>
                <TD className="align-middle">
                  {q ? (
                    <span>
                      {tq(`status.${q.status}`)} ·{' '}
                      <span className="whitespace-nowrap font-mono text-ui">
                        {format.number(q.price)} {q.currency}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TD>
                <TD className="text-right align-middle font-mono text-ui tabular-nums">
                  {s.claimCostCreditsSnapshot}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </Card>
  );
}

function CasesSection({ detail }: { detail: AdminRequestDetailDto }) {
  const t = useTranslations('Admin.requests');
  const dismiss = useDismissProjectCase();
  const [note, setNote] = useState('');
  const [dismissOpen, setDismissOpen] = useState(false);
  if (detail.cases.length === 0) return null;
  // cel mult un caz deschis pe proiect (PROJECT_CASE_ALREADY_OPEN); dialogul e al lui
  const openCase = detail.cases.find((c) => c.status === 'OPEN') ?? null;
  const errText =
    dismiss.error instanceof ApiError
      ? t.has(`apiErrors.${dismiss.error.code}`)
        ? t(`apiErrors.${dismiss.error.code}`)
        : t('apiErrors.INTERNAL_ERROR')
      : dismiss.error
        ? t('apiErrors.INTERNAL_ERROR')
        : null;
  return (
    <div className="flex flex-col gap-3">
      {detail.cases.map((c) => (
        <CaseCard
          key={c.id}
          projectCase={c}
          onDismiss={() => {
            dismiss.reset();
            setDismissOpen(true);
          }}
        />
      ))}
      {openCase && (
        <Dialog open={dismissOpen} onOpenChange={(v) => { if (!dismiss.isPending) setDismissOpen(v); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('dismiss')}</DialogTitle>
              <DialogDescription>{t('dismissHint')}</DialogDescription>
            </DialogHeader>
            <Field label={t('close.note')} hint={t('noteHint', { min: NOTE_MIN })}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={NOTE_MAX} />
            </Field>
            {errText && (
              <p role="alert" className="mt-3 text-sm text-crimson">
                {errText}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" size="lg" onClick={() => setDismissOpen(false)} disabled={dismiss.isPending}>
                {t('cancel')}
              </Button>
              <Button
                size="lg"
                onClick={() =>
                  dismiss.mutate(
                    { id: openCase.id, adminNote: note.trim() },
                    { onSuccess: () => { setDismissOpen(false); setNote(''); } },
                  )
                }
                disabled={dismiss.isPending || note.trim().length < NOTE_MIN}
              >
                {t('dismiss')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Un caz raportat. Cel deschis iese in fata (chihlimbar = cere o decizie a adminului);
// cele inchise raman ca istoric, pe card obisnuit.
function CaseCard({ projectCase: c, onDismiss }: { projectCase: ProjectCaseDto; onDismiss: () => void }) {
  const t = useTranslations('Admin.requests');
  const tf = useTranslations('Fulfillment.projectCase');
  const format = useFormatter();
  const titleId = useId();
  const open = c.status === 'OPEN';
  return (
    <Card
      as="section"
      tone={open ? 'amber' : 'default'}
      padding="none"
      aria-labelledby={titleId}
      className={cn(
        'flex flex-wrap items-start justify-between gap-x-6 gap-y-3.5 px-6 py-5 text-sm',
        open && 'text-amber',
      )}
    >
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id={titleId} className="heading-section">
            {t('detail.case')}: {tf(`reason.${c.reason}`)}
          </h2>
          <Badge tone={open ? 'amber' : 'muted'} className={cn(open && 'border border-amber/30')}>
            {t(`caseStatus.${c.status}`)}
          </Badge>
        </div>
        <p className="data-mono">
          {t(`openedBy.${c.openedBy}`)} ·{' '}
          <time dateTime={c.createdAt}>
            {format.dateTime(new Date(c.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
          </time>
        </p>
        {c.note && (
          <p className="whitespace-pre-wrap break-words italic">{t('detail.quoted', { text: c.note })}</p>
        )}
        {c.response && (
          <p className="break-words">
            <span className="font-semibold">{t(`response.${c.response}`)}</span>
            {c.responseNote ? ` — ${t('detail.quoted', { text: c.responseNote })}` : ''}
          </p>
        )}
        {c.creditOutcome && (
          <p className={cn(!open && 'text-muted-foreground')}>{t(`outcomeLabel.${c.creditOutcome}`)}</p>
        )}
      </div>
      {open && (
        <Button
          variant="outline"
          size="lg"
          className="h-11 border-amber bg-transparent text-amber shadow-none hover:border-amber hover:bg-amber/10"
          onClick={onDismiss}
        >
          {t('dismissOpen')}
        </Button>
      )}
    </Card>
  );
}

function CloseProjectDialog({ detail, amount }: { detail: AdminRequestDetailDto; amount: number }) {
  const t = useTranslations('Admin.requests');
  const close = useCloseProject(detail.id);
  const [open, setOpen] = useState(false);
  // fara valoare implicita: adminul alege explicit rezultatul creditelor
  const [outcome, setOutcome] = useState<SettlementOutcome | null>(null);
  const [note, setNote] = useState('');
  const errText =
    close.error instanceof ApiError
      ? t.has(`apiErrors.${close.error.code}`)
        ? t(`apiErrors.${close.error.code}`)
        : t('apiErrors.INTERNAL_ERROR')
      : close.error
        ? t('apiErrors.INTERNAL_ERROR')
        : null;
  const canSubmit = !!outcome && note.trim().length >= NOTE_MIN && !close.isPending;
  return (
    <>
      <Button
        variant="outline"
        size="lg"
        className="h-11 border-crimson text-crimson hover:border-crimson hover:bg-crimson-soft"
        onClick={() => setOpen(true)}
      >
        {t('close.open')}
      </Button>
      <Dialog open={open} onOpenChange={(v) => { if (!close.isPending) setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('close.title')}</DialogTitle>
            <DialogDescription>{t('close.warning')}</DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-2 font-medium">{t('close.outcome')}</legend>
            {(['REFUND', 'CONSUME'] as const).map((o) => (
              <label
                key={o}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 transition-colors',
                  outcome === o ? 'border-foreground bg-surface-2' : 'border-border-2 hover:border-muted-2',
                )}
              >
                <input
                  type="radio"
                  name="close-outcome"
                  value={o}
                  checked={outcome === o}
                  onChange={() => setOutcome(o)}
                  className="accent-walnut"
                />
                {o === 'REFUND' ? t('close.refund', { n: amount }) : t('close.consume', { n: amount })}
              </label>
            ))}
          </fieldset>
          <Field className="mt-4" label={t('close.note')} hint={t('noteHint', { min: NOTE_MIN })}>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={NOTE_MAX} />
          </Field>
          {errText && (
            <p role="alert" className="mt-3 text-sm text-crimson">
              {errText}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setOpen(false)} disabled={close.isPending}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              size="lg"
              disabled={!canSubmit}
              onClick={() =>
                outcome &&
                close.mutate(
                  { creditOutcome: outcome, adminNote: note.trim() },
                  { onSuccess: () => { setOpen(false); setNote(''); setOutcome(null); } },
                )
              }
            >
              {t('close.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TimelineLabel({ entry }: { entry: AdminTimelineEntryDto }) {
  const t = useTranslations('Admin.requests');
  const tm = useTranslations('Marketplace');
  const tf = useTranslations('Fulfillment.projectCase');
  const p = entry.params;
  const s = (k: string) => (p[k] == null ? '' : String(p[k]));
  switch (entry.kind) {
    case 'SLOT_CLOSED':
      return <span>{t('timeline.SLOT_CLOSED', { company: s('company'), status: tm(`claimStatus.${s('status')}`) })}</span>;
    case 'CREDIT_MOVEMENT':
      return (
        <span>
          {t('timeline.CREDIT_MOVEMENT', {
            company: s('company'),
            type: t.has(`creditType.${s('type')}`) ? t(`creditType.${s('type')}`) : s('type'),
            amount: s('amount'),
          })}
          <span className="ml-1 font-mono text-micro font-normal text-muted-foreground">{s('reason')}</span>
        </span>
      );
    case 'CASE_OPENED':
      return <span>{t('timeline.CASE_OPENED', { openedBy: t(`openedBy.${s('openedBy')}`), reason: tf(`reason.${s('reason')}`) })}</span>;
    case 'CASE_RESPONDED':
      return <span>{t('timeline.CASE_RESPONDED', { response: t(`response.${s('response')}`) })}</span>;
    case 'CASE_RESOLVED':
      return <span>{t('timeline.CASE_RESOLVED', { status: t(`caseStatus.${s('status')}`) })}</span>;
    case 'AUDIT':
      return (
        <span>
          {t('timeline.AUDIT', { role: s('role') || '—' })}
          <span className="ml-1 font-mono text-micro">{s('action')}</span>
        </span>
      );
    case 'QUOTE_VERSION_SENT':
      return <span>{t('timeline.QUOTE_VERSION_SENT', { company: s('company'), version: s('version') })}</span>;
    case 'CLAIMED':
    case 'QUOTE_ACCEPTED':
      return <span>{t(`timeline.${entry.kind}`, { company: s('company') })}</span>;
    default:
      return <span>{t(`timeline.${entry.kind}`)}</span>;
  }
}
