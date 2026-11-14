'use client';

import { ArrowDown, Building2, Check, Mail, Phone, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import type { ClientFulfillmentDto, ProjectCaseDto, QuoteDto } from '@marketplace/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  useClientFulfillment,
  useConfirmDelivery,
  useCreateReview,
  useOpenProjectCase,
  useOpenWarrantyCase,
  useProjectCase,
  useReview,
  useWarrantyWindow,
} from '@/hooks/use-fulfillment';
import { AgreementCard } from './agreement-card';
import { ProjectCasePanel } from './project-case-panel';
import { useLongDate } from './use-long-date';

// textul erorii API pe cod (Fulfillment.apiErrors.<COD>), cu fallback generic
function useApiErrText() {
  const t = useTranslations('Fulfillment');
  return (m: { error: unknown }): string | null =>
    m.error instanceof ApiError
      ? t.has(`apiErrors.${m.error.code}`)
        ? t(`apiErrors.${m.error.code}`)
        : t('apiErrors.INTERNAL_ERROR')
      : m.error
        ? t('apiErrors.INTERNAL_ERROR')
        : null;
}


// Sectiune client pe pagina de oferte: pasii de dupa acceptare (ACCEPTED/IN_EXECUTION),
// confirmare livrare (DELIVERED_BY_COMPANY) + review (COMPLETED/DISPUTED).
export function ClientFulfillment({
  requestId,
  status,
  acceptedCompany,
  acceptedQuote,
  cancelledAt,
  onOpenCompanyChat,
}: {
  requestId: string;
  status: string;
  // firma castigatoare — pentru panoul "ce urmeaza" + drumul spre conversatia ei
  acceptedCompany?: { name: string; claimSlotId: string } | null;
  // E-admin-platform-3: oferta acceptata — pentru cardul "Acordul vostru"
  acceptedQuote?: QuoteDto | null;
  // E-admin-platform-3: momentul inchiderii proiectului (status CANCELLED)
  cancelledAt?: string | null;
  // pagina arata o firma pe rand: deschide firma castigatoare; fara el ramane ancora #firm-<claimSlotId>
  onOpenCompanyChat?: (claimSlotId: string) => void;
}) {
  const t = useTranslations('Fulfillment');
  const fmtDate = useLongDate();
  const review = useReview(requestId);
  const inProgress = status === 'ACCEPTED' || status === 'IN_EXECUTION';
  const finished = status === 'COMPLETED' || status === 'DISPUTED';
  // e2: cazul conteaza si in starea livrata ("Am o problema") si dupa finalizare (garantie)
  const projectCase = useProjectCase(
    requestId,
    inProgress || status === 'CANCELLED' || status === 'DELIVERED_BY_COMPANY' || finished,
  );
  // e1-1 / e1-2: persoana responsabila, datele firmei castigatoare si etapele. Serverul hotaraste
  // cand le trimite (dupa acceptare, doar firma castigatoare, si dupa finalizare — garantia); aici
  // aratam ce primim (company / contact nenule), fara filtru propriu pe stare.
  const fulfillment = useClientFulfillment(
    requestId,
    inProgress || status === 'DELIVERED_BY_COMPANY' || finished,
  );
  const project = fulfillment.data ?? null;

  // E-admin-platform-3: proiectul a fost inchis de echipa Cozy Home (dupa un raport / anulare)
  if (status === 'CANCELLED') {
    const closedAt = cancelledAt ?? projectCase.data?.resolvedAt ?? null;
    return (
      <Card as="section" tone="muted">
        <h2 className="heading-section">{t('projectCase.cancelledTitle')}</h2>
        {closedAt && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t('projectCase.cancelledBody', { date: fmtDate(closedAt) })}
          </p>
        )}
      </Card>
    );
  }

  // audit 2026-08-23 (P0 UX): dupa acceptare clientul vedea un gol total — panou "ce urmeaza"
  if (inProgress) {
    return (
      <div className="flex flex-col gap-4">
        <Card as="section" tone="sage">
          <h2 className="heading-section text-sage">{t('acceptedTitle')}</h2>
          <p className="mt-1 text-sm">
            {acceptedCompany
              ? t('acceptedIntro', { company: acceptedCompany.name })
              : t('acceptedIntroNoName')}
          </p>
          <ol className="mt-3 flex max-w-prose flex-col gap-2.5 text-sm">
            {[t('acceptedStep1'), t('acceptedStep2'), t('acceptedStep3'), t('acceptedStep4')].map(
              (step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-sage/15 font-mono text-meta text-sage">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ),
            )}
          </ol>
          {acceptedCompany &&
            (onOpenCompanyChat ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => onOpenCompanyChat(acceptedCompany.claimSlotId)}
                className="mt-4 h-auto min-h-10 whitespace-normal py-2 text-left"
              >
                {t('acceptedOpenChat', { company: acceptedCompany.name })}
                <ArrowDown aria-hidden />
              </Button>
            ) : (
              <a
                href={`#firm-${acceptedCompany.claimSlotId}`}
                className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-walnut hover:underline"
              >
                {t('acceptedOpenChat', { company: acceptedCompany.name })}
                <ArrowDown className="size-4" aria-hidden />
              </a>
            ))}
        </Card>
        {project && <ProjectContactCard project={project} />}
        {project && <ProjectStagesCard project={project} />}
        {acceptedQuote && <AgreementCard quote={acceptedQuote} requestStatus={status} mode="client" />}
        {!projectCase.isPending && (
          <ProjectCasePanel requestId={requestId} mode="client" projectCase={projectCase.data ?? null} canAct />
        )}
      </div>
    );
  }

  // e randul clientului: confirma primirea (chihlimbar = cere atentie)
  if (status === 'DELIVERED_BY_COMPANY') {
    return (
      <div className="flex flex-col gap-4">
        <DeliveredCard
          requestId={requestId}
          projectCase={projectCase.data ?? null}
          autoCompleteAt={project?.autoCompleteAt ?? null}
        />
        {project && <ProjectContactCard project={project} />}
        {project && <ProjectStagesCard project={project} />}
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex flex-col gap-4">
        {review.data ? (
          <Card as="section">
            <h2 className="heading-section">{t('reviewTitle')}</h2>
            <p className="mt-1 text-sm">
              <span className="text-brass">
                {'★'.repeat(review.data.rating)}
                {'☆'.repeat(5 - review.data.rating)}
              </span>
              {review.data.comment ? ` · ${review.data.comment}` : ''}
              {review.data.disputed ? ` · ${t('disputed')}` : ''}
            </p>
          </Card>
        ) : (
          !review.isPending && <ReviewForm requestId={requestId} />
        )}
        {!projectCase.isPending && <WarrantyReport requestId={requestId} projectCase={projectCase.data ?? null} />}
        {/* m2 (revizie e5): dupa finalizare clientul pastreaza contactul firmei (garantie) */}
        {project && <ProjectContactCard project={project} />}
        {project && <ProjectStagesCard project={project} />}
      </div>
    );
  }

  return null;
}

