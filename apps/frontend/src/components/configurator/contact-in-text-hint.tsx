'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { detectContactInfo } from '@marketplace/shared';

// E-admin-platform-45: nota non-blocanta cand clientul scrie un telefon, email, link
// sau cont social intr-un text liber. Acelasi detector ca serverul; mentiunile simple
// de aplicatii ("prefer WhatsApp") nu declanseaza nota.
export function ContactInTextHint({ value }: { value: string | null | undefined }) {
  const t = useTranslations('Configurator');
  const hasContact = useMemo(
    () => (value ? detectContactInfo(value).some((m) => m.kind !== 'MESSENGER') : false),
    [value],
  );
  if (!hasContact) return null;
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber" role="status" data-contact-hint>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{t('contactInText.hint')}</span>
    </p>
  );
}
