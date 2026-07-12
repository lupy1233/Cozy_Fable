'use client';

import type { AnswerMap, RoomType } from '@marketplace/shared';

// Figurile pasului de dimensiuni (feedback PO item 11): planse statice, desenate
// de mana (coordonate fixe, ca o imagine), nu geometrie calculata la runtime.
// In desen apar DOAR litere in insigne (A/B/C/H/L/D) — valorile, care au latime
// variabila, stau in legenda HTML de sub figura si pe campurile de input, deci
// nu se pot suprapune niciodata cu desenul si raman perfect lizibile.
// Stil: plansa de arhitect — pereti dubli, corpuri hasurate, cote cu sageti.

const brass = 'hsl(var(--brass))';
const card = 'hsl(var(--card))';

// ---------- primitive de cotare ----------

function Badge({ x, y, letter }: { x: number; y: number; letter: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={11} fill={card} stroke={brass} strokeWidth={1.4} />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fontFamily="var(--font-mono)"
        fill={brass}
      >
        {letter}
      </text>
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
}: {
  x1: number;
  x2: number;
  y: number;
  letter: string;
  // lungimea liniilor de extensie (spre desen); 0 = fara
  ext?: number;
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
      <Badge x={mid} y={y} letter={letter} />
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
}: {
  y1: number;
  y2: number;
  x: number;
  letter: string;
  ext?: number;
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
      <Badge x={x} y={mid} letter={letter} />
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
function HeightGauge({ x, letter = 'H' }: { x: number; letter?: string }) {
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
      <DimV y1={46} y2={234} x={x + 6} letter={letter} />
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
const SVG = 'mx-auto w-full max-w-md';

// ---------- figurile per tip de intrebare ----------

export function KitchenPlanFigure({
  layout,
  hasIsland,
}: {
  layout: string;
  hasIsland: boolean;
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
          <DimH x1={158} x2={250} y={207} letter="L" ext={16} />
          <DimV y1={140} y2={184} x={272} letter="D" ext={-14} />
        </g>
      )}
      {/* cotele laturilor, in afara peretilor */}
      <DimH x1={71} x2={337} y={22} letter="A" ext={12} />
      {showB && <DimV y1={81} y2={240} x={44} letter="B" ext={-14} />}
      {showC && <DimV y1={81} y2={240} x={364} letter="C" ext={16} />}
      <HeightGauge x={424} />
    </svg>
  );
}

export function WallsPlanFigure({ runs, heightLetter = 'H' }: { runs: number; heightLetter?: string }) {
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
      <DimH x1={71} x2={337} y={22} letter="A" ext={12} />
      {showB && <DimV y1={81} y2={240} x={44} letter="B" ext={-14} />}
      {showC && <DimV y1={81} y2={240} x={364} letter="C" ext={16} />}
      <HeightGauge x={424} letter={heightLetter} />
    </svg>
  );
}

export function BalconyPlanFigure() {
  return (
    <svg viewBox="0 0 470 280" className={SVG} aria-hidden="true">
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
      <DimH x1={64} x2={344} y={256} letter="A" ext={-16} />
      <DimV y1={52} y2={228} x={368} letter="B" ext={16} />
      <HeightGauge x={424} />
    </svg>
  );
}

// Vedere frontala a unei piese: latimea jos (A), inaltimea in dreapta (H).
export function FrontFigure({
  variant,
  withHeight,
}: {
  variant: 'wardrobe' | 'shelves' | 'drawers' | 'lowUnit' | 'slim' | 'small' | 'bench';
  withHeight: boolean;
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
    <svg viewBox="0 0 470 280" className={SVG} aria-hidden="true">
      {/* linia podelei */}
      <line x1={40} y1={244} x2={400} y2={244} stroke="currentColor" strokeWidth={1.2} className="text-muted-2" />
      <g className="text-walnut" stroke="currentColor" fill="none" strokeWidth={1.6}>
        <rect x={x} y={y} width={w} height={h} fill="currentColor" fillOpacity={0.08} />
        {details}
        {/* soclu */}
        <line x1={x + 8} y1={y + h} x2={x + 8} y2={244} />
        <line x1={x + w - 8} y1={y + h} x2={x + w - 8} y2={244} />
      </g>
      <DimH x1={x} x2={x + w} y={266} letter="A" ext={-14} />
      {withHeight && <DimV y1={y} y2={244} x={x + w + 34} letter="H" ext={16} />}
    </svg>
  );
}

