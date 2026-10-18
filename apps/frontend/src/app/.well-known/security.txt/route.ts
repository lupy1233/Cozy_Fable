import { buildSecurityTxt } from '@/lib/security-txt';
import { SUPPORT_EMAIL } from '@/lib/support-email';

// Generat la build (NEXT_PUBLIC_* sunt coapte); fiecare release reimprospateaza Expires.
export const dynamic = 'force-static';

// Copie a SITE_URL din app/[locale]/_components/metadata (acela importa next-intl/server).
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000').replace(/\/$/, '');

export function GET() {
  const body = buildSecurityTxt({ siteUrl: SITE_URL, contact: SUPPORT_EMAIL, now: new Date() });
  if (!body) return new Response('Not found', { status: 404 });
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
