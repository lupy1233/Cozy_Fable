// Ilustratii pentru piesele si configuratiile per camera (item 2):
// living / dormitor / birou / hol / spalatorie / debara / balcon / dressing.
// Acelasi limbaj ca common.tsx: viewBox 120x90, currentColor, stroke rotunjit.
import { IllustrationSvg as Svg, type IllustrationProps } from './common';

// --- LIVING: piese ---

// Comoda TV joasa cu televizor deasupra
export function IlluTvUnit({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="34" y="18" width="52" height="30" rx="2" />
      <path d="M60 48v6" strokeWidth={2.5} />
      <rect x="18" y="56" width="84" height="20" rx="3" />
      <path d="M46 56v20M74 56v20" strokeWidth={2} opacity={0.6} />
      <path d="M28 64h8M88 64h8" strokeWidth={2.5} />
    </Svg>
  );
}

// Biblioteca cu rafturi si carti
export function IlluBookshelf({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="30" y="14" width="60" height="62" rx="3" />
      <path d="M30 34h60M30 54h60" strokeWidth={2.25} />
      {/* carti: verticale + una inclinata */}
      <path d="M40 34v-12M47 34v-12M54 34l6-11" strokeWidth={2.25} opacity={0.7} />
      <path d="M64 54v-12M72 54v-12M80 54v-12" strokeWidth={2.25} opacity={0.7} />
    </Svg>
  );
}

// Vitrina cu usi de sticla (reflexii diagonale)
export function IlluDisplayCabinet({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="34" y="12" width="52" height="66" rx="3" />
      <path d="M60 12v66" strokeWidth={2} opacity={0.6} />
      <path d="M42 34l12-14M44 48l16-20" strokeWidth={2} opacity={0.5} />
      <path d="M70 34l12-14M72 48l16-20" strokeWidth={2} opacity={0.5} />
      <path d="M54 44h4M66 44h-4" strokeWidth={2.5} />
    </Svg>
  );
}

// Masuta de cafea cu ceasca
export function IlluCoffeeTable({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M20 52h80" strokeWidth={3.5} />
      <path d="M28 52v20M92 52v20" strokeWidth={3} />
      <path d="M20 60h6M94 60h6" strokeWidth={2} opacity={0.4} />
      {/* ceasca cu abur */}
      <path d="M52 44v8h14v-8z" strokeWidth={2.5} />
      <path d="M66 46c4 0 4 4 0 4" strokeWidth={2} />
      <path d="M56 36c0-3 2-3 2-6M62 36c0-3 2-3 2-6" strokeWidth={2} opacity={0.6} />
    </Svg>
  );
}

// Rafturi suspendate pe perete
export function IlluWallShelves({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M24 26h50" strokeWidth={3.5} />
      <path d="M46 46h50" strokeWidth={3.5} />
      <path d="M24 66h50" strokeWidth={3.5} />
      {/* obiecte pe rafturi */}
      <path d="M32 26v-9M40 26v-9" strokeWidth={2.25} opacity={0.7} />
      <circle cx="62" cy="40" r="5" strokeWidth={2.25} opacity={0.7} />
      <path d="M34 66v-8h10v8" strokeWidth={2.25} opacity={0.7} />
    </Svg>
  );
}

// Alta piesa: cutie cu semn plus
export function IlluOtherPiece({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="30" y="26" width="60" height="44" rx="4" strokeDasharray="7 6" />
      <path d="M60 38v20M50 48h20" strokeWidth={3} />
    </Svg>
  );
}

// --- LIVING: tvStyle ---

// Comoda TV suspendata (umbra sub ea)
export function IlluTvFloating({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="34" y="14" width="52" height="28" rx="2" />
      <rect x="20" y="50" width="80" height="16" rx="3" />
      <path d="M30 76h60" strokeWidth={2} opacity={0.35} />
    </Svg>
  );
}

