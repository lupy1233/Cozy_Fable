'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, type ResetPasswordInput } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from '@/i18n/routing';
import { apiErrorKey } from '@/lib/error-messages';
import { useResetPassword } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';

// L0-A: parola noua pe baza tokenului din link (one-time, 60 min).
function ResetPasswordInner() {
  const t = useTranslations('Auth');
  const params = useSearchParams();
  const token = params.get('token') ?? '';
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

  if (reset.isSuccess) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-serif text-2xl">{t('resetTitle')}</h1>
        <Alert tone="sage">{t('resetSuccess')}</Alert>
        <Link href="/login" className="text-walnut underline">
          {t('goToLogin')}
        </Link>
      </div>
    );
  }

  if (tokenInvalid) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-serif text-2xl">{t('resetTitle')}</h1>
        <Alert tone="crimson">{t('resetTokenInvalid')}</Alert>
        <Link href="/forgot-password" className="text-walnut underline">
          {t('resetRequestNewLink')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl">{t('resetTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('resetBody')}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <input type="hidden" {...register('token')} />

        <Field
          label={t('newPassword')}
          error={errors.newPassword && t(`validation.${errors.newPassword.message}`)}
        >
          <Input type="password" autoComplete="new-password" {...register('newPassword')} />
        </Field>

        <Field
          label={t('confirmPassword')}
          error={errors.confirmPassword && t(`validation.${errors.confirmPassword.message}`)}
        >
          <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
        </Field>

        {apiErr && (
          <Alert tone="crimson">{t.has(apiErr.key) ? t(apiErr.key) : apiErr.fallback}</Alert>
        )}

        <Button type="submit" disabled={reset.isPending} className="w-full">
          {t('resetSubmit')}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        <Link href="/login" className="text-walnut underline">
          {t('backToLogin')}
        </Link>
      </p>
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
