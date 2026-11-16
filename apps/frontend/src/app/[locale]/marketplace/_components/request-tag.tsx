import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Eticheta de pe cardul unei cereri (loc, distanta, marime, buget): pastila cu text normal,
// 13px — spre deosebire de Badge (mono, majuscule), care ramane pentru stari.
export type RequestTagTone = 'neutral' | 'walnut' | 'sage' | 'info' | 'amber';

const TONE: Record<RequestTagTone, string> = {
  neutral: 'bg-secondary text-foreground',
  walnut: 'bg-walnut-soft text-walnut',
  sage: 'bg-sage-soft text-sage',
  info: 'bg-info-soft text-info',
  amber: 'bg-amber-soft text-amber',
};

export function RequestTag({
  tone = 'neutral',
  title,
  className,
  children,
}: {
  tone?: RequestTagTone;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span title={title} className={cn('rounded-full px-2.5 py-[3px] text-ui', TONE[tone], className)}>
      {children}
    </span>
  );
}
