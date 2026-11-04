'use client';

import { getFlow, summarizeAnswers, type AttachmentDto } from '@marketplace/shared';
import { ChevronDown, Pencil, Wrench } from 'lucide-react';
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
export function ReviewRoomCard({ room, attachments, designHelp, onEdit, issue, onFix }: {
  room: RoomInstance;
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
  return <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="font-serif text-xl">{roomLabel}</h3>
        {showIssue && <p className="mt-1 text-sm text-amber" data-review-room-issue>
          {issue.stepLabel ? t('review.issueRoomStep', { room: roomLabel, step: issue.stepLabel, problem: issue.problem }) : issue.problem}
        </p>}
        {showIssue && <Button type="button" variant="outline" size="sm" className="mt-2 min-h-11" onClick={onFix ?? onEdit} aria-label={t('review.fixRoom', { room: roomLabel })}>
          <Wrench aria-hidden className="mr-1 h-4 w-4" />{t('review.fix')}
        </Button>}
      </div>
      {!designHelp && <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={onEdit} aria-label={t('review.rooms.edit', { room: roomLabel })}>
        <Pencil aria-hidden className="mr-1 h-4 w-4" />{t('review.edit')}
      </Button>}
    </div>
    {designHelp ? <p className="mt-3 text-sm text-muted-foreground">{t('review.designHelpRoomNote')}</p> : <>
      <div className="mt-3" data-review-room-preview={room.roomType}>
        {entries.length > 0 && <RoomAnswerSummary roomType={room.roomType} answers={room.answers} flowVersion={room.flowVersion} stepIds={previewStepIds} hideFilePreviews />}
      </div>
      {files.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{files.map((attachment) => <AttachmentThumb key={attachment.id} attachment={attachment} />)}</div>}
      {entries.length > 0 && <details className="group mt-4 border-t border-border-2 pt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded text-sm font-medium text-walnut focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut [&::-webkit-details-marker]:hidden">
          {t('review.rooms.allAnswers')}<ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <RoomAnswerSummary roomType={room.roomType} answers={room.answers} flowVersion={room.flowVersion} attachments={attachments} hideFilePreviews />
      </details>}
    </>}
  </section>;
}
