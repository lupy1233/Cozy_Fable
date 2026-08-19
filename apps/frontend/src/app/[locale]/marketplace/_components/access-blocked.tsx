'use client';

import { AlertTriangle, Lock, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';

// Ecran de blocaj pentru paginile firmei (marketplace, preluari, mesaje) cand API-ul
// raspunde 403/404: firma neaprobata / suspendata / fara abonament → mesaj + CTA,
// altfel eroare generica cu "Reincearca". Fara pagina goala (audit 2026-08-19, P1).
const KNOWN = ['SUBSCRIPTION_INACTIVE', 'COMPANY_NOT_APPROVED', 'COMPANY_SUSPENDED'] as const;
type Known = (typeof KNOWN)[number];

export function AccessBlocked({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTranslations('Marketplace');
  const code = error instanceof ApiError ? error.code : null;
  const known = (KNOWN as readonly string[]).includes(code ?? '') ? (code as Known) : null;

  const isSubscription = known === 'SUBSCRIPTION_INACTIVE';
  const isCompany = known === 'COMPANY_NOT_APPROVED' || known === 'COMPANY_SUSPENDED';

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-6 py-12 text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-soft text-amber">
        {known ? <Lock className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
      </span>
      <h2 className="font-serif text-2xl">
        {known ? t(`accessBlocked.title.${known}`) : t('accessBlocked.title.generic')}
      </h2>
      <p className="text-sm text-muted-foreground">
        {known ? t(`apiErrors.${known}`) : t('apiErrors.INTERNAL_ERROR')}
      </p>
      {isSubscription && (
        <Button asChild variant="walnut">
          <Link href="/marketplace/wallet#subscription">{t('accessBlocked.cta.subscription')}</Link>
        </Button>
      )}
      {isCompany && (
        <Button asChild variant="walnut">
          <Link href="/company">{t('accessBlocked.cta.company')}</Link>
        </Button>
      )}
      {!known && onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw /> {t('accessBlocked.cta.retry')}
        </Button>
      )}
    </div>
  );
}
