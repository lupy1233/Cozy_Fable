import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';

// Shell auth — card centrat cu brand, fundal cald (din tokenuri).
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-pageIn">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[9px] bg-gradient-to-br from-foreground to-ink-2 font-serif text-xl italic text-background shadow-sm">
            P
          </span>
          <span className="font-serif text-2xl leading-none tracking-[-0.02em]">Plan</span>
        </Link>
        <div className="rounded-2xl border border-border bg-surface p-7 shadow-lg">{children}</div>
      </div>
    </main>
  );
}
