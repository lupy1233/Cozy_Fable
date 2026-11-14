'use client';

import {
  ATTACHMENT_ACCEPT,
  ERROR_CODES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MESSAGE_SYSTEM_KINDS,
  checkAttachmentFile,
  type MessageDto,
} from '@marketplace/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
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
import { ApiError, isUnauthorizedError } from '@/lib/api';
import { rejectReasonFromError } from '@/lib/attachment-upload';
import { cn } from '@/lib/utils';

// g3 (etapa 7): limita textului = aceeasi ca pe server (SendMessageDto @MaxLength(5000),
// sendMessageSchema .max(5000)); se numara textul trimis (fara spatiile de la capete).
export const MESSAGE_MAX_LENGTH = 5000;
// contorul apare de la 80% din limita, ca sa nu incarce campul la mesajele obisnuite
const COUNTER_FROM = 4000;

// g3: ce se afiseaza sub camp cand trimiterea / incarcarea nu reuseste.
// fileReason = cheie din Configurator.uploads.rejectReason (aceleasi texte ca in formularul de cerere, b5)
type ChatError =
  | { kind: 'tooLong' | 'readOnly' | 'tooManyFiles' | 'sendFailed' | 'filePending' }
  | { kind: 'file'; name: string; reason: 'TYPE' | 'EMPTY' | 'SIZE' | 'SCAN' | 'NETWORK' | 'INVALID' };

// a4 (etapa 4): mesajele de sistem scrise de server in conversatie (MessageDto.systemKind):
// cererea de modificare (body = textul cererii, payload.version) si refuzul ofertei
// (body = nota clientului, payload.reason). Se afiseaza ca o nota centrata, nu ca un balon.
type ChatMessage = MessageDto;
// un tip necunoscut (server mai nou) cade pe balonul obisnuit
const isSystemMessage = (m: ChatMessage): boolean =>
  MESSAGE_SYSTEM_KINDS.some((k) => k === m.systemKind);

