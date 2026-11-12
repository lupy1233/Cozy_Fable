'use client';

import { Paperclip } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  useMarkThreadRead,
  useMessages,
  useSendMessage,
  useUploadChatAttachment,
  type ChatMode,
} from '@/hooks/use-chat';
import { Button } from '@/components/ui/button';
import { SkeletonList } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export function ChatPanel({
  threadId,
  mode,
  readOnly,
  title,
  subtitle,
  counterpartName,
  className,
  messagesClassName,
}: {
  threadId: string;
  mode: ChatMode;
  readOnly?: boolean;
  // optionale (canvas 2026-11): antetul conversatiei in acelasi card
  title?: ReactNode;
  subtitle?: ReactNode;
  // cu cine vorbesti — eticheta campului de mesaj pentru cititoarele de ecran
  counterpartName?: string;
  className?: string;
  // suprascrie inaltimea listei de mesaje (implicit min-h-40 / max-h-80)
  messagesClassName?: string;
}) {
  const t = useTranslations('Chat');
  const locale = useLocale();
  const messages = useMessages(threadId, mode);
  const send = useSendMessage(threadId, mode);
  const upload = useUploadChatAttachment(threadId, mode);
  const markRead = useMarkThreadRead(mode);
  const [text, setText] = useState('');
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();

  // conversatia e citita DOAR cand panoul intra in viewport (pagina de oferte
  // arata conversatia sub/langa oferta — cea nederulata ramane necitita) si la
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

  const stamp = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div
      ref={rootRef}
      onPointerDown={onAnyInteraction}
      onFocusCapture={onAnyInteraction}
      className={cn('flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm', className)}
    >
      {title && (
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <h2 className="heading-section">{title}</h2>
          {subtitle && <p className="mt-0.5 text-ui text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      <div
        className={cn(
          'flex max-h-80 min-h-40 flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-5',
          messagesClassName,
        )}
      >
        {messages.isPending && <SkeletonList rows={3} variant="bubbles" />}
        {messages.isSuccess && messages.data.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        )}
        {messages.data?.map((m) => (
          <div
            key={m.id}
            className={cn(
              'flex max-w-[84%] flex-col gap-1',
              m.isMine ? 'items-end self-end' : 'items-start self-start',
            )}
          >
            <div
              className={cn(
                'rounded-xl px-3.5 py-2.5 text-sm',
                m.isMine ? 'bg-walnut text-on-walnut' : 'bg-surface-3 text-foreground',
              )}
            >
              {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
              {m.attachments.map((a) => (
                <a
                  key={a.id}
                  href={a.downloadUrl ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    'flex min-h-6 items-center gap-1.5 text-xs underline underline-offset-2',
                    m.body && 'mt-1',
                  )}
                >
                  <Paperclip className="size-3.5 shrink-0" aria-hidden />
                  <span className="break-all">{a.filename}</span>
                </a>
              ))}
            </div>
            <p className="font-mono text-meta text-muted-foreground">
              {m.isMine ? t('you') : m.senderName} · {stamp(m.createdAt)}
            </p>
          </div>
        ))}
      </div>

      {readOnly ? (
        <p className="border-t border-border bg-surface-2 px-4 py-3.5 text-center text-ui text-muted-foreground sm:px-5">
          {t('readOnly')}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5 border-t border-border px-4 pb-4 pt-3.5 sm:px-5">
          <label htmlFor={fieldId} className="sr-only">
            {counterpartName ? t('messageTo', { name: counterpartName }) : t('placeholder')}
          </label>
          <Textarea
            id={fieldId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder={t('placeholder')}
            className="min-h-[64px] resize-y"
          />
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <input
              ref={fileRef}
              type="file"
              onChange={onFile}
              className="hidden"
              id={`file-${threadId}`}
              tabIndex={-1}
            />
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => fileRef.current?.click()}
              className="-ml-3 px-3 text-walnut hover:text-walnut-deep"
            >
              <Paperclip aria-hidden />
              {t('attach')}
              {attachmentIds.length > 0 && (
                <span className="font-mono text-xs tabular-nums">({attachmentIds.length})</span>
              )}
            </Button>
            <Button type="button" size="lg" onClick={submit} disabled={send.isPending || upload.isPending}>
              {t('send')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
