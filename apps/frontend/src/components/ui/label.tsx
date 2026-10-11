import * as React from 'react';
import { cn } from '@/lib/utils';

// Label — stil .label (sans uppercase spatiat).
export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      'text-meta font-medium uppercase tracking-[0.08em] text-muted-foreground',
      'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className,
    )}
    {...props}
  />
));
Label.displayName = 'Label';
