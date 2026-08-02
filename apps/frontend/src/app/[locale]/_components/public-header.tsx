'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { CozyHomeLogo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { LangSwitch } from './lang-switch';
import { MobileNav } from './mobile-nav';

// Header comun al paginilor publice (landing, parteneri, inspiratie, ghid):
// logo → landing, linkuri publice, login/register sau "Contul meu" daca e
// sesiune activa. Sticky cu blur (ca AppHeader): navigatia ramane la
// indemana oricat de jos derulezi, fara drumuri inapoi in capul paginii.
// Client island: landing-ul ramane server component, dar
// headerul citeste sesiunea (useMe) — altfel utilizatorul logat care revine
// pe landing vede Login/Register si crede ca a fost deconectat.
// CTA-ul "Creeaza o cerere" e actiunea centrala a platformei: vizibil mereu,
// inclusiv pe mobil, dar ascuns pentru conturile de atelier/admin.
// Ordinea nav (feedback PO item 13): Caietul de idei primul (marketing —
// pagina care ramane in mintea clientilor), apoi ghidul, apoi partenerii.
export const PUBLIC_LINKS = [
  { href: '/inspiration', key: 'inspiration' },
  { href: '/studio', key: 'studio' },
  { href: '/sketch-guide', key: 'sketchGuide' },
  { href: '/partners', key: 'partners' },
] as const;

const mobileLinkCls =
  'block rounded-md px-3 py-2.5 text-[15px] text-foreground transition-colors hover:bg-secondary';

export function PublicHeader() {
  const tn = useTranslations('Nav');
  const pathname = usePathname();
  const me = useMe();

  const showCta = !me.data || me.data.role === 'CLIENT';

  return (
    // headerul (pozitionat) e ancora panoului MobileNav (absolute top-full)
    <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/">
            <CozyHomeLogo />
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {PUBLIC_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  pathname.endsWith(l.href)
                    ? 'bg-walnut-soft font-medium text-walnut-deep'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {tn(l.key)}
              </Link>
            ))}
          </nav>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <span className="hidden sm:inline-flex">
            <LangSwitch />
          </span>
          {showCta && (
            <Button asChild variant="walnut" size="sm">
              <Link href="/requests/new">{tn('createRequest')}</Link>
            </Button>
          )}
          {me.data ? (
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/dashboard">{tn('dashboard')}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">{tn('login')}</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link href="/register">{tn('register')}</Link>
              </Button>
            </>
          )}
          <MobileNav
            className="sm:hidden"
            links={PUBLIC_LINKS.map((l) => ({ href: l.href, label: tn(l.key) }))}
            footer={
              <div className="flex flex-col gap-0.5">
                {me.data ? (
                  <Link href="/dashboard" className={mobileLinkCls}>
                    {tn('dashboard')}
                  </Link>
                ) : (
                  <>
                    <Link href="/login" className={mobileLinkCls}>
                      {tn('login')}
                    </Link>
                    <Link href="/register" className={mobileLinkCls}>
                      {tn('register')}
                    </Link>
                  </>
                )}
                <div className="px-3 pb-1 pt-2.5">
                  <LangSwitch />
                </div>
              </div>
            }
          />
        </nav>
      </div>
    </header>
  );
}
