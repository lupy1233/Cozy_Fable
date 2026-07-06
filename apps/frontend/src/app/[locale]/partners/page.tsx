'use client';

import { Building2, ImageOff, MapPin, Star } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { usePartners } from '@/hooks/use-company';
import { mockPartnerMeta } from '@/lib/mock-partner-meta';
import { PublicShell } from '../_components/public-shell';

// Pagina publica de parteneri: firmele APPROVED, cu portofoliu si (ulterior)
// ratingul Google. Vizibila si nelogat — parte din landing-ul pentru clienti.
export default function PartnersPage() {
  const t = useTranslations('Partners');
  const format = useFormatter();
  const partners = usePartners();

  return (
    <PublicShell>
      <div className="flex flex-col gap-8">
        <div className="text-center">
          <h1 className="page-title">{t('title')}</h1>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{t('subtitle')}</p>
        </div>

        {partners.isPending && (
          <p className="py-10 text-center text-muted-foreground">{t('loading')}</p>
        )}
        {partners.isSuccess && partners.data.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">{t('empty')}</p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {partners.data?.map((p) => (
            <div key={p.id} className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-walnut-soft text-walnut">
                  <Building2 className="h-5 w-5" />
                </span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground" title={t('ratingSoon')}>
                  <Star className="h-4 w-4 fill-brass text-brass" />
                  {(p.rating ?? mockPartnerMeta(p.id).rating).toFixed(1)}
                </span>
              </div>
              <h2 className="mt-3 font-serif text-xl">{p.name}</h2>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {p.city}, {p.county}
              </p>
              <p className="mt-0.5 text-xs text-muted-2">
                {t('memberSince', {
                  date: format.dateTime(new Date(p.memberSince), { year: 'numeric', month: 'long' }),
                })}
              </p>

              {/* portofoliu: imagini cand exista, altfel placeholder */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => {
                  const item = p.portfolio[i];
                  return item?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={item.imageUrl}
                      alt={item.title}
                      className="aspect-square rounded-lg border border-border-2 object-cover"
                    />
                  ) : (
                    <div
                      key={i}
                      className="grid aspect-square place-items-center rounded-lg border border-dashed border-border-2 bg-surface-2 text-muted-2"
                      title={item?.title}
                    >
                      <ImageOff className="h-4 w-4" />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
