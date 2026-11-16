'use client';

import type { ReactNode, Ref } from 'react';
import { Suspense, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Check, Loader2, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSessionRole } from '@/hooks/use-auth';
import { useSetEmailPreference } from '@/hooks/use-notifications';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PublicShell } from '../_components/public-shell';

// Dezabonare de la emailurile de notificare (Q4, idee 5): link-ul semnat din
// footer-ul emailului duce aici — fara login; semnatura HMAC valideaza cererea.
// Canvas design 2026-11-12: intai intrebam, apoi confirmam, cu drum inapoi. Contractul API
// e neschimbat (POST /notifications/unsubscribe { uid, sig }); apelul pleaca abia la
// apasarea butonului, nu la deschiderea paginii.
export default function UnsubscribePage() {
  return (
    <PublicShell>
      <Suspense fallback={null}>
        <UnsubscribeInner />
      </Suspense>
    </PublicShell>
  );
}

type View = 'ask' | 'done' | 'resubscribed' | 'invalid';

// 4xx (in afara de 429) = serverul a refuzat linkul (uid/sig gresite). Orice altceva
// (retea, 429, 5xx) e trecator: ramanem pe intrebare, cu posibilitatea de a reincerca.
function isRejectedLink(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429;
}

const TONES = {
  walnut: 'bg-walnut-soft text-walnut',
  sage: 'bg-sage-soft text-sage',
  crimson: 'bg-crimson-soft text-crimson',
} as const;

