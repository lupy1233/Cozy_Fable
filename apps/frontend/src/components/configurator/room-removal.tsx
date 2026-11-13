'use client';

import type { RoomType } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRemoveAttachmentFor, type AttachmentTarget } from '@/hooks/use-requests';
import {
  pickRoomToRemove,
  roomAnswerCount,
  roomFileIds,
  roomHasAnswers,
  useConfiguratorStore,
} from '@/stores/configurator-store';
import { roomInstanceLabels } from './room-payload';

// b6: scoaterea unei camere din cos. Camera fara raspunsuri (nici schite) se scoate pe
// loc; camera cu raspunsuri cere confirmare ("Pastreaza" e implicit). La confirmare
// fisierele camerei se sterg de pe ciorna; la editarea unei cereri publicate ele sunt
// ale cererii si se sterg abia dupa "Salveaza modificarile" (vezi review-step).
export function useRoomRemoval(target?: AttachmentTarget): {
  requestRemove: (roomType: RoomType) => void;
  dialog: ReactNode;
} {
  const t = useTranslations('Configurator');
  const removeRoom = useConfiguratorStore((s) => s.removeRoom);
  const rooms = useConfiguratorStore((s) => s.roomInstances);
  const removeAttachment = useRemoveAttachmentFor(target ?? { kind: 'draft', token: '' });
  const [pending, setPending] = useState<{ localId: string; whichOne: boolean } | null>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  const removeNow = (localId: string) => {
    const room = useConfiguratorStore.getState().roomInstances.find((r) => r.localId === localId);
    if (!room) return;
    const files = roomFileIds(room);
    removeRoom(localId);
    if (target?.kind === 'draft' && target.token) {
      // best-effort: ce nu se poate sterge acum se reincearca inainte de publicare
      for (const id of files) removeAttachment.mutate(id);
    }
  };

  const requestRemove = (roomType: RoomType) => {
    const all = useConfiguratorStore.getState().roomInstances;
    const room = pickRoomToRemove(all, roomType);
    if (!room) return;
    if (!roomHasAnswers(room)) {
      removeRoom(room.localId);
      return;
    }
    setPending({ localId: room.localId, whichOne: all.filter((r) => r.roomType === roomType).length > 1 });
  };

  const room = pending ? rooms.find((r) => r.localId === pending.localId) : undefined;
  const label = room ? roomInstanceLabels(rooms, (rt) => t(`rooms.type.${rt}`)).get(room.localId) ?? '' : '';
  const answers = room ? roomAnswerCount(room) : 0;
  const files = room ? roomFileIds(room).length : 0;
  const isEdit = target?.kind === 'request';

  const dialog = (
    <Dialog open={Boolean(room)} onOpenChange={(open) => !open && setPending(null)}>
      <DialogContent
        data-room-remove-dialog
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          keepRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('cart.removeDialog.title', { room: label })}</DialogTitle>
          <DialogDescription>
            {pending?.whichOne ? `${t('cart.removeDialog.whichOne', { room: label })} ` : ''}
            {answers > 0 ? t('cart.removeDialog.answers', { count: answers }) : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          {files > 0 && (
            <p>{t(isEdit ? 'cart.removeDialog.filesEdit' : 'cart.removeDialog.files', { count: files })}</p>
          )}
          {room?.needsDesignHelp && <p>{t('cart.removeDialog.help')}</p>}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button ref={keepRef} type="button" variant="walnut" onClick={() => setPending(null)}>
            {t('cart.removeDialog.keep')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="text-crimson"
            onClick={() => {
              const id = pending?.localId;
              setPending(null);
              if (id) removeNow(id);
            }}
          >
            {t('cart.removeDialog.remove')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { requestRemove, dialog };
}
