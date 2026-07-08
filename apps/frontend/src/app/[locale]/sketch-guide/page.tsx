'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { PublicShell } from '../_components/public-shell';

// Pagina publica "cum faci o schita" — redesenata in limbajul ATELIER:
// o plansa-exemplu (perete simplu in perspectiva) care se traseaza singura
// in patru acte, ca un GIF in bucla: peretele -> cotele lui -> bucataria
// desenata peste (in stilul dulapului de pe landing) -> cotele bucatariei.

// Ghidul se deseneaza mai lent decat schitele de pe landing (feedback PO):
// delay-urile sunt intinse cu SLOW, iar durata trasarii vine din .plan-draw--slow.
const SLOW = 1.7;
const d = (ms: number) => ({ '--d': ms * SLOW }) as CSSProperties;

const ink = 'hsl(var(--foreground))';
const brass = 'hsl(var(--brass))';
const hidden = 'hsl(var(--muted-2))';

/**
 * Camera vazuta de sus (punct de fuga ridicat la (240,118) — ochi la
 * ~2,3m), animata in patru acte, ca un GIF: (1) peretele si podeaua se
 * traseaza; (2) apar cotele peretelui (3400 × 2800); (3) bucataria se
 * deseneaza in 3D peste perete, in stilul dulapului de pe landing —
 * blatul cu suprafata vizibila de sus, corpuri de baza iesite din
 * perete (~600 adancime, punctele frontale scalate cu 1.16 fata de
 * punctul de fuga), corpuri suspendate (~350, factor 1.09), hota cu
 * volum; (4) cotele bucatariei (2900 × 2300) se noteaza peste desen.
 * Bucla se reia prin remount (key) la fiecare 13s, sarita la
 * prefers-reduced-motion.
 */
