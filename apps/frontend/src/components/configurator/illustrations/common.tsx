// Ilustratii SVG line-art partajate (boolean + baza Svg). Ilustratiile de materiale/
// sisteme au fost inlocuite de redarile foto 3D si sterse la curatenia L2 (2026-08-23).
// Toate deseneaza cu currentColor; culoarea/tona vine din wrapperul cardului.
// ViewBox standard 120x90, stroke rotunjit — stil unitar "schita de atelier".

export type IllustrationProps = { className?: string };

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Svg({ className, children }: IllustrationProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 120 90" className={className} aria-hidden="true" {...base}>
      {children}
    </svg>
  );
}

// --- Boolean (da/nu) ---

export function IlluYes({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <circle cx="60" cy="45" r="26" />
      <path d="M48 46l8 8 16-18" strokeWidth={4} />
    </Svg>
  );
}

export function IlluNo({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <circle cx="60" cy="45" r="26" />
      <path d="M50 35l20 20M70 35l-20 20" strokeWidth={4} />
    </Svg>
  );
}

export { Svg as IllustrationSvg };
