'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CircleUserRound, KeyRound, LogOut } from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { useLogout, useMe } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { CozyHomeLogo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { NotificationBell } from './notification-bell';
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
export function AppHeader() {
  const t = useTranslations('Nav');
  const ta = useTranslations('Auth');
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const logout = useLogout();

  const links = me.data ? (NAV_BY_ROLE[me.data.role] ?? []) : [];
  const homeHref = me.data ? (HOME_BY_ROLE[me.data.role] ?? '/') : '/';
  const current = activeHref(
    pathname,
    links.map((l) => l.href),
  );
  // eticheta rolului din i18n (Auth.role.*); rol necunoscut → codul brut
  const roleLabel = me.data
    ? ta.has(`role.${me.data.role}`)
      ? ta(`role.${me.data.role}`)
      : me.data.role
    : '';

  // meniul de cont (rol + schimbare parola + deconectare): se inchide la click
  // in afara, Escape si la schimbarea rutei
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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
                    'whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] transition-colors xl:px-2.5 xl:text-sm',
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
          {me.data && <NotificationBell />}
          {me.data && (
            <div ref={menuRef} className="relative">
              <Button
                variant="outline"
                size="sm"
                aria-label={t('accountMenu')}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="px-2 xl:px-3"
              >
                <CircleUserRound className="size-4" />
                <span className="hidden xl:inline">{roleLabel}</span>
              </Button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-lg"
                >
                  <div className="flex items-center gap-1.5 px-2.5 py-2 font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                    {roleLabel}
                  </div>
                  <Link
                    role="menuitem"
                    href="/change-password"
                    className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-secondary"
                  >
                    <KeyRound className="size-4 text-muted-foreground" />
                    {t('changePassword')}
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={logout.isPending}
                    onClick={() =>
                      logout.mutate(undefined, { onSuccess: () => router.replace('/login') })
                    }
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-secondary disabled:opacity-50"
                  >
                    <LogOut className="size-4 text-muted-foreground" />
                    {t('logout')}
                  </button>
                </div>
              )}
            </div>
          )}
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
