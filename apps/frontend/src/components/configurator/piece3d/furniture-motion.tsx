'use client';

import type { Panel3d } from '@marketplace/shared';
import { useRef } from 'react';
import type { Group } from 'three';
import type { FinishSpec } from './finishes';
import { ShowroomBatches } from './showroom-batches';
import { OPEN_DURATION_MS } from './open-tween';
import { useOpenTween } from './use-open-tween';

// Piesele unui mecanism raman impreuna; coordonatele salvate nu sunt modificate.
export function FurnitureMotion({ panels, open, spec, onToggle }: {
  panels: Panel3d[]; open: boolean; spec: FinishSpec; onToggle?: () => void;
}) {
  const group = useRef<Group>(null);
  const motion = panels[0].motion!;
  const pivot = motion.pivot ?? [0, 0, 0];
  const travel = motion.travel ?? [0, 0, 0];
  const duration = motion.key.startsWith('slide:') ? OPEN_DURATION_MS.sliding
    : motion.type === 'ROTATE_X' ? OPEN_DURATION_MS.lift : OPEN_DURATION_MS.bedDrawer;
  useOpenTween(open, duration, (progress) => {
    if (!group.current) return;
    group.current.position.set(pivot[0] + travel[0] * progress, pivot[1] + travel[1] * progress, pivot[2] + travel[2] * progress);
    group.current.rotation.x = motion.type === 'ROTATE_X' ? (motion.angle ?? 0) * progress : 0;
    group.current.rotation.y = motion.type === 'ROTATE_Y' ? (motion.angle ?? 0) * progress : 0;
    group.current.userData.openProgress = progress;
  });
  return <group ref={group} name={`furniture-motion:${motion.key}`}
    onClick={onToggle ? (event) => { event.stopPropagation(); if (event.delta <= 3) onToggle(); } : undefined}>
    <group position={[-pivot[0], -pivot[1], -pivot[2]]}>
      <ShowroomBatches panels={panels} spec={spec} />
    </group>
  </group>;
}