// Comoda TV pe podea (picioare)
export function IlluTvOnFloor({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="34" y="12" width="52" height="28" rx="2" />
      <rect x="20" y="48" width="80" height="18" rx="3" />
      <path d="M28 66l-3 10M92 66l3 10" strokeWidth={2.5} />
    </Svg>
  );
}

// Perete media complet (corpuri in jurul TV-ului)
export function IlluTvComplexUnit({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="16" y="12" width="88" height="64" rx="3" />
      <rect x="40" y="24" width="40" height="24" rx="2" strokeWidth={2.5} />
      <path d="M16 60h88" strokeWidth={2.25} />
      <path d="M40 12v48M80 12v48" strokeWidth={2.25} opacity={0.6} />
      <path d="M24 34h8M96 34h-8" strokeWidth={2} opacity={0.6} />
    </Svg>
  );
}

// LED: banda luminoasa sub polita (folosit ca vizual "Da" la iluminare)
export function IlluLedLighting({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M24 34h72" strokeWidth={3.5} />
      <path d="M30 42l-4 8M46 42l-4 8M62 42l-4 8M78 42l-4 8M94 42l-4 8" strokeWidth={2} opacity={0.65} />
      <rect x="34" y="58" width="52" height="16" rx="3" />
    </Svg>
  );
}

// --- DORMITOR: piese ---

// Pat cu tablie si perna
export function IlluBed({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M20 26v40M20 52h80v14" strokeWidth={3} />
      <path d="M20 52c0-10 6-14 16-14h64v14" strokeWidth={2.75} />
      <rect x="26" y="40" width="18" height="9" rx="4" strokeWidth={2.25} />
      <path d="M20 66v8M100 66v8" strokeWidth={2.5} />
    </Svg>
  );
}

// Noptiera cu veioza
export function IlluNightstand({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="36" y="42" width="48" height="30" rx="3" />
      <path d="M36 57h48" strokeWidth={2} opacity={0.6} />
      <path d="M54 50h12M54 64h12" strokeWidth={2.5} />
      {/* veioza */}
      <path d="M60 42v-8" strokeWidth={2.25} />
      <path d="M50 34h20l-4-12h-12z" strokeWidth={2.25} />
    </Svg>
  );
}

// Comoda cu sertare
export function IlluDresser({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="26" y="24" width="68" height="48" rx="3" />
      <path d="M26 40h68M26 56h68" strokeWidth={2.25} />
      <path d="M54 32h12M54 48h12M54 64h12" strokeWidth={2.75} />
    </Svg>
  );
}

// Masuta de toaleta cu oglinda
export function IlluVanityTable({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <ellipse cx="60" cy="26" rx="16" ry="14" />
      <path d="M60 40v8" strokeWidth={2.5} />
      <path d="M28 48h64" strokeWidth={3.25} />
      <path d="M34 48v24M86 48v24" strokeWidth={2.75} />
      <path d="M52 48v10h16v-10" strokeWidth={2.25} opacity={0.7} />
      <path d="M52 32l6-8" strokeWidth={2} opacity={0.5} />
    </Svg>
  );
}

// Dulap cu doua usi (generic dormitor/hol)
export function IlluWardrobe({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="32" y="12" width="56" height="64" rx="3" />
      <path d="M60 12v64" strokeWidth={2.25} />
      <path d="M53 40v10M67 40v10" strokeWidth={2.75} />
    </Svg>
  );
}

// --- DORMITOR: dimensiuni pat ---

// Pat single (o perna) — vedere de sus
export function IlluBedSingle({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="42" y="14" width="36" height="62" rx="4" />
      <rect x="48" y="20" width="24" height="12" rx="4" strokeWidth={2.25} />
      <path d="M42 40h36" strokeWidth={2} opacity={0.5} />
    </Svg>
  );
}

// Pat dublu compact (140) — doua perne inguste
export function IlluBedDouble140({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="34" y="14" width="52" height="62" rx="4" />
      <rect x="39" y="20" width="19" height="12" rx="4" strokeWidth={2} />
      <rect x="62" y="20" width="19" height="12" rx="4" strokeWidth={2} />
      <path d="M34 40h52" strokeWidth={2} opacity={0.5} />
    </Svg>
  );
}

