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
  experimental: {
    // monorepo pnpm: traseaza dependentele de la radacina workspace-ului
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  // Fara asta, Next face 308 de la /socket.io/ la /socket.io INAINTE de rewrites, iar
  // engine.io serveste doar pe calea cu slash → 404. Pe polling s-ar pierde doar un
  // round-trip, dar handshake-ul WebSocket nu urmeaza redirecturi, deci realtime-ul moare.
  skipTrailingSlashRedirect: true,
  // fara antetul X-Powered-By: Next (audit 2026-08-19)
  poweredByHeader: false,
  // Antete de securitate de baza pe toate raspunsurile (audit 2026-08-19 P2).
  // Fara CSP deocamdata: Google Maps Places + CDN-ul de imagini al partenerilor
  // cer o politica atent enumerata — vine separat.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
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
