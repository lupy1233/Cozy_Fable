// Ilustratii pentru configuratiile pieselor ghidate (PIECE_*, item 2):
// usi dulap, pana in tavan, stiluri biblioteca/comoda TV/pantofar/noptiera/
// bancuta, mese, birou. Acelasi limbaj: viewBox 120x90, currentColor.
import { IllustrationSvg as Svg, type IllustrationProps } from './common';

// --- Dulap: tip usi ---

// Usi glisante: dulap cu usile suprapuse + sageti
export function IlluWardrobeSliding({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="26" y="12" width="68" height="60" rx="3" />
      <rect x="26" y="12" width="38" height="60" rx="2" strokeWidth={2.25} />
      <path d="M42 82h36m0 0l-6-5m6 5l-6 5M42 82l6-5m-6 5l6 5" strokeWidth={2.25} />
    </Svg>
  );
}

// Usi batante: dulap cu o usa deschisa (arc)
export function IlluWardrobeHinged({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="30" y="12" width="60" height="60" rx="3" />
      <path d="M60 12v60" strokeWidth={2.25} />
      {/* usa dreapta deschisa spre privitor */}
      <path d="M90 12l20 12v58l-20-10" strokeWidth={2.5} />
      <path d="M104 46v8" strokeWidth={2.75} />
      <path d="M53 38v10" strokeWidth={2.75} />
    </Svg>
  );
}

// Pana in tavan: dulap care atinge linia tavanului
export function IlluToCeiling({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M14 12h92" strokeWidth={3} />
      <path d="M20 12v6M40 12v6M60 12v6M80 12v6M100 12v6" strokeWidth={1.75} opacity={0.5} />
      <rect x="36" y="12" width="48" height="66" rx="2" />
      <path d="M60 12v66" strokeWidth={2.25} />
      <path d="M53 42v10M67 42v10" strokeWidth={2.75} />
    </Svg>
  );
}

// --- Comoda TV (piesa): stil + asezare TV ---

// Comoda joasa simpla
export function IlluTvLowUnit({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="18" y="44" width="84" height="24" rx="3" />
      <path d="M46 44v24M74 44v24" strokeWidth={2.25} opacity={0.7} />
      <path d="M28 54h8M88 54h8" strokeWidth={2.5} />
      <path d="M26 68l-3 8M94 68l3 8" strokeWidth={2.25} />
    </Svg>
  );
}

// Perete media: compozitie completa in jurul TV-ului
export function IlluTvMediaWall({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="16" y="10" width="88" height="68" rx="3" />
      <rect x="40" y="24" width="40" height="24" rx="2" strokeWidth={2.5} />
      <path d="M16 62h88" strokeWidth={2.25} />
      <path d="M40 10v52M80 10v52" strokeWidth={2.25} opacity={0.6} />
    </Svg>
  );
}

// TV pe perete (deasupra comodei)
export function IlluTvOnWall({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="38" y="14" width="44" height="26" rx="2" />
      <path d="M60 40v-4" strokeWidth={0} opacity={0} />
      <path d="M52 46h16" strokeWidth={2} opacity={0.4} />
      <rect x="22" y="56" width="76" height="18" rx="3" />
    </Svg>
  );
}

// TV asezat pe comoda (cu picior)
export function IlluTvOnUnit({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="38" y="18" width="44" height="26" rx="2" />
      <path d="M60 44v6M50 50h20" strokeWidth={2.5} />
      <rect x="22" y="50" width="76" height="20" rx="3" />
    </Svg>
  );
}

// Nu m-am hotarat: TV cu semn de intrebare
export function IlluTvUndecided({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="34" y="20" width="52" height="34" rx="2" strokeDasharray="7 6" />
      <path d="M54 34c0-5 4-7 7-7 4 0 7 3 7 6 0 4-4 5-6 7v3" strokeWidth={2.75} />
      <circle cx="62" cy="49" r="1.6" fill="currentColor" stroke="none" />
      <rect x="24" y="62" width="72" height="14" rx="3" />
    </Svg>
  );
}

// --- Biblioteca (piesa): stil ---

// Rafturi deschise
export function IlluBookcaseOpen({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M32 14v62M88 14v62" strokeWidth={2.75} />
      <path d="M32 14h56M32 34h56M32 55h56M32 76h56" strokeWidth={2.5} />
      <path d="M42 34v-11M50 34v-11M58 34l5-10" strokeWidth={2} opacity={0.7} />
      <path d="M64 55v-12M72 55v-12" strokeWidth={2} opacity={0.7} />
    </Svg>
  );
}

