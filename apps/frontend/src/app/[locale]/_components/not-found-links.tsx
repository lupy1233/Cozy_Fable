'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useSessionRole } from '@/hooks/use-auth';

// Iesirile secundare din pagina 404 (canvas design 2026-11-12): pe langa "Inapoi acasa",
// patru drumuri spre ce cauta de obicei omul. Insula client, ca sa tina cont de sesiune la
// fel ca PublicHeader: "Cere oferte" doar pentru vizitatori si clienti, iar cine e deja
// autentificat primeste "Contul meu" in loc de "Autentificare".
export function NotFoundLinks() {
  const t = useTranslations('NotFound');
  const tn = useTranslations('Nav');
  const { role } = useSessionRole();

  const links = [
    ...(!role || role === 'CLIENT' ? [{ href: '/requests/new', label: tn('createRequest') }] : []),
    { href: '/inspiration', label: tn('inspiration') },
    { href: '/partners', label: t('partners') },
    role ? { href: '/dashboard', label: tn('dashboard') } : { href: '/login', label: tn('login') },
  ];

  return (
    <nav
      aria-label={t('moreLinks')}
      className="mt-4 flex w-full flex-wrap justify-center gap-x-7 gap-y-1 border-t border-border-2 pt-6"
    >
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="inline-flex min-h-11 items-center font-medium text-walnut underline underline-offset-4 hover:text-walnut-deep"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
