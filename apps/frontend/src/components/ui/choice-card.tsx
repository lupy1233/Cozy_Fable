import * as React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// ChoiceCard — card selectabil (din prototip .choice/.pick). Radio sau checkbox.
// Butonul Info (colt dreapta-sus) e optional; nu poate fi un <button> nested in
// alt <button>, deci cardul e un <div role=button> cu butonul principal separat.
export function ChoiceCard({
  selected,
  onSelect,
  onInfo,
  multi,
  title,
  sub,
  points,
  icon,
  className,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  onInfo?: () => void;
  multi?: boolean;
  title: React.ReactNode;
  sub?: React.ReactNode;
  points?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative flex w-full items-center gap-3 rounded-lg border p-3.5 text-left shadow-sm transition-all duration-150 ease-ease',
        'hover:-translate-y-px hover:border-muted-2 hover:bg-secondary',
        selected
          ? 'border-walnut bg-walnut-soft shadow-[0_0_0_3px_hsl(var(--walnut)/0.14)]'
          : 'border-border-2 bg-surface',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        aria-pressed={selected}
        className="flex flex-1 items-center gap-3 text-left focus:outline-none"
      >
        <span
          className={cn(
            'grid h-[18px] w-[18px] shrink-0 place-items-center border-[1.5px]',
            multi ? 'rounded-[5px]' : 'rounded-full',
            selected ? 'border-walnut bg-walnut' : 'border-border-2',
          )}
        >
          {selected && (
            <span
              className={cn(
                'bg-background',
                multi ? 'h-2 w-2 rounded-[2px]' : 'h-1.5 w-1.5 rounded-full',
              )}
            />
          )}
        </span>
        {icon && <span className="shrink-0 text-walnut [&_svg]:size-5">{icon}</span>}
        <span className="flex-1">
          <span className="flex items-center justify-between gap-2 pr-6">
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

      {onInfo && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInfo();
          }}
          aria-label="info"
          className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-walnut-soft hover:text-walnut"
        >
          <Info className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