function SystemMessage({ m, when }: { m: ChatMessage; when: string }) {
  const t = useTranslations('Chat');
  const tq = useTranslations('Quotes');
  const { systemKind, systemPayload } = m;
  const version = typeof systemPayload?.version === 'number' ? systemPayload.version : null;
  const reason = typeof systemPayload?.reason === 'string' ? systemPayload.reason : null;
  const title =
    systemKind === 'QUOTE_DECLINED'
      ? t('system.quoteDeclined')
      : version != null
        ? t('system.changeRequestedOn', { n: version })
        : t('system.changeRequested');
  return (
    <div role="note" className="flex flex-col items-center gap-1 self-center text-center">
      <div className="max-w-[92%] rounded-lg border border-dashed border-border-2 bg-surface-2 px-3.5 py-2 text-ui">
        <p className="font-medium">{title}</p>
        {systemKind === 'QUOTE_DECLINED' && reason && tq.has(`declineReasons.${reason}`) && (
          <p className="text-muted-foreground">
            {tq('declined.reasonLabel')} {tq(`declineReasons.${reason}`)}
          </p>
        )}
        {m.body && <p className="whitespace-pre-wrap break-words">“{m.body}”</p>}
      </div>
      <p className="font-mono text-meta text-muted-foreground">
        {m.senderName} · {when}
      </p>
    </div>
  );
}

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
  const tUploads = useTranslations('Configurator.uploads');
  const format = useFormatter();
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

  // g3: conversatia inchisa intre timp (THREAD_READ_ONLY) → nota „doar citire” apare imediat,
  // iar starea conversatiei se reincarca (lista de conversatii da readOnly paginii)
  const queryClient = useQueryClient();
  const [closedThreadId, setClosedThreadId] = useState<string | null>(null);
  const isReadOnly = readOnly || closedThreadId === threadId;
  const [error, setError] = useState<ChatError | null>(null);
  const errorId = useId();
  const counterId = useId();

  const trimmedLength = text.trim().length;
  const tooLong = trimmedLength > MESSAGE_MAX_LENGTH;
  const canSend = (trimmedLength > 0 || attachmentIds.length > 0) && !tooLong;

  const onThreadClosed = () => {
    setClosedThreadId(threadId);
    void queryClient.invalidateQueries({ queryKey: ['chat'] });
  };

  const submit = async () => {
    if (!canSend) return;
    setError(null);
    try {
      await send.mutateAsync({ body: text.trim() || undefined, attachmentIds });
    } catch (err) {
      // textul si fisierele raman in camp; 401 = sesiune pierduta, tratata global (session-lost)
      if (isUnauthorizedError(err)) return;
      const code = err instanceof ApiError ? err.code : null;
      if (code === ERROR_CODES.THREAD_READ_ONLY) {
        onThreadClosed();
        setError({ kind: 'readOnly' });
      } else if (code === ERROR_CODES.FILE_LIMIT_REACHED) {
        setError({ kind: 'tooManyFiles' });
      } else if (code === ERROR_CODES.VALIDATION_ERROR && tooLong) {
        setError({ kind: 'tooLong' });
      } else {
        setError({ kind: 'sendFailed' });
      }
      return;
    }
    setText('');
    setAttachmentIds([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    // acelasi fisier poate fi ales din nou dupa un refuz
    e.target.value = '';
    if (!picked) return;
    setError(null);
    if (attachmentIds.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
      setError({ kind: 'tooManyFiles' });
      return;
    }
    // aceleasi verificari ca serverul (tip cu extensie, gol, 25 MB) inainte de incarcare
    const check = checkAttachmentFile(picked);
    if (!check.ok) {
      setError({ kind: 'file', name: picked.name, reason: check.reason });
      return;
    }
    // Windows da uneori tip gol / octet-stream: se trimite tipul dedus din extensie
    const file =
      picked.type === check.mimeType ? picked : new File([picked], picked.name, { type: check.mimeType });
    try {
      const id = await upload.mutateAsync(file);
      setAttachmentIds((ids) => [...ids, id]);
    } catch (err) {
      if (isUnauthorizedError(err)) return;
      if (err instanceof ApiError && err.code === ERROR_CODES.THREAD_READ_ONLY) {
        onThreadClosed();
        setError({ kind: 'readOnly' });
        return;
      }
      const reason = rejectReasonFromError(err);
      if (reason === 'LIMIT') setError({ kind: 'tooManyFiles' });
      else if (reason === 'PENDING') setError({ kind: 'filePending' });
      else if (reason === 'NOT_EDITABLE') setError({ kind: 'file', name: file.name, reason: 'NETWORK' });
      else setError({ kind: 'file', name: file.name, reason });
    }
  };

  const errorText = (() => {
    if (!error) return null;
    switch (error.kind) {
      case 'tooLong':
        return t('errors.tooLong', { max: format.number(MESSAGE_MAX_LENGTH) });
      case 'readOnly':
        return t('errors.readOnly');
      case 'tooManyFiles':
        return t('errors.tooManyFiles', { max: MAX_ATTACHMENTS_PER_MESSAGE });
      case 'filePending':
        return t('errors.filePending');
      case 'file':
        return t('errors.file', { name: error.name, reason: tUploads(`rejectReason.${error.reason}`) });
      default:
        return t('errors.sendFailed');
    }
  })();
  // peste limita, motivul apare direct sub camp (fara sa mai apesi „Trimite”)
  const shownError = tooLong && !error ? t('errors.tooLong', { max: format.number(MESSAGE_MAX_LENGTH) }) : errorText;

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
        {messages.data?.map((m) =>
          isSystemMessage(m) ? (
            <SystemMessage key={m.id} m={m} when={stamp(m.createdAt)} />
          ) : (
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
          ),
        )}
      </div>

      {isReadOnly ? (
        <div className="flex flex-col gap-2.5 border-t border-border bg-surface-2 px-4 py-3.5 sm:px-5">
          <p className="text-center text-ui text-muted-foreground">{t('readOnly')}</p>
          {/* g3/m5: conversatia s-a inchis cand omul trimitea — mesajul NU a plecat; textul ramane
              vizibil si se poate copia pana pleaca de pe pagina */}
          {error?.kind === 'readOnly' && (
            <p role="alert" className="text-ui text-crimson">
              {t('errors.readOnly')}
            </p>
          )}
          {error?.kind === 'readOnly' && text.trim() && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${fieldId}-unsent`} className="text-ui font-medium">
                {t('unsentLabel')}
              </label>
              <Textarea
                id={`${fieldId}-unsent`}
                value={text}
                readOnly
                rows={3}
                data-chat-unsent
                className="min-h-[64px] resize-y bg-surface"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 border-t border-border px-4 pb-4 pt-3.5 sm:px-5">
          <label htmlFor={fieldId} className="sr-only">
            {counterpartName ? t('messageTo', { name: counterpartName }) : t('placeholder')}
          </label>
          <Textarea
            id={fieldId}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            rows={2}
            placeholder={t('placeholder')}
            aria-invalid={tooLong || undefined}
            aria-describedby={
              [shownError ? errorId : null, trimmedLength >= COUNTER_FROM ? counterId : null]
                .filter(Boolean)
                .join(' ') || undefined
            }
            className="min-h-[64px] resize-y"
          />
          {(shownError || trimmedLength >= COUNTER_FROM) && (
            <div className="flex items-start justify-between gap-3">
              {shownError ? (
                <p id={errorId} role="alert" className="text-ui text-crimson">
                  {shownError}
                </p>
              ) : (
                <span />
              )}
              {trimmedLength >= COUNTER_FROM && (
                <p
                  id={counterId}
                  data-chat-counter
                  className={cn(
                    'shrink-0 font-mono text-meta tabular-nums',
                    tooLong ? 'text-crimson' : 'text-muted-foreground',
                  )}
                >
                  {t('counter', {
                    count: format.number(trimmedLength),
                    max: format.number(MESSAGE_MAX_LENGTH),
                  })}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <input
              ref={fileRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
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
            <Button
              type="button"
              size="lg"
              onClick={submit}
              disabled={!canSend || send.isPending || upload.isPending}
            >
              {t('send')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
