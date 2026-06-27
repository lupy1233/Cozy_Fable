import { cn } from '@/lib/utils';

// ScoreGauge — card inchis cu scor proiect (din prototip .score-gauge).
export function ScoreGauge({
  score,
  size,
  max = 200,
  labels = ['0', 'SMALL · 60', 'MEDIUM · 120', 'LARGE'],
  scoreLabel = 'Project Score',
  className,
}: {
  score: number;
  size: string;
  max?: number;
  labels?: string[];
  scoreLabel?: string;
  className?: string;
}) {
  const pct = Math.min(100, (score / max) * 100);
  return (
    <div
      className={cn(
        'grid grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-lg p-4 text-background',
        'bg-gradient-to-br from-[#1A1815] to-[#2E2A24]',
        className,
      )}
    >
      <div className="font-serif text-5xl leading-none tracking-[-0.02em]">{score}</div>
      <div>
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-white/60">
          {scoreLabel}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-walnut to-[#D4A547]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10px] tracking-[0.06em] text-white/50">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>
      <div className="rounded-full bg-white/10 px-3.5 py-1.5 font-mono text-xs uppercase tracking-[0.1em]">
        {size}
      </div>
    </div>
  );
}
