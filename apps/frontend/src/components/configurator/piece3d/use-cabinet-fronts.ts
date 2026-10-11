'use client';

import { buildPanels, type Piece3dKind, type PieceConfig3d } from '@marketplace/shared';
import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';

type Zone = { col: number; zone: number };
type Step = { openZones: Set<string> };
type Transition = Step & { remaining: Step[]; pending: Map<string, boolean> };
const slideKey = (col: number) => `slide:${col}`;
const zoneKey = ({ col, zone }: Zone) => `${col}:${zone}`;

// Un sertar interior poate trece doar prin golul complet eliberat de canaturi.
export function slidingDrawerAccessible(kind: Piece3dKind, config: PieceConfig3d, openZones: ReadonlySet<string>, zone: Zone) {
  const panels = buildPanels(config, kind);
  const drawers = panels.filter((panel) => panel.role === 'DRAWER_FRONT' && panel.col === zone.col && panel.zone === zone.zone);
  return drawers.length > 0 && drawers.every((drawer) => panels.filter((panel) => panel.role === 'SLIDING_FRONT').every((leaf) => {
    const x = leaf.x + (leaf.col !== undefined && openZones.has(slideKey(leaf.col)) ? leaf.slideDx ?? 0 : 0);
    return x + leaf.w / 2 <= drawer.x - drawer.w / 2 - 0.001 || x - leaf.w / 2 >= drawer.x + drawer.w / 2 + 0.001;
  }));
}

export function planSlidingInteraction(kind: Piece3dKind, config: PieceConfig3d, current: ReadonlySet<string>, zone: Zone): Step[] {
  const clicked = config.columns[zone.col]?.zones[zone.zone];
  if (!clicked) return [];
  const door = slideKey(zone.col);
  let next = new Set(current);
  const steps: Step[] = [];
  const add = () => steps.push({ openZones: new Set(next) });
  const closeDrawers = () => {
    const drawers = [...next].filter((key) => !key.startsWith('slide:'));
    if (!drawers.length) return;
    drawers.forEach((key) => next.delete(key));
    add();
  };

  if (next.has(door) && clicked.type === 'DRAWERS') {
    const key = zoneKey(zone);
    if (next.has(key)) next.delete(key);
    else if (slidingDrawerAccessible(kind, config, current, zone)) next.add(key);
    else return [];
    add();
    return steps;
  }

  closeDrawers();
  // Un singur canat deplasat: celelalte nu traverseaza un sertar deschis si
  // canaturile de pe aceeasi sina nu se suprapun la deschiderea spre centru.
  const opening = !next.has(door);
  if ([...next].some((key) => key.startsWith('slide:'))) {
    next = new Set([...next].filter((key) => !key.startsWith('slide:')));
    add();
  }
  if (opening) {
    next.add(door);
    add();
  }
  return steps;
}

export function useCabinetFronts(kind: Piece3dKind, config: PieceConfig3d | null) {
  const [transition, setTransition] = useState<Transition>({ openZones: new Set(), pending: new Map(), remaining: [] });
  const current = useRef(transition);
  const commit = useCallback((next: Transition) => { current.current = next; setTransition(next); }, []);
  const setOpenZones = useCallback((value: SetStateAction<Set<string>>) => {
    commit({ openZones: typeof value === 'function' ? value(current.current.openZones) : value, pending: new Map(), remaining: [] });
  }, [commit]);
  const begin = useCallback((steps: Step[], openZones = current.current.openZones) => {
    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i];
      const pending = new Map<string, boolean>();
      for (const key of new Set([...openZones, ...step.openZones])) {
        if (openZones.has(key) !== step.openZones.has(key)) pending.set(key, step.openZones.has(key));
      }
      openZones = step.openZones;
      if (pending.size) {
        commit({ openZones, pending, remaining: steps.slice(i + 1) });
        return;
      }
    }
    commit({ openZones, pending: new Map(), remaining: [] });
  }, [commit]);
  const onFrontSettled = useCallback((key: string, open: boolean) => {
    const active = current.current;
    if (!active.pending.has(key) || active.pending.get(key) !== open) return;
    const pending = new Map(active.pending);
    pending.delete(key);
    if (pending.size) commit({ ...active, pending });
    else begin(active.remaining, active.openZones);
  }, [begin, commit]);
  const shape = JSON.stringify([kind, config?.doorMode, config?.widthM, config?.heightM, config?.depthM, config?.columns]);
  const previousShape = useRef(shape);

  useEffect(() => {
    if (previousShape.current === shape) return;
    previousShape.current = shape;
    // Grupurile se pot schimba/disparea la editare: nu asteptam confirmari vechi.
    if (current.current.remaining.length || current.current.pending.size) {
      commit({ ...current.current, remaining: [], pending: new Map() });
    }
  }, [shape, commit]);

  const toggleZone = (zone: Zone) => {
    if (!config) return;
    const clicked = config.columns[zone.col]?.zones[zone.zone];
    if (config.doorMode === 'SLIDING') {
      if (current.current.pending.size || current.current.remaining.length) return;
      const steps = planSlidingInteraction(kind, config, current.current.openZones, zone);
      if (steps.length) begin(steps);
    } else if (clicked && ['DOOR', 'DRAWERS', 'TILT_OUT'].includes(clicked.type)) {
      setOpenZones((previous) => {
        const next = new Set(previous);
        const key = zoneKey(zone);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    }
  };

  return { openZones: transition.openZones, setOpenZones, toggleZone, onFrontSettled };
}
