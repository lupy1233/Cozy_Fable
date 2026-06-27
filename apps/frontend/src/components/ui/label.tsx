import * as React from 'react';
import { cn } from '@/lib/utils';

// Label — stil mono uppercase din prototip (.field label).
export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      'font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground',
      'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className,
    )}
    {...props}
  />
));
Label.displayName = 'Label';
