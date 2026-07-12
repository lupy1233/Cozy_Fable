'use client';

import { MailX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { PublicShell } from '../_components/public-shell';

// Dezabonare de la emailurile de notificare (Q4, idee 5): link-ul semnat din
// footer-ul emailului duce aici — fara login; semnatura HMAC valideaza cererea.
export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeInner />
    </Suspense>
  );
}

function UnsubscribeInner() {
  const t = useTranslations('Unsubscribe');
  const params = useSearchParams();

  const uid = params.get('uid') ?? '';
  const sig = params.get('sig') ?? '';

  // comanda e one-shot si idempotenta pe server — apel direct, fara cache;
  // remount-ul din StrictMode doar repeta POST-ul cu acelasi rezultat
  const [status, setStatus] = useState<'working' | 'done' | 'invalid'>(
    uid && sig ? 'working' : 'invalid',
  );
  useEffect(() => {
    if (!uid || !sig) return;
    let alive = true;
    api<{ ok: boolean }>('/notifications/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ uid, sig }),
    })
      .then((r) => alive && setStatus(r.ok ? 'done' : 'invalid'))
      .catch(() => alive && setStatus('invalid'));
    return () => {
      alive = false;
    };
  }, [uid, sig]);

  return (
    <PublicShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-walnut-soft text-walnut">
          <MailX className="h-7 w-7" />
        </span>
        <h1 className="page-title">{t('title')}</h1>
        {status === 'working' && <p className="text-muted-foreground">{t('working')}</p>}
        {status === 'done' && <p className="text-muted-foreground">{t('done')}</p>}
        {status === 'invalid' && <p className="text-muted-foreground">{t('invalid')}</p>}
        {status === 'done' && <p className="text-xs text-muted-2">{t('reenableHint')}</p>}
        <Button asChild variant="walnut" className="mt-2">
          <Link href="/">{t('backHome')}</Link>
        </Button>
      </div>
    </PublicShell>
  );
}
