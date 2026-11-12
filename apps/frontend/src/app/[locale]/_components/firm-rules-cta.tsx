'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FIRM_RULES_PATH } from './firm-rules-link';

// E-company-9: trimitere din pagina Termenilor catre regulile pentru firme.
// Sta sub sectiuni, in afara textului juridic versionat (Legal.terms.sections) → fara bump de versiune.
// Design 2026-11: card la finalul articolului, cu buton spre Regulile pentru firme.
export function FirmRulesCta() {
  const t = useTranslations('Legal');
  return (
    <Card
      as="aside"
      padding="none"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-5"
    >
      <p className="max-w-[460px] text-sm text-ink-2">
        <span className="font-semibold text-foreground">{t('firmRulesCard.lead')}</span> {t('firmRulesCard.body')}
      </p>
      <Button asChild variant="outline" size="lg" className="h-11">
        <Link href={FIRM_RULES_PATH}>
          {t('firmRules.title')}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    </Card>
  );
}
