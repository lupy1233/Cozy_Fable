import type { ReactNode } from 'react';
import { PublicHeader } from './public-header';

// Shell pentru paginile publice (parteneri, inspiratie, ghid schita):
// headerul comun auth-aware + continutul paginii. Landing-ul foloseste
// PublicHeader direct (are main/footer propriu).
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-6xl animate-pageIn px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
