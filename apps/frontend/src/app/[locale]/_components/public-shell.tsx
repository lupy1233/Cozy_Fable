import type { ReactNode } from 'react';
import { PublicHeader } from './public-header';
import { SiteFooter } from './site-footer';
import { StudioHeader } from './studio-header';

// Shell pentru paginile publice (parteneri, inspiratie, ghid schita, legale):
// headerul comun auth-aware + continutul paginii + footerul (C2).
// Studio 3D (design 2026-11): clientul logat pastreaza antetul contului, ca Studioul
// sa nu para o iesire din cont; vizitatorii vad antetul public.
export function PublicShell({ children, studio = false }: { children: ReactNode; studio?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      {studio ? <StudioHeader /> : <PublicHeader />}
      <main className={studio ? 'mx-auto w-full flex-1 px-2 py-3 sm:px-4' : 'mx-auto w-full max-w-6xl flex-1 animate-pageIn px-4 py-8 sm:px-6'}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
