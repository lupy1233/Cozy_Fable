import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { CozyHomeLogo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { INSPIRATION_PINS, LANDING_PIN_IDS } from '@/lib/inspiration';
import { cn } from '@/lib/utils';
import { PartnersCarousel } from './_components/partners-carousel';
import { ProcessSection } from './_components/process-section';
import { MobileNav } from './_components/mobile-nav';

// Landing "ATELIER" — Cozy Home: ton premium cald. Piesa centrala —
// schita 3D (axonometrie) a unui dulap care se traseaza singura,
// inramata ca o lucrare de galerie, cu cote in alama. Sub ea: galeria
// de inspiratie (Pinterest) si caruselul atelierelor partenere.

// ritmul masonry: inaltimi variate, ciclice
const PIN_ASPECTS = ['aspect-[3/4]', 'aspect-square', 'aspect-[4/5]'] as const;

/** Stil cu delay de trasare pentru elementele SVG animate. */
const d = (ms: number) => ({ '--d': ms }) as CSSProperties;

/** Separator de alama intre elemente de legenda. */
function BrassDot() {
  return <span aria-hidden className="h-1 w-1 rotate-45 bg-brass/70" />;
}

/**
 * Axonometrie de dulap (oblica de cabinet: fata dreapta, adancimea la
 * ~30° spre dreapta-sus), cote in alama — se deseneaza la incarcare.
 * Fata: 2500 × 2200 (scara 0.1 px/mm), adancime 600 pe muchia oblica.
 */
function WardrobeAxonometric({ label }: { label: string }) {
  const ink = 'hsl(var(--foreground))';
  const brass = 'hsl(var(--brass))';
  const hidden = 'hsl(var(--muted-2))';
  // fata: (90,110)-(340,330); vectorul de adancime: (+44,-26)
  return (
    <svg
      viewBox="0 0 440 400"
      className="plan-draw h-auto w-full"
      role="img"
      aria-label={label}
      fill="none"
    >
      {/* volumele laterale — spalare discreta de ton, dau adancime */}
      <polygon points="90,110 340,110 384,84 134,84" fill="hsl(var(--foreground) / 0.04)" stroke="none" data-fade style={d(700)} />
      <polygon points="340,110 384,84 384,304 340,330" fill="hsl(var(--foreground) / 0.07)" stroke="none" data-fade style={d(760)} />
      {/* fata dulapului */}
      <rect x="90" y="110" width="250" height="220" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(0)} />
      {/* muchiile de adancime si spatele */}
      <line x1="90" y1="110" x2="134" y2="84" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(300)} />
      <line x1="340" y1="110" x2="384" y2="84" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(350)} />
      <line x1="134" y1="84" x2="384" y2="84" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(450)} />
      <line x1="384" y1="84" x2="384" y2="304" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(520)} />
      <line x1="340" y1="330" x2="384" y2="304" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(560)} />
      {/* impartirea fetei: mezanin + doua usi */}
      <line x1="90" y1="158" x2="340" y2="158" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(620)} />
      <line x1="215" y1="110" x2="215" y2="158" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(680)} />
      <line x1="215" y1="158" x2="215" y2="330" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(720)} />
      {/* manere */}
      <line x1="207" y1="205" x2="207" y2="227" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(800)} />
      <line x1="223" y1="205" x2="223" y2="227" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(830)} />
      <line x1="196" y1="146" x2="208" y2="146" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(860)} />
      <line x1="222" y1="146" x2="234" y2="146" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(880)} />
      {/* soclu */}
      <line x1="102" y1="330" x2="102" y2="342" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(920)} />
      <line x1="328" y1="330" x2="328" y2="342" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(940)} />
      <line x1="102" y1="342" x2="328" y2="342" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(960)} />
      {/* muchii ascunse: polite (stanga) si bara de umerase (dreapta) */}
      <line x1="98" y1="190" x2="208" y2="190" stroke={hidden} strokeWidth="1" strokeDasharray="5 4" data-fade style={d(1350)} />
      <line x1="98" y1="225" x2="208" y2="225" stroke={hidden} strokeWidth="1" strokeDasharray="5 4" data-fade style={d(1410)} />
      <line x1="98" y1="260" x2="208" y2="260" stroke={hidden} strokeWidth="1" strokeDasharray="5 4" data-fade style={d(1470)} />
      <line x1="222" y1="185" x2="332" y2="185" stroke={hidden} strokeWidth="1" strokeDasharray="5 4" data-fade style={d(1530)} />
      {/* cota latime 2500 — sub muchia din fata */}
      <line x1="90" y1="336" x2="90" y2="360" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1000)} />
      <line x1="340" y1="336" x2="340" y2="360" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1000)} />
      <line x1="90" y1="354" x2="340" y2="354" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1060)} />
      <line x1="86" y1="358" x2="94" y2="350" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1130)} />
      <line x1="336" y1="358" x2="344" y2="350" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1130)} />
      <text x="215" y="374" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill={brass} data-fade style={d(1250)}>
        2500
      </text>
      {/* cota inaltime 2200 — pe muchia din stanga */}
      <line x1="84" y1="110" x2="58" y2="110" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1000)} />
      <line x1="84" y1="330" x2="58" y2="330" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1000)} />
      <line x1="64" y1="110" x2="64" y2="330" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1060)} />
      <line x1="60" y1="114" x2="68" y2="106" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1130)} />
      <line x1="60" y1="334" x2="68" y2="326" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1130)} />
      <text x="50" y="220" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill={brass} transform="rotate(-90 50 220)" data-fade style={d(1250)}>
        2200
      </text>
      {/* cota adancime 600 — paralela cu muchia oblica de jos-dreapta */}
      <line x1="343" y1="335" x2="353" y2="352" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1000)} />
      <line x1="387" y1="309" x2="397" y2="326" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1000)} />
      <line x1="350" y1="347" x2="394" y2="321" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1060)} />
      <line x1="346" y1="351" x2="354" y2="343" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1130)} />
      <line x1="390" y1="325" x2="398" y2="317" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1130)} />
      <text x="381" y="348" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill={brass} transform="rotate(-30.6 381 348)" data-fade style={d(1250)}>
        600
      </text>
    </svg>
  );
}

