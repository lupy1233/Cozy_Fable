'use client';

import {
  summarizeAnswers,
  type AnswerMap,
  type AttachmentDto,
  type RequestItemInput,
  type RoomType,
} from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { AttachmentThumb } from './attachment-item';
import { config3dChips } from './piece3d/config-chips';

// Randare Q→A a raspunsurilor unei camere, partajata de pasul Review si de paginile
// de detaliu (client + marketplace). Cheile de continut vin din flow config (i18n).
// Cand primeste si lista de atasamente, pasii de tip upload arata preview-uri
// (thumbnail imagini, iconita PDF/ZIP, eroare la BLOCKED) — feedback PO item 10.
export function RoomAnswerSummary({
  roomType,
  answers,
  flowVersion,
  attachments,
}: {
  roomType: RoomType;
  answers: Record<string, unknown>;
  // versiunea flow-ului cu care au fost salvate raspunsurile (null = pre-versionare → 1)
  flowVersion?: number | null;
  // atasamentele cererii/draftului — optionale; fara ele, pasii upload arata doar numarul
  attachments?: AttachmentDto[];
}) {
  const t = useTranslations('Configurator');
  const entries = summarizeAnswers(roomType, answers as AnswerMap, flowVersion ?? 1);

  if (entries.length === 0) return null;

  const pieceLine = (p: RequestItemInput) => {
    const systems = p.systems.map((s) => t(`common.systems.${s}.label`)).join(', ');
    const material = t(`common.materials.${p.material}.label`);
    return `${p.quantity}× ${p.name} — ${material}${systems ? ` · ${systems}` : ''}`;
  };

  const filesFor = (stepId: string): AttachmentDto[] => {
    const ids = (answers as AnswerMap)[stepId];
    if (!Array.isArray(ids) || !attachments) return [];
    const byId = new Map(attachments.map((a) => [a.id, a]));
    return (ids as string[]).map((id) => byId.get(id)).filter((a): a is AttachmentDto => !!a);
  };

  return (
    <dl className="flex flex-col divide-y divide-border-2">
      {entries.map((e) => (
        <div key={e.stepId} className="flex flex-col gap-1 py-2 sm:flex-row sm:gap-4">
          <dt className="text-sm font-medium text-muted-foreground sm:w-2/5">{t(e.labelKey)}</dt>
          <dd className="flex-1 text-sm">
            {e.kind === 'choice' && e.optionLabelKeys.map((k) => t(k)).join(', ')}
            {e.kind === 'boolean' && t(e.value ? 'common.boolean.yes' : 'common.boolean.no')}
            {e.kind === 'dimensions' &&
              e.slots.map((s) => `${t(s.labelKey)}: ${s.value} m`).join(' · ')}
            {e.kind === 'number' && e.value}
            {e.kind === 'config3d' && config3dChips(t, e.config).join(' · ')}
            {e.kind === 'text' && <span className="whitespace-pre-wrap">{e.value}</span>}
            {e.kind === 'pieces' && (
              <ul className="flex flex-col gap-0.5">
                {e.pieces.map((p, i) => (
                  <li key={i}>{pieceLine(p)}</li>
                ))}
              </ul>
            )}
            {e.kind === 'files' &&
              (() => {
                const files = filesFor(e.stepId);
                if (files.length === 0) {
                  return (
                    <span className="text-muted-foreground">
                      {t('summaryFiles.count', { n: e.count })}
                    </span>
                  );
                }
                return (
                  <span className="flex flex-wrap gap-2">
                    {files.map((a) => (
                      <AttachmentThumb key={a.id} attachment={a} />
                    ))}
                  </span>
                );
              })()}
          </dd>
        </div>
      ))}
    </dl>
  );
}
