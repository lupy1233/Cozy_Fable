'use client';

import type { AnswerMap, RoomType } from '@marketplace/shared';
import { createContext, useContext, useSyncExternalStore } from 'react';

// Figurile pasului de dimensiuni (feedback PO item 11): planse statice, desenate
// de mana (coordonate fixe, ca o imagine), nu geometrie calculata la runtime.
// In desen apar litere in insigne (A/B/C/H/L/D); valoarea introdusa apare si
// LANGA litera (feedback PO 2026-07-13), cu halou de fundal ca sa ramana
// lizibila peste hasuri — plus legenda HTML de sub figura si campurile de input.
// Stil: plansa de arhitect — pereti dubli, corpuri hasurate, cote cu sageti.

const brass = 'hsl(var(--brass))';
const crimson = 'hsl(var(--crimson))';
const card = 'hsl(var(--card))';

// Valorile per LITERA (formatate cu unitatea curenta in step-renderer);
// undefined = fara valori pe desen (slot inca necompletat).
export type FigureValues = Record<string, string>;

// Literele cotelor gresite (38): insigna si valoarea lor se coloreaza rosu.
const InvalidLetters = createContext<ReadonlySet<string>>(new Set());

// Marimile cotelor in unitatile desenului (atribute SVG, nu clase de text). Sub sm (j1)
// plansa se micsoreaza la ~0,6x, deci textul e mai mare ca sa ramana ~13 px pe ecran.
interface FigureSizes {
  value: number;
  letter: number;
  badgeR: number;
  valueOffset: number;
}
const DESKTOP_SIZES: FigureSizes = { value: 10, letter: 12, badgeR: 11, valueOffset: 24 };
const PHONE_SIZES: FigureSizes = { value: 21, letter: 17, badgeR: 14, valueOffset: 34 };
const FigureSize = createContext<FigureSizes>(DESKTOP_SIZES);

const PHONE_QUERY = '(max-width: 639.98px)';
function subscribePhone(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener?.('change', onChange);
  return () => mq.removeEventListener?.('change', onChange);
}
const isPhone = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(PHONE_QUERY).matches);

function FigureSizeProvider({ children }: { children: React.ReactNode }) {
  // pe server si la hidratare: marimile de desktop (ca azi)
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  return <FigureSize.Provider value={phone ? PHONE_SIZES : DESKTOP_SIZES}>{children}</FigureSize.Provider>;
}

// ---------- primitive de cotare ----------

// Eticheta de valoare de sub o insigna: text mic cu halou (paintOrder stroke)
// ca sa nu se piarda peste hasuri sau linii de cota. Sub sm (j1) textul e mai mare
// in unitatile desenului, ca pe telefon sa ramana ~13 px dupa micsorarea plansei.
function ValueLabel({ x, y, value, invalid }: { x: number; y: number; value?: string; invalid?: boolean }) {
  const s = useContext(FigureSize);
  if (!value) return null;
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={s.value}
      fontWeight={600}
      fontFamily="var(--font-mono)"
      fill={invalid ? crimson : brass}
      stroke={card}
      strokeWidth={4}
      paintOrder="stroke"
      strokeLinejoin="round"
      data-invalid={invalid || undefined}
    >
      {value}
    </text>
  );
}

function Badge({ x, y, letter, value }: { x: number; y: number; letter: string; value?: string }) {
  const invalid = useContext(InvalidLetters).has(letter);
  const s = useContext(FigureSize);
  const color = invalid ? crimson : brass;
  return (
    <g data-dimension-letter={letter} data-invalid={invalid || undefined}>
      <circle cx={x} cy={y} r={s.badgeR} fill={card} stroke={color} strokeWidth={invalid ? 2 : 1.4} />
      <text
        x={x}
        y={y}
        dy="0.35em"
        textAnchor="middle"
        fontSize={s.letter}
        fontWeight={700}
        fontFamily="var(--font-mono)"
        fill={color}
        stroke={invalid ? crimson : undefined}
      >
        {letter}
      </text>
      <ValueLabel x={x} y={y + s.valueOffset} value={value} invalid={invalid} />
    </g>
  );
}

// Cota orizontala: linii de extensie + linie de cota cu sageti + insigna la mijloc.
function DimH({
  x1,
  x2,
  y,
  letter,
  ext = 0,
  value,
}: {
  x1: number;
  x2: number;
  y: number;
  letter: string;
  // lungimea liniilor de extensie (spre desen); 0 = fara
  ext?: number;
  value?: string;
}) {
  const mid = (x1 + x2) / 2;
  return (
    <g stroke={brass} strokeWidth={1.2} fill="none">
      {ext > 0 && (
        <>
          <line x1={x1} y1={y} x2={x1} y2={y + ext} />
          <line x1={x2} y1={y} x2={x2} y2={y + ext} />
        </>
      )}
      <line x1={x1} y1={y} x2={mid - 15} y2={y} />
      <line x1={mid + 15} y1={y} x2={x2} y2={y} />
      {/* sageti */}
      <path d={`M${x1} ${y} l7 -3.5 v7 z`} fill={brass} stroke="none" />
      <path d={`M${x2} ${y} l-7 -3.5 v7 z`} fill={brass} stroke="none" />
      <Badge x={mid} y={y} letter={letter} value={value} />
    </g>
  );
}

// Cota verticala.
function DimV({
  y1,
  y2,
  x,
  letter,
  ext = 0,
  value,
}: {
  y1: number;
  y2: number;
  x: number;
  letter: string;
  ext?: number;
  value?: string;
}) {
  const mid = (y1 + y2) / 2;
  return (
    <g stroke={brass} strokeWidth={1.2} fill="none">
      {ext > 0 && (
        <>
          <line x1={x} y1={y1} x2={x - ext} y2={y1} />
          <line x1={x} y1={y2} x2={x - ext} y2={y2} />
        </>
      )}
      <line x1={x} y1={y1} x2={x} y2={mid - 15} />
      <line x1={x} y1={mid + 15} x2={x} y2={y2} />
      <path d={`M${x} ${y1} l-3.5 7 h7 z`} fill={brass} stroke="none" />
      <path d={`M${x} ${y2} l-3.5 -7 h7 z`} fill={brass} stroke="none" />
      <Badge x={x} y={mid} letter={letter} value={value} />
    </g>
  );
}

