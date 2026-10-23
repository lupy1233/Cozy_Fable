'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  INSPIRATION_NOTE_MAX,
  type InspirationBoardItemMetaDto,
  type RoomType,
} from '@marketplace/shared';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { INSPIRATION_ROOM_TYPES } from '@/components/configurator/inspiration-room-types';
import { useUpdateBoardItem } from '@/hooks/use-inspiration-boards';

// E-client-34: editorul de notita + camera pentru o salvare din colectie (continut de Popover).
// Notita e privata pana o ataseaza clientul la o cerere; goala = se sterge.
export function BoardItemNoteEditor({
  boardId,
  photoId,
  meta,
  onClose,
}: {
  boardId: string;
  photoId: string;
  meta: InspirationBoardItemMetaDto | undefined;
  onClose: () => void;
}) {
  const t = useTranslations('Inspiration');
  const tc = useTranslations('Configurator');
  const uid = useId();
  const update = useUpdateBoardItem(boardId);
  const [note, setNote] = useState(meta?.note ?? '');
  const [roomType, setRoomType] = useState<RoomType | ''>(meta?.roomType ?? '');

  const save = () => {
    update.mutate(
      { photoId, note: note.trim() === '' ? null : note.trim(), roomType: roomType === '' ? null : roomType },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="flex flex-col gap-3 p-4 text-left">
      <div>
        <label htmlFor={`${uid}-note`} className="mb-1 block text-sm font-medium">
          {t('noteLabel')}
        </label>
        <Textarea
          id={`${uid}-note`}
          rows={3}
          value={note}
          maxLength={INSPIRATION_NOTE_MAX}
          placeholder={t('notePlaceholder')}
          aria-describedby={`${uid}-counter`}
          onChange={(e) => setNote(e.target.value)}
        />
        <p id={`${uid}-counter`} className="mt-0.5 text-right text-micro text-muted-foreground">
          {tc('inspirationPicker.noteCounter', { count: note.length, max: INSPIRATION_NOTE_MAX })}
        </p>
      </div>
      <div>
        <label htmlFor={`${uid}-room`} className="mb-1 block text-sm font-medium">
          {t('roomForLabel')}
        </label>
        <Select id={`${uid}-room`} value={roomType} onChange={(e) => setRoomType(e.target.value as RoomType | '')}>
          <option value="">{t('roomAny')}</option>
          {INSPIRATION_ROOM_TYPES.map((rt) => (
            <option key={rt} value={rt}>
              {tc(`rooms.type.${rt}`)}
            </option>
          ))}
        </Select>
      </div>
      {update.isError && (
        <p role="alert" className="text-sm text-crimson">
          {t('noteError')}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t('close')}
        </Button>
        <Button type="button" variant="walnut" size="sm" onClick={save} disabled={update.isPending}>
          {t('noteSave')}
        </Button>
      </div>
    </div>
  );
}
