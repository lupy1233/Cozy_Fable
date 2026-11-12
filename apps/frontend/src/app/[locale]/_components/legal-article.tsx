'use client';

import { useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION } from '@marketplace/shared';
import { Card } from '@/components/ui/card';
import { isPublishedOperator, useLegalOperator } from '@/hooks/use-legal';
import { LEGAL_SUMMARY_ID, LegalBody, LegalLayout, type LegalTocItem } from './legal-layout';

// C1: randarea comuna a paginilor legale — titlu + sectiuni cu heading si
// paragrafe (textul vine integral din i18n; \n\n desparte paragrafele).
// E-admin-platform-2: identitatea operatorului vine din Admin → Setari (seller_* +
// legal_contact_email), afisata doar dupa legal_identity_published; pana atunci
// text neutru "in curs de publicare" (niciodata datele demo din seed).
// Design 2026-11: cuprins in stanga, cardul „Pe scurt” (Legal.<pagina>.summary, in afara textului
// versionat) si sectiunile numerotate; `children` = ce urmeaza dupa sectiuni (ex. cardul pentru firme).
export function LegalArticle({
  page,
  sections,
  summary,
  children,
}: {
  page: 'terms' | 'privacy';
  sections: readonly string[];
  summary: readonly string[];
  children?: ReactNode;
}) {
  const t = useTranslations(`Legal.${page}`);
  const tl = useTranslations('Legal');
  const { data } = useLegalOperator();
  const summaryTitleId = useId();

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

  const toc: LegalTocItem[] = [
    { id: LEGAL_SUMMARY_ID, label: tl('summary.title') },
    ...sections.map((key) => ({ id: key, label: t(`sections.${key}.h`) })),
  ];

  return (
    <LegalLayout
      toc={toc}
      header={
        <>
          <h1 className="page-title">{t('title')}</h1>
          <p className="label">
            {tl('lastUpdated')} · {tl('versionLabel', { version })}
          </p>
        </>
      }
    >
      <Card
        as="section"
        id={LEGAL_SUMMARY_ID}
        padding="lg"
        aria-labelledby={summaryTitleId}
        className="flex scroll-mt-24 flex-col gap-3.5"
      >
        <h2 id={summaryTitleId} className="heading-section">
          {tl('summary.title')}
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-lead leading-relaxed text-ink-2">
          {summary.map((key) => (
            <li key={key}>{t(`summary.${key}`)}</li>
          ))}
        </ul>
        <p className="text-ui text-muted-foreground">{tl('summary.note')}</p>
      </Card>

      {sections.map((key) => (
        <section key={key} id={key} className="flex scroll-mt-24 flex-col gap-2.5">
          <h2 className="font-serif text-2xl leading-tight">{t(`sections.${key}.h`)}</h2>
          <div className="flex flex-col gap-3">
            <LegalBody
              text={t(`sections.${key}.b`, { operator, contactEmail })}
              className="text-lead leading-relaxed text-muted-foreground"
            />
          </div>
        </section>
      ))}

      {children}
    </LegalLayout>
  );
}