// Cu dulapuri jos
export function IlluBookcaseBase({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M32 12v64M88 12v64" strokeWidth={2.75} />
      <path d="M32 12h56M32 30h56M32 48h56" strokeWidth={2.5} />
      <path d="M42 30v-10M50 30v-10" strokeWidth={2} opacity={0.7} />
      <rect x="32" y="48" width="56" height="28" />
      <path d="M60 48v28" strokeWidth={2.25} />
      <path d="M53 60h4M67 60h-4" strokeWidth={2.5} />
    </Svg>
  );
}

// Cu usi de sticla
export function IlluBookcaseGlass({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="32" y="12" width="56" height="64" rx="3" />
      <path d="M60 12v64" strokeWidth={2.25} />
      <path d="M38 40l14-20M42 56l18-26M68 40l14-20M72 56l14-20" strokeWidth={1.75} opacity={0.5} />
      <path d="M54 42h4M66 42h-4" strokeWidth={2.5} />
    </Svg>
  );
}

// --- Birou (piesa): depozitare ---

// Corp cu sertare (rollbox)
export function IlluDrawerUnit({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M20 30h80" strokeWidth={3} />
      <path d="M26 30v42" strokeWidth={2.5} />
      <rect x="58" y="38" width="34" height="34" rx="3" />
      <path d="M58 49h34M58 60h34" strokeWidth={2} opacity={0.7} />
      <path d="M71 44h8M71 55h8M71 66h8" strokeWidth={2.25} />
      <circle cx="98" cy="76" r="3" strokeWidth={2} opacity={0.6} />
    </Svg>
  );
}

// Etajera deasupra biroului
export function IlluShelfAbove({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M28 22h64" strokeWidth={3.25} />
      <path d="M38 22v-8M48 22v-8" strokeWidth={2} opacity={0.7} />
      <path d="M20 52h80" strokeWidth={3} />
      <path d="M26 52v20M94 52v20" strokeWidth={2.5} />
      <rect x="46" y="34" width="20" height="12" rx="2" strokeWidth={2} opacity={0.6} />
    </Svg>
  );
}

// --- Masa (piesa): tip + forma ---

// Masa dining (cu farfurii)
export function IlluTableDining({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M18 40h84" strokeWidth={3.5} />
      <path d="M26 40v30M94 40v30" strokeWidth={2.75} />
      <circle cx="48" cy="32" r="6" strokeWidth={2.25} opacity={0.75} />
      <circle cx="74" cy="32" r="6" strokeWidth={2.25} opacity={0.75} />
    </Svg>
  );
}

// Consola (masa ingusta de perete, picioare inalte)
export function IlluTableConsole({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M26 34h68" strokeWidth={3.25} />
      <path d="M32 34v38M88 34v38" strokeWidth={2.5} />
      <path d="M32 52h56" strokeWidth={2} opacity={0.5} />
      <path d="M52 28v-6h16v6" strokeWidth={2} opacity={0.6} />
    </Svg>
  );
}

// Forma dreptunghiulara (vedere de sus)
export function IlluTableRect({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="26" y="26" width="68" height="38" rx="4" />
      <circle cx="42" cy="16" r="5" strokeWidth={2} opacity={0.7} />
      <circle cx="78" cy="16" r="5" strokeWidth={2} opacity={0.7} />
      <circle cx="42" cy="74" r="5" strokeWidth={2} opacity={0.7} />
      <circle cx="78" cy="74" r="5" strokeWidth={2} opacity={0.7} />
    </Svg>
  );
}

// Forma rotunda (vedere de sus)
export function IlluTableRound({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <circle cx="60" cy="45" r="24" />
      <circle cx="60" cy="12" r="5" strokeWidth={2} opacity={0.7} />
      <circle cx="60" cy="78" r="5" strokeWidth={2} opacity={0.7} />
      <circle cx="27" cy="45" r="5" strokeWidth={2} opacity={0.7} />
      <circle cx="93" cy="45" r="5" strokeWidth={2} opacity={0.7} />
    </Svg>
  );
}

// Extensibila: blat cu sectiune care iese (sageti)
export function IlluTableExtendable({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="20" y="30" width="52" height="32" rx="3" />
      <rect x="72" y="34" width="24" height="24" rx="2" strokeDasharray="6 5" strokeWidth={2.25} />
      <path d="M100 46h8m0 0l-5-5m5 5l-5 5" strokeWidth={2.25} />
    </Svg>
  );
}

