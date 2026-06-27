import type { ReactNode } from 'react';
import { AppHeader } from './app-header';

// AppShell — header + container standard pentru zonele client/firma.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl animate-pageIn px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
