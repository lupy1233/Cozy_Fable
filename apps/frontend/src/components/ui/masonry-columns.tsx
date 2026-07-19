'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Masonry cu coloane distribuite in JS, stabil la infinite scroll.
// CSS `columns` re-echilibreaza TOATE cardurile la fiecare append (o pagina
// noua muta cardurile deja vizibile dintr-o coloana in alta = layout shift).
// Aici fiecare item e asezat greedy pe coloana cea mai scurta la momentul
// lui; atribuirea depinde doar de itemii dinaintea lui, deci paginile noi
// nu re-aseaza nimic din ce e deja pe ecran.

type ColumnCounts = { base: number; sm: number; lg: number };

export function MasonryColumns<T>({
  items,
  columns,
  estimateHeight,
  renderItem,
  className,
}: {
  items: T[];
  /** numar de coloane per breakpoint (mobil / ≥640px / ≥1024px) */
  columns: ColumnCounts;
  /** inaltime relativa estimata (ex. raportul h/w al imaginii) — doar pentru echilibrarea coloanelor */
  estimateHeight: (item: T, index: number) => number;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
}) {
  const [cols, setCols] = useState(columns.base);

  useEffect(() => {
    const sm = window.matchMedia('(min-width: 640px)');
    const lg = window.matchMedia('(min-width: 1024px)');
    const update = () =>
      setCols(lg.matches ? columns.lg : sm.matches ? columns.sm : columns.base);
    update();
    sm.addEventListener('change', update);
    lg.addEventListener('change', update);
    return () => {
      sm.removeEventListener('change', update);
      lg.removeEventListener('change', update);
    };
  }, [columns.base, columns.sm, columns.lg]);

  const buckets: { item: T; index: number }[][] = Array.from({ length: cols }, () => []);
  const heights = new Array<number>(cols).fill(0);
  items.forEach((item, index) => {
    let target = 0;
    for (let c = 1; c < cols; c++) {
      if (heights[c] < heights[target]) target = c;
    }
    buckets[target].push({ item, index });
    heights[target] += estimateHeight(item, index);
  });

  return (
    <div
      className={cn('grid items-start gap-4', className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {buckets.map((bucket, c) => (
        <div key={c} className="flex min-w-0 flex-col gap-4">
          {bucket.map(({ item, index }) => renderItem(item, index))}
        </div>
      ))}
    </div>
  );
}
