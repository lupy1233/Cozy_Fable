import type { Metadata } from 'next';
import { LegalArticle } from '../_components/legal-article';
import { PRIVACY_SECTIONS } from '../_components/legal-sections';
import { pageMetadata } from '../_components/metadata';
import { PublicShell } from '../_components/public-shell';

// C1: Politica de Confidentialitate — continut integral din i18n (RO+EN).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, 'privacy', '/privacy');
}

export default function PrivacyPage() {
  return (
    <PublicShell>
      <LegalArticle page="privacy" sections={PRIVACY_SECTIONS} />
    </PublicShell>
  );
}
