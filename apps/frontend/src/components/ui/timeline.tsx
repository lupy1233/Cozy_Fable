import * as React from 'react';
import { cn } from '@/lib/utils';

// Timeline — din prototip (.timeline). Coloana timp + dot/line + continut.
export interface TimelineItem {
  time?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
}

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <div key={i} className="grid grid-cols-[90px_24px_1fr] gap-3 py-3.5">
            <div className="pt-0.5 font-mono text-[11px] text-muted-foreground">{item.time}</div>
            <div className="flex flex-col items-center gap-1">
              <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-foreground" />
              {!last && <div className="w-px flex-1 bg-border-2" />}
            </div>
            <div className="pb-3.5">
              <h4 className="mb-1 text-sm font-medium">{item.title}</h4>
              {item.body && <p className="text-[13px] text-muted-foreground">{item.body}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
