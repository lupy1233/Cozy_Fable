import type { Metadata } from 'next';
import { FirmRulesArticle } from '../_components/firm-rules-article';
import { pageMetadata } from '../_components/metadata';
import { PublicShell } from '../_components/public-shell';

// E-company-9: Reguli pentru firme — valorile vin live din GET /legal/firm-rules, textul din i18n (RO+EN).
// Ruta e /firm-rules (nu /company-rules): robots.ts blocheaza prefixul /company.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, 'firmRules', '/firm-rules');
}

export default function FirmRulesPage() {
  return (
    <PublicShell>
      <FirmRulesArticle />
    </PublicShell>
  );
}
