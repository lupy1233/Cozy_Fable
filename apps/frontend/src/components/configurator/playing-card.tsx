'use client';

import type { InfoContentRef } from '@marketplace/shared';
import { Check, Info, Minus, Star, Undo2, Wallet } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// PlayingCard — cardul de raspuns al configuratorului, in stil "carte de joc":
// fata = ilustratie + eticheta; butonul Info (dreapta-sus) arata detaliile,
// spatele = descriere, avantaje/dezavantaje si pret mediu (daca exista).
// Selectia se face doar pe fata; spatele are buton de revenire.
// Fetele pastreaza aceeasi latime; o rotatie la 90 de grade producea o dunga alba.
export function PlayingCard({
  selected,
  onSelect,
  multi,
  title,
  sub,
  visual,
  info,
  recommended,
  disabled,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  multi?: boolean;
  title: React.ReactNode;
  sub?: React.ReactNode;
  visual: React.ReactNode;
  info?: InfoContentRef;
  recommended?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations('Configurator');
  const ct = useTranslations();
  const [flipped, setFlipped] = useState(false);
  const infoButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const previousFace = useRef(flipped);
  useLayoutEffect(() => {
    if (previousFace.current === flipped) return;
    previousFace.current = flipped;
    (flipped ? backButton : infoButton).current?.focus({ preventScroll: true });
  }, [flipped]);

  const has = (key: string) => ct.has(`Configurator.${key}`);
  const pros = (info?.prosKeys ?? []).filter(has);
  const cons = (info?.consKeys ?? []).filter(has);
  const showPrice = Boolean(info?.priceHintKey && has(info.priceHintKey));

  return (
    <div data-choice-card className={cn('relative h-72 rounded-xl bg-surface', disabled && 'pointer-events-none opacity-50', className)}>
      <div className="relative h-full w-full">
        {/* FATA */}
        {!flipped && (
          <div
            data-choice-face="front"
            className={cn(
              'absolute inset-0 flex flex-col overflow-hidden rounded-xl border shadow-sm transition-colors animate-[choiceCardIn_150ms_ease-out] motion-reduce:animate-none',
              selected
                ? 'border-walnut bg-walnut-soft shadow-[0_0_0_3px_hsl(var(--walnut)/0.14)]'
                : 'border-border-2 bg-surface hover:border-muted-2',
            )}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={onSelect}
              aria-pressed={selected}
              className="flex h-full w-full flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-walnut"
            >
              {/* zona vizuala */}
              <span className={cn('flex min-h-0 flex-1 items-center justify-center px-8 pt-6', selected ? 'text-walnut' : 'text-muted-foreground')}>
                <span className="h-full max-h-44 w-full [&_svg]:h-full [&_svg]:w-full">{visual}</span>
              </span>
              {/* eticheta centrata */}
              <span className="flex flex-col items-center gap-0.5 px-4 pb-3.5 pt-1.5 text-center">
                <span className="text-sm font-medium">{title}</span>
                {sub && <span className="text-xs leading-snug text-muted-foreground">{sub}</span>}
              </span>
            </button>

            {/* indicator selectie (radio/checkbox) — colt stanga-sus */}
            <span
              className={cn(
                'pointer-events-none absolute left-2.5 top-2.5 grid h-[18px] w-[18px] place-items-center border-[1.5px]',
                multi ? 'rounded-[5px]' : 'rounded-full',
                selected ? 'border-walnut bg-walnut' : 'border-border-2 bg-surface/80',
              )}
            >
              {selected && <Check className="h-3 w-3 text-background" strokeWidth={3} />}
            </span>

            {recommended && (
              <span className="pointer-events-none absolute left-1/2 top-2.5 flex -translate-x-1/2 items-center gap-1 rounded-full bg-sage/15 px-2 py-0.5 text-meta font-medium text-sage">
                <Star className="h-3 w-3" />
                {t('info.recommended')}
              </span>
            )}

            {info && (
              <button
                ref={infoButton}
                type="button"
                onClick={() => setFlipped(true)}
                aria-label={t('info.showInfo')}
                className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-surface/80 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-walnut-soft hover:text-walnut"
              >
                <Info className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* SPATE */}
        {info && flipped && (
          <div
            data-choice-face="details"
            className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border border-walnut/40 bg-surface shadow-sm animate-[choiceCardIn_150ms_ease-out] motion-reduce:animate-none"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border-2 px-4 py-2.5">
              <h4 className="text-sm font-semibold">{has(info.titleKey) ? t(info.titleKey) : title}</h4>
              <button
                ref={backButton}
                type="button"
                onClick={() => setFlipped(false)}
                aria-label={t('info.hideInfo')}
                tabIndex={flipped ? 0 : -1}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-walnut-soft hover:text-walnut"
              >
                <Undo2 className="h-4 w-4" />
              </button>
            </div>
            {/* fara paragraful introductiv (feedback PO F3): doar pros/cons,
                dimensionate sa incapa pe spatele cardului fara scroll */}
            <div className="flex flex-1 flex-col justify-center gap-1 px-4 py-2 text-xs leading-tight">
              {pros.map((k) => (
                <span key={k} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
                  <span>{t(k)}</span>
                </span>
              ))}
              {cons.map((k) => (
                <span key={k} className="flex items-start gap-1.5">
                  <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-crimson" />
                  <span>{t(k)}</span>
                </span>
              ))}
            </div>
            {showPrice && (
              <div className="flex items-center gap-2 border-t border-border-2 bg-surface-2 px-4 py-2 text-xs">
                <Wallet className="h-3.5 w-3.5 text-walnut" />
                <span className="text-muted-foreground">{t('info.avgPrice')}:</span>
                <span className="font-medium">{t(info.priceHintKey!)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
