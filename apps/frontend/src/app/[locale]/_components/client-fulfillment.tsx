'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { QuoteDto } from '@marketplace/shared';
import { ApiError } from '@/lib/api';
import { useConfirmDelivery, useCreateReview, useProjectCase, useReview } from '@/hooks/use-fulfillment';
import { AgreementCard } from './agreement-card';
import { ProjectCasePanel } from './project-case-panel';

// Sectiune client pe pagina de oferte: pasii de dupa acceptare (ACCEPTED/IN_EXECUTION),
// confirmare livrare (DELIVERED_BY_COMPANY) + review (COMPLETED/DISPUTED).
export function ClientFulfillment({
  requestId,
  status,
  acceptedCompany,
  acceptedQuote,
  cancelledAt,
}: {
  requestId: string;
  status: string;
  // firma castigatoare — pentru panoul "ce urmeaza" + ancora spre conversatia ei
  acceptedCompany?: { name: string; claimSlotId: string } | null;
  // E-admin-platform-3: oferta acceptata — pentru cardul "Acordul vostru"
  acceptedQuote?: QuoteDto | null;
  // E-admin-platform-3: momentul inchiderii proiectului (status CANCELLED)
  cancelledAt?: string | null;
}) {
  const t = useTranslations('Fulfillment');
  const confirm = useConfirmDelivery();
  const review = useReview(requestId);
  const inProgress = status === 'ACCEPTED' || status === 'IN_EXECUTION';
  const projectCase = useProjectCase(requestId, inProgress || status === 'CANCELLED');
  const createReview = useCreateReview(requestId);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  // audit 2026-08-23: sub 3 stele se deschide automat o disputa — avertizam inainte de trimitere
  const [lowRatingWarned, setLowRatingWarned] = useState(false);
  const lowRating = rating <= 2;
  const apiErr = (m: { error: unknown }) =>
    m.error instanceof ApiError
      ? t.has(`apiErrors.${m.error.code}`)
        ? t(`apiErrors.${m.error.code}`)
        : t('apiErrors.INTERNAL_ERROR')
      : m.error
        ? t('apiErrors.INTERNAL_ERROR')
        : null;

  // E-admin-platform-3: proiectul a fost inchis de echipa Cozy Home (dupa un raport / anulare)
  if (status === 'CANCELLED') {
    const closedAt = cancelledAt ?? projectCase.data?.resolvedAt ?? null;
    return (
      <section className="rounded-xl border border-border bg-surface-2 p-4">
        <h2 className="font-serif text-lg">{t('projectCase.cancelledTitle')}</h2>
        {closedAt && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t('projectCase.cancelledBody', { date: new Date(closedAt).toLocaleDateString() })}
          </p>
        )}
      </section>
    );
  }

  // audit 2026-08-23 (P0 UX): dupa acceptare clientul vedea un gol total — panou "ce urmeaza"
  if (inProgress) {
    return (
      <div className="flex flex-col gap-4">
        <section className="rounded-xl border border-sage/30 bg-sage-soft p-4">
          <h2 className="font-serif text-lg text-sage">{t('acceptedTitle')}</h2>
          <p className="mt-1 text-sm">
            {acceptedCompany
              ? t('acceptedIntro', { company: acceptedCompany.name })
              : t('acceptedIntroNoName')}
          </p>
          <ol className="mt-3 flex flex-col gap-2 text-sm">
            {[t('acceptedStep1'), t('acceptedStep2'), t('acceptedStep3'), t('acceptedStep4')].map(
              (step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-sage/15 font-serif text-meta text-sage">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ),
            )}
          </ol>
          {acceptedCompany && (
            <a
              href={`#firm-${acceptedCompany.claimSlotId}`}
              className="mt-3 inline-block text-sm font-medium text-walnut hover:underline"
            >
              {t('acceptedOpenChat', { company: acceptedCompany.name })} ↓
            </a>
          )}
        </section>
        {acceptedQuote && <AgreementCard quote={acceptedQuote} requestStatus={status} mode="client" />}
        {!projectCase.isPending && (
          <ProjectCasePanel requestId={requestId} mode="client" projectCase={projectCase.data ?? null} canAct />
        )}
      </div>
    );
  }

  if (status === 'DELIVERED_BY_COMPANY') {
    return (
      <section className="rounded-xl border border-info/30 bg-info-soft p-4">
        <h2 className="font-serif text-lg text-info">{t('deliveredTitle')}</h2>
        <p className="mt-1 text-sm text-info">{t('deliveredBody')}</p>
        <button
          onClick={() => confirm.mutate(requestId)}
          disabled={confirm.isPending}
          className="mt-2 rounded-md bg-sage px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {t('confirmDelivery')}
        </button>
        {apiErr(confirm) && <p className="mt-2 text-sm text-crimson">{apiErr(confirm)}</p>}
      </section>
    );
  }

  if ((status === 'COMPLETED' || status === 'DISPUTED')) {
    if (review.data) {
      return (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="font-serif text-lg">{t('reviewTitle')}</h2>
          <p className="mt-1 text-sm">
            <span className="text-brass">
              {'★'.repeat(review.data.rating)}
              {'☆'.repeat(5 - review.data.rating)}
            </span>{' '}
            · {review.data.comment}
            {review.data.disputed ? ` · ${t('disputed')}` : ''}
          </p>
        </section>
      );
    }
    return (
      <section className="flex flex-col gap-2 rounded-xl border border-sage/30 bg-sage-soft p-4">
        <h2 className="font-serif text-lg text-sage">{t('reviewTitle')}</h2>
        <div className="flex gap-1 text-2xl">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => {
                setRating(n);
                setLowRatingWarned(false);
              }}
              aria-label={t('ratingStar', { n })}
              aria-pressed={n <= rating}
              className={n <= rating ? 'text-brass' : 'text-border-2'}
            >
              ★
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder={t('reviewPlaceholder')}
          className="rounded-md border border-border-2 bg-surface px-3 py-2 text-sm focus-visible:border-foreground focus-visible:outline-none"
        />
        {lowRatingWarned && lowRating && (
          <div className="rounded-md border border-amber/25 bg-amber-soft px-3 py-2 text-sm text-amber">
            {t('lowRatingWarning')}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              if (lowRating && !lowRatingWarned) {
                setLowRatingWarned(true);
                return;
              }
              createReview.mutate({ rating, comment: comment.trim() || undefined });
            }}
            disabled={createReview.isPending}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-ink-2 disabled:opacity-50"
          >
            {lowRatingWarned && lowRating ? t('lowRatingConfirm') : t('sendReview')}
          </button>
          {lowRatingWarned && lowRating && (
            <button
              onClick={() => setLowRatingWarned(false)}
              className="rounded-lg border border-border-2 bg-surface px-4 py-2 text-sm transition-colors hover:bg-secondary"
            >
              {t('lowRatingCancel')}
            </button>
          )}
        </div>
        {apiErr(createReview) && <p className="text-sm text-crimson">{apiErr(createReview)}</p>}
      </section>
    );
  }

  return null;
}
