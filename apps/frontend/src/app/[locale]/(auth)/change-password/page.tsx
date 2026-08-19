'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, type ChangePasswordInput } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useRouter } from '@/i18n/routing';
import { apiErrorKey } from '@/lib/error-messages';
import { useChangePassword, useMe } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl">{t('changePasswordTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('changePasswordBody')}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field
          label={t('currentPassword')}
          error={errors.currentPassword && t(`validation.${errors.currentPassword.message}`)}
        >
          <Input
            type="password"
            autoComplete="current-password"
            {...register('currentPassword')}
          />
        </Field>

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
        {change.isSuccess && <Alert tone="sage">{t('changePasswordSuccess')}</Alert>}

        <Button type="submit" disabled={change.isPending} className="w-full">
          {t('changePasswordSubmit')}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        <Link href="/dashboard" className="text-walnut underline">
          {t('backToDashboard')}
        </Link>
      </p>
    </div>
  );
}
