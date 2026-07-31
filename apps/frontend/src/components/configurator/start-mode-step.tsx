'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { StartMode } from '@/stores/configurator-store';

// Pasul "Cum pornim?" — prima faza a configuratorului (PO r9: pas separat, nu
// dialog; optiunile pe cartonase mari, in limbajul cardurilor de raspuns).
// Click pe cartonas = alegerea modului + avans direct la cos; revenirea din cos
// arata cardul ales selectat.

const ink = 'currentColor';

/* Am proiect: plansa tehnica cu cote si sigiliu de bifa */
function IlluOwnProject({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" fill="none" className={className} aria-hidden
      stroke={ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <rect x="22" y="12" width="76" height="58" rx="3" />
      <path d="M34 26h30M34 36h44M34 46h22" strokeWidth={2.25} opacity={0.55} />
      <path d="M34 58h16" strokeWidth={2.25} opacity={0.55} />
      {/* cota de alama sub plansa */}
      <path d="M22 78h76M22 74v8M98 74v8" strokeWidth={2} opacity={0.7} />
      {/* sigiliul: proiectul e gata */}
      <circle cx="88" cy="56" r="12" fill="hsl(var(--card))" />
      <circle cx="88" cy="56" r="12" />
      <path d="M82.5 56l4 4 7.5-8.5" />
    </svg>
  );
}

/* Stiu ce vreau: carduri de raspuns cu bifa — formularul ghidat */
function IlluGuided({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" fill="none" className={className} aria-hidden
      stroke={ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <rect x="14" y="20" width="28" height="40" rx="4" />
      <rect x="46" y="14" width="28" height="46" rx="4" />
      <rect x="78" y="20" width="28" height="40" rx="4" />
      <path d="M53 32l5 5 9-10" />
      <path d="M20 70c24 8 56 8 80 0" strokeWidth={2.25} opacity={0.5} />
    </svg>
  );
}

/* Am nevoie de ajutor: schita inceputa + creionul proiectantului si "?" */
function IlluDesignHelp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" fill="none" className={className} aria-hidden
      stroke={ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 66V30l20-12 20 12v36" />
      <path d="M18 66h40" />
      <path d="M30 66V50h16v16" strokeWidth={2.25} opacity={0.6} />
      {/* creionul care continua desenul */}
      <path d="M66 62l26-26" />
      <path d="M92 36l8-8 6 6-8 8z" />
      <path d="M66 62l-3 9 9-3z" strokeWidth={2.5} />
      {/* semnul intrebarii: aici intra proiectantul */}
      <path d="M78 16c0-5 4-8 9-8s9 3 9 8c0 6-9 5-9 12" strokeWidth={2.5} opacity={0.75} />
      <path d="M87 34v.5" strokeWidth={3.5} opacity={0.75} />
    </svg>
  );
}

const OPTIONS: {
  mode: StartMode;
  Illu: React.ComponentType<{ className?: string }>;
}[] = [
  { mode: 'OWN_PROJECT', Illu: IlluOwnProject },
  { mode: 'STANDARD', Illu: IlluGuided },
  { mode: 'DESIGN_HELP', Illu: IlluDesignHelp },
];

export function StartModeStep({
  value,
  onPick,
}: {
  value: StartMode | null;
  onPick: (mode: StartMode) => void;
}) {
  const t = useTranslations('Configurator');

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h2 className="font-serif text-2xl tracking-[-0.01em]">{t('start.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('start.subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {OPTIONS.map(({ mode, Illu }, i) => {
          const selected = value === mode;
          return (
            <motion.button
              key={mode}
              type="button"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.25, ease: 'easeOut' }}
              onClick={() => onPick(mode)}
              aria-pressed={selected}
              className={cn(
                'group relative flex min-h-[19rem] flex-col overflow-hidden rounded-xl border p-5 pt-7 text-left shadow-sm transition-all sm:min-h-[21rem]',
                selected
                  ? 'border-walnut bg-walnut-soft shadow-[0_0_0_3px_hsl(var(--walnut)/0.14)]'
                  : 'border-border-2 bg-surface hover:-translate-y-0.5 hover:border-walnut/60 hover:shadow-md',
              )}
            >
              {/* indicatorul radio — acelasi limbaj ca pe cardurile de raspuns */}
              <span
                className={cn(
                  'absolute left-3 top-3 grid h-[18px] w-[18px] place-items-center rounded-full border-[1.5px]',
                  selected ? 'border-walnut bg-walnut' : 'border-border-2 bg-surface/80',
                )}
              >
                {selected && <Check className="h-3 w-3 text-background" strokeWidth={3} />}
              </span>

              {mode === 'DESIGN_HELP' && (
                <span className="absolute right-3 top-3 rounded-full bg-brass/15 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-brass-2">
                  {t('start.DESIGN_HELP.badge')}
                </span>
              )}

              <span
                className={cn(
                  'flex h-28 items-center justify-center transition-colors sm:h-32',
                  selected ? 'text-walnut' : 'text-muted-foreground group-hover:text-walnut',
                )}
              >
                <Illu className="h-full w-auto" />
              </span>

              <span className="mt-4 block font-serif text-lg leading-snug">
                {t(`start.${mode}.title`)}
              </span>
              <span className="mt-1.5 block text-[13px] leading-relaxed text-muted-foreground">
                {t(`start.${mode}.desc`)}
              </span>

              <span
                className={cn(
                  'mt-auto block pt-4 text-[12.5px] font-medium transition-colors',
                  selected ? 'text-walnut' : 'text-muted-2 group-hover:text-walnut',
                )}
              >
                {t('start.pick')} →
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
