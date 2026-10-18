'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Card } from './card';

// Skeleton — placeholder de incarcare. Textul „Se incarca…" exista DOAR sr-only
// (LoadingRegion); vizual nu apare niciun text. Sub prefers-reduced-motion regula
// globala opreste pulsul (placeholder static).
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-surface-3', className)} {...props} />;
}

export function LoadingRegion({
  label,
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations('Common.loadState');
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label ?? t('loading')}</span>
      {children}
    </div>
  );
}

function TextLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <LoadingRegion className={className}>
      <TextLines lines={lines} />
    </LoadingRegion>
  );
}

function CardBlock({ lines = 3, withHeader = true, className }: { lines?: number; withHeader?: boolean; className?: string }) {
  return (
    <Card className={className}>
      {withHeader && <Skeleton className="mb-4 h-5 w-40" />}
      <TextLines lines={lines} />
    </Card>
  );
}

export function SkeletonCard({
  lines = 3,
  withHeader = true,
  className,
}: {
  lines?: number;
  withHeader?: boolean;
  className?: string;
}) {
  return (
    <LoadingRegion>
      <CardBlock lines={lines} withHeader={withHeader} className={className} />
    </LoadingRegion>
  );
}

function StatGridBlock({
  count = 4,
  variant = 'card',
  className,
}: {
  count?: number;
  variant?: 'card' | 'inline';
  className?: string;
}) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {Array.from({ length: count }, (_, i) =>
        variant === 'inline' ? (
          <div key={i} className="rounded-lg bg-surface-2 p-3">
            <Skeleton className="mx-auto h-7 w-16" />
            <Skeleton className="mx-auto mt-2 h-3 w-20" />
          </div>
        ) : (
          <Card key={i} padding="sm">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
          </Card>
        ),
      )}
    </div>
  );
}

export function SkeletonStatGrid(props: { count?: number; variant?: 'card' | 'inline'; className?: string }) {
  return (
    <LoadingRegion>
      <StatGridBlock {...props} />
    </LoadingRegion>
  );
}

function ListBlock({
  rows = 4,
  variant = 'rows',
  withAvatar,
  className,
}: {
  rows?: number;
  variant?: 'rows' | 'cards' | 'bubbles';
  withAvatar?: boolean;
  className?: string;
}) {
  if (variant === 'bubbles') {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className={cn('h-12 rounded-xl', i % 2 === 0 ? 'w-3/5' : 'ml-auto w-2/5')} />
        ))}
      </div>
    );
  }
  if (variant === 'cards') {
    return (
      <div className={cn('grid gap-3', className)}>
        {Array.from({ length: rows }, (_, i) => (
          <CardBlock key={i} lines={2} />
        ))}
      </div>
    );
  }
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          {withAvatar && <Skeleton className="size-9 shrink-0 rounded-full" />}
          <div className="flex-1">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonList(props: {
  rows?: number;
  variant?: 'rows' | 'cards' | 'bubbles';
  withAvatar?: boolean;
  className?: string;
}) {
  return (
    <LoadingRegion>
      <ListBlock {...props} />
    </LoadingRegion>
  );
}

function TableBlock({ rows = 6, cols = 5, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <Card padding="none" className={cn('overflow-hidden', className)}>
      <div className="border-b border-border px-3.5 py-3">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }, (_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="border-b border-border px-3.5 py-3.5 last:border-0">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols }, (_, c) => (
              <Skeleton key={c} className="h-4 w-full max-w-[8rem]" />
            ))}
          </div>
        </div>
      ))}
    </Card>
  );
}

export function SkeletonTable(props: { rows?: number; cols?: number; className?: string }) {
  return (
    <LoadingRegion>
      <TableBlock {...props} />
    </LoadingRegion>
  );
}

function HeaderBlock() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-10 w-64 max-w-full" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

export function SkeletonPage({
  variant,
  withHeader = true,
  className,
}: {
  variant: 'dashboard' | 'list' | 'detail' | 'table';
  withHeader?: boolean;
  className?: string;
}) {
  return (
    <LoadingRegion className={cn('flex flex-col gap-6', variant === 'detail' && 'mx-auto max-w-3xl', className)}>
      {withHeader && <HeaderBlock />}
      {variant === 'dashboard' && (
        <>
          <StatGridBlock count={4} />
          <CardBlock lines={4} />
        </>
      )}
      {variant === 'list' && <ListBlock rows={4} variant="cards" />}
      {variant === 'detail' && (
        <>
          <CardBlock lines={4} />
          <CardBlock lines={3} />
        </>
      )}
      {variant === 'table' && <TableBlock rows={6} cols={5} />}
    </LoadingRegion>
  );
}
