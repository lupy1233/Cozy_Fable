'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Bell, Check, FileText, Handshake, MessageSquare, RefreshCw } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from '@/hooks/use-notifications';
import { useRealtimeSync } from '@/hooks/use-socket';
import { useRelativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';

// Clopotelul de notificari (item 5): titlu clar per tip + contextul actiunii
// (atelier · cerere) din payload, click = citit + navigare la resursa,
// inchidere la click in afara, "marcheaza toate citite".

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  'quote.created': FileText,
  'quote.updated': RefreshCw,
  'quote.accepted': Check,
  'message.created': MessageSquare,
  'claim.created': Handshake,
};

type Payload = Record<string, unknown> | null;

const str = (p: Payload, key: string): string | null => {
  const v = p?.[key];
  return typeof v === 'string' && v.trim() ? v : null;
};

// Deep-link-ul notificarii, in functie de rolul contului.
function hrefFor(type: string, payload: Payload, role: string | undefined): string | null {
  const requestId = str(payload, 'requestId');
  if (role === 'CLIENT') {
    if (!requestId) return null;
    if (type === 'request.status_changed') return `/requests/${requestId}`;
    return `/requests/${requestId}/offers`;
  }
  if (role === 'COMPANY_USER') {
    // conversatiile si ofertele firmei traiesc pe pagina de claims
    return '/marketplace/claims';
  }
  return null;
}

export function NotificationBell() {
  const t = useTranslations('Notifications');
  const router = useRouter();
  const me = useMe();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  const list = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  const relTime = useRelativeTime();
  const rootRef = useRef<HTMLDivElement>(null);
  useRealtimeSync();

  // inchidere la click in afara / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const count = unread.data?.unread ?? 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-8 w-8 place-items-center rounded-md border border-border-2 bg-surface-2 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t('title')}
        aria-expanded={open}
      >
        <Bell className="h-3.5 w-3.5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-crimson px-1 text-[10px] font-bold text-background">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[22rem] overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">{t('title')}</span>
            {count > 0 && (
              <button
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="text-xs text-walnut hover:underline disabled:opacity-50"
              >
                {t('markAll')}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {list.isSuccess && list.data.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                <Bell className="h-5 w-5 text-muted-2" />
                <p className="text-sm text-muted-2">{t('empty')}</p>
              </div>
            )}
            {list.data?.map((n) => {
              const Icon = TYPE_ICON[n.type] ?? Bell;
              const company = str(n.payload, 'companyName');
              const request = str(n.payload, 'requestTitle');
              const context = [company, request].filter(Boolean).join(' · ');
              const href = hrefFor(n.type, n.payload, me.data?.role);
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read) markRead.mutate(n.id);
                    if (href) {
                      setOpen(false);
                      router.push(href);
                    }
                  }}
                  className={cn(
                    'flex w-full items-start gap-2.5 border-b border-border px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-secondary',
                    n.read && 'opacity-55',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full',
                      n.read ? 'bg-surface-2 text-muted-2' : 'bg-walnut-soft text-walnut',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {t.has(`type.${n.type}`) ? t(`type.${n.type}`) : n.type}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-2">
                        {relTime(n.createdAt)}
                      </span>
                    </span>
                    {context && (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {context}
                      </span>
                    )}
                  </span>
                  {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-walnut" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
