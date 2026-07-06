// Ilustratii SVG pentru flow-ul de bucatarie: layout (vedere de sus),
// zone de corpuri (vedere frontala), blaturi si electrocasnice.
import { IllustrationSvg as Svg, type IllustrationProps } from './common';

// --- Layout (vedere de sus; peretii sunt linia subtire, blatul e banda groasa) ---

export function IlluLayoutStraight({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="14" y="12" width="92" height="66" rx="2" strokeWidth={1.75} opacity={0.4} />
      <rect x="18" y="16" width="84" height="16" rx="2" />
      <path d="M30 16v16M46 16v16M62 16v16M78 16v16" strokeWidth={1.75} opacity={0.55} />
    </Svg>
  );
}

export function IlluLayoutL({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="14" y="12" width="92" height="66" rx="2" strokeWidth={1.75} opacity={0.4} />
      <path d="M18 74V16h84v16H34v42z" />
      <path d="M34 48v10M34 64v10" strokeWidth={0} />
      <path d="M52 16v16M70 16v16M88 16v16M18 44h16M18 60h16" strokeWidth={1.75} opacity={0.55} />
    </Svg>
  );
}

export function IlluLayoutU({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="14" y="12" width="92" height="66" rx="2" strokeWidth={1.75} opacity={0.4} />
      <path d="M18 74V16h84v58h-16V32H34v42z" />
      <path d="M50 16v16M68 16v16M18 46h16M18 60h16M86 46h16M86 60h16" strokeWidth={1.75} opacity={0.55} />
    </Svg>
  );
}

// Paralel (galley) — pastrat pentru cererile v1 deja publicate
export function IlluLayoutParallel({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="14" y="12" width="92" height="66" rx="2" strokeWidth={1.75} opacity={0.4} />
      <rect x="18" y="16" width="84" height="15" rx="2" />
      <rect x="18" y="59" width="84" height="15" rx="2" />
      <path d="M40 16v15M62 16v15M84 16v15M40 59v15M62 59v15M84 59v15" strokeWidth={1.75} opacity={0.55} />
    </Svg>
  );
}

// Insula: blat pe perete + bloc central separat
export function IlluIsland({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="14" y="12" width="92" height="66" rx="2" strokeWidth={1.75} opacity={0.4} />
      <rect x="18" y="16" width="84" height="13" rx="2" opacity={0.6} />
      <rect x="40" y="46" width="40" height="20" rx="3" />
      <path d="M53 46v20M67 46v20" strokeWidth={1.75} opacity={0.55} />
    </Svg>
  );
}

// --- Zone corpuri (vedere frontala) ---

export function IlluBaseUnits({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <path d="M16 44h88" strokeWidth={1.75} opacity={0.4} />
      <rect x="20" y="48" width="80" height="26" rx="2" />
      <path d="M46 48v26M72 48v26" strokeWidth={2} />
      <path d="M30 58h8M54 58h8M80 58h8" strokeWidth={2.5} />
    </Svg>
  );
}

export function IlluWallUnits({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="20" y="16" width="80" height="24" rx="2" />
      <path d="M46 16v24M72 16v24" strokeWidth={2} />
      <path d="M30 34h8M54 34h8M80 34h8" strokeWidth={2.5} />
      <path d="M16 74h88" strokeWidth={1.75} opacity={0.4} />
    </Svg>
  );
}

export function IlluTallPantry({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="42" y="12" width="36" height="66" rx="2" />
      <path d="M42 44h36" strokeWidth={2} />
      <path d="M52 28h6M52 60h6" strokeWidth={2.5} />
    </Svg>
  );
}

export function IlluIslandUnits({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="26" y="34" width="68" height="14" rx="3" />
      <rect x="32" y="48" width="56" height="24" rx="2" />
      <path d="M60 48v24" strokeWidth={2} />
      <path d="M42 58h8M70 58h8" strokeWidth={2.5} />
    </Svg>
  );
}

