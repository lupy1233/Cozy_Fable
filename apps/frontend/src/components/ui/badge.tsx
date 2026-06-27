import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Badge — portat din prototip (.badge). Font mono, uppercase, pill.
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.05em] leading-5 whitespace-nowrap',
  {
    variants: {
      tone: {
        muted: 'bg-secondary text-muted-foreground border border-border-2',
        outline: 'bg-transparent text-muted-foreground border border-border-2',
        sage: 'bg-sage-soft text-sage',
        amber: 'bg-amber-soft text-amber',
        crimson: 'bg-crimson-soft text-crimson',
        info: 'bg-info-soft text-info',
        walnut: 'bg-walnut-soft text-walnut',
        ink: 'bg-foreground text-background',
      },
    },
    defaultVariants: { tone: 'muted' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

// StatusBadge — mapeaza statusurile pe tone + label key (i18n in pagina apelanta).
type Tone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;
export const STATUS_TONE: Record<string, Tone> = {
  DRAFT: 'muted',
  PUBLISHED: 'info',
  CLAIMED: 'walnut',
  NEGOTIATION: 'amber',
  OFFER_SENT: 'info',
  ACCEPTED: 'sage',
  REJECTED: 'crimson',
  EXPIRED: 'muted',
  IN_PROGRESS: 'walnut',
  COMPLETED: 'sage',
  SMALL: 'muted',
  MEDIUM: 'walnut',
  LARGE: 'ink',
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  return (
    <Badge tone={STATUS_TONE[status] ?? 'muted'} dot className={className}>
      {label ?? status}
    </Badge>
  );
}

// TierBadge — ribbon cu gradient pentru planuri.
const TIER_CLASS: Record<string, string> = {
  PLATINUM: 'bg-gradient-to-br from-[#2E2A24] to-[#5C534A] text-[#F4EFE6]',
  GOLD: 'bg-gradient-to-br from-[#B07F1E] to-[#D4A547] text-[#FFF8E6]',
  SILVER: 'bg-gradient-to-br from-[#8A8378] to-[#B0A99B] text-[#F4EFE6]',
};

export function TierBadge({ tier, className }: { tier: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.05em] leading-5',
        TIER_CLASS[tier] ?? TIER_CLASS.SILVER,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {tier}
    </span>
  );
}
