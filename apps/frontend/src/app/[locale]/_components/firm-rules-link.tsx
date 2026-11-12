'use client';

import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';

// Ruta paginii publice "Reguli pentru firme" — un singur loc (linkuri in text + butonul din Termeni).
export const FIRM_RULES_PATH = '/firm-rules';

// E-company-9: link catre pagina publica "Reguli pentru firme". newTab in formulare/dialoguri,
// ca userul sa nu piarda starea (checkbox-ul din inregistrare, dialogul de plata).
export function FirmRulesLink({
  anchor,
  newTab,
  className,
  children,
}: {
  anchor?: string;
  newTab?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={`${FIRM_RULES_PATH}${anchor ? `#${anchor}` : ''}`}
      className={className ?? 'text-walnut underline'}
      target={newTab ? '_blank' : undefined}
    >
      {children}
    </Link>
  );
}

// Callback pentru t.rich('...', { rules: firmRulesChunk('sla') }) — un singur loc pentru stilul linkului.
export function firmRulesChunk(anchor?: string, newTab?: boolean) {
  const RulesChunk = (chunks: ReactNode) => (
    <FirmRulesLink anchor={anchor} newTab={newTab}>
      {chunks}
    </FirmRulesLink>
  );
  return RulesChunk;
}
