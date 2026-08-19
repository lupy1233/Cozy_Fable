'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { useVerifyEmail } from '@/hooks/use-auth';
import { ResendVerification } from '../_components/resend-verification';

function VerifyEmailInner() {
  const t = useTranslations('Auth');
  const params = useSearchParams();
  // tokenul se citeste o data si se scoate din URL (nu ajunge in Referer/istoric)
  const [token] = useState(() => params.get('token'));
  const verify = useVerifyEmail();

  useEffect(() => {
    if (params.get('token')) window.history.replaceState(null, '', window.location.pathname);
    if (token && verify.isIdle) verify.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex flex-col gap-4 text-center">
      <h1 className="font-serif text-2xl">{t('verifyTitle')}</h1>
      {!token && <p className="text-crimson">{t('verifyMissingToken')}</p>}
      {verify.isPending && <p className="text-muted-foreground">{t('verifyPending')}</p>}
      {verify.isSuccess && (
        <>
          <p className="text-sage">{t('verifySuccess')}</p>
          <Link href="/login" className="text-walnut underline">
            {t('goToLogin')}
          </Link>
        </>
      )}
      {verify.isError && <p className="text-crimson">{t('verifyError')}</p>}
      {/* L0-A: link invalid/expirat sau lipsa → cere adresa si retrimite */}
      {(verify.isError || !token) && (
        <ResendVerification prompt={t('resendPromptExpired')} className="text-left" />
      )}
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
