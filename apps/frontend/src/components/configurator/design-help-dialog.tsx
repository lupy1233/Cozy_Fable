'use client';

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

// b8-3 (PO): trecerea pe "Am nevoie de ajutor" dupa ce clientul a raspuns la intrebari.
// Spune ce se intampla cu raspunsurile: nu pleaca la firme, dar raman in ciorna
// si revin daca debifeaza. `rooms` = numele camerelor care au deja raspunsuri.
export function DesignHelpConfirmDialog({
  open,
  rooms,
  wholeRequest,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  rooms: string[];
  // true = modul "Am nevoie de ajutor" pe toata cererea; false = bifa unei camere
  wholeRequest: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('Configurator');
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(wholeRequest ? 'designHelpSwitch.titleAll' : 'designHelpSwitch.titleRoom')}</DialogTitle>
          <DialogDescription>
            {t('designHelpSwitch.body', { rooms: rooms.join(', ') })}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('designHelpSwitch.kept')}</p>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('designHelpSwitch.cancel')}
          </Button>
          <Button type="button" variant="walnut" onClick={onConfirm}>
            {t('designHelpSwitch.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
