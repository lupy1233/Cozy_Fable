'use client';

import { useState } from 'react';
import { Building2, Check, ImageOff, Star } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { usePartners } from '@/hooks/use-company';
import { useSessionRole } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { LoadError, QueryState } from '@/components/ui/query-state';
import { Select } from '@/components/ui/select';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { PublicShell } from '../_components/public-shell';

// auto-fill (nu auto-fit): cu 1-2 firme dupa filtrare, cardurile isi pastreaza latimea
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(330px,100%),1fr))] gap-5';

// Pagina publica de parteneri: firmele APPROVED, cu portofoliu. Vizibila si
// nelogat — parte din landing-ul pentru clienti. Ratingul apare DOAR cand
// backendul il trimite (azi PartnerDto.rating e mereu null — audit 2026-08-19
// P0: nicio cifra inventata); insigna "firma verificata" e pe fiecare card.
// Filtrul pe judet lucreaza pe client, peste lista deja incarcata.
// Metadata (titlu per pagina) vine din layout.tsx — pagina e client component.
export default function PartnersPage() {
  const t = useTranslations('Partners');
  const tn = useTranslations('Nav');
  const format = useFormatter();
  const partners = usePartners();
  const { role } = useSessionRole();
  const [county, setCounty] = useState('');

  const all = partners.data ?? [];
  const counties = [...new Set(all.map((p) => p.county))].sort((a, b) => a.localeCompare(b, 'ro'));
  // judetul ales poate disparea dupa o reincarcare a listei → inapoi la "toate"
  const activeCounty = counties.includes(county) ? county : '';
  const shown = activeCounty ? all.filter((p) => p.county === activeCounty) : all;

  // aceleasi reguli ca in PublicHeader: cererea e pentru vizitatori si clienti,
  // inscrierea firmei doar pentru cine nu are inca un cont deschis
  const showClientCta = !role || role === 'CLIENT';
  const showFirmCta = !role;

  return (
    <PublicShell>
      <div className="flex flex-col gap-8 py-2 sm:py-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="flex flex-col gap-3">
            <h1 className="page-title">{t('title')}</h1>
            <p className="max-w-[620px] text-lead text-muted-foreground">{t('subtitle')}</p>
          </div>
          {all.length > 0 && (
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
              {counties.length > 1 && (
                <Field label={t('county')}>
                  <Select
                    value={activeCounty}
                    onChange={(e) => setCounty(e.target.value)}
                    className="h-11 min-w-[200px]"
                  >
                    <option value="">{t('allCounties')}</option>
                    {counties.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <span aria-live="polite" className="inline-flex h-11 items-center font-mono text-xs text-muted-foreground">
                {t('count', { count: shown.length })}
              </span>
            </div>
          )}
        </div>

        <QueryState
          pending={partners.isPending}
          error={partners.isError}
          onRetry={() => partners.refetch()}
          skeleton={<PartnersSkeleton label={t('loading')} />}
          errorFallback={<LoadError title={t('loadError')} onRetry={() => partners.refetch()} />}
        >
          {all.length === 0 ? (
            <EmptyState variant="dashed" icon={Building2} title={t('empty')} />
          ) : (
            <div className={GRID}>
              {shown.map((p) => {
                // oras si judet identice (Bucuresti, Bucuresti) → o singura data
                const location = p.city === p.county ? p.city : `${p.city}, ${p.county}`;
                return (
                  <Card key={p.id} as="article" className="flex flex-col gap-3.5">
                    <div className="flex items-start justify-between gap-3">
                      {/* monograma firmei */}
                      <span
                        aria-hidden
                        className="grid size-11 shrink-0 place-items-center rounded-lg bg-walnut-soft font-serif text-lg text-walnut"
                      >
                        {p.name.charAt(0)}
                      </span>
                      <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
                        {p.rating !== null && (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground" title={t('rating')}>
                            <Star aria-hidden className="size-4 fill-brass text-brass" />
                            <span className="sr-only">{t('rating')}: </span>
                            {p.rating.toFixed(1)}
                          </span>
                        )}
                        <Badge tone="sage">
                          <Check aria-hidden className="size-3" />
                          {t('verified')}
                        </Badge>
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <h2 className="heading-section">{p.name}</h2>
                      <p className="text-muted-foreground">{location}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('memberSince', {
                          date: format.dateTime(new Date(p.memberSince), { year: 'numeric', month: 'long' }),
                        })}
                      </p>
                    </div>

                    {/* portofoliu: imagini cand exista, altfel placeholder */}
                    <div className="mt-auto grid grid-cols-3 gap-2">
                      {[0, 1, 2].map((i) => {
                        const item = p.portfolio[i];
                        return item?.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={i}
                            src={item.imageUrl}
                            alt={item.title}
                            loading="lazy"
                            className="aspect-square w-full rounded-lg border border-border object-cover"
                          />
                        ) : (
                          <div
                            key={i}
                            className="grid aspect-square place-items-center rounded-lg border border-dashed border-border-2 bg-surface-2 text-muted-2"
                            title={item?.title}
                          >
                            <ImageOff aria-hidden className="size-4" />
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </QueryState>

        {(showClientCta || showFirmCta) && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] gap-5">
            {showClientCta && (
              <section className="flex flex-col items-start gap-3 rounded-xl border border-brass bg-walnut-soft p-6 sm:p-7">
                <h2 className="font-serif text-2xl leading-tight">{t('clientCta.title')}</h2>
                <p className="text-walnut-deep">{t('clientCta.body')}</p>
                <Button asChild variant="walnut" size="lg" className="h-11">
                  <Link href="/requests/new">{tn('createRequest')}</Link>
                </Button>
              </section>
            )}
            {showFirmCta && (
              <Card as="section" padding="none" className="flex flex-col items-start gap-3 p-6 sm:p-7">
                <h2 className="font-serif text-2xl leading-tight">{t('firmCta.title')}</h2>
                <p className="text-muted-foreground">{t('firmCta.body')}</p>
                <Button asChild variant="outline" size="lg" className="h-11 border-foreground">
                  <Link href="/register?role=company">{t('firmCta.action')} →</Link>
                </Button>
              </Card>
            )}
          </div>
        )}
      </div>
    </PublicShell>
  );
}

// schelet in forma cardului de firma; textul "Se incarca…" ramane doar pentru cititoarele de ecran
function PartnersSkeleton({ label }: { label: string }) {
  return (
    <LoadingRegion label={label} className={GRID}>
      {[0, 1, 2].map((i) => (
        <Card key={i} className="flex flex-col gap-3.5">
          <Skeleton className="size-11 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="aspect-square rounded-lg" />
            ))}
          </div>
        </Card>
      ))}
    </LoadingRegion>
  );
}
