'use client';

import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { usePartners } from '@/hooks/use-company';
import { mockPartnerMeta } from '@/lib/mock-partner-meta';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Carusel cu atelierele partenere pe landing: monograma, rating Google
// (mock deterministe pana la integrarea reala), specializare si oras.
// Sectiunea sta pe un panou cald (surface-2) care o delimiteaza clar de
// restul landingului. Cardurile au latimi calculate sa umple exact panoul
// (1 + "peek" pe mobil, 2 pe tableta, 3 pe desktop) — nu mai raman carduri
// taiate la marginea viewportului. Avansul (auto la ~5s, sageti, swipe) se
// face pe rand intreg; se opreste cat timp utilizatorul e pe el.

const AUTO_ADVANCE_MS = 5000;
const GAP = 16; // gap-4 dintre carduri, in px — folosit la pasul de derulare

// suma latimilor + gap-urile = latimea panoului, deci randul se inchide curat
const CARD_W = 'w-[85%] sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]';

export function PartnersCarousel() {
  const t = useTranslations('Landing');
  const partners = usePartners();
  const track = useRef<HTMLDivElement>(null);
  const paused = useRef(false);

  // deruleaza un rand intreg (cate carduri incap in viewportul trackului)
  const scrollByPage = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-card]');
    const step = (card?.offsetWidth ?? 320) + GAP;
    const cs = getComputedStyle(el);
    const content = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const perView = Math.max(1, Math.round((content + GAP) / step));
    el.scrollBy({ left: dir * step * perView, behavior: 'smooth' });
  };

  const itemCount = partners.data?.length ?? 0;

  useEffect(() => {
    if (itemCount === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      const el = track.current;
      if (!el || paused.current || document.hidden) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      if (atEnd) el.scrollTo({ left: 0, behavior: 'smooth' });
      else scrollByPage(1);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [itemCount]);

  // landing-ul ramane senin daca API-ul nu e disponibil
  if (partners.isError || (partners.isSuccess && partners.data.length === 0)) return null;

  const items = partners.data ?? [];

  return (
    <section className="my-14 rounded-2xl border border-border bg-surface-2/70 px-4 py-10 sm:px-8 sm:py-12">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <span className="kicker">{t('partnersKicker')}</span>
          <h2 className="serif mt-2 text-3xl sm:text-4xl">{t('partnersTitle')}</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t('partnersSub')}</p>
        </div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t('carouselPrev')}
            onClick={() => scrollByPage(-1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t('carouselNext')}
            onClick={() => scrollByPage(1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div
        ref={track}
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
        onTouchStart={() => (paused.current = true)}
        onTouchEnd={() => (paused.current = false)}
        onFocus={() => (paused.current = true)}
        onBlur={() => (paused.current = false)}
        // A2: snap-proximity (nu mandatory) — capatul de scroll ramane pozitie
        // valida de repaus; scroll-px aliniaza snap-urile cu bleed-ul
        // orizontal (-mx/px, pana la marginile panoului)
        className="-mx-4 flex snap-x snap-proximity scroll-px-4 gap-4 overflow-x-auto px-4 pb-1 sm:-mx-8 sm:scroll-px-8 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {partners.isPending &&
          [0, 1, 2].map((i) => (
            <div
              key={i}
              data-card
              className={cn('h-[190px] shrink-0 animate-pulse rounded-xl border border-border bg-card', CARD_W)}
            />
          ))}
        {items.map((p) => {
          const meta = mockPartnerMeta(p.id);
          const rating = p.rating ?? meta.rating;
          return (
            <div
              key={p.id}
              data-card
              className={cn(
                'flex min-h-[190px] shrink-0 snap-start flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-sheet',
                CARD_W,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                {/* monograma firmei */}
                <span className="grid h-10 w-10 place-items-center rounded-md bg-walnut-soft font-serif text-lg text-walnut-deep">
                  {p.name.charAt(0)}
                </span>
                <span
                  className="flex items-center gap-1.5 text-sm"
                  title={t('googleReviews')}
                >
                  <Star className="h-4 w-4 fill-brass text-brass" />
                  <span className="font-medium">{rating.toFixed(1)}</span>
                  <span className="text-xs text-muted-2">
                    ({meta.reviewsCount} {t('reviewsShort')})
                  </span>
                </span>
              </div>
              {/* numele pe un singur rand — cardurile pastreaza aceeasi structura */}
              <h3 className="mt-3 truncate font-serif text-xl" title={p.name}>
                {p.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`partnerSpecialty.${meta.specialtyKey}`)}
              </p>
              <p className="mt-auto flex items-center gap-1 pt-3 text-xs text-muted-2">
                <MapPin className="h-3.5 w-3.5" />
                {p.city}, {p.county}
              </p>
            </div>
          );
        })}
        {/* cardul de final: catre pagina completa de parteneri — aceeasi
            latime ca restul, ca randul sa ramana aliniat */}
        <Link
          href="/partners"
          data-card
          className={cn(
            'grid min-h-[190px] shrink-0 snap-start place-items-center rounded-xl border border-dashed border-border-2 text-sm text-muted-foreground transition-colors hover:border-walnut hover:text-walnut',
            CARD_W,
          )}
        >
          {t('partnersAll')} →
        </Link>
      </div>
    </section>
  );
}
