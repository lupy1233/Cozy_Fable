'use client';

import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import { Check, MessageCircle, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// Piesa centrala a landing-ului v2 (PO 2026-07-31): povestea "cum functioneaza"
// spusa la scroll. Pe desktop scena ramane fixata (sticky) cat timp utilizatorul
// deruleaza prin cei patru pasi; textul si vizualul se schimba dupa progres.
// Pe mobil (si la prefers-reduced-motion pastram tranzitii instante) pasii sunt
// afisati clasic, unul sub altul — nimic nu depinde de JS ca sa fie lizibil.

type Tr = ReturnType<typeof useTranslations<'LandingV2'>>;

const SCENES = ['s1', 's2', 's3', 's4'] as const;
// cat scroll "consuma" fiecare scena pe desktop
const SCENE_VH = 105;

const ink = 'hsl(var(--foreground))';
const brass = 'hsl(var(--brass))';

/* Pasul 1 — cardurile de raspuns ale configuratorului, cu redarile foto reale */
function VisualCards({ t }: { t: Tr }) {
  const cards = [
    { img: '/illustrations/maner.png', label: t('s1.cardA'), selected: false },
    { img: '/illustrations/push.png', label: t('s1.cardB'), selected: true },
    { img: '/illustrations/glisante.png', label: t('s1.cardC'), selected: false },
  ];
  return (
    <div className="w-full max-w-md">
      <p className="text-center font-serif text-lg">{t('s1.cardQuestion')}</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={cn(
              'relative rounded-xl border bg-surface p-3 pt-4 shadow-sm',
              c.selected
                ? 'border-walnut bg-walnut-soft shadow-[0_0_0_3px_hsl(var(--walnut)/0.14)]'
                : 'border-border-2',
            )}
          >
            <span
              className={cn(
                'absolute left-2 top-2 grid h-4 w-4 place-items-center rounded-full border-[1.5px]',
                c.selected ? 'border-walnut bg-walnut' : 'border-border-2 bg-surface',
              )}
            >
              {c.selected && <Check className="h-2.5 w-2.5 text-background" strokeWidth={3.5} />}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.img} alt="" className="mx-auto h-16 w-full object-contain sm:h-20" />
            <p className="mt-2 text-center text-[11.5px] font-medium leading-tight">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* casuta de atelier (motivul de brand) — folosita in pasul 2 */
function WorkshopHouse({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 40" fill="none" className={className} aria-hidden>
      <path d="M7 37V19l17-12 17 12v18z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M19 37V26h10v11" stroke={ink} strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M33 12V7h4v8" stroke={ink} strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M35 5c-1.5-1.6 1.5-3 0-4.5" stroke={brass} strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

/* Pasul 2 — locurile de revendicare: doua ocupate, unul liber */
function VisualClaim({ t }: { t: Tr }) {
  return (
    <div className="w-full max-w-md">
      <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        2/3 {t('s2.slotsLabel')}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="relative rounded-xl border border-border-2 bg-surface p-4 shadow-sm"
          >
            <span className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-brass text-background shadow-sm">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <WorkshopHouse className="mx-auto h-16 w-auto" />
            <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-surface-2" />
          </div>
        ))}
        <div className="grid place-items-center rounded-xl border border-dashed border-border-2 bg-surface-2/40 p-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-2">
            {t('s2.slotFree')}
          </span>
        </div>
      </div>
    </div>
  );
}

/* Pasul 3 — doua oferte alaturi + chat; cea potrivita primeste sigiliul */
function VisualOffers(_: { t: Tr }) {
  return (
    <div className="w-full max-w-md">
      <div className="grid grid-cols-2 gap-4">
        {[
          { price: '12.400 lei', chosen: false },
          { price: '13.900 lei', chosen: true },
        ].map((o, i) => (
          <div
            key={i}
            className={cn(
              'relative rounded-xl border bg-surface p-4 shadow-sm',
              o.chosen ? 'border-brass/70 shadow-[0_0_0_3px_hsl(var(--brass)/0.15)]' : 'border-border-2',
            )}
          >
            {o.chosen && (
              <span className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-brass text-background shadow-sm">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
            )}
            <span className="font-serif text-lg text-muted-foreground">{i === 0 ? 'I.' : 'II.'}</span>
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="h-1.5 w-full rounded-full bg-surface-2" />
              <div className="h-1.5 w-4/5 rounded-full bg-surface-2" />
              <div className="h-1.5 w-3/5 rounded-full bg-surface-2" />
            </div>
            <p className="mt-3 font-mono text-sm font-medium tabular-nums">{o.price}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-full border border-border-2 bg-surface px-3.5 py-2 shadow-sm">
        <MessageCircle className="h-4 w-4 shrink-0 text-walnut" />
        <div className="h-1.5 w-2/5 rounded-full bg-surface-2" />
        <div className="ml-auto h-1.5 w-1/4 rounded-full bg-walnut/25" />
      </div>
    </div>
  );
}

/* Pasul 4 — dulapul montat (axonometrie) + sigiliul si recenzia */
function VisualDone(_: { t: Tr }) {
  return (
    <div className="w-full max-w-md">
      <div className="relative mx-auto w-fit">
        <svg viewBox="0 0 150 130" fill="none" className="h-48 w-auto sm:h-56" aria-hidden>
          {/* corpul in axonometrie */}
          <path d="M30 34l24-14h60v78l-24 14H30z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
          <path d="M30 34h60v78H30z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
          <path d="M90 34l24-14M90 112l24-14" stroke={ink} strokeWidth="2" strokeLinecap="round" />
          {/* usile + manerele */}
          <path d="M60 34v78" stroke={ink} strokeWidth="1.5" />
          <path d="M54 68v10M66 68v10" stroke={brass} strokeWidth="2" strokeLinecap="round" />
          {/* linia de cota, semn ca e facut pe masurile clientului */}
          <path d="M22 34v78" stroke={brass} strokeWidth="1" />
          <path d="M19 34h6M19 112h6" stroke={brass} strokeWidth="1" />
        </svg>
        <span className="absolute -right-2 top-1 grid h-9 w-9 place-items-center rounded-full bg-brass text-background shadow-md">
          <Check className="h-5 w-5" strokeWidth={3} />
        </span>
      </div>
      <div className="mt-3 flex items-center justify-center gap-1 text-brass">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-current" />
        ))}
      </div>
    </div>
  );
}

const VISUALS = [VisualCards, VisualClaim, VisualOffers, VisualDone] as const;

function SceneVisual({ scene, t }: { scene: number; t: Tr }) {
  const V = VISUALS[scene];
  return <V t={t} />;
}

export function ScrollStory() {
  const t = useTranslations('LandingV2');
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [active, setActive] = useState(0);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setActive(Math.max(0, Math.min(SCENES.length - 1, Math.floor(v * SCENES.length))));
  });
  const fill = useTransform(scrollYProgress, (v) => `${Math.round(v * 1000) / 10}%`);

  // saritura pe pas la click (mijlocul ferestrei lui de scroll)
  const jumpTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({
      top: top + (span * (i + 0.5)) / SCENES.length,
      behavior: reduce ? 'auto' : 'smooth',
    });
  };

  const header = (
    <div className="mx-auto max-w-2xl text-center">
      <span className="kicker">{t('storyKicker')}</span>
      <h2 className="serif mt-2 text-3xl sm:text-4xl">{t('storyTitle')}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        {t('storySub')}
      </p>
    </div>
  );

  return (
    <section id="cum-functioneaza" className="scroll-mt-20 py-14">
      {header}

      {/* ------ desktop: scena sticky, patru "ecrane" de scroll ------ */}
      <div
        ref={ref}
        className="relative mt-4 hidden lg:block"
        style={{ height: `${SCENES.length * SCENE_VH}vh` }}
      >
        <div className="sticky top-0 flex h-screen items-center">
          <div className="grid w-full items-center gap-14 lg:grid-cols-[0.95fr_1.05fr]">
            {/* stanga: pasii + progresul (firul de alama se umple cu scrollul) */}
            <div className="relative pl-12">
              <div aria-hidden className="absolute bottom-2 left-[18px] top-2 w-px bg-border">
                <motion.div className="w-px origin-top bg-brass" style={{ height: fill }} />
              </div>
              <ol className="flex flex-col gap-6">
                {SCENES.map((key, i) => {
                  const isActive = i === active;
                  return (
                    <li key={key} className="relative">
                      <button
                        type="button"
                        onClick={() => jumpTo(i)}
                        className="group flex w-full items-start gap-4 text-left"
                      >
                        <span
                          className={cn(
                            'absolute -left-12 mt-0.5 grid h-9 w-9 place-items-center rounded-full border font-mono text-[11px] transition-colors duration-300',
                            i <= active
                              ? 'border-brass bg-brass text-background'
                              : 'border-border-2 bg-surface text-muted-foreground group-hover:border-muted-2',
                          )}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0">
                          <span className="label">{t(`${key}.phase`)}</span>
                          <span
                            className={cn(
                              'mt-0.5 block font-serif text-[22px] leading-snug transition-opacity duration-300',
                              isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-70',
                            )}
                          >
                            {t(`${key}.title`)}
                          </span>
                        </span>
                      </button>
                      <motion.div
                        initial={false}
                        animate={{
                          height: isActive ? 'auto' : 0,
                          opacity: isActive ? 1 : 0,
                        }}
                        transition={{ duration: reduce ? 0 : 0.3, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-md pt-2 text-sm leading-relaxed text-muted-foreground">
                          {t(`${key}.body`)}
                        </p>
                      </motion.div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* dreapta: plansa cu vizualul scenei active (crossfade) */}
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute -left-1.5 -top-1.5 h-3 w-3 border-l border-t border-ink/30" />
              <span aria-hidden className="pointer-events-none absolute -right-1.5 -top-1.5 h-3 w-3 border-r border-t border-ink/30" />
              <span aria-hidden className="pointer-events-none absolute -bottom-1.5 -left-1.5 h-3 w-3 border-b border-l border-ink/30" />
              <span aria-hidden className="pointer-events-none absolute -bottom-1.5 -right-1.5 h-3 w-3 border-b border-r border-ink/30" />
              <div className="relative min-h-[26rem] overflow-hidden border border-ink/15 bg-surface shadow-sm">
                {SCENES.map((key, i) => (
                  <motion.div
                    key={key}
                    initial={false}
                    animate={{
                      opacity: i === active ? 1 : 0,
                      y: reduce || i === active ? 0 : 20,
                    }}
                    transition={{ duration: reduce ? 0 : 0.35, ease: 'easeOut' }}
                    className={cn(
                      'absolute inset-0 flex items-center justify-center p-8',
                      i !== active && 'pointer-events-none',
                    )}
                  >
                    <SceneVisual scene={i} t={t} />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------ mobil/tableta: pasii clasic, unul sub altul ------ */}
      <div className="mt-10 flex flex-col gap-10 lg:hidden">
        {SCENES.map((key, i) => (
          <div key={key}>
            <div className="mb-3 flex items-baseline gap-3">
              <span className="font-serif text-3xl text-brass">{String(i + 1).padStart(2, '0')}</span>
              <span className="label tracking-[0.14em]">{t(`${key}.phase`)}</span>
            </div>
            <h3 className="font-serif text-[22px]">{t(`${key}.title`)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`${key}.body`)}</p>
            <div className="mt-4 flex items-center justify-center rounded-xl border border-ink/15 bg-surface p-6 shadow-sm">
              <SceneVisual scene={i} t={t} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
