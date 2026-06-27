import { cn } from '@/lib/utils';

// SlotTrack — patratele credit/claim (din prototip .slot-track).
export function SlotTrack({
  filled,
  total,
  warn,
  className,
}: {
  filled: number;
  total: number;
  warn?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-3.5 w-3.5 rounded-[3px] border',
            i < filled
              ? warn
                ? 'border-amber bg-amber'
                : 'border-foreground bg-foreground'
              : 'border-border-2 bg-surface',
          )}
        />
      ))}
    </div>
  );
}
