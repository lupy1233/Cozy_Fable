'use client';

import type { AnswerMap } from '@marketplace/shared';
import { useTranslations } from 'next-intl';

// Schita parametrica generica "laturi pe pereti" — izometrie in stilul
// schitei de bucatarie, pentru camerele care cer doar lungimi de laturi
// (A/B/C) + o inaltime (H): dressing (item 9.1) si debara (item 16).
// Literele corespund campurilor de sub schita; se redeseneaza live.

const S = 52;
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

// dimensiuni vizuale fixe (nu la scara)
const W = 3.4;
const D = 2.6;
const HC = 2.4;
const RUN = 0.6; // adancimea corpurilor desenate
const BODY_H = 2.1; // inaltimea corpurilor (dulap/rafturi)

function Box({ x, y, w, d, h }: { x: number; y: number; w: number; d: number; h: number }) {
  return (
    <g>
      <polygon points={pts([[x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h]])} className="fill-current" fillOpacity={0.22} />
      <polygon points={pts([[x + w, y, 0], [x + w, y + d, 0], [x + w, y + d, h], [x + w, y, h]])} className="fill-current" fillOpacity={0.1} />
      <polygon points={pts([[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, h], [x, y + d, h]])} className="fill-current" fillOpacity={0.14} />
      {[
        [[x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h]],
        [[x + w, y, 0], [x + w, y + d, 0], [x + w, y + d, h], [x + w, y, h]],
        [[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, h], [x, y + d, h]],
      ].map((face, i) => (
        <polygon
          key={i}
          points={pts(face as Array<[number, number, number]>)}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}

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
    <text x={u + dx} y={v + dy} textAnchor={anchor} className="fill-current font-mono" fontSize={11}>
      {children}
    </text>
  );
}

function fmt(v: number | undefined): string {
  return typeof v === 'number' && Number.isFinite(v) ? `${v} m` : '?';
}

export function WallRunsDiagram({
  answers,
  runs,
  heightSlotId,
}: {
  answers: AnswerMap;
  // cate laturi sunt cotate: 1 = A, 2 = A+B, 3 = A+B+C
  runs: number;
  // slotul de inaltime cotat cu H (ex. wardrobeHeight / ceilingHeight)
  heightSlotId: string;
}) {
  const t = useTranslations('Configurator');
  const dims =
    answers.dimensions && typeof answers.dimensions === 'object' && !Array.isArray(answers.dimensions)
      ? (answers.dimensions as Record<string, number>)
      : {};
  const showB = runs >= 2;
  const showC = runs >= 3;

  return (
    <figure className="rounded-xl border border-border-2 bg-surface-2 p-4">
      <svg viewBox="0 0 452 330" className="mx-auto w-full max-w-lg" aria-hidden="true">
        {/* camera: podea + doi pereti */}
        <g className="text-muted-2">
          <polygon points={pts([[0, 0, 0], [W, 0, 0], [W, D, 0], [0, D, 0]])} className="fill-current" fillOpacity={0.06} />
          <polygon points={pts([[0, 0, 0], [W, 0, 0], [W, 0, HC], [0, 0, HC]])} className="fill-current" fillOpacity={0.05} />
          <polygon points={pts([[0, 0, 0], [0, D, 0], [0, D, HC], [0, 0, HC]])} className="fill-current" fillOpacity={0.05} />
          <g fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round">
            <polygon points={pts([[0, 0, 0], [W, 0, 0], [W, D, 0], [0, D, 0]])} />
            <polyline points={pts([[0, D, HC], [0, 0, HC], [W, 0, HC]])} />
          </g>
        </g>

        {/* corpurile pe laturi */}
        <g className="text-walnut">
          <Box x={0} y={0} w={W} d={RUN} h={BODY_H} />
          {showB && <Box x={0} y={RUN} w={RUN} d={D - RUN} h={BODY_H} />}
          {showC && <Box x={W - RUN} y={RUN} w={RUN} d={D - RUN} h={BODY_H} />}

          <Tag at={[W / 2, 0, BODY_H + 0.35]} dy={-4}>
            A = {fmt(dims.runA)}
          </Tag>
          {showB && (
            <Tag at={[0, D, 0]} dx={-6} dy={14} anchor="end">
              B = {fmt(dims.runB)}
            </Tag>
          )}
          {showC && (
            <Tag at={[W - RUN / 2, RUN + (D - RUN) / 2, BODY_H]} dy={-4}>
              C = {fmt(dims.runC)}
            </Tag>
          )}
        </g>

        {/* etalonul de inaltime H — pe muchia din dreapta */}
        <g className="text-info">
          <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <line x1={iso(W + 0.18, 0, 0)[0]} y1={iso(W + 0.18, 0, 0)[1]} x2={iso(W + 0.18, 0, BODY_H)[0]} y2={iso(W + 0.18, 0, BODY_H)[1]} />
            <path d={`M${iso(W + 0.1, 0, 0).join(' ')} L${iso(W + 0.26, 0, 0).join(' ')}`} />
            <path d={`M${iso(W + 0.1, 0, BODY_H).join(' ')} L${iso(W + 0.26, 0, BODY_H).join(' ')}`} />
          </g>
          <Tag at={[W + 0.18, 0, BODY_H / 2]} dx={8} anchor="start">
            H = {fmt(dims[heightSlotId])}
          </Tag>
        </g>
      </svg>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
        {t('diagram.caption')}
      </figcaption>
    </figure>
  );
}
