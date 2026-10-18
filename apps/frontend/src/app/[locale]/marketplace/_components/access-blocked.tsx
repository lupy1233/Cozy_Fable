'use client';

import { AlertTriangle, Lock, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

// Ecran de blocaj pentru paginile firmei (marketplace, preluari, mesaje) cand API-ul
// raspunde 403/404: firma neaprobata / suspendata / fara abonament → mesaj + CTA,
// altfel eroare generica cu "Reincearca". Fara pagina goala (audit 2026-08-19, P1).
// E-admin-platform-58: PLAN_FEATURE_REQUIRED = abonament activ, dar planul nu include marketplace-ul.
const KNOWN = ['SUBSCRIPTION_INACTIVE', 'PLAN_FEATURE_REQUIRED', 'COMPANY_NOT_APPROVED', 'COMPANY_SUSPENDED'] as const;
type Known = (typeof KNOWN)[number];

export function AccessBlocked({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTranslations('Marketplace');
  const code = error instanceof ApiError ? error.code : null;
  const known = (KNOWN as readonly string[]).includes(code ?? '') ? (code as Known) : null;

  const isSubscription = known === 'SUBSCRIPTION_INACTIVE' || known === 'PLAN_FEATURE_REQUIRED';
  const isCompany = known === 'COMPANY_NOT_APPROVED' || known === 'COMPANY_SUSPENDED';

  const action = isSubscription ? (
    <Button asChild variant="walnut">
      <Link href="/marketplace/wallet#subscription">{t('accessBlocked.cta.subscription')}</Link>
    </Button>
  ) : isCompany ? (
    <Button asChild variant="walnut">
      <Link href="/company">{t('accessBlocked.cta.company')}</Link>
    </Button>
  ) : onRetry ? (
    <Button variant="outline" onClick={onRetry}>
      <RefreshCw /> {t('accessBlocked.cta.retry')}
    </Button>
  ) : undefined;

  return (
    <EmptyState
      variant="card"
      className="mx-auto max-w-lg"
      tone={known ? 'warning' : 'error'}
      role="alert"
      icon={known ? Lock : AlertTriangle}
      title={known ? t(`accessBlocked.title.${known}`) : t('accessBlocked.title.generic')}
      hint={known ? t(`apiErrors.${known}`) : t('apiErrors.INTERNAL_ERROR')}
      action={action}
    />
  );
}
