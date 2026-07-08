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
  // In prod API-ul e proxied same-origin (cookies SameSite=Lax raman valide,
  // fara CORS cross-site). BACKEND_INTERNAL_URL e setat doar la deploy;
  // in dev local frontendul vorbeste direct cu :3001 si rewrites raman goale.
  async rewrites() {
    const backend = process.env.BACKEND_INTERNAL_URL;
    if (!backend) return [];
    return [
      { source: '/api/v1/:path*', destination: `${backend}/api/v1/:path*` },
      { source: '/socket.io/:path*', destination: `${backend}/socket.io/:path*` },
    ];
  },
};

export default withNextIntl(nextConfig);
