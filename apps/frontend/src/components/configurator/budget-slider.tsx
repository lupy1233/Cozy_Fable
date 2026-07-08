'use client';

import { budgetRangeFromRon, type BudgetRange } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// Slider de buget (F5, item 18): cand avem estimarea din scor (POST
// /requests/estimate), sliderul e NUMERIC intre [estimare, 3× estimare] —
// valoarea aleasa se trimite ca budgetEstimateRon, iar bucket-ul budget_range
// se deriva din ea (filtrele si scoringul raman pe bucket-uri). Fara estimare
// (scor 0 / API indisponibil), cade pe treptele vechi. UNDISCLOSED ramane.

const STEPS: BudgetRange[] = ['UNDER_5K', 'FROM_5K_TO_15K', 'OVER_15K'];
const RON_STEP = 500;

const fmtRon = (v: number) => `${new Intl.NumberFormat('ro-RO').format(v)} lei`;

export function BudgetSlider({
  value,
  onChange,
  estimate,
  valueRon,
  onChangeRon,
}: {
  value: BudgetRange;
  onChange: (v: BudgetRange) => void;
  // intervalul estimat din scor; null/undefined → fallback pe trepte
  estimate?: { minRon: number; maxRon: number } | null;
  valueRon?: number | null;
  onChangeRon?: (ron: number | null) => void;
}) {
  const t = useTranslations('Requests');
  const undisclosed = value === 'UNDISCLOSED';
  const hasEstimate = !!estimate && estimate.minRon > 0 && !!onChangeRon;

  const setRon = (ron: number) => {
    onChangeRon?.(ron);
    onChange(budgetRangeFromRon(ron));
  };

  return (
    <div className="flex flex-col gap-3">
      {hasEstimate ? (
        <div className={cn('flex flex-col gap-2', undisclosed && 'opacity-40')}>
          {/* estimarea orientativa calculata din raspunsurile formularului */}
          <p className="text-xs text-muted-foreground">
            {t('budgetEstimateHint', {
              min: fmtRon(estimate.minRon),
              max: fmtRon(estimate.maxRon),
            })}
          </p>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-serif text-2xl tabular-nums">
              {fmtRon(valueRon ?? estimate.minRon)}
            </span>
          </div>
          <input
            type="range"
            min={estimate.minRon}
            max={estimate.maxRon}
            step={RON_STEP}
            value={valueRon ?? estimate.minRon}
            disabled={undisclosed}
            onChange={(e) => setRon(Number(e.target.value))}
            className="accent-walnut"
            aria-label={t('field.budgetRange')}
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{fmtRon(estimate.minRon)}</span>
            <span>{fmtRon(Math.round((estimate.minRon + estimate.maxRon) / 2 / RON_STEP) * RON_STEP)}</span>
            <span>{fmtRon(estimate.maxRon)}</span>
          </div>
        </div>
      ) : (
        <div className={cn('flex flex-col gap-1.5', undisclosed && 'opacity-40')}>
          <input
            type="range"
            min={0}
            max={STEPS.length - 1}
            step={1}
            value={Math.max(0, STEPS.indexOf(value as (typeof STEPS)[number]))}
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
                  i === Math.max(0, STEPS.indexOf(value as (typeof STEPS)[number])) && !undisclosed
                    ? 'font-semibold text-walnut'
                    : 'hover:text-foreground',
                )}
              >
                {t(`budget.${s}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-walnut"
          checked={undisclosed}
          onChange={(e) => {
            if (e.target.checked) {
              onChange('UNDISCLOSED');
              onChangeRon?.(null);
            } else if (hasEstimate) {
              setRon(estimate.minRon);
            } else {
              onChange('UNDER_5K');
            }
          }}
        />
        {t('budget.UNDISCLOSED')}
      </label>
    </div>
  );
}
