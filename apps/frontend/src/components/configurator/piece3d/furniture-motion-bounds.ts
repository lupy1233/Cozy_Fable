import type { Panel3d, PieceConfig3d } from '@marketplace/shared';

// Incadrarea include mecanismul deschis de la prima randare, fara salt de camera la click.
export function furnitureMotionBounds(config: PieceConfig3d, panels: Panel3d[]) {
  let width = config.widthM, height = config.heightM, depth = config.depthM;
  for (const panel of panels) {
    const motion = panel.motion;
    if (!motion || motion.key.startsWith('slide:')) continue;
    const pivot = motion.pivot ?? [0, 0, 0];
    for (let step = 0; step <= 12; step++) for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const t = step / 12, angle = (motion.angle ?? 0) * t, c = Math.cos(angle), s = Math.sin(angle);
      const x = panel.x + sx * panel.w / 2 - pivot[0], y = panel.y + sy * panel.h / 2 - pivot[1], z = panel.z + sz * panel.d / 2 - pivot[2];
      const rx = motion.type === 'ROTATE_Y' ? x * c + z * s : x;
      const ry = motion.type === 'ROTATE_X' ? y * c - z * s : y;
      const rz = motion.type === 'ROTATE_X' ? y * s + z * c : motion.type === 'ROTATE_Y' ? -x * s + z * c : z;
      width = Math.max(width, 2 * Math.abs(rx + pivot[0] + (motion.travel?.[0] ?? 0) * t));
      height = Math.max(height, ry + pivot[1] + (motion.travel?.[1] ?? 0) * t);
      depth = Math.max(depth, 2 * Math.abs(rz + pivot[2] + (motion.travel?.[2] ?? 0) * t));
    }
  }
  return { width, height, depth };
}
