'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, type ResetPasswordInput } from '@marketplace/shared';
import { Check, CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from '@/i18n/routing';
import { apiErrorKey } from '@/lib/error-messages';
import { useResetPassword } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { AuthStateIcon, authFooterCls, authLinkCls, authTitleCls } from '../_components/auth-parts';
import { PasswordInput } from '../_components/password-input';

// L0-A: parola noua pe baza tokenului din link (one-time, 60 min).
function ResetPasswordInner() {
  const t = useTranslations('Auth');
  const params = useSearchParams();
  // Tokenul se citeste O DATA si se scoate din URL (istoric/referer) — altfel ar
  // ajunge in logurile backend prin header-ul Referer la apelurile API (security close L0).
  const [token] = useState(() => params.get('token') ?? '');
  useEffect(() => {
    if (params.get('token')) window.history.replaceState(null, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const reset = useResetPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  const onSubmit = handleSubmit((values) =>
    reset.mutate({ token: values.token, password: values.newPassword }),
  );

  const apiErr = reset.error ? apiErrorKey(reset.error) : null;
  // link incomplet sau token respins de server → trimitem la "parola uitata"
  const tokenInvalid = token.length !== 64 || apiErr?.key === 'apiErrors.RESET_TOKEN_INVALID';
  const backLink = (
    <p className={authFooterCls}>
      <Link href="/login" className={authLinkCls}>
        ← {t('backToLogin')}
      </Link>
    </p>
  );

  if (reset.isSuccess) {
    return (
      <div role="status" className="flex flex-col gap-5">
        <AuthStateIcon icon={Check} tone="sage" />
        <h1 className={authTitleCls}>{t('resetDoneTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('resetDoneBody')}</p>
        <Button asChild variant="walnut" size="xl" className="w-full text-lead">
          <Link href="/login">{t('goToLogin')}</Link>
        </Button>
      </div>
    );
  }

  if (tokenInvalid) {
    return (
      <div role="alert" className="flex flex-col gap-5">
        <AuthStateIcon icon={CircleAlert} tone="crimson" />
        <h1 className={authTitleCls}>{t('linkInvalidTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('resetTokenInvalid')}</p>
        <Button asChild variant="walnut" size="xl" className="w-full text-lead">
          <Link href="/forgot-password">{t('resetRequestNewLink')}</Link>
        </Button>
        {backLink}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <h1 className={authTitleCls}>{t('resetTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('resetBody')}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <input type="hidden" {...register('token')} />

        <Field
          label={t('newPassword')}
          hint={t('passwordHint')}
          error={errors.newPassword && t(`validation.${errors.newPassword.message}`)}
        >
          <PasswordInput autoComplete="new-password" {...register('newPassword')} />
        </Field>

        <Field
          label={t('confirmPassword')}
          error={errors.confirmPassword && t(`validation.${errors.confirmPassword.message}`)}
        >
          <PasswordInput autoComplete="new-password" {...register('confirmPassword')} />
        </Field>

        {apiErr && (
          <Alert tone="crimson">{t.has(apiErr.key) ? t(apiErr.key) : apiErr.fallback}</Alert>
        )}

        <Button type="submit" variant="walnut" size="xl" disabled={reset.isPending} className="w-full text-lead">
          {t('resetSubmit')}
        </Button>
      </form>

      {backLink}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  );
}
