'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

// FilterChips — pastile de filtru: un singur stil, grup etichetat, aria-pressed.
export interface FilterChipOption<V extends string> {
  value: V;
  label: React.ReactNode;
  count?: number;
  /** inainte de eticheta */
  icon?: React.ReactNode;
  /** dupa eticheta (ex. punct de necitit) */
  indicator?: React.ReactNode;
  /** opacity-50 cand neselectat (ex. numar 0) */
  dimmed?: boolean;
  disabled?: boolean;
}

type SingleProps<V extends string> = {
  multiple?: false;
  value: V | null;
  onChange: (value: V | null) => void;
  /** click pe cel activ → onChange(null) */
  allowDeselect?: boolean;
};
type MultiProps<V extends string> = {
  multiple: true;
  value: V[];
  onChange: (value: V[]) => void;
};

export type FilterChipsProps<V extends string> = (SingleProps<V> | MultiProps<V>) & {
  options: readonly FilterChipOption<V>[];
  /** aria-label pe grup */
  label: string;
  size?: 'sm' | 'md';
  className?: string;
};

export function FilterChips<V extends string>(props: FilterChipsProps<V>) {
  const { options, label, size = 'md', className } = props;

  const isSelected = (v: V) => (props.multiple ? props.value.includes(v) : props.value === v);

  const toggle = (v: V) => {
    if (props.multiple) {
      props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    } else if (props.value === v && props.allowDeselect) {
      props.onChange(null);
    } else {
      props.onChange(v);
    }
  };

  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o) => {
        const selected = isSelected(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            disabled={o.disabled}
            onClick={() => toggle(o.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border transition-colors disabled:opacity-50',
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              selected
                ? 'border-walnut bg-walnut text-primary-foreground'
                : 'border-border-2 bg-surface text-muted-foreground hover:border-muted-2 hover:text-foreground',
              o.dimmed && !selected && 'opacity-50',
            )}
          >
            {o.icon}
            {o.label}
            {o.count !== undefined && <span className="ml-1.5 font-mono text-xs opacity-75">{o.count}</span>}
            {o.indicator}
          </button>
        );
      })}
    </div>
  );
}
