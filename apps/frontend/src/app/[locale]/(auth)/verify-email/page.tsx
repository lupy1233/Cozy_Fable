'use client';

import { Check, CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { useVerifyEmail } from '@/hooks/use-auth';
import { hasUnpublishedLocalDraft } from '@/lib/session-cleanup';
import { Button } from '@/components/ui/button';
import { AuthStateIcon, authFooterCls, authLinkCls, authTitleCls } from '../_components/auth-parts';
import { ResendVerification } from '../_components/resend-verification';
import { verifyLoginHref } from '../_components/verify-login-href';

function VerifyEmailInner() {
  const t = useTranslations('Auth');
  const params = useSearchParams();
  // tokenul se citeste o data si se scoate din URL (nu ajunge in Referer/istoric)
  const [token] = useState(() => params.get('token'));
  // b4: adresa de intoarcere din link (pusa de server doar pentru cai permise) se citeste
  // tot o data; rezerva pe acelasi dispozitiv = ciorna nepublicata din browser
  const [returnTo] = useState(() => params.get('redirect'));
  const [hasLocalDraft, setHasLocalDraft] = useState(false);
  const verify = useVerifyEmail();
  const loginHref = verifyLoginHref(returnTo, hasLocalDraft);

  useEffect(() => setHasLocalDraft(hasUnpublishedLocalDraft()), []);

  useEffect(() => {
    if (params.get('token')) window.history.replaceState(null, '', window.location.pathname);
    if (token && verify.isIdle) verify.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (verify.isSuccess) {
    return (
      <div role="status" className="flex flex-col gap-5">
        <AuthStateIcon icon={Check} tone="sage" />
        <h1 className={authTitleCls}>{t('verifySuccessTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('verifySuccessBody')}</p>
        <Button asChild variant="walnut" size="xl" className="w-full text-lead">
          <Link href={loginHref}>{t('goToLogin')}</Link>
        </Button>
      </div>
    );
  }

  // L0-A: link invalid/expirat sau lipsa → cere adresa si retrimite
  if (verify.isError || !token) {
    return (
      <div className="flex flex-col gap-5">
        <AuthStateIcon icon={CircleAlert} tone="crimson" />
        <h1 className={authTitleCls}>{t('linkInvalidTitle')}</h1>
        <p role="alert" className="text-sm text-muted-foreground">
          {token ? t('verifyError') : t('verifyMissingToken')}
        </p>
        <ResendVerification prompt={t('resendPromptExpired')} />
        <p className={authFooterCls}>
          <Link href={loginHref} className={authLinkCls}>
            ← {t('backToLogin')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div role="status" className="flex flex-col gap-5">
      <h1 className={authTitleCls}>{t('verifyTitle')}</h1>
      <p className="text-sm text-muted-foreground">{t('verifyPending')}</p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}
