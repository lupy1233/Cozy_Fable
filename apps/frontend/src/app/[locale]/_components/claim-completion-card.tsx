'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { useCompanyCompletion } from '@/hooks/use-fulfillment';
import { useLongDate } from './use-long-date';

const SHOWN_STATUSES = ['DELIVERED_BY_COMPANY', 'COMPLETED', 'DISPUTED'];

// e2 pasul 4 — pe fisa firmei castigatoare: "Livrare confirmata" + recenzia primita dupa
// finalizare; in starea livrata (sau in garantie) anunta raportul deschis al clientului.
// Componenta isi ia singura datele (GET /company/requests/:id/completion, doar castigatorul).
export function ClaimCompletionCard({ requestId, requestStatus }: { requestId: string; requestStatus: string }) {
  const t = useTranslations('Fulfillment.completion');
  // review m10: limba aplicatiei + ora Romaniei, luna in litere
  const fmtDate = useLongDate();
  const enabled = SHOWN_STATUSES.includes(requestStatus);
  const completion = useCompanyCompletion(requestId, enabled);
  if (!enabled || !completion.data) return null;
  const c = completion.data;
  const finished = c.requestStatus === 'COMPLETED' || c.requestStatus === 'DISPUTED';

  const caseNotice = c.openCase && (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        {c.openCase.reason === 'WARRANTY_CLAIM'
          ? t('openCaseWarranty', { date: fmtDate(c.openCase.createdAt) })
          : t('openCaseDelivered', { date: fmtDate(c.openCase.createdAt) })}
      </p>
      {c.openCase.note && <p className="whitespace-pre-wrap break-words italic">{t('clientNote', { note: c.openCase.note })}</p>}
    </div>
  );

  if (!finished) {
    // starea livrata: cardul apare doar cand clientul a raportat o problema
    if (!c.openCase) return null;
    return (
      <Card as="section" tone="amber" className="flex flex-col gap-2">
        <h2 className="heading-card text-amber">{t('deliveredTitle')}</h2>
        {caseNotice}
      </Card>
    );
  }

  return (
    <Card as="section" tone="sage" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="heading-card text-sage">{t('title')}</h2>
        <p className="text-sm">{c.completedAt ? t('completedOn', { date: fmtDate(c.completedAt) }) : t('completed')}</p>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <h3 className="label">{t('reviewTitle')}</h3>
        {c.review ? (
          <>
            <p>
              <span className="text-brass" aria-label={`${c.review.rating}/5`}>
                {'★'.repeat(c.review.rating)}
                {'☆'.repeat(5 - c.review.rating)}
              </span>
              {c.review.comment ? ` · ${c.review.comment}` : ''}
            </p>
            {c.review.disputed && <p className="text-muted-foreground">{t('disputed')}</p>}
          </>
        ) : (
          <p className="text-muted-foreground">{t('noReview')}</p>
        )}
      </div>
      {caseNotice}
    </Card>
  );
}
