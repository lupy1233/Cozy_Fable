import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { INSPIRATION_PINS, LANDING_PIN_IDS } from '@/lib/inspiration';
import { cn } from '@/lib/utils';
import { HeroSheets } from './_components/hero-sheets';
import { PartnersCarousel } from './_components/partners-carousel';
import { ProcessSection } from './_components/process-section';
import { PublicHeader } from './_components/public-header';

// Landing "ATELIER" — Cozy Home: ton premium cald. Piesa centrala — trei
// schite 3D (axonometrii) care se traseaza singure, comutabile din placute
// de alama (hero-sheets.tsx). Sub ele: galeria de inspiratie si caruselul
// atelierelor partenere.

// ritmul masonry: inaltimi variate, ciclice
const PIN_ASPECTS = ['aspect-[3/4]', 'aspect-square', 'aspect-[4/5]'] as const;

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
      {/* header auth-aware (client island) — arata "Contul meu" cand exista sesiune */}
      <PublicHeader />

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
              <div className="mt-1 flex flex-wrap items-center gap-3">
                {/* actiunea principala a platformei — vizibil mai mare decat restul */}
                <Button asChild variant="walnut" size="xl">
                  <Link href="/requests/new">{t('ctaNewRequest')}</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/register?role=company">{t('ctaCompanies')}</Link>
                </Button>
              </div>
              <p className="label mt-1">{t('heroNote')}</p>
            </div>

            {/* rama + passe-partout + placute de alama: trei planse comutabile (F6, item 2) */}
            <HeroSheets />
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