// Banda de corpuri (vedere de sus): dreptunghi cu hasuri diagonale discrete.
function Run({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const lines: React.ReactNode[] = [];
  for (let i = 12; i < w + h; i += 14) {
    const px1 = Math.max(x, x + i - h);
    const py1 = Math.min(y + h, y + i);
    const px2 = Math.min(x + w, x + i);
    const py2 = Math.max(y, y + i - w);
    lines.push(<line key={i} x1={px1} y1={py1} x2={px2} y2={py2} strokeWidth={0.8} opacity={0.5} />);
  }
  return (
    <g stroke="currentColor" fill="none">
      <rect x={x} y={y} width={w} height={h} fill="currentColor" fillOpacity={0.12} strokeWidth={1.6} />
      {lines}
    </g>
  );
}

// Etalon de inaltime: mini-sectiune (podea + tavan) cu cota H — vederea de sus
// nu poate arata inaltimea, asa ca o desenam ca sectiune alaturi de plan.
function HeightGauge({ x, letter = 'H', value }: { x: number; letter?: string; value?: string }) {
  return (
    <g>
      <g stroke="currentColor" strokeWidth={1.6} className="text-muted-2" fill="none">
        {/* tavan si podea */}
        <line x1={x - 14} y1={46} x2={x + 26} y2={46} />
        <line x1={x - 14} y1={234} x2={x + 26} y2={234} />
        {/* hasura de sectiune pe podea/tavan */}
        <path d={`M${x - 10} 46 l-6 -8 M${x + 2} 46 l-6 -8 M${x + 14} 46 l-6 -8`} strokeWidth={0.9} opacity={0.7} />
        <path d={`M${x - 10} 242 l-6 -8 M${x + 2} 242 l-6 -8 M${x + 14} 242 l-6 -8`} strokeWidth={0.9} opacity={0.7} />
      </g>
      <DimV y1={46} y2={234} x={x + 6} letter={letter} value={value} />
    </g>
  );
}

// Camera vazuta de sus: pereti dubli pe trei laturi + latura de jos deschisa
// (acces), cu usa sugerata prin arc.
function RoomShell({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const t = 7; // grosimea peretelui
  return (
    <g className="text-muted-2" stroke="currentColor" fill="none">
      {/* fata exterioara + interioara a peretilor (sus, stanga, dreapta) */}
      <path d={`M${x} ${y + h} V${y} H${x + w} V${y + h}`} strokeWidth={1.6} />
      <path
        d={`M${x + t} ${y + h} V${y + t} H${x + w - t} V${y + h}`}
        strokeWidth={1}
        opacity={0.7}
      />
      {/* umplutura peretilor */}
      <path
        d={`M${x} ${y + h} V${y} H${x + w} V${y + h} H${x + w - t} V${y + t} H${x + t} V${y + h} Z`}
        fill="currentColor"
        fillOpacity={0.1}
        stroke="none"
      />
      {/* usa pe latura deschisa (dreapta-jos): canat + arc de deschidere */}
      <g strokeWidth={1.2}>
        <line x1={x + w - t - 44} y1={y + h} x2={x + w - t - 44} y2={y + h - 40} />
        <path d={`M${x + w - t - 44} ${y + h - 40} A40 40 0 0 1 ${x + w - t - 4} ${y + h}`} opacity={0.7} />
      </g>
    </g>
  );
}

const FIG = 'rounded-xl border border-border-2 bg-surface-2 p-4';
// overflow-visible: cotele mai mari de pe telefon pot iesi putin din chenarul desenului
const SVG = 'mx-auto w-full max-w-md overflow-visible';

// ---------- figurile per tip de intrebare ----------

export function KitchenPlanFigure({
  layout,
  hasIsland,
  v = {},
}: {
  layout: string;
  hasIsland: boolean;
  v?: FigureValues;
}) {
  const showB = layout === 'L_SHAPE' || layout === 'U_SHAPE';
  const showC = layout === 'U_SHAPE';
  return (
    <svg viewBox="0 0 470 280" className={SVG} aria-hidden="true">
      <RoomShell x={64} y={40} w={280} h={200} />
      <g className="text-walnut">
        {/* latura A — corpurile de pe peretele din spate */}
        <Run x={71} y={47} w={266} h={34} />
        {showB && <Run x={71} y={81} w={34} h={159} />}
        {showC && <Run x={303} y={81} w={34} h={159} />}
      </g>
      {/* insula — element propriu, verde salvie */}
      {hasIsland && (
        <g className="text-sage">
          <Run x={158} y={140} w={92} h={44} />
          <DimH x1={158} x2={250} y={207} letter="L" ext={16} value={v.L} />
          <DimV y1={140} y2={184} x={272} letter="D" ext={-14} value={v.D} />
        </g>
      )}
      {/* cotele laturilor, in afara peretilor */}
      <DimH x1={71} x2={337} y={22} letter="A" ext={12} value={v.A} />
      {showB && <DimV y1={81} y2={240} x={44} letter="B" ext={-14} value={v.B} />}
      {showC && <DimV y1={81} y2={240} x={364} letter="C" ext={16} value={v.C} />}
      <HeightGauge x={424} value={v.H} />
    </svg>
  );
}

export function WallsPlanFigure({
  runs,
  heightLetter = 'H',
  v = {},
}: {
  runs: number;
  heightLetter?: string;
  v?: FigureValues;
}) {
  const showB = runs >= 2;
  const showC = runs >= 3;
  return (
    <svg viewBox="0 0 470 280" className={SVG} aria-hidden="true">
      <RoomShell x={64} y={40} w={280} h={200} />
      <g className="text-walnut">
        <Run x={71} y={47} w={266} h={34} />
        {showB && <Run x={71} y={81} w={34} h={159} />}
        {showC && <Run x={303} y={81} w={34} h={159} />}
      </g>
      <DimH x1={71} x2={337} y={22} letter="A" ext={12} value={v.A} />
      {showB && <DimV y1={81} y2={240} x={44} letter="B" ext={-14} value={v.B} />}
      {showC && <DimV y1={81} y2={240} x={364} letter="C" ext={16} value={v.C} />}
      <HeightGauge x={424} letter={heightLetter} value={v[heightLetter]} />
    </svg>
  );
}

// Walk-in (etapa 10, §5.2): camera inchisa, mobilier pe trei pereti (A sus, B stanga,
// C dreapta) si golul usii pe al patrulea perete.
export function WalkInPlanFigure({ v = {} }: { v?: FigureValues }) {
  const t = 7;
  const [x, y, w, h] = [64, 40, 280, 200];
  // golul usii pe peretele de jos, centrat
  const doorL = x + w / 2 - 24;
  const doorR = x + w / 2 + 24;
  return (
    <svg viewBox="0 0 470 280" className={SVG} aria-hidden="true" data-dimension-figure="walk-in">
      <g className="text-muted-2" stroke="currentColor" fill="none">
        <path d={`M${doorL} ${y + h} H${x} V${y} H${x + w} V${y + h} H${doorR}`} strokeWidth={1.6} />
        <path
          d={`M${doorL} ${y + h - t} H${x + t} V${y + t} H${x + w - t} V${y + h - t} H${doorR}`}
          strokeWidth={1}
          opacity={0.7}
        />
        <line x1={doorL} y1={y + h} x2={doorL} y2={y + h - t} strokeWidth={1.2} />
        <line x1={doorR} y1={y + h} x2={doorR} y2={y + h - t} strokeWidth={1.2} />
        {/* canatul usii + arcul de deschidere, spre interior */}
        <g strokeWidth={1.2}>
          <line x1={doorL} y1={y + h - t} x2={doorL} y2={y + h - t - 48} />
          <path d={`M${doorL} ${y + h - t - 48} A48 48 0 0 1 ${doorR} ${y + h - t}`} opacity={0.7} />
        </g>
      </g>
      <g className="text-walnut">
        <Run x={x + t} y={y + t} w={w - 2 * t} h={34} />
        <Run x={x + t} y={y + t + 34} w={34} h={h - 2 * t - 34 - 30} />
        <Run x={x + w - t - 34} y={y + t + 34} w={34} h={h - 2 * t - 34 - 30} />
      </g>
      <DimH x1={x + t} x2={x + w - t} y={22} letter="A" ext={12} value={v.A} />
      <DimV y1={y + t + 34} y2={y + h - t - 30} x={44} letter="B" ext={-14} value={v.B} />
      <DimV y1={y + t + 34} y2={y + h - t - 30} x={364} letter="C" ext={16} value={v.C} />
      <HeightGauge x={424} value={v.H} />
    </svg>
  );
}

export function BalconyPlanFigure({ v = {} }: { v?: FigureValues } = {}) {
  return (
    <svg viewBox="0 0 470 300" className={SVG} aria-hidden="true">
      {/* peretele casei sus + parapetul balconului jos (linie cu montanti) */}
      <g className="text-muted-2" stroke="currentColor" fill="none">
        <rect x={64} y={40} width={280} height={12} fill="currentColor" fillOpacity={0.12} strokeWidth={1.6} />
        {/* usa spre balcon in peretele casei */}
        <g strokeWidth={1.2}>
          <line x1={150} y1={52} x2={190} y2={52} stroke={card} strokeWidth={12} />
          <line x1={150} y1={52} x2={150} y2={92} />
          <path d="M150 92 A40 40 0 0 0 190 52" opacity={0.7} />
        </g>
        {/* parapet */}
        <line x1={64} y1={228} x2={344} y2={228} strokeWidth={2.4} />
        {Array.from({ length: 14 }, (_, i) => 76 + i * 20).map((px) => (
          <line key={px} x1={px} y1={228} x2={px} y2={216} strokeWidth={1} opacity={0.7} />
        ))}
        {/* laturile scurte */}
        <line x1={64} y1={52} x2={64} y2={228} strokeWidth={1.6} />
        <line x1={344} y1={52} x2={344} y2={228} strokeWidth={1.6} />
      </g>
      {/* mobilierul propus pe latura scurta */}
      <g className="text-walnut">
        <Run x={70} y={58} w={60} h={164} />
      </g>
      {/* cote: lungimea utila + adancimea libera */}
      <DimH x1={64} x2={344} y={256} letter="A" ext={-16} value={v.A} />
      <DimV y1={52} y2={228} x={368} letter="B" ext={16} value={v.B} />
      <HeightGauge x={424} value={v.H} />
    </svg>
  );
}

// Vedere frontala a unei piese: latimea jos (A), inaltimea in dreapta (H).
export function FrontFigure({
  variant,
  withHeight,
  v = {},
}: {
  variant: 'wardrobe' | 'shelves' | 'drawers' | 'lowUnit' | 'slim' | 'small' | 'bench';
  withHeight: boolean;
  v?: FigureValues;
}) {
  // silueta per varianta: [x, y, w, h] + detalii de linie
  const box: Record<typeof variant, [number, number, number, number]> = {
    wardrobe: [120, 40, 220, 190],
    shelves: [130, 40, 200, 190],
    drawers: [130, 90, 200, 140],
    lowUnit: [90, 140, 290, 90],
    slim: [160, 50, 140, 180],
    small: [170, 120, 120, 110],
    bench: [110, 160, 250, 70],
  };
  const [x, y, w, h] = box[variant];
  const details: React.ReactNode = (() => {
    switch (variant) {
      case 'wardrobe':
        return (
          <>
            <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} />
            <line x1={x + w / 2 - 12} y1={y + h / 2 - 14} x2={x + w / 2 - 12} y2={y + h / 2 + 14} strokeWidth={2.4} />
            <line x1={x + w / 2 + 12} y1={y + h / 2 - 14} x2={x + w / 2 + 12} y2={y + h / 2 + 14} strokeWidth={2.4} />
          </>
        );
      case 'shelves': {
        const rows = [1, 2, 3, 4].map((i) => y + (h / 5) * i);
        return (
          <>
            {rows.map((py) => (
              <line key={py} x1={x} y1={py} x2={x + w} y2={py} />
            ))}
            <line x1={x + w / 2} y1={y + (h / 5) * 2} x2={x + w / 2} y2={y + h} opacity={0.7} />
          </>
        );
      }
      case 'drawers': {
        const rows = [1, 2, 3].map((i) => y + (h / 4) * i);
        return (
          <>
            {rows.map((py) => (
              <line key={py} x1={x} y1={py} x2={x + w} y2={py} />
            ))}
            {[0, 1, 2, 3].map((i) => (
              <line
                key={i}
                x1={x + w / 2 - 16}
                y1={y + (h / 4) * i + h / 8}
                x2={x + w / 2 + 16}
                y2={y + (h / 4) * i + h / 8}
                strokeWidth={2.4}
              />
            ))}
          </>
        );
      }
      case 'lowUnit':
        return (
          <>
            <line x1={x + w / 3} y1={y} x2={x + w / 3} y2={y + h} />
            <line x1={x + (w / 3) * 2} y1={y} x2={x + (w / 3) * 2} y2={y + h} />
            <line x1={x + w / 6 - 12} y1={y + 18} x2={x + w / 6 + 12} y2={y + 18} strokeWidth={2.4} />
            <line x1={x + w / 2 - 12} y1={y + 18} x2={x + w / 2 + 12} y2={y + 18} strokeWidth={2.4} />
          </>
        );
      case 'slim':
        return (
          <>
            <line x1={x} y1={y + h / 3} x2={x + w} y2={y + h / 3} />
            <line x1={x} y1={y + (h / 3) * 2} x2={x + w} y2={y + (h / 3) * 2} />
            {/* fronturi rabatabile: sageata de basculare */}
            <path d={`M${x + w / 2 - 10} ${y + h / 6 + 8} l10 -8 l10 8`} opacity={0.8} />
          </>
        );
      case 'small':
        return (
          <>
            <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} />
            <line x1={x + w / 2 - 12} y1={y + h / 4} x2={x + w / 2 + 12} y2={y + h / 4} strokeWidth={2.4} />
          </>
        );
      case 'bench':
        return (
          <>
            {/* sezutul */}
            <line x1={x - 8} y1={y} x2={x + w + 8} y2={y} strokeWidth={2.4} />
            <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} />
          </>
        );
    }
  })();

  return (
    <svg viewBox="0 0 470 300" className={SVG} aria-hidden="true">
      {/* linia podelei */}
      <line x1={40} y1={244} x2={400} y2={244} stroke="currentColor" strokeWidth={1.2} className="text-muted-2" />
      <g className="text-walnut" stroke="currentColor" fill="none" strokeWidth={1.6}>
        <rect x={x} y={y} width={w} height={h} fill="currentColor" fillOpacity={0.08} />
        {details}
        {/* soclu */}
        <line x1={x + 8} y1={y + h} x2={x + 8} y2={244} />
        <line x1={x + w - 8} y1={y + h} x2={x + w - 8} y2={244} />
      </g>
      <DimH x1={x} x2={x + w} y={266} letter="A" ext={-14} value={v.A} />
      {withHeight && <DimV y1={y} y2={244} x={x + w + 34} letter="H" ext={16} value={v.H} />}
    </svg>
  );
}

