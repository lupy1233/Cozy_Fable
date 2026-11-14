'use client';

import { ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// h1 (etapa 11): poza unei lucrari din portofoliu cu imagine de rezerva — fara adresa sau cand
// poza nu se incarca (legatura presemnata expirata, adresa veche moarta). Folosita in lista
// firmei si pe pagina publica „Firme partenere”.
export function PortfolioImage({
  src,
  alt,
  className,
  fallbackClassName,
  iconClassName = 'size-6',
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  // o legatura noua (ex. dupa inlocuirea pozei) primeste o noua incercare
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div
        aria-hidden
        data-portfolio-fallback
        title={alt}
        className={cn('grid place-items-center bg-surface-3 text-muted-2', fallbackClassName ?? className)}
      >
        <ImageOff className={iconClassName} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" className={className} onError={() => setFailed(true)} />
  );
}
