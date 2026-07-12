'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import {
  useMarkThreadRead,
  useMessages,
  useSendMessage,
  useUploadChatAttachment,
  type ChatMode,
} from '@/hooks/use-chat';

export function ChatPanel({
  threadId,
  mode,
  readOnly,
}: {
  threadId: string;
  mode: ChatMode;
  readOnly?: boolean;
}) {
  const t = useTranslations('Chat');
  const messages = useMessages(threadId, mode);
  const send = useSendMessage(threadId, mode);
  const upload = useUploadChatAttachment(threadId, mode);
  const markRead = useMarkThreadRead(mode);
  const [text, setText] = useState('');
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // conversatia e citita DOAR cand panoul intra in viewport (pagina de oferte
  // arata mai multe chat-uri stivuite — cele nederulate raman necitite) si la
  // fiecare mesaj nou sosit cat timp e vizibil (idee 1 PO r2)
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      threshold: 0.25,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const messagesCount = messages.data?.length;
  useEffect(() => {
    if (!inView || messagesCount === undefined) return;
    markRead.mutate(threadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, threadId, messagesCount]);
  // fallback: orice interactiune cu panoul inseamna ca e citit (IO poate lipsi
  // sau intarzia in tab-uri ascunse)
  const onAnyInteraction = () => {
    if (!inView) setInView(true);
  };

  const submit = async () => {
    if (!text.trim() && attachmentIds.length === 0) return;
    await send.mutateAsync({ body: text.trim() || undefined, attachmentIds });
    setText('');
    setAttachmentIds([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const id = await upload.mutateAsync(file);
    setAttachmentIds((ids) => [...ids, id]);
  };

  return (
    <div
      ref={rootRef}
      onPointerDown={onAnyInteraction}
      onFocusCapture={onAnyInteraction}
      className="flex flex-col rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="flex max-h-80 min-h-40 flex-col gap-2 overflow-y-auto p-4">
        {messages.isPending && <p className="text-sm text-muted-2">{t('loading')}</p>}
        {messages.isSuccess && messages.data.length === 0 && (
          <p className="text-sm text-muted-2">{t('empty')}</p>
        )}
        {messages.data?.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              m.isMine ? 'self-end bg-walnut text-primary-foreground' : 'self-start bg-surface-2 text-foreground'
            }`}
          >
            {!m.isMine && <p className="mb-0.5 text-xs font-medium opacity-70">{m.senderName}</p>}
            {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
            {m.attachments.map((a) => (
              <a
                key={a.id}
                href={a.downloadUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-xs underline"
              >
                📎 {a.filename}
              </a>
            ))}
            <p className="mt-0.5 text-[10px] opacity-60">
              {new Date(m.createdAt).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>

      {readOnly ? (
        <p className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
          {t('readOnly')}
        </p>
      ) : (
        <div className="flex items-end gap-2 border-t border-border p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder={t('placeholder')}
            className="flex-1 resize-none rounded-md border border-border-2 bg-surface px-3 py-2 text-sm focus-visible:border-foreground focus-visible:outline-none"
          />
          <input ref={fileRef} type="file" onChange={onFile} className="hidden" id={`file-${threadId}`} />
          <label
            htmlFor={`file-${threadId}`}
            className="cursor-pointer rounded-md border border-border-2 bg-surface px-3 py-2 text-sm transition-colors hover:bg-secondary"
            title={t('attach')}
          >
            📎{attachmentIds.length > 0 ? ` ${attachmentIds.length}` : ''}
          </label>
          <button
            onClick={submit}
            disabled={send.isPending || upload.isPending}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-ink-2 disabled:opacity-50"
          >
            {t('send')}
          </button>
        </div>
      )}
    </div>
  );
}
