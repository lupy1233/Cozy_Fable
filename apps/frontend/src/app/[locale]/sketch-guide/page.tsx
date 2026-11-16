'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PublicShell } from '../_components/public-shell';

// Pagina publica "cum faci o schita" — in limbajul ATELIER: o plansa-exemplu
// (planul unei bucatarii vazut de sus, ca in pasul II al ghidului) care se
// traseaza singura in patru acte, ca un GIF in bucla: camera cu fereastra,
// usa si priza -> cotele camerei -> mobilierul de-a lungul peretilor ->
// dimensiunile mobilierului, notate pe desen.

// Ghidul se deseneaza mai lent decat schitele de pe landing (feedback PO):
// delay-urile sunt intinse cu SLOW, iar durata trasarii vine din .plan-draw--slow.
const SLOW = 1.7;
const d = (ms: number) => ({ '--d': ms * SLOW }) as CSSProperties;

type PlanLabels = { window: string; door: string; socket: string; topView: string };

/**
 * Planul camerei vazut de sus (design 2026-11), animat in patru acte:
 * (1) peretii, fereastra (linie dubla), usa cu sensul de deschidere si
 * priza marcata cu ✕; (2) cotele camerei (3400 × 2800); (3) mobilierul in
 * L, de-a lungul peretilor; (4) dimensiunile mobilierului (2900 × 2300),
 * notate direct pe desen. Ordinea din DOM e ordinea straturilor (peretii
 * stau peste mobilier), ordinea de aparitie vine din delay-uri.
 * Bucla se reia prin remount (key) la fiecare 13s, sarita la
 * prefers-reduced-motion.
 */
function KitchenPlanExample({ label, labels }: { label: string; labels: PlanLabels }) {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setCycle((c) => c + 1), 13000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <svg
      key={cycle}
      viewBox="0 0 520 420"
      className="plan-draw plan-draw--slow block h-auto w-full"
      role="img"
      aria-label={label}
      fill="none"
    >
      {/* ACTUL 2 — cotele camerei: latime 3400 deasupra, adancime 2800 in stanga */}
      <line x1="70" y1="30" x2="70" y2="42" className="stroke-brass" strokeWidth="1.2" pathLength={1} data-draw style={d(1650)} />
      <line x1="450" y1="30" x2="450" y2="42" className="stroke-brass" strokeWidth="1.2" pathLength={1} data-draw style={d(1650)} />
      <line x1="70" y1="36" x2="450" y2="36" className="stroke-brass" strokeWidth="1.2" pathLength={1} data-draw style={d(1750)} />
      <text x="260" y="26" textAnchor="middle" fontSize="14" className="fill-brass font-mono" data-fade style={d(2000)}>
        3400
      </text>
      <line x1="38" y1="60" x2="50" y2="60" className="stroke-brass" strokeWidth="1.2" pathLength={1} data-draw style={d(1650)} />
      <line x1="38" y1="360" x2="50" y2="360" className="stroke-brass" strokeWidth="1.2" pathLength={1} data-draw style={d(1650)} />
      <line x1="44" y1="60" x2="44" y2="360" className="stroke-brass" strokeWidth="1.2" pathLength={1} data-draw style={d(1750)} />
      <text
        x="32"
        y="214"
        textAnchor="middle"
        fontSize="14"
        className="fill-brass font-mono"
        transform="rotate(-90 32 214)"
        data-fade
        style={d(2000)}
      >
        2800
      </text>

      {/* ACTUL 3 — mobilierul in L, de-a lungul peretelui de sus si al celui din dreapta */}
      <path d="M130 62H448V308H392V118H130Z" className="fill-walnut-soft" data-fade style={d(3000)} />
      <path
        d="M130 62H448V308H392V118H130Z"
        className="stroke-walnut"
        strokeWidth="1.5"
        strokeLinejoin="round"
        pathLength={1}
        data-draw
        style={d(2500)}
      />
      {/* ACTUL 4 — dimensiunile mobilierului, notate direct pe desen */}
      <text x="261" y="96" textAnchor="middle" fontSize="14" className="fill-walnut-deep font-mono" data-fade style={d(3700)}>
        2900
      </text>
      <text
        x="424"
        y="216"
        textAnchor="middle"
        fontSize="14"
        className="fill-walnut-deep font-mono"
        transform="rotate(-90 424 216)"
        data-fade
        style={d(3850)}
      >
        2300
      </text>

      {/* ACTUL 1 — camera: peretii, masurati din colt in colt */}
      <rect x="70" y="60" width="380" height="300" className="stroke-foreground" strokeWidth="2.2" pathLength={1} data-draw style={d(0)} />
      {/* fereastra — linie dubla pe peretele de sus */}
      <rect x="200" y="56" width="120" height="8" className="fill-surface stroke-foreground" strokeWidth="1.4" data-fade style={d(700)} />
      {/* usa: golul din perete, foaia usii si arcul de deschidere */}
      <line x1="104" y1="360" x2="176" y2="360" className="stroke-surface-2" strokeWidth="5" data-fade style={d(850)} />
      <line x1="104" y1="360" x2="104" y2="288" className="stroke-foreground" strokeWidth="1.6" pathLength={1} data-draw style={d(900)} />
      <path d="M104 288A72 72 0 0 1 176 360" className="stroke-foreground" strokeWidth="1" strokeDasharray="4 4" data-fade style={d(1000)} />
      {/* priza marcata cu ✕ pe peretele din dreapta */}
      <line x1="443" y1="333" x2="457" y2="347" className="stroke-foreground" strokeWidth="1.8" strokeLinecap="round" pathLength={1} data-draw style={d(1150)} />
      <line x1="457" y1="333" x2="443" y2="347" className="stroke-foreground" strokeWidth="1.8" strokeLinecap="round" pathLength={1} data-draw style={d(1200)} />
      {/* etichetele */}
      <text x="260" y="51" textAnchor="middle" fontSize="12" className="fill-muted-foreground font-sans" data-fade style={d(1350)}>
        {labels.window}
      </text>
      <text x="140" y="340" textAnchor="middle" fontSize="12" className="fill-muted-foreground font-sans" data-fade style={d(1350)}>
        {labels.door}
      </text>
      <text x="422" y="344" textAnchor="middle" fontSize="12" className="fill-muted-foreground font-sans" data-fade style={d(1350)}>
        {labels.socket}
      </text>
      <text x="230" y="230" textAnchor="middle" fontSize="13" className="fill-muted-foreground font-sans" data-fade style={d(1350)}>
        {labels.topView}
      </text>
    </svg>
  );
}

