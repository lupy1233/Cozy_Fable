'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { emailOnlySchema, type EmailOnlyInput } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Link } from '@/i18n/routing';
import { apiErrorKey } from '@/lib/error-messages';
import { useForgotPassword } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';

// L0-A: parola uitata — serverul raspunde uniform, deci mesajul de succes nu
// confirma existenta contului (anti-enumerare).
export default function ForgotPasswordPage() {
  const t = useTranslations('Auth');
  const forgot = useForgotPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailOnlyInput>({ resolver: zodResolver(emailOnlySchema) });

  const onSubmit = handleSubmit((values) => forgot.mutate(values.email));
  const apiErr = forgot.error ? apiErrorKey(forgot.error) : null;

  if (forgot.isSuccess) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-serif text-2xl">{t('forgotTitle')}</h1>
        <Alert tone="sage">{t('forgotSuccess')}</Alert>
        <p className="text-xs text-muted-foreground">{t('forgotSuccessHint')}</p>
        <Link href="/login" className="text-walnut underline">
          {t('backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl">{t('forgotTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('forgotBody')}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field
          label={t('email')}
          error={errors.email && t(`validation.${errors.email.message}`)}
        >
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>

        {apiErr && (
          <Alert tone="crimson">{t.has(apiErr.key) ? t(apiErr.key) : apiErr.fallback}</Alert>
        )}

        <Button type="submit" disabled={forgot.isPending} className="w-full">
          {t('forgotSubmit')}
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
