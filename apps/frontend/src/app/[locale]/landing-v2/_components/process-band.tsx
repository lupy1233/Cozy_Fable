'use client';

import { Check, MessageCircle, Star } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  DEMO_PIECES,
  MATERIAL_CARD,
  VARIANT_CARD,
  useDemoStore,
  type PieceKind,
} from './demo-state';

// Drumul cererii ca mozaic (PO r10), cu trei rafinari (r12):
// 1. firul de alama promis de titlu se deseneaza la scroll si leaga statiile
//    prin spatiile dintre celule;
// 2. statia 1 preia LIVE configuratia din mini-configuratorul din hero —
//    alegerea vizitatorului devine "cererea lui";
// 3. fiecare statie are un singur micro-moment animat la prima intrare in
//    viewport (bifele revendicarii, sigiliul stampilat, stelele umplute pe rand).

const d = (ms: number) => ({ '--d': ms }) as CSSProperties;
const rd = (ms: number) => ({ '--rd': ms }) as CSSProperties;

const ink = 'hsl(var(--foreground))';
const brass = 'hsl(var(--brass))';

type Tr = ReturnType<typeof useTranslations<'LandingV2'>>;

function CellHeader({ no, phase }: { no: string; phase: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="font-serif text-3xl leading-none text-brass">{no}</span>
      <span className="label tracking-[0.14em]">{phase}</span>
    </div>
  );
}

/* silueta piesei alese in demo — completeaza cardurile de material/deschidere */
function PieceMini({ piece }: { piece: PieceKind }) {
  const common = { stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' as const };
  if (piece === 'WARDROBE') {
    return (
      <svg viewBox="0 0 44 44" fill="none" className="h-11 w-auto" aria-hidden {...common}>
        <rect x="10" y="4" width="24" height="36" rx="1.5" />
        <line x1="22" y1="6" x2="22" y2="38" strokeWidth={1.5} />
        <line x1="19" y1="20" x2="19" y2="26" stroke={brass} strokeWidth={2.5} strokeLinecap="round" />
        <line x1="25" y1="20" x2="25" y2="26" stroke={brass} strokeWidth={2.5} strokeLinecap="round" />
      </svg>
    );
  }
  if (piece === 'BOOKCASE') {
    return (
      <svg viewBox="0 0 44 44" fill="none" className="h-11 w-auto" aria-hidden {...common}>
        <rect x="8" y="6" width="28" height="32" rx="1.5" />
        <line x1="10" y1="17" x2="34" y2="17" strokeWidth={1.5} />
        <line x1="10" y1="27" x2="34" y2="27" strokeWidth={1.5} />
        <line x1="15" y1="12" x2="15" y2="17" stroke={brass} strokeWidth={2} strokeLinecap="round" />
        <line x1="19" y1="13" x2="19" y2="17" stroke={brass} strokeWidth={2} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 44 44" fill="none" className="h-11 w-auto" aria-hidden {...common}>
      <rect x="6" y="24" width="32" height="11" rx="1.5" />
      <line x1="22" y1="25" x2="22" y2="34" strokeWidth={1.5} />
      <line x1="10" y1="35" x2="8" y2="40" strokeLinecap="round" />
      <line x1="34" y1="35" x2="36" y2="40" strokeLinecap="round" />
      {/* ecranul plin, pe blat */}
      <rect x="12" y="7" width="20" height="13" rx="1" fill="currentColor" strokeWidth={1.5} />
      <line x1="22" y1="20" x2="22" y2="23" strokeWidth={1.5} />
      <line x1="17" y1="23" x2="27" y2="23" strokeWidth={1.75} strokeLinecap="round" />
    </svg>
  );
}

/* 1 — cererea: alegerile LIVE ale vizitatorului din configuratorul de sus */
function MomentRequest({ t }: { t: Tr }) {
  const piece = useDemoStore((s) => s.piece);
  const wide = useDemoStore((s) => s.wide);
  const material = useDemoStore((s) => s.material);
  const variant = useDemoStore((s) => s.variant);
  const cm = DEMO_PIECES[piece].widths[wide ? 1 : 0];

  const pieceLabel: Record<PieceKind, string> = {
    WARDROBE: t('demo.pieceWardrobe'),
    BOOKCASE: t('demo.pieceBookcase'),
    TV: t('demo.pieceTv'),
  };
  const matLabel = {
    WHITE: t('demo.matWhite'),
    WOOD: t('demo.matWood'),
    SAGE: t('demo.matSage'),
  }[material];
  const varLabel: Record<string, string> = {
    MANER: t('demo.openHandle'),
    PUSH: t('demo.openPush'),
    GLISANTE: t('demo.openSliding'),
    OPEN: t('demo.openShelves'),
    DOORS: t('demo.doorsBelow'),
  };

  const mat = MATERIAL_CARD[material];
  const varc = VARIANT_CARD[variant];

  const card = (content: React.ReactNode, label: string, key: string) => (
    <div
      key={key}
      className="relative w-24 rounded-lg border border-walnut bg-walnut-soft p-2 pt-3 shadow-[0_0_0_2px_hsl(var(--walnut)/0.14)]"
    >
      <span className="absolute left-1.5 top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full border-[1.5px] border-walnut bg-walnut">
        <Check className="h-2 w-2 text-background" strokeWidth={4} />
      </span>
      <span className="flex h-12 items-center justify-center text-walnut">{content}</span>
      <p className="mt-1.5 truncate text-center text-[10.5px] font-medium leading-tight">{label}</p>
    </div>
  );

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end gap-2.5">
        {card(<PieceMini piece={piece} />, pieceLabel[piece], 'piece')}
        {card(
          mat.img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mat.img} alt="" className="h-12 w-full object-contain" />
          ) : (
            <span className="h-8 w-12 rounded-md border border-ink/10 shadow-inner" style={{ background: mat.swatch }} />
          ),
          matLabel,
          'mat',
        )}
        {card(
          varc.img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={varc.img} alt="" className="h-12 w-full object-contain" />
          ) : (
            <svg viewBox="0 0 44 36" fill="none" className="h-10 w-auto" aria-hidden
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="4" y="3" width="36" height="30" rx="1.5" />
              <line x1="6" y1="13" x2="38" y2="13" />
              <line x1="6" y1="23" x2="38" y2="23" />
            </svg>
          ),
          varLabel[variant],
          'var',
        )}
        <span className="mb-1 rounded-full border border-brass/40 bg-brass/10 px-2 py-0.5 font-mono text-[10px] tabular-nums text-brass-2">
          {cm} cm
        </span>
      </div>
      {/* semnul ca statia e legata de configuratorul de sus */}
      <p className="mt-2.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
        <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-sage" />
        {t('m1Live')}
      </p>
    </div>
  );
}

