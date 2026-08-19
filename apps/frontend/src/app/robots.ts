import type { MetadataRoute } from 'next';
import { SITE_URL } from './[locale]/_components/metadata';

// robots.txt (audit 2026-08-19 P1): paginile publice se indexeaza; zonele de
// cont, consola de admin, paginile de dev, dezabonarea (link semnat, one-shot)
// si API-ul proxied NU. Prefixele acopera ambele limbi (/ro/admin, /en/admin).
const PRIVATE_PREFIXES = [
  '/admin',
  '/dashboard',
  '/marketplace',
  '/requests',
  '/company',
  '/dev',
  '/unsubscribe',
  '/api',
];

export default function robots(): MetadataRoute.Robots {
  const disallow = PRIVATE_PREFIXES.flatMap((p) => [p, `/ro${p}`, `/en${p}`]);
  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
