'use client';

import type { ClarificationRequestDto } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAnswerClarification, useClientClarifications } from '@/hooks/use-claims-lifecycle';
import { useLongDate } from './use-long-date';

// e3: serverul trimite si firma care a intrebat (camp in plus fata de ClarificationRequestDto)
type ClientClarification = ClarificationRequestDto & { companyName?: string | null };

// Intrebarile firmelor: cele la care clientul nu a raspuns inca (e randul lui, chihlimbar) si,
// dedesubt, istoricul „Intrebare / Raspunsul tau” — dupa raspuns intrebarea nu mai dispare.
export function ClientClarifications({ requestId }: { requestId: string }) {
  const t = useTranslations('Lifecycle');
  const titleId = useId();
  const historyId = useId();
  const clarifications = useClientClarifications(requestId);
  const all = (clarifications.data ?? []) as ClientClarification[];
  const pending = all.filter((c) => c.status === 'PENDING');
  // cel mai recent raspuns primul
  const answered = all
    .filter((c) => c.status === 'ANSWERED')
    .sort((a, b) => (b.answeredAt ?? b.createdAt).localeCompare(a.answeredAt ?? a.createdAt));
  if (pending.length === 0 && answered.length === 0) return null;
  return (
    <>
      {pending.length > 0 && (
        <Card as="section" tone="amber" aria-labelledby={titleId} className="flex flex-col gap-3">
          <h2 id={titleId} className="heading-section text-amber">
            {t('clientClarificationsTitle')}
          </h2>
          {pending.map((c) => (
            <ClarificationAnswer key={c.id} clarification={c} />
          ))}
        </Card>
      )}
      {answered.length > 0 && (
        <Card as="section" tone="muted" aria-labelledby={historyId} className="flex flex-col gap-3">
          <h2 id={historyId} className="heading-card">
            {t('clarificationHistory.title')}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {answered.map((c) => (
              <AnsweredClarification key={c.id} clarification={c} />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function AskedBy({ clarification: c }: { clarification: ClientClarification }) {
  const t = useTranslations('Lifecycle');
  const longDate = useLongDate();
  const date = longDate(c.createdAt);
  return (
    <p className="text-xs text-muted-foreground">
      {c.companyName
        ? t('clarificationHistory.askedBy', { company: c.companyName, date })
        : t('clarificationHistory.askedOn', { date })}
    </p>
  );
}

function AnsweredClarification({ clarification: c }: { clarification: ClientClarification }) {
  const t = useTranslations('Lifecycle');
  const longDate = useLongDate();
  return (
    <li className="flex flex-col gap-1.5 rounded-lg bg-surface p-3.5 text-sm">
      <AskedBy clarification={c} />
      <p className="whitespace-pre-wrap">
        <span className="label mr-1.5">{t('clarificationHistory.question')}</span>
        {c.questionText}
      </p>
      <p className="whitespace-pre-wrap text-ink-2">
        <span className="label mr-1.5">{t('clarificationHistory.yourAnswer')}</span>
        {c.answerText}
      </p>
      {c.answeredAt && (
        <p className="text-xs text-muted-foreground">
          {t('clarificationHistory.answeredOn', { date: longDate(c.answeredAt) })}
        </p>
      )}
    </li>
  );
}

function ClarificationAnswer({ clarification: c }: { clarification: ClientClarification }) {
  const t = useTranslations('Lifecycle');
  const answer = useAnswerClarification();
  const [text, setText] = useState('');
  const questionId = useId();
  return (
    <div className="flex flex-col gap-2.5 rounded-lg bg-surface p-3.5 text-sm">
      <AskedBy clarification={c} />
      <p id={questionId} className="whitespace-pre-wrap font-medium">
        {c.questionText}
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder={t('answerPlaceholder')}
        aria-labelledby={questionId}
        className="min-h-[64px]"
      />
      <Button
        type="button"
        size="lg"
        onClick={() => answer.mutate({ id: c.id, answerText: text.trim() }, { onSuccess: () => setText('') })}
        disabled={text.trim().length < 1 || answer.isPending}
        className="self-start"
      >
        {t('sendAnswer')}
      </Button>
    </div>
  );
}