function KitchenSketchExample({ label }: { label: string }) {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setCycle((c) => c + 1), 13000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <svg
      key={cycle}
      viewBox="0 0 460 400"
      className="plan-draw plan-draw--slow h-auto w-full"
      role="img"
      aria-label={label}
      fill="none"
    >
      {/* ACTUL 1 — peretele simplu din spate */}
      <line x1="150" y1="96" x2="330" y2="96" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(0)} />
      <line x1="330" y1="96" x2="330" y2="236" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(180)} />
      <line x1="330" y1="236" x2="150" y2="236" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(360)} />
      <line x1="150" y1="236" x2="150" y2="96" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(520)} />
      {/* muchiile tavan/podea — orizont ridicat: tavan ingust, podea ampla */}
      <line x1="150" y1="96" x2="56" y2="73" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(660)} />
      <line x1="330" y1="96" x2="424" y2="73" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(740)} />
      <line x1="330" y1="236" x2="409" y2="340" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(820)} />
      <line x1="150" y1="236" x2="71" y2="340" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(900)} />
      {/* plinta — pe peretele din spate doar in dreapta bucatariei */}
      <line x1="310" y1="228" x2="330" y2="228" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(980)} />
      <line x1="150" y1="228" x2="75" y2="320" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(1010)} />
      <line x1="330" y1="228" x2="405" y2="320" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(1040)} />
      {/* parchetul: lamele pornesc de sub soclul viitoarei bucatarii */}
      <line x1="164" y1="256" x2="118" y2="340" stroke={hidden} strokeWidth="1" pathLength={1} data-draw style={d(1100)} />
      <line x1="199" y1="256" x2="174" y2="340" stroke={hidden} strokeWidth="1" pathLength={1} data-draw style={d(1140)} />
      <line x1="240" y1="256" x2="240" y2="340" stroke={hidden} strokeWidth="1" pathLength={1} data-draw style={d(1180)} />
      <line x1="281" y1="256" x2="306" y2="340" stroke={hidden} strokeWidth="1" pathLength={1} data-draw style={d(1220)} />
      <line x1="316" y1="256" x2="362" y2="340" stroke={hidden} strokeWidth="1" pathLength={1} data-draw style={d(1260)} />
      <path d="M89 316h42M162 260h36M192 280h48M240 268h45M294 300h46" stroke={hidden} strokeWidth="1" data-fade style={d(1340)} />
      {/* priza marcata cu ✕ — pe zona libera de perete */}
      <line x1="315" y1="170" x2="325" y2="180" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(1400)} />
      <line x1="325" y1="170" x2="315" y2="180" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(1430)} />
      {/* ACTUL 2 — cotele peretelui: latime 3400, deasupra */}
      <line x1="150" y1="90" x2="150" y2="66" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1650)} />
      <line x1="330" y1="90" x2="330" y2="66" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1650)} />
      <line x1="150" y1="72" x2="330" y2="72" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1750)} />
      <line x1="146" y1="76" x2="154" y2="68" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1850)} />
      <line x1="326" y1="76" x2="334" y2="68" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1850)} />
      <text x="240" y="63" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill={brass} data-fade style={d(2000)}>
        3400
      </text>
      {/* cota inaltime 2800 — pe marginea dreapta a peretelui */}
      <line x1="334" y1="96" x2="356" y2="96" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1650)} />
      <line x1="334" y1="236" x2="356" y2="236" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1650)} />
      <line x1="350" y1="96" x2="350" y2="236" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1750)} />
      <line x1="346" y1="100" x2="354" y2="92" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1850)} />
      <line x1="346" y1="240" x2="354" y2="232" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1850)} />
      <text x="364" y="166" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill={brass} transform="rotate(90 364 166)" data-fade style={d(2000)}>
        2800
      </text>
      {/* ACTUL 3 — bucataria, desenata in 3D peste perete (stil landing) */}
      {/* blatul: muchia de pe perete, laturile si suprafata vizibila de sus */}
      <line x1="154" y1="188" x2="310" y2="188" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(2500)} />
      <line x1="154" y1="188" x2="140" y2="199" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(2560)} />
      <line x1="310" y1="188" x2="321" y2="199" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(2560)} />
      <line x1="140" y1="199" x2="321" y2="199" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(2620)} />
      {/* cantul blatului — banda frontala */}
      <line x1="140" y1="203" x2="321" y2="203" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(2680)} />
      <line x1="140" y1="199" x2="140" y2="203" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(2680)} />
      <line x1="321" y1="199" x2="321" y2="203" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(2680)} />
      {/* fata corpurilor de baza, iesita spre privitor */}
      <line x1="140" y1="203" x2="140" y2="247" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(2740)} />
      <line x1="321" y1="203" x2="321" y2="247" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(2780)} />
      <line x1="140" y1="247" x2="321" y2="247" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(2820)} />
      <line x1="186" y1="203" x2="186" y2="247" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(2860)} />
      <line x1="231" y1="203" x2="231" y2="247" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(2890)} />
      <line x1="276" y1="203" x2="276" y2="247" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(2920)} />
      {/* soclul retras + sertarele primului corp */}
      <line x1="150" y1="247" x2="150" y2="253" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(2950)} />
      <line x1="311" y1="247" x2="311" y2="253" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(2950)} />
      <line x1="150" y1="253" x2="311" y2="253" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(2970)} />
      <line x1="144" y1="224" x2="182" y2="224" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(3000)} />
      {/* corpurile suspendate + hota intre ele */}
      <path d="M146 121h85v42h-85z" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(3040)} />
      <line x1="189" y1="121" x2="189" y2="163" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(3100)} />
      <line x1="154" y1="159" x2="146" y2="163" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(3130)} />
      <path d="M274 121h42v42h-42z" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(3160)} />
      <line x1="310" y1="159" x2="316" y2="163" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(3190)} />
      <path d="M236 148h31l3 4h-34z" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(3220)} />
      <path d="M236 152h34v12h-34z" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(3260)} />
      <line x1="242" y1="148" x2="247" y2="131" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(3300)} />
      <line x1="261" y1="148" x2="256" y2="131" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(3300)} />
      <line x1="247" y1="131" x2="256" y2="131" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(3330)} />
      {/* manerele — liniute scurte, ca la dulapul de pe landing */}
      <line x1="175" y1="156" x2="185" y2="156" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(3360)} />
      <line x1="192" y1="156" x2="203" y2="156" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(3375)} />
      <line x1="276" y1="156" x2="287" y2="156" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(3390)} />
      <line x1="219" y1="210" x2="228" y2="210" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(3405)} />
      <line x1="233" y1="210" x2="242" y2="210" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(3420)} />
      <line x1="310" y1="210" x2="319" y2="210" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(3435)} />
      <line x1="154" y1="213" x2="170" y2="213" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(3450)} />
      <line x1="154" y1="234" x2="170" y2="234" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(3465)} />
      {/* spalari discrete de ton, ca pe landing — volumul se citeste de sus */}
      <polygon points="154,188 310,188 321,199 140,199" fill="hsl(var(--foreground) / 0.06)" stroke="none" data-fade style={d(3480)} />
      <polygon points="140,199 321,199 321,203 140,203" fill="hsl(var(--foreground) / 0.08)" stroke="none" data-fade style={d(3520)} />
      <polygon points="140,203 321,203 321,247 140,247" fill="hsl(var(--foreground) / 0.05)" stroke="none" data-fade style={d(3480)} />
      <rect x="146" y="121" width="85" height="42" fill="hsl(var(--foreground) / 0.04)" stroke="none" data-fade style={d(3480)} />
      <rect x="274" y="121" width="42" height="42" fill="hsl(var(--foreground) / 0.04)" stroke="none" data-fade style={d(3480)} />
      <polygon points="236,148 267,148 270,152 236,152" fill="hsl(var(--foreground) / 0.06)" stroke="none" data-fade style={d(3520)} />
      {/* ACTUL 4 — cotele bucatariei, notate peste: latime 2900, sub muchia de sus */}
      <line x1="154" y1="117" x2="154" y2="104" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(3700)} />
      <line x1="310" y1="117" x2="310" y2="104" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(3700)} />
      <line x1="154" y1="110" x2="310" y2="110" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(3800)} />
      <line x1="150" y1="114" x2="158" y2="106" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(3900)} />
      <line x1="306" y1="114" x2="314" y2="106" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(3900)} />
      <text x="232" y="105" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill={brass} data-fade style={d(4050)}>
        2900
      </text>
      {/* cota inaltime bucatarie 2300 — pe stanga, dincolo de fata iesita in 3D */}
      <line x1="152" y1="121" x2="126" y2="121" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(3700)} />
      <line x1="152" y1="236" x2="126" y2="236" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(3700)} />
      <line x1="130" y1="121" x2="130" y2="236" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(3800)} />
      <line x1="126" y1="125" x2="134" y2="117" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(3900)} />
      <line x1="126" y1="240" x2="134" y2="232" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(3900)} />
      <text x="120" y="178" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill={brass} transform="rotate(90 120 178)" data-fade style={d(4050)}>
        2300
      </text>
    </svg>
  );
}

