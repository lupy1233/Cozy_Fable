'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiErrorKey } from '@/lib/error-messages';
import { useResendVerification } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';

// L0-A: retrimiterea emailului de confirmare. Cu `email` fixat (login/register)
// afiseaza doar butonul; fara email (verify-email cu link expirat) cere adresa.
// Serverul raspunde uniform → mesajul de succes nu confirma existenta contului.
export function ResendVerification({
  email,
  prompt,
  className,
}: {
  email?: string;
  prompt?: string;
  className?: string;
}) {
  const t = useTranslations('Auth');
  const resend = useResendVerification();
  const [typed, setTyped] = useState('');
  const target = (email ?? typed).trim();
  const apiErr = resend.error ? apiErrorKey(resend.error) : null;

  if (resend.isSuccess) {
    return (
      <Alert tone="sage" className={className}>
        {t('resendSuccess')}
      </Alert>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-3">
        {prompt && <p className="text-sm text-muted-foreground">{prompt}</p>}
        {email === undefined && (
          <Field label={t('email')}>
            <Input
              type="email"
              autoComplete="email"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </Field>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={resend.isPending || !target}
          onClick={() => resend.mutate(target)}
        >
          {resend.isPending ? t('resendPending') : t('resendButton')}
        </Button>
        {apiErr && (
          <Alert tone="crimson">{t.has(apiErr.key) ? t(apiErr.key) : apiErr.fallback}</Alert>
        )}
      </div>
    </div>
  );
}
