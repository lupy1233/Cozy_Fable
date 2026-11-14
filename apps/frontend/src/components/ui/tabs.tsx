'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

// Tabs — controlat, stil din prototip (.tabs/.tab). Underline accent.
// Design 2026-11: eticheta de 14px, fara majuscule (se citeste ca un titlu de sectiune, nu ca o eticheta).
export function Tabs({
  tabs,
  current,
  onChange,
  className,
  panelId,
  label,
  scrollable = false,
}: {
  tabs: { value: string; label: React.ReactNode }[];
  current: string;
  onChange: (value: string) => void;
  className?: string;
  panelId: string;
  label: string;
  // etapa 8 (40): filele pe un singur rand, derulabil in lateral (telefon); fara prop — ca azi
  scrollable?: boolean;
}) {
  const buttons = React.useRef<(HTMLButtonElement | null)[]>([]);
  const selectAt = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    buttons.current[index]?.focus();
    onChange(tab.value);
  };
  // fila aleasa ramane in vedere cand randul se deruleaza (doar in lateral: scrollIntoView ar
  // putea misca si pagina pe verticala)
  const list = React.useRef<HTMLDivElement>(null);
  const activeIndex = tabs.findIndex((t) => t.value === current);
  React.useEffect(() => {
    const box = list.current;
    const el = buttons.current[activeIndex];
    if (!scrollable || !box || !el) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.left < b.left) box.scrollLeft -= b.left - r.left;
    else if (r.right > b.right) box.scrollLeft += r.right - b.right;
  }, [scrollable, activeIndex]);
  return (
    <div
      ref={list}
      className={cn(
        'mb-5 flex gap-1 border-b border-border',
        className,
        // dupa className: randul nu se mai rupe chiar daca apelantul cere flex-wrap
        scrollable && 'flex-nowrap overflow-x-auto overscroll-x-contain',
      )}
      role="tablist"
      aria-label={label}
      data-scrollable={scrollable ? '' : undefined}
    >
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
              '-mb-px min-h-11 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-walnut',
              // in randul derulabil (overflow) suprapunerea -1px peste chenar s-ar taia
              scrollable && 'mb-0 shrink-0 whitespace-nowrap',
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
