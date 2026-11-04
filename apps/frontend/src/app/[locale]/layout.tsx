import type { Metadata } from 'next';
import { DM_Sans, IBM_Plex_Mono, Marcellus } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Providers } from '@/lib/providers';
import { SESSION_HINT_COOKIE, parseSessionHint } from '@/lib/session-hint';
import { SessionHintProvider } from '@/lib/session-hint-context';
import { LegalAcceptanceGate } from './_components/legal-acceptance-gate';
import { SITE_NAME, SITE_URL, ogLocale } from './_components/metadata';
import '../globals.css';

// Fonturi "ATELIER": DM Sans (body cald), Marcellus (display —
// capitale romane, ton de galerie; o singura greutate 400),
// IBM Plex Mono (date: ID-uri, sume, statusuri).
const sans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
});
const serif = Marcellus({
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  variable: '--font-serif',
  display: 'swap',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

// Metadata implicita, per limba (audit 2026-08-19 P1): titlul/descrierea din
// i18n (Meta.*), sablon "%s · Cozy Home" pentru paginile care isi pun titlul,
// metadataBase din NEXT_PUBLIC_SITE_URL (URL-urile relative din OG/alternates
// devin absolute). Paginile publice adauga canonical + hreflang + OG propriu
// prin pageMetadata() — aici nu punem canonical, ca sa nu se mosteneasca
// gresit pe rutele de cont.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Meta' });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t('defaultTitle'), template: t('titleTemplate') },
    description: t('description'),
    applicationName: SITE_NAME,
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: ogLocale(locale),
      title: t('defaultTitle'),
      description: t('description'),
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'ro' | 'en')) {
    notFound();
  }
  const messages = await getMessages();
  // E-admin-platform-56: citirea headerelor forteaza randarea dinamica, de care are nevoie
  // CSP-ul cu nonce (middleware.ts). Nu avem <Script> propriu; unul nou primeste
  // nonce={(await headers()).get('x-nonce') ?? undefined}.
  await headers();
  // indiciu de rol (cookie mm_session) pentru headerul randat pe server; doar UI, nu authz
  const hint = parseSessionHint((await cookies()).get(SESSION_HINT_COOKIE)?.value);

  return (
    <html lang={locale} className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <SessionHintProvider initialRole={hint}>
              {children}
              <LegalAcceptanceGate />
            </SessionHintProvider>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
