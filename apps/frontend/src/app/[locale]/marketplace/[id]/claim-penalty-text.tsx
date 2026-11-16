'use client';

import type { FirmRulesDto } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { firmRulesChunk } from '../../_components/firm-rules-link';

// i3 (etapa 12): frazele cu puncte de penalizare din panoul si dialogul de preluare folosesc
// valorile reale din GET /legal/firm-rules (ca pagina Regulilor pentru firme). O regula cu 0 puncte
// nu pomeneste puncte. m8 (revizie): cat timp regulile se incarca sau cererea pica (rules = null)
// se arata varianta neutra FARA puncte; punctele apar doar cand valoarea e cunoscuta si nenula.

// randul „termen de raspuns depasit” din panoul de preluare
export function ClaimPanelSlaRule({ rules }: { rules: FirmRulesDto | null }) {
  const t = useTranslations('Marketplace.claimPanel');
  const points = rules?.penalties.points.SLA_MISS ?? 0;
  return <>{points > 0 ? t('ruleSlaPoints', { points }) : t('ruleSlaNoPoints')}</>;
}

// dialogul de preluare: retragerea dupa perioada de gratie (doar cu regulile incarcate)
export function ClaimDialogGraceLine({ rules }: { rules: FirmRulesDto | null }) {
  const t = useTranslations('Marketplace');
  const tu = useTranslations('Legal.firmRules.units');
  if (!rules) return null;
  const minutes = tu('minute', { n: rules.withdrawals.voluntaryGraceMinutes });
  const points = rules.penalties.points.VOLUNTARY_WITHDRAWAL;
  return (
    <p>
      {points > 0
        ? t('claimConfirmGrace', { minutes, points: tu('point', { n: points }) })
        : t('claimConfirmGraceNoPoints', { minutes })}
    </p>
  );
}

// dialogul de preluare: nota despre termenul de raspuns, cu legatura spre Reguli
export function ClaimDialogRulesNote({ rules }: { rules: FirmRulesDto | null }) {
  const t = useTranslations('Marketplace');
  const link = { rules: firmRulesChunk('sla') };
  const points = rules?.penalties.points.SLA_MISS ?? 0;
  return (
    <p className="text-xs text-muted-foreground">
      {points > 0 ? t.rich('claimRulesNotePoints', { ...link, points }) : t.rich('claimRulesNoteNoPoints', link)}
    </p>
  );
}
