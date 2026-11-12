'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, type ChangePasswordInput } from '@marketplace/shared';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useRouter } from '@/i18n/routing';
import { apiErrorKey } from '@/lib/error-messages';
import { useChangePassword, useMe } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { AuthStateIcon, authFooterCls, authLinkCls, authTitleCls } from '../_components/auth-parts';
import { PasswordInput } from '../_components/password-input';

// L0-A: schimbare parola (doar autentificat). Serverul revoca celelalte sesiuni si
// re-emite cookie-urile pentru dispozitivul curent → userul ramane logat aici.
export default function ChangePasswordPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const me = useMe();
  const change = useChangePassword();

  useEffect(() => {
    if (me.isError) router.replace('/login?redirect=%2Fchange-password');
  }, [me.isError, router]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = handleSubmit((values) =>
    change.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      { onSuccess: () => reset() },
    ),
  );

  const apiErr = change.error ? apiErrorKey(change.error) : null;

  if (me.isPending || me.isError) {
    return <p className="text-center text-sm text-muted-foreground">{t('loading')}</p>;
  }

  if (change.isSuccess) {
    return (
      <div role="status" className="flex flex-col gap-5">
        <AuthStateIcon icon={Check} tone="sage" />
        <h1 className={authTitleCls}>{t('resetDoneTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('changePasswordDoneBody')}</p>
        <Button asChild variant="walnut" size="xl" className="w-full text-lead">
          <Link href="/dashboard">{t('backToDashboard')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <h1 className={authTitleCls}>{t('changePasswordTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('changePasswordBody')}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field
          label={t('currentPassword')}
          error={errors.currentPassword && t(`validation.${errors.currentPassword.message}`)}
        >
          <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
        </Field>

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

        <Button type="submit" variant="walnut" size="xl" disabled={change.isPending} className="w-full text-lead">
          {t('changePasswordSubmit')}
        </Button>
      </form>

      <p className={authFooterCls}>
        <Link href="/dashboard" className={authLinkCls}>
          ← {t('backToDashboard')}
        </Link>
      </p>
    </div>
  );
}
