'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSessionRole } from '@/hooks/use-auth';

// Design 2026-11: indemnul de la finalul Regulilor pentru firme. Doar pentru vizitatorii fara
// sesiune: cine are deja cont (client, firma, admin) nu are ce inscrie.
export function FirmSignupCta() {
  const t = useTranslations('Legal.firmRules.cta');
  const { role } = useSessionRole();
  if (role !== null) return null;

  return (
    <Card as="aside" padding="lg" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3.5">
      <div className="flex flex-col gap-1">
        <p className="heading-section">{t('title')}</p>
        <p className="text-sm text-muted-foreground">{t('hint')}</p>
      </div>
      <Button asChild variant="walnut" size="lg" className="h-11">
        <Link href="/register?role=company">{t('action')}</Link>
      </Button>
    </Card>
  );
}
