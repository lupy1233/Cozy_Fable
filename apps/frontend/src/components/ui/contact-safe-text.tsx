'use client';

import { Fragment } from 'react';
import { useTranslations } from 'next-intl';
import { CONTACT_MASK_TOKEN } from '@marketplace/shared';

// E-admin-platform-45: serverul inlocuieste datele de contact din textele libere cu
// CONTACT_MASK_TOKEN pentru firmele fara acces la contacte; aici tokenul devine o
// eticheta localizata ("contact ascuns"). Textul fara token se randeaza neschimbat.
export function ContactSafeText({ text }: { text: string | null | undefined }) {
  const t = useTranslations('ContactMask');
  if (!text) return null;
  if (!text.includes(CONTACT_MASK_TOKEN)) return <>{text}</>;
  const parts = text.split(CONTACT_MASK_TOKEN);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <span
              title={t('hiddenHint')}
              className="rounded bg-surface-3 px-1 text-[0.85em] text-muted-foreground"
            >
              {t('hidden')}
            </span>
          )}
        </Fragment>
      ))}
    </>
  );
}
