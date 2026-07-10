import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['ro', 'en'],
  defaultLocale: 'ro',
  // Fara detectie de limba din Accept-Language/cookie (feedback PO item 14):
  // linkul de Railway se deschide MEREU in romana; engleza ramane accesibila
  // explicit din comutatorul RO/EN (rutele /en/...).
  localeDetection: false,
});

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
