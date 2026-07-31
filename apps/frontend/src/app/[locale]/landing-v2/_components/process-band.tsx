'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// Drumul cererii, in patru statii pe firul de alama — compact, fara pinning:
// vignetele se deseneaza (plan-draw) si coloanele urca in cascada cand banda
// intra in viewport, apoi pagina curge normal. Aceleasi mecanici ca pe
// landing-ul v1 (IntersectionObserver + data-draw/data-reveal din globals).

const d = (ms: number) => ({ '--d': ms }) as CSSProperties;
const rd = (ms: number) => ({ '--rd': ms }) as CSSProperties;

const ink = 'hsl(var(--foreground))';
const brass = 'hsl(var(--brass))';
const hidden = 'hsl(var(--muted-2))';

/** 1 — cererea: plansa cu cota si creionul pe foaie */
function VigRequest({ base }: { base: number }) {
  return (
    <svg viewBox="0 0 120 84" className="h-full w-auto" aria-hidden fill="none">
      <rect x="14" y="14" width="58" height="40" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(base)} />
      <line x1="22" y1="26" x2="52" y2="26" stroke={hidden} strokeWidth="1" data-fade style={d(base + 500)} />
      <line x1="22" y1="34" x2="60" y2="34" stroke={hidden} strokeWidth="1" data-fade style={d(base + 550)} />
      <line x1="14" y1="62" x2="72" y2="62" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(base + 400)} />
      <line x1="14" y1="58" x2="14" y2="66" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(base + 400)} />
      <line x1="72" y1="58" x2="72" y2="66" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(base + 400)} />
      <line x1="104" y1="20" x2="86" y2="38" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(base + 250)} />
      <path d="M86 38l-4 9 9-4z" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 450)} />
    </svg>
  );
}

/** 2 — revendicarea: trei ateliere, doua au preluat */
function VigClaim({ base }: { base: number }) {
  return (
    <svg viewBox="0 0 120 84" className="h-full w-auto" aria-hidden fill="none">
      <path d="M12 60V45l14-10 14 10v15z" stroke={brass} strokeWidth="1.5" pathLength={1} data-draw style={d(base)} />
      <path d="M20 48l4 4 7-8" stroke={brass} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 500)} />
      <path d="M46 60V45l14-10 14 10v15z" stroke={brass} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 150)} />
      <path d="M54 48l4 4 7-8" stroke={brass} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 650)} />
      <path d="M80 60V45l14-10 14 10v15z" stroke={hidden} strokeWidth="1.5" strokeDasharray="4 3" data-fade style={d(base + 300)} />
      <path d="M100 30c-2-2 2-4 0-6" stroke={hidden} strokeWidth="1" data-fade style={d(base + 700)} />
    </svg>
  );
}

/** 3 — ofertele: doua foi, sigiliul pe cea aleasa */
function VigOffers({ base }: { base: number }) {
  return (
    <svg viewBox="0 0 120 84" className="h-full w-auto" aria-hidden fill="none">
      <rect x="20" y="18" width="30" height="44" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(base)} />
      <line x1="26" y1="28" x2="44" y2="28" stroke={hidden} strokeWidth="1" data-fade style={d(base + 450)} />
      <line x1="26" y1="35" x2="44" y2="35" stroke={hidden} strokeWidth="1" data-fade style={d(base + 500)} />
      <rect x="62" y="14" width="34" height="48" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 150)} />
      <line x1="68" y1="24" x2="90" y2="24" stroke={hidden} strokeWidth="1" data-fade style={d(base + 550)} />
      <circle cx="79" cy="47" r="9" stroke={brass} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 400)} />
      <path d="M74.5 47l3.5 3.5 7-8" stroke={brass} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 650)} />
    </svg>
  );
}

/** 4 — montajul: dulapul asezat, cota bifata */
function VigInstall({ base }: { base: number }) {
  return (
    <svg viewBox="0 0 120 84" className="h-full w-auto" aria-hidden fill="none">
      <path d="M28 64V26h44v38z" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(base)} />
      <path d="M72 64l14-9V17l-14 9" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 200)} />
      <path d="M28 26l14-9h44" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 300)} />
      <line x1="50" y1="30" x2="50" y2="60" stroke={ink} strokeWidth="1" data-fade style={d(base + 500)} />
      <line x1="46" y1="42" x2="46" y2="50" stroke={brass} strokeWidth="2" data-fade style={d(base + 600)} />
      <line x1="54" y1="42" x2="54" y2="50" stroke={brass} strokeWidth="2" data-fade style={d(base + 600)} />
      <circle cx="99" cy="56" r="10" stroke={brass} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 450)} />
      <path d="M94 56l3.5 3.5 7.5-8.5" stroke={brass} strokeWidth="1.5" pathLength={1} data-draw style={d(base + 700)} />
    </svg>
  );
}

const VIGNETTES = [VigRequest, VigClaim, VigOffers, VigInstall] as const;
const STEP_KEYS = ['p1', 'p2', 'p3', 'p4'] as const;

export function ProcessBand() {
  const t = useTranslations('LandingV2');
  const ref = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<'idle' | 'armed' | 'in-view'>('idle');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
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
    const failsafe = window.setTimeout(() => setPhase('in-view'), 4000);
    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  return (
    <section
      id="proces"
      ref={ref}
      className={cn(
        'scroll-mt-20 py-12',
        phase !== 'idle' && 'plan-draw reveal-armed',
        phase === 'armed' && 'plan-paused',
        phase === 'in-view' && 'in-view',
      )}
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3" data-reveal>
        <div>
          <span className="kicker">{t('processKicker')}</span>
          <h2 className="serif mt-2 text-3xl sm:text-4xl">{t('processTitle')}</h2>
        </div>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{t('processSub')}</p>
      </div>

      <div className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7 lg:pt-9">
        {/* firul de alama care leaga statiile (doar pe desktop) */}
        <svg
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 hidden h-px w-full overflow-visible lg:block"
          viewBox="0 0 100 1"
          preserveAspectRatio="none"
          fill="none"
        >
          <line x1="0" y1="0.5" x2="100" y2="0.5" stroke="hsl(var(--brass) / 0.55)" strokeWidth="1" pathLength={1} data-draw style={d(150)} />
        </svg>
        {STEP_KEYS.map((_, i) => (
          <span
            key={i}
            aria-hidden
            data-fade
            className="absolute top-0 hidden h-1.5 w-1.5 -translate-y-1/2 rotate-45 bg-brass lg:block"
            style={{ ...d(600 + i * 200), left: `calc(${i} * 100% / 4)` }}
          />
        ))}

        {STEP_KEYS.map((key, i) => {
          const Vig = VIGNETTES[i];
          return (
            <div key={key} data-reveal style={rd(i * 140)}>
              <div className="mb-3 flex items-baseline gap-2.5">
                <span className="font-serif text-2xl text-brass">{i + 1}.</span>
                <span className="label tracking-[0.14em]">{t(`${key}.phase`)}</span>
              </div>
              <div className="mb-2.5 h-[72px]">
                <Vig base={400 + i * 250} />
              </div>
              <h3 className="font-serif text-[19px] leading-snug">{t(`${key}.title`)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(`${key}.body`)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
