import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { ArrowDown } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { PublicHeader } from '../_components/public-header';
import { SiteFooter } from '../_components/site-footer';
import { ScrollStory } from './_components/scroll-story';

// Landing v2 (PO 2026-07-31) — pagina de lucru, accesibila DOAR pe link direct:
// nu e legata din niciun meniu si e exclusa de la indexare. Piesa centrala e
// povestea "cum functioneaza" derulata la scroll (scroll-story.tsx). Cand PO o
// aproba, continutul ei inlocuieste landing-ul din [locale]/page.tsx.
export const metadata: Metadata = {
  title: 'Cozy Home — landing v2 (previzualizare)',
  robots: { index: false, follow: false },
};

function SectionRule() {
  return (
    <div aria-hidden className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="h-1.5 w-1.5 rotate-45 bg-brass/70" />
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export default function LandingV2Page() {
  const t = useTranslations('LandingV2');

  const purpose = [
    { title: t('p1Title'), body: t('p1Body') },
    { title: t('p2Title'), body: t('p2Body') },
    { title: t('p3Title'), body: t('p3Body') },
  ];

  return (
    <div className="min-h-screen">
      <PublicHeader />

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero: o singura afirmatie mare + invitatia de a derula povestea */}
        <section className="flex min-h-[78vh] flex-col items-center justify-center py-16 text-center">
          <span className="mb-4 rounded-full border border-brass/40 bg-brass/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-brass-2">
            {t('previewBadge')}
          </span>
          <span className="kicker">{t('kicker')}</span>
          <h1 className="page-title mt-3 max-w-3xl text-balance">{t('title')}</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {t('subtitle')}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="walnut" size="xl">
              <Link href="/requests/new">{t('ctaPrimary')}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#cum-functioneaza">{t('ctaSecondary')}</a>
            </Button>
          </div>
          <a
            href="#cum-functioneaza"
            className="group mt-14 flex flex-col items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="label">{t('scrollCue')}</span>
            <ArrowDown className="h-4 w-4 animate-bounce" />
          </a>
        </section>

        <SectionRule />

        {/* Piesa centrala: cum decurge aplicatia, pas cu pas, la scroll */}
        <ScrollStory />

        <SectionRule />

        {/* Scopul platformei */}
        <section className="py-14">
          <div className="mx-auto max-w-2xl text-center">
            <span className="kicker">{t('purposeKicker')}</span>
            <h2 className="serif mt-2 text-3xl sm:text-4xl">{t('purposeTitle')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              {t('purposeSub')}
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {purpose.map((p, i) => (
              <div key={p.title} className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                <span className="font-serif text-2xl text-brass">{['I.', 'II.', 'III.'][i]}</span>
                <h3 className="mt-2 font-serif text-xl">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Banda finala: espresso cu lumina de alama, ca pe landing-ul curent */}
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
