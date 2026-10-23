'use client';

import { useId } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { INSPIRATION_NOTE_MAX, type InspirationPhotoDto, type RoomType } from '@marketplace/shared';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

// E-client-34: o poza de inspiratie aleasa pe cerere, cu notita ("Ce iti place la poza asta?")
// si camera careia ii e destinata. Draftul sta in store (stare locala pre-submit).

export interface SelectionRoom {
  localId: string;
  roomType: RoomType;
}

export function InspirationSelectionCard({
  photoId,
  photo,
  note,
  roomLocalId,
  rooms,
  blocked,
  onNoteChange,
  onRoomChange,
  onRemove,
}: {
  photoId: string;
  // lipseste cat timp detaliile pozei se incarca
  photo?: InspirationPhotoDto;
  note: string;
  roomLocalId: string;
  rooms: SelectionRoom[];
  // notita contine date de contact (BLOCK la publicare)
  blocked: boolean;
  onNoteChange: (photoId: string, note: string) => void;
  onRoomChange: (photoId: string, roomLocalId: string | null) => void;
  onRemove: (photoId: string) => void;
}) {
  const t = useTranslations('Configurator');
  const uid = useId();
  const noteId = `${uid}-note`;
  const counterId = `${uid}-counter`;
  const errorId = `${uid}-error`;
  const roomId = `${uid}-room`;
  const title = photo?.title ?? '';

  // aceeasi numerotare ca in lista de camere: "Living 2" doar cand tipul apare de mai multe ori
  const roomLabel = (room: SelectionRoom) => {
    const sameType = rooms.filter((r) => r.roomType === room.roomType);
    const name = t(`rooms.type.${room.roomType}`);
    if (sameType.length < 2) return name;
    return t('inspirationPicker.roomOption', {
      room: name,
      n: sameType.findIndex((r) => r.localId === room.localId) + 1,
    });
  };

  return (
    <Card as="li" padding="sm" className="flex gap-3">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.imageUrl ?? ''} alt={photo.title} className="h-full w-full object-cover" />
        ) : (
          <Skeleton className="h-full w-full rounded-none" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 text-xs">
            <span className="block truncate font-medium">{title}</span>
            {photo && (
              <span className="block truncate text-micro uppercase tracking-wide text-muted-foreground">
                {photo.company.name}
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label={t('inspirationPicker.removePhoto', { title })}
            onClick={() => onRemove(photoId)}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <div>
          <label htmlFor={noteId} className="mb-1 block text-xs font-medium">
            {t('inspirationPicker.noteLabel')}
          </label>
          <Textarea
            id={noteId}
            rows={2}
            value={note}
            maxLength={INSPIRATION_NOTE_MAX}
            placeholder={t('inspirationPicker.notePlaceholder')}
            aria-describedby={blocked ? `${counterId} ${errorId}` : counterId}
            aria-invalid={blocked || undefined}
            onChange={(e) => onNoteChange(photoId, e.target.value)}
            className="min-h-[56px]"
          />
          <div className="mt-0.5 flex items-start justify-between gap-2">
            {blocked ? (
              <p id={errorId} role="alert" className="text-xs text-crimson">
                {t('inspirationPicker.noteContactBlocked')}
              </p>
            ) : (
              <span />
            )}
            <span id={counterId} className="shrink-0 text-micro text-muted-foreground">
              {t('inspirationPicker.noteCounter', { count: note.length, max: INSPIRATION_NOTE_MAX })}
            </span>
          </div>
        </div>

        {rooms.length > 0 && (
          <div>
            <label htmlFor={roomId} className="mb-1 block text-xs font-medium">
              {t('inspirationPicker.roomLabel')}
            </label>
            <Select
              id={roomId}
              value={roomLocalId}
              onChange={(e) => onRoomChange(photoId, e.target.value || null)}
              className="h-9"
            >
              <option value="">{t('inspirationPicker.roomNone')}</option>
              {rooms.map((r) => (
                <option key={r.localId} value={r.localId}>
                  {roomLabel(r)}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
    </Card>
  );
}
