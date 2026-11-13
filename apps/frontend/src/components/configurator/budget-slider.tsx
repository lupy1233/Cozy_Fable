'use client';

import { BUDGET_SLIDER_STEP_RON, budgetSliderBounds, isBudgetBelowEstimate } from '@marketplace/shared';
import { AlertTriangle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { formatLei } from '@/lib/money';
import { cn } from '@/lib/utils';

// Glisorul de buget (b11, PO 2026-11-13). Clientul ALEGE o suma sau "Prefer sa nu spun":
// glisorul porneste fara cursor si fara suma pusa din oficiu. Coboara pana la o treime din
// estimarea din raspunsuri (cu nota cand suma e sub estimare) si urca pana la plafonul ei;
// fara estimare (modul "Am nevoie de ajutor") are o scara fixa. Treapta se deriva din suma
// in pasul parinte (doar pentru punctaj) — pe ecran nu mai apar trepte.

export function BudgetSlider({
  valueRon,
  undisclosed,
  estimate,
  onChooseRon,
  onUndisclosed,
  error,
}: {
  // suma aleasa; null = nealeasa (sau "Prefer sa nu spun")
  valueRon: number | null;
  undisclosed: boolean;
  // estimarea din raspunsuri; null = fara estimare (scara fixa)
  estimate: { minRon: number; maxRon: number } | null;
  onChooseRon: (ron: number) => void;
  onUndisclosed: (checked: boolean) => void;
  error?: string;
}) {
  const t = useTranslations('Requests');
  const locale = useLocale();
  const lei = (n: number) => formatLei(n, locale);
  const hasEstimate = !!estimate && estimate.minRon > 0;
  const { minRon, maxRon } = budgetSliderBounds(hasEstimate ? estimate : null);
  const chosen = !undisclosed && typeof valueRon === 'number';
  // pozitia de repaus a cursorului ascuns: mijlocul scarii (nu e o valoare aleasa)
  const restRon = Math.round((minRon + maxRon) / 2 / BUDGET_SLIDER_STEP_RON) * BUDGET_SLIDER_STEP_RON;
  const sliderValue = chosen ? Math.min(Math.max(valueRon, minRon), maxRon) : restRon;
  const below = chosen && hasEstimate && isBudgetBelowEstimate(valueRon, estimate.minRon);
  // reperul estimarii pe scara (procent din latime)
  const estimatePct = hasEstimate ? ((estimate.minRon - minRon) / (maxRon - minRon)) * 100 : null;

  return (
    <div className="flex flex-col gap-3">
      <div className={cn('flex flex-col gap-2', undisclosed && 'opacity-40')}>
        <p className="text-xs text-muted-foreground">
          {hasEstimate
            ? t('budgetEstimateHint', { min: lei(estimate.minRon), max: lei(estimate.maxRon) })
            : t('budgetNoEstimateHint')}
        </p>
        <span
          className={cn('font-serif text-2xl tabular-nums', !chosen && 'text-muted-foreground')}
          data-testid="budget-value"
        >
          {chosen ? lei(valueRon) : t('budgetChoose')}
        </span>
        <input
          type="range"
          min={minRon}
          max={maxRon}
          step={BUDGET_SLIDER_STEP_RON}
          value={sliderValue}
          disabled={undisclosed}
          data-unset={chosen ? undefined : 'true'}
          onChange={(e) => onChooseRon(Number(e.target.value))}
          // un clic chiar pe pozitia de repaus nu schimba valoarea (fara onChange): tot alegere
          onPointerUp={(e) => {
            if (!chosen && !undisclosed) onChooseRon(Number(e.currentTarget.value));
          }}
          className={cn(
            'accent-walnut',
            // fara alegere: fara cursor vizibil
            !chosen && '[&::-moz-range-thumb]:opacity-0 [&::-webkit-slider-thumb]:opacity-0',
          )}
          aria-label={t('field.budgetRange')}
          aria-valuetext={chosen ? lei(valueRon) : t('budgetChoose')}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'budget-error' : below ? 'budget-below-note' : undefined}
        />
        <div className="relative flex justify-between text-meta text-muted-foreground">
          <span>{lei(minRon)}</span>
          {estimatePct !== null && estimatePct > 12 && estimatePct < 88 && (
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap font-medium text-foreground"
              style={{ left: `${estimatePct}%` }}
            >
              {t('budgetEstimateMark', { amount: lei(estimate!.minRon) })}
            </span>
          )}
          <span>{lei(maxRon)}</span>
        </div>
      </div>

      {below && (
        <p
          id="budget-below-note"
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2.5 text-sm"
        >
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
          <span>{t('budgetBelowEstimateNote')}</span>
        </p>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-walnut"
          checked={undisclosed}
          onChange={(e) => onUndisclosed(e.target.checked)}
        />
        {t('budget.UNDISCLOSED')}
      </label>

      {error && (
        <p id="budget-error" role="alert" className="text-sm text-crimson">
          {error}
        </p>
      )}
    </div>
  );
}
