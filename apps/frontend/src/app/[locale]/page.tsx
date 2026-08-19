import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { INSPIRATION_PINS, LANDING_PIN_IDS } from '@/lib/inspiration';
import { cn } from '@/lib/utils';
import { HeroDemo } from './_components/hero-demo';
import { PartnersCarousel } from './_components/partners-carousel';
import { ProcessBand } from './_components/process-band';
import { PublicHeader } from './_components/public-header';
import { SiteFooter } from './_components/site-footer';
import { pageMetadata } from './_components/metadata';

// Landing "ATELIER" v2 (aprobat PO 2026-08-01, fost /landing-v2): semnatura
// paginii e mini-configuratorul FUNCTIONAL din hero (hero-demo.tsx) — produsul
// insusi, nu o poveste despre el. Urmeaza "Drumul cererii" (mozaic cu imbinari
// de alama, statia 1 legata live de demo), caietul de idei, "Pentru cine" si
// banda CTA. Vechiul landing (hero-sheets + process-section + partners) a fost
// inlocuit; componentele lui raman in _components pentru refolosire.

// ritmul masonry al caietului de idei: inaltimi variate, ciclice
const PIN_ASPECTS = ['aspect-[3/4]', 'aspect-square', 'aspect-[4/5]'] as const;

function SectionRule() {
  return (
    <div aria-hidden className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="h-1.5 w-1.5 rotate-45 bg-brass/70" />
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

// titlul complet al site-ului (fara sablonul '%s · Cozy Home') + canonical/hreflang/OG
export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return pageMetadata(locale, 'home', '/', { absoluteTitle: true });
}

export default function LandingPage() {
  const t = useTranslations('LandingV2');
  const ti = useTranslations('Inspiration');

  const proofs = [t('proof1'), t('proof2'), t('proof3')];
  const clients = [t('client1'), t('client2'), t('client3')];
  const workshops = [t('ws1'), t('ws2'), t('ws3')];
  const ideaPins = LANDING_PIN_IDS.slice(0, 8)
    .map((id) => INSPIRATION_PINS.find((p) => p.id === id)!)
    .filter(Boolean);

  return (
    <div className="min-h-screen">
      <PublicHeader />

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero: teza in stanga, produsul functional in dreapta */}
        <section className="py-10 lg:py-14">
          <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
            <div className="flex flex-col items-start gap-4">
              <span className="kicker">{t('eyebrow')}</span>
              <h1 className="page-title max-w-xl">{t('title')}</h1>
              <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                {t('subtitle')}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button asChild variant="walnut" size="xl">
                  <Link href="/requests/new">{t('ctaPrimary')}</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="#proces">{t('ctaSecondary')}</a>
                </Button>
              </div>
              {/* promisiunile concrete, pe hairline — nu metrice umflate */}
              <ul className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3.5 sm:flex-row sm:flex-wrap sm:gap-x-6">
                {proofs.map((p) => (
                  <li key={p} className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <Check className="h-3.5 w-3.5 shrink-0 text-sage" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            <HeroDemo />
          </div>
        </section>

        <SectionRule />

        {/* Drumul cererii: patru statii imbinate ca panourile de mobila */}
        <ProcessBand />

        <SectionRule />

        {/* Caietul de idei: pentru cine nu stie inca ce vrea — orice idee
            poate deveni cerere (leaga povestea de fluxul "am nevoie de ajutor") */}
        <section className="py-12">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="kicker">{t('ideasKicker')}</span>
              <h2 className="serif mt-2 text-3xl sm:text-4xl">{t('ideasTitle')}</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {t('ideasSub')}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/inspiration">{t('ideasCta')}</Link>
            </Button>
          </div>
          <div className="columns-2 gap-3 md:columns-4">
            {ideaPins.map((pin, i) => (
              <Link
                key={pin.id}
                href={`/inspiration?type=${pin.type}`}
                className="group relative mb-3 block break-inside-avoid overflow-hidden rounded-lg border border-border bg-surface-2 shadow-sm"
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
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8 text-[12.5px] leading-snug text-white">
                  {ti(`pins.${pin.id}`)}
                  <span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] text-white/70">
                    {ti(`types.${pin.type}`)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <SectionRule />

        {/* Pentru cine: doua panouri concrete, cu drumul fiecaruia */}
        <section className="py-12">
          <div className="mb-8">
            <span className="kicker">{t('forKicker')}</span>
            <h2 className="serif mt-2 text-3xl sm:text-4xl">{t('forTitle')}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                title: t('forClientsTitle'),
                items: clients,
                cta: t('clientCta'),
                href: '/requests/new',
                tone: 'client' as const,
              },
              {
                title: t('forWorkshopsTitle'),
                items: workshops,
                cta: t('wsCta'),
                href: '/register?role=company',
                tone: 'workshop' as const,
              },
            ].map((panel) => (
              <div
                key={panel.title}
                className={
                  'flex flex-col rounded-xl border p-6 shadow-sm ' +
                  (panel.tone === 'client'
                    ? 'border-border bg-surface'
                    : 'border-brass/30 bg-surface-2/60')
                }
              >
                <div className="flex items-center gap-3">
                  {/* glife in limbajul firmei de mobilier: foaia de cerere / casuta cu fum */}
                  {panel.tone === 'client' ? (
                    <svg viewBox="0 0 40 40" fill="none" className="h-9 w-9 text-walnut" aria-hidden
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="8" y="6" width="24" height="28" rx="2" />
                      <path d="M14 14h12M14 20h12M14 26h7" opacity={0.55} strokeWidth="1.75" />
                      <path d="M31 25l5 5-7 2 2-7z" fill="hsl(var(--card))" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 40 40" fill="none" className="h-9 w-9 text-brass-2" aria-hidden
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 33V19l13-9 13 9v14z" />
                      <path d="M16 33v-8h8v8" strokeWidth="1.75" />
                      <path d="M27 12V8h3v6" strokeWidth="1.75" />
                      <path d="M29 6c-1.4-1.5 1.4-2.8 0-4.3" strokeWidth="1.25" opacity={0.7} />
                    </svg>
                  )}
                  <h3 className="font-serif text-xl">{panel.title}</h3>
                </div>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {panel.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 border-t border-border-2 pt-4">
                  <Link
                    href={panel.href}
                    className="group inline-flex items-center gap-1 text-[13.5px] font-medium text-walnut hover:text-walnut-deep"
                  >
                    {panel.cta}
                    <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Dovada sociala: firmele partenere, pe panoul lor cald (readus
            din landing-ul v1 la cererea PO) */}
        <PartnersCarousel />

        {/* Banda finala: espresso cu lumina de alama */}
        <section className="relative mb-14 mt-2 overflow-hidden rounded-xl bg-gradient-to-br from-foreground to-ink-2 px-8 py-12 text-background shadow-lg sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(640px 320px at 85% 15%, hsl(var(--brass) / 0.22), transparent 65%)',
            }}
          />
          <div className="relative flex flex-col items-start gap-4 sm:max-w-2xl">
            <h2 className="serif text-3xl sm:text-4xl">{t('bandTitle')}</h2>
            <p className="text-[15px] leading-relaxed text-background/75">{t('bandBody')}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90">
                <Link href="/requests/new">{t('bandCtaClient')}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background"
              >
                <Link href="/register?role=company">{t('bandCtaCompany')}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
