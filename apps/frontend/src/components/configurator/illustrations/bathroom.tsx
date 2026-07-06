// Ilustratii SVG pentru flow-ul de baie: piese de mobilier + ventilatie.
import { IllustrationSvg as Svg, type IllustrationProps } from './common';

export function IlluVanityUnit({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      {/* corp cu lavoar si baterie */}
      <rect x="30" y="42" width="60" height="30" rx="3" />
      <path d="M60 42v30" strokeWidth={2} />
      <path d="M40 54h8M72 54h8" strokeWidth={2.5} />
      <path d="M36 42c0-8 10-12 24-12s24 4 24 12" />
      <path d="M60 22v-6m0 0h8" strokeWidth={2.5} />
    </Svg>
  );
}

export function IlluMirrorCabinet({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="34" y="14" width="52" height="44" rx="3" />
      <path d="M60 14v44" strokeWidth={2} />
      <path d="M42 24l8 8M44 34l6 6" strokeWidth={1.75} opacity={0.6} />
      <rect x="34" y="66" width="52" height="6" rx="2" strokeWidth={2} />
    </Svg>
  );
}

export function IlluTallStorage({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="44" y="10" width="32" height="70" rx="3" />
      <path d="M44 36h32M44 58h32" strokeWidth={2} />
      <path d="M54 22h6M54 46h6M54 68h6" strokeWidth={2.5} />
    </Svg>
  );
}

// --- Ventilatie ---

export function IlluWindow({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="34" y="14" width="52" height="62" rx="3" />
      <path d="M34 45h52M60 14v62" strokeWidth={2} />
      <path d="M92 30c6 2 6 8 0 10m8-16c9 4 9 18 0 22" strokeWidth={2} opacity={0.6} />
    </Svg>
  );
}

export function IlluFan({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="28" y="18" width="64" height="54" rx="6" />
      <circle cx="60" cy="45" r="17" />
      <circle cx="60" cy="45" r="3" fill="currentColor" stroke="none" />
      <path d="M60 45c0-9 6-12 11-10M60 45c8 4 8 10 4 13M60 45c-8 3-12-1-12-7" strokeWidth={2.25} />
    </Svg>
  );
}

export function IlluNoVentilation({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="30" y="20" width="60" height="50" rx="4" />
      <path d="M40 36h18M40 45h24M40 54h14" strokeWidth={2} opacity={0.5} />
      <circle cx="82" cy="60" r="14" />
      <path d="M74 52l16 16" strokeWidth={3} />
    </Svg>
  );
}
