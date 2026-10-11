'use client';

import { ImageOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type InspirationImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & { src?: string | null };

export function InspirationImage({ src, alt, className, ...props }: InspirationImageProps) {
  const t = useTranslations('Inspiration');
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!src || src === failedUrl) return (
    <span role="img" aria-label={`${alt ?? ''} — ${t('imageUnavailable')}`}
      className={cn(className, 'flex items-center justify-center bg-surface-2 p-6 text-muted-foreground')}>
      <span className="flex flex-col items-center gap-2 text-center text-sm">
        <ImageOff aria-hidden className="h-7 w-7" />
        <span>{t('imageUnavailable')}</span>
      </span>
    </span>
  );
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} src={src} alt={alt} className={className} onError={() => setFailedUrl(src)} />;
}
