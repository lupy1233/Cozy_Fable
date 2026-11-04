import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { Card } from './card';

// StatCard — un singur tipar pentru cifre-cheie (dashboard, admin, portofel, credite).
export interface StatCardProps {
  label: string;
  /** numar sau suma deja formatata */
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  tone?: 'default' | 'warning' | 'danger' | 'muted';
  /** intreaga placa devine link */
  href?: string;
  trend?: { direction: 'up' | 'down' | 'flat'; label: string };
  /** card = cu chenar propriu; inline = in interiorul altui card (portofel, credite) */
  variant?: 'card' | 'inline';
  align?: 'start' | 'center';
  className?: string;
}

const TREND_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'default',
  href,
  trend,
  variant = 'card',
  align = 'start',
  className,
}: StatCardProps) {
  const inline = variant === 'inline';
  const valueClass = cn(
    'font-serif tracking-[-0.02em]',
    inline ? 'text-2xl' : 'mt-2 text-3xl',
    tone === 'muted' && 'text-muted-foreground',
    tone === 'danger' && 'text-crimson',
  );
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;
  const body = (
    <>
      {inline ? (
        <>
          <div className={valueClass}>{value}</div>
          <div className="label mt-1">{label}</div>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <span className="label">{label}</span>
            {Icon && <Icon className="size-4 shrink-0 text-walnut" aria-hidden />}
          </div>
          <div className={valueClass}>{value}</div>
        </>
      )}
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      {trend && TrendIcon && (
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <TrendIcon className="size-3" aria-hidden />
          {trend.label}
        </div>
      )}
    </>
  );
  const alignClass = align === 'center' ? 'text-center' : undefined;

  if (inline) {
    const inner = <div className={cn('rounded-lg bg-surface-2 p-3', alignClass, className)}>{body}</div>;
    return href ? (
      <Link href={href} className="block rounded-lg transition-colors hover:bg-secondary">
        {inner}
      </Link>
    ) : (
      inner
    );
  }

  const cardTone = tone === 'warning' ? 'amber' : tone === 'danger' ? 'crimson' : 'default';
  if (href) {
    return (
      <Card asChild tone={cardTone} interactive padding="sm" className={cn(alignClass, className)}>
        <Link href={href}>{body}</Link>
      </Card>
    );
  }
  return (
    <Card tone={cardTone} padding="sm" className={cn(alignClass, className)}>
      {body}
    </Card>
  );
}
