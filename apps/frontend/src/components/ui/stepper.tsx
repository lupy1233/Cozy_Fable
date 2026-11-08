import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Stepper — casete numerotate in stil cartus de plansa tehnica.
// Implicit etichetele raman doar pentru screen-readere; cu `labeled` (wizardul
// de cerere, Laws of UX 2026-11-08) fiecare pas isi arata numele de la `lg`,
// iar pasul activ mereu — utilizatorul vede ce urmeaza, nu doar un numar.
export function Stepper({
  steps,
  current,
  className,
  labeled = false,
}: {
  steps: string[];
  current: number;
  className?: string;
  labeled?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s} className="flex items-center gap-1.5">
            <div
              title={s}
              className={cn(
                'grid h-[22px] w-[22px] place-items-center rounded-[3px] border font-mono text-micro',
                done && 'border-sage bg-sage text-white',
                active && 'border-foreground bg-foreground text-background',
                !done && !active && 'border-border-2 text-muted-foreground',
              )}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
              {!labeled && <span className="sr-only">{s}</span>}
            </div>
            {labeled && (
              <span
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'whitespace-nowrap text-xs',
                  active ? 'font-medium text-foreground' : 'sr-only text-muted-foreground lg:not-sr-only',
                )}
              >
                {s}
              </span>
            )}
            {i < steps.length - 1 && <div className="h-px w-4 bg-border-2" />}
          </div>
        );
      })}
    </div>
  );
}
