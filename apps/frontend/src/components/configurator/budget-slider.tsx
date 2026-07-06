'use client';

import type { BudgetRange } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// Slider de buget cu 3 trepte (se "aseaza" pe intervalele existente) + optiunea
// "nu doresc sa impartasesc bugetul" (UNDISCLOSED). Nu stocam valoare numerica:
// scoringul foloseste aceleasi intervale ca pana acum.

const STEPS: BudgetRange[] = ['UNDER_5K', 'FROM_5K_TO_15K', 'OVER_15K'];

export function BudgetSlider({
  value,
  onChange,
}: {
  value: BudgetRange;
  onChange: (v: BudgetRange) => void;
}) {
  const t = useTranslations('Requests');
  const undisclosed = value === 'UNDISCLOSED';
  const index = Math.max(0, STEPS.indexOf(value as (typeof STEPS)[number]));

  return (
    <div className="flex flex-col gap-3">
      <div className={cn('flex flex-col gap-1.5', undisclosed && 'opacity-40')}>
        <input
          type="range"
          min={0}
          max={STEPS.length - 1}
          step={1}
          value={index}
          disabled={undisclosed}
          onChange={(e) => onChange(STEPS[Number(e.target.value)])}
          className="accent-walnut"
          aria-label={t('field.budgetRange')}
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          {STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              disabled={undisclosed}
              onClick={() => onChange(s)}
              className={cn(
                'rounded px-1 transition-colors',
                i === index && !undisclosed ? 'font-semibold text-walnut' : 'hover:text-foreground',
              )}
            >
              {t(`budget.${s}`)}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-walnut"
          checked={undisclosed}
          onChange={(e) => onChange(e.target.checked ? 'UNDISCLOSED' : 'UNDER_5K')}
        />
        {t('budget.UNDISCLOSED')}
      </label>
    </div>
  );
}
