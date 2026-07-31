'use client';

import { Check, MessageCircle, Star } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// Drumul cererii ca mozaic (PO r10: patru coloane identice = monoton):
// patru celule inegale, fiecare cu un MOMENT concret de produs — cardurile de
// raspuns reale, sloturile de revendicare, oferta cu sigiliu + chat, mobila
// montata cu recenzia. Reveal in cascada la intrarea in viewport
// (data-reveal din globals), fara pinning.

const rd = (ms: number) => ({ '--rd': ms }) as CSSProperties;

const ink = 'hsl(var(--foreground))';
const brass = 'hsl(var(--brass))';

function CellHeader({ no, phase }: { no: string; phase: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="font-serif text-3xl leading-none text-brass">{no}</span>
      <span className="label tracking-[0.14em]">{phase}</span>
    </div>
  );
}

/* 1 — cardurile de raspuns reale, cu redarile foto din chestionar */
function MomentRequest({ t }: { t: ReturnType<typeof useTranslations<'LandingV2'>> }) {
  const cards = [
    { img: '/illustrations/mdf-furnir.png', label: t('demo.matWood') },
    { img: '/illustrations/maner.png', label: t('demo.openHandle'), selected: true },
    { img: '/illustrations/glisante.png', label: t('demo.openSliding') },
  ];
  return (
    <div className="flex items-end gap-2.5">
      {cards.map((c) => (
        <div
          key={c.label}
          className={cn(
            'relative w-24 rounded-lg border bg-surface p-2 pt-3 shadow-sm',
            c.selected ? 'border-walnut bg-walnut-soft shadow-[0_0_0_2px_hsl(var(--walnut)/0.14)]' : 'border-border-2',
          )}
        >
          <span
            className={cn(
              'absolute left-1.5 top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full border-[1.5px]',
              c.selected ? 'border-walnut bg-walnut' : 'border-border-2 bg-surface',
            )}
          >
            {c.selected && <Check className="h-2 w-2 text-background" strokeWidth={4} />}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.img} alt="" className="mx-auto h-12 w-full object-contain" />
          <p className="mt-1.5 truncate text-center text-[10.5px] font-medium leading-tight">{c.label}</p>
        </div>
      ))}
      <span className="mb-1 hidden rounded-full border border-brass/40 bg-brass/10 px-2 py-0.5 font-mono text-[10px] tabular-nums text-brass-2 sm:inline">
        240 cm
      </span>
    </div>
  );
}

/* 2 — sloturile de revendicare: doua ocupate, unul liber */
function MomentClaim({ t }: { t: ReturnType<typeof useTranslations<'LandingV2'>> }) {
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
          <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-sage">
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

/* 3 — oferta cu sigiliu + chat direct */
function MomentOffers({ t }: { t: ReturnType<typeof useTranslations<'LandingV2'>> }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="relative rounded-lg border border-brass/60 bg-surface px-3.5 py-2.5 shadow-[0_0_0_2px_hsl(var(--brass)/0.15)]">
        <span className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-brass text-background shadow-sm">
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

/* 4 — mobila montata + recenzia publica */
function MomentInstall({ t }: { t: ReturnType<typeof useTranslations<'LandingV2'>> }) {
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
        <span className="absolute -right-1.5 top-0 grid h-7 w-7 place-items-center rounded-full bg-brass text-background shadow-sm">
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="flex gap-0.5 text-brass">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-current" />
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

  const cells = [
    { no: '1', key: 'p1' as const, span: 'md:col-span-7', Moment: MomentRequest },
    { no: '2', key: 'p2' as const, span: 'md:col-span-5', Moment: MomentClaim },
    { no: '3', key: 'p3' as const, span: 'md:col-span-5', Moment: MomentOffers },
    { no: '4', key: 'p4' as const, span: 'md:col-span-7', Moment: MomentInstall },
  ];

  return (
    <section
      id="proces"
      ref={ref}
      className={cn(
        'scroll-mt-20 py-12',
        phase !== 'idle' && 'reveal-armed',
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

      <div className="grid gap-4 md:grid-cols-12">
        {cells.map(({ no, key, span, Moment }, i) => (
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
            <div className="flex min-h-[6.5rem] flex-1 items-center">
              <Moment t={t} />
            </div>
            <div>
              <h3 className="font-serif text-[19px] leading-snug">{t(`${key}.title`)}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`${key}.body`)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
