'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Meniu de navigatie pentru mobil: buton hamburger + panou sub header.
// Headerul care il gazduieste trebuie sa fie pozitionat (relative/sticky),
// panoul se ancoreaza cu absolute la baza lui. Se inchide singur la
// schimbarea rutei si la Escape.

export type MobileNavLink = { href: string; label: string };

export function MobileNav({
  links,
  footer,
  className,
}: {
  links: readonly MobileNavLink[];
  /** Zona optionala de sub linkuri (ex. login) — separata cu hairline. */
  footer?: ReactNode;
  className?: string;
}) {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // inchide panoul cand ruta se schimba
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={className}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('menu')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </Button>
      {open && (
        <nav className="absolute inset-x-0 top-full z-40 animate-pageIn border-b border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur-md">
          <div className="flex flex-col gap-0.5">
            {links.map((l) => {
              const active = pathname.endsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'rounded-md px-3 py-2.5 text-[15px] transition-colors',
                    active
                      ? 'bg-walnut-soft font-medium text-walnut-deep'
                      : 'text-foreground hover:bg-secondary',
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
          {footer && <div className="mt-2 border-t border-border pt-3">{footer}</div>}
        </nav>
      )}
    </div>
  );
}
