'use client';

import type { ChatThreadDto } from '@marketplace/shared';
import { ArrowLeft, Paperclip, Search, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useTeamThread, useThreads } from '@/hooks/use-chat';
import { useMyClaims } from '@/hooks/use-marketplace';
import { useRealtimeSync } from '@/hooks/use-socket';
import { useRelativeTime } from '@/lib/relative-time';
import { useSlaDateFormat } from '@/lib/sla-deadline';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ContactSafeText } from '@/components/ui/contact-safe-text';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips } from '@/components/ui/filter-chips';
import { PageHeader } from '@/components/ui/page-header';
import { QueryState } from '@/components/ui/query-state';
import { SkeletonCard, SkeletonPage } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ChatPanel } from '../../_components/chat-panel';
import { AccessBlocked } from '../_components/access-blocked';

// cautare fara diacritice si fara majuscule ("bucatarie" gaseste "Bucătărie")
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Mesagerie firma (PO r6, design 2026-11): toate conversatiile cu clientii intr-un singur loc,
// master-detail — lista (cu cautare si necitite) in stanga, conversatia aleasa in dreapta.
// Pe mobil lista si conversatia sunt ecrane succesive. "Echipa firmei" = chatul intern al
// firmei (toti membrii, fara client).
export default function CompanyMessagesPage() {
  const t = useTranslations('Messages');
  const tm = useTranslations('Marketplace');
  const router = useRouter();
  const me = useMe();
  const threads = useThreads('company');
  // preluarile firmei: termenul ofertei din antetul conversatiei (legat prin claimSlotId)
  const claims = useMyClaims();
  const fmtSla = useSlaDateFormat();
  const [tab, setTab] = useState<'clients' | 'team'>('clients');
  const team = useTeamThread(me.data?.role === 'COMPANY_USER');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  useRealtimeSync();

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'COMPANY_USER') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  // La prima incarcare se deschide singura prima conversatie cu necitite, altfel prima din
  // lista — doar pe desktop; pe mobil utilizatorul alege explicit, ca sa nu sara direct intr-un
  // chat. O singura data: dupa ce conversatia e citita, selectia nu mai sare la urmatoarea.
  const autoPicked = useRef(false);
  useEffect(() => {
    const data = threads.data;
    if (autoPicked.current || !data || data.length === 0) return;
    autoPicked.current = true;
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    const first = data.find((th) => th.unreadCount > 0) ?? data[0];
    if (first) setSelectedId(first.id);
  }, [threads.data]);

  const list = threads.data ?? [];
  const selected = list.find((th) => th.id === selectedId) ?? null;
  const needle = fold(query.trim());
  const visible = needle ? list.filter((th) => fold(th.requestTitle || '').includes(needle)) : list;
  const unreadClients = list.reduce((n, th) => n + th.unreadCount, 0);
  const unreadTeam = team.data?.unreadCount ?? 0;

  if (me.isPending || threads.isPending) {
    return (
      <QueryState
        pending
        onRetry={() => void threads.refetch()}
        skeleton={<SkeletonPage variant="list" />}
      />
    );
  }
  // 403/404 (firma neaprobata / suspendata / fara abonament) → ecran de blocaj, nu pagina goala
  if (threads.isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('title')} />
        <AccessBlocked error={threads.error} onRetry={() => void threads.refetch()} />
      </div>
    );
  }

  // termenul ofertei (SLA) pentru conversatia aleasa — doar cat preluarea e activa si SLA-ul curge
  const selectedClaim = selected ? claims.data?.find((cl) => cl.id === selected.claimSlotId) : undefined;
  const offerDue =
    selectedClaim && selectedClaim.status === 'ACTIVE' && selectedClaim.slaDeadlineAt && !selectedClaim.slaPaused
      ? t('offerDue', { date: fmtSla(selectedClaim.slaDeadlineAt) })
      : null;
  const selectedMeta = [offerDue, selected?.readOnly ? t('readOnly') : null].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <FilterChips
            label={t('tabsLabel')}
            value={tab}
            onChange={(v) => v && setTab(v)}
            options={[
              {
                value: 'clients' as const,
                label: t('tabClients'),
                indicator: unreadClients > 0 ? <NewCount n={unreadClients} /> : undefined,
              },
              {
                value: 'team' as const,
                label: t('tabTeam'),
                icon: <Users className="h-3.5 w-3.5" />,
                indicator: unreadTeam > 0 ? <NewCount n={unreadTeam} /> : undefined,
              },
            ]}
          />
        }
      />

      {tab === 'team' ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t('teamHint')}</p>
          {team.data ? (
            <ChatPanel threadId={team.data.id} mode="company" messagesClassName="min-h-[360px] max-h-[60vh]" />
          ) : team.isError ? (
            <AccessBlocked error={team.error} onRetry={() => void team.refetch()} />
          ) : (
            <SkeletonCard lines={4} />
          )}
        </div>
      ) : list.length === 0 ? (
        <EmptyState variant="card" title={t('empty')} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* lista conversatiilor — pe mobil se ascunde cand una e deschisa */}
          <Card
            as="section"
            aria-label={t('listLabel')}
            padding="none"
            className={cn('flex-col overflow-hidden', selected ? 'hidden lg:flex' : 'flex')}
          >
            <label className="m-3.5 flex h-11 items-center gap-2 rounded-md border border-border-2 bg-surface px-3 transition-colors focus-within:border-foreground focus-within:ring-2 focus-within:ring-foreground/5">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="sr-only">{t('searchLabel')}</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="h-10 min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-2 focus-visible:outline-none"
              />
            </label>
            {visible.length === 0 ? (
              <p className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
                {t('searchEmpty')}
              </p>
            ) : (
              <ul>
                {visible.map((th) => (
                  <ThreadRow
                    key={th.id}
                    thread={th}
                    active={th.id === selected?.id}
                    onOpen={() => setSelectedId(th.id)}
                  />
                ))}
              </ul>
            )}
          </Card>

          {/* conversatia aleasa */}
          <section
            aria-label={selected ? t('threadLabel', { title: selected.requestTitle || '—' }) : undefined}
            className={cn('min-w-0 flex-col gap-3', selected ? 'flex' : 'hidden lg:flex')}
          >
            {selected ? (
              <>
                <Card
                  padding="none"
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0 lg:hidden"
                      onClick={() => setSelectedId(null)}
                      aria-label={t('backToList')}
                    >
                      <ArrowLeft />
                    </Button>
                    <div className="min-w-0">
                      <h2 className="heading-section break-words">
                        {selected.requestTitle ? <ContactSafeText text={selected.requestTitle} /> : '—'}
                      </h2>
                      {selectedMeta && <p className="text-xs text-muted-foreground">{selectedMeta}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge
                      status={selected.claimStatus}
                      label={tm(`claimStatus.${selected.claimStatus}`)}
                    />
                    <Button asChild variant="outline" size="lg">
                      <Link href={`/marketplace/claims/${selected.claimSlotId}`}>{t('openClaim')}</Link>
                    </Button>
                  </div>
                </Card>
                {/* key: ciorna si fisierele atasate nu trec dintr-o conversatie in alta */}
                <ChatPanel
                  key={selected.id}
                  threadId={selected.id}
                  mode="company"
                  readOnly={selected.readOnly}
                  messagesClassName="min-h-[360px] max-h-[60vh]"
                />
              </>
            ) : (
              <EmptyState variant="dashed" size="sm" title={t('pickThread')} className="py-10" />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

// "2 noi" langa numele tabului — mesaje necitite
function NewCount({ n }: { n: number }) {
  const t = useTranslations('Messages');
  return <span className="font-mono text-xs opacity-85">{t('newCount', { n })}</span>;
}

function ThreadRow({
  thread,
  active,
  onOpen,
}: {
  thread: ChatThreadDto;
  active: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations('Messages');
  const tm = useTranslations('Marketplace');
  const relTime = useRelativeTime();
  const last = thread.lastMessage;
  const unread = thread.unreadCount > 0;
  return (
    <li className={cn('border-t border-border', active && 'bg-surface-2')}>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'flex w-full flex-col gap-0.5 border-l-[3px] px-4 py-3.5 text-left transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-walnut',
          active ? 'border-l-walnut' : 'border-l-transparent hover:bg-surface-2',
        )}
      >
        <span className="flex items-center justify-between gap-2.5">
          <span className={cn('min-w-0 truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>
            {thread.requestTitle ? <ContactSafeText text={thread.requestTitle} /> : '—'}
          </span>
          {last && (
            <span className="shrink-0 font-mono text-meta text-muted-foreground">{relTime(last.createdAt)}</span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {tm(`claimStatus.${thread.claimStatus}`)}
          {thread.readOnly && ` · ${t('readOnly')}`}
        </span>
        <span className="flex items-center justify-between gap-2.5">
          <span className="flex min-w-0 items-center gap-1.5 text-ui text-ink-2">
            {last ? (
              <>
                <span className="shrink-0 font-medium">
                  {last.senderRole === 'CLIENT' ? t('fromClient') : t('fromUs')}:
                </span>
                {last.body ? (
                  <span className="truncate">{last.body}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Paperclip className="h-3 w-3" aria-hidden />
                    {t('attachmentOnly')}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{t('noMessagesYet')}</span>
            )}
          </span>
          {unread && (
            <span
              title={tm('myClaims.newMessages', { n: thread.unreadCount })}
              className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-crimson px-1 font-mono text-meta leading-none text-white"
            >
              {thread.unreadCount}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
