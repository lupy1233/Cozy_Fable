import { getRequestConfig } from 'next-intl/server';
import { APP_TIME_ZONE } from '../lib/app-time-zone';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as 'ro' | 'en')) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // g2 (revizuire m6): fusul implicit al oricarui format.dateTime = ora Romaniei, nu fusul
    // serverului / browserului; NextIntlClientProvider il preia si pe client
    timeZone: APP_TIME_ZONE,
  };
});