function UnsubscribeInner() {
  const t = useTranslations('Unsubscribe');
  const tn = useTranslations('Nav');
  const params = useSearchParams();
  const { user, pending: sessionPending } = useSessionRole();

  const uid = params.get('uid') ?? '';
  const sig = params.get('sig') ?? '';

  // comanda e idempotenta pe server; mutatie simpla, fara cache
  const unsubscribe = useMutation({
    mutationFn: () =>
      api<{ ok: boolean }>('/notifications/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ uid, sig }),
      }),
  });
  // Reabonarea exista doar ca preferinta a contului autentificat (PATCH
  // /notifications/email-preference); nu exista varianta pe baza linkului semnat. O oferim
  // deci numai cand in acest browser e autentificat chiar contul din link.
  const resubscribe = useSetEmailPreference();
  const canResubscribe = user !== null && user.id === uid;

  const rejected =
    (unsubscribe.isSuccess && !unsubscribe.data?.ok) ||
    (unsubscribe.isError && isRejectedLink(unsubscribe.error));
  const failed = unsubscribe.isError && !rejected;

  const view: View =
    !uid || !sig || rejected
      ? 'invalid'
      : resubscribe.data?.enabled
        ? 'resubscribed'
        : unsubscribe.data?.ok
          ? 'done'
          : 'ask';

  // la schimbarea starii butonul apasat dispare: mutam focusul pe noul titlu,
  // ca tastatura si cititoarele de ecran sa nu ramana in gol
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownView = useRef(view);
  useEffect(() => {
    if (shownView.current === view) return;
    shownView.current = view;
    headingRef.current?.focus();
  }, [view]);

  const homeLink = (variant: 'outline' | 'link') => (
    <Button asChild variant={variant} size="lg" className={cn('h-11 w-full', variant === 'link' && 'text-walnut')}>
      <Link href="/">{t('backHome')}</Link>
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-md py-4 sm:py-10">
      {view === 'ask' && (
        <StateCard
          key="ask"
          icon={Mail}
          tone="walnut"
          title={t('title')}
          headingRef={headingRef}
          className="shadow"
          actions={
            <>
              <Button
                variant="walnut"
                size="lg"
                className="h-11 w-full"
                disabled={unsubscribe.isPending}
                onClick={() => unsubscribe.mutate()}
              >
                {unsubscribe.isPending && <Loader2 aria-hidden className="animate-spin" />}
                {unsubscribe.isPending ? t('working') : t('confirm')}
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 w-full">
                <Link href="/">{t('keep')}</Link>
              </Button>
            </>
          }
        >
          <p className="text-lead text-muted-foreground">{t('effect')}</p>
          {failed && (
            <Alert tone="crimson" role="alert" icon={<AlertTriangle aria-hidden />}>
              {t('failed')}
            </Alert>
          )}
        </StateCard>
      )}

      {view === 'done' && (
        <StateCard
          key="done"
          role="status"
          icon={Check}
          tone="sage"
          title={t('doneTitle')}
          headingRef={headingRef}
          actions={
            <>
              {homeLink('outline')}
              {canResubscribe ? (
                <Button
                  variant="link"
                  size="lg"
                  className="h-auto min-h-11 w-full whitespace-normal py-1 text-walnut"
                  disabled={resubscribe.isPending}
                  onClick={() => resubscribe.mutate(true)}
                >
                  {resubscribe.isPending && <Loader2 aria-hidden className="animate-spin" />}
                  {resubscribe.isPending ? t('resubscribing') : t('resubscribe')}
                </Button>
              ) : (
                !sessionPending &&
                !user && (
                  <Button asChild variant="link" size="lg" className="h-11 w-full text-walnut">
                    <Link href="/login">{t('login')}</Link>
                  </Button>
                )
              )}
            </>
          }
        >
          <p className="text-lead text-muted-foreground">{t('effect')}</p>
          <p className="text-ui text-muted-foreground">{t('reenableHint')}</p>
          {resubscribe.isError && (
            <Alert tone="crimson" role="alert" icon={<AlertTriangle aria-hidden />}>
              {t('resubscribeFailed')}
            </Alert>
          )}
        </StateCard>
      )}

      {view === 'resubscribed' && (
        <StateCard
          key="resubscribed"
          role="status"
          icon={Mail}
          tone="sage"
          title={t('resubscribedTitle')}
          headingRef={headingRef}
          actions={homeLink('outline')}
        >
          <p className="text-lead text-muted-foreground">{t('resubscribedBody')}</p>
        </StateCard>
      )}

      {view === 'invalid' && (
        <StateCard
          key="invalid"
          role="alert"
          icon={AlertTriangle}
          tone="crimson"
          title={t('invalidTitle')}
          headingRef={headingRef}
          className="border-crimson/30"
          actions={
            <>
              <Button asChild variant="outline" size="lg" className="h-11 w-full">
                {user ? (
                  <Link href="/dashboard">{tn('dashboard')}</Link>
                ) : (
                  <Link href="/login">{t('login')}</Link>
                )}
              </Button>
              {homeLink('link')}
            </>
          }
        >
          <p className="text-lead text-muted-foreground">{t('invalid')}</p>
          <p className="text-ui text-muted-foreground">
            {user ? t('invalidHintSignedIn') : t('invalidHint')}
          </p>
        </StateCard>
      )}
    </div>
  );
}

// Un singur card pe ecran, cu aceeasi inaltime minima in toate starile: actiunile stau
// jos, deci trecerea intrebare → confirmare nu misca pagina.
function StateCard({
  icon: Icon,
  tone,
  title,
  role,
  headingRef,
  className,
  actions,
  children,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  title: string;
  role?: 'status' | 'alert';
  headingRef: Ref<HTMLHeadingElement>;
  className?: string;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card
      as="section"
      role={role}
      padding="none"
      className={cn('flex min-h-[400px] flex-col gap-3.5 p-6 sm:p-8', className)}
    >
      <span aria-hidden className={cn('grid size-12 place-items-center rounded-full', TONES[tone])}>
        <Icon className="size-[22px]" />
      </span>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-serif text-3xl leading-tight focus-visible:outline-none"
      >
        {title}
      </h1>
      {children}
      <div className="mt-auto flex flex-col gap-2.5 pt-2">{actions}</div>
    </Card>
  );
}
