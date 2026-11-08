import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { INSPIRATION_PINS, LANDING_PIN_IDS } from '@/lib/inspiration';
import { cn } from '@/lib/utils';
import { MaterialExplainer } from './_components/material-explainer';
import { PublicHeader } from './_components/public-header';
import { SiteFooter } from './_components/site-footer';
import { pageMetadata } from './_components/metadata';

// Landing F (ales de PO 2026-11-08, dupa Laws of UX): promisiunea centrala
// ("trei oferte una langa alta") e chiar in hero, ca tabel-exemplu; apoi
// drumul in 4 statii, materialele explicate cu textele din formular, un
// preview din caietul de idei si o singura banda CTA. Un singur CTA primar
// pe toata pagina, cu acelasi nume (Jakob / Von Restorff).

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

const JOURNEY = ['p1', 'p2', 'p3', 'p4'] as const;

// titlul complet al site-ului (fara sablonul '%s · Cozy Home') + canonical/hreflang/OG
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, 'home', '/', { absoluteTitle: true });
}

export default function LandingPage() {
  const t = useTranslations('LandingV2');
  const ti = useTranslations('Inspiration');

  const ideaPins = LANDING_PIN_IDS.slice(0, 8)
    .map((id) => INSPIRATION_PINS.find((p) => p.id === id)!)
    .filter(Boolean);

  // tabelul-exemplu din hero: aceleasi rubrici ca oferta reala (pret, termen,
  // garantie); "montaj" nu e camp structurat in oferta, deci nu il promitem aici
  const firms = [
    { name: t('compare.firmA'), price: '13.900', weeks: 6, months: 24 },
    { name: t('compare.firmB'), price: '11.450', weeks: 8, months: 12 },
    { name: t('compare.firmC'), price: '14.200', weeks: 7, months: 24 },
  ];
  const cell = 'border-b border-border-2 px-4 py-3 text-sm';
  const tag = 'ml-1.5 inline-block rounded-full bg-sage-soft px-2 py-0.5 align-middle text-micro font-semibold text-sage';

  return (
    <div className="min-h-screen">
      <PublicHeader />

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero: promisiunea, demonstrata pe loc */}
        <section className="py-10 lg:py-14">
          <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <div className="flex flex-col items-start gap-4">
              <span className="kicker">{t('eyebrow')}</span>
              <h1 className="page-title max-w-xl">
                {t('title1')}
                <br />
                {t('title2')}
                <br />
                <span className="text-walnut">{t('title3')}</span>
              </h1>
              <p className="max-w-lg text-lead leading-relaxed text-muted-foreground">{t('subtitle')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button asChild variant="walnut" size="xl">
                  <Link href="/requests/new">{t('ctaPrimary')}</Link>
                </Button>
                <span className="text-sm text-muted-foreground">{t('ctaNote')}</span>
              </div>
            </div>

            <figure className="overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
              <div className="flex items-center justify-between gap-3 border-b border-border-2 px-4 py-3">
                <span className="font-medium">{t('compare.title')}</span>
                <span className="label font-mono uppercase">{t('compare.example')}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] border-collapse text-left">
                  <thead>
                    <tr>
                      <th className={cell} scope="col">
                        <span className="sr-only">{t('compare.example')}</span>
                      </th>
                      {firms.map((f) => (
                        <th key={f.name} scope="col" className={cn(cell, 'font-semibold')}>
                          {f.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row" className={cn(cell, 'font-normal text-muted-foreground')}>{t('compare.rowPrice')}</th>
                      {firms.map((f, i) => (
                        <td key={f.name} className={cn(cell, 'font-mono')}>
                          {f.price} lei
                          {i === 1 && <span className={tag}>{t('compare.lowest')}</span>}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row" className={cn(cell, 'font-normal text-muted-foreground')}>{t('compare.rowTerm')}</th>
                      {firms.map((f, i) => (
                        <td key={f.name} className={cell}>
                          {t('compare.weeks', { n: f.weeks })}
                          {i === 0 && <span className={tag}>{t('compare.fastest')}</span>}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row" className={cn(cell, 'border-b-0 font-normal text-muted-foreground')}>{t('compare.rowWarranty')}</th>
                      {firms.map((f) => (
                        <td key={f.name} className={cn(cell, 'border-b-0')}>
                          {t('compare.months', { n: f.months })}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <figcaption className="border-t border-border-2 bg-surface-2/60 px-4 py-2.5 text-xs text-muted-foreground">
                {t('compare.caption')}
              </figcaption>
            </figure>
          </div>
        </section>

        <SectionRule />

        {/* Drumul pana la mobila ta: 4 statii, ultima evidentiata (Goal-Gradient / Peak-End) */}
        <section id="proces" className="scroll-mt-20 py-12">
          <span className="kicker">{t('journeyKicker')}</span>
          <h2 className="serif mt-2 text-3xl sm:text-4xl">{t('journeyTitle')}</h2>
          <ol className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {JOURNEY.map((k, i) => {
              const last = i === JOURNEY.length - 1;
              return (
                <li
                  key={k}
                  className={cn(
                    'flex flex-col gap-2 rounded-xl border p-5',
                    last ? 'border-brass/50 bg-walnut-soft/40' : 'border-border bg-surface',
                  )}
                >
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-brass-2">
                    {String(i + 1).padStart(2, '0')} · {t(`${k}.phase`)}
                  </span>
                  <h3 className="font-serif text-xl">{t(`${k}.title`)}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t(`${k}.body`)}</p>
                  <span className="mt-auto border-t border-dashed border-border pt-2.5 text-xs text-muted-foreground">
                    {t(`${k}.who`)}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <SectionRule />

        <MaterialExplainer />

        <SectionRule />

        {/* Caietul de idei: pentru cine nu stie inca ce vrea */}
        <section className="py-12">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="kicker">{t('ideasKicker')}</span>
              <h2 className="serif mt-2 text-3xl sm:text-4xl">{t('ideasTitle')}</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('ideasSub')}</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/inspiration">{t('ideasCta')} →</Link>
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
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8 text-xs leading-snug text-white">
                  {ti(`pins.${pin.id}`)}
                  <span className="mt-0.5 block text-micro uppercase tracking-[0.12em] text-white/70">
                    {ti(`types.${pin.type}`)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Banda finala: acelasi CTA ca in hero, firma are linkul ei discret */}
        <section className="mb-14 mt-2 flex flex-col items-start justify-between gap-5 rounded-xl bg-walnut px-8 py-10 text-on-walnut shadow-lg sm:px-12 md:flex-row md:items-center">
          <h2 className="serif max-w-xl text-3xl sm:text-4xl">{t('bandTitle')}</h2>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <Button asChild size="xl" className="bg-surface text-walnut-deep hover:bg-surface/90">
              <Link href="/requests/new">{t('bandCta')}</Link>
            </Button>
            <Link href="/register?role=company" className="text-sm text-on-walnut/80 underline-offset-4 hover:underline">
              {t('bandCompany')} →
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
