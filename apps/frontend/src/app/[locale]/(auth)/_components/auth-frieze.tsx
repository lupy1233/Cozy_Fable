// Friza de mobilier de la baza ecranelor de cont (design 2026-11): dulap, biblioteca,
// lampadar, planta, comoda, pat, noptiera — desenate in linie; manerele si abajururile in alama.
// Strict decor: aria-hidden pe containerul din layout.
export function AuthFrieze() {
  return (
    <div className="flex w-full justify-center">
      <svg viewBox="0 0 1100 160" fill="none" aria-hidden className="block h-auto w-full max-w-[1180px]">
        <g
          className="text-muted-2/70"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M24 150.5H1076" />
          <rect x="70" y="28" width="96" height="122" />
          <path d="M66 28H170M118 28V150" />
          <rect x="186" y="52" width="74" height="98" />
          <path d="M186 76h74M186 100h74M186 124h74" />
          <path d="M194 60v16M200 62v14M206 58v18M216 64v12M230 84v16M238 86v14M246 82v18M198 108v16M204 110v14M244 106v18M250 110v14" />
          <rect x="196" y="132" width="24" height="18" />
          <path d="M300 150V70M290 150h20" />
          <path d="M332 128h28l-4 22h-20z" />
          <path d="M346 128C346 108 338 96 330 90M346 128C346 104 350 92 356 84M346 128C348 112 358 104 366 102" />
          <rect x="440" y="104" width="220" height="38" />
          <path d="M452 142v8M648 142v8M495 104v38M550 104v38M605 104v38" />
          <path d="M466 96h28M466 96q14 12 28 0" />
          <rect x="598" y="96" width="40" height="8" />
          <path d="M604 96v-8h28v8" />
          <rect x="772" y="78" width="14" height="72" />
          <rect x="786" y="112" width="196" height="24" />
          <path d="M786 112q0-12 12-12h172q12 0 12 12M792 136v14M976 136v14M860 100v36" />
          <rect x="794" y="88" width="44" height="12" rx="6" />
          <rect x="1000" y="112" width="40" height="38" />
          <path d="M1000 131h40M1020 92v20" />
        </g>
        <g className="text-brass" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M112 84v14M124 84v14" />
          <path d="M286 70l6-22h16l6 22z" />
          <path d="M462 113h12M517 113h12M572 113h12M627 113h12" />
          <path d="M1008 92l4-14h16l4 14z" />
          <path d="M1016 121h8M1016 141h8" />
        </g>
      </svg>
    </div>
  );
}
