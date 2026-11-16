'use client';

import type { ChatThreadDto, QuoteDto } from '@marketplace/shared';
import { Hourglass } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError, QueryState } from '@/components/ui/query-state';
import { SkeletonPage } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { useMe } from '@/hooks/use-auth';
import { useRequest } from '@/hooks/use-requests';
import { useRequestQuotes } from '@/hooks/use-quotes';
import { useThreads } from '@/hooks/use-chat';
import { useRealtimeSync } from '@/hooks/use-socket';
import { useRelativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';
import { ChatPanel } from '../../../_components/chat-panel';
import { ClientClarifications } from '../../../_components/client-clarifications';
import { ClientFulfillment } from '../../../_components/client-fulfillment';
import { OfferCard } from '../../../_components/offer-card';
import { OffersComparison, RequestJourney } from '../../../_components/offers-comparison';

// Parcursul cererii per firma (feedback PO item 4): TOATE conversatiile cu
// firmele care au preluat cererea — inclusiv cele care au scris DOAR pe chat,
// fara oferta.
// Canvas 2026-11: sus stau drumul cererii si comparatia ofertelor (de la prima
// oferta); dedesubt o firma pe rand, aleasa din taburi — oferta ei langa
// conversatia cu ea. Mesajele noi se vad in capul coloanei din comparatie si
// in contorul din tab; acceptarea ramane in cardul ofertei, cu dialog de confirmare.

type ThreadStage = 'DISCUSSION' | 'OFFER_SENT' | 'ACCEPTED' | 'CLOSED';

function stageFor(thread: ChatThreadDto, quote: QuoteDto | undefined): ThreadStage {
  // E-admin-platform-3: oferta ramane ACCEPTED ca istoric si dupa anularea proiectului
  if (quote?.status === 'ACCEPTED') return thread.claimStatus === 'CANCELLED_PROJECT' ? 'CLOSED' : 'ACCEPTED';
  // claim retras/anulat/ratat → conversatia e istorie, indiferent de oferta
  if (!['ACTIVE', 'OFFER_SENT', 'COMPLETED'].includes(thread.claimStatus)) return 'CLOSED';
  if (thread.readOnly) return 'CLOSED';
  if (quote) return 'OFFER_SENT';
  return 'DISCUSSION';
}

// culoarea spune cine are mutarea: info = asteapta firma, amber = e randul clientului,
// sage = in regula, muted = inchis
const STAGE_TONE: Record<ThreadStage, 'info' | 'amber' | 'sage' | 'muted'> = {
  DISCUSSION: 'info',
  OFFER_SENT: 'amber',
  ACCEPTED: 'sage',
  CLOSED: 'muted',
};

// id-ul panoului firmei alese; taburile primesc `${PANEL_ID}-tab-<claimSlotId>` (ui/tabs)
const PANEL_ID = 'firm-panel';

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
  // firma castigatoare — pentru panoul "ce urmeaza" de dupa acceptare
  const acceptedQuote = useMemo(
    () => (quotes.data ?? []).find((q) => q.status === 'ACCEPTED') ?? null,
    [quotes.data],
  );

  // firma deschisa la intrarea pe pagina: castigatoarea, altfel prima cu oferta de ales,
  // altfel prima care a preluat. Firmele cu mesaje noi NU se deschid singure — conversatia
  // devine citita abia cand clientul o deschide.
  const defaultClaim = useMemo(() => {
    const statusOf = (th: ChatThreadDto) => quoteByClaim.get(th.claimSlotId)?.status;
    const pick =
      requestThreads.find((th) => statusOf(th) === 'ACCEPTED') ??
      requestThreads.find((th) => statusOf(th) === 'SENT') ??
      requestThreads[0];
    return pick?.claimSlotId ?? null;
  }, [requestThreads, quoteByClaim]);
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const dataReady = !quotes.isPending && !threads.isPending;
  // alegerea se fixeaza o singura data: o oferta sosita intre timp nu schimba firma de sub ochii clientului
  useEffect(() => {
    if (dataReady && !selectedClaim && defaultClaim) setSelectedClaim(defaultClaim);
  }, [dataReady, selectedClaim, defaultClaim]);

  const firmsRef = useRef<HTMLDivElement>(null);

  const refetchAll = () => {
    void quotes.refetch();
    void request.refetch();
    void threads.refetch();
  };

  if (quotes.isPending || request.isPending || threads.isPending) {
    return <QueryState pending onRetry={refetchAll} skeleton={<SkeletonPage variant="list" />} />;
  }

  const includesPaidDesign = request.data?.includesPaidDesign ?? false;
  const selected =
    requestThreads.find((th) => th.claimSlotId === selectedClaim) ??
    requestThreads.find((th) => th.claimSlotId === defaultClaim) ??
    null;
  const selectedQuote = selected ? quoteByClaim.get(selected.claimSlotId) : undefined;

  // din comparatie / din panoul "ce urmeaza": deschide firma si du clientul la sectiunea ei
  const openFirm = (claimSlotId: string) => {
    setSelectedClaim(claimSlotId);
    document.getElementById(`${PANEL_ID}-tab-${claimSlotId}`)?.focus({ preventScroll: true });
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    firmsRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const requestLabel = request.data
    ? [request.data.title, request.data.city].filter(Boolean).join(' — ')
    : '';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: `/requests/${id}`, label: t('backToRequest') }}
        title={t('offersTitle')}
        subtitle={requestLabel ? t('offersSubtitleFor', { request: requestLabel }) : t('offersSubtitle')}
      />

      {request.data && <RequestJourney status={request.data.status} />}

      <OffersComparison
        threads={requestThreads}
        quoteByClaim={quoteByClaim}
        selectedClaimSlotId={selected?.claimSlotId ?? null}
        onSelect={openFirm}
      />

      <ClientClarifications requestId={id} />

      {request.data && (
        <ClientFulfillment
          requestId={id}
          status={request.data.status}
          acceptedCompany={
            acceptedQuote
              ? { name: acceptedQuote.companyName, claimSlotId: acceptedQuote.claimSlotId }
              : null
          }
          acceptedQuote={acceptedQuote}
          cancelledAt={request.data.cancelledAt ?? null}
          onOpenCompanyChat={openFirm}
        />
      )}

      {(threads.isError || quotes.isError) && <LoadError onRetry={refetchAll} />}

      {!threads.isError && requestThreads.length === 0 && (
        <EmptyState variant="card" size="sm" icon={Hourglass} title={t('noThreads')} className="px-4" />
      )}

      {selected && (
        <div ref={firmsRef} className="flex scroll-mt-24 flex-col gap-6">
          <Tabs
            label={t('firmsTabsLabel')}
            panelId={PANEL_ID}
            current={selected.claimSlotId}
            onChange={setSelectedClaim}
            className="mb-0 flex-wrap border-border-2"
            tabs={requestThreads.map((th) => {
              const stage = stageFor(th, quoteByClaim.get(th.claimSlotId));
              return {
                value: th.claimSlotId,
                label: (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 text-sm normal-case tracking-normal',
                      th.claimSlotId === selected.claimSlotId && 'font-semibold',
                    )}
                  >
                    <span>
                      {th.companyName} · <span className="lowercase">{t(`stage.${stage}`)}</span>
                    </span>
                    {/* mesaje necitite (idee 1 PO r2) — dispar cand conversatia e deschisa si vazuta */}
                    {th.unreadCount > 0 && (
                      <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-crimson px-1 font-mono text-meta leading-none text-primary-foreground">
                        <span aria-hidden>{th.unreadCount}</span>
                        <span className="sr-only">{t('unreadMessages', { n: th.unreadCount })}</span>
                      </span>
                    )}
                  </span>
                ),
              };
            })}
          />

          <div
            id={PANEL_ID}
            role="tabpanel"
            aria-labelledby={`${PANEL_ID}-tab-${selected.claimSlotId}`}
            className="flex flex-wrap items-start gap-6"
          >
            <section
              id={`firm-${selected.claimSlotId}`}
              aria-label={t('offerFrom', { company: selected.companyName })}
              className="min-w-0 flex-[999_1_520px]"
            >
              {selectedQuote ? (
                <OfferCard
                  key={selectedQuote.id}
                  quote={selectedQuote}
                  mode="client"
                  includesPaidDesign={includesPaidDesign}
                  headingLevel="h2"
                  meta={t('claimedAt', { time: relTime(selected.createdAt) })}
                />
              ) : (
                <NoOfferCard
                  companyName={selected.companyName}
                  stage={stageFor(selected, undefined)}
                  claimedAt={t('claimedAt', { time: relTime(selected.createdAt) })}
                />
              )}
            </section>

            <section
              aria-label={t('conversationWith', { company: selected.companyName })}
              className="min-w-0 flex-[1_1_380px]"
            >
              {/* key: ciorna unui mesaj nu trece de la o firma la alta */}
              <ChatPanel
                key={selected.id}
                threadId={selected.id}
                mode="client"
                readOnly={selected.readOnly}
                title={t('conversationWith', { company: selected.companyName })}
                subtitle={
                  selected.lastMessage
                    ? t('lastMessageAt', { time: relTime(selected.lastMessage.createdAt) })
                    : undefined
                }
                counterpartName={selected.companyName}
                messagesClassName="max-h-[560px] min-h-[240px] lg:min-h-[380px]"
              />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

// Firma a preluat cererea, dar nu are (inca) o oferta: acelasi cadru ca al ofertei,
// cu starea firmei si ce urmeaza.
function NoOfferCard({
  companyName,
  stage,
  claimedAt,
}: {
  companyName: string;
  stage: ThreadStage;
  claimedAt: string;
}) {
  const t = useTranslations('Quotes');
  return (
    <Card padding="none" className="flex flex-col">
      <div className="flex flex-col gap-0.5 border-b border-border px-5 py-4 sm:px-6">
        <h2 className="font-serif text-2xl leading-tight">{companyName}</h2>
        <p className="text-ui text-muted-foreground">{claimedAt}</p>
      </div>
      <div className="flex flex-col items-start gap-3 px-5 py-5 sm:px-6">
        <Badge tone={STAGE_TONE[stage]} dot>
          {t(`stage.${stage}`)}
        </Badge>
        <p className="max-w-prose text-sm text-muted-foreground">
          {stage === 'CLOSED'
            ? t('closedNoOffer', { company: companyName })
            : t('noOfferYet', { company: companyName })}
        </p>
      </div>
    </Card>
  );
}
