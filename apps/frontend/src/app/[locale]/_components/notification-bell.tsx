'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Bell } from 'lucide-react';
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from '@/hooks/use-notifications';
import { useRealtimeSync } from '@/hooks/use-socket';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const t = useTranslations('Notifications');
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  const list = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  useRealtimeSync();

  const count = unread.data?.unread ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-8 w-8 place-items-center rounded-md border border-border-2 bg-surface-2 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t('title')}
      >
        <Bell className="h-3.5 w-3.5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-crimson px-1 text-[10px] font-bold text-background">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">{t('title')}</span>
            {count > 0 && (
              <button onClick={() => markAll.mutate()} className="text-xs text-walnut hover:underline">
                {t('markAll')}
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {list.isSuccess && list.data.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-2">{t('empty')}</p>
            )}
            {list.data?.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.read && markRead.mutate(n.id)}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2 text-left text-sm transition-colors hover:bg-secondary',
                  n.read && 'opacity-60',
                )}
              >
                <span className="font-medium">
                  {!n.read && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-walnut" />}
                  {t.has(`type.${n.type}`) ? t(`type.${n.type}`) : n.type}
                </span>
                <span className="text-xs text-muted-2">{new Date(n.createdAt).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
