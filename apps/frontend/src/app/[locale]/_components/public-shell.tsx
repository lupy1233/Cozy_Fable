import type { ReactNode } from 'react';
import { PublicHeader } from './public-header';
import { SiteFooter } from './site-footer';

// Shell pentru paginile publice (parteneri, inspiratie, ghid schita, legale):
// headerul comun auth-aware + continutul paginii + footerul minimal (C2).
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 animate-pageIn px-4 py-8 sm:px-6">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
