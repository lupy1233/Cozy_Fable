'use client';

import { buildDoorHingeDetails, buildFrontHandle, type Panel3d } from '@marketplace/shared';
import { useMemo } from 'react';
import type { FinishSpec } from './finishes';
import { ShowroomBatches } from './showroom-batches';

export function FrontDetails({ front, spec, withHandles, recessed = false, offset = [0, 0, 0] }: {
  front: Panel3d; spec: FinishSpec; withHandles: boolean; recessed?: boolean; offset?: [number, number, number];
}) {
  const panels = useMemo(() => [...buildDoorHingeDetails(front), ...(withHandles ? buildFrontHandle(front, recessed) : [])],
    [front, withHandles, recessed]);
  return <group position={offset}><ShowroomBatches panels={panels} spec={spec} /></group>;
}
