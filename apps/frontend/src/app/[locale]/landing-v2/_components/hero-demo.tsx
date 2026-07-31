'use client';

import { useReducedMotion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import {
  DEMO_PIECES,
  MATERIAL_CARD,
  VARIANT_CARD,
  useDemoStore,
  type DemoMaterial,
  type PieceKind,
} from './demo-state';

// Semnatura landing-ului v2 (PO r9-r10): un mini-configurator FUNCTIONAL in
// hero, cu TREI piese de joaca (dulap / biblioteca / comoda TV) — intrebarile
// se adapteaza piesei, exact ca in produs. Desen SVG pur cu tranzitii CSS pe
// geometrie (fara framer): primul paint e mereu complet, browserele moderne
// anima lin. Starea sta in demo-state, partajata cu statia 1 din "Drumul
// cererii" (PO r12).

type Material = DemoMaterial;

const ink = 'hsl(var(--foreground))';
const brass = 'hsl(var(--brass))';

const MATERIAL_FILL: Record<Material, string> = {
  WHITE: 'hsl(var(--card))',
  WOOD: 'hsl(36 45% 74%)',
  SAGE: 'hsl(var(--sage) / 0.38)',
};

const PIECES = DEMO_PIECES;

function Sketch({
  piece,
  wide,
  material,
  variant,
  animate,
}: {
  piece: PieceKind;
  wide: boolean;
  material: Material;
  variant: string;
  animate: boolean;
}) {
  const fill = MATERIAL_FILL[material];
  const tr = animate
    ? ({ transition: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)' } as const)
    : undefined;

  // gabarite pe piesa: dulapul e inalt, biblioteca medie, comoda joasa si lata
  const frontW = piece === 'WARDROBE' ? (wide ? 148 : 104) : piece === 'BOOKCASE' ? (wide ? 132 : 96) : wide ? 168 : 128;
  const h = piece === 'WARDROBE' ? 118 : piece === 'BOOKCASE' ? 104 : 46;
  const depth = piece === 'TV' ? 22 : 26;
  const x0 = (240 - frontW - depth) / 2;
  const baseY = 170; // toate piesele stau pe aceeasi "podea"
  const y0 = baseY - h;
  const cm = PIECES[piece].widths[wide ? 1 : 0];

  const dSide = `M ${x0 + frontW} ${y0} l ${depth} -${depth * 0.7} v ${h} l -${depth} ${depth * 0.7} Z`;
  const dTop = `M ${x0} ${y0} l ${depth} -${depth * 0.7} h ${frontW} l -${depth} ${depth * 0.7} Z`;

  // impartirea fetei: usi la dulap, module la biblioteca, fronturi la comoda
  const cols = piece === 'WARDROBE' ? (wide ? 3 : 2) : piece === 'BOOKCASE' ? (wide ? 3 : 2) : wide ? 3 : 2;
  const colW = frontW / cols;

  return (
    <svg viewBox="0 0 240 200" className="h-full w-full" aria-hidden fill="none">
      {/* umbra de asezare */}
      <ellipse
        cx={x0 + frontW / 2 + depth / 2}
        cy={baseY + 8}
        rx={frontW / 2 + depth}
        ry={7}
        fill="hsl(var(--foreground) / 0.06)"
        style={tr}
      />
      {/* corpul in axonometrie */}
      <path d={dSide} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" fill={fill} style={tr} />
      <path d={dTop} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" fill={fill} style={tr} />
      <rect x={x0} y={y0} width={frontW} height={h} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" fill={fill} style={tr} />
      {/* fibra lemnului, doar pe furnir */}
      {material === 'WOOD' &&
        Array.from({ length: cols * 2 }).map((_, i) => (
          <path
            key={i}
            d={`M ${x0 + 10 + (i * (frontW - 20)) / (cols * 2 - 1)} ${y0 + 8} q 4 ${h / 3} 0 ${h - 16}`}
            stroke="hsl(28 35% 55% / 0.5)"
            strokeWidth={1.25}
            strokeLinecap="round"
            style={tr}
          />
        ))}

      {/* ----- dulap ----- */}
      {piece === 'WARDROBE' && (
        <>
          {variant !== 'GLISANTE' &&
            Array.from({ length: cols - 1 }).map((_, i) => (
              <line key={i} x1={x0 + colW * (i + 1)} x2={x0 + colW * (i + 1)} y1={y0 + 4} y2={y0 + h - 4} stroke={ink} strokeWidth={1.75} style={tr} />
            ))}
          {variant === 'GLISANTE' && (
            <>
              {/* panourile din spate, abia schitate */}
              {Array.from({ length: cols - 1 }).map((_, i) => (
                <line key={i} x1={x0 + colW * (i + 1)} x2={x0 + colW * (i + 1)} y1={y0 + 4} y2={y0 + h - 4} stroke={ink} strokeWidth={1.25} opacity={0.3} style={tr} />
              ))}
              {/* sina sus (alama) + ghidajul discret de jos */}
              <line x1={x0 - 5} x2={x0 + frontW + 5} y1={y0 - 8} y2={y0 - 8} stroke={brass} strokeWidth={3} strokeLinecap="round" style={tr} />
              <line x1={x0 - 3} x2={x0 + frontW + 3} y1={y0 + h + 4} y2={y0 + h + 4} stroke={ink} strokeWidth={1.25} opacity={0.4} style={tr} />
              {/* panoul frontal: pe mijloc, peste rosturi, agatat de sina */}
              <rect
                x={x0 + (frontW - colW) / 2 - 4}
                y={y0 - 3}
                width={colW + 8}
                height={h + 8}
                stroke={ink}
                strokeWidth={2.5}
                strokeLinejoin="round"
                fill={fill}
                style={tr}
              />
              <g stroke={ink} strokeWidth={1.75} style={tr}>
                <line x1={x0 + (frontW - colW) / 2 + 4} x2={x0 + (frontW - colW) / 2 + 4} y1={y0 - 8} y2={y0 - 3} />
                <line x1={x0 + (frontW + colW) / 2 - 4} x2={x0 + (frontW + colW) / 2 - 4} y1={y0 - 8} y2={y0 - 3} />
              </g>
              {/* manerul-santulet vertical al panoului frontal */}
              <line
                x1={x0 + (frontW + colW) / 2 - 10}
                x2={x0 + (frontW + colW) / 2 - 10}
                y1={y0 + h / 2 - 11}
                y2={y0 + h / 2 + 11}
                stroke={brass}
                strokeWidth={2.5}
                strokeLinecap="round"
                style={tr}
              />
            </>
          )}
          {variant === 'MANER' &&
            Array.from({ length: cols }).map((_, i) => {
              const cx = x0 + colW * i + (i < cols / 2 ? colW - 9 : 9);
              return <line key={i} x1={cx} x2={cx} y1={y0 + h / 2 - 12} y2={y0 + h / 2 + 12} stroke={brass} strokeWidth={3.5} strokeLinecap="round" style={tr} />;
            })}
          {variant === 'PUSH' && (
            <g style={tr}>
              <circle cx={x0 + frontW - colW / 2} cy={y0 + h / 2} r={7} stroke={brass} strokeWidth={1.75} />
              <circle cx={x0 + frontW - colW / 2} cy={y0 + h / 2} r={13} stroke={brass} strokeWidth={1.25} opacity={0.45} />
            </g>
          )}
        </>
      )}

      {/* ----- biblioteca: rafturi deschise sus, optional corp inchis jos ----- */}
      {piece === 'BOOKCASE' &&
        (() => {
          // zona deschisa: intreaga inaltime, sau 2/3 cand jos sunt usi
          const openH = variant === 'DOORS' ? h * 0.66 : h;
          const shelfYs = [openH / 3, (openH / 3) * 2].map((v) => y0 + v);
          const doorY = y0 + openH;
          return (
            <>
              {Array.from({ length: cols - 1 }).map((_, i) => (
                <line key={`v${i}`} x1={x0 + colW * (i + 1)} x2={x0 + colW * (i + 1)} y1={y0 + 3} y2={doorY - (variant === 'DOORS' ? 0 : 3)} stroke={ink} strokeWidth={1.5} style={tr} />
              ))}
              {shelfYs.map((y, i) => (
                <line key={`h${i}`} x1={x0 + 3} x2={x0 + frontW - 3} y1={y} y2={y} stroke={ink} strokeWidth={1.5} style={tr} />
              ))}
              {/* cateva carti, ca sa se citeasca "biblioteca" */}
              <g stroke={brass} strokeWidth={2.5} strokeLinecap="round" opacity={0.75} style={tr}>
                <line x1={x0 + 10} x2={x0 + 10} y1={shelfYs[0] - 12} y2={shelfYs[0]} />
                <line x1={x0 + 15} x2={x0 + 15} y1={shelfYs[0] - 10} y2={shelfYs[0]} />
                <line x1={x0 + colW + 12} x2={x0 + colW + 12} y1={shelfYs[1] - 11} y2={shelfYs[1]} />
                <line x1={x0 + colW + 17} x2={x0 + colW + 17} y1={shelfYs[1] - 9} y2={shelfYs[1]} />
              </g>
              {variant === 'DOORS' && (
                <g style={tr}>
                  {/* corpul inchis: exact intre ultimul raft si baza */}
                  <rect x={x0} y={doorY} width={frontW} height={h - openH} stroke={ink} strokeWidth={2} fill={fill} />
                  {Array.from({ length: cols - 1 }).map((_, i) => (
                    <line key={i} x1={x0 + colW * (i + 1)} x2={x0 + colW * (i + 1)} y1={doorY + 3} y2={y0 + h - 3} stroke={ink} strokeWidth={1.25} />
                  ))}
                  {/* cate un buton de alama pe fiecare usa, langa rost */}
                  {Array.from({ length: cols }).map((_, i) => (
                    <circle
                      key={`k${i}`}
                      cx={x0 + colW * i + (i < cols / 2 ? colW - 7 : 7)}
                      cy={doorY + (h - openH) / 2}
                      r={2}
                      fill={brass}
                    />
                  ))}
                </g>
              )}
            </>
          );
        })()}

      {/* ----- comoda TV: fronturi, picioare conice ----- */}
      {piece === 'TV' && (
        <>
          {Array.from({ length: cols - 1 }).map((_, i) => (
            <line key={i} x1={x0 + colW * (i + 1)} x2={x0 + colW * (i + 1)} y1={y0 + 4} y2={y0 + h - 4} stroke={ink} strokeWidth={1.5} style={tr} />
          ))}
          {variant === 'MANER' &&
            Array.from({ length: cols }).map((_, i) => (
              <line key={i} x1={x0 + colW * i + colW / 2 - 9} x2={x0 + colW * i + colW / 2 + 9} y1={y0 + 12} y2={y0 + 12} stroke={brass} strokeWidth={3} strokeLinecap="round" style={tr} />
            ))}
          {variant === 'PUSH' && (
            <g style={tr}>
              <circle cx={x0 + frontW - colW / 2} cy={y0 + h / 2} r={6} stroke={brass} strokeWidth={1.75} />
              <circle cx={x0 + frontW - colW / 2} cy={y0 + h / 2} r={11} stroke={brass} strokeWidth={1.25} opacity={0.45} />
            </g>
          )}
          <g stroke={ink} strokeWidth={2.25} strokeLinecap="round" style={tr}>
            <line x1={x0 + 10} x2={x0 + 6} y1={baseY} y2={baseY + 10} />
            <line x1={x0 + frontW - 10} x2={x0 + frontW - 6} y1={baseY} y2={baseY + 10} />
          </g>
          {/* televizorul ASEZAT pe blat (PO r12): dupa corp, ca sa stea peste el;
              centrat pe fata de sus (deplasat cu jumatate din adancime) */}
          <g style={tr}>
            {(() => {
              const tvCx = x0 + frontW / 2 + depth / 2;
              const topY = y0 - depth * 0.35;
              return (
                <>
                  <line x1={tvCx - 11} x2={tvCx + 11} y1={topY} y2={topY} stroke={ink} strokeWidth={2.5} strokeLinecap="round" />
                  <line x1={tvCx} x2={tvCx} y1={topY} y2={topY - 8} stroke={ink} strokeWidth={2.5} />
                  <rect x={tvCx - 36} y={topY - 52} width={72} height={44} rx={2.5} fill="hsl(var(--foreground) / 0.88)" stroke={ink} strokeWidth={2} />
                  <line x1={tvCx - 26} y1={topY - 44} x2={tvCx - 10} y2={topY - 28} stroke="hsl(var(--card) / 0.25)" strokeWidth={3} strokeLinecap="round" />
                </>
              );
            })()}
          </g>
        </>
      )}

      {/* cota de alama: latimea reala, ca pe plansele din formular */}
      <g stroke={brass} strokeWidth={1.25}>
        <line x1={x0} y1={baseY + 18} x2={x0 + frontW} y2={baseY + 18} style={tr} />
        <line x1={x0} y1={baseY + 13} x2={x0} y2={baseY + 23} style={tr} />
        <line x1={x0 + frontW} x2={x0 + frontW} y1={baseY + 13} y2={baseY + 23} style={tr} />
      </g>
      <text
        x={x0 + frontW / 2}
        y={baseY + 34}
        textAnchor="middle"
        fontSize="11"
        fill={brass}
        style={{ fontFamily: 'var(--font-mono, monospace)', ...tr }}
      >
        {cm} cm
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

// Cardul de raspuns in miniatura — acelasi limbaj ca in formularul real
// (PO r11: demo-ul trebuie sa ARATE formularul, nu doar sa-l pomeneasca):
// bifa radio, vizual (redare foto / mostra de culoare / schita), eticheta.
function OptionCard({
  label,
  selected,
  onClick,
  img,
  swatch,
  shelves,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  img?: string;
  swatch?: string;
  shelves?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'relative flex flex-col items-center rounded-lg border p-2 pt-3.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-walnut',
        selected
          ? 'border-walnut bg-walnut-soft shadow-[0_0_0_2px_hsl(var(--walnut)/0.14)]'
          : 'border-border-2 bg-surface hover:border-walnut/50',
      )}
    >
      <span
        className={cn(
          'absolute left-1.5 top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full border-[1.5px]',
          selected ? 'border-walnut bg-walnut' : 'border-border-2 bg-surface',
        )}
      >
        {selected && <Check className="h-2 w-2 text-background" strokeWidth={4} />}
      </span>
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="h-9 w-full object-contain" />
      )}
      {swatch && (
        <span className="my-1 h-7 w-11 rounded-md border border-ink/10 shadow-inner" style={{ background: swatch }} />
      )}
      {shelves && (
        <svg viewBox="0 0 44 36" fill="none" className="h-9 w-auto text-muted-foreground" aria-hidden
          stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="4" y="3" width="36" height="30" rx="1.5" />
          <line x1="6" y1="13" x2="38" y2="13" />
          <line x1="6" y1="23" x2="38" y2="23" />
          <line x1="12" y1="8" x2="12" y2="13" stroke="hsl(var(--brass))" />
          <line x1="16" y1="9" x2="16" y2="13" stroke="hsl(var(--brass))" />
        </svg>
      )}
      <span className="mt-1 text-center text-[10.5px] font-medium leading-tight">{label}</span>
    </button>
  );
}

