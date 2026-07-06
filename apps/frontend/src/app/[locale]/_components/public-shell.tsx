'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { CozyHomeLogo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { MobileNav } from './mobile-nav';

// Shell pentru paginile publice (landing, parteneri, inspiratie, ghid schita):
// logo → landing, linkuri publice, login/register sau "Contul meu" daca e logat.
const PUBLIC_LINKS = [
  { href: '/partners', key: 'partners' },
  { href: '/inspiration', key: 'inspiration' },
  { href: '/sketch-guide', key: 'sketchGuide' },
] as const;

export function PublicShell({ children }: { children: ReactNode }) {
  const tn = useTranslations('Nav');
  const pathname = usePathname();
  const me = useMe();

  return (
    <div className="min-h-screen">
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
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
          {me.data ? (
            <Button asChild size="sm">
              <Link href="/dashboard">{tn('dashboard')}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">{tn('login')}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">{tn('register')}</Link>
              </Button>
            </>
          )}
          <MobileNav
            className="sm:hidden"
            links={PUBLIC_LINKS.map((l) => ({ href: l.href, label: tn(l.key) }))}
            footer={
              !me.data && (
                <Link
                  href="/login"
                  className="block rounded-md px-3 py-2.5 text-[15px] text-foreground transition-colors hover:bg-secondary"
                >
                  {tn('login')}
                </Link>
              )
            }
          />
        </nav>
      </header>
      <main className="mx-auto max-w-6xl animate-pageIn px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
