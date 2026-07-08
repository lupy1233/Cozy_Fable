'use client';

import type { AnswerMap } from '@marketplace/shared';
import { useTranslations } from 'next-intl';

// Schita parametrica a bucatariei — axonometrie (schita 3D de atelier).
// Se redeseneaza live din raspunsuri: layout (A/B/C), insula (L/D), inaltime (H).
// Literele din schita corespund campurilor de dimensiuni de sub ea.
// Proportiile sunt fixe (nu la scara) — doar valorile etichetelor se schimba.

// proiectie izometrica: x → dreapta-jos, y (adancime) → stanga-jos, z → sus
const S = 52; // px per metru (vizual)
const COS = Math.cos(Math.PI / 6) * S;
const SIN = Math.sin(Math.PI / 6) * S;
const OX = 210;
const OY = 152;

function iso(x: number, y: number, z: number): [number, number] {
  return [OX + (x - y) * COS, OY + (x + y) * SIN - z * S];
}

function pts(coords: Array<[number, number, number]>): string {
  return coords.map(([x, y, z]) => iso(x, y, z).join(',')).join(' ');
}

// dimensiuni vizuale fixe ale camerei (metri "de desen")
const W = 3.4; // latime (axa x)
const D = 2.6; // adancime (axa y)
const HC = 2.4; // inaltimea peretilor din schita
const RUN = 0.6; // adancimea corpurilor de baza
const CH = 0.9; // inaltimea blatului

function fmt(v: number | undefined): string {
  return typeof v === 'number' && Number.isFinite(v) ? `${v} m` : '?';
}

// Cutie 3D: fetele vizibile in aceasta proiectie sunt top, dreapta (+x), fata (+y).
function Box({
  x,
  y,
  z = 0,
  w,
  d,
  h,
}: {
  x: number;
  y: number;
  z?: number;
  w: number;
  d: number;
  h: number;
}) {
  return (
    <g>
      <polygon
        points={pts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]])}
        className="fill-current"
        fillOpacity={0.22}
      />
      <polygon
        points={pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]])}
        className="fill-current"
        fillOpacity={0.1}
      />
      <polygon
        points={pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]])}
        className="fill-current"
        fillOpacity={0.14}
      />
      <polygon
        points={pts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]])}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <polygon
        points={pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]])}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <polygon
        points={pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]])}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </g>
  );
}

// Eticheta orizontala (billboard) ancorata la un punct din spatiul 3D.
function Tag({
  at,
  dx = 0,
  dy = 0,
  anchor = 'middle',
  children,
}: {
  at: [number, number, number];
  dx?: number;
  dy?: number;
  anchor?: 'start' | 'middle' | 'end';
  children: React.ReactNode;
}) {
  const [u, v] = iso(...at);
  return (
    <text
      x={u + dx}
      y={v + dy}
      textAnchor={anchor}
      className="fill-current font-mono"
      fontSize={11}
    >
      {children}
    </text>
  );
}

