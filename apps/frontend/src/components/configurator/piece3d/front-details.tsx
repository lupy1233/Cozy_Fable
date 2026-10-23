'use client';

import { buildDoorHingeDetails, buildFrontHandle, type Panel3d, type Piece3dHandleStyle } from '@marketplace/shared';
import { useMemo } from 'react';
import type { FinishSpec } from './finishes';
import { HardwareBatches } from './hardware-instances';

// Balamalele si manerul unui front: modele GLB instantiate cand sunt
// incarcate, altfel (sau pentru fronturi prea mici) primitivele din shared.
export function FrontDetails({ front, spec, withHandles, recessed = false, offset = [0, 0, 0], handleStyle = 'BAR' }: {
  front: Panel3d; spec: FinishSpec; withHandles: boolean; recessed?: boolean; offset?: [number, number, number];
  handleStyle?: Piece3dHandleStyle;
}) {
  const panels = useMemo(() => [...buildDoorHingeDetails(front), ...(withHandles ? buildFrontHandle(front, recessed, handleStyle) : [])],
    [front, withHandles, recessed, handleStyle]);
  return <group position={offset}><HardwareBatches panels={panels} spec={spec} /></group>;
}