const STEP_KEYS = ['measure', 'draw', 'mark', 'photo'] as const;
const ROMAN = ['I', 'II', 'III', 'IV'] as const;

export default function SketchGuidePage() {
  const t = useTranslations('SketchGuidePage');

  const legend = [t('legendWall'), t('legendSocket'), t('legendFurniture'), t('legendDimensions')];

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <span className="kicker">{t('kicker')}</span>
          <h1 className="page-title mt-3">{t('title')}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-14">
          {/* plansa exemplu — rama + passe-partout + placuta, ca pe landing */}
          <div className="self-start lg:sticky lg:top-8">
            <div className="rounded-md border border-border bg-card p-3 shadow-lg">
              <div className="border border-brass/40 px-4 pb-1 pt-3">
                <KitchenSketchExample label={t('sheetTitle')} />
                <div className="mt-1 flex items-center justify-center gap-3 border-t border-brass/30 py-3">
                  <span className="label">{t('sheetTitle')}</span>
                  <span aria-hidden className="h-1 w-1 rotate-45 bg-brass/70" />
                  <span className="label">№ 0002</span>
                </div>
              </div>
            </div>
            <ul className="mt-4 flex flex-col gap-1.5">
              {legend.map((line) => (
                <li key={line} className="flex items-baseline gap-2 text-xs text-muted-foreground">
                  <span aria-hidden className="text-brass">—</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {/* pasii: patru acte numerotate, despartite de hairline-uri */}
          <ol className="self-start divide-y divide-border border-y border-border">
            {STEP_KEYS.map((key, i) => (
              <li key={key} className="flex gap-5 py-6 first:pt-5 last:pb-5">
                <span className="w-11 shrink-0 font-serif text-3xl leading-none text-brass">
                  {ROMAN[i]}.
                </span>
                <div>
                  <h2 className="font-serif text-[21px]">{t(`steps.${key}.title`)}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {t(`steps.${key}.body`)}
                  </p>
                  <p className="mt-2 flex items-baseline gap-2 text-[13px] text-muted-2">
                    <span aria-hidden className="text-brass">—</span>
                    {t(`steps.${key}.tip`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* banda CTA — espresso cu lumina de alama, ca pe landing */}
        <section className="relative mt-14 overflow-hidden rounded-xl bg-gradient-to-br from-foreground to-ink-2 px-8 py-12 text-background shadow-lg sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(540px 280px at 85% 10%, hsl(var(--brass) / 0.22), transparent 65%)',
            }}
          />
          <div className="relative flex flex-col items-start gap-3 sm:max-w-xl">
            <h2 className="serif text-2xl sm:text-3xl">{t('ctaTitle')}</h2>
            <p className="text-[15px] leading-relaxed text-background/75">{t('ctaHint')}</p>
            <Button
              asChild
              size="lg"
              className="mt-2 bg-background text-foreground hover:bg-background/90"
            >
              <Link href="/requests/new">{t('cta')}</Link>
            </Button>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
