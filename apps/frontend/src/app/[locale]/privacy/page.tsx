import type { Metadata } from 'next';
import { LegalArticle } from '../_components/legal-article';
import { pageMetadata } from '../_components/metadata';
import { PublicShell } from '../_components/public-shell';

// C1: Politica de Confidentialitate — continut integral din i18n (RO+EN).
const SECTIONS = [
  'intro',
  'data',
  'usage',
  'marketing',
  'sharing',
  'rights',
  'retention',
  'cookies',
  'contact',
] as const;

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return pageMetadata(locale, 'privacy', '/privacy');
}

export default function PrivacyPage() {
  return (
    <PublicShell>
      <LegalArticle page="privacy" sections={SECTIONS} />
    </PublicShell>
  );
}
