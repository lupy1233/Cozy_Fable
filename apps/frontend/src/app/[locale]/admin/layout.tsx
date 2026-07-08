'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { CozyHomeMark } from '@/components/brand/logo';
import { cn } from '@/lib/utils';
import { NotificationBell } from '../_components/notification-bell';
import { LangSwitch } from '../_components/lang-switch';

const NAV = [
  { href: '/admin', key: 'dashboard' },
  { href: '/admin/companies', key: 'companies' },
  { href: '/admin/inspiration', key: 'inspiration' },
  { href: '/admin/disputes', key: 'disputes' },
  { href: '/admin/payments', key: 'payments' },
  { href: '/admin/withdrawals', key: 'withdrawals' },
  { href: '/admin/audit', key: 'audit' },
  { href: '/admin/settings', key: 'settings' },
  { href: '/admin/jobs', key: 'jobs' },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('Admin');
  const pathname = usePathname();

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr]">
      {/* Sidebar — portat din prototip (.sidebar) */}
      <aside className="sticky top-0 flex h-screen flex-col gap-5 overflow-y-auto border-r border-border bg-gradient-to-b from-surface-2 to-surface px-4 pb-4 pt-6">
        <Link href="/admin" className="flex items-center gap-2.5 border-b border-border px-2 pb-4">
          <CozyHomeMark className="h-[30px] w-[30px] shrink-0" />
          <span>
            <span className="block whitespace-nowrap font-serif text-[15px] uppercase leading-none tracking-[0.14em]">
              Cozy Home
            </span>
            <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
              {t('console')}
            </span>
          </span>
        </Link>

        <nav className="flex flex-col gap-0.5">
          <div className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">
            Admin
          </div>
          {NAV.map((n) => {
            const active = n.href === '/admin' ? pathname.endsWith('/admin') : pathname.includes(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] transition-colors',
                  active
                    ? 'bg-gradient-to-r from-foreground to-ink-2 text-background shadow-sm'
                    : 'text-ink-2 hover:bg-surface-3',
                )}
              >
                <span
                  className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-background' : 'bg-muted-2')}
                />
                {t(`nav.${n.key}`)}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
          Plan · panou operational
        </div>
      </aside>

      {/* Continut */}
      <div className="flex min-w-0 flex-col">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-surface/80 px-8 py-3 backdrop-blur-md backdrop-saturate-150">
          <div className="ml-auto flex items-center gap-2.5">
            <LangSwitch />
            <NotificationBell />
          </div>
        </div>
        <div className="min-w-0 flex-1 p-8">{children}</div>
      </div>
    </div>
  );
}
