import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

// PageHeader — un singur h1 per pagina (AppShell nu are h1).
export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  kicker?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  /** in randul link-ului inapoi, la dreapta (ex. StatusBadge) */
  meta?: React.ReactNode;
  className?: string;
  titleClassName?: string;
}

export function PageHeader({
  title,
  subtitle,
  kicker,
  back,
  actions,
  meta,
  className,
  titleClassName,
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      {(back || meta) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {back ? (
            <Link href={back.href} className="text-sm text-walnut hover:underline">
              ← {back.label}
            </Link>
          ) : (
            <span />
          )}
          {meta}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {kicker && <div className="kicker mb-2">{kicker}</div>}
          <h1 className={cn('page-title', titleClassName)}>{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
