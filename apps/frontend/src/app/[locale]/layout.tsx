import type { Metadata } from 'next';
import { DM_Sans, IBM_Plex_Mono, Marcellus } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Providers } from '@/lib/providers';
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

export const metadata: Metadata = {
  title: 'Cozy Home — Mobilier la comandă',
  description: 'Cozy Home: cere oferte de la ateliere verificate pentru mobilierul tău la comandă',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!routing.locales.includes(locale as 'ro' | 'en')) {
    notFound();
  }
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
