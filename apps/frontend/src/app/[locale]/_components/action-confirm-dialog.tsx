'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// E-company-6: dialog de confirmare pentru actiunile ireversibile ale firmei (retragere preluare,
// preluare, livrare, retragere/prelungire oferta, refuz modificare, incheiere negociere).
// Nu are namespace i18n propriu: apelantul trimite toate textele. Nu se inchide cat e pending;
// eroarea API se afiseaza IN dialog; ackLabel = bifa obligatorie inainte de confirmare.
export function ActionConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  cancelLabel,
  pendingLabel,
  pending,
  error,
  tone = 'default',
  ackLabel,
  confirmDisabled = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  pendingLabel: string;
  pending: boolean;
  error: string | null;
  tone?: 'danger' | 'default';
  ackLabel?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
}) {
  const [acked, setAcked] = useState(false);
  const ackId = useId();
  // bifa se reseteaza la fiecare deschidere (confirmarea nu se "mosteneste" intre incercari)
  useEffect(() => {
    if (open) setAcked(false);
  }, [open]);

  const blocked = pending || confirmDisabled || (!!ackLabel && !acked);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
          <div className="flex flex-col gap-2 text-sm text-foreground">{children}</div>
        </DialogDescription>
        {ackLabel && (
          <label htmlFor={ackId} className="mt-3 flex items-start gap-2 text-sm">
            <input
              id={ackId}
              type="checkbox"
              checked={acked}
              onChange={(e) => setAcked(e.target.checked)}
              disabled={pending}
              className="mt-0.5 h-4 w-4 accent-crimson"
            />
            <span>{ackLabel}</span>
          </label>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-crimson">
            {error}
          </p>
        )}
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="rounded-lg border border-border-2 bg-surface px-4 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!blocked) onConfirm();
            }}
            disabled={blocked}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50',
              tone === 'danger'
                ? 'bg-crimson text-white hover:brightness-110'
                : 'bg-foreground text-background hover:brightness-110',
            )}
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
