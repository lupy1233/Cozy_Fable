'use client';

import { Coins, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { useSessionRole } from '@/hooks/use-auth';
import { useThreads } from '@/hooks/use-chat';
import { useWallet } from '@/hooks/use-marketplace';
import { cn } from '@/lib/utils';
import { CozyHomeLogo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { AccountMenu } from './account-menu';
import { BellPlaceholder, NotificationBell } from './notification-bell';
import { LangSwitch } from './lang-switch';
import { MobileNav, activeHref } from './mobile-nav';

// Link-urile de navigatie principale per rol. Headerul e singura sursa de
// navigatie pentru zonele client/firma (adminul are sidebar propriu).
// Design 2026-11: in meniu stau LOCURILE; actiunea („Cerere noua") e buton.
// Clientul ajunge din cont si la Caietul de idei si la Studio 3D.
const NAV_BY_ROLE: Record<string, { href: string; key: string }[]> = {
  CLIENT: [
    { href: '/dashboard', key: 'panel' },
    { href: '/requests', key: 'myRequests' },
    { href: '/inspiration', key: 'inspiration' },
    { href: '/studio', key: 'studio' },
  ],
  COMPANY_USER: [
    { href: '/dashboard', key: 'panel' },
    { href: '/marketplace', key: 'marketplace' },
    { href: '/marketplace/claims', key: 'claims' },
    { href: '/marketplace/messages', key: 'messages' },
    { href: '/marketplace/wallet', key: 'wallet' },
    { href: '/company', key: 'company' },
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

// Pe ecranele chestionarului (cerere noua / editare) butonul „Cerere noua" ar concura
// cu „Continua": acolo nu apare.
const isWizardPath = (pathname: string) =>
  pathname.startsWith('/requests/new') || /^\/requests\/[^/]+\/edit(\/|$)/.test(pathname);

// Creditele firmei, mereu la vedere (design 2026-11). Angajatii fara acces la portofel
// primesc eroare de la API → pastila nu apare deloc.
function CreditsPill() {
  const t = useTranslations('Nav');
  const wallet = useWallet();
  if (wallet.isError) return null;
  const value = wallet.data ? String(wallet.data.available) : '—';
  return (
    <Link
      href="/marketplace/wallet"
      aria-label={wallet.data ? t('creditsAria', { count: wallet.data.available }) : t('credits')}
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border-2 bg-surface-2 px-3 transition-colors hover:border-muted-2 xl:px-3.5"
    >
      <Coins className="size-4 text-walnut xl:hidden" aria-hidden />
      <span className="label hidden xl:inline">{t('credits')}</span>
      <span className="font-mono text-ui font-medium tabular-nums">{value}</span>
    </Link>
  );
}

// Mesaje necitite pe linkul „Mesaje" (suma pe conversatiile cu clientii).
function UnreadMessagesBadge() {
  const t = useTranslations('Nav');
  const threads = useThreads('company');
  const unread = (threads.data ?? []).reduce((sum, th) => sum + th.unreadCount, 0);
  if (unread === 0) return null;
  return (
    <>
      <span
        aria-hidden
        className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-crimson px-1 font-mono text-meta leading-none text-destructive-foreground"
      >
        {unread > 99 ? '99+' : unread}
      </span>
      <span className="sr-only">{t('unreadCount', { count: unread })}</span>
    </>
  );
}

// Aceeasi inaltime si acelasi prag pentru nav (lg) ca PublicHeader, ca headerul sa nu
// "sara" la trecerea landing ↔ cont. Rolul vine din indiciul de sesiune (cookie mm_session,
// randat pe server) cat useMe e pending, deci navigatia rolului apare de la primul paint,
// fara saltul „header minimal → meniu complet". Datele firmei (credite, necitite) se cer
// abia cand sesiunea e confirmata (user), ca vizitatorul cu cookie expirat sa nu loveasca API-ul.
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
  const firmSession = role === 'COMPANY_USER' && !!user;
  const showCta = role === 'CLIENT' && !isWizardPath(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4 xl:gap-6">
          <Link href={homeHref} aria-label="Cozy Home" className="shrink-0">
            <CozyHomeLogo compactOnMobile={role !== null} />
          </Link>
          {/* sub lg linkurile se muta in meniul hamburger */}
          <nav aria-label={t('mainNav')} className="hidden items-center gap-0.5 lg:flex xl:gap-1">
            {links.map((l) => {
              const active = l.href === current;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-2 text-ui transition-colors xl:px-3 xl:py-2.5 xl:text-sm',
                    active
                      ? 'bg-walnut-soft font-medium text-walnut-deep'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  {t(l.key)}
                  {firmSession && l.key === 'messages' && <UnreadMessagesBadge />}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          {firmSession && <CreditsPill />}
          <span className="hidden sm:inline-flex">
            <LangSwitch />
          </span>
          {/* B6: clopotelul DOAR pentru sesiuni active — vizitatorii nelogati
              nu au notificari (si nici API-ul nu i-ar servi) */}
          {user ? <NotificationBell /> : role ? <BellPlaceholder /> : null}
          {role && <AccountMenu role={role} />}
          {showCta && (
            <Button asChild variant="walnut" size="lg" className="h-10 px-2.5 md:px-4">
              <Link href="/requests/new" aria-label={t('newRequest')}>
                <Plus aria-hidden />
                <span className="hidden md:inline">{t('newRequest')}</span>
              </Link>
            </Button>
          )}
          {links.length > 0 && (
            <MobileNav
              className="lg:hidden"
              links={links.map((l) => ({ href: l.href, label: t(l.key) }))}
              footer={
                <div className="px-3 pb-1 sm:hidden">
                  <LangSwitch />
                </div>
              }
            />
          )}
        </div>
      </div>
    </header>
  );
}
