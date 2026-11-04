import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

// Field — wrapper label + control + eroare (din prototip .field).
// Pasul 6 (audit A16, a11y): labelul se leaga PROGRAMATIC de control — daca apelantul nu
// da htmlFor/id, generam un id stabil (useId) si il punem pe label SI pe primul copil
// (input/textarea/select). Inainte, label-urile de pe login/register aveau htmlFor gol.
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
  const autoId = React.useId();
  const controlId = htmlFor ?? autoId;
  // ataseaza id-ul primului element-copil care nu are deja unul
  let wired = false;
  const content = React.Children.map(children, (child) => {
    if (wired || !React.isValidElement(child)) return child;
    const existing = (child.props as { id?: string }).id;
    wired = true;
    if (existing || htmlFor) return child; // apelantul si-a legat singur controlul
    return React.cloneElement(child as React.ReactElement<{ id?: string }>, { id: controlId });
  });
  const labelFor = htmlFor ?? (wired ? controlId : undefined);
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <Label htmlFor={labelFor}>{label}</Label>}
      {content}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-crimson">{error}</p>}
    </div>
  );
}
