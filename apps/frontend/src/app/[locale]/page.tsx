import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { INSPIRATION_PINS, LANDING_PIN_IDS } from '@/lib/inspiration';
import { cn } from '@/lib/utils';
import { MaterialExplainer } from './_components/material-explainer';
import { PublicHeader } from './_components/public-header';
import { SiteFooter } from './_components/site-footer';
import { pageMetadata } from './_components/metadata';

// Landing dupa canvasul de design (2026-11-12), pe scheletul Landing F (PO 2026-11-08):
// promisiunea centrala ("trei oferte una langa alta") e chiar in hero, ca tabel-exemplu,
// cu garantiile sub buton; apoi drumul in 4 statii, materialele explicate cu textele din
// formular, un preview din caietul de idei, banda CTA pe toata latimea si blocul pentru
// firme. Un singur buton principal (nuc) in pagina; banda il repeta inversat.

// containerul paginii (acelasi ca in PublicShell) + ritmul vertical al sectiunilor
const WRAP = 'mx-auto w-full max-w-6xl px-4 sm:px-6';
const SECTION_Y = 'py-12 sm:py-16 lg:py-[88px]';
// marimile vin din scala Tailwind (marimile arbitrare in px sunt interzise de ESLint);
// leading-ul se repeta pe fiecare prag, fiindca text-* responsive isi readuce propriul line-height
const SECTION_TITLE = 'font-serif text-3xl leading-[1.15] sm:text-4xl sm:leading-[1.15]';

function SectionRule() {
  return (
    <div aria-hidden className={cn(WRAP, 'flex items-center gap-4')}>
      <span className="h-px flex-1 bg-border-2" />
      <span className="size-2 rotate-45 bg-brass" />
      <span className="h-px flex-1 bg-border-2" />
    </div>
  );
}

