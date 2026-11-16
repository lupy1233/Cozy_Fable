'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { emailOnlySchema, type EmailOnlyInput } from '@marketplace/shared';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from '@/i18n/routing';
import { apiErrorKey } from '@/lib/error-messages';
import { useForgotPassword } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { AuthStateIcon, authFooterCls, authLinkCls, authTitleCls } from '../_components/auth-parts';

// L0-A: parola uitata — serverul raspunde uniform, deci mesajul de succes nu
// confirma existenta contului (anti-enumerare).
export default function ForgotPasswordPage() {
  const t = useTranslations('Auth');
  const forgot = useForgotPassword();
  // adresa catre care s-a trimis: tine ecranul „Verifica-ti emailul" si la retrimitere
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailOnlyInput>({ resolver: zodResolver(emailOnlySchema) });

  const onSubmit = handleSubmit((values) =>
    forgot.mutate(values.email, { onSuccess: () => setSentTo(values.email) }),
  );
  const apiErr = forgot.error ? apiErrorKey(forgot.error) : null;
  const backLink = (
    <p className={authFooterCls}>
      <Link href="/login" className={authLinkCls}>
        ← {t('backToLogin')}
      </Link>
    </p>
  );

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col gap-5">
        <AuthStateIcon icon={Check} tone="sage" />
        <h1 className={authTitleCls}>{t('forgotSentTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('forgotSuccess')}</p>
        <p className="text-ui text-muted-foreground">{t('forgotSuccessHint')}</p>
        {resent && !forgot.isPending && !apiErr && <Alert tone="sage">{t('forgotResent')}</Alert>}
        {apiErr && (
          <Alert tone="crimson">{t.has(apiErr.key) ? t(apiErr.key) : apiErr.fallback}</Alert>
        )}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11"
          disabled={forgot.isPending}
          onClick={() => forgot.mutate(sentTo, { onSuccess: () => setResent(true) })}
        >
          {t('forgotResend')}
        </Button>
        {backLink}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <h1 className={authTitleCls}>{t('forgotTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('forgotBody')}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field
          label={t('email')}
          error={errors.email && t(`validation.${errors.email.message}`)}
        >
          <Input type="email" autoComplete="email" className="h-11" {...register('email')} />
        </Field>

        {apiErr && (
          <Alert tone="crimson">{t.has(apiErr.key) ? t(apiErr.key) : apiErr.fallback}</Alert>
        )}

        <Button type="submit" variant="walnut" size="xl" disabled={forgot.isPending} className="w-full text-lead">
          {t('forgotSubmit')}
        </Button>
      </form>

      {backLink}
    </div>
  );
}
