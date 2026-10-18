'use client';

import { useTranslations } from 'next-intl';
import { firmRulesChunk } from './firm-rules-link';

// E-company-9: trimitere din pagina Termenilor catre regulile pentru firme.
// Sta sub articol, in afara textului juridic versionat (Legal.terms) → fara bump de versiune.
export function FirmRulesCta() {
  const t = useTranslations('Legal');
  return (
    <p className="mx-auto mt-10 max-w-3xl border-t border-border pt-6 text-sm text-muted-foreground">
      {t.rich('firmRulesCta', { rules: firmRulesChunk() })}
    </p>
  );
}
