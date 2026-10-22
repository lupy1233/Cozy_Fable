import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from './card';

// EmptyState — gol / eroare / blocaj, acelasi tipar peste tot.
export interface EmptyStateProps {
  title: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  tone?: 'neutral' | 'warning' | 'error';
  /** card = chenar; dashed = chenar punctat; plain = fara chenar (in TD / in alt card) */
  variant?: 'card' | 'dashed' | 'plain';
  size?: 'sm' | 'md';
  role?: 'status' | 'alert';
  className?: string;
}

const CIRCLE: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  neutral: 'bg-walnut-soft text-walnut',
  warning: 'bg-amber-soft text-amber',
  error: 'bg-crimson-soft text-crimson',
};

export function EmptyState({
  title,
  hint,
  icon: Icon,
  action,
  tone = 'neutral',
  variant = 'plain',
  size = 'md',
  role,
  className,
}: EmptyStateProps) {
  const small = size === 'sm';
  const content = (
    <div
      role={role}
      className={cn(
        'flex flex-col items-center gap-3 text-center',
        small ? 'py-6' : 'py-12',
        variant === 'plain' && className,
      )}
    >
      {Icon && (
        <span className={cn('grid place-items-center rounded-full', small ? 'h-9 w-9' : 'h-12 w-12', CIRCLE[tone])}>
          <Icon className={small ? 'size-4' : 'size-5'} aria-hidden />
        </span>
      )}
      <div className={small ? 'text-sm text-muted-foreground' : 'heading-section'}>{title}</div>
      {hint && <p className={cn('text-sm text-muted-foreground', small ? 'max-w-prose' : 'max-w-sm')}>{hint}</p>}
      {action && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
  if (variant === 'plain') return content;
  return (
    <Card tone={variant === 'dashed' ? 'dashed' : 'default'} padding="none" className={className}>
      {content}
    </Card>
  );
}
