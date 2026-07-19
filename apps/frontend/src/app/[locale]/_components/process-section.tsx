'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// Sectiunea "Cum functioneaza" de pe landing: trei acte numerotate, legate
// de un fir de alama care se traseaza singur. Totul porneste abia cand
// sectiunea intra in viewport (IntersectionObserver): coloanele urca in
// cascada (data-reveal + --rd), iar vignetele-schita se deseneaza cu
// plan-draw (tinute pe loc de .plan-paused pana la scroll).

const d = (ms: number) => ({ '--d': ms }) as CSSProperties;
const rd = (ms: number) => ({ '--rd': ms }) as CSSProperties;

const ink = 'hsl(var(--foreground))';
const brass = 'hsl(var(--brass))';
const hidden = 'hsl(var(--muted-2))';

/** Actul I — schita: plan cu cota de alama si creionul inca pe foaie. */
function VignetteSketch({ base }: { base: number }) {
  return (
    <svg viewBox="0 0 120 84" className="h-full w-auto" aria-hidden fill="none">
      <rect x="16" y="16" width="54" height="38" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(base)} />
      <line x1="16" y1="60" x2="16" y2="72" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(base + 350)} />
      <line x1="70" y1="60" x2="70" y2="72" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(base + 350)} />
      <line x1="16" y1="67" x2="70" y2="67" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(base + 420)} />
      <text x="43" y="81" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill={brass} data-fade style={d(base + 550)}>
        2400
      </text>
      {/* creionul */}
      <line x1="108" y1="22" x2="90" y2="40" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(base + 250)} />
      <path d="M90 40l-4 9 9-4z" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 400)} />
      {/* muchie ascunsa in plan */}
      <line x1="16" y1="35" x2="44" y2="35" stroke={hidden} strokeWidth="1" strokeDasharray="4 3" data-fade style={d(base + 600)} />
    </svg>
  );
}

/** Actul II — ofertare: trei ateliere, cel din mijloc revendica cererea. */
function VignetteClaim({ base }: { base: number }) {
  return (
    <svg viewBox="0 0 120 84" className="h-full w-auto" aria-hidden fill="none">
      <path d="M14 58V44l13-9 13 9v14z" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(base)} />
      <path d="M47 58V44l13-9 13 9v14z" stroke={brass} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 200)} />
      <path d="M80 58V44l13-9 13 9v14z" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 400)} />
      {/* bifarea atelierului care revendica */}
      <path d="M55 47l4 4 7-8" stroke={brass} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 650)} />
      {/* fumul din cos — semn ca atelierul e viu */}
      <path d="M64 33c-2-2 2-4 0-6" stroke={hidden} strokeWidth="1" data-fade style={d(base + 800)} />
    </svg>
  );
}

/** Actul III — decizie: doua oferte alaturi, una primeste sigiliul. */
function VignetteDecide({ base }: { base: number }) {
  return (
    <svg viewBox="0 0 120 84" className="h-full w-auto" aria-hidden fill="none">
      <rect x="20" y="20" width="30" height="42" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(base)} />
      <line x1="26" y1="30" x2="44" y2="30" stroke={hidden} strokeWidth="1" data-fade style={d(base + 500)} />
      <line x1="26" y1="37" x2="44" y2="37" stroke={hidden} strokeWidth="1" data-fade style={d(base + 550)} />
      <rect x="62" y="18" width="34" height="46" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 200)} />
      <line x1="68" y1="28" x2="90" y2="28" stroke={hidden} strokeWidth="1" data-fade style={d(base + 600)} />
      <line x1="68" y1="35" x2="90" y2="35" stroke={hidden} strokeWidth="1" data-fade style={d(base + 650)} />
      {/* sigiliul de alama pe oferta aleasa */}
      <circle cx="79" cy="49" r="9" stroke={brass} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 450)} />
      <path d="M74.5 49l3.5 3.5 7-8" stroke={brass} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 700)} />
    </svg>
  );
}

const NUMERALS = ['I', 'II', 'III'] as const;
const VIGNETTES = [VignetteSketch, VignetteClaim, VignetteDecide] as const;

export function ProcessSection() {
  const t = useTranslations('Landing');
  const ref = useRef<HTMLElement>(null);
  // A1: 'idle' = starea SSR/fara JS — continut VIZIBIL, nimic ascuns.
  // Abia dupa hidratare (si doar daca utilizatorul nu prefera miscare redusa,
  // iar IntersectionObserver exista) trecem in 'armed' (ascuns, in asteptarea
  // scroll-ului), apoi 'in-view' declanseaza cascada. Daca observerul nu
  // declanseaza (race/viewport ciudat), un timeout de siguranta arata tot.
  const [phase, setPhase] = useState<'idle' | 'armed' | 'in-view'>('idle');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return; // ramane 'idle': static si complet vizibil
    }
    setPhase('armed');
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPhase('in-view');
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    // plasa de siguranta: orice s-ar intampla cu observerul, continutul apare
    const failsafe = window.setTimeout(() => setPhase('in-view'), 4000);
    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  const steps = [
    { phase: t('step1Phase'), title: t('step1Title'), body: t('step1Body') },
    { phase: t('step2Phase'), title: t('step2Title'), body: t('step2Body') },
    { phase: t('step3Phase'), title: t('step3Title'), body: t('step3Body') },
  ];

  return (
    <section
      ref={ref}
      className={cn(
        'py-14',
        // 'idle' (SSR / reduced-motion / fara IO): FARA clase de animatie —
        // schitele si textul sunt desenate gata si vizibile
        phase !== 'idle' && 'plan-draw reveal-armed',
        phase === 'armed' && 'plan-paused',
        phase === 'in-view' && 'in-view',
      )}
    >
      <div className="mb-10" data-reveal>
        <span className="kicker">{t('processKicker')}</span>
        <h2 className="serif mt-2 text-3xl sm:text-4xl">{t('howTitle')}</h2>
      </div>

      <div className="relative grid gap-10 md:grid-cols-3 md:gap-8 md:pt-10">
        {/* firul de alama care leaga cele trei acte (doar pe desktop) */}
        <svg
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 hidden h-px w-full overflow-visible md:block"
          viewBox="0 0 100 1"
          preserveAspectRatio="none"
          fill="none"
        >
          <line
            x1="0"
            y1="0.5"
            x2="100"
            y2="0.5"
            stroke="hsl(var(--brass) / 0.55)"
            strokeWidth="1"
            pathLength={1}
            data-draw
            style={d(150)}
          />
        </svg>
        {NUMERALS.map((_, i) => (
          <span
            key={i}
            aria-hidden
            data-fade
            className="absolute top-0 hidden h-1.5 w-1.5 -translate-y-1/2 rotate-45 bg-brass md:block"
            style={{ ...d(700 + i * 250), left: `calc(${i} * 100% / 3)` }}
          />
        ))}

        {steps.map((s, i) => {
          const Vignette = VIGNETTES[i];
          return (
            <div key={s.title} data-reveal style={rd(i * 160)}>
              <div className="mb-4 flex items-baseline gap-3">
                <span className="font-serif text-3xl text-brass">{NUMERALS[i]}.</span>
                <span className="label tracking-[0.14em]">{s.phase}</span>
              </div>
              <div className="mb-3 h-20">
                <Vignette base={500 + i * 300} />
              </div>
              <h3 className="font-serif text-[22px]">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
