import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

// C2: footer minimal, comun paginilor publice — brandingul CozyHome + linkurile
// legale (Termeni si Confidentialitate). Atat, nimic altceva.
export function SiteFooter() {
  const t = useTranslations('Nav');
  const tl = useTranslations('Landing');

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="label">© 2026 Cozy Home — {tl('footerTagline')}</span>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/terms" className="label transition-colors hover:text-foreground">
            {t('terms')}
          </Link>
          <Link href="/privacy" className="label transition-colors hover:text-foreground">
            {t('privacy')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
