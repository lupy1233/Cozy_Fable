'use client';

import { useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

// Semnatura landing-ului v2 (PO r9): un mini-configurator FUNCTIONAL in hero.
// Trei intrebari pe cartonase (limbajul chestionarului real) redeseneaza live
// un dulap in axonometrie — demonstratia produsului, nu o promisiune despre el.
// Desenul e SVG pur cu tranzitii CSS pe geometrie (fara framer): primul paint
// e mereu complet (SSR, tab in fundal), iar browserele moderne anima lin.

type Doors = 2 | 3;
type Material = 'WHITE' | 'WOOD' | 'SAGE';
type Opening = 'MANER' | 'PUSH' | 'GLISANTE';

const ink = 'hsl(var(--foreground))';
const brass = 'hsl(var(--brass))';

const MATERIAL_FILL: Record<Material, string> = {
  WHITE: 'hsl(var(--card))',
  WOOD: 'hsl(36 45% 74%)',
  SAGE: 'hsl(var(--sage) / 0.38)',
};

// latimea reala pe care o afiseaza cota (cm) — se schimba cu numarul de usi
const WIDTH_CM: Record<Doors, number> = { 2: 160, 3: 240 };

function WardrobeSketch({
  doors,
  material,
  opening,
  animate,
}: {
  doors: Doors;
  material: Material;
  opening: Opening;
  animate: boolean;
}) {
  // geometrie: fata dulapului creste cu numarul de usi; adancimea e fixa;
  // ansamblul ramane centrat in viewBox indiferent de latime
  const frontW = doors === 2 ? 104 : 148;
  const depth = 26;
  const x0 = (240 - frontW - depth) / 2;
  const y0 = 52;
  const h = 118;
  const doorW = frontW / doors;
  const fill = MATERIAL_FILL[material];
  // geometria (x/y/width/height/d/rx) e proprietate CSS in browserele moderne —
  // tranzitia o anima; unde nu e suportata, schimbarea e instanta (tot corecta)
  const tr = animate
    ? ({ transition: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)' } as const)
    : undefined;

  const dSide = `M ${x0 + frontW} ${y0} l ${depth} -${depth * 0.7} v ${h} l -${depth} ${depth * 0.7} Z`;
  const dTop = `M ${x0} ${y0} l ${depth} -${depth * 0.7} h ${frontW} l -${depth} ${depth * 0.7} Z`;

  return (
    <svg viewBox="0 0 240 200" className="h-full w-full" aria-hidden fill="none">
      {/* umbra de asezare */}
      <ellipse
        cx={x0 + frontW / 2 + depth / 2}
        cy={y0 + h + 8}
        rx={frontW / 2 + depth}
        ry={7}
        fill="hsl(var(--foreground) / 0.06)"
        style={tr}
      />
      {/* lateral dreapta + capac (axonometrie) */}
      <path d={dSide} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" fill={fill} style={tr} />
      <path d={dTop} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" fill={fill} style={tr} />
      {/* fata */}
      <rect
        x={x0}
        y={y0}
        width={frontW}
        height={h}
        stroke={ink}
        strokeWidth={2.5}
        strokeLinejoin="round"
        fill={fill}
        style={tr}
      />
      {/* fibra lemnului, doar pe furnir */}
      {material === 'WOOD' &&
        Array.from({ length: doors * 2 }).map((_, i) => (
          <path
            key={i}
            d={`M ${x0 + 10 + (i * (frontW - 20)) / (doors * 2 - 1)} ${y0 + 10} q 4 ${h / 3} 0 ${h - 20}`}
            stroke="hsl(28 35% 55% / 0.5)"
            strokeWidth={1.25}
            strokeLinecap="round"
            style={tr}
          />
        ))}
      {/* rosturile usilor (balamale/push) */}
      {opening !== 'GLISANTE' &&
        Array.from({ length: doors - 1 }).map((_, i) => (
          <line
            key={i}
            x1={x0 + doorW * (i + 1)}
            x2={x0 + doorW * (i + 1)}
            y1={y0 + 4}
            y2={y0 + h - 4}
            stroke={ink}
            strokeWidth={1.75}
            style={tr}
          />
        ))}
      {/* glisante: panourile din spate abia schitate, cel din fata pe sina lui */}
      {opening === 'GLISANTE' && (
        <>
          {Array.from({ length: doors - 1 }).map((_, i) => (
            <line
              key={i}
              x1={x0 + doorW * (i + 1)}
              x2={x0 + doorW * (i + 1)}
              y1={y0 + 4}
              y2={y0 + h - 4}
              stroke={ink}
              strokeWidth={1.25}
              opacity={0.35}
              style={tr}
            />
          ))}
          <rect
            x={x0 - 4}
            y={y0 - 4}
            width={doorW + 4}
            height={h + 8}
            stroke={ink}
            strokeWidth={2.5}
            strokeLinejoin="round"
            fill={fill}
            style={tr}
          />
          <line
            x1={x0 - 6}
            x2={x0 + frontW + 6}
            y1={y0 - 8}
            y2={y0 - 8}
            stroke={brass}
            strokeWidth={3}
            strokeLinecap="round"
            style={tr}
          />
        </>
      )}
      {/* sistemul de deschidere */}
      {opening === 'MANER' &&
        Array.from({ length: doors }).map((_, i) => {
          // manerele stau langa rostul usii, in oglinda
          const cx = x0 + doorW * i + (i < doors / 2 ? doorW - 9 : 9);
          return (
            <line
              key={i}
              x1={cx}
              x2={cx}
              y1={y0 + h / 2 - 12}
              y2={y0 + h / 2 + 12}
              stroke={brass}
              strokeWidth={3.5}
              strokeLinecap="round"
              style={tr}
            />
          );
        })}
      {opening === 'PUSH' && (
        // fara feronerie: doar unda discreta a apasarii pe usa din dreapta
        <g style={tr}>
          <circle cx={x0 + frontW - doorW / 2} cy={y0 + h / 2} r={7} stroke={brass} strokeWidth={1.75} />
          <circle cx={x0 + frontW - doorW / 2} cy={y0 + h / 2} r={13} stroke={brass} strokeWidth={1.25} opacity={0.45} />
        </g>
      )}
      {/* cota de alama: latimea reala, ca pe plansele din formular */}
      <g stroke={brass} strokeWidth={1.25}>
        <line x1={x0} y1={y0 + h + 18} x2={x0 + frontW} y2={y0 + h + 18} style={tr} />
        <line x1={x0} y1={y0 + h + 13} x2={x0} y2={y0 + h + 23} style={tr} />
        <line x1={x0 + frontW} x2={x0 + frontW} y1={y0 + h + 13} y2={y0 + h + 23} style={tr} />
      </g>
      <text
        x={x0 + frontW / 2}
        y={y0 + h + 34}
        textAnchor="middle"
        fontSize="11"
        fill={brass}
        style={{ fontFamily: 'var(--font-mono, monospace)', ...tr }}
      >
        {WIDTH_CM[doors]} cm
      </text>
    </svg>
  );
}

function OptionChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium leading-none transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-walnut',
        selected
          ? 'border-walnut bg-walnut-soft text-walnut shadow-[0_0_0_2px_hsl(var(--walnut)/0.14)]'
          : 'border-border-2 bg-surface text-muted-foreground hover:border-walnut/50 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

export function HeroDemo() {
  const t = useTranslations('LandingV2');
  const reduce = useReducedMotion();
  const [doors, setDoors] = useState<Doors>(2);
  const [material, setMaterial] = useState<Material>('WHITE');
  const [opening, setOpening] = useState<Opening>('MANER');

  const matLabel = { WHITE: t('demo.matWhite'), WOOD: t('demo.matWood'), SAGE: t('demo.matSage') };
  const openLabel = {
    MANER: t('demo.openHandle'),
    PUSH: t('demo.openPush'),
    GLISANTE: t('demo.openSliding'),
  };

  return (
    <div className="relative">
      {/* colturi de registru — aceeasi plansa de atelier ca in formular */}
      <span aria-hidden className="pointer-events-none absolute -left-1.5 -top-1.5 h-3 w-3 border-l border-t border-ink/30" />
      <span aria-hidden className="pointer-events-none absolute -right-1.5 -top-1.5 h-3 w-3 border-r border-t border-ink/30" />
      <span aria-hidden className="pointer-events-none absolute -bottom-1.5 -left-1.5 h-3 w-3 border-b border-l border-ink/30" />
      <span aria-hidden className="pointer-events-none absolute -bottom-1.5 -right-1.5 h-3 w-3 border-b border-r border-ink/30" />

      <div className="border border-ink/15 bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-ink/15 px-4 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-2">
            {t('demo.kicker')}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brass-2">
            № 0001
          </span>
        </div>

        <div className="grid gap-1 p-4 sm:grid-cols-[1.05fr_0.95fr] sm:gap-4 sm:p-5">
          {/* schita vie */}
          <div className="h-48 sm:h-full sm:min-h-[15rem]">
            <WardrobeSketch doors={doors} material={material} opening={opening} animate={!reduce} />
          </div>

          {/* intrebarile — chips in limbajul cardurilor de raspuns */}
          <div className="flex flex-col gap-3.5">
            <div>
              <p className="label mb-1.5">{t('demo.qDoors')}</p>
              <div className="flex flex-wrap gap-1.5">
                <OptionChip label={t('demo.doors2')} selected={doors === 2} onClick={() => setDoors(2)} />
                <OptionChip label={t('demo.doors3')} selected={doors === 3} onClick={() => setDoors(3)} />
              </div>
            </div>
            <div>
              <p className="label mb-1.5">{t('demo.qMaterial')}</p>
              <div className="flex flex-wrap gap-1.5">
                {(['WHITE', 'WOOD', 'SAGE'] as const).map((m) => (
                  <OptionChip key={m} label={matLabel[m]} selected={material === m} onClick={() => setMaterial(m)} />
                ))}
              </div>
            </div>
            <div>
              <p className="label mb-1.5">{t('demo.qOpening')}</p>
              <div className="flex flex-wrap gap-1.5">
                {(['MANER', 'PUSH', 'GLISANTE'] as const).map((o) => (
                  <OptionChip key={o} label={openLabel[o]} selected={opening === o} onClick={() => setOpening(o)} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* cartusul plansei: specificatia generata live + drumul spre cererea reala */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-ink/15 bg-surface-2/60 px-4 py-3">
          <div className="min-w-0">
            <p className="label">{t('demo.specLabel')}</p>
            <p aria-live="polite" className="truncate font-serif text-[15px]">
              {t('demo.spec', { doors })} · {matLabel[material]} · {openLabel[opening]}
            </p>
          </div>
          <Link
            href="/requests/new"
            className="group flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-walnut hover:text-walnut-deep"
          >
            {t('demo.cta')}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