// e1-1: cine lucreaza la proiect (nume, e-mail, telefon daca exista) + datele firmei
// castigatoare (nume, CUI, adresa). Nimic cat serverul nu le trimite (inainte de acceptare).
function ProjectContactCard({ project }: { project: ClientFulfillmentDto }) {
  const t = useTranslations('Fulfillment.clientProject');
  const titleId = useId();
  const { contact, company } = project;
  if (!contact && !company) return null;
  const place = company ? [company.city, company.county].filter(Boolean).join(', ') : '';
  const linkCls =
    'inline-flex min-h-10 items-center gap-2 font-medium text-walnut [overflow-wrap:anywhere] hover:text-walnut-deep hover:underline';
  return (
    <Card as="section" aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="heading-card">
        {t('contactTitle')}
      </h2>
      {contact && (
        <div className="flex flex-col gap-0.5 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {contact.name}
          </p>
          <p className="text-xs text-muted-foreground">{t('contactRole')}</p>
          <a href={`mailto:${contact.email}`} className={linkCls}>
            <Mail className="h-4 w-4 shrink-0" aria-hidden />
            {contact.email}
          </a>
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className={linkCls}>
              <Phone className="h-4 w-4 shrink-0" aria-hidden />
              {contact.phone}
            </a>
          )}
        </div>
      )}
      {company && (
        <div className="flex items-start gap-2 border-t border-border pt-3 text-sm">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="font-medium">{company.name}</p>
            {company.cui && <p className="text-muted-foreground">{t('cui', { cui: company.cui })}</p>}
            {(company.addressText || place) && (
              <p className="text-muted-foreground">{[company.addressText, place].filter(Boolean).join(', ')}</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// e1-2: etapele bifate de firma (doar de citit), cu data bifarii.
function ProjectStagesCard({ project }: { project: ClientFulfillmentDto }) {
  const t = useTranslations('Fulfillment.stages');
  const tc = useTranslations('Fulfillment.clientProject');
  const fmtDate = useLongDate();
  const titleId = useId();
  if (project.stages.length === 0) return null;
  return (
    <Card as="section" aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="heading-card">
          {tc('stagesTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{tc('stagesIntro')}</p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {project.stages.map((s) => (
          <li key={s.stage} className="flex items-start gap-2.5">
            <span
              className={cn(
                'mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full',
                s.done ? 'bg-sage text-white' : 'border border-border-2',
              )}
              aria-hidden
            >
              {s.done && <Check className="h-3 w-3" />}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className={cn(s.done ? 'font-medium' : 'text-muted-foreground')}>{t(`name.${s.stage}`)}</span>
              <span className="text-xs text-muted-foreground">
                {s.done && s.completedAt ? t('doneOn', { date: fmtDate(s.completedAt) }) : tc('stageNotDone')}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// e2 pasii 2-3: "Confirma livrarea" cere confirmare, cu varianta "Am o problema" (raport OTHER +
// nota). Raportul deschis opreste finalizarea automata pana il inchide echipa Cozy Home (e2-1).
function DeliveredCard({
  requestId,
  projectCase,
  autoCompleteAt,
}: {
  requestId: string;
  projectCase: ProjectCaseDto | null;
  autoCompleteAt: string | null;
}) {
  const t = useTranslations('Fulfillment');
  const apiErrText = useApiErrText();
  const fmtDate = useLongDate();
  const confirm = useConfirmDelivery();
  const report = useOpenProjectCase(requestId, 'client');
  const [dialog, setDialog] = useState<'closed' | 'confirm' | 'problem'>('closed');
  const [note, setNote] = useState('');
  const busy = confirm.isPending || report.isPending;
  const openCase = projectCase?.status === 'OPEN' ? projectCase : null;

  return (
    <Card as="section" tone="amber">
      <h2 className="heading-section text-amber">{t('deliveredTitle')}</h2>
      <p className="mt-1 max-w-prose text-sm">{t('deliveredBody')}</p>
      {/* e1: data finalizarii automate (lipseste cat un raport deschis tine ceasul oprit) */}
      {!openCase && autoCompleteAt && (
        <p className="mt-1 max-w-prose text-sm">{t('clientProject.autoCompleteOn', { date: fmtDate(autoCompleteAt) })}</p>
      )}
      {openCase && (
        <Alert tone="info" className="mt-3">
          {t('deliveredProblemOpen', { date: fmtDate(openCase.createdAt) })}
        </Alert>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="walnut"
          size="lg"
          onClick={() => {
            confirm.reset();
            report.reset();
            setDialog('confirm');
          }}
          disabled={busy}
        >
          {t('confirmDelivery')}
        </Button>
      </div>
      {dialog === 'closed' && apiErrText(confirm) && (
        <p role="alert" className="mt-2 text-sm text-crimson">
          {apiErrText(confirm)}
        </p>
      )}

      <Dialog open={dialog !== 'closed'} onOpenChange={(v) => { if (!busy && !v) setDialog('closed'); }}>
        <DialogContent>
          {dialog === 'confirm' ? (
            <>
              <DialogHeader>
                <DialogTitle>{t('deliveredConfirmTitle')}</DialogTitle>
                <DialogDescription>{t('deliveredConfirmBody')}</DialogDescription>
              </DialogHeader>
              {apiErrText(confirm) && (
                <p role="alert" className="text-sm text-crimson">
                  {apiErrText(confirm)}
                </p>
              )}
              <DialogFooter className="flex-wrap gap-2">
                <Button variant="outline" size="lg" onClick={() => setDialog('closed')} disabled={busy}>
                  {t('deliveredBack')}
                </Button>
                {!openCase && (
                  <Button variant="outline" size="lg" onClick={() => setDialog('problem')} disabled={busy}>
                    {t('deliveredProblem')}
                  </Button>
                )}
                <Button
                  variant="walnut"
                  size="lg"
                  onClick={() => confirm.mutate(requestId, { onSuccess: () => setDialog('closed') })}
                  disabled={busy}
                >
                  {t('deliveredConfirmCta')}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t('deliveredProblemTitle')}</DialogTitle>
                <DialogDescription>{t('deliveredProblemIntro')}</DialogDescription>
              </DialogHeader>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                aria-label={t('deliveredProblemPlaceholder')}
                placeholder={t('deliveredProblemPlaceholder')}
              />
              {apiErrText(report) && (
                <p role="alert" className="text-sm text-crimson">
                  {apiErrText(report)}
                </p>
              )}
              <DialogFooter className="flex-wrap gap-2">
                <Button variant="outline" size="lg" onClick={() => setDialog('confirm')} disabled={busy}>
                  {t('deliveredBack')}
                </Button>
                <Button
                  size="lg"
                  onClick={() =>
                    report.mutate(
                      { reason: 'OTHER', note: note.trim() },
                      {
                        onSuccess: () => {
                          setDialog('closed');
                          setNote('');
                        },
                      },
                    )
                  }
                  disabled={busy || note.trim().length === 0}
                >
                  {t('deliveredProblemSubmit')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// e2 pasul 1: nota porneste goala; trimiterea cere stele si un rezumat
// "Trimiti nota X — nu se mai poate schimba" (sub 3 stele: si avertismentul de disputa).
function ReviewForm({ requestId }: { requestId: string }) {
  const t = useTranslations('Fulfillment');
  const apiErrText = useApiErrText();
  const createReview = useCreateReview(requestId);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [summary, setSummary] = useState(false);
  const lowRating = rating !== null && rating <= 2;

  return (
    <Card as="section" tone="sage" className="flex flex-col gap-3">
      <h2 className="heading-section text-sage">{t('reviewTitle')}</h2>
      <div className="flex gap-0.5" role="group" aria-label={t('reviewPickStars')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setRating(n);
              setSummary(false);
            }}
            aria-label={t('ratingStar', { n })}
            aria-pressed={rating !== null && n <= rating}
            className={cn(
              'grid h-10 w-10 place-items-center rounded-md text-2xl leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut',
              rating !== null && n <= rating ? 'text-brass' : 'text-border-2',
            )}
          >
            ★
          </button>
        ))}
      </div>
      {rating === null && <p className="text-sm text-muted-foreground">{t('reviewPickStars')}</p>}
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder={t('reviewPlaceholder')}
        aria-label={t('reviewPlaceholder')}
        className="min-h-[64px] max-w-2xl"
      />
      {summary && rating !== null && (
        <Alert tone="amber">
          <p className="font-medium">{t('reviewSummary', { rating })}</p>
          {lowRating && <p className="mt-1">{t('lowRatingWarning')}</p>}
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        {summary && rating !== null ? (
          <>
            <Button
              type="button"
              size="lg"
              onClick={() => createReview.mutate({ rating, comment: comment.trim() || undefined })}
              disabled={createReview.isPending}
            >
              {t('reviewSummaryConfirm')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setSummary(false)}
              disabled={createReview.isPending}
            >
              {t('reviewSummaryBack')}
            </Button>
          </>
        ) : (
          <Button type="button" size="lg" onClick={() => setSummary(true)} disabled={rating === null}>
            {t('sendReview')}
          </Button>
        )}
      </div>
      {apiErrText(createReview) && (
        <p role="alert" className="text-sm text-crimson">
          {apiErrText(createReview)}
        </p>
      )}
    </Card>
  );
}

// e2-2: dupa finalizare, "Raporteaza o problema" cat tine garantia din oferta (minimum 24 de
// luni). Raportul devine un caz WARRANTY_CLAIM la echipa Cozy Home; nu schimba proiectul.
function WarrantyReport({ requestId, projectCase }: { requestId: string; projectCase: ProjectCaseDto | null }) {
  const t = useTranslations('Fulfillment.warranty');
  const apiErrText = useApiErrText();
  const fmtDate = useLongDate();
  const win = useWarrantyWindow(requestId);
  const report = useOpenWarrantyCase(requestId);
  const [expanded, setExpanded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [note, setNote] = useState('');

  if (win.isPending || !win.data) return null;
  const w = win.data;
  const openCase = projectCase?.status === 'OPEN' ? projectCase : null;
  const lastWarranty = projectCase?.reason === 'WARRANTY_CLAIM' ? projectCase : null;

  return (
    <Card as="section" className="flex flex-col gap-2.5">
      <h2 className="heading-card">{t('title')}</h2>
      {openCase ? (
        <p className="text-sm">{t('sent', { date: fmtDate(openCase.createdAt) })}</p>
      ) : (
        <>
          {lastWarranty?.status === 'DISMISSED' && lastWarranty.resolvedAt && (
            <p className="text-sm text-muted-foreground">{t('dismissed', { date: fmtDate(lastWarranty.resolvedAt) })}</p>
          )}
          {w.open ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t('intro', { date: fmtDate(w.endsAt), months: w.months })}
              </p>
              {!expanded ? (
                <Button variant="outline" size="lg" className="self-start" onClick={() => setExpanded(true)}>
                  {t('open')}
                </Button>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    aria-label={t('placeholder')}
                    placeholder={t('placeholder')}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="lg" onClick={() => setConfirmOpen(true)} disabled={note.trim().length === 0}>
                      {t('submit')}
                    </Button>
                    <Button variant="outline" size="lg" onClick={() => setExpanded(false)}>
                      {t('cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('closed', { date: fmtDate(w.endsAt) })}</p>
          )}
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={(v) => { if (!report.isPending) setConfirmOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmTitle')}</DialogTitle>
            <DialogDescription>{t('confirmBody')}</DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-wrap break-words rounded-lg bg-surface-2 px-3 py-2 text-sm">{note.trim()}</p>
          {apiErrText(report) && (
            <p role="alert" className="text-sm text-crimson">
              {apiErrText(report)}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setConfirmOpen(false)} disabled={report.isPending}>
              {t('cancel')}
            </Button>
            <Button
              size="lg"
              onClick={() =>
                report.mutate(
                  { note: note.trim() },
                  {
                    onSuccess: () => {
                      setConfirmOpen(false);
                      setExpanded(false);
                      setNote('');
                    },
                  },
                )
              }
              disabled={report.isPending || note.trim().length === 0}
            >
              {t('submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