// Vedere frontala compusa pentru hol (idee 7 PO r2): piesele selectate stau
// una langa alta pe aceeasi linie de podea, fiecare cu litera latimii ei;
// etalonul H apare doar cand exista o piesa inalta (dulap/cuier).
const HALLWAY_PIECES: {
  slotId: string;
  w: number;
  draw: (x: number, w: number) => React.ReactNode;
}[] = [
  {
    slotId: 'shoeCabinetWidth',
    w: 58,
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
    w: 68,
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
    w: 88,
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

export function HallwayFrontFigure({
  slotIds,
  letters,
  withHeight,
}: {
  slotIds: string[];
  letters: Record<string, string>;
  withHeight: boolean;
}) {
  const pieces = HALLWAY_PIECES.filter((p) => slotIds.includes(p.slotId));
  const gap = 6;
  const total = pieces.reduce((s, p) => s + p.w, 0) + gap * Math.max(0, pieces.length - 1);
  // centrat pe podeaua 40..400
  let x = Math.max(40, 40 + (360 - total) / 2);
  const placed = pieces.map((p) => {
    const px = x;
    x += p.w + gap;
    return { ...p, x: px };
  });
  return (
    <svg viewBox="0 0 470 280" className={SVG} aria-hidden="true">
      {/* linia podelei */}
      <line x1={40} y1={244} x2={400} y2={244} stroke="currentColor" strokeWidth={1.2} className="text-muted-2" />
      <g className="text-walnut" stroke="currentColor" fill="none" strokeWidth={1.6}>
        {placed.map((p) => p.draw(p.x, p.w))}
      </g>
      {placed.map((p) => (
        <DimH key={p.slotId} x1={p.x} x2={p.x + p.w} y={266} letter={letters[p.slotId] ?? '?'} ext={-14} />
      ))}
      {withHeight && <HeightGauge x={424} />}
    </svg>
  );
}

// Vedere de sus pentru birou (drept / in L).
export function DeskTopFigure({ lShape }: { lShape: boolean }) {
  return (
    <svg viewBox="0 0 470 280" className={SVG} aria-hidden="true">
      <g className="text-walnut">
        <Run x={110} y={70} w={250} h={70} />
        {lShape && <Run x={110} y={140} w={70} h={100} />}
      </g>
      {/* scaunul, doar sugerat */}
      <g className="text-muted-2" stroke="currentColor" fill="none" strokeWidth={1.2}>
        <circle cx={250} cy={185} r={17} />
        <path d="M233 197 a24 24 0 0 0 34 0" opacity={0.7} />
      </g>
      <DimH x1={110} x2={360} y={44} letter="A" ext={14} />
      {lShape && <DimV y1={140} y2={240} x={84} letter="B" ext={-14} />}
      <DimV y1={70} y2={140} x={390} letter="D" ext={16} />
    </svg>
  );
}

// Vedere de sus pentru masa (dreptunghiulara/extensibila sau rotunda).
export function TableTopFigure({ round }: { round: boolean }) {
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
        <DimH x1={145} x2={315} y={140} letter="Ø" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 470 280" className={SVG} aria-hidden="true">
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
      <DimH x1={120} x2={350} y={252} letter="A" ext={-14} />
      <DimV y1={80} y2={200} x={382} letter="B" ext={16} />
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

export function getDimensionFigure(
  roomType: RoomType,
  answers: AnswerMap,
  slotIds: string[],
): DimensionFigure | null {
  switch (roomType) {
    case 'KITCHEN': {
      const layout = typeof answers.layout === 'string' ? answers.layout : 'STRAIGHT';
      return {
        node: <KitchenPlanFigure layout={layout} hasIsland={answers.hasIsland === true} />,
        letters: KITCHEN_LETTERS,
      };
    }
    case 'DRESSING': {
      const runs = DRESSING_RUNS[String(answers.layout)] ?? 1;
      return {
        node: <WallsPlanFigure runs={runs} />,
        letters: { ...RUNS_LETTERS, wardrobeHeight: 'H' },
      };
    }
    case 'PANTRY': {
      const runs = PANTRY_RUNS[String(answers.wallsUsed)] ?? 1;
      return {
        node: <WallsPlanFigure runs={runs} />,
        letters: { ...RUNS_LETTERS, ceilingHeight: 'H' },
      };
    }
    case 'LAUNDRY':
      return {
        node: <WallsPlanFigure runs={1} />,
        letters: { runA: 'A', ceilingHeight: 'H' },
      };
    case 'BALCONY':
      return {
        node: <BalconyPlanFigure />,
        letters: { balconyLength: 'A', balconyDepth: 'B', ceilingHeight: 'H' },
      };
    case 'HALLWAY': {
      // litere in ordinea pieselor de pe plansa (doar cele selectate)
      const widthSlots = HALLWAY_PIECES.map((p) => p.slotId).filter((id) => slotIds.includes(id));
      if (widthSlots.length === 0) return null;
      const letters: Record<string, string> = {};
      widthSlots.forEach((id, i) => {
        letters[id] = String.fromCharCode(65 + i); // A, B, C…
      });
      const withHeight = slotIds.includes('ceilingHeight');
      if (withHeight) letters.ceilingHeight = 'H';
      return {
        node: <HallwayFrontFigure slotIds={slotIds} letters={letters} withHeight={withHeight} />,
        letters,
      };
    }
    case 'PIECE_DESK': {
      const lShape = answers.shape === 'L_SHAPE';
      return {
        node: <DeskTopFigure lShape={lShape} />,
        letters: { widthA: 'A', widthB: 'B', depth: 'D' },
      };
    }
    case 'PIECE_TABLE': {
      const round = answers.shape === 'ROUND';
      return {
        node: <TableTopFigure round={round} />,
        letters: round ? { diameter: 'Ø' } : { length: 'A', width: 'B' },
      };
    }
    default: {
      const front = FRONT_PIECES[roomType];
      if (!front) return null;
      const heightSlot = front.heightSlots.find((id) => slotIds.includes(id));
      const letters: Record<string, string> = { width: 'A' };
      if (heightSlot) letters[heightSlot] = 'H';
      return {
        node: <FrontFigure variant={front.variant} withHeight={Boolean(heightSlot)} />,
        letters,
      };
    }
  }
}
