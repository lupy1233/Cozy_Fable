import { cn } from '@/lib/utils';

// Avatar — initiale pe fundal de brand (din prototip).
const TONE_BG: Record<string, string> = {
  walnut: 'bg-walnut',
  sage: 'bg-sage',
  ink: 'bg-foreground',
};

export function Avatar({
  name,
  size = 32,
  tone = 'walnut',
  className,
}: {
  name: string;
  size?: number;
  tone?: 'walnut' | 'sage' | 'ink';
  className?: string;
}) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-serif text-[#FBF6EC]',
        TONE_BG[tone],
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials}
    </div>
  );
}
