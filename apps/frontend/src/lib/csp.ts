// E-admin-platform-56 (SEC2-8): Content-Security-Policy cu nonce per cerere, construita in
// middleware. Next 15 pune nonce-ul pe propriile scripturi doar la randare dinamica si doar cand
// CSP-ul (cu nonce) e pe headerele cererii trimise mai departe. 'strict-dynamic' lasa scripturile
// incarcate de un script de incredere (Google Maps injectat cu createElement) sa ruleze.
// ORICE script/host extern nou (analytics, CDN, embed, Stripe.js) se adauga AICI, altfel e
// blocat DOAR in productie (in dev nu exista CSP).

export type CspOptions = {
  nonce: string;
  // originile storage-ului (presigned GET/PUT); goale = img/connect raman largi (https:)
  storageOrigins?: string[];
  extraImgOrigins?: string[];
  analyticsOrigin?: string | null;
  dev?: boolean;
};

export const CSP_REPORT_PATH = '/csp-report';
export const CSP_REPORT_GROUP = 'csp';

const MAPS_SCRIPT = 'https://maps.googleapis.com';
const MAPS_IMG = [
  'https://maps.googleapis.com',
  'https://maps.gstatic.com',
  'https://*.googleapis.com',
  'https://*.gstatic.com',
];
// CDN-ul Webflow al partenerului (caietul de idei de pe landing, lib/inspiration.ts)
const INSPIRATION_CDN = 'https://cdn.prod.website-files.com';
const MAPS_CONNECT = ['https://maps.googleapis.com', 'https://places.googleapis.com'];

// Lista separata prin virgula → origini https normalizate (new URL().origin); invalidele cad.
export function parseOrigins(raw?: string | null): string[] {
  if (!raw) return [];
  const origins = new Set<string>();
  for (const part of raw.split(',')) {
    const value = part.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === 'https:') origins.add(url.origin);
    } catch {
      // intrare invalida → ignorata
    }
  }
  return [...origins];
}

// Hostul de analytics intra in connect-src doar daca e https valid (acelasi filtru ca lib/analytics.ts).
export function httpsOrigin(raw?: string | null): string | null {
  return parseOrigins(raw)[0] ?? null;
}

export function buildCsp({
  nonce,
  storageOrigins = [],
  extraImgOrigins = [],
  analyticsOrigin = null,
  dev = false,
}: CspOptions): string | null {
  if (dev) return null;
  const narrow = storageOrigins.length > 0;
  const unique = (list: string[]) => [...new Set(list)].join(' ');
  const img = narrow
    ? unique(["'self'", 'data:', 'blob:', ...storageOrigins, ...MAPS_IMG, INSPIRATION_CDN, ...extraImgOrigins])
    : "'self' data: blob: https:";
  const connect = narrow
    ? unique(["'self'", 'blob:', ...storageOrigins, ...MAPS_CONNECT, ...(analyticsOrigin ? [analyticsOrigin] : [])])
    : "'self' https: wss: blob:";
  return [
    "default-src 'self'",
    // hostul Maps e fallback pentru browserele CSP2; cu 'strict-dynamic' CSP3 il ignora
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${MAPS_SCRIPT}`,
    // styled-jsx (offer-builder) si stilurile inline Next cer 'unsafe-inline' pe stiluri
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src ${img}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connect}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_REPORT_GROUP}`,
  ].join('; ');
}

// Valorile coapte la build (NEXT_PUBLIC_*); NODE_ENV diferit de production = fara CSP (HMR are nevoie de eval).
export function cspFromEnv(nonce: string): string | null {
  return buildCsp({
    nonce,
    storageOrigins: parseOrigins(process.env.NEXT_PUBLIC_STORAGE_ORIGIN),
    extraImgOrigins: parseOrigins(process.env.NEXT_PUBLIC_CSP_IMG_ORIGINS),
    analyticsOrigin: httpsOrigin(process.env.NEXT_PUBLIC_ANALYTICS_HOST),
    dev: process.env.NODE_ENV !== 'production',
  });
}
