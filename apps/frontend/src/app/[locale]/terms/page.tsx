import type { Metadata } from 'next';
import { LegalArticle } from '../_components/legal-article';
import { pageMetadata } from '../_components/metadata';
import { PublicShell } from '../_components/public-shell';

// C1: Termeni si Conditii — continut integral din i18n (RO+EN).
const SECTIONS = [
  'intro',
  'accounts',
  'flow',
  'credits',
  'liability',
  'ip',
  'changes',
  'law',
] as const;

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return pageMetadata(locale, 'terms', '/terms');
}

export default function TermsPage() {
  return (
    <PublicShell>
      <LegalArticle page="terms" sections={SECTIONS} />
    </PublicShell>
  );
}
