'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { useLogout, useMe } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { NotificationBell } from './notification-bell';
import { LangSwitch } from './lang-switch';

// Link-urile de navigatie principale per rol. Headerul e singura sursa de
// navigatie pentru zonele client/firma (adminul are sidebar propriu).
const NAV_BY_ROLE: Record<string, { href: string; key: string }[]> = {
  CLIENT: [
    { href: '/requests', key: 'myRequests' },
    { href: '/requests/new', key: 'newRequest' },
  ],
  COMPANY_USER: [
    { href: '/company', key: 'company' },
    { href: '/marketplace', key: 'marketplace' },
    { href: '/marketplace/wallet', key: 'wallet' },
  ],
  ADMIN: [{ href: '/admin', key: 'admin' }],
};

const ROLE_LABEL: Record<string, string> = {
  CLIENT: 'Client',
  COMPANY_USER: 'Atelier',
  ADMIN: 'Admin',
};

export function AppHeader() {
  const t = useTranslations('Nav');
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const logout = useLogout();

  const links = me.data ? (NAV_BY_ROLE[me.data.role] ?? []) : [];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-gradient-to-br from-foreground to-ink-2 font-serif text-lg italic text-background shadow-sm">
              P
            </span>
            <span className="font-serif text-xl leading-none tracking-[-0.02em]">Plan</span>
          </Link>
          <nav className="flex items-center gap-1">
            {links.map((l) => {
              const active = pathname.endsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-foreground text-background shadow-sm'
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
          <NotificationBell />
          {me.data && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout.mutate(undefined, { onSuccess: () => router.replace('/login') })}
            >
              <LogOut className="size-4" />
              {t('logout')}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