// Vedere frontala compusa (hol — idee 7 PO r2; extinsa la living/dormitor/
// birou/baie, feedback PO 2026-07-13): piesele selectate stau una langa alta
// pe aceeasi linie de podea, fiecare cu litera latimii ei si — unde flow-ul
// cere — cota proprie de inaltime; etalonul H apare pentru inaltimea camerei.
interface FrontPieceDef {
  slotId: string;
  // slotul de inaltime al piesei (living v3) — primeste cota verticala proprie
  heightSlotId?: string;
  w: number;
  // marginea de sus a siluetei; bottom doar la piesele care nu ating podeaua
  top: number;
  bottom?: number;
  draw: (x: number, w: number) => React.ReactNode;
  // etapa 10 (§8): piesa desenata fara slot si fara litera (patul, a doua noptiera);
  // `key` = numele ei, `after` = slotId / key dupa care se aseaza in rand
  extra?: boolean;
  key?: string;
  after?: string;
}

const HALLWAY_PIECES: FrontPieceDef[] = [
  {
    slotId: 'shoeCabinetWidth',
    w: 58,
    top: 124,
    // pantofar: fronturi rabatabile
    draw: (x, w) => (
      <g key="shoe">
        <rect x={x} y={124} width={w} height={120} fill="currentColor" fillOpacity={0.08} />
        <line x1={x} y1={164} x2={x + w} y2={164} />
        <line x1={x} y1={204} x2={x + w} y2={204} />
        <path d={`M${x + w / 2 - 8} ${148} l8 -7 l8 7`} opacity={0.8} />
      </g>
    ),
  },
  {
    slotId: 'coatUnitWidth',
    // etapa 10 (hol v3): inaltimea optionala a cuierului
    heightSlotId: 'coatUnitHeight',
    w: 68,
    top: 54,
    // cuier: polita sus + carlige
    draw: (x, w) => (
      <g key="coat">
        <rect x={x} y={54} width={w} height={190} fill="currentColor" fillOpacity={0.08} />
        <line x1={x} y1={84} x2={x + w} y2={84} />
        <circle cx={x + w / 3} cy={112} r={2.5} fill="currentColor" stroke="none" />
        <path d={`M${x + w / 3} 112 v14 a5 5 0 0 0 8 4`} />
        <circle cx={x + (w / 3) * 2} cy={112} r={2.5} fill="currentColor" stroke="none" />
        <path d={`M${x + (w / 3) * 2} 112 v14 a5 5 0 0 0 8 4`} />
      </g>
    ),
  },
  {
    slotId: 'wardrobeWidth',
    heightSlotId: 'wardrobeHeight',
    w: 88,
    top: 54,
    // dulap: doua usi cu manere
    draw: (x, w) => (
      <g key="wardrobe">
        <rect x={x} y={54} width={w} height={190} fill="currentColor" fillOpacity={0.08} />
        <line x1={x + w / 2} y1={54} x2={x + w / 2} y2={244} />
        <line x1={x + w / 2 - 9} y1={138} x2={x + w / 2 - 9} y2={160} strokeWidth={2.4} />
        <line x1={x + w / 2 + 9} y1={138} x2={x + w / 2 + 9} y2={160} strokeWidth={2.4} />
      </g>
    ),
  },
  {
    slotId: 'benchWidth',
    w: 78,
    top: 194,
    // bancuta: sezut gros + lada
    draw: (x, w) => (
      <g key="bench">
        <rect x={x} y={194} width={w} height={50} fill="currentColor" fillOpacity={0.08} />
        <line x1={x - 6} y1={194} x2={x + w + 6} y2={194} strokeWidth={2.4} />
        <line x1={x + w / 2} y1={194} x2={x + w / 2} y2={244} opacity={0.7} />
      </g>
    ),
  },
  {
    slotId: 'mirrorWidth',
    w: 44,
    top: 84,
    bottom: 214,
    // oglinda: rama pe perete (nu atinge podeaua) + reflexie sugerata
    draw: (x, w) => (
      <g key="mirror">
        <rect x={x} y={84} width={w} height={130} fill="currentColor" fillOpacity={0.05} />
        <rect x={x + 5} y={89} width={w - 10} height={120} strokeWidth={1} opacity={0.7} />
        <line x1={x + 12} y1={124} x2={x + w - 16} y2={100} strokeWidth={1} opacity={0.5} />
      </g>
    ),
  },
];

