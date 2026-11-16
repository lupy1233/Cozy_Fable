'use client';

import { useLocale } from 'next-intl';
import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatDimensionRange } from '@/lib/dimension-format';
import { useDimensionField } from './use-dimension-field';

// Etapa 8 (41.4): O SINGURA componenta de dimensiune pentru piesele 3D (dulap, mobilier,
// catalog): eticheta + intervalul langa ea, glisor la 1 cm, camp text in cm cu virgula si
// mesajele de corectare din b7 (useDimensionField). 3D-ul ramane mereu in cm (D2b).

type DimensionField = ReturnType<typeof useDimensionField>;

// campul text cu "cm" in el — folosit si de dimensiunile cu lacat (LockableSize), ca
// aspectul sa fie acelasi peste tot
export function DimensionInputRow({
  field,
  id,
  label,
  compact = false,
}: {
  field: DimensionField;
  id?: string;
  // dat cand campul nu are <label> legat (numele accesibil)
  label?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('relative shrink-0', compact ? 'w-20' : 'w-24')}>
      <Input
        {...field.inputProps}
        id={id}
        aria-label={label}
        className={cn(
          'text-right',
          compact ? 'h-8 pr-7 text-sm' : 'pr-9',
          field.error && 'border-crimson',
        )}
      />
      <span
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground',
          compact ? 'right-2 text-micro' : 'right-3 text-xs',
        )}
      >
        cm
      </span>
    </div>
  );
}

// eroarea (role=alert) + nota de corectare (role=status, montata mereu, legata de camp)
export function DimensionFieldMessages({ field, className }: { field: DimensionField; className?: string }) {
  return (
    <>
      {field.error && (
        <p role="alert" className={cn('text-meta text-crimson', className)}>
          {field.error}
        </p>
      )}
      <p
        id={field.noteId}
        role="status"
        aria-live="polite"
        className={field.note ? cn('text-meta text-muted-foreground', className) : 'sr-only'}
      >
        {field.note}
      </p>
    </>
  );
}

const cmExact = (m: number) => Math.round(m * 1000) / 10;

export function PieceDimensionControl({
  label,
  minM,
  maxM,
  valueM,
  onValueM,
  id,
}: {
  label: string;
  minM: number;
  maxM: number;
  valueM: number;
  onValueM: (valueM: number) => void;
  id?: string;
}) {
  const locale = useLocale();
  const autoId = useId();
  const inputId = id ?? autoId;
  const field = useDimensionField({
    valueCm: cmExact(valueM),
    minCm: cmExact(minM),
    maxCm: cmExact(maxM),
    onValueCm: (v) => onValueM(v / 100),
  });
  return (
    <div>
      {/* intervalul sta langa eticheta (nu sub glisor) — un rand mai putin pe dimensiune */}
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
        <span className="text-meta text-muted-foreground">
          {formatDimensionRange(minM, maxM, { unit: 'cm', locale })}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={Math.round(minM * 100)}
          max={Math.round(maxM * 100)}
          step={1}
          value={Math.round(valueM * 100)}
          onChange={(e) => {
            field.reset();
            onValueM(Number(e.target.value) / 100);
          }}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-walnut"
          aria-label={label}
        />
        <DimensionInputRow field={field} id={inputId} />
      </div>
      <DimensionFieldMessages field={field} className="mt-1" />
    </div>
  );
}
