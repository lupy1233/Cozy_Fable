'use client';

import {
  summarizeAnswers,
  type AnswerMap,
  type RequestItemInput,
  type RoomType,
} from '@marketplace/shared';
import { useTranslations } from 'next-intl';

// Randare Q→A a raspunsurilor unei camere, partajata de pasul Review si de paginile
// de detaliu (client + marketplace). Cheile de continut vin din flow config (i18n).
export function RoomAnswerSummary({
  roomType,
  answers,
  flowVersion,
}: {
  roomType: RoomType;
  answers: Record<string, unknown>;
  // versiunea flow-ului cu care au fost salvate raspunsurile (null = pre-versionare → 1)
  flowVersion?: number | null;
}) {
  const t = useTranslations('Configurator');
  const entries = summarizeAnswers(roomType, answers as AnswerMap, flowVersion ?? 1);

  if (entries.length === 0) return null;

  const pieceLine = (p: RequestItemInput) => {
    const systems = p.systems.map((s) => t(`common.systems.${s}.label`)).join(', ');
    const material = t(`common.materials.${p.material}.label`);
    return `${p.quantity}× ${p.name} — ${material}${systems ? ` · ${systems}` : ''}`;
  };

  return (
    <dl className="flex flex-col divide-y divide-border-2">
      {entries.map((e) => (
        <div key={e.stepId} className="flex flex-col gap-1 py-2 sm:flex-row sm:gap-4">
          <dt className="text-sm font-medium text-muted-foreground sm:w-2/5">{t(e.labelKey)}</dt>
          <dd className="flex-1 text-sm">
            {e.kind === 'choice' && e.optionLabelKeys.map((k) => t(k)).join(', ')}
            {e.kind === 'boolean' && t(e.value ? 'common.boolean.yes' : 'common.boolean.no')}
            {e.kind === 'dimensions' &&
              e.slots.map((s) => `${t(s.labelKey)}: ${s.value} m`).join(' · ')}
            {e.kind === 'number' && e.value}
            {e.kind === 'text' && <span className="whitespace-pre-wrap">{e.value}</span>}
            {e.kind === 'pieces' && (
              <ul className="flex flex-col gap-0.5">
                {e.pieces.map((p, i) => (
                  <li key={i}>{pieceLine(p)}</li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