// Randul de piese: latimi scalate ca sa incapa pe podeaua 40..400; cand exista
// cote de inaltime per piesa, spatiul dintre piese creste ca sa le faca loc.
export function FrontRowFigure({
  defs,
  slotIds,
  letters,
  withHeight,
  heightLetter = 'H',
  v = {},
}: {
  defs: FrontPieceDef[];
  slotIds: string[];
  // slotId (latime SAU inaltime) → litera de pe desen
  letters: Record<string, string>;
  // etalonul de inaltime a camerei (tavan)
  withHeight: boolean;
  heightLetter?: string;
  v?: FigureValues;
}) {
  const pieces = defs.filter((p) => p.extra || slotIds.includes(p.slotId));
  const anyPieceHeights = pieces.some((p) => p.heightSlotId && letters[p.heightSlotId]);
  const gap = anyPieceHeights ? 34 : 6;
  const sumW = pieces.reduce((s, p) => s + p.w, 0);
  const scale = Math.min(1, (356 - gap * Math.max(0, pieces.length - 1)) / Math.max(sumW, 1));
  const total = sumW * scale + gap * Math.max(0, pieces.length - 1);
  // centrat pe podeaua 40..400
  let x = Math.max(40, 40 + (360 - total) / 2);
  const placed = pieces.map((p) => {
    const px = x;
    x += p.w * scale + gap;
    return { ...p, x: px, sw: p.w * scale };
  });
  return (
    <svg viewBox="0 0 470 300" className={SVG} aria-hidden="true">
      {/* linia podelei */}
      <line x1={40} y1={244} x2={400} y2={244} stroke="currentColor" strokeWidth={1.2} className="text-muted-2" />
      <g className="text-walnut" stroke="currentColor" fill="none" strokeWidth={1.6}>
        {placed.map((p) => p.draw(p.x, p.sw))}
      </g>
      {placed.map((p) => {
        if (p.extra) return null;
        const wLetter = letters[p.slotId] ?? '?';
        const hLetter = p.heightSlotId ? letters[p.heightSlotId] : undefined;
        return (
          <g key={p.slotId}>
            <DimH x1={p.x} x2={p.x + p.sw} y={266} letter={wLetter} ext={-14} value={v[wLetter]} />
            {hLetter && (
              <DimV
                y1={p.top}
                y2={p.bottom ?? 244}
                x={p.x + p.sw + 13}
                letter={hLetter}
                ext={6}
                value={v[hLetter]}
              />
            )}
          </g>
        );
      })}
      {withHeight && <HeightGauge x={424} letter={heightLetter} value={v[heightLetter]} />}
    </svg>
  );
}

// ---------- registrele de piese pentru camerele cu vedere frontala compusa ----------

