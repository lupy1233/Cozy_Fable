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

// --- Etapa 6: valori speciale din seturile noi (desene in cod, fara imagini noi) ---

// "Nu stiu — vreau recomandarea firmei": cartonas cu semn de intrebare + cheie de montaj
export function IlluFirmDecides({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="22" y="14" width="50" height="62" rx="6" />
      <path d="M38 36a9 9 0 1 1 13 8c-3 1.6-4 3.4-4 6.5" strokeWidth={4} />
      <circle cx="47" cy="60" r="1.6" fill="currentColor" />
      <path d="M80 70l16-16" strokeWidth={5} />
      <path d="M93 57a9 9 0 1 0 6-14l-5 5-4-1-1-4 5-5a9 9 0 0 0-14 6" />
    </Svg>
  );
}

// "Fara usi sau sertare": corp deschis, doar polite
export function IlluNoFronts({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="30" y="12" width="60" height="66" rx="2" />
      <path d="M30 34h60M30 56h60" />
      <path d="M38 30v-10M44 30v-10M50 30v-10M64 52h14M40 74v-12h10v12" strokeWidth={2} />
      <path d="M34 78v4M86 78v4" />
    </Svg>
  );
}

// Oglinda fara rama: suprafata cu reflexii, colturi rotunjite
export function IlluMirrorFrameless({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="38" y="10" width="44" height="70" rx="8" strokeWidth={2} />
      <path d="M50 30l12-12M50 44l22-22M60 50l14-14" strokeWidth={2} />
    </Svg>
  );
}

// Oglinda cu rama metalica: rama subtire dubla + suruburi in colturi
export function IlluMirrorMetal({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="34" y="8" width="52" height="74" rx="2" />
      <rect x="39" y="13" width="42" height="64" rx="1" strokeWidth={1.5} />
      <path d="M50 32l12-12M50 46l22-22M60 52l14-14" strokeWidth={2} />
      <circle cx="36.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="83.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="36.5" cy="79.5" r="1" fill="currentColor" />
      <circle cx="83.5" cy="79.5" r="1" fill="currentColor" />
    </Svg>
  );
}

// --- Etapa 10: cine aduce lavoarul (baie v4) ---

// "Il aduc eu": cutie + persoana
export function IlluSupplyClient({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <circle cx="38" cy="22" r="8" />
      <path d="M24 76V50a14 14 0 0 1 28 0v26" />
      <path d="M50 52l12 6" strokeWidth={2.5} />
      <rect x="62" y="44" width="34" height="30" rx="2" />
      <path d="M62 54h34M79 44v10" strokeWidth={2} />
    </Svg>
  );
}

// "Sa-l aduca firma": cutie in camionul de livrare
export function IlluSupplyFirm({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M14 64V28h54v36" />
      <path d="M68 40h18l14 14v10H68" />
      <path d="M76 40v14h24" strokeWidth={2} />
      <circle cx="32" cy="68" r="7" />
      <circle cx="86" cy="68" r="7" />
      <rect x="28" y="36" width="24" height="20" rx="1.5" strokeWidth={2} />
      <path d="M28 44h24M40 36v8" strokeWidth={1.5} />
    </Svg>
  );
}

export { Svg as IllustrationSvg };
