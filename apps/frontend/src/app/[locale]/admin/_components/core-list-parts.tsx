'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APP_TIME_ZONE } from '@/lib/sla-deadline';
import { cn } from '@/lib/utils';

// Piese comune pentru listele si detaliile din consola (firme, proiecte, utilizatori):
// cautare, paginare, pastile de semnal si starea cu codul tehnic dedesubt.

// Cautare cu lupa. Eticheta e pentru cititoarele de ecran (placeholder-ul nu tine loc de eticheta).
export function SearchBox({
  value,
  onChange,
  label,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-11 pl-9"
      />
    </div>
  );
}

// Paginare: rezumatul (ex. „1–20 din 24”) e mereu vizibil; butoanele apar doar cand sunt mai multe pagini.
export function ListPager({
  summary,
  page,
  pages,
  onPage,
  className,
}: {
  summary: ReactNode;
  page: number;
  pages: number;
  onPage: (page: number) => void;
  className?: string;
}) {
  const t = useTranslations('Admin.list');
  return (
    <nav aria-label={t('pagination')} className={cn('flex flex-wrap items-center justify-end gap-3', className)}>
      <span className="data-mono text-muted-foreground" aria-live="polite">
        {summary}
      </span>
      {pages > 1 && (
        <>
          <Button variant="outline" size="lg" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            {t('prev')}
          </Button>
          <Button variant="outline" size="lg" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            {t('next')}
          </Button>
        </>
      )}
    </nav>
  );
}

// Paginare pe client peste randuri deja incarcate (endpoint-urile fara parametru de pagina).
export function pageSlice<T>(rows: readonly T[], page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * pageSize;
  return {
    pages,
    current,
    from: rows.length === 0 ? 0 : start + 1,
    to: Math.min(rows.length, start + pageSize),
    items: rows.slice(start, start + pageSize),
  };
}

const PILL_TONE = {
  muted: 'bg-surface-3 text-muted-foreground',
  crimson: 'bg-crimson-soft text-crimson',
  amber: 'bg-amber-soft text-amber',
  sage: 'bg-sage-soft text-sage',
  walnut: 'bg-walnut-soft text-walnut',
} as const;
export type PillTone = keyof typeof PILL_TONE;

// Pastila de semnal (risc, caz deschis, intarziat, rolul unui membru): text normal, nu mono —
// Badge ramane pentru stari.
export function Pill({
  tone = 'muted',
  strong,
  className,
  children,
}: {
  tone?: PillTone;
  strong?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-px text-xs',
        strong ? 'font-semibold' : 'font-medium',
        PILL_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// Eticheta tradusa + codul tehnic mic dedesubt: omul citeste eticheta, codul ramane la
// indemana pentru cautat in audit sau in loguri.
export function CodeUnder({ code, className, children }: { code: string; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex flex-col items-start gap-1', className)}>
      {children}
      <span className="font-mono text-micro text-muted-foreground">{code}</span>
    </span>
  );
}

// Zile calendaristice trecute de la o data YYYY-MM-DD, socotite in ora Romaniei (acelasi
// calendar ca backend-ul). Negativ = data e in viitor.
export function daysSinceDateOnly(dateOnly: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: 'year' | 'month' | 'day') => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const today = Date.UTC(part('year'), part('month') - 1, part('day'));
  const [y = 0, m = 1, d = 1] = dateOnly.split('-').map(Number);
  return Math.round((today - Date.UTC(y, m - 1, d)) / 86_400_000);
}
