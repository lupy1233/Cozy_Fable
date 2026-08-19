'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { CozyHomeLogo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { LangSwitch } from './lang-switch';
import { MobileNav, activeHref } from './mobile-nav';

// Header comun al paginilor publice (landing, parteneri, inspiratie, ghid):
// logo → landing, linkuri publice, login/register sau "Contul meu" daca e
// sesiune activa. Sticky cu blur (ca AppHeader): navigatia ramane la
// indemana oricat de jos derulezi, fara drumuri inapoi in capul paginii.
// Client island: landing-ul ramane server component, dar
// headerul citeste sesiunea (useMe) — altfel utilizatorul logat care revine
// pe landing vede Login/Register si crede ca a fost deconectat.
// CTA-ul "Creeaza o cerere" e actiunea centrala a platformei: vizibil mereu,
// inclusiv pe mobil, dar ascuns pentru conturile de firma/admin.
// Ordinea nav (feedback PO item 13): Caietul de idei primul (marketing —
// pagina care ramane in mintea clientilor), apoi ghidul, apoi partenerii.
//
// Latimi (audit 2026-08-19, P0): sub `lg` (1024px) logo + 4 linkuri + lang +
// 3 butoane NU incap (RO: ~1070px) si headerul se rupea pe 2-3 randuri cu
// scroll orizontal. Acum: linkurile + lang + login/register stau in hamburger
// pana la `lg`; intre `lg` si `xl` ramane doar "Autentificare" (Inregistrare e
// la un click, din pagina de login) ca sa incapa (~990px estimat); de la `xl` tot.
// Aceleasi inaltime (py-2.5) si prag (lg) ca AppHeader — headerul nu "sare"
// la trecerea landing ↔ cont.
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
  const current = activeHref(
    pathname,
    PUBLIC_LINKS.map((l) => l.href),
  );

  return (
    // headerul (pozitionat) e ancora panoului MobileNav (absolute top-full)
    <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/" className="shrink-0">
            <CozyHomeLogo />
          </Link>
          <nav className="hidden items-center gap-0.5 lg:flex">
            {PUBLIC_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] transition-colors xl:px-2.5 xl:text-sm',
                  l.href === current
                    ? 'bg-walnut-soft font-medium text-walnut-deep'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {tn(l.key)}
              </Link>
            ))}
          </nav>
        </div>
        <nav className="flex shrink-0 items-center gap-2 text-sm">
          <span className="hidden lg:inline-flex">
            <LangSwitch />
          </span>
          {showCta && (
            <Button asChild variant="walnut" size="sm">
              <Link href="/requests/new">{tn('createRequest')}</Link>
            </Button>
          )}
          {me.data ? (
            <Button asChild variant="outline" size="sm" className="hidden lg:inline-flex">
              <Link href="/dashboard">{tn('dashboard')}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
                <Link href="/login">{tn('login')}</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="hidden xl:inline-flex">
                <Link href="/register">{tn('register')}</Link>
              </Button>
            </>
          )}
          <MobileNav
            className="lg:hidden"
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
