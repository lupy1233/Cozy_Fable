'use client';

import { ImageOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InspirationPhotoDto, RequestInspirationPhotoDto, RoomType } from '@marketplace/shared';
import { Card } from '@/components/ui/card';
import { ContactSafeText } from '@/components/ui/contact-safe-text';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { useInspirationByIds } from '@/hooks/use-inspiration';

// E-client-34: pozele de inspiratie alese pe o cerere, GRUPATE pe camere, cu notita
// clientului. Inlocuieste banda veche de thumbnails pe detaliul clientului, al marketplace-ului
// (pre-claim, notite mascate) si pe fisa de lucru (post-claim). `rooms` are aceeasi ordine ca
// RoomSpecCard de pe pagina: numarul camerei = ancora #room-{index}.

interface Entry {
  photo: RequestInspirationPhotoDto;
  info: InspirationPhotoDto | undefined;
}

function PhotoCard({ entry }: { entry: Entry }) {
  const t = useTranslations('Inspiration');
  const { info, photo } = entry;
  return (
    <Card as="li" padding="none" className="flex flex-col overflow-hidden">
      {info ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={info.imageUrl ?? ''} alt={info.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="grid aspect-[4/3] w-full place-items-center bg-surface-2 text-muted-foreground">
          <span className="flex flex-col items-center gap-1 text-xs">
            <ImageOff className="h-5 w-5" aria-hidden />
            {t('imageUnavailable')}
          </span>
        </div>
      )}
      {info && (
        <span className="block truncate px-3 py-2 text-meta">
          {info.title}
          <span className="block truncate text-micro uppercase tracking-wide text-muted-foreground">
            {info.company.name}
          </span>
        </span>
      )}
      {photo.note && (
        <blockquote className="mx-3 mb-3 border-l-2 border-walnut/40 pl-2 text-sm">
          <span className="block text-micro uppercase tracking-wide text-muted-foreground">{t('clientNote')}</span>
          <ContactSafeText text={photo.note} />
        </blockquote>
      )}
    </Card>
  );
}

function PhotoList({ entries }: { entries: Entry[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => (
        <PhotoCard key={entry.photo.photoId} entry={entry} />
      ))}
    </ul>
  );
}

export function RequestInspirationByRoom({
  photos,
  rooms,
}: {
  photos: RequestInspirationPhotoDto[];
  rooms: { id: string; roomType: RoomType }[];
}) {
  const t = useTranslations('Inspiration');
  const tc = useTranslations('Configurator');
  const query = useInspirationByIds(photos.map((p) => p.photoId));

  if (photos.length === 0) return null;

  if (query.isPending) {
    return (
      <section className="flex flex-col gap-2" aria-labelledby="request-inspiration-heading">
        <h2 id="request-inspiration-heading" className="font-serif text-xl">
          {t('requestSection')}
        </h2>
        <LoadingRegion className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: Math.min(photos.length, 3) }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full rounded-xl" />
          ))}
        </LoadingRegion>
      </section>
    );
  }

  const byId = new Map((query.data ?? []).map((p) => [p.id, p]));
  // poza retrasa din galerie: ramane doar daca are notita (ca sa nu se piarda ce a scris clientul)
  const entries: Entry[] = photos
    .map((photo) => ({ photo, info: byId.get(photo.photoId) }))
    .filter((e) => e.info !== undefined || !!e.photo.note);
  if (entries.length === 0) return null;

  const roomIndex = new Map(rooms.map((r, i) => [r.id, i]));
  const byRoom = rooms.map(() => [] as Entry[]);
  const general: Entry[] = [];
  for (const e of entries) {
    const idx = e.photo.requestRoomId ? roomIndex.get(e.photo.requestRoomId) : undefined;
    if (idx === undefined) general.push(e);
    else byRoom[idx].push(e);
  }
  const grouped = byRoom.some((list) => list.length > 0);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="request-inspiration-heading">
      <h2 id="request-inspiration-heading" className="font-serif text-xl">
        {t('requestSection')}
      </h2>
      {/* cereri vechi / nicio poza legata de camera: o singura lista, fara titluri de grup */}
      {!grouped && <PhotoList entries={general} />}
      {grouped &&
        byRoom.map((list, i) =>
          list.length === 0 ? null : (
            <div key={rooms[i].id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium">
                  {t('requestRoomHeading', { index: i + 1, room: tc(`rooms.type.${rooms[i].roomType}`) })}
                </h3>
                <a href={`#room-${i + 1}`} className="text-sm text-walnut underline-offset-2 hover:underline">
                  {t('seeRoom')}
                </a>
              </div>
              <PhotoList entries={list} />
            </div>
          ),
        )}
      {grouped && general.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-medium">{t('requestGeneral')}</h3>
          <PhotoList entries={general} />
        </div>
      )}
    </section>
  );
}
