// Ilustratii pentru materialele noi (variante MDF, "Altul") si sistemele de
// deschidere ramase fara desen (maner, Gola, Aventos) + blatul HPL (item 2).
// Acelasi limbaj ca common.tsx: viewBox 120x90, currentColor, stroke rotunjit.
import { IllustrationSvg as Svg, type IllustrationProps } from './common';

// --- Materiale (variante MDF + "Altul") ---

// MDF infoliat: placa cu folia PVC ridicata la colt (strat care imbraca placa)
export function IlluMdfInfoliat({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="18" y="34" width="84" height="28" rx="3" />
      {/* folia: linie paralela cu fata, dezlipita la coltul din dreapta-sus */}
      <path d="M22 28h64c8 0 12 2 16 6" strokeWidth={2.5} />
      <path d="M86 28c6-6 12-8 16-8" strokeWidth={2.5} opacity={0.7} />
      <path d="M26 44h68M26 52h68" strokeWidth={1.75} opacity={0.5} />
    </Svg>
  );
}

// MDF vopsit: placa + pensula care lasa o dara de vopsea
export function IlluMdfVopsit({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="18" y="40" width="84" height="26" rx="3" />
      <path d="M26 53h44" strokeWidth={5} opacity={0.4} />
      {/* pensula inclinata deasupra placii */}
      <path d="M78 46l18-18" strokeWidth={3} />
      <path d="M72 52l8-8 6 6-8 8z" strokeWidth={2.5} />
    </Svg>
  );
}

// MDF furnir: placa cu strat subtire de lemn (fibra) aplicat deasupra
export function IlluMdfFurnir({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="18" y="42" width="84" height="24" rx="3" />
      <path d="M24 50h72M24 58h72" strokeWidth={1.5} opacity={0.45} />
      {/* foaia de furnir, usor ridicata deasupra placii */}
      <path d="M28 32h56l8 6" strokeWidth={2.5} />
      <path d="M34 28c10-3 20 2 30-1s16-2 22 0" strokeWidth={2} opacity={0.6} />
    </Svg>
  );
}

// Altul: eticheta cu creion — clientul isi descrie materialul
export function IlluAltMaterial({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="20" y="30" width="62" height="34" rx="4" />
      <path d="M28 41h30M28 50h22" strokeWidth={2.25} opacity={0.6} />
      {/* creionul care scrie */}
      <path d="M86 66l14-14-8-8-14 14-2 10z" strokeWidth={2.5} />
      <path d="M92 48l8 8" strokeWidth={2} opacity={0.6} />
    </Svg>
  );
}

// --- Sisteme de deschidere ---

// Maner clasic: front cu maner-bara si mana care il apuca (simplificat: bara + degete)
export function IlluManer({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="40" y="16" width="44" height="58" rx="3" />
      {/* manerul bara, montat vertical langa muchie */}
      <path d="M50 34v22" strokeWidth={4.5} />
      <path d="M50 34h-6M50 56h-6" strokeWidth={2.5} />
      {/* sageata de tragere */}
      <path d="M24 45h10m0 0l-5-5m5 5l-5 5" strokeWidth={2.5} />
    </Svg>
  );
}

// Gola: profil frezat orizontal sub blat — mana intra in sant (fara maner aparent)
export function IlluGola({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      {/* blatul */}
      <path d="M16 22h88" strokeWidth={4} />
      {/* santul Gola: profil curbat sub blat */}
      <path d="M20 30c10 0 14 8 24 8h32c10 0 14-8 24-8" strokeWidth={2.5} />
      {/* frontul de sub profil */}
      <rect x="24" y="38" width="72" height="34" rx="3" />
      {/* mana care intra in sant (doua degete stilizate) */}
      <path d="M56 20v10M64 20v10" strokeWidth={2.5} opacity={0.65} />
    </Svg>
  );
}

// Aventos: front suspendat care se ridica in sus, cu bratul mecanismului
export function IlluAventos({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      {/* corpul suspendat */}
      <rect x="26" y="34" width="68" height="34" rx="3" />
      {/* frontul ridicat, inclinat deasupra corpului */}
      <path d="M30 32l18-16h50" strokeWidth={2.75} />
      {/* bratul mecanismului */}
      <path d="M36 44l12-22" strokeWidth={2.25} opacity={0.7} />
      {/* sageata sus */}
      <path d="M106 40V22m0 0l-5 6m5-6l5 6" strokeWidth={2.5} />
    </Svg>
  );
}

// --- Blat HPL (bucatarie v2) ---

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
