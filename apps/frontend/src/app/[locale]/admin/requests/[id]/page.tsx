'use client';

import type { AdminRequestDetailDto, AdminTimelineEntryDto, SettlementOutcome } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import { useAdminRequest, useCloseProject, useDismissProjectCase } from '@/hooks/use-admin';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
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

const NOTE_MIN = 10;
const NOTE_MAX = 1000;

// E-admin-platform-3 — detaliul unui proiect acceptat: parti, caz raportat, preluari,
// miscari de credite, cronologie si inchiderea DEFINITIVA (rezultatul creditelor ales
// explicit, fara valoare implicita; nota obligatorie, ramane in audit).
export default function AdminRequestDetailPage() {
  const t = useTranslations('Admin.requests');
  const tr = useTranslations('Requests');
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
  const openCase = d.cases.find((c) => c.status === 'OPEN') ?? null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        back={{ href: '/admin/requests', label: t('back') }}
        title={d.title || tr('untitled')}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={d.status} label={tr(`statusValue.${d.status}`)} />
            {d.overdue && <Badge tone="crimson">{t('flag.overdue')}</Badge>}
            {openCase && <Badge tone="amber">{t('flag.openCase')}</Badge>}
          </span>
        }
        actions={d.closable ? <CloseProjectDialog detail={d} amount={winnerSlot?.claimCostCreditsSnapshot ?? 0} /> : undefined}
      />

      <Card as="section" className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="label">{t('detail.client')}</p>
          <p className="mt-1">{d.client ? `${d.client.name} · ${d.client.email}` : '—'}</p>
        </div>
        <div>
          <p className="label">{t('detail.winner')}</p>
          <p className="mt-1">{d.winner?.companyName ?? '—'}</p>
        </div>
        <div>
          <p className="label">{t('detail.deliveryDate')}</p>
          <p className="mt-1">{d.deliveryDate ? new Date(`${d.deliveryDate}T12:00:00`).toLocaleDateString() : '—'}</p>
        </div>
        {d.cancelledAt && (
          <div>
            <p className="label">{t('detail.cancelledAt')}</p>
            <p className="mt-1">{new Date(d.cancelledAt).toLocaleString()}</p>
          </div>
        )}
      </Card>

      <CasesSection detail={d} />

      <section className="flex flex-col gap-2">
        <h2 className="heading-section">{t('detail.slots')}</h2>
        <SlotsTable detail={d} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="heading-section">{t('detail.credits')}</h2>
        {d.creditMovements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('detail.noCredits')}</p>
        ) : (
          <Card padding="none">
            <Table>
              <THead>
                <TR>
                  <TH>{t('col.date')}</TH>
                  <TH>{t('col.company')}</TH>
                  <TH>{t('col.type')}</TH>
                  <TH className="text-right">{t('col.amount')}</TH>
                  <TH>{t('col.reason')}</TH>
                </TR>
              </THead>
              <TBody>
                {d.creditMovements.map((m) => (
                  <TR key={m.id}>
                    <TD className="whitespace-nowrap">{new Date(m.createdAt).toLocaleString()}</TD>
                    <TD>{m.companyName}</TD>
                    <TD>{t.has(`creditType.${m.type}`) ? t(`creditType.${m.type}`) : m.type}</TD>
                    <TD className="text-right tabular-nums">{m.amount}</TD>
                    <TD className="font-mono text-xs">{m.reason ?? '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="heading-section">{t('detail.timeline')}</h2>
        <Card as="div" className="text-sm"><ol className="flex flex-col gap-1.5">
          {d.timeline.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex gap-3">
              <span className="w-40 shrink-0 font-mono text-xs text-muted-foreground">
                {new Date(e.at).toLocaleString()}
              </span>
              <TimelineLabel entry={e} />
            </li>
          ))}
        </ol></Card>
      </section>
    </div>
  );
}

function SlotsTable({ detail }: { detail: AdminRequestDetailDto }) {
  const t = useTranslations('Admin.requests');
  const tm = useTranslations('Marketplace');
  const tq = useTranslations('Quotes');
  const quoteBySlot = new Map(detail.quotes.map((q) => [q.claimSlotId, q]));
  return (
    <Card padding="none">
      <Table>
        <THead>
          <TR>
            <TH>{t('col.company')}</TH>
            <TH>{t('col.claimStatus')}</TH>
            <TH>{t('col.quote')}</TH>
            <TH className="text-right">{t('col.cost')}</TH>
            <TH>{t('col.date')}</TH>
          </TR>
        </THead>
        <TBody>
          {detail.slots.map((s) => {
            const q = quoteBySlot.get(s.id);
            return (
              <TR key={s.id}>
                <TD>{s.companyName}</TD>
                <TD>{tm(`claimStatus.${s.status}`)}</TD>
                <TD>
                  {q ? (
                    <span>
                      {tq(`status.${q.status}`)} · {new Intl.NumberFormat('ro-RO').format(q.price)} {q.currency}
                    </span>
                  ) : (
                    '—'
                  )}
                </TD>
                <TD className="text-right tabular-nums">{s.claimCostCreditsSnapshot}</TD>
                <TD className="whitespace-nowrap">{new Date(s.createdAt).toLocaleDateString()}</TD>
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
  const tf = useTranslations('Fulfillment.projectCase');
  const dismiss = useDismissProjectCase();
  const [note, setNote] = useState('');
  const [dismissOpen, setDismissOpen] = useState(false);
  if (detail.cases.length === 0) return null;
  const errText =
    dismiss.error instanceof ApiError
      ? t.has(`apiErrors.${dismiss.error.code}`)
        ? t(`apiErrors.${dismiss.error.code}`)
        : t('apiErrors.INTERNAL_ERROR')
      : dismiss.error
        ? t('apiErrors.INTERNAL_ERROR')
        : null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="heading-section">{t('detail.case')}</h2>
      {detail.cases.map((c) => (
        <Card key={c.id} padding="sm" className="flex flex-col gap-1.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={c.status === 'OPEN' ? 'amber' : 'muted'}>{t(`caseStatus.${c.status}`)}</Badge>
            <span className="font-medium">{tf(`reason.${c.reason}`)}</span>
            <span className="text-muted-foreground">
              · {t(`openedBy.${c.openedBy}`)} · {new Date(c.createdAt).toLocaleString()}
            </span>
          </div>
          {c.note && <p className="whitespace-pre-wrap">“{c.note}”</p>}
          {c.response && (
            <p>
              <span className="font-medium">{t(`response.${c.response}`)}</span>
              {c.responseNote ? ` — “${c.responseNote}”` : ''}
            </p>
          )}
          {c.creditOutcome && <p className="text-muted-foreground">{t(`outcomeLabel.${c.creditOutcome}`)}</p>}
          {c.status === 'OPEN' && (
            <>
              <Button variant="outline" size="sm" className="self-start" onClick={() => setDismissOpen(true)}>
                {t('dismiss')}
              </Button>
              <Dialog open={dismissOpen} onOpenChange={(v) => { if (!dismiss.isPending) setDismissOpen(v); }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('dismiss')}</DialogTitle>
                    <DialogDescription>{t('dismissHint')}</DialogDescription>
                  </DialogHeader>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('close.note')}</span>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={NOTE_MAX} />
                  </label>
                  {errText && <p className="text-sm text-crimson">{errText}</p>}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDismissOpen(false)} disabled={dismiss.isPending}>
                      {t('cancel')}
                    </Button>
                    <Button
                      onClick={() =>
                        dismiss.mutate(
                          { id: c.id, adminNote: note.trim() },
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
            </>
          )}
        </Card>
      ))}
    </section>
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
      <Button variant="destructive" onClick={() => setOpen(true)}>
        {t('close.title')}
      </Button>
      <Dialog open={open} onOpenChange={(v) => { if (!close.isPending) setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('close.title')}</DialogTitle>
            <DialogDescription>{t('close.warning')}</DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 font-medium">{t('close.outcome')}</legend>
            {(['REFUND', 'CONSUME'] as const).map((o) => (
              <label key={o} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="close-outcome"
                  value={o}
                  checked={outcome === o}
                  onChange={() => setOutcome(o)}
                />
                {o === 'REFUND' ? t('close.refund', { n: amount }) : t('close.consume', { n: amount })}
              </label>
            ))}
          </fieldset>
          <label className="mt-2 flex flex-col gap-1 text-sm">
            <span>{t('close.note')}</span>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={NOTE_MAX} />
          </label>
          {errText && <p className="text-sm text-crimson">{errText}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={close.isPending}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
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
          <span className="ml-1 font-mono text-xs text-muted-foreground">{s('reason')}</span>
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
          <span className="ml-1 font-mono text-xs">{s('action')}</span>
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
