'use client';

import {
  type AnswerMap,
  type AttachmentDto,
  type RequestItemInput,
  type RoomType,
} from '@marketplace/shared';
import { useLocale, useTranslations } from 'next-intl';
import type { DimensionUnit } from '@/lib/dimension-format';
import { AttachmentThumb } from './attachment-item';
import { buildSummaryRows, type SummaryRow } from './summary-rows';

// Randare Q→A a raspunsurilor unei camere in Sumar (ReviewRoomCard). Randurile vin din
// buildSummaryRows (etichete scurte, "Altul — text" pe un rand, dimensiuni in unitatea
// clientului); `only` alege lista scurta ('main') sau restul ('extra').
// Cand primeste si lista de atasamente, pasii de tip upload arata preview-uri
// (thumbnail imagini, iconita PDF/ZIP, eroare la BLOCKED) — feedback PO item 10.
export function RoomAnswerSummary({
  roomType,
  answers,
  flowVersion,
  attachments,
  hideFilePreviews = false,
  only,
  unit = 'cm',
}: {
  roomType: RoomType;
  answers: Record<string, unknown>;
  // versiunea flow-ului cu care au fost salvate raspunsurile (null = pre-versionare → 1)
  flowVersion?: number | null;
  // atasamentele cererii/draftului — optionale; fara ele, pasii upload arata doar numarul
  attachments?: AttachmentDto[];
  hideFilePreviews?: boolean;
  // lista scurta din Sumar ('main') sau doar randurile ascunse ('extra'); lipsa = toate
  only?: SummaryRow['importance'];
  // unitatea aleasa de client in formular; cererile fara unitate → cm
  unit?: DimensionUnit;
}) {
  const t = useTranslations('Configurator');
  const locale = useLocale();
  const rows = buildSummaryRows({ roomType, answers, flowVersion }, t, { unit, locale }).filter(
    (row) => !only || row.importance === only,
  );

  if (rows.length === 0) return null;

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
      {rows.map((row) => (
        <div key={row.key} className="flex min-w-0 flex-col gap-1 py-2 sm:flex-row sm:gap-4">
          {/* j1: eticheta nu ia mai mult de jumatate; valoarea se rupe si fara spatii */}
          <dt className="text-sm font-medium text-muted-foreground sm:w-2/5 sm:max-w-[45%] sm:shrink-0">{row.label}</dt>
          <dd className="min-w-0 flex-1 break-words text-sm [overflow-wrap:anywhere]">
            {row.kind === 'text' && <span className="whitespace-pre-wrap">{row.value}</span>}
            {row.kind === 'pieces' && (
              <ul className="flex flex-col gap-0.5">
                {(row.pieces ?? []).map((p, i) => (
                  <li key={i}>
                    <p>{pieceLine(p)}</p>
                    {p.description && <p className="whitespace-pre-wrap text-muted-foreground">{p.description}</p>}
                  </li>
                ))}
              </ul>
            )}
            {row.kind === 'files' &&
              (() => {
                const files = hideFilePreviews ? [] : filesFor(row.stepId);
                if (files.length === 0) return <span className="text-muted-foreground">{row.value}</span>;
                return (
                  <span className="flex flex-wrap gap-2">
                    {files.map((a) => (
                      <AttachmentThumb key={a.id} attachment={a} />
                    ))}
                  </span>
                );
              })()}
            {row.kind !== 'text' && row.kind !== 'pieces' && row.kind !== 'files' && (
              <span className={row.invalid ? 'text-crimson' : undefined}>
                {row.swatch && (
                  <span
                    aria-hidden
                    data-swatch={row.swatch}
                    className="mr-1.5 inline-block h-3 w-3 rounded-full border border-border-2 align-[-1px]"
                    style={{ backgroundColor: row.swatch }}
                  />
                )}
                {row.value}
                {row.invalid && <span className="ml-1.5 text-xs">({t('sheet.toFix')})</span>}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
