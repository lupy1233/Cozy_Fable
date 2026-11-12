'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Link, usePathname } from '@/i18n/routing';
import { CozyHomeMark } from '@/components/brand/logo';
import { useKpi } from '@/hooks/use-admin';
import { useMe, useSessionRole } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { AccountMenu } from '../_components/account-menu';
import { BellPlaceholder, NotificationBell } from '../_components/notification-bell';
import { LangSwitch } from '../_components/lang-switch';
import { activeHref } from '../_components/mobile-nav';
import { BillingReadinessBanner } from './_components/billing-readiness-banner';

// Meniul consolei, pe grupe (design 2026-11): intai ce e de rezolvat, apoi evidenta,
// continutul si configurarea. `count` = cheia contorului din KPI (doar unde exista date).
type NavKey =
  | 'dashboard'
  | 'companies'
  | 'disputes'
  | 'withdrawals'
  | 'payments'
  | 'requests'
  | 'users'
  | 'contactDetections'
  | 'audit'
  | 'inspiration'
  | 'settings'
  | 'sizing'
  | 'calendar'
  | 'jobs';
type CountKey = 'pendingCompanies' | 'openDisputes' | 'pendingPayments';
type NavItem = { href: string; key: NavKey; count?: CountKey };

const NAV_GROUPS: { group: 'todo' | 'records' | 'content' | 'config' | null; items: NavItem[] }[] = [
  { group: null, items: [{ href: '/admin', key: 'dashboard' }] },
  {
    group: 'todo',
    items: [
      { href: '/admin/companies', key: 'companies', count: 'pendingCompanies' },
      { href: '/admin/disputes', key: 'disputes', count: 'openDisputes' },
      { href: '/admin/withdrawals', key: 'withdrawals' },
      { href: '/admin/payments', key: 'payments', count: 'pendingPayments' },
    ],
  },
  {
    group: 'records',
    items: [
      // E-admin-platform-3: proiectele acceptate (cazuri raportate, intarziate, inchidere)
      { href: '/admin/requests', key: 'requests' },
      { href: '/admin/users', key: 'users' },
      // E-admin-platform-45: date de contact gasite in texte libere (read-only)
      { href: '/admin/contact-detections', key: 'contactDetections' },
      { href: '/admin/audit', key: 'audit' },
    ],
  },
  { group: 'content', items: [{ href: '/admin/inspiration', key: 'inspiration' }] },
  {
    group: 'config',
    items: [
      { href: '/admin/settings', key: 'settings' },
      // E-admin-platform-25: punctele optiunilor din chestionar si calendarul de lucru (punti)
      { href: '/admin/sizing', key: 'sizing' },
      { href: '/admin/calendar', key: 'calendar' },
      { href: '/admin/jobs', key: 'jobs' },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

// Contorul unui rand de meniu. Vine din KPI-ul existent (aceeasi cheie de query ca tabloul de
// bord, deci o singura cerere); se monteaza doar pentru admin, ca alt rol sa nu loveasca API-ul.
function NavCount({ countKey }: { countKey: CountKey }) {
  const t = useTranslations('Admin');
  const kpi = useKpi();
  const count =
    countKey === 'pendingCompanies'
      ? (kpi.data?.companiesByStatus?.PENDING_VERIFICATION ?? 0)
      : countKey === 'openDisputes'
        ? (kpi.data?.openDisputes ?? 0)
        : (kpi.data?.pendingPayments ?? 0);
  if (count <= 0) return null;
  return (
    <span className="grid h-5 min-w-[22px] place-items-center rounded-full bg-amber-soft px-1.5 font-mono text-meta leading-none text-amber">
      <span aria-hidden>{count > 99 ? '99+' : count}</span>
      <span className="sr-only">{t('navPending', { count })}</span>
    </span>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('Admin');
  // pathname fara prefixul de limba → potrivire exacta sau pe copil (cel mai specific castiga)
  const pathname = usePathname();
  const me = useMe();
  const { role, user } = useSessionRole();
  const isAdmin = me.data?.role === 'ADMIN';

  const current =
    activeHref(
      pathname,
      ALL_ITEMS.map((n) => n.href),
    ) ?? '/admin';
  const currentItem = ALL_ITEMS.find((n) => n.href === current);

  return (
    <div className="grid min-h-screen grid-cols-[264px_1fr]">
      <aside className="sticky top-0 flex h-screen flex-col gap-4 overflow-y-auto border-r border-border bg-surface px-3.5 pb-6 pt-5">
        <Link href="/admin" className="flex min-h-11 items-center gap-2.5 px-2">
          <CozyHomeMark className="h-[30px] w-[30px] shrink-0" />
          <span>
            <span className="block whitespace-nowrap font-serif text-sm uppercase leading-none tracking-[0.18em]">
              Cozy Home
            </span>
            <span className="mt-1 block font-mono text-micro text-muted-foreground">{t('console')}</span>
          </span>
        </Link>

        <nav aria-label={t('navHeading')} className="flex flex-col gap-4">
          {NAV_GROUPS.map((g) => (
            <div key={g.group ?? 'home'} className="flex flex-col gap-0.5">
              {g.group && <div className="label px-3 pb-1.5">{t(`navGroups.${g.group}`)}</div>}
              {g.items.map((n) => {
                const active = n.href === current;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-10 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-foreground font-medium text-background'
                        : 'text-ink-2 hover:bg-surface-3',
                    )}
                  >
                    <span>{t(`nav.${n.key}`)}</span>
                    {/* unde API-ul nu da un numar (retrageri), randul ramane fara contor */}
                    {n.count && isAdmin && <NavCount countKey={n.count} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Continut */}
      <div className="flex min-w-0 flex-col">
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-surface/90 px-8 py-3 backdrop-blur-md backdrop-saturate-150">
          {/* bara de sus spune unde esti */}
          <div className="flex min-h-10 items-center gap-2 text-ui text-muted-foreground">
            <span>{t('console')}</span>
            {currentItem && (
              <>
                <span aria-hidden>/</span>
                <span className="font-medium text-foreground">{t(`nav.${currentItem.key}`)}</span>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <LangSwitch />
            {/* B6: clopotelul doar pentru sesiuni active; adminul are si meniul de cont (logout) */}
            {user ? <NotificationBell /> : role ? <BellPlaceholder /> : null}
            {role && <AccountMenu role={role} />}
          </div>
        </div>
        <div className="min-w-0 flex-1 p-8">
          {/* E-admin-platform-4: date fiscale / mod test Stripe / e-Factura de raportat */}
          {isAdmin && <BillingReadinessBanner />}
          {children}
        </div>
      </div>
    </div>
  );
}