// Living v3: fiecare piesa are latime + inaltime proprie (feedback PO 2026-07-13).
const LIVING_PIECES: FrontPieceDef[] = [
  {
    slotId: 'tvUnitWidth',
    heightSlotId: 'tvUnitHeight',
    w: 95,
    top: 184,
    // comoda TV joasa + televizorul sugerat deasupra
    draw: (x, w) => (
      <g key="tv">
        <rect x={x} y={184} width={w} height={60} fill="currentColor" fillOpacity={0.08} />
        <line x1={x + w / 3} y1={184} x2={x + w / 3} y2={244} />
        <line x1={x + (w / 3) * 2} y1={184} x2={x + (w / 3) * 2} y2={244} />
        <rect x={x + w / 2 - w / 4} y={124} width={w / 2} height={34} strokeWidth={1} opacity={0.45} />
      </g>
    ),
  },
  {
    slotId: 'bookshelfWidth',
    heightSlotId: 'bookshelfHeight',
    w: 72,
    top: 64,
    // biblioteca: rafturi orizontale
    draw: (x, w) => (
      <g key="bookshelf">
        <rect x={x} y={64} width={w} height={180} fill="currentColor" fillOpacity={0.08} />
        {[1, 2, 3, 4].map((i) => (
          <line key={i} x1={x} y1={64 + i * 36} x2={x + w} y2={64 + i * 36} />
        ))}
      </g>
    ),
  },
  {
    slotId: 'displayWidth',
    heightSlotId: 'displayHeight',
    w: 56,
    top: 74,
    // vitrina: usa de sticla cu reflexie
    draw: (x, w) => (
      <g key="display">
        <rect x={x} y={74} width={w} height={170} fill="currentColor" fillOpacity={0.05} />
        <rect x={x + 5} y={79} width={w - 10} height={130} strokeWidth={1} opacity={0.7} />
        <line x1={x + 10} y1={120} x2={x + w - 12} y2={92} strokeWidth={1} opacity={0.5} />
        <line x1={x} y1={214} x2={x + w} y2={214} />
      </g>
    ),
  },
  {
    slotId: 'coffeeTableLength',
    heightSlotId: 'coffeeTableHeight',
    w: 66,
    top: 200,
    // masuta: blat gros + picioare
    draw: (x, w) => (
      <g key="coffee">
        <line x1={x - 4} y1={200} x2={x + w + 4} y2={200} strokeWidth={3} />
        <line x1={x + 6} y1={200} x2={x + 6} y2={244} />
        <line x1={x + w - 6} y1={200} x2={x + w - 6} y2={244} />
      </g>
    ),
  },
  {
    slotId: 'shelvesTotal',
    heightSlotId: 'shelvesHeight',
    w: 72,
    top: 94,
    bottom: 174,
    // rafturi suspendate: nu ating podeaua
    draw: (x, w) => (
      <g key="shelves">
        <line x1={x} y1={94} x2={x + w} y2={94} strokeWidth={2.4} />
        <line x1={x + 8} y1={134} x2={x + w - 8} y2={134} strokeWidth={2.4} />
        <line x1={x} y1={174} x2={x + w} y2={174} strokeWidth={2.4} />
      </g>
    ),
  },
  {
    slotId: 'otherWidth',
    heightSlotId: 'otherHeight',
    w: 60,
    top: 124,
    // piesa libera: contur punctat cu semnul intrebarii
    draw: (x, w) => (
      <g key="other">
        <rect x={x} y={124} width={w} height={120} strokeDasharray="6 5" fill="none" />
        <text
          x={x + w / 2}
          y={192}
          textAnchor="middle"
          fontSize={26}
          fontFamily="var(--font-mono)"
          fill="currentColor"
          stroke="none"
          opacity={0.6}
        >
          ?
        </text>
      </g>
    ),
  },
];

// Dormitor v2: doar latimi per piesa + inaltimea camerei (etalon H).
const BEDROOM_PIECES: FrontPieceDef[] = [
  {
    slotId: 'wardrobeWidth',
    // etapa 10 (dormitor v4): inaltimea optionala a dulapului
    heightSlotId: 'wardrobeHeight',
    w: 88,
    top: 54,
    draw: (x, w) => (
      <g key="wardrobe">
        <rect x={x} y={54} width={w} height={190} fill="currentColor" fillOpacity={0.08} />
        <line x1={x + w / 2} y1={54} x2={x + w / 2} y2={244} />
        <line x1={x + w / 2 - 9} y1={138} x2={x + w / 2 - 9} y2={160} strokeWidth={2.4} />
        <line x1={x + w / 2 + 9} y1={138} x2={x + w / 2 + 9} y2={160} strokeWidth={2.4} />
      </g>
    ),
  },
  {
    slotId: 'dresserWidth',
    w: 76,
    top: 140,
    // comoda: trei sertare cu manere
    draw: (x, w) => (
      <g key="dresser">
        <rect x={x} y={140} width={w} height={104} fill="currentColor" fillOpacity={0.08} />
        {[1, 2].map((i) => (
          <line key={i} x1={x} y1={140 + i * 35} x2={x + w} y2={140 + i * 35} />
        ))}
        {[0, 1, 2].map((i) => (
          <line
            key={`h${i}`}
            x1={x + w / 2 - 12}
            y1={157 + i * 35}
            x2={x + w / 2 + 12}
            y2={157 + i * 35}
            strokeWidth={2.4}
          />
        ))}
      </g>
    ),
  },
  {
    slotId: 'tvUnitWidth',
    w: 86,
    top: 184,
    draw: (x, w) => (
      <g key="tv">
        <rect x={x} y={184} width={w} height={60} fill="currentColor" fillOpacity={0.08} />
        <line x1={x + w / 2} y1={184} x2={x + w / 2} y2={244} />
        <rect x={x + w / 2 - w / 4} y={124} width={w / 2} height={34} strokeWidth={1} opacity={0.45} />
      </g>
    ),
  },
  {
    slotId: 'vanityWidth',
    w: 64,
    top: 110,
    // masuta de toaleta: blat + picioare + oglinda ovala
    draw: (x, w) => (
      <g key="vanity">
        <ellipse cx={x + w / 2} cy={134} rx={w / 3.4} ry={24} strokeWidth={1} opacity={0.7} />
        <line x1={x - 4} y1={172} x2={x + w + 4} y2={172} strokeWidth={2.4} />
        <line x1={x + 6} y1={172} x2={x + 6} y2={244} />
        <line x1={x + w - 6} y1={172} x2={x + w - 6} y2={244} />
      </g>
    ),
  },
  {
    slotId: 'nightstandWidth',
    w: 46,
    top: 174,
    draw: (x, w) => (
      <g key="nightstand">
        <rect x={x} y={174} width={w} height={70} fill="currentColor" fillOpacity={0.08} />
        <line x1={x} y1={209} x2={x + w} y2={209} />
        <line x1={x + w / 2 - 9} y1={191} x2={x + w / 2 + 9} y2={191} strokeWidth={2.4} />
      </g>
    ),
  },
];

// Dormitor (etapa 10, §8): patul ca silueta fara litera (latimea vine din saltea) si a
// doua noptiera, ca noptierele sa apara ca pereche, cate una de fiecare parte a patului.
const BEDROOM_BED: FrontPieceDef = {
  slotId: '',
  extra: true,
  key: 'bed',
  after: 'nightstandWidth',
  w: 120,
  top: 150,
  draw: (x, w) => (
    <g key="bed" data-figure-extra="bed">
      {/* tablia, in spate */}
      <rect x={x + 4} y={150} width={w - 8} height={56} rx={4} fill="currentColor" fillOpacity={0.05} />
      {/* salteaua + cadrul */}
      <rect x={x} y={192} width={w} height={16} rx={5} fill="currentColor" fillOpacity={0.12} />
      <rect x={x} y={208} width={w} height={26} fill="currentColor" fillOpacity={0.08} />
      <line x1={x + 6} y1={234} x2={x + 6} y2={244} />
      <line x1={x + w - 6} y1={234} x2={x + w - 6} y2={244} />
    </g>
  ),
};

