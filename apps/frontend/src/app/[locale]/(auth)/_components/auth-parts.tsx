import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Piese comune ale ecranelor de cont (design 2026-11).

// Plansa alba cu o randare de mobilier, asezata in stanga/dreapta cardului.
// Strict decor; apare doar de la xl (sub 1280px ar intra sub card).
export function AuthTile({ src, className }: { src: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'auth-tile pointer-events-none absolute hidden rounded-xl border border-border bg-surface p-2.5 xl:block',
        className,
      )}
    >
      <Image src={src} alt="" width={240} height={240} className="block aspect-square w-full object-contain" />
    </div>
  );
}

const STATE_TONE = {
  sage: 'bg-sage-soft text-sage',
  crimson: 'bg-crimson-soft text-crimson',
  walnut: 'bg-walnut-soft text-walnut',
} as const;

// Iconita de stare (trimis / confirmat / link invalid): fiecare stare are culoarea ei.
export function AuthStateIcon({ icon: Icon, tone }: { icon: LucideIcon; tone: keyof typeof STATE_TONE }) {
  return (
    <span aria-hidden className={cn('grid size-12 place-items-center rounded-full', STATE_TONE[tone])}>
      <Icon className="size-[22px]" />
    </span>
  );
}

export const authTitleCls = 'font-serif text-3xl leading-tight';
export const authFooterCls = 'border-t border-border pt-4 text-center text-sm text-muted-foreground';
export const authLinkCls = 'font-medium text-walnut underline-offset-4 hover:text-walnut-deep hover:underline';
