'use client';

import { getFlow, summarizeAnswers, type AttachmentDto } from '@marketplace/shared';
import { Check, ChevronDown, Pencil, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { RoomInstance } from '@/stores/configurator-store';
import { AttachmentThumb } from './attachment-item';
import { RoomAnswerSummary } from './room-answer-summary';

// Problema care blocheaza publicarea camerei (validarea locala sau raspunsul
// serverului): eticheta pasului, daca exista, + textul problemei.
export interface ReviewRoomIssue {
  stepLabel?: string;
  problem: string;
}

// Textul pentru client vine din raspunsurile localizate, nu din denumirile de firma derivate.
export function ReviewRoomCard({ room, index, attachments, designHelp, onEdit, issue, onFix }: {
  room: RoomInstance;
  // pozitia camerei in cerere (1-based) — numarul de registru din antet
  index?: number;
  attachments: AttachmentDto[];
  designHelp: boolean;
  onEdit: () => void;
  issue?: ReviewRoomIssue | null;
  // "Completeaza": redeschide camera la pasul problema (implicit = onEdit)
  onFix?: () => void;
}) {
  const t = useTranslations('Configurator');
  const { entries, previewStepIds } = useMemo(() => {
    try {
      const flow = getFlow(room.roomType, room.flowVersion);
      return {
        entries: summarizeAnswers(room.roomType, room.answers, room.flowVersion),
        previewStepIds: flow.steps.filter((step) => !step.screenGroup?.startsWith('piece:') && step.type !== 'upload').map((step) => step.id),
      };
    } catch {
      return { entries: [], previewStepIds: [] };
    }
  }, [room]);
  const fileIds = new Set(entries.filter((entry) => entry.kind === 'files').flatMap((entry) => {
    const value = room.answers[entry.stepId];
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  }));
  const files = attachments.filter((attachment) => fileIds.has(attachment.id));
  const roomLabel = t(`rooms.type.${room.roomType}`);
  const showIssue = issue != null && !designHelp;
  return <section className="rounded-xl border border-border bg-surface px-5 py-5 sm:px-6">
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        {/* numarul sta langa titlu, nu in el: numele titlului ramane exact camera */}
        <div className="flex items-baseline gap-2">
          {index !== undefined && <span aria-hidden className="font-mono text-xs text-walnut">{String(index).padStart(2, '0')}</span>}
          <h2 className="heading-section">{roomLabel}</h2>
        </div>
        {showIssue && <p className="mt-1 text-sm text-amber" data-review-room-issue>
          {issue.stepLabel ? t('review.issueRoomStep', { room: roomLabel, step: issue.stepLabel, problem: issue.problem }) : issue.problem}
        </p>}
        {showIssue && <Button type="button" variant="outline" size="sm" className="mt-2 min-h-11" onClick={onFix ?? onEdit} aria-label={t('review.fixRoom', { room: roomLabel })}>
          <Wrench aria-hidden />{t('review.fix')}
        </Button>}
      </div>
      {!designHelp && <div className="flex items-center gap-3">
        {/* starea camerei: salvie = completa, chihlimbar = mai e ceva de completat */}
        {showIssue
          ? <span className="text-ui font-medium text-amber">{t('review.roomIncomplete')}</span>
          : <span className="inline-flex items-center gap-1.5 text-ui font-medium text-sage"><Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />{t('review.roomComplete')}</span>}
        <Button type="button" variant="outline" size="lg" className="h-11 px-3.5" onClick={onEdit} aria-label={t('review.rooms.edit', { room: roomLabel })}>
          <Pencil aria-hidden />{t('review.edit')}
        </Button>
      </div>}
    </div>
    {designHelp ? <p className="mt-3 text-sm text-muted-foreground">{t('review.designHelpRoomNote')}</p> : <>
      <div className="mt-3" data-review-room-preview={room.roomType}>
        {entries.length > 0 && <RoomAnswerSummary roomType={room.roomType} answers={room.answers} flowVersion={room.flowVersion} stepIds={previewStepIds} hideFilePreviews />}
      </div>
      {files.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{files.map((attachment) => <AttachmentThumb key={attachment.id} attachment={attachment} />)}</div>}
      {entries.length > 0 && <details className="group mt-4 border-t border-border pt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded text-sm font-medium text-walnut focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut [&::-webkit-details-marker]:hidden">
          {t('review.rooms.allAnswers')}<ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <RoomAnswerSummary roomType={room.roomType} answers={room.answers} flowVersion={room.flowVersion} attachments={attachments} hideFilePreviews />
      </details>}
    </>}
  </section>;
}