// Pat queen (160)
export function IlluBedQueen({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="28" y="14" width="64" height="62" rx="4" />
      <rect x="34" y="20" width="24" height="13" rx="4" strokeWidth={2.25} />
      <rect x="62" y="20" width="24" height="13" rx="4" strokeWidth={2.25} />
      <path d="M28 41h64" strokeWidth={2} opacity={0.5} />
    </Svg>
  );
}

// Pat king (180) — cel mai lat
export function IlluBedKing({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="20" y="14" width="80" height="62" rx="4" />
      <rect x="27" y="20" width="30" height="14" rx="4" strokeWidth={2.25} />
      <rect x="63" y="20" width="30" height="14" rx="4" strokeWidth={2.25} />
      <path d="M20 42h80" strokeWidth={2} opacity={0.5} />
    </Svg>
  );
}

// Dimensiune personalizata: pat + cota cu creion
export function IlluBedCustom({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="30" y="14" width="60" height="50" rx="4" strokeDasharray="7 6" />
      <path d="M30 76h60m0 0l-6-5m6 5l-6 5M30 76l6-5m-6 5l6 5" strokeWidth={2.25} />
    </Svg>
  );
}

// --- DORMITOR/PAT: depozitare ---

// Fara depozitare: pat simplu pe picioare
export function IlluBedNoStorage({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M18 46h84" strokeWidth={3.25} />
      <path d="M22 34c0-6 4-10 10-10h10v22" strokeWidth={2.5} />
      <path d="M26 46v18M96 46v18" strokeWidth={2.75} />
      <path d="M18 56h84" strokeWidth={2} opacity={0.4} />
    </Svg>
  );
}

// Lada cu mecanism rabatabil: saltea ridicata + brat
export function IlluBedLiftUp({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="22" y="46" width="76" height="22" rx="3" />
      {/* salteaua ridicata, inclinata */}
      <path d="M22 46l64-26h14" strokeWidth={2.75} />
      <path d="M40 46l-4-14" strokeWidth={2.25} opacity={0.7} />
      <path d="M104 40V24m0 0l-5 6m5-6l5 6" strokeWidth={2.5} />
    </Svg>
  );
}

// Sertare laterale sub pat
export function IlluBedDrawers({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M20 36h80v12H20z" strokeWidth={2.5} />
      <rect x="20" y="48" width="80" height="20" rx="2" />
      <path d="M60 48v20" strokeWidth={2.25} />
      <path d="M34 58h12M74 58h12" strokeWidth={2.75} />
      {/* un sertar tras in afara */}
      <path d="M20 68l-8 8h36l8-8" strokeWidth={2.25} opacity={0.6} />
    </Svg>
  );
}

// Tablie tapitata (romburi) — vizual "Da" pentru pat tapitat
export function IlluUpholstered({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="30" y="14" width="60" height="50" rx="6" />
      <path d="M30 34l20-20M40 64l40-40M60 64l30-30" strokeWidth={2} opacity={0.55} />
      <path d="M90 34L70 14M80 64L30 24" strokeWidth={2} opacity={0.55} />
      <path d="M36 76h48" strokeWidth={2.5} />
    </Svg>
  );
}

// O noptiera / doua noptiere
export function IlluNightstandOne({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="44" y="34" width="32" height="30" rx="3" />
      <path d="M54 48h12" strokeWidth={2.75} />
      <path d="M44 64v8M76 64v8" strokeWidth={2.25} />
    </Svg>
  );
}
export function IlluNightstandTwo({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="18" y="34" width="32" height="30" rx="3" />
      <path d="M28 48h12" strokeWidth={2.75} />
      <rect x="70" y="34" width="32" height="30" rx="3" />
      <path d="M80 48h12" strokeWidth={2.75} />
    </Svg>
  );
}

// --- BIROU (camera): piese + forma birou ---

