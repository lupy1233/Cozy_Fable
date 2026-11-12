import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { NotFoundLinks } from './_components/not-found-links';
import { PublicShell } from './_components/public-shell';

// Casa din logo, trasa subtire, cu usa punctata: "aici nu e nimic". Aceleasi trasee ca in
// CozyHomeMark (components/brand/logo.tsx), alta grosime de linie.
function EmptyHouse({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={className}
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
    >
      <path d="M5.5 15.5 L16 6.5 L26.5 15.5" strokeLinejoin="round" />
      <path d="M8 14 V24.5 A1.5 1.5 0 0 0 9.5 26 H22.5 A1.5 1.5 0 0 0 24 24.5 V14" />
      <path d="M13.5 26 V21 A2.5 2.5 0 0 1 18.5 21 V26" strokeDasharray="1.5 1.5" />
      <path d="M21.5 11.2 V7.5 M24 7.5 V13.4 M20.8 7.5 H24.7" />
      <path d="M22.9 5.4 C22.1 4.6 23.6 3.8 22.9 3" className="stroke-brass" />
    </svg>
  );
}

// 404 in cadrul paginilor publice (header + footer), RO/EN din i18n
// (audit 2026-08-19 P1). Se randeaza pentru orice ruta necunoscuta din
// /ro|/en (prin [...rest]/page.tsx) si pentru notFound() apelat din pagini
// (ex. dev/piece-3d in productie, colectii inexistente).
// Canvas design 2026-11-12: o iesire principala (acasa) + patru secundare (NotFoundLinks).
export default function NotFoundPage() {
  const t = useTranslations('NotFound');
  return (
    <PublicShell>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-10 text-center sm:py-16">
        <EmptyHouse className="size-28 text-muted-2" />
        <span className="font-mono text-ui tracking-[0.18em] text-brass">404</span>
        <h1 className="page-title">{t('title')}</h1>
        <p className="max-w-[460px] text-base leading-relaxed text-muted-foreground">{t('body')}</p>
        <Button asChild variant="walnut" size="xl" className="mt-2 h-[52px]">
          <Link href="/">{t('home')}</Link>
        </Button>
        <NotFoundLinks />
      </div>
    </PublicShell>
  );
}
