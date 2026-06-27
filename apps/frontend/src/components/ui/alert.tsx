import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Alert — portat din prototip (.alert). Tonuri soft.
const alertVariants = cva('flex gap-3 rounded-md border p-4 text-sm', {
  variants: {
    tone: {
      info: 'bg-info-soft border-info/25 text-info',
      amber: 'bg-amber-soft border-amber/25 text-amber',
      crimson: 'bg-crimson-soft border-crimson/25 text-crimson',
      sage: 'bg-sage-soft border-sage/25 text-sage',
      neutral: 'bg-secondary border-border text-foreground',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  action?: React.ReactNode;
}

export function Alert({ className, tone, icon, title, action, children, ...props }: AlertProps) {
  return (
    <div className={cn(alertVariants({ tone }), className)} {...props}>
      {icon && <div className="shrink-0 [&_svg]:size-4">{icon}</div>}
      <div className="flex-1">
        {title && <div className="mb-0.5 font-medium">{title}</div>}
        {children && <div className="text-current/85">{children}</div>}
      </div>
      {action}
    </div>
  );
}
