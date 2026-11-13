'use client';

import { MARKETPLACE_CLOSED_REASONS, type RequestNoLongerClaimableDetails } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

// details din eroarea REQUEST_NO_LONGER_CLAIMABLE, citite defensiv (motiv necunoscut → CLOSED)
export function closedDetails(raw: unknown): RequestNoLongerClaimableDetails {
  const d = (raw ?? {}) as Partial<RequestNoLongerClaimableDetails>;
  const reason = (MARKETPLACE_CLOSED_REASONS as readonly string[]).includes(d.reason ?? '')
    ? (d.reason as RequestNoLongerClaimableDetails['reason'])
    : 'CLOSED';
  return { reason, myClaimSlotId: typeof d.myClaimSlotId === 'string' ? d.myClaimSlotId : null };
}

// a1: cererea nu mai poate fi preluata — motivul + drumul inapoi (si fisa, daca firma a preluat-o)
export function ClosedRequestNotice({ details }: { details: RequestNoLongerClaimableDetails }) {
  const t = useTranslations('Marketplace');
  return (
    <EmptyState
      tone="warning"
      variant="card"
      role="status"
      title={t('closedRequest.title')}
      hint={t(`closedRequest.reason.${details.reason}`)}
      action={
        <>
          {details.myClaimSlotId && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/marketplace/claims/${details.myClaimSlotId}`}>{t('closedRequest.openWorksheet')}</Link>
            </Button>
          )}
          <Link href="/marketplace" className="text-sm text-walnut hover:underline">
            ← {t('back')}
          </Link>
        </>
      }
    />
  );
}
