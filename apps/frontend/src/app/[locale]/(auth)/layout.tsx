import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { CozyHomeLogo } from '@/components/brand/logo';

// Shell auth — card centrat cu brand, pe caroiajul de plansa (din tokenuri).
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-pageIn">
        <Link href="/" className="mb-6 flex justify-center">
          <CozyHomeLogo size="lg" />
        </Link>
        <div className="rounded-xl border border-border bg-surface p-7 shadow-lg">{children}</div>
      </div>
    </main>
  );
}
