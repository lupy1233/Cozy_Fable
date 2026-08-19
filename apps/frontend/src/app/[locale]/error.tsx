'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { CozyHomeLogo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

// Error boundary pentru orice pagina din /ro|/en (audit 2026-08-19 P1):
// inlocuieste ecranul generic Next cu un cadru in limbajul platformei —
// marca, mesaj din i18n, "Incearca din nou" (reset re-randeaza segmentul)
// si drum inapoi acasa. Intentionat FARA PublicShell: headerul citeste
// sesiunea si ar putea fi chiar sursa erorii.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('ErrorPage');

  useEffect(() => {
    // vizibil in consola/loguri; fara serviciu extern de raportare deocamdata
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <Link href="/" aria-label="Cozy Home">
        <CozyHomeLogo size="lg" />
      </Link>
      <div className="mt-4 flex max-w-lg flex-col items-center gap-3">
        <h1 className="page-title">{t('title')}</h1>
        <p className="text-muted-foreground">{t('body')}</p>
        {error.digest && (
          <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
            {t('reference', { id: error.digest })}
          </p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Button variant="walnut" size="lg" onClick={() => reset()}>
          {t('retry')}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">{t('home')}</Link>
        </Button>
      </div>
    </main>
  );
}
