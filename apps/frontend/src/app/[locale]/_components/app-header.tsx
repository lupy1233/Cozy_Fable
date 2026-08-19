'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { useLogout, useMe } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { CozyHomeLogo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { NotificationBell } from './notification-bell';
import { LangSwitch } from './lang-switch';
import { MobileNav } from './mobile-nav';

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

const ROLE_LABEL: Record<string, string> = {
  CLIENT: 'Client',
  COMPANY_USER: 'Firmă',
  ADMIN: 'Admin',
};

export function AppHeader() {
  const t = useTranslations('Nav');
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const logout = useLogout();

  const links = me.data ? (NAV_BY_ROLE[me.data.role] ?? []) : [];
  const homeHref = me.data ? (HOME_BY_ROLE[me.data.role] ?? '/') : '/';

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex items-center gap-6">
          <Link href={homeHref}>
            <CozyHomeLogo />
          </Link>
          {/* pe mobil linkurile se muta in meniul hamburger */}
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active = pathname.endsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
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
        <div className="flex items-center gap-2.5">
          {me.data && (
            <span className="hidden items-center gap-1.5 rounded-full border border-border-2 bg-surface-2 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              {ROLE_LABEL[me.data.role] ?? me.data.role}
            </span>
          )}
          <LangSwitch />
          {/* B6: clopotelul DOAR pentru sesiuni active — vizitatorii nelogati
              nu au notificari (si nici API-ul nu i-ar servi) */}
          {me.data && <NotificationBell />}
          {me.data && (
            <Button
              variant="outline"
              size="sm"
              aria-label={t('logout')}
              onClick={() => logout.mutate(undefined, { onSuccess: () => router.replace('/login') })}
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">{t('logout')}</span>
            </Button>
          )}
          {links.length > 0 && (
            <MobileNav
              className="md:hidden"
              links={links.map((l) => ({ href: l.href, label: t(l.key) }))}
            />
          )}
        </div>
      </div>
    </header>
  );
}
