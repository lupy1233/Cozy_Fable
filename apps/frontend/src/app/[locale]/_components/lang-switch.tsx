'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';

// LangSwitch — comutator ro|en din topbar. Un singur buton: click oriunde pe
// pastila trece pe cealalta limba, nu mai trebuie tintita eticheta exacta.
// Pastreaza pathname-ul. B3: alegerea se salveaza in cookie (NEXT_LOCALE,
// 1 an) — middleware-ul o aplica la urmatoarele vizite pe "/", deci limba
// supravietuieste reload-urilor.
export function LangSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const locales = ['ro', 'en'] as const;
  const next = locale === 'ro' ? 'en' : 'ro';

  return (
    <button
      type="button"
      // eticheta in limba-tinta: cine cauta switch-ul intelege exact ce primeste
      aria-label={next === 'en' ? 'Switch to English' : 'Schimbă în română'}
      title={next === 'en' ? 'English' : 'Română'}
      onClick={() => {
        document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.replace(pathname as any, { locale: next });
      }}
      className="group inline-flex items-center rounded-full border border-border-2 bg-surface-2 p-0.5 font-mono text-[11px] uppercase transition-colors hover:border-muted-2"
    >
      {locales.map((l) => (
        <span
          key={l}
          className={cn(
            'rounded-full px-2 py-0.5 tracking-[0.06em] transition-colors',
            locale === l
              ? 'bg-foreground text-background'
              : 'text-muted-foreground group-hover:text-foreground',
          )}
        >
          {l}
        </span>
      ))}
    </button>
  );
}