/* 2 — sloturile de revendicare: bifele apar pe rand cand sectiunea intra in ecran */
function MomentClaim({ t, on }: { t: Tr; on: boolean }) {
  const house = (
    <svg viewBox="0 0 40 34" fill="none" className="h-6 w-7 shrink-0" aria-hidden
      stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 31V16l14-10 14 10v15z" />
      <path d="M29 9V5h3v6" strokeWidth="1.75" />
    </svg>
  );
  return (
    <div className="flex w-full flex-col gap-1.5">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-2.5 rounded-lg border border-border-2 bg-surface px-3 py-1.5 shadow-sm">
          {house}
          <span className="h-1.5 w-16 rounded-full bg-surface-2" />
          <span
            className={cn(
              'ml-auto flex items-center gap-1 text-[11px] font-medium text-sage transition-all duration-300',
              on ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
            )}
            style={{ transitionDelay: `${500 + i * 450}ms` }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
            {t('m2Taken')}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border-2 bg-surface-2/40 px-3 py-1.5">
        <span className="h-6 w-7" />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-2">{t('m2Free')}</span>
        <span className="ml-auto font-mono text-[10.5px] tabular-nums text-muted-2">2/3</span>
      </div>
    </div>
  );
}

/* 3 — oferta: sigiliul se "stampileaza" pe cea aleasa */
function MomentOffers({ t, on }: { t: Tr; on: boolean }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="relative rounded-lg border border-brass/60 bg-surface px-3.5 py-2.5 shadow-[0_0_0_2px_hsl(var(--brass)/0.15)]">
        <span
          className={cn(
            'absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-brass text-background shadow-sm transition-all duration-300 ease-out',
            on ? 'scale-100 opacity-100' : 'scale-[2.2] opacity-0',
          )}
          style={{ transitionDelay: '700ms' }}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <div className="flex flex-col gap-1.5">
          <span className="h-1.5 w-3/5 rounded-full bg-surface-2" />
          <span className="h-1.5 w-2/5 rounded-full bg-surface-2" />
        </div>
        <p className="mt-2 font-mono text-sm font-medium tabular-nums">13.900 lei</p>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-border-2 bg-surface px-3 py-1.5 shadow-sm">
        <MessageCircle className="h-3.5 w-3.5 shrink-0 text-walnut" />
        <span className="truncate text-[11px] text-muted-foreground">{t('m3Chat')}</span>
        <span className="ml-auto h-1.5 w-10 shrink-0 rounded-full bg-walnut/25" />
      </div>
    </div>
  );
}

