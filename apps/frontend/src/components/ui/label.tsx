import * as React from 'react';
import { cn } from '@/lib/utils';

// Label — eticheta de camp (design 2026-11): 13px, medium, fara majuscule; sta deasupra campului.
// Etichetele de sectiune (majuscule spatiate) raman clasa `.label` din globals.css.
export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      'text-ui font-medium text-foreground',
      'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className,
    )}
    {...props}
  />
));
Label.displayName = 'Label';
