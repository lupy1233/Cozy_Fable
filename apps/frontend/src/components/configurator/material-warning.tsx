'use client';

import { evalCondition, type AnswerMap, type QuestionStep, type RoomType } from '@marketplace/shared';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// c13 (etapa 12, PO c13-1 = "doar avertisment, fara materiale noi"): langa insigna "Recomandat"
// apare "Nerecomandat aici" pe materialele care nu rezista in camera respectiva. Doar afisare:
// nu schimba ce se salveaza si nu atinge fluxurile versionate. Acelasi mecanism ca insigna:
// avertismentul apare doar pe un pas care are acum o optiune "Recomandat" activa (recommendedIf
// adevarat din raspunsurile deja date) — balcon deschis (lemn masiv recomandat), baie neventilata
// (MDF infoliat recomandat). Pe blat (fara insigna, c6) si pe versiunile fara insigna: nimic.
const NOT_RECOMMENDED: Partial<Record<RoomType, readonly string[]>> = {
  // PAL-ul si MDF-ul nu rezista afara, nici infoliate (textul balconului deschis)
  BALCONY: ['PAL', 'MDF', 'MDF_INFOLIAT', 'MDF_VOPSIT', 'MDF_FURNIR', 'MDF_INTEGRAL'],
  // baia fara aerisire: doar PAL-ul (MDF-ul e chiar recomandarea)
  BATHROOM: ['PAL'],
};

export function isNotRecommendedHere(
  roomType: RoomType,
  step: QuestionStep,
  optionValue: string,
  answers: AnswerMap,
): boolean {
  const values = NOT_RECOMMENDED[roomType];
  if (!values || !values.includes(optionValue)) return false;
  if (step.type !== 'single-choice') return false;
  return step.options.some(
    (o) => o.value !== optionValue && o.recommendedIf !== undefined && evalCondition(o.recommendedIf, answers),
  );
}

// Insigna cu icon + text (nu doar culoare); sta in eticheta butonului, deci intra in numele lui
// accesibil ("PAL Nerecomandat aici"), ca si "Recomandat".
export function NotRecommendedTag({ className }: { className?: string }) {
  const t = useTranslations('Configurator');
  return (
    <span
      data-not-recommended
      className={cn(
        'mx-auto mt-1 flex w-fit items-center gap-1 rounded-full bg-crimson-soft px-1.5 py-0.5 text-micro font-semibold text-crimson',
        className,
      )}
    >
      <AlertTriangle aria-hidden className="h-3 w-3 shrink-0" />
      {t('info.notRecommendedHere')}
    </span>
  );
}
