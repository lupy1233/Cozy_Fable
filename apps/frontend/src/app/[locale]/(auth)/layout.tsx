import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { CozyHomeLogo } from '@/components/brand/logo';
import { LangSwitch } from '../_components/lang-switch';
import { AuthFrieze } from './_components/auth-frieze';
import { AuthTile } from './_components/auth-parts';

// Shell-ul ecranelor de cont (design 2026-11, varianta B aleasa de PO): fundal in degrade
// nuc → ivoriu, sigla si o fraza sus, un singur card la mijloc, planse de mobilier in
// stanga si in dreapta (doar de la xl), friza desenata jos. Acelasi invelis pe toate
// cele sase ecrane; cardul primeste pagina.
const TILES = [
  { src: '/illustrations/options/kitchen-layout-l.png', cls: 'left-0 top-9 w-[236px]' },
  { src: '/illustrations/options/wardrobe-hinged.png', cls: 'left-[186px] top-[262px] w-[190px]' },
  { src: '/illustrations/options/tv-floating.png', cls: 'right-0 top-16 w-[216px]' },
  { src: '/illustrations/options/dressing-layout-walk-in.png', cls: 'right-[176px] top-[276px] w-[200px]' },
] as const;

export default function AuthLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('Auth');
  return (
    <div className="auth-backdrop relative flex min-h-screen flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0">
        <AuthFrieze />
      </div>
      <div className="relative flex justify-end px-4 pt-5 sm:px-6">
        <LangSwitch />
      </div>
      <main className="relative flex flex-1 flex-col items-center gap-5 px-4 pb-24 pt-5 sm:px-6 sm:pb-36 lg:pb-44 xl:pb-[200px]">
        <Link href="/" className="auth-brand flex min-h-11 items-center text-on-walnut">
          <CozyHomeLogo size="lg" />
        </Link>
        <p className="max-w-2xl text-center font-serif text-2xl leading-tight text-on-walnut sm:text-3xl">
          {t('taglineLead')} <span className="auth-accent">{t('taglineAccent')}</span>
        </p>
        <div className="relative flex w-full max-w-[1180px] flex-col items-center">
          {TILES.map((tile) => (
            <AuthTile key={tile.src} src={tile.src} className={tile.cls} />
          ))}
          <div className="auth-card relative w-full max-w-[440px] animate-pageIn rounded-xl border border-border bg-surface p-6 sm:p-9">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
