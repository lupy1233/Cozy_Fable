import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { pageMetadata } from '../_components/metadata';

// Pagina e client component ('use client' in page.tsx), deci titlul/SEO vin
// din acest layout de trecere (audit 2026-08-19 P1).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, 'sketchGuide', '/sketch-guide');
}

export default function SketchGuideLayout({ children }: { children: ReactNode }) {
  return children;
}
