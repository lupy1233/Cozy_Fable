'use client';

import type { AttachmentDto, RequestRoomDto } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { AttachmentThumb } from './attachment-item';

// Fisierele generale ale cererii: pozele, planurile si proiectul incarcate la pasul "Fisiere",
// care nu tin de nicio camera. Orice id de fisier referit din raspunsurile camerelor (schite,
// imaginea 3D a piesei) apare deja in cardul camerei, deci nu se repeta aici (a2).
export function generalAttachments(
  rooms: Pick<RequestRoomDto, 'answers'>[],
  attachments: AttachmentDto[],
): AttachmentDto[] {
  const referenced = new Set<string>();
  for (const room of rooms) {
    for (const v of Object.values(room.answers ?? {})) {
      if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') referenced.add(x);
    }
  }
  return attachments.filter((a) => !referenced.has(a.id));
}

// Folosit pe fisa de lucru (dupa preluare) si pe pagina din piata (inainte de preluare).
export function RequestGeneralFiles({
  rooms,
  attachments,
}: {
  rooms: Pick<RequestRoomDto, 'answers'>[];
  attachments: AttachmentDto[];
}) {
  const t = useTranslations('Quotes');
  const general = generalAttachments(rooms, attachments);
  if (general.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="heading-section">{t('workspace.filesSection')}</h2>
      <div className="flex flex-wrap gap-2">
        {general.map((a) => (
          <AttachmentThumb key={a.id} attachment={a} />
        ))}
      </div>
    </section>
  );
}
