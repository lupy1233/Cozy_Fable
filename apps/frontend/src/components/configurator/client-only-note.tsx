'use client';

import { Info, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLogout } from '@/hooks/use-auth';
import { useRouter } from '@/i18n/routing';
import { hasUnpublishedLocalDraft } from '@/lib/session-cleanup';
import { cn } from '@/lib/utils';

// f2: doar un cont de client publica cereri (serverul refuza cu REQUEST_PUBLISH_CLIENT_ONLY).
// Firma sau adminul vede nota in locul butonului, cu iesirea din cont la indemana.
export function isNonClientRole(role: string | null | undefined): boolean {
  return Boolean(role) && role !== 'CLIENT';
}

export function ClientOnlyNote({ className }: { className?: string }) {
  const t = useTranslations('Configurator');
  const tc = useTranslations('Common');
  const router = useRouter();
  const logout = useLogout();
  return (
    <div
      data-client-only-note
      className={cn('flex items-start gap-2.5 rounded-lg border border-amber/30 bg-amber-soft px-4 py-3 text-sm text-amber', className)}
    >
      <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-medium">{t('clientOnly.note')}</p>
        <button
          type="button"
          disabled={logout.isPending}
          onClick={() => {
            // iesirea din cont sterge ciorna din browser: aceeasi confirmare ca in meniul contului
            if (hasUnpublishedLocalDraft() && !confirm(tc('logoutDiscardsLocalDraft'))) return;
            logout.mutate(undefined, { onSuccess: () => router.replace('/login?redirect=/requests/new') });
          }}
          className="inline-flex min-h-11 items-center gap-1.5 self-start font-medium text-walnut underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut disabled:opacity-50"
        >
          <LogOut aria-hidden className="h-4 w-4" />
          {t('clientOnly.logout')}
        </button>
      </div>
    </div>
  );
}
