'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

// Tabs — controlat, stil din prototip (.tabs/.tab). Underline accent.
export function Tabs({
  tabs,
  current,
  onChange,
  className,
  panelId,
  label,
}: {
  tabs: { value: string; label: React.ReactNode }[];
  current: string;
  onChange: (value: string) => void;
  className?: string;
  panelId: string;
  label: string;
}) {
  const buttons = React.useRef<(HTMLButtonElement | null)[]>([]);
  const selectAt = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    buttons.current[index]?.focus();
    onChange(tab.value);
  };
  return (
    <div className={cn('mb-5 flex gap-1 border-b border-border', className)} role="tablist" aria-label={label}>
      {tabs.map((t, index) => {
        const active = current === t.value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            id={`${panelId}-tab-${t.value}`}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            ref={(node) => { buttons.current[index] = node; }}
            aria-selected={active}
            onKeyDown={(event) => {
              const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
              let next: number | undefined;
              if (event.key === 'Home') next = 0;
              if (event.key === 'End') next = tabs.length - 1;
              if (event.key === 'ArrowRight') next = (index + (rtl ? -1 : 1) + tabs.length) % tabs.length;
              if (event.key === 'ArrowLeft') next = (index + (rtl ? 1 : -1) + tabs.length) % tabs.length;
              if (next !== undefined) {
                event.preventDefault();
                selectAt(next);
              }
            }}
            onClick={() => onChange(t.value)}
            className={cn(
              '-mb-px min-h-11 border-b-2 px-3.5 py-2.5 text-meta font-medium uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-walnut',
              active
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-ink-2',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