const BEDROOM_NIGHTSTAND_RIGHT: FrontPieceDef = {
  slotId: '',
  extra: true,
  key: 'nightstandRight',
  after: 'bed',
  w: 46,
  top: 174,
  draw: (x, w) => (
    <g key="nightstand-right" data-figure-extra="nightstand">
      <rect x={x} y={174} width={w} height={70} fill="currentColor" fillOpacity={0.08} />
      <line x1={x} y1={209} x2={x + w} y2={209} />
      <line x1={x + w / 2 - 9} y1={191} x2={x + w / 2 + 9} y2={191} strokeWidth={2.4} />
    </g>
  ),
};

function bedroomExtras(answers: AnswerMap, slotIds: string[]): FrontPieceDef[] {
  const pieces = Array.isArray(answers.piecesNeeded) ? (answers.piecesNeeded as string[]) : [];
  const hasBed = pieces.includes('BED_FRAME');
  const hasNightstands = slotIds.includes('nightstandWidth');
  const out: FrontPieceDef[] = [];
  if (hasBed) out.push(BEDROOM_BED);
  // fara pat, a doua noptiera sta direct langa prima
  if (hasNightstands) out.push(hasBed ? BEDROOM_NIGHTSTAND_RIGHT : { ...BEDROOM_NIGHTSTAND_RIGHT, after: 'nightstandWidth' });
  return out;
}

// Birou (camera): piesele fara birou; biroul are vederea de sus proprie.
const OFFICE_FRONT_PIECES: FrontPieceDef[] = [
  {
    slotId: 'bookshelfWidth',
    // etapa 10 (birou v4): inaltimi optionale
    heightSlotId: 'bookshelfHeight',
    w: 72,
    top: 64,
    draw: (x, w) => (
      <g key="bookshelf">
        <rect x={x} y={64} width={w} height={180} fill="currentColor" fillOpacity={0.08} />
        {[1, 2, 3, 4].map((i) => (
          <line key={i} x1={x} y1={64 + i * 36} x2={x + w} y2={64 + i * 36} />
        ))}
      </g>
    ),
  },
  {
    slotId: 'storageWidth',
    heightSlotId: 'storageHeight',
    w: 84,
    top: 74,
    draw: (x, w) => (
      <g key="storage">
        <rect x={x} y={74} width={w} height={170} fill="currentColor" fillOpacity={0.08} />
        <line x1={x + w / 2} y1={74} x2={x + w / 2} y2={244} />
        <line x1={x + w / 2 - 9} y1={148} x2={x + w / 2 - 9} y2={168} strokeWidth={2.4} />
        <line x1={x + w / 2 + 9} y1={148} x2={x + w / 2 + 9} y2={168} strokeWidth={2.4} />
      </g>
    ),
  },
  {
    slotId: 'shelvesTotal',
    w: 72,
    top: 94,
    bottom: 174,
    draw: (x, w) => (
      <g key="shelves">
        <line x1={x} y1={94} x2={x + w} y2={94} strokeWidth={2.4} />
        <line x1={x + 8} y1={134} x2={x + w - 8} y2={134} strokeWidth={2.4} />
        <line x1={x} y1={174} x2={x + w} y2={174} strokeWidth={2.4} />
      </g>
    ),
  },
];

// Baie: lavoar suspendat + dulap cu oglinda + coloana.
const BATHROOM_PIECES: FrontPieceDef[] = [
  {
    slotId: 'vanityWidth',
    w: 76,
    top: 154,
    bottom: 224,
    // corp lavoar suspendat, cu cuva sugerata deasupra
    draw: (x, w) => (
      <g key="vanity">
        <rect x={x} y={154} width={w} height={70} fill="currentColor" fillOpacity={0.08} />
        <line x1={x} y1={189} x2={x + w} y2={189} />
        <ellipse cx={x + w / 2} cy={148} rx={w / 3.6} ry={8} strokeWidth={1} opacity={0.7} />
      </g>
    ),
  },
  {
    slotId: 'mirrorWidth',
    // etapa 10 (baie v4): inaltimi optionale
    heightSlotId: 'mirrorHeight',
    w: 56,
    top: 64,
    bottom: 144,
    // dulap cu oglinda, montat pe perete
    draw: (x, w) => (
      <g key="mirror">
        <rect x={x} y={64} width={w} height={80} fill="currentColor" fillOpacity={0.05} />
        <rect x={x + 5} y={69} width={w - 10} height={70} strokeWidth={1} opacity={0.7} />
        <line x1={x + 12} y1={104} x2={x + w - 14} y2={82} strokeWidth={1} opacity={0.5} />
      </g>
    ),
  },
  {
    slotId: 'tallStorageWidth',
    heightSlotId: 'tallStorageHeight',
    w: 44,
    top: 54,
    draw: (x, w) => (
      <g key="tall">
        <rect x={x} y={54} width={w} height={190} fill="currentColor" fillOpacity={0.08} />
        <line x1={x} y1={118} x2={x + w} y2={118} />
        <line x1={x} y1={182} x2={x + w} y2={182} />
      </g>
    ),
  },
];

// Vedere de sus pentru birou (drept / in L / in U — feedback PO 2026-07-13).
export function DeskTopFigure({
  shape,
  showDepth = true,
  v = {},
}: {
  shape: 'STRAIGHT' | 'L_SHAPE' | 'U_SHAPE';
  // cota de adancime D exista doar la piesa ghidata; camera birou nu o cere
  showDepth?: boolean;
  v?: FigureValues;
}) {
  const showB = shape === 'L_SHAPE' || shape === 'U_SHAPE';
  const showC = shape === 'U_SHAPE';
  const chairX = shape === 'L_SHAPE' ? 262 : 235;
  return (
    <svg viewBox="0 0 470 280" className={SVG} aria-hidden="true">
      <g className="text-walnut">
        <Run x={110} y={70} w={250} h={70} />
        {showB && <Run x={110} y={140} w={70} h={100} />}
        {showC && <Run x={290} y={140} w={70} h={100} />}
      </g>
      {/* scaunul, doar sugerat */}
      <g className="text-muted-2" stroke="currentColor" fill="none" strokeWidth={1.2}>
        <circle cx={chairX} cy={190} r={17} />
        <path d={`M${chairX - 17} 202 a24 24 0 0 0 34 0`} opacity={0.7} />
      </g>
      <DimH x1={110} x2={360} y={44} letter="A" ext={14} value={v.A} />
      {showB && <DimV y1={140} y2={240} x={84} letter="B" ext={-14} value={v.B} />}
      {showC && <DimV y1={140} y2={240} x={390} letter="C" ext={16} value={v.C} />}
      {showDepth && !showC && <DimV y1={70} y2={140} x={390} letter="D" ext={16} value={v.D} />}
      {showDepth && showC && <DimV y1={70} y2={140} x={62} letter="D" ext={-14} value={v.D} />}
    </svg>
  );
}

