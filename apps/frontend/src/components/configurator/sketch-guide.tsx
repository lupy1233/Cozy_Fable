'use client';

import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

// Ghid vizual "cum faci o schita" — varianta compacta afisata in pasul de
// upload al fiecarei camere. Rescris in limbajul plansei de atelier al paginii
// publice /sketch-guide (feedback PO item 3): numerale romane, titluri serif,
// hairline-uri, aceleasi texte (titlu/corp/sfat din SketchGuidePage) si
// vignete redesenate, mai clare.

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.25,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// Vignete pe grila 120×90 — compozitii aerisite, fara text in desen.
function StepMeasure() {
  return (
    <svg viewBox="0 0 120 90" {...stroke} aria-hidden="true">
      {/* peretele masurat, cu muchii de podea */}
      <path d="M22 14h76v44H22z" opacity={0.35} strokeWidth={1.6} />
      <path d="M22 58 14 70M98 58l8 12" opacity={0.35} strokeWidth={1.6} />
      {/* ruleta trasa de-a lungul peretelui */}
      <rect x="16" y="70" width="15" height="13" rx="3.5" strokeWidth={2} />
      <path d="M31 76.5h60" strokeWidth={2} />
      <path d="M91 72v9" strokeWidth={2} />
      <path d="M43 76.5v-4M55 76.5v-4M67 76.5v-4M79 76.5v-4" strokeWidth={1.4} opacity={0.65} />
    </svg>
  );
}

function StepDraw() {
  return (
    <svg viewBox="0 0 120 90" {...stroke} aria-hidden="true">
      {/* foaia de hartie usor rotita */}
      <path d="M20 16l60-6 6 62-60 6z" opacity={0.35} strokeWidth={1.6} />
      {/* conturul camerei desenat pe foaie */}
      <path d="M32 26v40h28M32 46h18M50 26v20" strokeWidth={2} />
      {/* creionul */}
      <path d="M92 28l14 14-24 24-17 5 5-17z" strokeWidth={2} />
      <path d="M88 32l10 10" strokeWidth={1.4} opacity={0.65} />
    </svg>
  );
}

function StepMark() {
  return (
    <svg viewBox="0 0 120 90" {...stroke} aria-hidden="true">
      {/* conturul camerei */}
      <rect x="16" y="12" width="88" height="66" rx="2" opacity={0.35} strokeWidth={1.6} />
      {/* usa cu arc */}
      <path d="M30 78V56M30 56a22 22 0 0 1 22 22" strokeWidth={2} />
      {/* fereastra — linie dubla */}
      <path d="M64 12h28M64 17.5h28" strokeWidth={2} />
      {/* priza marcata cu X + teava marcata cu cerc */}
      <path d="M88 44l9 9m0-9l-9 9" strokeWidth={2} />
      <circle cx="42" cy="34" r="5.5" strokeWidth={2} />
    </svg>
  );
}

function StepPhoto() {
  return (
    <svg viewBox="0 0 120 90" {...stroke} aria-hidden="true">
      <rect x="20" y="26" width="80" height="52" rx="8" />
      <path d="M44 26l7-10h18l7 10" />
      <circle cx="60" cy="52" r="15" />
      <circle cx="60" cy="52" r="6" strokeWidth={2} />
      <path d="M88 36h6" strokeWidth={2} />
    </svg>
  );
}

const STEPS = [
  { key: 'measure', Visual: StepMeasure },
  { key: 'draw', Visual: StepDraw },
  { key: 'mark', Visual: StepMark },
  { key: 'photo', Visual: StepPhoto },
] as const;

const ROMAN = ['I', 'II', 'III', 'IV'] as const;

export function SketchGuide() {
  // aceleasi texte ca pagina publica /sketch-guide — un singur continut editorial
  const t = useTranslations('SketchGuidePage');
  const tc = useTranslations('Configurator');

  return (
    <div className="rounded-xl border border-border-2 bg-surface-2 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-serif text-lg tracking-[-0.01em]">{tc('sketchGuide.title')}</h4>
          <p className="mt-0.5 text-sm text-muted-foreground">{tc('sketchGuide.subtitle')}</p>
        </div>
        <Link
          href="/sketch-guide"
          target="_blank"
          className="inline-flex shrink-0 items-center gap-1 text-sm text-walnut hover:underline"
        >
          {tc('sketchGuide.fullGuide')}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ol className="mt-4 grid gap-px overflow-hidden rounded-lg border border-border-2 bg-border-2 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ key, Visual }, i) => (
          <li key={key} className="flex flex-col bg-surface p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-2xl leading-none text-brass">{ROMAN[i]}.</span>
              <span className="font-serif text-[15px]">{t(`steps.${key}.title`)}</span>
            </div>
            <span className="mx-auto mt-3 h-[72px] w-24 text-walnut">
              <Visual />
            </span>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t(`steps.${key}.body`)}
            </p>
            <p className="mt-2 flex items-baseline gap-1.5 text-[11px] text-muted-2">
              <span aria-hidden className="text-brass">—</span>
              {t(`steps.${key}.tip`)}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
