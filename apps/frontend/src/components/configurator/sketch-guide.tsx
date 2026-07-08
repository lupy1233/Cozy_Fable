'use client';

import { useTranslations } from 'next-intl';

// Ghid vizual "cum faci o schita" — afisat cand clientul nu are proiect propriu.
// Reutilizat de pagina publica /sketch-guide (Phase D).

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// Redesenate (feedback PO F3): fara text in interiorul desenelor — cota din
// StepMeasure se suprapunea cu peretele; compozitii mai aerisite, linii mai clare.

function StepMeasure() {
  return (
    <svg viewBox="0 0 120 90" {...stroke} aria-hidden="true">
      {/* peretele masurat */}
      <rect x="20" y="12" width="80" height="50" rx="2" opacity={0.4} strokeWidth={1.75} />
      {/* ruleta trasa de-a lungul peretelui */}
      <rect x="14" y="70" width="14" height="12" rx="3" strokeWidth={2} />
      <path d="M28 76h64" strokeWidth={2} />
      <path d="M92 72v8" strokeWidth={2} />
      {/* gradatiile ruletei */}
      <path d="M40 76v-4M52 76v-4M64 76v-4M76 76v-4M88 76v-4" strokeWidth={1.5} opacity={0.7} />
    </svg>
  );
}

function StepDraw() {
  return (
    <svg viewBox="0 0 120 90" {...stroke} aria-hidden="true">
      {/* foaia de hartie */}
      <rect x="16" y="12" width="66" height="66" rx="3" strokeWidth={1.75} opacity={0.4} />
      {/* conturul camerei desenat pe foaie */}
      <path d="M26 22v46h30M26 44h20M46 22v22" strokeWidth={2} />
      {/* creionul, clar separat de plan */}
      <path d="M92 30l14 14-26 26-16 4 4-16z" strokeWidth={2} strokeLinejoin="round" />
      <path d="M88 34l10 10" strokeWidth={1.5} opacity={0.7} />
    </svg>
  );
}

function StepMark() {
  return (
    <svg viewBox="0 0 120 90" {...stroke} aria-hidden="true">
      {/* conturul camerei */}
      <rect x="18" y="12" width="84" height="66" rx="2" strokeWidth={1.75} opacity={0.4} />
      {/* usa cu arc — coltul stanga-jos */}
      <path d="M32 78v-22M32 56a22 22 0 0 1 22 22" strokeWidth={2} />
      {/* fereastra — linie dubla pe latura de sus */}
      <path d="M66 12h26M66 17h26" strokeWidth={2} />
      {/* priza marcata cu X — pe peretele din dreapta, cu spatiu in jur */}
      <path d="M88 46l8 8m0-8l-8 8" strokeWidth={2} />
    </svg>
  );
}

function StepPhoto() {
  return (
    <svg viewBox="0 0 120 90" {...stroke} aria-hidden="true">
      <rect x="22" y="26" width="76" height="50" rx="7" />
      <path d="M45 26l7-9h16l7 9" />
      <circle cx="60" cy="51" r="14" />
      <circle cx="60" cy="51" r="5.5" strokeWidth={2} />
      {/* blitul */}
      <path d="M86 36h6" strokeWidth={2} />
    </svg>
  );
}

const STEPS = [
  { key: 'measure', Visual: StepMeasure },
  { key: 'draw', Visual: StepDraw },
  { key: 'mark', Visual: StepMark },
  { key: 'photo', Visual: StepPhoto },
] as const;

export function SketchGuide({ compact }: { compact?: boolean }) {
  const t = useTranslations('Configurator');

  return (
    <div className={compact ? '' : 'rounded-xl border border-border-2 bg-surface-2 p-5'}>
      <h4 className="font-serif text-lg">{t('sketchGuide.title')}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{t('sketchGuide.subtitle')}</p>
      <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ key, Visual }, i) => (
          <li key={key} className="flex flex-col items-center rounded-lg border border-border-2 bg-surface p-3 text-center">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-walnut text-xs font-semibold text-background">
              {i + 1}
            </span>
            <span className="mt-2 h-20 w-full text-walnut">
              <Visual />
            </span>
            <span className="mt-1 text-sm font-medium">{t(`sketchGuide.steps.${key}.title`)}</span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              {t(`sketchGuide.steps.${key}.body`)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
