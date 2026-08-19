import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Firul de verificare al pasului de sumar ("semnarea fisei"):
// fiecare sectiune e ancorata cu un nod pe o linie verticala hairline.
// Nod plin sage cu bifa = sectiune completa; nod gol amber = incompleta;
// nod gol neutru = sectiune optionala (ex. inspiratia).
// Sub sm linia dispare, nodul se muta inline in headerul sectiunii.

export type RailState = 'complete' | 'incomplete' | 'neutral';

export function RailNode({ state, className }: { state: RailState; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border bg-surface transition-colors',
        state === 'complete' && 'border-sage bg-sage text-background',
        state === 'incomplete' && 'border-amber',
        state === 'neutral' && 'border-ink/25',
        className,
      )}
    >
      {state === 'complete' && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}

export function RailSection({
  state,
  index,
  eyebrow,
  title,
  titleExtra,
  action,
  nodeClassName,
  children,
}: {
  state: RailState;
  // numarul de ordine din registru (mono, ex. "01") — optional
  index?: string;
  // eticheta .label de deasupra titlului — optional
  eyebrow?: string;
  title?: ReactNode;
  // ex. eticheta amber "incompleta", langa titlu
  titleExtra?: ReactNode;
  // butonul Editeaza; discret la hover pe desktop, mereu vizibil pe touch
  action?: ReactNode;
  // ajustarea pozitiei nodului de pe fir (ex. top-4 pt. carduri mai scunde)
  nodeClassName?: string;
  children: ReactNode;
}) {
  const hasHeader = Boolean(index || eyebrow || title || action);

  return (
    <section className="group relative">
      {/* nodul de pe fir — doar desktop; parintele deseneaza linia */}
      <RailNode state={state} className={cn('absolute -left-10 top-5 hidden sm:grid', nodeClassName)} />

      {hasHeader ? (
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              {/* sub sm firul dispare — nodul ramane indicator inline */}
              <RailNode state={state} className="mt-1 sm:hidden" />
              <div className="min-w-0">
                {(index || eyebrow) && (
                  <p className="flex items-baseline gap-2">
                    {index && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-2">
                        {index}
                      </span>
                    )}
                    {eyebrow && <span className="label">{eyebrow}</span>}
                  </p>
                )}
                {title && (
                  <h3 className="flex flex-wrap items-baseline gap-x-2 font-serif text-lg leading-snug tracking-[-0.01em]">
                    {title}
                    {titleExtra}
                  </h3>
                )}
              </div>
            </div>
            {action}
          </div>
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
