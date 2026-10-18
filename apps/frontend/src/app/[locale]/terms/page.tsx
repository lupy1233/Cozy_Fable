import type { Metadata } from 'next';
import { FirmRulesCta } from '../_components/firm-rules-cta';
import { LegalArticle } from '../_components/legal-article';
import { TERMS_SECTIONS } from '../_components/legal-sections';
import { pageMetadata } from '../_components/metadata';
import { PublicShell } from '../_components/public-shell';

// C1: Termeni si Conditii — continut integral din i18n (RO+EN).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, 'terms', '/terms');
}

export default function TermsPage() {
  return (
    <PublicShell>
      <LegalArticle page="terms" sections={TERMS_SECTIONS} />
      <FirmRulesCta />
    </PublicShell>
  );
}
