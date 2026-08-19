import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { PUBLIC_PATHS, SITE_URL, localizedPath } from './[locale]/_components/metadata';

// sitemap.xml (audit 2026-08-19 P1): paginile publice x fiecare limba, cu
// alternates hreflang intre ele. Continutul dinamic (colectii, cereri) nu e
// indexabil — ramane in afara.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PATHS.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${SITE_URL}${localizedPath(locale, path)}`,
      lastModified,
      changeFrequency: path === '/' ? ('weekly' as const) : ('monthly' as const),
      priority: path === '/' ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${SITE_URL}${localizedPath(l, path)}`]),
        ),
      },
    })),
  );
}