// --- Blaturi (sectiune de blat cu textura specifica) ---

function CountertopSlab({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <rect x="16" y="34" width="88" height="14" rx="3" />
      <path d="M22 56h20M22 64h12" strokeWidth={2} opacity={0.35} />
      {children}
    </>
  );
}

export function IlluCountertopLaminate({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <CountertopSlab>
        <path d="M24 41h30" strokeWidth={2} opacity={0.5} />
      </CountertopSlab>
    </Svg>
  );
}

export function IlluCountertopQuartz({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <CountertopSlab>
        <path d="M30 39l2 2m10-3l2 2m12-2l2 2m12-3l2 2m10-1l2 2" strokeWidth={1.75} />
        <path d="M84 26l2-4 2 4 4 2-4 2-2 4-2-4-4-2z" strokeWidth={1.5} />
      </CountertopSlab>
    </Svg>
  );
}

export function IlluCountertopGranite({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <CountertopSlab>
        <circle cx="32" cy="41" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="46" cy="39" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="58" cy="43" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="72" cy="40" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="88" cy="42" r="1.4" fill="currentColor" stroke="none" />
      </CountertopSlab>
    </Svg>
  );
}

export function IlluCountertopWood({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <CountertopSlab>
        <path d="M24 41c12-3 24 4 36 1s20-3 34-1" strokeWidth={1.75} opacity={0.7} />
      </CountertopSlab>
    </Svg>
  );
}

// --- Electrocasnice incorporabile ---

export function IlluOven({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="34" y="18" width="52" height="54" rx="3" />
      <path d="M34 32h52" strokeWidth={2} />
      <circle cx="44" cy="25" r="2" fill="currentColor" stroke="none" />
      <circle cx="54" cy="25" r="2" fill="currentColor" stroke="none" />
      <rect x="42" y="40" width="36" height="22" rx="2" strokeWidth={2.25} />
      <path d="M42 46h36" strokeWidth={1.75} opacity={0.5} />
    </Svg>
  );
}

export function IlluHob({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="22" y="28" width="76" height="34" rx="4" />
      <circle cx="42" cy="40" r="6" />
      <circle cx="78" cy="40" r="6" />
      <circle cx="42" cy="53" r="4" strokeWidth={2.25} />
      <circle cx="78" cy="53" r="4" strokeWidth={2.25} />
    </Svg>
  );
}

export function IlluHood({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="52" y="12" width="16" height="22" />
      <path d="M30 50l22-16h16l22 16z" />
      <rect x="30" y="50" width="60" height="8" rx="2" />
      <path d="M44 68v6M60 68v8M76 68v6" strokeWidth={2} opacity={0.6} />
    </Svg>
  );
}

export function IlluDishwasher({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="34" y="18" width="52" height="54" rx="3" />
      <path d="M34 30h52" strokeWidth={2} />
      <circle cx="42" cy="24" r="2" fill="currentColor" stroke="none" />
      <path d="M48 50c4-8 8-8 12 0s8 8 12 0" strokeWidth={2.25} />
      <path d="M48 60c4-8 8-8 12 0s8 8 12 0" strokeWidth={2.25} opacity={0.6} />
    </Svg>
  );
}

export function IlluFridge({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="40" y="10" width="40" height="70" rx="4" />
      <path d="M40 38h40" strokeWidth={2} />
      <path d="M48 22v8M48 48v12" strokeWidth={2.5} />
    </Svg>
  );
}

export function IlluMicrowave({ className }: IllustrationProps) {
  return (
    <Svg className={className}>
      <rect x="22" y="28" width="76" height="36" rx="4" />
      <rect x="30" y="35" width="44" height="22" rx="2" strokeWidth={2.25} />
      <circle cx="86" cy="40" r="2" fill="currentColor" stroke="none" />
      <path d="M82 50h8" strokeWidth={2.5} />
    </Svg>
  );
}
