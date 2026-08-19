import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { PublicShell } from './_components/public-shell';

// 404 in cadrul paginilor publice (header + footer), RO/EN din i18n
// (audit 2026-08-19 P1). Se randeaza pentru orice ruta necunoscuta din
// /ro|/en (prin [...rest]/page.tsx) si pentru notFound() apelat din pagini
// (ex. dev/piece-3d in productie, colectii inexistente).
export default function NotFoundPage() {
  const t = useTranslations('NotFound');
  return (
    <PublicShell>
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center sm:py-24">
        <span className="kicker">404</span>
        <h1 className="page-title">{t('title')}</h1>
        <p className="text-muted-foreground">{t('body')}</p>
        <Button asChild variant="walnut" size="lg" className="mt-2">
          <Link href="/">{t('home')}</Link>
        </Button>
      </div>
    </PublicShell>
  );
}
