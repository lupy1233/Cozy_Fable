'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SectionNavItem {
  id: string;
  label: string;
}

// pragul (px de la marginea de sus a ferestrei) sub care o sectiune conteaza drept "curenta";
// acopera antetul lipit + scroll-mt-24 al sectiunilor
const ACTIVE_OFFSET = 140;

// Sectiunea curenta: ultima al carei inceput a trecut de prag (la capatul paginii, ultima din lista).
// Un click pe o ancora o fixeaza pana la urmatoarea derulare facuta de utilizator, altfel sectiunile
// de la capat (care nu mai ajung pana sus) nu s-ar putea marca niciodata.
function useActiveSection(ids: string[]): [string, (id: string) => void] {
  const key = ids.join('|');
  const [active, setActive] = useState('');
  const pinned = useRef(false);

  useEffect(() => {
    const list = key ? key.split('|') : [];
    if (list.length === 0) return;

    const compute = () => {
      if (pinned.current) return;
      let current = list[0];
      let currentTop = Number.NEGATIVE_INFINITY;
      for (const id of list) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        // la sectiuni asezate una langa alta (acelasi inceput) ramane prima din lista
        if (top <= ACTIVE_OFFSET && top > currentTop) {
          current = id;
          currentTop = top;
        }
      }
      const doc = document.documentElement;
      const atBottom = window.scrollY > 0 && window.innerHeight + window.scrollY >= doc.scrollHeight - 2;
      const last = list[list.length - 1];
      if (atBottom && last && document.getElementById(last)) current = last;
      if (current) setActive(current);
    };
    const unpin = () => {
      pinned.current = false;
    };

    compute();
    window.addEventListener('scroll', compute, { passive: true });
    window.addEventListener('resize', compute);
    window.addEventListener('wheel', unpin, { passive: true });
    window.addEventListener('touchmove', unpin, { passive: true });
    window.addEventListener('keydown', unpin);
    return () => {
      window.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
      window.removeEventListener('wheel', unpin);
      window.removeEventListener('touchmove', unpin);
      window.removeEventListener('keydown', unpin);
    };
  }, [key]);

  const select = useCallback((id: string) => {
    pinned.current = true;
    setActive(id);
  }, []);

  return [ids.includes(active) ? active : (ids[0] ?? ''), select];
}

// Navigare in pagina (ancore catre sectiuni), folosita de "Firma mea" si de "Portofel":
// tabs = rand cu subliniere sub titlul paginii; side = coloana in stanga (rand derulabil pe mobil).
export function SectionNav({
  items,
  label,
  variant,
  className,
}: {
  items: SectionNavItem[];
  label: string;
  variant: 'tabs' | 'side';
  className?: string;
}) {
  const [active, select] = useActiveSection(items.map((item) => item.id));
  const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-walnut';

  if (variant === 'tabs') {
    return (
      <nav aria-label={label} className={cn('flex flex-wrap gap-1 border-b border-border-2', className)}>
        {items.map((item) => {
          const current = item.id === active;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={current ? 'location' : undefined}
              onClick={() => select(item.id)}
              className={cn(
                '-mb-px inline-flex min-h-11 items-center border-b-2 px-3.5 text-sm transition-colors',
                focusRing,
                current
                  ? 'border-foreground font-semibold text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-ink-2',
              )}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label={label}
      className={cn(
        'flex gap-1 overflow-x-auto lg:sticky lg:top-24 lg:w-56 lg:shrink-0 lg:flex-col lg:gap-0.5 lg:overflow-visible',
        className,
      )}
    >
      {items.map((item) => {
        const current = item.id === active;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={current ? 'location' : undefined}
            onClick={() => select(item.id)}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm transition-colors lg:whitespace-normal',
              focusRing,
              current ? 'bg-walnut-soft font-medium text-walnut-deep' : 'text-ink-2 hover:bg-surface-3',
            )}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
