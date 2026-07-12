'use client';

import type { ChatThreadDto, QuoteDto } from '@marketplace/shared';
import { Handshake, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { useMe } from '@/hooks/use-auth';
import { useRequest } from '@/hooks/use-requests';
import { useRequestQuotes } from '@/hooks/use-quotes';
import { useThreads } from '@/hooks/use-chat';
import { useRealtimeSync } from '@/hooks/use-socket';
import { useRelativeTime } from '@/lib/relative-time';
import { ChatPanel } from '../../../_components/chat-panel';
import { ClientClarifications } from '../../../_components/client-clarifications';
import { ClientFulfillment } from '../../../_components/client-fulfillment';
import { OfferCard } from '../../../_components/offer-card';

// Parcursul cererii per atelier (feedback PO item 4): TOATE conversatiile cu
// firmele care au preluat cererea — inclusiv cele care au scris DOAR pe chat,
// fara oferta (inainte, chat-ul aparea doar sub oferte si mesajele lor erau
// invizibile). Fiecare firma are sectiunea ei: status parcurs + oferta + chat.

type ThreadStage = 'DISCUSSION' | 'OFFER_SENT' | 'ACCEPTED' | 'CLOSED';

function stageFor(thread: ChatThreadDto, quote: QuoteDto | undefined): ThreadStage {
  if (quote?.status === 'ACCEPTED') return 'ACCEPTED';
  // claim retras/anulat/ratat → conversatia e istorie, indiferent de oferta
  if (!['ACTIVE', 'OFFER_SENT', 'COMPLETED'].includes(thread.claimStatus)) return 'CLOSED';
  if (thread.readOnly) return 'CLOSED';
  if (quote) return 'OFFER_SENT';
  return 'DISCUSSION';
}

const STAGE_TONE: Record<ThreadStage, 'info' | 'walnut' | 'sage' | 'muted'> = {
  DISCUSSION: 'info',
  OFFER_SENT: 'walnut',
  ACCEPTED: 'sage',
  CLOSED: 'muted',
};

export default function RequestOffersPage() {
  const t = useTranslations('Quotes');
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const me = useMe();
  const request = useRequest(id);
  const quotes = useRequestQuotes(id);
  const threads = useThreads('client');
  const relTime = useRelativeTime();
  useRealtimeSync();

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'CLIENT') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  // conversatiile acestei cereri, cele mai vechi primele (ordinea prelurii)
  const requestThreads = useMemo(
    () =>
      (threads.data ?? [])
        .filter((th) => th.requestId === id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [threads.data, id],
  );
  const quoteByClaim = useMemo(
    () => new Map((quotes.data ?? []).map((q) => [q.claimSlotId, q])),
    [quotes.data],
  );

  if (quotes.isPending || request.isPending || threads.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }

  const includesPaidDesign = request.data?.includesPaidDesign ?? false;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href={`/requests/${id}`} className="text-sm text-walnut hover:underline">
        ← {t('backToRequest')}
      </Link>
      <div>
        <h1 className="page-title">{t('offersTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('offersSubtitle')}</p>
      </div>

      <ClientClarifications requestId={id} />

      {request.data && <ClientFulfillment requestId={id} status={request.data.status} />}

      {requestThreads.length === 0 && (
        <p className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
          {t('noThreads')}
        </p>
      )}

      {requestThreads.map((thread, i) => {
        const quote = quoteByClaim.get(thread.claimSlotId);
        const stage = stageFor(thread, quote);
        return (
          <section
            key={thread.id}
            className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
          >
            {/* antetul atelierului: nume + status parcurs + ultimul mesaj */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-walnut-soft font-serif text-sm text-walnut">
                  {i + 1}
                </span>
                <div>
                  <h2 className="flex items-center gap-2 font-serif text-lg leading-tight">
                    {thread.companyName}
                    {/* punct de necitit (idee 1 PO r2) — dispare cand derulezi la chat */}
                    {thread.unreadCount > 0 && (
                      <span
                        aria-label={t('unreadDot')}
                        className="inline-block h-2.5 w-2.5 rounded-full bg-crimson"
                      />
                    )}
                  </h2>
                  <p className="flex items-center gap-1 text-[11px] text-muted-2">
                    <Handshake className="h-3 w-3" />
                    {t('claimedAt', { time: relTime(thread.createdAt) })}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone={STAGE_TONE[stage]}>{t(`stage.${stage}`)}</Badge>
                {thread.unreadCount > 0 ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-crimson">
                    <MessageSquare className="h-3 w-3" />
                    {t('unreadMessages', { n: thread.unreadCount })}
                  </span>
                ) : (
                  thread.lastMessage && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-2">
                      <MessageSquare className="h-3 w-3" />
                      {t('lastMessageAt', { time: relTime(thread.lastMessage.createdAt) })}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 p-4">
              {quote ? (
                <OfferCard quote={quote} mode="client" includesPaidDesign={includesPaidDesign} />
              ) : (
                <p className="rounded-lg border border-dashed border-border-2 bg-surface-2 px-3 py-2.5 text-sm text-muted-foreground">
                  {t('noOfferYet', { company: thread.companyName })}
                </p>
              )}
              <ChatPanel threadId={thread.id} mode="client" readOnly={thread.readOnly} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
