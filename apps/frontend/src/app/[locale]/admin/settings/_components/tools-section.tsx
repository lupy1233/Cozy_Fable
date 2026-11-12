'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AdminMailTestResultDto } from '@marketplace/shared';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { useMonitoringTestError, useSendTestEmail } from '@/hooks/use-admin';
import { ApiError } from '@/lib/api';
import { SENTRY_DSN } from '@/lib/monitoring';
import { SettingsSection } from './setting-controls';

// Instrumente de test: nu schimba nicio setare, doar verifica emailul si trackerul de erori.
export function ToolsSection() {
  const t = useTranslations('Admin');
  return (
    <SettingsSection id="tools" title={t('settings.sections.tools.title')} description={t('settings.sections.tools.description')} flush>
      <MailTest />
      <div className="h-px bg-border" />
      <MonitoringTest />
    </SettingsSection>
  );
}

// Email de test (E-admin-platform-1): merge doar catre adresa adminului; arata expeditorul
// si adresa de raspuns ca adminul sa verifice configuratia slotului activ.
function MailTest() {
  const t = useTranslations('Admin');
  const m = useSendTestEmail();
  const [result, setResult] = useState<AdminMailTestResultDto | null>(null);
  const send = () =>
    m.mutate(undefined, {
      onSuccess: (data) => {
        setResult(data);
        if (data.ok) toast.success(t('settings.mailTestSent', { email: data.to }));
        else toast.error(t('settings.mailTestFailed', { error: data.error ?? '' }));
      },
      onError: () => toast.error(t('settings.saveError')),
    });
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex-[1_1_320px]">
        <h3 className="font-semibold">{t('settings.mailTitle')}</h3>
        <p className="text-ui text-muted-foreground">{t('settings.mailHint')}</p>
        {result && (
          <div className="mt-2 flex flex-col gap-0.5 font-mono text-meta text-muted-foreground">
            <span>{t('settings.mailFrom', { from: result.from })}</span>
            <span>{result.replyTo ? t('settings.mailReplyTo', { replyTo: result.replyTo }) : t('settings.mailNoReplyTo')}</span>
          </div>
        )}
      </div>
      <Button type="button" variant="outline" size="lg" className="h-11" onClick={send} disabled={m.isPending}>
        {t('settings.mailTestButton')}
      </Button>
    </div>
  );
}

// Tracker de erori (E-admin-platform-8): eroare de test pe server (500 capturat de filtru)
// si in browser (randare care arunca → ecranul error.tsx + raportare).
function MonitoringTest() {
  const t = useTranslations('Admin');
  const m = useMonitoringTestError();
  const [crash, setCrash] = useState(false);
  const sendServer = () =>
    m.mutate(undefined, {
      // 500 e rezultatul asteptat; 429 (3/min) sau alt status = eroarea nu a pornit
      onError: (error) =>
        error instanceof ApiError && error.status === 500
          ? toast.success(t('settings.monitoringServerSent'))
          : toast.error(t('settings.monitoringServerFailed')),
    });
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex-[1_1_320px]">
        <h3 className="font-semibold">{t('settings.monitoringTitle')}</h3>
        <p className="text-ui text-muted-foreground">{t('settings.monitoringHint')}</p>
        {!SENTRY_DSN && <p className="mt-1 text-xs text-muted-foreground">{t('settings.monitoringClientDisabled')}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="lg" className="h-11" onClick={sendServer} disabled={m.isPending}>
          {t('settings.monitoringServerButton')}
        </Button>
        <Button type="button" variant="outline" size="lg" className="h-11" onClick={() => setCrash(true)}>
          {t('settings.monitoringClientButton')}
        </Button>
      </div>
      {crash && <CrashNow />}
    </div>
  );
}

function CrashNow(): never {
  throw new Error('monitoring client test');
}
