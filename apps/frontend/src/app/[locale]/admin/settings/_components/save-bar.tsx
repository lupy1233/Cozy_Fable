'use client';

import { Check, CircleAlert, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PendingOp } from './settings-drafts';

export type RunStatus = 'queued' | 'saving' | 'saved' | 'failed';

// Starea unei salvari: lista inghetata a operatiilor trimise si ce s-a intamplat cu fiecare.
export interface RunState {
  ops: PendingOp[];
  status: Record<string, RunStatus>;
  messages: Record<string, string>;
  done: boolean;
}

function changeCount(ops: PendingOp[]): number {
  return ops.reduce((n, op) => n + op.items.length, 0);
}

// Bara „modificari nesalvate”: o singura salvare pentru tot ce s-a schimbat pe pagina.
export function SaveBar({
  ops,
  onDiscard,
  onSave,
}: {
  ops: PendingOp[];
  onDiscard: () => void;
  onSave: () => void;
}) {
  const t = useTranslations('Admin.settings');
  const count = changeCount(ops);
  const first = ops[0]?.items[0];
  const invalid = ops.some((op) => op.invalid);
  return (
    <div
      role="status"
      className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 rounded-xl border border-brass bg-surface px-5 py-3.5 shadow-sheet"
    >
      <div className="min-w-0 flex-[1_1_280px] text-sm">
        <span className="font-semibold">{t('unsaved', { count })}:</span>{' '}
        {first && <span>{t('changeSummary', { label: first.label, from: first.from, to: first.to })}</span>}
        {count > 1 && <span className="text-muted-foreground"> {t('andMore', { count: count - 1 })}</span>}
        {invalid && <p className="mt-0.5 text-xs text-crimson">{t('fixInvalid')}</p>}
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Button type="button" variant="ghost" size="lg" className="h-11" onClick={onDiscard}>
          {t('discard')}
        </Button>
        <Button type="button" variant="walnut" size="lg" className="h-11" disabled={invalid} onClick={onSave}>
          {t('saveChanges')}
        </Button>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: RunStatus | undefined }) {
  if (status === 'saved') return <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-sage" />;
  if (status === 'failed') return <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-crimson" />;
  if (status === 'saving') return <Loader2 aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />;
  return <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-border-2" />;
}

// Confirmarea salvarii: intai lista modificarilor, apoi — pe masura ce pleaca — ce a reusit si ce nu.
export function SaveDialog({
  open,
  ops,
  run,
  onClose,
  onConfirm,
}: {
  open: boolean;
  /** modificarile curente (inainte de trimitere) */
  ops: PendingOp[];
  /** null pana cand adminul confirma */
  run: RunState | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations('Admin.settings');
  const list = run ? run.ops : ops;
  const count = changeCount(list);
  const saving = !!run && !run.done;
  const failed = run ? Object.values(run.status).filter((s) => s === 'failed').length : 0;
  const saved = run ? Object.values(run.status).filter((s) => s === 'saved').length : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // cat timp se trimit modificarile, fereastra nu se inchide
        if (!next && !saving) onClose();
      }}
    >
      <DialogContent hideClose={saving} className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {!run ? t('confirmTitle', { count }) : run.done ? (failed > 0 ? t('resultPartialTitle') : t('resultOkTitle')) : t('savingTitle')}
          </DialogTitle>
          <DialogDescription>
            {!run
              ? t('confirmBody')
              : run.done
                ? failed > 0
                  ? t('resultPartialBody', { saved, failed })
                  : t('resultOkBody', { count: saved })
                : t('savingBody')}
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface-2" aria-live="polite">
          {list.map((op) => {
            const status = run?.status[op.id];
            return (
              <li key={op.id} className="flex gap-2.5 px-3.5 py-3">
                {run && <StatusIcon status={status} />}
                <div className="min-w-0 flex-1">
                  {op.items.map((item) => (
                    <p key={item.label} className="text-sm">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-muted-foreground">: </span>
                      <span className="font-mono text-xs text-muted-foreground line-through">{item.from}</span>
                      <span aria-hidden className="px-1.5 text-muted-foreground">
                        →
                      </span>
                      <span className="sr-only"> {t('becomes')} </span>
                      <span className="font-mono text-xs">{item.to}</span>
                    </p>
                  ))}
                  {op.code && <p className="font-mono text-meta text-muted-foreground">{op.code}</p>}
                  {status === 'saved' && <p className="sr-only">{t('opSaved')}</p>}
                  {status === 'failed' && (
                    <p role="alert" className="mt-0.5 text-xs text-crimson">
                      {run?.messages[op.id] ?? t('saveError')}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <DialogFooter>
          {!run ? (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('cancel')}
              </Button>
              <Button type="button" onClick={onConfirm}>
                {t('confirmSave', { count })}
              </Button>
            </>
          ) : (
            <Button type="button" variant={run.done ? 'default' : 'outline'} disabled={saving} onClick={onClose}>
              {saving ? t('savingTitle') : t('close')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
