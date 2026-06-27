import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

// Field — wrapper label + control + eroare (din prototip .field).
export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  error?: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-crimson">{error}</p>}
    </div>
  );
}
