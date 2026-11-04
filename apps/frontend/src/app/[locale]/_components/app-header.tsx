'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { useSessionRole } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { CozyHomeLogo } from '@/components/brand/logo';
import { AccountMenu } from './account-menu';
import { BellPlaceholder, NotificationBell } from './notification-bell';
import { LangSwitch } from './lang-switch';
import { MobileNav, activeHref } from './mobile-nav';

// Link-urile de navigatie principale per rol. Headerul e singura sursa de
// navigatie pentru zonele client/firma (adminul are sidebar propriu).
const NAV_BY_ROLE: Record<string, { href: string; key: string }[]> = {
  CLIENT: [
    { href: '/dashboard', key: 'dashboard' },
    { href: '/requests', key: 'myRequests' },
    { href: '/requests/new', key: 'newRequest' },
  ],
  COMPANY_USER: [
    { href: '/dashboard', key: 'dashboard' },
    { href: '/company', key: 'company' },
    { href: '/marketplace', key: 'marketplace' },
    { href: '/marketplace/claims', key: 'claims' },
    { href: '/marketplace/messages', key: 'messages' },
    { href: '/marketplace/wallet', key: 'wallet' },
  ],
  ADMIN: [{ href: '/admin', key: 'admin' }],
};

// Logo-ul duce "acasa" in functie de rol: clientul pe landing (Pinterest, ghid
// schita, parteneri — Faza D), firma direct in marketplace, adminul in consola.
const HOME_BY_ROLE: Record<string, string> = {
  CLIENT: '/',
  COMPANY_USER: '/marketplace',
  ADMIN: '/admin',
};

// Aceeasi inaltime (py-2.5) si acelasi prag pentru nav (lg) ca PublicHeader,
// ca headerul sa nu "sara" la trecerea landing ↔ cont. Cele 6 linkuri ale
// firmei + lang + clopotel + meniul de cont incap de la 1024px (~920px RO)
// doar pentru ca eticheta rolului din butonul de cont apare abia de la xl.
// Rolul vine din indiciul de sesiune (cookie mm_session, randat pe server) cat useMe e pending,
// deci navigatia rolului apare de la primul paint, fara saltul „header minimal → meniu complet".
export function AppHeader() {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const { role, user } = useSessionRole();

  const links = role ? (NAV_BY_ROLE[role] ?? []) : [];
  const homeHref = role ? (HOME_BY_ROLE[role] ?? '/') : '/';
  const current = activeHref(
    pathname,
    links.map((l) => l.href),
  );

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-5">
          <Link href={homeHref} className="shrink-0">
            <CozyHomeLogo />
          </Link>
          {/* sub lg linkurile se muta in meniul hamburger */}
          <nav className="hidden items-center gap-0.5 lg:flex">
            {links.map((l) => {
              const active = l.href === current;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'whitespace-nowrap rounded-md px-2 py-1.5 text-ui transition-colors xl:px-2.5 xl:text-sm',
                    active
                      ? 'bg-walnut-soft font-medium text-walnut-deep'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  {t(l.key)}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <LangSwitch />
          {/* B6: clopotelul DOAR pentru sesiuni active — vizitatorii nelogati
              nu au notificari (si nici API-ul nu i-ar servi) */}
          {user ? <NotificationBell /> : role ? <BellPlaceholder /> : null}
          {role && <AccountMenu role={role} />}
          {links.length > 0 && (
            <MobileNav
              className="lg:hidden"
              links={links.map((l) => ({ href: l.href, label: t(l.key) }))}
            />
          )}
        </div>
      </div>
    </header>
  );
}
