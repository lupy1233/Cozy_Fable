'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@marketplace/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from '@/i18n/routing';
import { apiErrorKey } from '@/lib/error-messages';
import { useRegister } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { ResendVerification } from '../_components/resend-verification';

function RegisterInner() {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const registerMutation = useRegister();

  // Landing "Esti firma?" trimite ?role=company → pre-selecteaza contul de firma
  const initialRole = searchParams.get('role') === 'company' ? 'COMPANY_USER' : 'CLIENT';
  // pastreaza returnUrl-ul pe drumul register → login (dupa verificare email)
  const redirect = searchParams.get('redirect');
  const loginHref = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: initialRole, languagePreference: locale === 'en' ? 'EN' : 'RO' },
  });

  const onSubmit = handleSubmit((values) => registerMutation.mutate(values));

  const apiErr = registerMutation.error ? apiErrorKey(registerMutation.error) : null;

  if (registerMutation.isSuccess) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-serif text-2xl">{t('registerSuccessTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('registerSuccessBody')}</p>
        {/* L0-A: emailul se poate pierde → retrimitere direct de aici */}
        <ResendVerification email={registerMutation.variables?.email} prompt={t('resendPrompt')} />
        <Link href={loginHref} className="text-walnut underline">
          {t('goToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl">{t('registerTitle')}</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label={t('name')} error={errors.name && t(`validation.${errors.name.message}`)}>
          <Input {...register('name')} />
        </Field>

        <Field label={t('email')} error={errors.email && t(`validation.${errors.email.message}`)}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>

        <Field
          label={t('password')}
          error={errors.password && t(`validation.${errors.password.message}`)}
        >
          <Input type="password" autoComplete="new-password" {...register('password')} />
        </Field>

        <Field label={t('phone')}>
          <Input type="tel" autoComplete="tel" {...register('phone')} />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            {t('accountType')}
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" value="CLIENT" className="accent-walnut" {...register('role')} />
            {t('roleClient')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" value="COMPANY_USER" className="accent-walnut" {...register('role')} />
            {t('roleCompany')}
          </label>
        </fieldset>

        {/* L0-A: acceptarea termenilor e obligatorie (zod literal(true) + server) */}
        <Field error={errors.termsAccepted && t(`validation.${errors.termsAccepted.message}`)}>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 accent-walnut"
              {...register('termsAccepted')}
            />
            <span>
              {t.rich('termsLabel', {
                terms: (chunks) => (
                  <Link href="/terms" target="_blank" className="text-walnut underline">
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link href="/privacy" target="_blank" className="text-walnut underline">
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </label>
        </Field>

        {apiErr && (
          <Alert tone="crimson">{t.has(apiErr.key) ? t(apiErr.key) : apiErr.fallback}</Alert>
        )}

        <Button type="submit" disabled={registerMutation.isPending} className="w-full">
          {t('registerSubmit')}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {t('haveAccount')}{' '}
        <Link href={loginHref} className="text-walnut underline">
          {t('loginLink')}
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterInner />
    </Suspense>
  );
}
