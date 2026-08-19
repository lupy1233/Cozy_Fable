import type { ReactNode } from 'react';

// Root layout DOAR de trecere: html/body le randeaza [locale]/layout.tsx.
// Exista pentru ca Next cere un layout radacina atunci cand avem
// app/not-found.tsx (404 pentru rute din afara segmentului de limba,
// ex. /xyz sau o limba necunoscuta) — pattern recomandat de next-intl.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
