'use client';

import type { ClaimSlotStatus } from '@marketplace/shared';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useMyClaims } from '@/hooks/use-marketplace';
import { Button } from '@/components/ui/button';

// Statusurile care ocupa un loc pe cerere — aceleasi din care API-ul calculeaza
// `alreadyClaimedByMyCompany` (OCCUPYING_CLAIM_STATUSES in backend).
const OCCUPYING: readonly ClaimSlotStatus[] = ['ACTIVE', 'OFFER_SENT', 'COMPLETED'];

// Pasul urmator pentru o cerere deja preluata de firma: fisa de lucru a preluarii.
// Cardul din marketplace are doar id-ul cererii, asa ca id-ul preluarii vine din lista
// "Preluarile mele" (acelasi cache). Componenta se monteaza doar pe cererile preluate,
// deci lista se cere doar cand e nevoie; pana se incarca (sau daca esueaza) linkul duce
// la lista de preluari.
export function WorksheetButton({
  requestId,
  variant = 'outline',
  className,
}: {
  requestId: string;
  variant?: 'outline' | 'default';
  className?: string;
}) {
  const t = useTranslations('Marketplace');
  const claims = useMyClaims();
  // lista vine cu cele mai noi intai → prima potrivire e preluarea curenta
  const mine = Array.isArray(claims.data) ? claims.data : [];
  const claimId =
    mine.find((c) => c.requestId === requestId && OCCUPYING.includes(c.status))?.id ?? null;

  return (
    <Button asChild variant={variant} size="lg" className={className}>
      <Link href={claimId ? `/marketplace/claims/${claimId}` : '/marketplace/claims'}>
        {t('openWorksheet')}
        <ArrowRight aria-hidden />
      </Link>
    </Button>
  );
}
