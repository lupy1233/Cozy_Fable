'use client';

import type { InfoContentRef } from '@marketplace/shared';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Info, Minus, Star, Undo2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// PlayingCard — cardul de raspuns al configuratorului, in stil "carte de joc":
// fata = ilustratie + eticheta; butonul Info (dreapta-sus) INTOARCE cardul,
// spatele = descriere, avantaje/dezavantaje si pret mediu (daca exista).
// Selectia se face doar pe fata; spatele are buton de revenire.
// prefers-reduced-motion → schimbarea fetelor e instanta (fara animatie 3D).
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
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(false);

  const has = (key: string) => ct.has(`Configurator.${key}`);
  const pros = (info?.prosKeys ?? []).filter(has);
  const cons = (info?.consKeys ?? []).filter(has);
  const showPrice = Boolean(info?.priceHintKey && has(info.priceHintKey));

  return (
    <div className={cn('relative h-72 [perspective:1200px]', disabled && 'pointer-events-none opacity-50', className)}>
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 22 }}
      >
        {/* FATA */}
        <div
          className={cn(
            'absolute inset-0 flex flex-col overflow-hidden rounded-xl border shadow-sm transition-colors [backface-visibility:hidden]',
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
              {sub && <span className="text-[12px] leading-snug text-muted-foreground">{sub}</span>}
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
            <span className="pointer-events-none absolute left-1/2 top-2.5 flex -translate-x-1/2 items-center gap-1 rounded-full bg-sage/15 px-2 py-0.5 text-[11px] font-medium text-sage">
              <Star className="h-3 w-3" />
              {t('info.recommended')}
            </span>
          )}

          {info && (
            <button
              type="button"
              onClick={() => setFlipped(true)}
              aria-label={t('info.showInfo')}
              className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-surface/80 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-walnut-soft hover:text-walnut"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* SPATE */}
        {info && (
          <div
            className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border border-walnut/40 bg-surface shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]"
            aria-hidden={!flipped}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border-2 px-4 py-2.5">
              <h4 className="text-sm font-semibold">{has(info.titleKey) ? t(info.titleKey) : title}</h4>
              <button
                type="button"
                onClick={() => setFlipped(false)}
                aria-label={t('info.hideInfo')}
                tabIndex={flipped ? 0 : -1}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-walnut-soft hover:text-walnut"
              >
                <Undo2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2.5 text-[12.5px] leading-snug">
              {has(info.bodyKey) && <p className="text-muted-foreground">{t(info.bodyKey)}</p>}
              {pros.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {pros.map((k) => (
                    <li key={k} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
                      <span>{t(k)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {cons.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {cons.map((k) => (
                    <li key={k} className="flex items-start gap-1.5">
                      <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-crimson" />
                      <span>{t(k)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {showPrice && (
              <div className="flex items-center gap-2 border-t border-border-2 bg-surface-2 px-4 py-2 text-[12.5px]">
                <Wallet className="h-3.5 w-3.5 text-walnut" />
                <span className="text-muted-foreground">{t('info.avgPrice')}:</span>
                <span className="font-medium">{t(info.priceHintKey!)}</span>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
