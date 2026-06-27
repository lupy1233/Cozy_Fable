'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useConfirmDelivery, useCreateReview, useReview } from '@/hooks/use-fulfillment';

// Sectiune client pe pagina de oferte: confirmare livrare (DELIVERED_BY_COMPANY) + review (COMPLETED).
export function ClientFulfillment({ requestId, status }: { requestId: string; status: string }) {
  const t = useTranslations('Fulfillment');
  const confirm = useConfirmDelivery();
  const review = useReview(requestId);
  const createReview = useCreateReview(requestId);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

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
            <button key={n} onClick={() => setRating(n)} className={n <= rating ? 'text-brass' : 'text-border-2'}>
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
        <button
          onClick={() => createReview.mutate({ rating, comment: comment.trim() || undefined })}
          disabled={createReview.isPending}
          className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-ink-2 disabled:opacity-50"
        >
          {t('sendReview')}
        </button>
      </section>
    );
  }

  return null;
}