// Birou cu monitor
export function IlluDesk({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="44" y="16" width="32" height="20" rx="2" />
      <path d="M60 36v6M52 42h16" strokeWidth={2.25} />
      <path d="M20 48h80" strokeWidth={3.25} />
      <path d="M26 48v24M94 48v24" strokeWidth={2.75} />
      <path d="M70 48v16h20v-16" strokeWidth={2.25} opacity={0.7} />
    </Svg>
  );
}

// Dulap depozitare birou (usi + raft)
export function IlluOfficeStorage({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="32" y="14" width="56" height="62" rx="3" />
      <path d="M32 38h56" strokeWidth={2.25} />
      <path d="M60 38v38" strokeWidth={2.25} />
      <path d="M42 24h14" strokeWidth={2.5} opacity={0.7} />
      <path d="M54 56h4M66 56h-4" strokeWidth={2.5} />
    </Svg>
  );
}

// Forma birou: drept / in L / in U (vedere de sus)
export function IlluDeskStraight({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="22" y="30" width="76" height="22" rx="3" />
      <circle cx="60" cy="66" r="9" strokeWidth={2.5} />
    </Svg>
  );
}
export function IlluDeskL({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M24 24h72v22H46v28H24z" />
      <circle cx="66" cy="64" r="9" strokeWidth={2.5} />
    </Svg>
  );
}
export function IlluDeskU({ className }: IllustrationProps) {
  // U real (feedback PO 2026-07-13): bara de sus + doua brate care coboara,
  // cu scaunul in golul dintre ele — vechiul desen arata de fapt un T
  return (
    <Svg className={className}>
      <path d="M22 22h76v42h-22V44H44v20H22z" />
      <circle cx="60" cy="58" r="7" strokeWidth={2.5} />
    </Svg>
  );
}

// --- HOL: piese ---

// Pantofar cu pantof deasupra
export function IlluShoeCabinet({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="28" y="36" width="64" height="38" rx="3" />
      <path d="M28 55h64" strokeWidth={2.25} />
      <path d="M54 45h12M54 64h12" strokeWidth={2.5} />
      {/* pantoful */}
      <path d="M42 28c0-6 6-8 12-6 4 1 6 4 12 4h10c0 4-4 6-10 6H42z" strokeWidth={2.25} />
    </Svg>
  );
}

// Cuier cu panou, carlige si haina
export function IlluCoatUnit({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="30" y="12" width="60" height="64" rx="3" />
      <path d="M40 24h40" strokeWidth={2.5} />
      <path d="M48 24v6M72 24v6" strokeWidth={2.25} />
      {/* haina pe umeras */}
      <path d="M60 30l-10 10v22h20V40z" strokeWidth={2.25} opacity={0.75} />
      <path d="M60 26v4" strokeWidth={2.25} />
    </Svg>
  );
}

// Oglinda cu polita
export function IlluMirrorShelf({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="40" y="12" width="40" height="52" rx="4" />
      <path d="M48 46l16-24M56 52l18-26" strokeWidth={2} opacity={0.5} />
      <path d="M32 72h56" strokeWidth={3.25} />
      <path d="M40 72v6M80 72v6" strokeWidth={2} opacity={0.6} />
    </Svg>
  );
}

// Bancuta simpla (hol) — sezut + picioare
export function IlluBench({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M22 44h76" strokeWidth={3.5} />
      <path d="M28 44v24M92 44v24" strokeWidth={2.75} />
      <path d="M22 54h76" strokeWidth={2} opacity={0.4} />
    </Svg>
  );
}

// --- SPALATORIE ---

