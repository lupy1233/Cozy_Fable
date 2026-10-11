// Timp absolut: pauza din frameloop="demand" nu accelereaza urmatoarea miscare.
export const OPEN_DURATION_MS = {
  door: 520, tilt: 420, drawer: 400, sliding: 620, bedDrawer: 480, lift: 750,
} as const;

export interface OpenTween {
  from: number;
  to: number;
  startedAt: number;
  duration: number;
}

export const createOpenTween = (open = false): OpenTween => ({ from: Number(open), to: Number(open), startedAt: 0, duration: 0 });

export function sampleOpenTween(tween: OpenTween, now: number): number {
  if (tween.duration <= 0) return tween.to;
  const elapsed = Math.min(1, Math.max(0, (now - tween.startedAt) / tween.duration));
  const eased = elapsed * elapsed * (3 - 2 * elapsed);
  return tween.from + (tween.to - tween.from) * eased;
}

export function retargetOpenTween(tween: OpenTween, open: boolean, now: number, duration: number, reducedMotion = false): OpenTween {
  const from = sampleOpenTween(tween, now);
  const to = Number(open);
  return { from, to, startedAt: now, duration: reducedMotion ? 0 : Math.max(0, duration) * Math.abs(to - from) };
}
