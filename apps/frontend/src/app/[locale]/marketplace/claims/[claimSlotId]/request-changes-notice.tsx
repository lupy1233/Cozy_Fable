'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useLongDate } from '../../../_components/use-long-date';

// e3 (etapa 9): forma raspunsului GET /claims/:id/request-changes (vezi
// apps/backend/src/modules/requests/request-version-diff.ts). Doar CE s-a schimbat, fara valori:
// valorile noi le vede firma pe fisa, cu aceeasi mascare ca pana acum.
export type RequestChangeField =
  | 'budget'
  | 'deadline'
  | 'description'
  | 'location'
  | 'designHelp'
  | 'ownProject'
  | 'inspiration';
export interface RequestRoomChange {
  change: 'ADDED' | 'REMOVED' | 'MODIFIED';
  roomType: string;
  ordinal: number;
  ofType: number;
  detailed: boolean;
  aspects: ('answers' | 'designHelp' | 'approxLength')[];
}
export interface ClaimRequestEditDto {
  edit: {
    editedAt: string;
    comparable: boolean;
    fields: RequestChangeField[];
    rooms: RequestRoomChange[];
  } | null;
}

export function useClaimRequestChanges(claimSlotId: string) {
  return useQuery({
    // sub 'lifecycle': se reimprospateaza odata cu restul fisei (invalidateAll)
    queryKey: ['lifecycle', 'request-changes', claimSlotId],
    // corp gol → null (TanStack respinge undefined)
    queryFn: async () => (await api<ClaimRequestEditDto>(`/claims/${claimSlotId}/request-changes`)) ?? null,
    enabled: !!claimSlotId,
    retry: false,
  });
}

// Caseta de pe fisa preluarii: „Cererea a fost modificata pe … — ce s-a schimbat”. Apare doar
// daca clientul a editat cererea DUPA ce firma a preluat-o (serverul intoarce edit = null altfel).
export function RequestChangesNotice({ claimSlotId }: { claimSlotId: string }) {
  const changes = useClaimRequestChanges(claimSlotId);
  const edit = changes.data?.edit;
  if (!edit) return null;
  return <RequestChangesCard edit={edit} />;
}

export function RequestChangesCard({ edit }: { edit: NonNullable<ClaimRequestEditDto['edit']> }) {
  const t = useTranslations('Quotes');
  const tr = useTranslations('Requests');
  const tm = useTranslations('Marketplace');
  const tc = useTranslations('Configurator');
  const longDate = useLongDate();
  const titleId = useId();

  const fieldLabel = (f: RequestChangeField): string => {
    switch (f) {
      // termenii din glosar, din cheile existente
      case 'description':
        return tr('field.message');
      case 'designHelp':
        return tm('includesPaidDesign');
      case 'ownProject':
        return tr('field.hasOwnProject');
      default:
        return t(`requestChanges.field.${f}`);
    }
  };
  const roomName = (r: RequestRoomChange): string => {
    const type = tc.has(`rooms.type.${r.roomType}`) ? tc(`rooms.type.${r.roomType}`) : r.roomType;
    return r.ofType > 1 ? t('requestChanges.roomNumbered', { room: type, n: r.ordinal }) : type;
  };
  const roomLine = (r: RequestRoomChange): string => {
    const room = roomName(r);
    if (r.change === 'ADDED') return t('requestChanges.roomAdded', { room });
    if (r.change === 'REMOVED') return t('requestChanges.roomRemoved', { room });
    // fara detalii cand copiile nu se pot compara sigur (alta versiune a chestionarului)
    if (!r.detailed || r.aspects.length === 0) return t('requestChanges.roomModified', { room });
    const what = r.aspects.map((a) => t(`requestChanges.aspect.${a}`)).join(', ');
    return t('requestChanges.roomModifiedWhat', { room, what });
  };

  const lines = [...edit.fields.map(fieldLabel), ...edit.rooms.map(roomLine)];
  return (
    <Card as="section" tone="info" aria-labelledby={titleId} className="flex flex-col gap-2 sm:px-6">
      <h2 id={titleId} className="heading-card">
        {t('requestChanges.title', { date: longDate(edit.editedAt) })}
      </h2>
      {lines.length > 0 && (
        <>
          <p className="text-sm font-medium">{t('requestChanges.whatChanged')}</p>
          <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-ink-2">
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </>
      )}
      {/* camerele nu s-au putut compara: spunem doar ca cererea s-a schimbat, fara detalii inventate */}
      {!edit.comparable && <p className="text-sm text-ink-2">{t('requestChanges.notComparable')}</p>}
      {edit.comparable && lines.length === 0 && (
        <p className="text-sm text-ink-2">{t('requestChanges.nothingVisible')}</p>
      )}
      <p className="text-xs text-muted-foreground">{t('requestChanges.hint')}</p>
    </Card>
  );
}
