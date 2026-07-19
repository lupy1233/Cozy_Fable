import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

// B3: alegerea EXPLICITA de limba (cookie-ul NEXT_LOCALE pus de comutatorul
// RO/EN) persista intre vizite: cine a ales EN ajunge din "/" direct pe /en.
// Detectia din Accept-Language ramane OPRITA (decizie PO item 14: linkul
// se deschide implicit in romana) — doar alegerea facuta de utilizator conteaza.
export default function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/') {
    const saved = req.cookies.get('NEXT_LOCALE')?.value;
    if (saved === 'en') {
      const url = req.nextUrl.clone();
      url.pathname = '/en';
      return NextResponse.redirect(url);
    }
  }
  return intl(req);
}

export const config = {
  matcher: ['/', '/(ro|en)/:path*'],
};