export function KitchenDimensionsDiagram({ answers }: { answers: AnswerMap }) {
  const t = useTranslations('Configurator');
  const layout = typeof answers.layout === 'string' ? answers.layout : 'STRAIGHT';
  const hasIsland = answers.hasIsland === true;
  const dims =
    answers.dimensions && typeof answers.dimensions === 'object' && !Array.isArray(answers.dimensions)
      ? (answers.dimensions as Record<string, number>)
      : {};

  const showB = layout === 'L_SHAPE' || layout === 'U_SHAPE' || layout === 'PARALLEL';
  const showC = layout === 'U_SHAPE';
  const parallel = layout === 'PARALLEL';

  return (
    <figure className="rounded-xl border border-border-2 bg-surface-2 p-4">
      <svg viewBox="0 0 452 330" className="mx-auto w-full max-w-lg" aria-hidden="true">
        {/* camera: podea + doi pereti (fundal usor, linii subtiri) */}
        <g className="text-muted-2">
          <polygon
            points={pts([[0, 0, 0], [W, 0, 0], [W, D, 0], [0, D, 0]])}
            className="fill-current"
            fillOpacity={0.06}
          />
          <polygon
            points={pts([[0, 0, 0], [W, 0, 0], [W, 0, HC], [0, 0, HC]])}
            className="fill-current"
            fillOpacity={0.05}
          />
          <polygon
            points={pts([[0, 0, 0], [0, D, 0], [0, D, HC], [0, 0, HC]])}
            className="fill-current"
            fillOpacity={0.05}
          />
          <g fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round">
            <polygon points={pts([[0, 0, 0], [W, 0, 0], [W, D, 0], [0, D, 0]])} />
            <polyline points={pts([[0, D, HC], [0, 0, HC], [W, 0, HC]])} />
            <line x1={iso(0, 0, 0)[0]} y1={iso(0, 0, 0)[1]} x2={iso(0, 0, HC)[0]} y2={iso(0, 0, HC)[1]} />
            <line x1={iso(W, 0, 0)[0]} y1={iso(W, 0, 0)[1]} x2={iso(W, 0, HC)[0]} y2={iso(W, 0, HC)[1]} />
            <line x1={iso(0, D, 0)[0]} y1={iso(0, D, 0)[1]} x2={iso(0, D, HC)[0]} y2={iso(0, D, HC)[1]} />
          </g>
        </g>

        {/* corpuri suspendate pe peretele din spate (decorativ) */}
        <g className="text-walnut" opacity={0.4}>
          <Box x={0.15} y={0} z={1.5} w={W - 0.3} d={0.35} h={0.7} />
        </g>

        {/* corpurile de baza — laturile cotate */}
        <g className="text-walnut">
          {/* latura A — peretele din spate */}
          <Box x={0} y={0} w={W} d={RUN} h={CH} />
          {parallel ? (
            // galley (doar v1): a doua latura pe peretele din fata
            <Box x={0} y={D - RUN} w={W} d={RUN} h={CH} />
          ) : (
            showB && <Box x={0} y={RUN} w={RUN} d={D - RUN} h={CH} />
          )}
          {showC && <Box x={W - RUN} y={RUN} w={RUN} d={D - RUN} h={CH} />}

          {/* etichete billboard, plasate in zone libere (deasupra / lateral) */}
          <Tag at={[W / 2, 0, 2.55]} dy={-4}>
            A = {fmt(dims.runA)}
          </Tag>
          {showB && !parallel && (
            <Tag at={[0, D, 0]} dx={-6} dy={14} anchor="end">
              B = {fmt(dims.runB)}
            </Tag>
          )}
          {parallel && (
            <Tag at={[W / 2, D, 0]} dy={18}>
              B = {fmt(dims.runB)}
            </Tag>
          )}
          {showC && (
            // pe fata superioara a laturii C, nu langa insula (se suprapuneau)
            <Tag at={[W - RUN / 2, RUN + (D - RUN) / 2, CH]} dy={-4}>
              C = {fmt(dims.runC)}
            </Tag>
          )}
        </g>

        {/* insula */}
        {hasIsland && (
          <g className="text-sage">
            <Box x={1.25} y={1.35} w={1.1} d={0.7} h={CH} />
            {/* etichetele insulei: litere scurte (L/D), ca A/B/C/H — literele
                corespund campurilor de sub schita */}
            <Tag at={[1.8, 2.05, 0]} dy={18}>
              {t('diagram.islandLength')} = {fmt(dims.islandLength)}
            </Tag>
            <Tag at={[1.8, 2.05, 0]} dy={32}>
              {t('diagram.islandDepth')} = {fmt(dims.islandDepth)}
            </Tag>
          </g>
        )}

        {/* etalonul de inaltime (H) — coltul din dreapta-spate */}
        <g className="text-info">
          <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <line
              x1={iso(W + 0.18, 0, 0)[0]}
              y1={iso(W + 0.18, 0, 0)[1]}
              x2={iso(W + 0.18, 0, HC)[0]}
              y2={iso(W + 0.18, 0, HC)[1]}
            />
            {/* capete de cota */}
            <path
              d={`M${iso(W + 0.1, 0, 0).join(' ')} L${iso(W + 0.26, 0, 0).join(' ')}`}
            />
            <path
              d={`M${iso(W + 0.1, 0, HC).join(' ')} L${iso(W + 0.26, 0, HC).join(' ')}`}
            />
          </g>
          <Tag at={[W + 0.18, 0, HC / 2]} dx={8} anchor="start">
            H = {fmt(dims.ceilingHeight)}
          </Tag>
        </g>
      </svg>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
        {t('diagram.caption')}
      </figcaption>
    </figure>
  );
}
