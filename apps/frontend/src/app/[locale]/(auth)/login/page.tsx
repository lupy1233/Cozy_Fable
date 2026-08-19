'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useRouter } from '@/i18n/routing';
import { apiErrorKey } from '@/lib/error-messages';
import { useLogin } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { ResendVerification } from '../_components/resend-verification';

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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl">{t('loginTitle')}</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field
          label={t('email')}
          error={errors.email && t(`validation.${errors.email.message}`)}
        >
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>

        <Field
          label={t('password')}
          error={errors.password && t(`validation.${errors.password.message}`)}
        >
          <Input type="password" autoComplete="current-password" {...register('password')} />
        </Field>

        <div className="-mt-2 text-right">
          <Link href="/forgot-password" className="text-xs text-walnut underline">
            {t('forgotPasswordLink')}
          </Link>
        </div>

        {apiErr && (
          <Alert tone="crimson">{t.has(apiErr.key) ? t(apiErr.key) : apiErr.fallback}</Alert>
        )}
        {emailNotVerified && <ResendVerification email={getValues('email')} />}

        <Button type="submit" disabled={login.isPending} className="w-full">
          {t('loginSubmit')}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link
          href={redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register'}
          className="text-walnut underline"
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
