'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAnswerClarification, useClientClarifications } from '@/hooks/use-claims-lifecycle';

export function ClientClarifications({ requestId }: { requestId: string }) {
  const t = useTranslations('Lifecycle');
  const clarifications = useClientClarifications(requestId);
  const pending = (clarifications.data ?? []).filter((c) => c.status === 'PENDING');
  if (pending.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-amber/30 bg-amber-soft p-4">
      <h2 className="font-serif text-lg text-amber">{t('clientClarificationsTitle')}</h2>
      {pending.map((c) => (
        <ClarificationAnswer key={c.id} id={c.id} question={c.questionText} />
      ))}
    </section>
  );
}

function ClarificationAnswer({ id, question }: { id: string; question: string }) {
  const t = useTranslations('Lifecycle');
  const answer = useAnswerClarification();
  const [text, setText] = useState('');
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface p-3 text-sm">
      <p className="font-medium">{question}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder={t('answerPlaceholder')}
        className="rounded-md border border-border-2 bg-surface px-3 py-2 focus-visible:border-foreground focus-visible:outline-none"
      />
      <button
        onClick={() => answer.mutate({ id, answerText: text.trim() }, { onSuccess: () => setText('') })}
        disabled={text.trim().length < 1 || answer.isPending}
        className="self-start rounded-md bg-foreground px-4 py-2 text-background transition-colors hover:bg-ink-2 disabled:opacity-50"
      >
        {t('sendAnswer')}
      </button>
    </div>
  );
}
