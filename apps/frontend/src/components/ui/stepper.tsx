import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Stepper — casete numerotate in stil cartus de plansa tehnica.
// Etichetele raman doar pentru screen-readere (numele fazei active e afisat
// separat, in cartusul wizard-ului); vizual: patratele mono legate cu hairline.
export function Stepper({
  steps,
  current,
  className,
}: {
  steps: string[];
  current: number;
  className?: string;
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
                'grid h-[22px] w-[22px] place-items-center rounded-[3px] border font-mono text-[10px]',
                done && 'border-sage bg-sage text-white',
                active && 'border-foreground bg-foreground text-background',
                !done && !active && 'border-border-2 text-muted-foreground',
              )}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
              <span className="sr-only">{s}</span>
            </div>
            {i < steps.length - 1 && <div className="h-px w-4 bg-border-2" />}
          </div>
        );
      })}
    </div>
  );
}