// Masina de spalat
export function IlluWasher({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="34" y="16" width="52" height="58" rx="4" />
      <path d="M34 28h52" strokeWidth={2} opacity={0.6} />
      <circle cx="60" cy="50" r="14" />
      <circle cx="60" cy="50" r="8" strokeWidth={2} opacity={0.6} />
      <circle cx="42" cy="22" r="2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

// Coloana: uscator peste masina
export function IlluStacked({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="38" y="8" width="44" height="36" rx="3" />
      <circle cx="60" cy="26" r="9" strokeWidth={2.25} />
      <rect x="38" y="46" width="44" height="36" rx="3" />
      <circle cx="60" cy="64" r="9" strokeWidth={2.25} />
    </Svg>
  );
}

// Alaturate sub blat
export function IlluSideBySide({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M14 28h92" strokeWidth={3.5} />
      <rect x="20" y="34" width="38" height="40" rx="3" />
      <circle cx="39" cy="54" r="10" strokeWidth={2.25} />
      <rect x="62" y="34" width="38" height="40" rx="3" />
      <circle cx="81" cy="54" r="10" strokeWidth={2.25} />
    </Svg>
  );
}

// Dulap de incastrare electrocasnice (masina in dulap)
export function IlluApplianceHousing({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="30" y="10" width="60" height="68" rx="3" />
      <path d="M30 32h60" strokeWidth={2.25} />
      <path d="M42 21h14" strokeWidth={2.5} opacity={0.7} />
      <circle cx="60" cy="55" r="12" strokeWidth={2.5} />
      <circle cx="60" cy="55" r="6.5" strokeWidth={2} opacity={0.6} />
    </Svg>
  );
}

// Dulapuri depozitare cu cosuri/detergent
export function IlluLaundryStorage({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="28" y="12" width="64" height="64" rx="3" />
      <path d="M28 42h64" strokeWidth={2.25} />
      {/* sticla detergent + cos */}
      <path d="M42 30v-8h8v8" strokeWidth={2.25} opacity={0.75} />
      <path d="M40 30h12" strokeWidth={2.25} opacity={0.75} />
      <path d="M62 54h18l-3 14H65z" strokeWidth={2.25} opacity={0.75} />
      <path d="M64 54c0-6 14-6 14 0" strokeWidth={2} opacity={0.6} />
    </Svg>
  );
}

// Blat de lucru (rufe impaturite pe blat)
export function IlluWorktop({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M16 44h88" strokeWidth={3.5} />
      <path d="M24 44v28M96 44v28" strokeWidth={2.75} />
      <path d="M40 36h24M40 28h24M42 20h20" strokeWidth={2.5} opacity={0.7} />
    </Svg>
  );
}

// Corp cu cuva tehnica (chiuveta adanca + robinet)
export function IlluSinkUnit({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="30" y="40" width="60" height="34" rx="3" />
      {/* cuva incastrata */}
      <path d="M40 40v-10h40v10" strokeWidth={2.5} />
      {/* robinetul */}
      <path d="M60 30v-10c0-4 6-4 8-2" strokeWidth={2.25} />
      <path d="M52 52h16" strokeWidth={2.5} opacity={0.6} />
    </Svg>
  );
}

// --- DEBARA: stil depozitare ---

// Rafturi deschise cu borcane/cutii
export function IlluOpenShelves({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M26 24h68M26 46h68M26 68h68" strokeWidth={3.25} />
      <path d="M36 24v-10h10v10" strokeWidth={2.25} opacity={0.75} />
      <circle cx="64" cy="38" r="6" strokeWidth={2.25} opacity={0.75} />
      <path d="M76 68v-12h14v12" strokeWidth={2.25} opacity={0.75} />
    </Svg>
  );
}

// Dulapuri inchise
export function IlluClosedCabinets({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="28" y="14" width="64" height="62" rx="3" />
      <path d="M60 14v62" strokeWidth={2.25} />
      <path d="M52 42v8M68 42v8" strokeWidth={2.75} />
    </Svg>
  );
}

// Mixt: dulap jos + rafturi sus
export function IlluMixedStorage({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M28 18h64M28 34h64" strokeWidth={3} />
      <path d="M40 18v-6M50 34v-8" strokeWidth={2.25} opacity={0.7} />
      <rect x="28" y="44" width="64" height="32" rx="3" />
      <path d="M60 44v32" strokeWidth={2.25} />
      <path d="M52 58h4M68 58h-4" strokeWidth={2.5} />
    </Svg>
  );
}

// --- BALCON: inchis / deschis ---

// Balcon inchis cu termopan
export function IlluBalconyEnclosed({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="22" y="14" width="76" height="62" rx="2" />
      <path d="M22 48h76" strokeWidth={2.5} />
      <path d="M47 14v34M73 14v34" strokeWidth={2.25} />
      <path d="M30 40l10-18M56 40l10-18" strokeWidth={1.75} opacity={0.5} />
      {/* parapetul plin jos */}
      <path d="M22 62h76" strokeWidth={2} opacity={0.5} />
    </Svg>
  );
}

// Balcon deschis: parapet + soare
export function IlluBalconyOpen({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <circle cx="86" cy="24" r="9" strokeWidth={2.5} />
      <path d="M86 10v-4M86 42v-4M72 24h-4M104 24h-4M76 14l-3-3M96 34l3 3M96 14l3-3M76 34l-3 3" strokeWidth={2} />
      <path d="M20 50h80" strokeWidth={3} />
      <path d="M26 50v24M42 50v24M58 50v24M74 50v24M90 50v24" strokeWidth={2.25} />
      <path d="M20 74h80" strokeWidth={2.5} />
    </Svg>
  );
}

// --- DRESSING: layout walk-in + module interioare + iluminare ---

// Walk-in: camera dedicata cu intrare (vedere de sus, corpuri pe 2 laturi)
export function IlluWalkIn({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M22 78V14h76v64h-28" strokeWidth={2.75} />
      {/* corpurile pe doua laturi */}
      <rect x="28" y="20" width="12" height="52" strokeWidth={2.25} />
      <rect x="46" y="20" width="46" height="12" strokeWidth={2.25} />
      {/* usa cu arc la intrare */}
      <path d="M70 78h-14M56 78a22 22 0 0 1 22-22" strokeWidth={2.25} opacity={0.7} />
    </Svg>
  );
}

// Bara cu umerase
export function IlluHangingRods({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M22 24h76" strokeWidth={3.5} />
      {/* umerase */}
      <path d="M40 24v6M40 30l-10 10h20z" strokeWidth={2.25} />
      <path d="M64 24v6M64 30l-10 10h20z" strokeWidth={2.25} />
      <path d="M88 24v6M88 30l-8 8" strokeWidth={2.25} opacity={0.6} />
    </Svg>
  );
}

// Suport pantofi (rafturi inclinate cu pantofi)
export function IlluShoeRack({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M26 36l68-8" strokeWidth={3} />
      <path d="M26 62l68-8" strokeWidth={3} />
      <path d="M38 32c0-4 4-6 8-5 3 1 4 3 8 3h8c0 3-3 4-8 4z" strokeWidth={2} opacity={0.75} />
      <path d="M62 56c0-4 4-6 8-5 3 1 4 3 8 3h8c0 3-3 4-8 4z" strokeWidth={2} opacity={0.75} />
    </Svg>
  );
}

// Accesorii: tava cu compartimente (curele/ceasuri)
export function IlluAccessories({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="26" y="26" width="68" height="40" rx="4" />
      <path d="M49 26v40M72 26v40M26 46h68" strokeWidth={2} opacity={0.6} />
      <circle cx="37" cy="36" r="4.5" strokeWidth={2} />
      <path d="M56 32c6 6 10 6 12 4" strokeWidth={2} opacity={0.7} />
      <path d="M80 32v8" strokeWidth={2} opacity={0.7} />
    </Svg>
  );
}

// Iluminare LED in dulap (spot + raze peste bara)
export function IlluClosetLighting({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="28" y="14" width="64" height="62" rx="3" />
      <path d="M44 22h32" strokeWidth={3} />
      <path d="M48 28l-3 6M60 28v6M72 28l3 6" strokeWidth={2} opacity={0.65} />
      <path d="M40 62h40" strokeWidth={2.25} opacity={0.5} />
    </Svg>
  );
}
