import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { CozyHomeLogo } from '@/components/brand/logo';
import { OperatorLine } from './operator-line';

// Footerul paginilor publice (design 2026-11): brand + trei coloane de linkuri
// (pentru clienti, pentru firme, legal), apoi randul cu anul si identitatea operatorului.
// Anul e dinamic (audit 2026-08-19); identitatea (E-admin-platform-2) vine din
// Admin → Setari si apare doar dupa legal_identity_published.
const linkCls = 'py-1 text-sm text-foreground transition-colors hover:text-walnut';

export function SiteFooter() {
  const t = useTranslations('Nav');
  const tl = useTranslations('Landing');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface-2">
      <div className="mx-auto flex max-w-6xl flex-col gap-7 px-4 pb-7 pt-10 sm:px-6 sm:pt-12">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-8">
          <div className="flex flex-col gap-3">
            <Link href="/" className="self-start">
              <CozyHomeLogo />
            </Link>
            <p className="max-w-[240px] text-sm text-muted-foreground">{tl('footerTagline')}</p>
          </div>
          <nav aria-label={t('footerClients')} className="flex flex-col gap-1">
            <div className="label mb-1.5">{t('footerClients')}</div>
            <Link href="/requests/new" className={linkCls}>
              {t('createRequest')}
            </Link>
            <Link href="/inspiration" className={linkCls}>
              {t('inspiration')}
            </Link>
            <Link href="/studio" className={linkCls}>
              {t('studio')}
            </Link>
            <Link href="/sketch-guide" className={linkCls}>
              {t('sketchGuide')}
            </Link>
          </nav>
          <nav aria-label={t('forCompanies')} className="flex flex-col gap-1">
            <div className="label mb-1.5">{t('forCompanies')}</div>
            <Link href="/register?role=company" className={linkCls}>
              {t('registerCompany')}
            </Link>
            <Link href="/firm-rules" className={linkCls}>
              {t('firmRules')}
            </Link>
            <Link href="/partners" className={linkCls}>
              {t('partners')}
            </Link>
          </nav>
          <nav aria-label={t('footerLegal')} className="flex flex-col gap-1">
            <div className="label mb-1.5">{t('footerLegal')}</div>
            <Link href="/terms" className={linkCls}>
              {t('terms')}
            </Link>
            <Link href="/privacy" className={linkCls}>
              {t('privacy')}
            </Link>
          </nav>
        </div>
        <div className="flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-border pt-5">
          <span className="meta-text">© {year} Cozy Home</span>
          <OperatorLine />
        </div>
      </div>
    </footer>
  );
}
