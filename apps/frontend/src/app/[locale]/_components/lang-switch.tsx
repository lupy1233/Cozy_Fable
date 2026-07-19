'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';

// LangSwitch — segment ro|en din topbar-ul prototipului. Pastreaza pathname-ul.
// B3: alegerea se salveaza in cookie (NEXT_LOCALE, 1 an) — middleware-ul o
// aplica la urmatoarele vizite pe "/", deci limba supravietuieste reload-urilor.
export function LangSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const locales = ['ro', 'en'] as const;

  return (
    <div className="inline-flex items-center rounded-full border border-border-2 bg-surface-2 p-0.5 font-mono text-[11px] uppercase">
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => {
            document.cookie = `NEXT_LOCALE=${l}; path=/; max-age=31536000; samesite=lax`;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            router.replace(pathname as any, { locale: l });
          }}
          className={cn(
            'rounded-full px-2 py-0.5 tracking-[0.06em] transition-colors',
            locale === l ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
