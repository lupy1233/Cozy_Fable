'use client';

import type { ChatThreadDto } from '@marketplace/shared';
import { ArrowLeft, ExternalLink, Paperclip, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useTeamThread, useThreads } from '@/hooks/use-chat';
import { useRealtimeSync } from '@/hooks/use-socket';
import { useRelativeTime } from '@/lib/relative-time';
import { StatusBadge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChatPanel } from '../../_components/chat-panel';

// Mesagerie firma (PO r6): toate conversatiile cu clientii intr-un singur loc,
// master-detail — lista in stanga, conversatia aleasa in dreapta. Pe mobil
// lista si conversatia sunt ecrane succesive. Tabul "Echipa firmei" = chatul
// intern al firmei (toti membrii, fara client).
export default function CompanyMessagesPage() {
  const t = useTranslations('Messages');
  const tm = useTranslations('Marketplace');
  const router = useRouter();
  const me = useMe();
  const threads = useThreads('company');
  const [tab, setTab] = useState<'clients' | 'team'>('clients');
  const team = useTeamThread(me.data?.role === 'COMPANY_USER');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useRealtimeSync();

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'COMPANY_USER') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  // implicit: prima conversatie cu necitite, altfel prima din lista (doar desktop
  // — pe mobil utilizatorul alege explicit, ca sa nu sara direct intr-un chat)
  const list = threads.data ?? [];
  const selected = list.find((th) => th.id === selectedId) ?? null;

  if (me.isPending || threads.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">{t('title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex gap-1.5">
        <TabButton active={tab === 'clients'} onClick={() => setTab('clients')}>
          {t('tabClients')}
          {list.some((th) => th.unreadCount > 0) && <UnreadDot />}
        </TabButton>
        <TabButton active={tab === 'team'} onClick={() => setTab('team')}>
          <Users className="h-3.5 w-3.5" />
          {t('tabTeam')}
          {(team.data?.unreadCount ?? 0) > 0 && <UnreadDot />}
        </TabButton>
      </div>

      {tab === 'team' ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t('teamHint')}</p>
          {team.data ? (
            <ChatPanel threadId={team.data.id} mode="company" />
          ) : (
            <p className="py-10 text-center text-muted-foreground">{t('loading')}</p>
          )}
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* lista conversatiilor — pe mobil se ascunde cand una e deschisa */}
          <div
            className={cn(
              'flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm',
              selected ? 'hidden lg:flex' : 'flex',
            )}
          >
            <ul className="divide-y divide-border-2">
              {list.map((th) => (
                <ThreadRow
                  key={th.id}
                  thread={th}
                  active={th.id === selected?.id}
                  onOpen={() => setSelectedId(th.id)}
                />
              ))}
            </ul>
          </div>

          {/* conversatia aleasa */}
          <div className={cn('flex-col gap-3', selected ? 'flex' : 'hidden lg:flex')}>
            {selected ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary lg:hidden"
                      aria-label={t('backToList')}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <h2 className="font-serif text-lg">{selected.requestTitle || '—'}</h2>
                    <StatusBadge
                      status={selected.claimStatus}
                      label={tm(`claimStatus.${selected.claimStatus}`)}
                    />
                  </div>
                  <Link
                    href={`/marketplace/claims/${selected.claimSlotId}`}
                    className="inline-flex items-center gap-1 text-sm text-walnut hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t('openClaim')}
                  </Link>
                </div>
                <ChatPanel threadId={selected.id} mode="company" readOnly={selected.readOnly} />
              </>
            ) : (
              <p className="rounded-xl border border-dashed border-border-2 px-4 py-16 text-center text-sm text-muted-foreground">
                {t('pickThread')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-walnut bg-walnut-soft text-walnut'
          : 'border-border-2 bg-surface text-muted-foreground hover:border-muted-2',
      )}
    >
      {children}
    </button>
  );
}

function UnreadDot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-crimson" aria-hidden />;
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
  const relTime = useRelativeTime();
  const last = thread.lastMessage;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors',
          active ? 'bg-walnut-soft/60' : 'hover:bg-surface-2',
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium">{thread.requestTitle || '—'}</span>
            {thread.unreadCount > 0 && (
              <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-crimson px-1 text-[10px] font-bold leading-none text-white">
                {thread.unreadCount}
              </span>
            )}
          </span>
          {last && (
            <span className="shrink-0 text-[11px] text-muted-2">{relTime(last.createdAt)}</span>
          )}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {last ? (
            <>
              <span className="shrink-0 font-medium">
                {last.senderRole === 'CLIENT' ? t('fromClient') : t('fromUs')}:
              </span>
              {last.body ? (
                <span className="truncate">{last.body}</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-muted-2">
                  <Paperclip className="h-3 w-3" />
                  {t('attachmentOnly')}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-2">{t('noMessagesYet')}</span>
          )}
        </span>
        {thread.readOnly && (
          <span className="text-[11px] text-muted-2">{t('readOnly')}</span>
        )}
      </button>
    </li>
  );
}
