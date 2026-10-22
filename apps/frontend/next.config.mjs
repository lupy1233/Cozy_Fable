import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@marketplace/shared'],
  // Build self-contained pentru Docker (server.js + node_modules trasate)
  output: 'standalone',
  // monorepo pnpm: traseaza dependentele de la radacina workspace-ului
  // (Next 15: mutat din experimental la nivelul radacina)
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Fara asta, Next face 308 de la /socket.io/ la /socket.io INAINTE de rewrites, iar
  // engine.io serveste doar pe calea cu slash → 404. Pe polling s-ar pierde doar un
  // round-trip, dar handshake-ul WebSocket nu urmeaza redirecturi, deci realtime-ul moare.
  skipTrailingSlashRedirect: true,
  // fara antetul X-Powered-By: Next (audit 2026-08-19)
  poweredByHeader: false,
  // Antete de securitate de baza pe toate raspunsurile (audit 2026-08-19 P2).
  // E-admin-platform-56: CSP-ul NU mai e aici — se construieste per cerere in middleware.ts
  // (lib/csp.ts, nonce + 'strict-dynamic', raportare la /csp-report). Aici raman, doar in
  // productie: HSTS, Cross-Origin-Opener-Policy same-origin (nu folosim window.open/opener)
  // si X-Robots-Tag noindex pe orice host diferit de NEXT_PUBLIC_SITE_URL. Gateway-ul Caddy
  // trimite Host-ul public mai departe, deci doar URL-urile directe ale sloturilor primesc noindex.
  // Un NEXT_PUBLIC_SITE_URL gresit la build ar scoate productia din index → verificare in docs/08.
  async headers() {
    const production = process.env.NODE_ENV === 'production';
    const siteHost = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').hostname;
    const prodOnly = production
      ? [
          { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ]
      : [];
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...prodOnly,
        ],
      },
      ...(production
        ? [
            {
              source: '/:path*',
              // valoarea `host` e regex (Next o ancoreaza ^…$) → punctele se escapeaza
              missing: [{ type: 'host', value: `${siteHost.replace(/\./g, '\\.')}` }],
              headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
            },
          ]
        : []),
    ];
  },
  // /landing-v2 a fost doar un redirect in cod (PO 2026-08-01: continutul e pe
  // radacina); acum e redirect permanent la nivel de server, cu si fara prefix
  // de limba, iar ruta a fost stearsa din app/.
  async redirects() {
    return [
      { source: '/landing-v2', destination: '/', permanent: true },
      { source: '/:locale(ro|en)/landing-v2', destination: '/:locale', permanent: true },
    ];
  },
  // In prod API-ul e proxied same-origin (cookies SameSite=Lax raman valide,
  // fara CORS cross-site). BACKEND_INTERNAL_URL e setat doar la deploy;
  // in dev local frontendul vorbeste direct cu :3001 si rewrites raman goale.
  async rewrites() {
    const backend = process.env.BACKEND_INTERNAL_URL;
    if (!backend) return [];
    return [
      { source: '/api/v1/:path*', destination: `${backend}/api/v1/:path*` },
      // engine.io cere mereu /socket.io/ (cu slash) + query. Regula wildcard cu :path*
      // ar potrivi si cazul gol, dar la interpolare pierde slash-ul → /socket.io → 404.
      // Deci calea de baza are regula proprie, iar wildcardul cere macar un segment.
      { source: '/socket.io/', destination: `${backend}/socket.io/` },
      { source: '/socket.io/:path+', destination: `${backend}/socket.io/:path+` },
    ];
  },
};

export default withNextIntl(nextConfig);
