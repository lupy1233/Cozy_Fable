'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useRequest } from '@/hooks/use-requests';
import { useRequestQuotes } from '@/hooks/use-quotes';
import { useThreads } from '@/hooks/use-chat';
import { useRealtimeSync } from '@/hooks/use-socket';
import { ChatPanel } from '../../../_components/chat-panel';
import { ClientClarifications } from '../../../_components/client-clarifications';
import { ClientFulfillment } from '../../../_components/client-fulfillment';
import { OfferCard } from '../../../_components/offer-card';

export default function RequestOffersPage() {
  const t = useTranslations('Quotes');
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const me = useMe();
  const request = useRequest(id);
  const quotes = useRequestQuotes(id);
  const threads = useThreads('client');
  useRealtimeSync();

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'CLIENT') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (quotes.isPending || request.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }

  const includesPaidDesign = request.data?.includesPaidDesign ?? false;
  const threadByClaim = new Map((threads.data ?? []).map((th) => [th.claimSlotId, th]));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href={`/requests/${id}`} className="text-sm text-walnut hover:underline">
        ← {t('backToRequest')}
      </Link>
      <h1 className="page-title">{t('offersTitle')}</h1>

      <ClientClarifications requestId={id} />

      {request.data && <ClientFulfillment requestId={id} status={request.data.status} />}

      {quotes.data && quotes.data.length === 0 && (
        <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
          {t('noOffers')}
        </p>
      )}

      {quotes.data?.map((q) => {
        const thread = threadByClaim.get(q.claimSlotId);
        return (
          <section key={q.id} className="flex flex-col gap-3">
            <OfferCard quote={q} mode="client" includesPaidDesign={includesPaidDesign} />
            {thread && (
              <ChatPanel threadId={thread.id} mode="client" readOnly={thread.readOnly} />
            )}
          </section>
        );
      })}
    </div>
  );
}
