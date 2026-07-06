// Ilustratii SVG line-art partajate (materiale, sisteme de deschidere, boolean).
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

// --- Materiale ---

// PAL: placa in sectiune cu aschii/particule
export function IlluPal({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="18" y="30" width="84" height="30" rx="3" />
      <path d="M28 40l6 3M40 36l5 4M52 42l6-3M66 37l5 4M80 42l6-4M92 38l4 4" strokeWidth={2.5} />
      <path d="M18 52h84" strokeWidth={2} opacity={0.45} />
    </Svg>
  );
}

// MDF: placa neteda, miez dens (linii fine orizontale)
export function IlluMdf({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="18" y="30" width="84" height="30" rx="3" />
      <path d="M24 38h72M24 45h72M24 52h72" strokeWidth={1.75} opacity={0.55} />
    </Svg>
  );
}

// Lemn masiv: scandura cu fibra si nod
export function IlluLemnMasiv({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="18" y="28" width="84" height="34" rx="4" />
      <path d="M24 38c14-4 28 6 42 2s22-6 30-4" strokeWidth={2} opacity={0.6} />
      <path d="M24 52c16 4 30-6 44-2s20 5 28 3" strokeWidth={2} opacity={0.6} />
      <ellipse cx="46" cy="45" rx="5" ry="3.2" strokeWidth={2} />
    </Svg>
  );
}

// --- Sisteme de deschidere ---

// Push: usa care se deschide la apasare (sageata spre usa, fara maner)
export function IlluPush({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="44" y="16" width="42" height="58" rx="3" />
      <path d="M20 45h14m0 0l-6-6m6 6l-6 6" />
      <path d="M86 45c8 0 12-3 14-8" strokeWidth={2} opacity={0.55} />
    </Svg>
  );
}

// Glisante: doua usi suprapuse cu sageti orizontale
export function IlluGlisante({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="20" y="20" width="80" height="50" rx="3" />
      <rect x="20" y="20" width="44" height="50" rx="2" strokeWidth={2.25} />
      <path d="M40 80h40m0 0l-7-6m7 6l-7 6" transform="translate(0,-3)" strokeWidth={2.5} />
    </Svg>
  );
}

// Buton presiune: deget care apasa un buton mic (incuietoare cu arc)
export function IlluButonPresiune({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="30" y="26" width="60" height="44" rx="4" />
      <circle cx="60" cy="48" r="7" />
      <circle cx="60" cy="48" r="2.4" fill="currentColor" stroke="none" />
      <path d="M60 12v8M50 16l4 6M70 16l-4 6" strokeWidth={2.5} />
    </Svg>
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

export { Svg as IllustrationSvg, base as illustrationStrokeProps };