// Vedere de sus pentru masa (dreptunghiulara/extensibila sau rotunda).
export function TableTopFigure({ round, v = {} }: { round: boolean; v?: FigureValues }) {
  if (round) {
    return (
      <svg viewBox="0 0 470 280" className={SVG} aria-hidden="true">
        <g className="text-walnut" stroke="currentColor" fill="none">
          <circle cx={230} cy={140} r={85} fill="currentColor" fillOpacity={0.08} strokeWidth={1.6} />
          <circle cx={230} cy={140} r={6} strokeWidth={1.2} opacity={0.7} />
        </g>
        {/* scaune sugerate */}
        <g className="text-muted-2" stroke="currentColor" fill="none" strokeWidth={1.2} opacity={0.8}>
          <circle cx={230} cy={30} r={13} />
          <circle cx={230} cy={250} r={13} />
          <circle cx={118} cy={140} r={13} />
          <circle cx={342} cy={140} r={13} />
        </g>
        <DimH x1={145} x2={315} y={140} letter="Ø" value={v['Ø']} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 470 300" className={SVG} aria-hidden="true">
      <g className="text-walnut" stroke="currentColor" fill="none">
        <rect x={120} y={80} width={230} height={120} fill="currentColor" fillOpacity={0.08} strokeWidth={1.6} />
        {/* linia de extensie din mijloc */}
        <line x1={235} y1={80} x2={235} y2={200} strokeWidth={1} opacity={0.6} />
      </g>
      <g className="text-muted-2" stroke="currentColor" fill="none" strokeWidth={1.2} opacity={0.8}>
        <circle cx={180} cy={56} r={13} />
        <circle cx={290} cy={56} r={13} />
        <circle cx={180} cy={224} r={13} />
        <circle cx={290} cy={224} r={13} />
      </g>
      <DimH x1={120} x2={350} y={252} letter="A" ext={-14} value={v.A} />
      <DimV y1={80} y2={200} x={382} letter="B" ext={16} value={v.B} />
    </svg>
  );
}

function MattressFigure({ v = {} }: { v?: FigureValues }) {
  return (
    <svg viewBox="0 0 470 300" className={SVG} aria-hidden="true" data-dimension-figure="mattress">
      <g className="text-walnut" stroke="currentColor" fill="none" strokeWidth={1.6}>
        <rect x={155} y={30} width={160} height={210} rx={12} fill="currentColor" fillOpacity={0.08} />
        <rect x={170} y={45} width={130} height={42} rx={8} />
        <path d="M155 98h160" opacity={0.55} />
      </g>
      <DimH x1={155} x2={315} y={266} letter="A" ext={-14} value={v.A} />
      <DimV y1={30} y2={240} x={350} letter="B" ext={16} value={v.B} />
    </svg>
  );
}

// ---------- selectia figurii + literele per slot ----------

export interface DimensionFigure {
  node: React.ReactNode;
  // slotId → litera din desen; sloturile fara litera raman fara insigna
  letters: Record<string, string>;
}

const KITCHEN_LETTERS: Record<string, string> = {
  runA: 'A',
  runB: 'B',
  runC: 'C',
  ceilingHeight: 'H',
  islandLength: 'L',
  islandDepth: 'D',
};

const RUNS_LETTERS: Record<string, string> = { runA: 'A', runB: 'B', runC: 'C' };

const DRESSING_RUNS: Record<string, number> = { LINEAR: 1, L_SHAPE: 2, U_SHAPE: 3, WALK_IN: 2 };
const PANTRY_RUNS: Record<string, number> = { ONE_WALL: 1, L_SHAPE: 2, U_SHAPE: 3 };

// Piesele cu vedere frontala: varianta de desen + daca exista cota de inaltime.
const FRONT_PIECES: Partial<
  Record<RoomType, { variant: Parameters<typeof FrontFigure>[0]['variant']; heightSlots: string[] }>
> = {
  PIECE_WARDROBE: { variant: 'wardrobe', heightSlots: ['height', 'ceilingHeight'] },
  PIECE_BOOKCASE: { variant: 'shelves', heightSlots: ['height'] },
  PIECE_DRESSER: { variant: 'drawers', heightSlots: ['height'] },
  PIECE_TV_UNIT: { variant: 'lowUnit', heightSlots: [] },
  PIECE_SHOE_CABINET: { variant: 'slim', heightSlots: ['height'] },
  PIECE_NIGHTSTAND: { variant: 'small', heightSlots: [] },
  PIECE_BENCH: { variant: 'bench', heightSlots: [] },
};

// Litere pentru un rand de piese: latimi A, B, C… in ordinea plansei; cotele
// de inaltime per piesa (living v3) primesc H1, H2… in aceeasi ordine.
function rowLetters(
  defs: FrontPieceDef[],
  slotIds: string[],
): { letters: Record<string, string>; widthSlots: string[] } {
  const selected = defs.filter((p) => !p.extra && slotIds.includes(p.slotId));
  const letters: Record<string, string> = {};
  let heights = 0;
  selected.forEach((p, i) => {
    letters[p.slotId] = String.fromCharCode(65 + i); // A, B, C…
    if (p.heightSlotId && slotIds.includes(p.heightSlotId)) {
      heights += 1;
      letters[p.heightSlotId] = `H${heights}`;
    }
  });
  return { letters, widthSlots: selected.map((p) => p.slotId) };
}

// Conversia valorilor per slot in valori per litera (ce afiseaza desenul).
function byLetter(
  letters: Record<string, string>,
  values?: Record<string, string>,
): FigureValues {
  if (!values) return {};
  const out: FigureValues = {};
  for (const [slotId, letter] of Object.entries(letters)) {
    if (values[slotId] !== undefined) out[letter] = values[slotId];
  }
  return out;
}

// Figura compusa a unei camere pe randul de piese + optional etalonul H.
function rowFigure(
  defs: FrontPieceDef[],
  slotIds: string[],
  values: Record<string, string> | undefined,
  ceilingSlot?: string,
  // etapa 10 (§8): piesele fara slot (desenate, fara litera), asezate dupa `after`
  extras: FrontPieceDef[] = [],
): DimensionFigure | null {
  const { letters, widthSlots } = rowLetters(defs, slotIds);
  const rowDefs = withExtras(defs, slotIds, extras);
  if (widthSlots.length === 0) return null;
  const withHeight = Boolean(ceilingSlot && slotIds.includes(ceilingSlot));
  if (ceilingSlot && withHeight) letters[ceilingSlot] = 'H';
  return {
    node: (
      <FrontRowFigure
        defs={rowDefs}
        slotIds={slotIds}
        letters={letters}
        withHeight={withHeight}
        v={byLetter(letters, values)}
      />
    ),
    letters,
  };
}

// Randul de piese cu extras inserate: dupa piesa (aleasa) / extra-ul numit in `after`,
// altfel la capat.
function withExtras(defs: FrontPieceDef[], slotIds: string[], extras: FrontPieceDef[]): FrontPieceDef[] {
  if (extras.length === 0) return defs;
  const out = defs.filter((p) => slotIds.includes(p.slotId));
  for (const e of extras) {
    const i = e.after ? out.findIndex((p) => (p.extra ? p.key : p.slotId) === e.after) : -1;
    if (i >= 0) out.splice(i + 1, 0, e);
    else out.push(e);
  }
  return out;
}

export function getDimensionFigure(
  roomType: RoomType,
  answers: AnswerMap,
  slotIds: string[],
  // valori formatate per slotId (ex. '2,4 m') — apar langa litere pe desen
  values?: Record<string, string>,
  // sloturile gresite (in afara intervalului / goale dupa "Continua") — cota lor e rosie
  invalidSlotIds?: readonly string[],
): DimensionFigure | null {
  const figure = figureFor(roomType, answers, slotIds, values);
  if (!figure) return null;
  const letters = new Set(
    (invalidSlotIds ?? []).map((id) => figure.letters[id]).filter((l): l is string => Boolean(l)),
  );
  return {
    ...figure,
    node: (
      <FigureSizeProvider>
        <InvalidLetters.Provider value={letters}>{figure.node}</InvalidLetters.Provider>
      </FigureSizeProvider>
    ),
  };
}

function figureFor(
  roomType: RoomType,
  answers: AnswerMap,
  slotIds: string[],
  values?: Record<string, string>,
): DimensionFigure | null {
  switch (roomType) {
    case 'KITCHEN': {
      const layout = typeof answers.layout === 'string' ? answers.layout : 'STRAIGHT';
      return {
        node: (
          <KitchenPlanFigure
            layout={layout}
            hasIsland={answers.hasIsland === true}
            v={byLetter(KITCHEN_LETTERS, values)}
          />
        ),
        letters: KITCHEN_LETTERS,
      };
    }
    case 'DRESSING': {
      // etapa 10 (§5.2): numarul laturilor vine din sloturile pasului (v5: walk-in cu A / B / C;
      // v3 / v4 raman cu 2), cu rezerva pe forma
      const fromSlots = Object.keys(RUNS_LETTERS).filter((id) => slotIds.includes(id)).length;
      const runs = fromSlots > 0 ? fromSlots : (DRESSING_RUNS[String(answers.layout)] ?? 1);
      const letters = { ...RUNS_LETTERS, wardrobeHeight: 'H' };
      const v = byLetter(letters, values);
      return {
        node:
          answers.layout === 'WALK_IN' && runs >= 3 ? <WalkInPlanFigure v={v} /> : <WallsPlanFigure runs={runs} v={v} />,
        letters,
      };
    }
    case 'PANTRY': {
      const runs = PANTRY_RUNS[String(answers.wallsUsed)] ?? 1;
      const letters = { ...RUNS_LETTERS, ceilingHeight: 'H' };
      return {
        node: <WallsPlanFigure runs={runs} v={byLetter(letters, values)} />,
        letters,
      };
    }
    case 'LAUNDRY': {
      const letters = { runA: 'A', ceilingHeight: 'H' };
      return {
        node: <WallsPlanFigure runs={1} v={byLetter(letters, values)} />,
        letters,
      };
    }
    case 'BALCONY': {
      const letters = { balconyLength: 'A', balconyDepth: 'B', ceilingHeight: 'H' };
      return {
        node: <BalconyPlanFigure v={byLetter(letters, values)} />,
        letters,
      };
    }
    case 'HALLWAY':
      return rowFigure(HALLWAY_PIECES, slotIds, values, 'ceilingHeight');
    case 'LIVING':
      // v3: latime + inaltime per piesa; tavanul ramane etalonul H
      return rowFigure(LIVING_PIECES, slotIds, values, 'ceilingHeight');
    case 'BEDROOM':
      if (slotIds.includes('bedCustomWidth') || slotIds.includes('bedCustomLength')) {
        const letters = { bedCustomWidth: 'A', bedCustomLength: 'B' };
        return { node: <MattressFigure v={byLetter(letters, values)} />, letters };
      }
      return rowFigure(BEDROOM_PIECES, slotIds, values, 'ceilingHeight', bedroomExtras(answers, slotIds));
    case 'BATHROOM':
      return rowFigure(BATHROOM_PIECES, slotIds, values, 'ceilingHeight');
    case 'OFFICE': {
      // biroul are vederea de sus proprie (drept / L / U); restul pieselor
      // stau pe randul frontal de sub ea
      const shape =
        answers.deskShape === 'L_SHAPE' || answers.deskShape === 'U_SHAPE'
          ? answers.deskShape
          : 'STRAIGHT';
      const hasDesk = slotIds.includes('deskWidthA');
      const deskLetters: Record<string, string> = hasDesk
        ? { deskWidthA: 'A', deskWidthB: 'B', deskWidthC: 'C' }
        : {};
      const rowSlotIds = slotIds.filter((id) => !id.startsWith('deskWidth'));
      const widthSlots = OFFICE_FRONT_PIECES.map((p) => p.slotId).filter((id) =>
        rowSlotIds.includes(id),
      );
      // literele randului continua dupa cele ale biroului (A-C rezervate)
      const offset = hasDesk ? 3 : 0;
      const rowLettersShifted: Record<string, string> = {};
      let heights = 0;
      widthSlots.forEach((id, i) => {
        rowLettersShifted[id] = String.fromCharCode(65 + offset + i);
        // etapa 10 (birou v4): inaltimea optionala a piesei → H1, H2… (ca living)
        const heightSlot = OFFICE_FRONT_PIECES.find((p) => p.slotId === id)?.heightSlotId;
        if (heightSlot && rowSlotIds.includes(heightSlot)) {
          heights += 1;
          rowLettersShifted[heightSlot] = `H${heights}`;
        }
      });
      const withHeight = slotIds.includes('ceilingHeight');
      if (withHeight) rowLettersShifted.ceilingHeight = 'H';
      const letters = { ...deskLetters, ...rowLettersShifted };
      if (!hasDesk && widthSlots.length === 0) return null;
      return {
        node: (
          <>
            {hasDesk && (
              <DeskTopFigure shape={shape} showDepth={false} v={byLetter(deskLetters, values)} />
            )}
            {widthSlots.length > 0 && (
              <FrontRowFigure
                defs={OFFICE_FRONT_PIECES}
                slotIds={rowSlotIds}
                letters={rowLettersShifted}
                withHeight={withHeight}
                v={byLetter(rowLettersShifted, values)}
              />
            )}
          </>
        ),
        letters,
      };
    }
    case 'PIECE_DESK': {
      const shape = answers.shape === 'L_SHAPE' ? 'L_SHAPE' : 'STRAIGHT';
      const letters = { widthA: 'A', widthB: 'B', depth: 'D' };
      return {
        node: <DeskTopFigure shape={shape} v={byLetter(letters, values)} />,
        letters,
      };
    }
    case 'PIECE_TABLE': {
      const round = answers.shape === 'ROUND';
      const letters: Record<string, string> = round
        ? { diameter: 'Ø' }
        : { length: 'A', width: 'B' };
      return {
        node: <TableTopFigure round={round} v={byLetter(letters, values)} />,
        letters,
      };
    }
    default: {
      const front = FRONT_PIECES[roomType];
      if (!front) return null;
      const heightSlot = front.heightSlots.find((id) => slotIds.includes(id));
      const letters: Record<string, string> = { width: 'A' };
      if (heightSlot) letters[heightSlot] = 'H';
      return {
        node: (
          <FrontFigure
            variant={front.variant}
            withHeight={Boolean(heightSlot)}
            v={byLetter(letters, values)}
          />
        ),
        letters,
      };
    }
  }
}
