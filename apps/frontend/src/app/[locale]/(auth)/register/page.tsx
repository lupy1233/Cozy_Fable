'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@marketplace/shared';
import { Mail } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from '@/i18n/routing';
import { apiErrorKey } from '@/lib/error-messages';
import { cn } from '@/lib/utils';
import { useRegister } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { firmRulesChunk } from '../../_components/firm-rules-link';
import {
  AuthStateIcon,
  AuthTile,
  authFooterCls,
  authLinkCls,
  authTitleCls,
} from '../_components/auth-parts';
import { PasswordInput } from '../_components/password-input';
import { ResendVerification } from '../_components/resend-verification';

const ROLE_CARDS = [
  { value: 'CLIENT', title: 'roleClientTitle', hint: 'roleClientHint' },
  { value: 'COMPANY_USER', title: 'roleCompanyTitle', hint: 'roleCompanyHint' },
] as const;

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
    watch,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: initialRole, languagePreference: locale === 'en' ? 'EN' : 'RO' },
  });

  // E-company-9: firmele accepta si "Regulile pentru firme" (link in tab nou, sa nu piarda formularul)
  const role = watch('role');
  const onSubmit = handleSubmit((values) => registerMutation.mutate(values));

  const apiErr = registerMutation.error ? apiErrorKey(registerMutation.error) : null;

  if (registerMutation.isSuccess) {
    return (
      <div role="status" className="flex flex-col gap-5">
        <AuthStateIcon icon={Mail} tone="walnut" />
        <h1 className={authTitleCls}>{t('registerSuccessTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('registerSuccessBody')}</p>
        {/* L0-A: emailul se poate pierde → retrimitere direct de aici */}
        <ResendVerification email={registerMutation.variables?.email} prompt={t('resendPrompt')} />
        <Link href={loginHref} className={cn('self-center py-2 text-sm', authLinkCls)}>
          {t('goToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* formularul e inalt: doua planse in plus, mai jos, ca marginile sa nu ramana goale */}
      <AuthTile src="/illustrations/options/bed-side-drawers.png" className="left-[-346px] top-[520px] w-[210px]" />
      <AuthTile src="/illustrations/options/desk-straight.png" className="right-[-340px] top-[548px] w-[204px]" />

      <h1 className={authTitleCls}>{t('registerTitle')}</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {/* tipul de cont se alege primul, pe cartonase (design 2026-11) */}
        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">{t('accountType')}</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-2.5">
            {ROLE_CARDS.map((card) => {
              const selected = role === card.value;
              return (
                <label
                  key={card.value}
                  className={cn(
                    'flex cursor-pointer gap-2.5 rounded-lg border bg-surface p-3.5 transition-colors',
                    selected
                      ? 'border-walnut bg-walnut-soft ring-1 ring-walnut'
                      : 'border-border-2 hover:border-muted-2',
                  )}
                >
                  <input type="radio" value={card.value} className="mt-1 accent-walnut" {...register('role')} />
                  <span>
                    <span className="block text-sm font-semibold">{t(card.title)}</span>
                    <span className={cn('text-ui', selected ? 'text-walnut-deep' : 'text-muted-foreground')}>
                      {t(card.hint)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Field label={t('name')} error={errors.name && t(`validation.${errors.name.message}`)}>
          <Input autoComplete="name" className="h-11" {...register('name')} />
        </Field>

        <Field label={t('email')} error={errors.email && t(`validation.${errors.email.message}`)}>
          <Input type="email" autoComplete="email" className="h-11" {...register('email')} />
        </Field>

        <Field
          label={t('password')}
          hint={t('passwordHint')}
          error={errors.password && t(`validation.${errors.password.message}`)}
        >
          <PasswordInput autoComplete="new-password" {...register('password')} />
        </Field>

        <Field label={t('phone')}>
          <Input type="tel" autoComplete="tel" className="h-11" {...register('phone')} />
        </Field>

        {/* L0-A: acceptarea termenilor e obligatorie (zod literal(true) + server) */}
        <Field error={errors.termsAccepted && t(`validation.${errors.termsAccepted.message}`)}>
          <label className="flex cursor-pointer items-start gap-2.5 text-ui text-ink-2">
            <input
              type="checkbox"
              className="mt-0.5 size-[18px] shrink-0 accent-walnut"
              {...register('termsAccepted')}
            />
            <span>
              {t.rich(role === 'COMPANY_USER' ? 'termsLabelCompany' : 'termsLabel', {
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
                rules: firmRulesChunk(undefined, true),
              })}
            </span>
          </label>
        </Field>

        {apiErr && (
          <Alert tone="crimson">{t.has(apiErr.key) ? t(apiErr.key) : apiErr.fallback}</Alert>
        )}

        <Button
          type="submit"
          variant="walnut"
          size="xl"
          disabled={registerMutation.isPending}
          className="w-full text-lead"
        >
          {t('registerSubmit')}
        </Button>
      </form>

      <p className={authFooterCls}>
        {t('haveAccount')}{' '}
        <Link href={loginHref} className={authLinkCls}>
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
