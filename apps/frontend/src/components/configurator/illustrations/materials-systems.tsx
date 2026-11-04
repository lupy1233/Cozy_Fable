// Ilustratie pentru blatul HPL (item 2) — singura line-art ramasa din setul
// materiale/sisteme; restul au fost inlocuite de redarile foto 3D (Photo*,
// 2026-07-31) si sterse la curatenia L2 (pasul 7 audit #2, 2026-08-23).
// Acelasi limbaj ca common.tsx: viewBox 120x90, currentColor, stroke rotunjit.
import { IllustrationSvg as Svg, type IllustrationProps } from './common';

// HPL: blat in sectiune cu strat laminat de inalta presiune (straturi dense)
export function IlluCountertopHpl({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="16" y="34" width="88" height="20" rx="2.5" />
      {/* straturile presate: linii dese pe cant */}
      <path d="M16 40h88M16 46h88" strokeWidth={1.75} opacity={0.55} />
      {/* fata lucioasa: reflexie */}
      <path d="M28 30l10-8M44 30l10-8" strokeWidth={2} opacity={0.5} />
      {/* corpul de sub blat, doar sugerat */}
      <path d="M28 54v16M92 54v16" strokeWidth={2} opacity={0.4} />
    </Svg>
  );
}
