import { cn } from '@/lib/utils';

// Locurile unei cereri ca liniute (design 2026-11): pline = ocupate. Decorativ — numarul
// ("Sloturi 1/3") sta mereu in text langa ele, deci grupul e ascuns pentru cititoarele de ecran.
export function SlotBars({
  filled,
  total,
  className,
}: {
  filled: number;
  total: number;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn('flex items-center gap-1', className)}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn('h-1.5 w-7 rounded-full', i < filled ? 'bg-walnut' : 'bg-border')} />
      ))}
    </span>
  );
}
