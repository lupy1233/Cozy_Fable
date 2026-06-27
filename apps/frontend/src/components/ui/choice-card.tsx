import * as React from 'react';
import { cn } from '@/lib/utils';

// ChoiceCard — card selectabil (din prototip .choice/.pick). Radio sau checkbox.
export function ChoiceCard({
  selected,
  onSelect,
  title,
  sub,
  points,
  icon,
  className,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  title: React.ReactNode;
  sub?: React.ReactNode;
  points?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border p-3.5 text-left shadow-sm transition-all duration-150 ease-ease',
        'hover:-translate-y-px hover:border-muted-2 hover:bg-secondary',
        selected
          ? 'border-walnut bg-walnut-soft shadow-[0_0_0_3px_hsl(var(--walnut)/0.14)]'
          : 'border-border-2 bg-surface',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <span
        className={cn(
          'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-[1.5px]',
          selected ? 'border-walnut bg-walnut' : 'border-border-2',
        )}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-background" />}
      </span>
      {icon && <span className="shrink-0 text-walnut [&_svg]:size-5">{icon}</span>}
      <span className="flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{title}</span>
          {points != null && (
            <span className="rounded-full bg-walnut-soft px-2 py-0.5 font-mono text-[11px] text-walnut">
              {points}
            </span>
          )}
        </span>
        {sub && <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{sub}</span>}
      </span>
    </button>
  );
}
