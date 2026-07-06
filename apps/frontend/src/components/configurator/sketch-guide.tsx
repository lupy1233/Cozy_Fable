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

function StepMeasure() {
  return (
    <svg viewBox="0 0 120 90" {...stroke} aria-hidden="true">
      <rect x="18" y="18" width="84" height="54" rx="3" opacity={0.4} strokeWidth={1.75} />
      <path d="M18 80h84M18 76v8M102 76v8" />
      <path d="M24 80l6-3m-6 3l6 3M96 80l-6-3m6 3l-6 3" strokeWidth={1.75} />
      <text x="60" y="14" textAnchor="middle" fontSize="11" className="fill-current" stroke="none">
        3,40 m
      </text>
    </svg>
  );
}

function StepDraw() {
  return (
    <svg viewBox="0 0 120 90" {...stroke} aria-hidden="true">
      <rect x="22" y="14" width="76" height="62" rx="3" strokeWidth={1.75} opacity={0.4} />
      <path d="M26 18v54h20M26 40h24M50 18v22" strokeWidth={2} />
      <path d="M78 62l24 24m-4-28l-20 20-4 8 8-4z" strokeWidth={2} />
    </svg>
  );
}

function StepMark() {
  return (
    <svg viewBox="0 0 120 90" {...stroke} aria-hidden="true">
      <rect x="18" y="14" width="84" height="62" rx="3" strokeWidth={1.75} opacity={0.4} />
      {/* usa cu arc */}
      <path d="M34 76v-20M34 56a20 20 0 0 1 20 20" strokeWidth={2} />
      {/* fereastra */}
      <path d="M64 14h28M64 18h28" strokeWidth={2} />
      {/* priza/teava marcate cu x */}
      <path d="M84 52l6 6m0-6l-6 6" strokeWidth={2} />
    </svg>
  );
}

function StepPhoto() {
  return (
    <svg viewBox="0 0 120 90" {...stroke} aria-hidden="true">
      <rect x="24" y="28" width="72" height="46" rx="6" />
      <path d="M46 28l6-8h16l6 8" />
      <circle cx="60" cy="51" r="13" />
      <circle cx="60" cy="51" r="5" strokeWidth={2} />
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
