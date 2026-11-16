'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAnswerClarification, useClientClarifications } from '@/hooks/use-claims-lifecycle';

// Intrebarile firmelor la care clientul nu a raspuns inca — e randul lui (chihlimbar).
export function ClientClarifications({ requestId }: { requestId: string }) {
  const t = useTranslations('Lifecycle');
  const titleId = useId();
  const clarifications = useClientClarifications(requestId);
  const pending = (clarifications.data ?? []).filter((c) => c.status === 'PENDING');
  if (pending.length === 0) return null;
  return (
    <Card as="section" tone="amber" aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="heading-section text-amber">
        {t('clientClarificationsTitle')}
      </h2>
      {pending.map((c) => (
        <ClarificationAnswer key={c.id} id={c.id} question={c.questionText} />
      ))}
    </Card>
  );
}

function ClarificationAnswer({ id, question }: { id: string; question: string }) {
  const t = useTranslations('Lifecycle');
  const answer = useAnswerClarification();
  const [text, setText] = useState('');
  const questionId = useId();
  return (
    <div className="flex flex-col gap-2.5 rounded-lg bg-surface p-3.5 text-sm">
      <p id={questionId} className="whitespace-pre-wrap font-medium">
        {question}
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
        onClick={() => answer.mutate({ id, answerText: text.trim() }, { onSuccess: () => setText('') })}
        disabled={text.trim().length < 1 || answer.isPending}
        className="self-start"
      >
        {t('sendAnswer')}
      </Button>
    </div>
  );
}
