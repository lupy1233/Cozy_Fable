'use client';

import {
  buildPanels,
  OPENING_SPECS,
  type Piece3dKind,
  type PieceConfig3d,
  type StudioOpeningKind,
} from '@marketplace/shared';
import { useMemo } from 'react';
import { finishSpecFor, ROD_COLOR } from '../configurator/piece3d/finishes';

// Previzualizari 2D pentru Studio (feedback PO r4): NU iconite generice, ci
// ELEVATIA reala a piesei, desenata din acelasi model parametric ca scena 3D
// (buildPanels) si colorata in finisajul ei — limbajul de plansa de atelier
// al site-ului (line-art + accente de alama). Painter's algorithm pe z:
// spatele intai, fronturile ultimele; rosturile ies singure din FRONT_BACKDROP.

const INK = 'rgba(43, 32, 22, 0.35)';
const BACKDROP = '#262019';
const DOOR_LEAF = '#8a6544';
const GLASS = '#bcd3dc';
const FRAME = '#efe9df';

const FRONT_ROLES = new Set(['DRAWER_FRONT', 'DOOR_FRONT', 'TILT_FRONT', 'SLIDING_FRONT']);

export function PiecePreview({
  kind,
  config,
  className,
}: {
  kind: Piece3dKind;
  config: PieceConfig3d;
  className?: string;
}) {
  const panels = useMemo(
    () => [...buildPanels(config, kind)].sort((a, b) => a.z - b.z),
    [config, kind],
  );
  const spec = useMemo(
    () => finishSpecFor(config.finish, config.customColor),
    [config.finish, config.customColor],
  );
  const W = config.widthM;
  const H = config.heightM;
  const pad = Math.max(W, H) * 0.04;

  return (
    <svg
      viewBox={`${-W / 2 - pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`}
      className={className}
      role="img"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* y-ul modelului creste in sus; SVG-ul in jos — oglindim vertical */}
      <g transform={`translate(0 ${H}) scale(1 -1)`}>
        {panels.map((p, i) => {
          if (p.role === 'ROD') {
            return (
              <rect
                key={i}
                x={p.x - p.w / 2}
                y={p.y - 0.012}
                width={p.w}
                height={0.024}
                fill={ROD_COLOR}
              />
            );
          }
          const front = FRONT_ROLES.has(p.role);
          const backdrop = p.role === 'FRONT_BACKDROP';
          return (
            <rect
              key={i}
              x={p.x - p.w / 2}
              y={p.y - p.h / 2}
              width={p.w}
              height={p.h}
              fill={backdrop ? BACKDROP : front ? spec.front : spec.body}
              stroke={backdrop ? 'none' : INK}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </g>
    </svg>
  );
}

// Elevatia unei variante de gol (usa/fereastra/priza) la proportiile reale
// din OPENING_SPECS — aceeasi plansa, alta foaie.
export function OpeningPreview({
  kind,
  className,
}: {
  kind: StudioOpeningKind;
  className?: string;
}) {
  const { w, h, sill } = OPENING_SPECS[kind];
  const total = kind === 'OUTLET' ? h * 3 : sill + h;
  const pad = Math.max(w, total) * 0.08;
  const stroke = { stroke: INK, strokeWidth: 1, vectorEffect: 'non-scaling-stroke' } as const;

  if (kind === 'OUTLET') {
    // placa prizei, marita relativ (altfel ar fi un punct)
    return (
      <svg
        viewBox={`${-w / 2 - pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`}
        className={className}
        role="img"
        aria-hidden="true"
      >
        <rect x={-w / 2} y={0} width={w} height={h} rx={0.012} fill={FRAME} {...stroke} />
        <circle cx={-w / 4} cy={h / 2} r={h * 0.26} fill="#c9c2b4" {...stroke} />
        <circle cx={w / 4} cy={h / 2} r={h * 0.26} fill="#c9c2b4" {...stroke} />
      </svg>
    );
  }

  const isDoor = kind === 'DOOR' || kind === 'DOOR_DOUBLE';
  const bar = 0.06;
  return (
    <svg
      viewBox={`${-w / 2 - bar - pad} ${-pad} ${w + 2 * (bar + pad)} ${total + bar + 2 * pad}`}
      className={className}
      role="img"
      aria-hidden="true"
    >
      {/* y in sus → oglindit, ca la piese */}
      <g transform={`translate(0 ${total + bar}) scale(1 -1)`}>
        {/* tocul */}
        <rect
          x={-w / 2 - bar}
          y={isDoor ? 0 : sill - bar}
          width={w + 2 * bar}
          height={h + bar + (isDoor ? 0 : bar)}
          fill={FRAME}
          {...stroke}
        />
        {isDoor ? (
          <>
            {(kind === 'DOOR_DOUBLE' ? [-1, 1] : [0]).map((side) => {
              const leafW = kind === 'DOOR_DOUBLE' ? w / 2 - 0.02 : w - 0.03;
              const lx = kind === 'DOOR_DOUBLE' ? (side * (leafW + 0.02)) / 2 : 0;
              return (
                <rect
                  key={side}
                  x={lx - leafW / 2}
                  y={0.01}
                  width={leafW}
                  height={h - 0.03}
                  fill={DOOR_LEAF}
                  {...stroke}
                />
              );
            })}
            {/* clanta de alama */}
            <circle
              cx={kind === 'DOOR_DOUBLE' ? -0.08 : w / 2 - 0.12}
              cy={h / 2}
              r={0.035}
              fill={ROD_COLOR}
            />
          </>
        ) : (
          <>
            <rect
              x={-w / 2 + 0.02}
              y={sill + 0.02}
              width={w - 0.04}
              height={h - 0.04}
              fill={GLASS}
              fillOpacity={0.55}
              {...stroke}
            />
            {kind === 'WINDOW_WIDE' && (
              <rect x={-0.02} y={sill + 0.02} width={0.04} height={h - 0.04} fill={FRAME} {...stroke} />
            )}
          </>
        )}
      </g>
    </svg>
  );
}
