'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useRouter } from '@/i18n/routing';
import { apiErrorKey } from '@/lib/error-messages';
import { SUPPORT_EMAIL } from '@/lib/support-email';
import { cn } from '@/lib/utils';
import { useLogin } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { authFooterCls, authLinkCls, authTitleCls } from '../_components/auth-parts';
import { PasswordInput } from '../_components/password-input';
import { ResendVerification } from '../_components/resend-verification';

const TWO_FACTOR_KEYS = ['apiErrors.TWO_FACTOR_REQUIRED', 'apiErrors.TWO_FACTOR_INVALID_CODE'];

function LoginInner() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const login = useLogin();
  // returnUrl: revenire la pagina de origine dupa login (ex. configuratorul de cereri)
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: () => router.push(redirect && redirect.startsWith('/') ? redirect : '/dashboard'),
    }),
  );

  const apiErr = login.error ? apiErrorKey(login.error) : null;
  // L0-A: cont neconfirmat → oferim retrimiterea emailului cu adresa din formular
  const emailNotVerified = apiErr?.key === 'apiErrors.EMAIL_NOT_VERIFIED';
  // cont blocat: adresa de suport (doar daca e configurata la build)
  const accountBlocked = apiErr?.key === 'apiErrors.ACCOUNT_BLOCKED' && SUPPORT_EMAIL !== '';
  // Conturile cu autentificare in doi pasi: serverul cere codul (TWO_FACTOR_REQUIRED) →
  // campul apare si ramane pe ecran pana la reusita (loginSchema.totpCode exista deja in shared).
  const twoFactorError = !!apiErr && TWO_FACTOR_KEYS.includes(apiErr.key);
  const [needsCode, setNeedsCode] = useState(false);
  useEffect(() => {
    if (twoFactorError) setNeedsCode(true);
  }, [twoFactorError]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className={authTitleCls}>{t('loginTitle')}</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field
          label={t('email')}
          error={errors.email && t(`validation.${errors.email.message}`)}
        >
          <Input type="email" autoComplete="email" className="h-11" {...register('email')} />
        </Field>

        {/* eticheta si „Ai uitat parola?" stau pe acelasi rand; linkul NU e in <label>,
            ca numele accesibil al campului sa ramana doar „Parola" */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="login-password">{t('password')}</Label>
            <Link href="/forgot-password" className={cn('text-ui', authLinkCls)}>
              {t('forgotPasswordLink')}
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-crimson">{t(`validation.${errors.password.message}`)}</p>
          )}
        </div>

        {needsCode && (
          <Field label={t('totpLabel')} hint={t('totpHint')} error={errors.totpCode && t('validation.totpInvalid')}>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              className="h-11 font-mono tracking-[0.3em]"
              {...register('totpCode', { setValueAs: (v: string) => (v ? v.trim() : undefined) })}
            />
          </Field>
        )}

        {apiErr && (
          <Alert tone={apiErr.key === 'apiErrors.TWO_FACTOR_REQUIRED' ? 'amber' : 'crimson'}>
            {t.has(apiErr.key) ? t(apiErr.key) : apiErr.fallback}
          </Alert>
        )}
        {accountBlocked && (
          <p className="text-sm text-muted-foreground">
            {t.rich('blockedContact', {
              email: SUPPORT_EMAIL,
              link: (chunks) => (
                <a className="text-walnut underline" href={`mailto:${SUPPORT_EMAIL}`}>
                  {chunks}
                </a>
              ),
            })}
          </p>
        )}
        {emailNotVerified && <ResendVerification email={getValues('email')} />}

        <Button type="submit" variant="walnut" size="xl" disabled={login.isPending} className="w-full text-lead">
          {t('loginSubmit')}
        </Button>
      </form>

      <p className={authFooterCls}>
        {t('noAccount')}{' '}
        <Link
          href={redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register'}
          className={authLinkCls}
        >
          {t('registerLink')}
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
