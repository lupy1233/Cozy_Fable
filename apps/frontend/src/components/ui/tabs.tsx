'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

// Tabs — controlat, stil din prototip (.tabs/.tab). Underline accent.
export function Tabs({
  tabs,
  current,
  onChange,
  className,
}: {
  tabs: { value: string; label: React.ReactNode }[];
  current: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex gap-1 border-b border-border', className)} role="tablist">
      {tabs.map((t) => {
        const active = current === t.value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              '-mb-px border-b-2 px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.04em] transition-colors',
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
