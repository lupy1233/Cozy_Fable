import type { ReactNode } from 'react';

// Sectiune a paginii "Firma mea": titlu deasupra cardului, cu o nota scurta in dreapta
// si, optional, o descriere dedesubt. `id` e tinta ancorelor din navigarea laterala.
export function CompanySection({
  id,
  title,
  aside,
  description,
  children,
}: {
  id: string;
  title: ReactNode;
  aside?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  const titleId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={titleId} className="flex scroll-mt-24 flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2 id={titleId} className="font-serif text-2xl leading-tight">
            {title}
          </h2>
          {aside && <span className="text-ui text-muted-foreground">{aside}</span>}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