const STEP_KEYS = ['measure', 'draw', 'mark', 'photo'] as const;
const ROMAN = ['I', 'II', 'III', 'IV'] as const;

export default function SketchGuidePage() {
  const t = useTranslations('SketchGuidePage');
  const tn = useTranslations('Nav');

  const legend = [t('legendWall'), t('legendSocket'), t('legendFurniture'), t('legendDimensions')];

  return (
    <PublicShell>
      <div className="flex flex-col gap-12 pt-2 lg:pt-6">
        <header className="flex flex-col gap-3.5">
          <span className="kicker">{t('kicker')}</span>
          <h1 className="page-title">{t('title')}</h1>
          <p className="max-w-[640px] text-base leading-relaxed text-muted-foreground">{t('subtitle')}</p>
        </header>

        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          {/* plansa exemplu — card cu rama de alama, placuta si legenda */}
          <figure className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow sm:p-5">
            <div className="border border-brass bg-surface-2 p-2 sm:p-3">
              <KitchenPlanExample
                label={t('sheetAlt')}
                labels={{
                  window: t('plan.window'),
                  door: t('plan.door'),
                  socket: t('plan.socket'),
                  topView: t('plan.topView'),
                }}
              />
            </div>
            <figcaption className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-muted-foreground">
                <span>{t('sheetTitle')}</span>
                <span aria-hidden className="text-brass">
                  ◆ № 0002
                </span>
              </div>
              <ul className="flex flex-col gap-2 border-t border-dashed border-border-2 pt-4 text-sm">
                {legend.map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <span aria-hidden className="text-brass">
                      —
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </figcaption>
          </figure>

          {/* pasii: patru acte numerotate, despartite de hairline-uri */}
          <ol className="flex min-w-0 flex-col gap-7">
            {STEP_KEYS.map((key, i) => (
              <li key={key} className="flex gap-5">
                <span aria-hidden className="w-11 shrink-0 font-serif text-3xl leading-tight text-brass">
                  {ROMAN[i]}
                </span>
                <div
                  className={cn(
                    'flex min-w-0 flex-1 flex-col gap-2',
                    i < STEP_KEYS.length - 1 && 'border-b border-border-2 pb-7',
                  )}
                >
                  <h2 className="font-serif text-xl leading-tight sm:text-2xl">{t(`steps.${key}.title`)}</h2>
                  <p className="text-lead text-ink-2">{t(`steps.${key}.body`)}</p>
                  <p className="flex items-baseline gap-2 text-sm text-muted-foreground">
                    <span aria-hidden className="text-brass">
                      —
                    </span>
                    {t(`steps.${key}.tip`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* banda CTA — espresso, cu actiunea principala a paginii */}
        <section className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5 rounded-xl bg-foreground px-6 py-9 text-background sm:px-10">
          <div className="flex flex-col gap-2">
            <h2 className="font-serif text-3xl leading-tight">{t('ctaTitle')}</h2>
            <p className="max-w-[560px] text-sm text-background/75">{t('ctaHint')}</p>
          </div>
          <Button asChild variant="walnut" size="xl">
            <Link href="/requests/new">{tn('createRequest')}</Link>
          </Button>
        </section>
      </div>
    </PublicShell>
  );
}
