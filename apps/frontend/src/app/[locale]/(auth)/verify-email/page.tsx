'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { Link } from '@/i18n/routing';
import { useVerifyEmail } from '@/hooks/use-auth';

function VerifyEmailInner() {
  const t = useTranslations('Auth');
  const params = useSearchParams();
  const token = params.get('token');
  const verify = useVerifyEmail();

  useEffect(() => {
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
