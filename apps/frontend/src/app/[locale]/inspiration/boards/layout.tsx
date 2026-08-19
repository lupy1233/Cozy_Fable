import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { pageMetadata } from '../../_components/metadata';

// Colectiile sunt personale (cer login) → titlu propriu, dar noindex; acelasi
// titlu si pentru /boards/[id] (numele colectiei vine din API, client-side).
export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return pageMetadata(locale, 'boards', '/inspiration/boards', { noIndex: true });
}

export default function BoardsLayout({ children }: { children: ReactNode }) {
  return children;
}