// --- Pantofar (piesa): stil ---

// Slim cu fronturi rabatabile
export function IlluShoeSlim({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="42" y="12" width="36" height="64" rx="3" />
      <path d="M42 33h36M42 54h36" strokeWidth={2.25} />
      <path d="M55 22l5 5 5-5M55 43l5 5 5-5M55 64l5 5 5-5" strokeWidth={2} opacity={0.7} />
    </Svg>
  );
}

// Standard cu rafturi
export function IlluShoeStandard({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="30" y="20" width="60" height="56" rx="3" />
      <path d="M30 39h60M30 58h60" strokeWidth={2.25} />
      <path d="M40 33c0-3 3-5 6-4 2 1 3 2 6 2h7c0 2-2 3-6 3z" strokeWidth={1.9} opacity={0.75} />
      <path d="M62 52c0-3 3-5 6-4 2 1 3 2 6 2h7c0 2-2 3-6 3z" strokeWidth={1.9} opacity={0.75} />
    </Svg>
  );
}

// Cu bancuta (sezut deasupra)
export function IlluShoeWithSeat({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="26" y="40" width="68" height="34" rx="3" />
      <path d="M26 57h68" strokeWidth={2.25} />
      <path d="M22 34h76" strokeWidth={4} />
      <path d="M30 34v-6c0-2 2-4 5-4h50c3 0 5 2 5 4v6" strokeWidth={2.25} opacity={0.7} />
    </Svg>
  );
}

// --- Noptiera (piesa): stil ---

export function IlluNightstandDrawers({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="36" y="26" width="48" height="44" rx="3" />
      <path d="M36 48h48" strokeWidth={2.25} />
      <path d="M54 37h12M54 59h12" strokeWidth={2.75} />
      <path d="M36 70v6M84 70v6" strokeWidth={2.25} />
    </Svg>
  );
}

export function IlluNightstandOpenShelf({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="36" y="26" width="48" height="44" rx="3" />
      <path d="M36 44h48" strokeWidth={2.25} />
      <path d="M54 33h12" strokeWidth={2.75} />
      <path d="M46 62h16v-10" strokeWidth={2.25} opacity={0.7} />
    </Svg>
  );
}

export function IlluNightstandSuspended({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="36" y="24" width="48" height="30" rx="3" />
      <path d="M54 36h12" strokeWidth={2.75} />
      <path d="M44 64h32" strokeWidth={2} opacity={0.35} />
    </Svg>
  );
}

// --- Bancuta (piesa): stil ---

// Cu lada de depozitare (capac ridicat)
export function IlluBenchStorage({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="24" y="42" width="72" height="26" rx="3" />
      <path d="M24 42l64-16h10" strokeWidth={2.5} />
      <path d="M100 34V22m0 0l-5 5m5-5l5 5" strokeWidth={2.25} />
    </Svg>
  );
}

// Cu spatiu pentru pantofi (raft sub sezut)
export function IlluBenchShoes({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M22 40h76" strokeWidth={4} />
      <path d="M28 40v30M92 40v30" strokeWidth={2.5} />
      <path d="M28 58h64" strokeWidth={2.5} />
      <path d="M44 54c0-3 3-5 6-4 2 1 3 2 6 2h7c0 2-2 3-6 3z" strokeWidth={1.9} opacity={0.75} />
    </Svg>
  );
}

// Simpla
export function IlluBenchSimple({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M22 46h76" strokeWidth={4} />
      <path d="M30 46v24M90 46v24" strokeWidth={2.75} />
    </Svg>
  );
}

// Sezut tapitat (pentru boolean-ul bancutei)
export function IlluUpholsteredSeat({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="24" y="34" width="72" height="16" rx="8" />
      <path d="M38 34v16M52 34v16M66 34v16M80 34v16" strokeWidth={2} opacity={0.5} />
      <path d="M30 58v12M90 58v12" strokeWidth={2.5} />
    </Svg>
  );
}

// Canal de cabluri (birou)
export function IlluCableManagement({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M20 34h80" strokeWidth={3.25} />
      <rect x="40" y="40" width="40" height="10" rx="5" strokeWidth={2.25} />
      <path d="M52 50c0 8-6 8-6 16M68 50c0 8 6 8 6 16" strokeWidth={2} opacity={0.65} />
    </Svg>
  );
}