export default function LandingPage() {
  const t = useTranslations('Landing');
  const tn = useTranslations('Nav');
  const ti = useTranslations('Inspiration');

  const landingPins = LANDING_PIN_IDS.map(
    (id) => INSPIRATION_PINS.find((p) => p.id === id)!,
  ).filter(Boolean);

  const metrics = [
    { value: t('metricWorkshops'), label: t('metricWorkshopsLabel') },
    { value: t('metricProjects'), label: t('metricProjectsLabel') },
    { value: t('metricSatisfaction'), label: t('metricSatisfactionLabel') },
  ];

  const publicLinks = [
    { href: '/partners', label: tn('partners') },
    { href: '/inspiration', label: tn('inspiration') },
    { href: '/sketch-guide', label: tn('sketchGuide') },
  ] as const;

  return (
    <div className="min-h-screen">
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/">
            <CozyHomeLogo />
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            {publicLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">{tn('login')}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">{tn('register')}</Link>
          </Button>
          <MobileNav
            className="sm:hidden"
            links={publicLinks}
            footer={
              <Link
                href="/login"
                className="block rounded-md px-3 py-2.5 text-[15px] text-foreground transition-colors hover:bg-secondary"
              >
                {tn('login')}
              </Link>
            }
          />
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero: text + schita inramata ca o lucrare de galerie */}
        <section className="py-14 lg:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="flex flex-col items-start gap-5">
              <span className="kicker">{t('kicker')}</span>
              <h1 className="page-title max-w-xl">{t('title')}</h1>
              <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                {t('subtitle')}
              </p>
              <div className="mt-1 flex flex-wrap gap-3">
                <Button asChild variant="walnut" size="lg">
                  <Link href="/requests/new">{t('ctaNewRequest')}</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/register?role=company">{t('ctaCompanies')}</Link>
                </Button>
              </div>
              <p className="label mt-1">{t('heroNote')}</p>
            </div>

            {/* rama + passe-partout + placuta de alama */}
            <div className="rounded-md border border-border bg-card p-3 shadow-lg">
              <div className="border border-brass/40 px-4 pb-1 pt-3">
                <WardrobeAxonometric label={t('heroSheetTitle')} />
                <div className="mt-1 flex items-center justify-center gap-3 border-t border-brass/30 py-3">
                  <span className="label">{t('heroSheetTitle')}</span>
                  <BrassDot />
                  <span className="label">№ 0001</span>
                </div>
              </div>
            </div>
          </div>

          {/* metrice pe hairline, ca o legenda de galerie */}
          <div className="mt-16 grid grid-cols-3 divide-x divide-border border-y border-border">
            {metrics.map((m) => (
              <div key={m.label} className="px-4 py-5 sm:px-8">
                <div className="font-serif text-2xl sm:text-[34px] sm:leading-tight">{m.value}</div>
                <div className="label mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Inspiratie: galerie masonry — imaginile duc la galeria completa */}
        <section className="py-14">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="kicker">{t('inspirationKicker')}</span>
              <h2 className="serif mt-2 text-3xl sm:text-4xl">{t('inspirationTitle')}</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t('inspirationSub')}</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/inspiration">{t('inspirationCta')}</Link>
            </Button>
          </div>
          <div className="columns-2 gap-4 md:columns-4">
            {landingPins.map((pin, i) => (
              <Link
                key={pin.id}
                href={`/inspiration?type=${pin.type}`}
                className="group relative mb-4 block break-inside-avoid overflow-hidden rounded-lg border border-border bg-surface-2 shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pin.img}
                  alt={ti(`pins.${pin.id}`)}
                  loading="lazy"
                  className={cn(
                    'w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]',
                    PIN_ASPECTS[i % PIN_ASPECTS.length],
                  )}
                />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-10 text-[13px] leading-snug text-white">
                  {ti(`pins.${pin.id}`)}
                  <span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] text-white/70">
                    {ti(`types.${pin.type}`)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Proces: trei acte animate la scroll (fir de alama + vignete) */}
        <ProcessSection />

        {/* Atelierele partenere: carusel cu rating si specializare */}
        <PartnersCarousel />

        {/* Banda ateliere: espresso cu lumina calda de alama */}
        <section className="relative my-16 overflow-hidden rounded-xl bg-gradient-to-br from-foreground to-ink-2 px-8 py-14 text-background shadow-lg sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(640px 320px at 85% 15%, hsl(var(--brass) / 0.22), transparent 65%)',
            }}
          />
          <div className="relative flex flex-col items-start gap-4 sm:max-w-2xl">
            <span className="kicker text-brass-2">
              {t('metricWorkshops')} {t('metricWorkshopsLabel')}
            </span>
            <h2 className="serif text-3xl sm:text-4xl">{t('ctaBandTitle')}</h2>
            <p className="text-[15px] leading-relaxed text-background/75">{t('ctaBandBody')}</p>
            <Button
              asChild
              size="lg"
              className="mt-2 bg-background text-foreground hover:bg-background/90"
            >
              <Link href="/register?role=company">{t('ctaBandButton')}</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="label">© 2026 Cozy Home — {t('footerTagline')}</span>
          <nav className="flex gap-6">
            {publicLinks.map((l) => (
              <Link key={l.href} href={l.href} className="label transition-colors hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
