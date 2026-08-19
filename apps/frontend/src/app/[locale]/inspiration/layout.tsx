import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { pageMetadata } from '../_components/metadata';

// Galeria e client component ('use client' in page.tsx), deci titlul/SEO vin
// din acest layout de trecere (audit 2026-08-19 P1). Colectiile (boards/)
// isi suprascriu metadata in layout-ul lor.
export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return pageMetadata(locale, 'inspiration', '/inspiration');
}

export default function InspirationLayout({ children }: { children: ReactNode }) {
  return children;
}