const JOURNEY = ['p1', 'p2', 'p3', 'p4'] as const;
const GUARANTEES = ['verified', 'free', 'upTo3'] as const;

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
  const tc = useTranslations('Common');
  const format = useFormatter();

  const ideaPins = LANDING_PIN_IDS.slice(0, 8)
    .map((id) => INSPIRATION_PINS.find((p) => p.id === id)!)
    .filter(Boolean);

  // tabelul-exemplu din hero: aceleasi rubrici ca oferta reala (pret, termen,
  // garantie); "montaj" nu e camp structurat in oferta, deci nu il promitem aici
  const firms = [
    { name: t('compare.firmA'), price: 13900, weeks: 6, months: 24 },
    { name: t('compare.firmB'), price: 11450, weeks: 8, months: 12 },
    { name: t('compare.firmC'), price: 14200, weeks: 7, months: 24 },
  ];
  const lowestPrice = Math.min(...firms.map((f) => f.price));
  const fastestTerm = Math.min(...firms.map((f) => f.weeks));

  const cell = 'border-b border-border px-4 py-3.5 text-left align-top font-normal sm:px-5 sm:py-4';
  // coloana cu cel mai mic pret e evidentiata pe toata inaltimea tabelului
  const col = (f: (typeof firms)[number]) => (f.price === lowestPrice ? 'bg-surface-2' : undefined);
  const value = 'font-mono text-ui';
  const best = 'rounded-full bg-sage-soft px-2 py-px text-xs font-medium text-sage';

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero: promisiunea, demonstrata pe loc */}
        <section
          className={cn(
            WRAP,
            'grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-2 lg:pb-20 lg:pt-[88px] xl:gap-x-16',
          )}
        >
          <div className="flex min-w-0 flex-col items-start gap-6">
            <span className="kicker">{t('eyebrow')}</span>
            <h1 className="page-title sm:text-5xl sm:leading-[1.05] xl:text-6xl xl:leading-[1.05]">
              {t('title1')}
              <br />
              {t('title2')}
              <br />
              <span className="text-walnut">{t('title3')}</span>
            </h1>
            <p className="max-w-[520px] text-pretty text-lg leading-relaxed text-muted-foreground">
              {t('subtitle')}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3.5">
              <Button asChild variant="walnut" size="xl" className="h-[52px]">
                <Link href="/requests/new">{t('ctaPrimary')}</Link>
              </Button>
              <span className="text-muted-foreground">{t('ctaNote')}</span>
            </div>
            {/* garantiile stau sub buton, nu ingropate mai jos in pagina */}
            <ul className="mt-2 flex w-full flex-wrap gap-x-7 gap-y-2.5 border-t border-border-2 pt-5">
              {GUARANTEES.map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <Check aria-hidden className="size-4 shrink-0 text-sage" />
                  {t(`guarantees.${k}`)}
                </li>
              ))}
            </ul>
          </div>

          <figure className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
              <span className="heading-card">{t('compare.title')}</span>
              <span className="font-mono text-meta uppercase tracking-[0.05em] text-muted-foreground">
                {t('compare.example')}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] border-collapse">
                <thead>
                  <tr>
                    <th scope="col" className={cn(cell, 'w-[22%]')}>
                      <span className="label">{t('compare.field')}</span>
                    </th>
                    {firms.map((f) => (
                      <th key={f.name} scope="col" className={cn(cell, 'font-medium', col(f))}>
                        {f.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row" className={cn(cell, 'text-muted-foreground')}>
                      {t('compare.rowPrice')}
                    </th>
                    {firms.map((f) => {
                      const lowest = f.price === lowestPrice;
                      return (
                        <td key={f.name} className={cn(cell, col(f))}>
                          <span className="flex flex-col items-start gap-1.5">
                            <span className={cn(value, lowest && 'font-medium')}>
                              {tc('money', { amount: format.number(f.price) })}
                            </span>
                            {lowest && <span className={best}>{t('compare.lowest')}</span>}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <th scope="row" className={cn(cell, 'text-muted-foreground')}>
                      {t('compare.rowTerm')}
                    </th>
                    {firms.map((f) => {
                      const fastest = f.weeks === fastestTerm;
                      return (
                        <td key={f.name} className={cn(cell, col(f))}>
                          <span className="flex flex-col items-start gap-1.5">
                            <span className={cn(value, fastest && 'font-medium')}>
                              {t('compare.weeks', { n: f.weeks })}
                            </span>
                            {fastest && <span className={best}>{t('compare.fastest')}</span>}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <th scope="row" className={cn(cell, 'border-b-0 text-muted-foreground')}>
                      {t('compare.rowWarranty')}
                    </th>
                    {firms.map((f) => (
                      <td key={f.name} className={cn(cell, 'border-b-0', value, col(f))}>
                        {t('compare.months', { n: f.months })}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <figcaption className="border-t border-border bg-surface-2 px-4 py-3.5 text-ui text-muted-foreground sm:px-5">
              {t('compare.caption')}
            </figcaption>
          </figure>
        </section>

        <SectionRule />

        {/* Drumul pana la mobila ta: 4 statii, ultima evidentiata (Goal-Gradient / Peak-End) */}
        <section id="proces" className={cn(WRAP, SECTION_Y, 'flex scroll-mt-20 flex-col gap-10')}>
          <div className="flex flex-col gap-3">
            <span className="kicker">{t('journeyKicker')}</span>
            <h2 className={SECTION_TITLE}>{t('journeyTitle')}</h2>
          </div>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(250px,100%),1fr))] gap-5">
            {JOURNEY.map((k, i) => {
              const last = i === JOURNEY.length - 1;
              return (
                <li
                  key={k}
                  className={cn(
                    'flex flex-col gap-3 rounded-xl border p-6 sm:min-h-[264px]',
                    last ? 'border-brass bg-walnut-soft' : 'border-border bg-surface',
                  )}
                >
                  <span className={cn('font-mono text-xs', last ? 'text-walnut-deep' : 'text-muted-foreground')}>
                    {String(i + 1).padStart(2, '0')} · {t(`${k}.phase`)}
                  </span>
                  <h3 className="heading-section">{t(`${k}.title`)}</h3>
                  <p className={last ? 'text-walnut-deep' : 'text-muted-foreground'}>{t(`${k}.body`)}</p>
                  <span
                    className={cn(
                      'mt-auto border-t border-dashed pt-3.5 text-ui font-medium',
                      last ? 'border-brass' : 'border-border-2',
                    )}
                  >
                    {t(`${k}.who`)}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <SectionRule />

        <MaterialExplainer className={cn(WRAP, SECTION_Y)} />

        <SectionRule />

        {/* Caietul de idei: pentru cine nu stie inca ce vrea */}
        <section className={cn(WRAP, SECTION_Y, 'flex flex-col gap-8')}>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="flex flex-col gap-3">
              <span className="kicker">{t('ideasKicker')}</span>
              <h2 className={SECTION_TITLE}>{t('ideasTitle')}</h2>
              <p className="max-w-[520px] text-muted-foreground">{t('ideasSub')}</p>
            </div>
            <Button asChild variant="outline" size="lg" className="h-11">
              <Link href="/inspiration">{t('ideasCta')} →</Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(min(250px,100%),1fr))] sm:gap-5">
            {ideaPins.map((pin) => (
              <Card key={pin.id} asChild padding="none" interactive className="flex flex-col overflow-hidden">
                <Link href={`/inspiration?type=${pin.type}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pin.img}
                    alt={ti(`pins.${pin.id}`)}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                  <span className="flex flex-col gap-0.5 border-t border-border px-3 pb-3.5 pt-3 sm:px-4 sm:pb-4 sm:pt-3.5">
                    <span className="label">{ti(`types.${pin.type}`)}</span>
                    <span className="font-medium">{ti(`pins.${pin.id}`)}</span>
                  </span>
                </Link>
              </Card>
            ))}
          </div>
        </section>

        {/* Banda finala, pe toata latimea: acelasi CTA ca in hero, inversat pe nuc */}
        <section className="bg-walnut text-on-walnut">
          <div className={cn(WRAP, 'flex flex-col items-center gap-7 py-14 text-center sm:py-20')}>
            <h2 className="max-w-[720px] font-serif text-3xl leading-[1.15] sm:text-4xl sm:leading-[1.15] lg:text-5xl lg:leading-[1.15]">
              {t('bandTitle')}
            </h2>
            <Button
              asChild
              size="xl"
              className="h-[52px] bg-on-walnut font-semibold text-walnut-deep shadow-none hover:bg-on-walnut/90"
            >
              <Link href="/requests/new">{t('bandCta')}</Link>
            </Button>
            <span className="text-on-walnut/80">{t('ctaNote')}</span>
          </div>
        </section>

        {/* Firmele au blocul lor, nu un link mic in banda clientului */}
        <section className={cn(WRAP, 'pb-16 pt-12 sm:pb-[72px] sm:pt-14')}>
          <Card
            padding="none"
            className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 px-6 py-7 sm:px-8"
          >
            <div className="flex flex-col gap-1.5">
              <span className="kicker">{t('firms.kicker')}</span>
              <h2 className="font-serif text-2xl leading-tight">{t('firms.title')}</h2>
              <p className="max-w-[520px] text-muted-foreground">{t('firms.body')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link
                href="/firm-rules"
                className="inline-flex min-h-11 items-center font-medium text-walnut underline underline-offset-4 hover:text-walnut-deep"
              >
                {t('firms.rules')}
              </Link>
              <Button asChild variant="outline" size="lg" className="h-11 border-foreground">
                <Link href="/register?role=company">{t('firms.cta')} →</Link>
              </Button>
            </div>
          </Card>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
