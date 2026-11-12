'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ROOM_TYPES, type InspirationPhotoDto, type InspirationPhotoInput, type RoomType } from '@marketplace/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { useUpdateInspiration } from '@/hooks/use-admin-inspiration';
import { TagFields, type TagValues } from './tag-fields';

export const TITLE_MIN = 3;
export const TITLE_MAX = 150;

// Editarea unei lucrari: titlu, tip de mobilier si etichetele de filtrare (PATCH-ul existent).
// Se monteaza cu `key={photo.id}`, deci starea porneste mereu de la valorile lucrarii alese.
export function EditTagsDialog({ photo, onClose }: { photo: InspirationPhotoDto; onClose: () => void }) {
  const t = useTranslations('AdminInspiration');
  const tc = useTranslations('Configurator');
  const update = useUpdateInspiration();
  const [title, setTitle] = useState(photo.title);
  const [roomType, setRoomType] = useState<RoomType>(photo.roomType);
  const [tags, setTags] = useState<TagValues>({ colors: photo.colors, materials: photo.materials, systems: photo.systems });
  const titleOk = title.trim().length >= TITLE_MIN;

  const save = () => {
    if (!titleOk) return;
    // titlul si tipul pleaca doar daca s-au schimbat; etichetele pleaca mereu (lista intreaga)
    const patch: Partial<InspirationPhotoInput> = { ...tags };
    if (title.trim() !== photo.title) patch.title = title.trim();
    if (roomType !== photo.roomType) patch.roomType = roomType;
    update.mutate(
      { id: photo.id, patch },
      {
        onSuccess: () => {
          toast.success(t('updated'));
          onClose();
        },
        onError: () => toast.error(t('actionError')),
      },
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !update.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
          <DialogDescription>{t('editHint')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label={t('fields.title')} error={title.trim() !== '' && !titleOk ? t('titleTooShort') : undefined}>
            <Input value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} className="h-11" />
          </Field>
          <Field label={t('fields.roomType')}>
            <Select value={roomType} onChange={(e) => setRoomType(e.target.value as RoomType)} className="h-11">
              {ROOM_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {tc(`rooms.type.${rt}`)}
                </option>
              ))}
            </Select>
          </Field>
          <TagFields value={tags} onChange={setTags} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={update.isPending}>
            {t('cancel')}
          </Button>
          <Button type="button" onClick={save} disabled={!titleOk || update.isPending}>
            {t('saveEdit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
