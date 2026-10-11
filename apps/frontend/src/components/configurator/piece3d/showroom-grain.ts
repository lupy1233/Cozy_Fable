import type { Panel3d } from '@marketplace/shared';

// Faza apartine panoului, nu starii de deschidere sau culorii selectate.
export function boardGrainOffset(panel: Panel3d): [number, number, number] {
  let hash = 0;
  for (const letter of `${panel.role}:${panel.col ?? -1}:${panel.zone ?? -1}`) hash = (hash * 31 + letter.charCodeAt(0)) >>> 0;
  const phase = (hash % 997) / 37;
  return [phase + panel.x, phase * .73 + panel.y, phase * 1.31 + panel.z];
}
