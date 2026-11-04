import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { CSP_REPORT_GROUP, CSP_REPORT_PATH, cspFromEnv } from './lib/csp';

const intl = createMiddleware(routing);

const LOCALE_PATH = /^\/(ro|en)(\/|$)/;

// E-admin-platform-56: CSP cu nonce per cerere. Nonce-ul si politica merg pe headerele
// CERERII (Next le citeste la randare si pune nonce-ul pe scripturile proprii; layout-ul
// citeste x-nonce) si pe RASPUNS (browserul aplica politica). In dev nu exista CSP.
function withCsp(res: NextResponse, csp: string | null): NextResponse {
  if (!csp) return res;
  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('Reporting-Endpoints', `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`);
  return res;
}

// B3: alegerea EXPLICITA de limba (cookie-ul NEXT_LOCALE pus de comutatorul
// RO/EN) persista intre vizite: cine a ales EN ajunge din "/" direct pe /en.
// Detectia din Accept-Language ramane OPRITA (decizie PO item 14: linkul
// se deschide implicit in romana) — doar alegerea facuta de utilizator conteaza.
export default function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = cspFromEnv(nonce);

  const { pathname } = req.nextUrl;
  if (pathname === '/') {
    const saved = req.cookies.get('NEXT_LOCALE')?.value;
    if (saved === 'en') {
      const url = req.nextUrl.clone();
      url.pathname = '/en';
      return withCsp(NextResponse.redirect(url), csp);
    }
  }

  const headers = new Headers(req.headers);
  if (csp) {
    headers.set('x-nonce', nonce);
    headers.set('content-security-policy', csp);
  }
  // next-intl trimite mai departe `new Headers(request.headers)` (next/rewrite), deci
  // headerele puse aici ajung la randare.
  const forwarded = new NextRequest(req, { headers });

  // Rutele de limba trec prin next-intl; restul (ex. /xyz → 404-ul radacina) merg mai
  // departe neschimbate, fara redirect de limba (ca inainte de CSP).
  const res =
    pathname === '/' || LOCALE_PATH.test(pathname)
      ? intl(forwarded)
      : NextResponse.next({ request: { headers } });
  return withCsp(res, csp);
}

export const config = {
  // tot in afara de API, asset-uri, socket.io, tunelul de monitorizare, colectorul CSP si fisiere cu extensie
  matcher: ['/((?!api|_next|socket\\.io|monitoring|csp-report|.*\\..*).*)'],
};
