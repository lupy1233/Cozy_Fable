'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { AppShell } from '../_components/app-shell';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

// Ruta protejata client-side: fara user → redirect la /login
export default function DashboardPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);

  if (me.isPending || me.isError) {
    return (
      <>
        <AppShell>
          <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>
        </AppShell>
      </>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <h1 className="page-title">{t('dashboardTitle')}</h1>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <Avatar name={me.data.name} size={56} />
          <div>
            <p className="font-serif text-xl">{me.data.name}</p>
            <p className="text-sm text-muted-foreground">{me.data.email}</p>
            <Badge tone="walnut" className="mt-2">
              {t(`role.${me.data.role}`)}
            </Badge>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
