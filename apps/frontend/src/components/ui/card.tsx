import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Card — containerul unic de suprafata. O singura raza de card (rounded-xl);
// tile-urile din interior raman rounded-lg (vezi docs/design-tokens.md).
export type CardTone = 'default' | 'muted' | 'dashed' | 'amber' | 'crimson' | 'sage' | 'info';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export const cardVariants = cva('rounded-xl border', {
  variants: {
    tone: {
      default: 'border-border bg-surface shadow-sm',
      muted: 'border-border bg-surface-2',
      dashed: 'border-dashed border-border-2 bg-surface',
      amber: 'border-amber/30 bg-amber-soft',
      crimson: 'border-crimson/30 bg-crimson-soft',
      sage: 'border-sage/30 bg-sage-soft',
      info: 'border-info/30 bg-info-soft',
    },
    padding: {
      none: '',
      sm: 'p-4',
      md: 'p-5',
      lg: 'p-6',
    },
    interactive: {
      true: 'transition-all duration-200 ease-ease hover:-translate-y-0.5 hover:border-border-2 hover:shadow',
      false: '',
    },
  },
  defaultVariants: { tone: 'default', padding: 'md', interactive: false },
});

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'li' | 'aside';
  /** randeaza copilul (ex. <Link>) cu stilul de card */
  asChild?: boolean;
  tone?: CardTone;
  padding?: CardPadding;
  /** hover lift (liste, link-uri card) */
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLElement, CardProps>(function Card(
  { as = 'div', asChild, tone, padding, interactive, className, ...props },
  ref,
) {
  const Comp = (asChild ? Slot : as) as unknown as React.ComponentType<
    React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }
  >;
  return (
    <Comp
      ref={ref}
      className={cn(cardVariants({ tone, padding, interactive: interactive ?? false }), className)}
      {...props}
    />
  );
});

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-3 flex items-start justify-between gap-3', className)} {...props} />;
}

export function CardTitle({
  as: Tag = 'h2',
  size = 'card',
  icon: Icon,
  id,
  className,
  children,
}: {
  as?: 'h2' | 'h3';
  size?: 'section' | 'card';
  icon?: LucideIcon;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        size === 'section' ? 'heading-section' : 'heading-card',
        Icon && 'flex items-center gap-2',
        className,
      )}
    >
      {Icon && <Icon className="size-4 shrink-0 text-walnut" aria-hidden />}
      {children}
    </Tag>
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-sm text-muted-foreground', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-2', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-4 flex flex-wrap items-center gap-2', className)} {...props} />;
}

// CardSection — inlocuieste Section-urile locale (admin, calendar, dashboard firma):
// card cu titlu legat prin aria-labelledby, actiuni in antet si corp in coloana.
export function CardSection({
  title,
  titleAs,
  titleSize,
  icon,
  description,
  actions,
  tone,
  padding,
  id,
  className,
  bodyClassName,
  children,
}: {
  title: React.ReactNode;
  titleAs?: 'h2' | 'h3';
  titleSize?: 'section' | 'card';
  icon?: LucideIcon;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: CardTone;
  padding?: CardPadding;
  id?: string;
  className?: string;
  /** suprascrie implicitul `flex flex-col gap-2` al corpului */
  bodyClassName?: string;
  children?: React.ReactNode;
}) {
  const titleId = React.useId();
  return (
    <Card as="section" id={id} tone={tone} padding={padding} aria-labelledby={titleId} className={className}>
      <CardHeader className={children ? undefined : 'mb-0'}>
        <div className="min-w-0">
          <CardTitle as={titleAs} size={titleSize} icon={icon} id={titleId}>
            {title}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </CardHeader>
      {children && <CardBody className={bodyClassName}>{children}</CardBody>}
    </Card>
  );
}
