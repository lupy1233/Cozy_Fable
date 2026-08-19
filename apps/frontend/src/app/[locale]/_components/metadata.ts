import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';

// SEO pentru paginile publice (audit 2026-08-19, P1): titlu/descriere per
// pagina si per limba din namespace-ul i18n `Meta`, canonical + hreflang
// ro/en, Open Graph complet (Next NU face deep-merge pe `openGraph` intre
// layout si pagina, deci fiecare pagina il declara integral).

// Originea publica a site-ului (fara slash final). Fara variabila → localhost,
// ca linkurile absolute din sitemap/OG sa fie macar valide in dev.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

export const SITE_NAME = 'Cozy Home';

// Paginile publice indexabile — sursa unica pentru sitemap si hreflang.
// (/studio e public, dar metadata lui e in afara acestui sprint.)
export const PUBLIC_PATHS = [
  '/',
  '/partners',
  '/sketch-guide',
  '/inspiration',
  '/studio',
  '/terms',
  '/privacy',
] as const;

export type PublicPath = (typeof PUBLIC_PATHS)[number];

// Cheia din Meta.pages.* pentru fiecare pagina publica care isi seteaza titlul.
export type MetaPage = 'home' | 'partners' | 'sketchGuide' | 'inspiration' | 'boards' | 'terms' | 'privacy';

export function localizedPath(locale: string, path: string): string {
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

// canonical = varianta in limba curenta; hreflang pentru fiecare limba +
// x-default pe romana (limba implicita a platformei, decizie PO item 14)
export function localeAlternates(locale: string, path: string): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = localizedPath(l, path);
  languages['x-default'] = localizedPath(routing.defaultLocale, path);
  return { canonical: localizedPath(locale, path), languages };
}

export function ogLocale(locale: string): string {
  return locale === 'en' ? 'en_US' : 'ro_RO';
}

// Metadata completa pentru o pagina publica. `absoluteTitle` = fara sablonul
// "%s · Cozy Home" (landing-ul are titlul complet al site-ului). Titlul se
// compune aici si se da ca `absolute`: sablonul din layout-ul radacina NU se
// propaga prin layout-urile intermediare care isi pun titlu (ex.
// inspiration → boards ar ramane fara sufix).
export async function pageMetadata(
  locale: string,
  page: MetaPage,
  path: string,
  opts: { absoluteTitle?: boolean; noIndex?: boolean } = {},
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Meta' });
  const pageTitle = t(`pages.${page}.title`);
  const title = opts.absoluteTitle ? pageTitle : t('titleTemplate').replace('%s', pageTitle);
  const description = t(`pages.${page}.description`);
  return {
    title: { absolute: title },
    description,
    alternates: localeAlternates(locale, path),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: ogLocale(locale),
      url: localizedPath(locale, path),
      title: pageTitle,
      description,
    },
    ...(opts.noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