/* 4 — montajul: bifa apare, stelele recenziei se umplu pe rand */
function MomentInstall({ t, on }: { t: Tr; on: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <svg viewBox="0 0 120 104" fill="none" className="h-24 w-auto" aria-hidden>
          <path d="M24 88V28l18-11h54v60l-18 11z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
          <path d="M24 28h54v60H24z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
          <path d="M78 28l18-11M78 88l18-11" stroke={ink} strokeWidth="2" strokeLinecap="round" />
          <path d="M51 28v60" stroke={ink} strokeWidth="1.5" />
          <path d="M46 54v9M56 54v9" stroke={brass} strokeWidth="2" strokeLinecap="round" />
          <path d="M16 28v60M13 28h6M13 88h6" stroke={brass} strokeWidth="1" />
        </svg>
        <span
          className={cn(
            'absolute -right-1.5 top-0 grid h-7 w-7 place-items-center rounded-full bg-brass text-background shadow-sm transition-all duration-300',
            on ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
          )}
          style={{ transitionDelay: '400ms' }}
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="flex gap-0.5 text-brass">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                'h-3.5 w-3.5 fill-current transition-all duration-200',
                on ? 'scale-100 opacity-100' : 'scale-75 opacity-20',
              )}
              style={{ transitionDelay: `${650 + i * 130}ms` }}
            />
          ))}
        </span>
        <span className="rounded-full border border-border-2 bg-surface px-2.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">
          {t('m4Review')}
        </span>
      </div>
    </div>
  );
}

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

  // micro-momentele ruleaza o singura data, cand mozaicul intra in viewport;
  // 'idle' (SSR / reduced-motion) arata direct starea finala, fara animatie
  const on = phase !== 'armed';

  const cells: {
    no: string;
    key: 'p1' | 'p2' | 'p3' | 'p4';
    span: string;
    moment: React.ReactNode;
  }[] = [
    { no: '1', key: 'p1', span: 'md:col-span-7', moment: <MomentRequest t={t} /> },
    { no: '2', key: 'p2', span: 'md:col-span-5', moment: <MomentClaim t={t} on={on} /> },
    { no: '3', key: 'p3', span: 'md:col-span-5', moment: <MomentOffers t={t} on={on} /> },
    { no: '4', key: 'p4', span: 'md:col-span-7', moment: <MomentInstall t={t} on={on} /> },
  ];

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
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3" data-reveal>
        <div>
          <span className="kicker">{t('processKicker')}</span>
          <h2 className="serif mt-2 text-3xl sm:text-4xl">{t('processTitle')}</h2>
        </div>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{t('processSub')}</p>
      </div>

      <div className="relative">
        <div className="grid gap-4 md:grid-cols-12">
          {cells.map(({ no, key, span, moment }, i) => (
            <div
              key={key}
              data-reveal
              style={rd(i * 140)}
              className={cn(
                'flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6',
                span,
              )}
            >
              <CellHeader no={no} phase={t(`${key}.phase`)} />
              <div className="flex min-h-[6.5rem] flex-1 items-center">{moment}</div>
              <div>
                <h3 className="font-serif text-[19px] leading-snug">{t(`${key}.title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`${key}.body`)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* firul de alama care leaga statiile — DEASUPRA celulelor, ca pe un
            panou de atelier: un traseu CONTINUU ancorat in numerele 1→2→3→4,
            prins cu ace de alama la capete; se deseneaza la intrarea in viewport */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M 4.5 9 C 18 15 40 3 61 8.5 C 80 13 97 15 96 27 C 95 41 55 39 30 45 C 12 49 2.5 47 3.5 58 C 4.5 66 24 64 45 57.5"
            stroke="hsl(var(--brass) / 0.45)"
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            data-draw
            style={d(300)}
          />
        </svg>
        <span
          aria-hidden
          data-fade
          style={{ ...d(400), left: '4.5%', top: '9%' }}
          className="absolute hidden h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-brass md:block"
        />
        <span
          aria-hidden
          data-fade
          style={{ ...d(1500), left: '45%', top: '57.5%' }}
          className="absolute hidden h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-brass md:block"
        />
      </div>
    </section>
  );
}
