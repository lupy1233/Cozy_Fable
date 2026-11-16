'use client';

import { ArrowDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { QuoteDto } from '@marketplace/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
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
      <Card as="section" tone="muted">
        <h2 className="heading-section">{t('projectCase.cancelledTitle')}</h2>
        {closedAt && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t('projectCase.cancelledBody', { date: new Date(closedAt).toLocaleDateString() })}
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
      <Card as="section" tone="amber">
        <h2 className="heading-section text-amber">{t('deliveredTitle')}</h2>
        <p className="mt-1 max-w-prose text-sm">{t('deliveredBody')}</p>
        <Button
          type="button"
          variant="walnut"
          size="lg"
          onClick={() => confirm.mutate(requestId)}
          disabled={confirm.isPending}
          className="mt-3"
        >
          {t('confirmDelivery')}
        </Button>
        {apiErr(confirm) && (
          <p role="alert" className="mt-2 text-sm text-crimson">
            {apiErr(confirm)}
          </p>
        )}
      </Card>
    );
  }

  if (status === 'COMPLETED' || status === 'DISPUTED') {
    if (review.data) {
      return (
        <Card as="section">
          <h2 className="heading-section">{t('reviewTitle')}</h2>
          <p className="mt-1 text-sm">
            <span className="text-brass">
              {'★'.repeat(review.data.rating)}
              {'☆'.repeat(5 - review.data.rating)}
            </span>{' '}
            · {review.data.comment}
            {review.data.disputed ? ` · ${t('disputed')}` : ''}
          </p>
        </Card>
      );
    }
    return (
      <Card as="section" tone="sage" className="flex flex-col gap-3">
        <h2 className="heading-section text-sage">{t('reviewTitle')}</h2>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setRating(n);
                setLowRatingWarned(false);
              }}
              aria-label={t('ratingStar', { n })}
              aria-pressed={n <= rating}
              className={cn(
                'grid h-10 w-10 place-items-center rounded-md text-2xl leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut',
                n <= rating ? 'text-brass' : 'text-border-2',
              )}
            >
              ★
            </button>
          ))}
        </div>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder={t('reviewPlaceholder')}
          aria-label={t('reviewPlaceholder')}
          className="min-h-[64px] max-w-2xl"
        />
        {lowRatingWarned && lowRating && <Alert tone="amber">{t('lowRatingWarning')}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            onClick={() => {
              if (lowRating && !lowRatingWarned) {
                setLowRatingWarned(true);
                return;
              }
              createReview.mutate({ rating, comment: comment.trim() || undefined });
            }}
            disabled={createReview.isPending}
          >
            {lowRatingWarned && lowRating ? t('lowRatingConfirm') : t('sendReview')}
          </Button>
          {lowRatingWarned && lowRating && (
            <Button type="button" variant="outline" size="lg" onClick={() => setLowRatingWarned(false)}>
              {t('lowRatingCancel')}
            </Button>
          )}
        </div>
        {apiErr(createReview) && (
          <p role="alert" className="text-sm text-crimson">
            {apiErr(createReview)}
          </p>
        )}
      </Card>
    );
  }

  return null;
}
