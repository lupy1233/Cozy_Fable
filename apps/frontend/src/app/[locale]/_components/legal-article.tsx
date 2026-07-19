import { useTranslations } from 'next-intl';

// C1: randarea comuna a paginilor legale — titlu + sectiuni cu heading si
// paragrafe (textul vine integral din i18n; \n\n desparte paragrafele).
export function LegalArticle({
  page,
  sections,
}: {
  page: 'terms' | 'privacy';
  sections: readonly string[];
}) {
  const t = useTranslations(`Legal.${page}`);
  const tl = useTranslations('Legal');

  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="page-title">{t('title')}</h1>
      <p className="label mt-3">{tl('lastUpdated')}</p>
      <div className="mt-8 flex flex-col gap-8">
        {sections.map((key) => (
          <section key={key}>
            <h2 className="font-serif text-xl">{t(`sections.${key}.h`)}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {t(`sections.${key}.b`)}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
}
