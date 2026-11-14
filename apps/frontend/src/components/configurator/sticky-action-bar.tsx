import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Bara de jos a ecranelor formularului (etapa 8, problema 40). Sub `lg` se lipeste
// de marginea de jos a ecranului (sticky, NU fixed: cardul sta intr-un
// motion.section cu transform, iar fixed sub transform se strica) si, la capatul
// paginii, sta la locul ei. De la `lg` arata exact ca bara de dinainte.
// Trebuie sa fie ULTIMUL copil al containerului care cuprinde tot ecranul.
// bleed: marginile negative acopera padding-ul cardului din wizard (p-5 sm:p-7);
// la Sumar (fara card) se trimite bleed={false}.

const BASE =
  'flex flex-wrap items-center justify-between gap-3 border-t border-border ' +
  // telefon / tableta
  'sticky bottom-0 z-20 bg-surface/95 backdrop-blur pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ' +
  // desktop: bara statica de azi
  'lg:static lg:z-auto lg:bg-transparent lg:backdrop-blur-none lg:pt-6 lg:pb-0';

const BLEED = '-mx-5 px-5 sm:-mx-7 sm:px-7 lg:mx-0 lg:px-0';

export function StickyActionBar({
  children,
  className,
  bleed = true,
}: {
  children: ReactNode;
  className?: string;
  bleed?: boolean;
}) {
  return (
    <div data-sticky-action-bar="" className={cn(BASE, bleed && BLEED, className)}>
      {children}
    </div>
  );
}
