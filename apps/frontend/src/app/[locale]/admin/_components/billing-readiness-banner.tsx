'use client';

import { AlertTriangle, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Alert } from '@/components/ui/alert';
import { useBillingReadiness } from '@/hooks/use-billing';

// E-admin-platform-4 — pe fiecare pagina /admin: date fiscale incomplete (cumpararile si
// confirmarile sunt oprite), Stripe in mod test, facturi de raportat in e-Factura.
export function BillingReadinessBanner() {
  const t = useTranslations('Admin');
  const readiness = useBillingReadiness();
  if (!readiness.data) return null;
  const { ready, stripeMode, eInvoicePendingCount } = readiness.data;
  if (ready && stripeMode !== 'test' && eInvoicePendingCount === 0) return null;

  const cta = 'shrink-0 self-center text-sm font-medium underline-offset-2 hover:underline';
  return (
    <div className="mb-6 flex flex-col gap-3">
      {!ready && (
        <Alert
          tone="crimson"
          icon={<AlertTriangle />}
          title={t('billingBanner.title')}
          action={
            <Link href="/admin/settings#fiscal" className={cta}>
              {t('billingBanner.cta')}
            </Link>
          }
        >
          {t('billingBanner.body')}
        </Alert>
      )}
      {stripeMode === 'test' && (
        <Alert tone="amber" icon={<AlertTriangle />} title={t('billingBanner.testModeTitle')}>
          {t('billingBanner.testModeBody')}
        </Alert>
      )}
      {eInvoicePendingCount > 0 && (
        <Alert
          tone="info"
          icon={<FileText />}
          action={
            <Link href="/admin/payments" className={cta}>
              {t('billingBanner.eInvoiceCta')}
            </Link>
          }
        >
          {t('billingBanner.eInvoicePending', { n: eInvoicePendingCount })}
        </Alert>
      )}
    </div>
  );
}
