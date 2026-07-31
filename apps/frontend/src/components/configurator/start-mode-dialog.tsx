'use client';

import { ArrowRight, Compass, FolderCheck, ListChecks } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { StartMode } from '@/stores/configurator-store';

// Dialogul "cum incepem?" la o cerere noua (PO 2026-07-31): trei drumuri —
// proiect propriu (formular fara dimensiuni/schite), formular complet, sau
// "am nevoie de ajutor" (doar camerele + Proiectare platita).
const OPTIONS: { mode: StartMode; icon: React.ComponentType<{ className?: string }> }[] = [
  { mode: 'OWN_PROJECT', icon: FolderCheck },
  { mode: 'STANDARD', icon: ListChecks },
  { mode: 'DESIGN_HELP', icon: Compass },
];

export function StartModeDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (mode: StartMode) => void;
}) {
  const t = useTranslations('Configurator');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('start.title')}</DialogTitle>
          <DialogDescription>{t('start.subtitle')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2.5">
          {OPTIONS.map(({ mode, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => onPick(mode)}
              className="group flex items-start gap-3.5 rounded-xl border border-border-2 bg-surface p-4 text-left transition-all hover:-translate-y-px hover:border-walnut hover:bg-walnut-soft hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-walnut"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-walnut transition-colors group-hover:bg-surface">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                  {t(`start.${mode}.title`)}
                  {mode === 'DESIGN_HELP' && (
                    <span className="rounded-full bg-brass/15 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-brass-2">
                      {t('start.DESIGN_HELP.badge')}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">
                  {t(`start.${mode}.desc`)}
                </span>
              </span>
              <ArrowRight className="mt-2.5 h-4 w-4 shrink-0 text-muted-2 transition-all group-hover:translate-x-0.5 group-hover:text-walnut" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
