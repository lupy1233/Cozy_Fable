import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Badge — portat din prototip (.badge). Font mono, uppercase, pill.
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-micro uppercase tracking-[0.05em] leading-5 whitespace-nowrap',
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
// E-admin-platform-58: planurile sunt date — codurile necunoscute (planuri noi) primesc un stil
// neutru, iar textul afisat e numele planului (label) sau codul.
const TIER_CLASS: Record<string, string> = {
  PLATINUM: 'bg-gradient-to-br from-tier-platinum-from to-tier-platinum-to text-tier-platinum-fg',
  GOLD: 'bg-gradient-to-br from-tier-gold-from to-tier-gold-to text-tier-gold-fg',
  SILVER: 'bg-gradient-to-br from-tier-silver-from to-tier-silver-to text-tier-silver-fg',
};
const TIER_NEUTRAL = 'bg-secondary text-foreground border border-border-2';

export function TierBadge({ tier, label, className }: { tier: string; label?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-micro uppercase tracking-[0.05em] leading-5',
        TIER_CLASS[tier] ?? TIER_NEUTRAL,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label || tier}
    </span>
  );
}
