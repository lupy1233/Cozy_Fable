'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Link, useRouter } from '@/i18n/routing';
import { apiErrorKey } from '@/lib/error-messages';
import { useLogin } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';

export default function LoginPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, { onSuccess: () => router.push('/dashboard') }),
  );

  const apiErr = login.error ? apiErrorKey(login.error) : null;

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

        {apiErr && (
          <Alert tone="crimson">{t.has(apiErr.key) ? t(apiErr.key) : apiErr.fallback}</Alert>
        )}

        <Button type="submit" disabled={login.isPending} className="w-full">
          {t('loginSubmit')}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link href="/register" className="text-walnut underline">
          {t('registerLink')}
        </Link>
      </p>
    </div>
  );
}