// eticheta numerotata a intrebarii — ecoul numerotarii din formular
function QLabel({ no, text }: { no: string; text: string }) {
  return (
    <p className="label mb-1.5">
      <span className="font-mono text-brass-2">{no}</span> · {text}
    </p>
  );
}

export function HeroDemo() {
  const t = useTranslations('LandingV2');
  const reduce = useReducedMotion();
  const piece = useDemoStore((s) => s.piece);
  const wide = useDemoStore((s) => s.wide);
  const material = useDemoStore((s) => s.material);
  const variant = useDemoStore((s) => s.variant);
  const pickPiece = useDemoStore((s) => s.pickPiece);
  const setWide = useDemoStore((s) => s.setWide);
  const setMaterial = useDemoStore((s) => s.setMaterial);
  const setVariant = useDemoStore((s) => s.setVariant);

  const pieceLabel: Record<PieceKind, string> = {
    WARDROBE: t('demo.pieceWardrobe'),
    BOOKCASE: t('demo.pieceBookcase'),
    TV: t('demo.pieceTv'),
  };
  const matLabel: Record<Material, string> = {
    WHITE: t('demo.matWhite'),
    WOOD: t('demo.matWood'),
    SAGE: t('demo.matSage'),
  };
  const variantLabel: Record<string, string> = {
    MANER: t('demo.openHandle'),
    PUSH: t('demo.openPush'),
    GLISANTE: t('demo.openSliding'),
    OPEN: t('demo.openShelves'),
    DOORS: t('demo.doorsBelow'),
  };

  const conf = PIECES[piece];
  const spec = `${pieceLabel[piece]} ${conf.widths[wide ? 1 : 0]} cm · ${matLabel[material]} · ${variantLabel[variant]}`;

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

        {/* piesa de joaca — prima alegere, pe toata latimea */}
        <div className="border-b border-ink/10 px-4 pb-3 pt-3.5 sm:px-5">
          <QLabel no="01" text={t('demo.qPiece')} />
          <div className="flex flex-wrap gap-1.5">
            {(['WARDROBE', 'BOOKCASE', 'TV'] as const).map((p) => (
              <OptionChip key={p} label={pieceLabel[p]} selected={piece === p} onClick={() => pickPiece(p)} />
            ))}
          </div>
        </div>

        <div className="grid gap-1 p-4 sm:grid-cols-[1fr_1fr] sm:gap-4 sm:p-5 sm:pt-4">
          {/* schita vie */}
          <div className="h-48 sm:h-full sm:min-h-[15rem]">
            <Sketch piece={piece} wide={wide} material={material} variant={variant} animate={!reduce} />
          </div>

          {/* intrebarile — cardurile de raspuns ale formularului, in miniatura */}
          <div className="flex flex-col gap-3">
            <div>
              <QLabel no="02" text={t('demo.qSize')} />
              <div className="flex flex-wrap gap-1.5">
                {conf.widths.map((cm, i) => (
                  <OptionChip key={cm} label={`${cm} cm`} selected={wide === (i === 1)} onClick={() => setWide(i === 1)} />
                ))}
              </div>
            </div>
            <div>
              <QLabel no="03" text={t('demo.qMaterial')} />
              <div className="grid grid-cols-3 gap-1.5">
                {(['WHITE', 'WOOD', 'SAGE'] as const).map((m) => (
                  <OptionCard
                    key={m}
                    label={matLabel[m]}
                    selected={material === m}
                    onClick={() => setMaterial(m)}
                    {...MATERIAL_CARD[m]}
                  />
                ))}
              </div>
            </div>
            <div>
              <QLabel
                no="04"
                text={piece === 'BOOKCASE' ? t('demo.qBottom') : t('demo.qOpening')}
              />
              <div className="grid grid-cols-3 gap-1.5">
                {conf.variants.map((v) => (
                  <OptionCard
                    key={v}
                    label={variantLabel[v]}
                    selected={variant === v}
                    onClick={() => setVariant(v)}
                    {...VARIANT_CARD[v]}
                  />
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
              {spec}
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
