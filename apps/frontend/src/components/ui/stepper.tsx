import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Stepper — portat din prototip (.stepper). active=ink, done=sage.
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
    <div className={cn('flex items-center gap-2', className)}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s} className="flex items-center gap-2">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              <div
                className={cn(
                  'grid h-[22px] w-[22px] place-items-center rounded-full border text-[11px]',
                  done && 'border-sage bg-sage text-white',
                  active && 'border-foreground bg-foreground text-background',
                  !done && !active && 'border-border-2',
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className={cn(active && 'text-foreground')}>{s}</span>
            </div>
            {i < steps.length - 1 && <div className="h-px w-7 bg-border-2" />}
          </div>
        );
      })}
    </div>
  );
}
