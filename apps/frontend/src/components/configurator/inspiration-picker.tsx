'use client';

import { useState } from 'react';
import { Check, Images, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RoomType } from '@marketplace/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useInspiration } from '@/hooks/use-inspiration';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { cn } from '@/lib/utils';

// Alegerea pozelor de inspiratie din galerie, direct in formular (F6, item 3).
// Selectia (max 10) intra in cerere la publish; firmele o vad pe detaliu.

const MAX_SELECTED = 10;

const TYPE_FILTERS: RoomType[] = ['KITCHEN', 'LIVING', 'BEDROOM', 'DRESSING', 'OFFICE', 'BATHROOM', 'HALLWAY'];

export function InspirationPicker() {
  const t = useTranslations('Configurator');
  const tc = useTranslations('Configurator');
  const ti = useTranslations('Inspiration');
  const selected = useConfiguratorStore((s) => s.inspirationPhotoIds);
  const setSelected = useConfiguratorStore((s) => s.setInspirationPhotos);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RoomType | null>(null);

  const gallery = useInspiration({ roomType: type ?? undefined }, open);
  // pozele deja alese, pentru thumbnails (independent de filtrul din dialog)
  const chosen = useInspiration({ ids: selected }, selected.length > 0);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((x) => x !== id));
    } else if (selected.length < MAX_SELECTED) {
      setSelected([...selected, id]);
    }
  };

  return (
    <div className="rounded-xl border border-border-2 bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg">{t('inspirationPicker.title')}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t('inspirationPicker.subtitle', { max: MAX_SELECTED })}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Images className="mr-1.5 h-4 w-4" />
          {t('inspirationPicker.browse')}
        </Button>
      </div>

      {/* selectia curenta */}
      {selected.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {(chosen.data ?? []).map((p) => (
            <li key={p.id} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrl ?? ''} alt={p.title} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={`remove ${p.title}`}
                onClick={() => toggle(p.id)}
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('inspirationPicker.dialogTitle')}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setType(null)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm',
                type === null ? 'border-walnut bg-walnut-soft text-walnut' : 'border-border-2 text-muted-foreground',
              )}
            >
              {ti('all')}
            </button>
            {TYPE_FILTERS.map((rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => setType(type === rt ? null : rt)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm',
                  type === rt ? 'border-walnut bg-walnut-soft text-walnut' : 'border-border-2 text-muted-foreground',
                )}
              >
                {tc(`rooms.type.${rt}`)}
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {t('inspirationPicker.selectedCount', { count: selected.length, max: MAX_SELECTED })}
          </p>

          {gallery.isPending && <p className="py-10 text-center text-muted-foreground">…</p>}
          {!gallery.isPending && (gallery.data ?? []).length === 0 && (
            <p className="py-10 text-center text-muted-foreground">{ti('empty')}</p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(gallery.data ?? []).map((p) => {
              const isSel = selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-pressed={isSel}
                  className={cn(
                    'group relative overflow-hidden rounded-lg border text-left transition-shadow',
                    isSel ? 'border-walnut shadow-[0_0_0_3px_hsl(var(--walnut)/0.2)]' : 'border-border-2',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl ?? ''}
                    alt={p.title}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <span className="block truncate px-2 py-1.5 text-xs">
                    {p.title}
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                      {p.company.name}
                    </span>
                  </span>
                  {isSel && (
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-walnut text-background">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
