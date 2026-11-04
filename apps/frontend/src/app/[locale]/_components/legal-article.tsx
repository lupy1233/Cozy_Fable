'use client';

import { useTranslations } from 'next-intl';
import { LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION } from '@marketplace/shared';
import { isPublishedOperator, useLegalOperator } from '@/hooks/use-legal';

// C1: randarea comuna a paginilor legale — titlu + sectiuni cu heading si
// paragrafe (textul vine integral din i18n; \n\n desparte paragrafele).
// E-admin-platform-2: identitatea operatorului vine din Admin → Setari (seller_* +
// legal_contact_email), afisata doar dupa legal_identity_published; pana atunci
// text neutru "in curs de publicare" (niciodata datele demo din seed).
export function LegalArticle({
  page,
  sections,
}: {
  page: 'terms' | 'privacy';
  sections: readonly string[];
}) {
  const t = useTranslations(`Legal.${page}`);
  const tl = useTranslations('Legal');
  const { data } = useLegalOperator();

  const operator = isPublishedOperator(data)
    ? tl('operator.identity', {
        name: data.name,
        cui: data.cui,
        regCom: data.regCom,
        address: data.address,
      })
    : tl('operator.pending');
  const contactEmail = isPublishedOperator(data) ? data.contactEmail : tl('operator.contactPending');
  const version = page === 'terms' ? LEGAL_TERMS_VERSION : LEGAL_PRIVACY_VERSION;

  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="page-title">{t('title')}</h1>
      <p className="label mt-3">
        {tl('lastUpdated')} · {tl('versionLabel', { version })}
      </p>
      <div className="mt-8 flex flex-col gap-8">
        {sections.map((key) => (
          <section key={key}>
            <h2 className="font-serif text-xl">{t(`sections.${key}.h`)}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {t(`sections.${key}.b`, { operator, contactEmail })}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
}
