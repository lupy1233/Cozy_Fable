'use client';

import type { QuoteVersionDto } from '@marketplace/shared';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { formatQuoteMoney, hasStructuredTerm } from '@/lib/quote-version';
import { useLongDate } from './use-long-date';

// a3 / a4 (etapa 4): textele unei variante de oferta, comune cardului ofertei, istoricului
// variantelor si dialogului de acceptare. Variantele vechi raman cu textul liber al firmei.

// data calendaristica (YYYY-MM-DD) la pranz UTC, ca sa nu sara o zi in fusul Romaniei
const toInstant = (iso: string) => (iso.length === 10 ? `${iso}T12:00:00Z` : iso);

// data in limba aplicatiei si ora Romaniei (lectia m10, etapa 1)
export function useQuoteDate() {
  const longDate = useLongDate();
  return (iso: string) => longDate(toInstant(iso));
}

// suma in moneda variantei, formatata dupa limba aplicatiei ("11.500,00 lei")
export function useQuoteMoney() {
  const locale = useLocale();
  return (n: number, currency: QuoteVersionDto['currency']) => formatQuoteMoney(n, currency, locale);
}

export function useVersionTerms() {
  const t = useTranslations('Quotes');
  const tu = useTranslations('Legal.firmRules.units');
  const date = useQuoteDate();
  const format = useFormatter();
  const money = useQuoteMoney();
  const term = (v: QuoteVersionDto): string | null =>
    hasStructuredTerm(v)
      ? v.deliveryTermUnit === 'WORKING_DAYS'
        ? tu('workingDay', { n: v.deliveryTermValue! })
        : t('builder.termWeeks', { n: v.deliveryTermValue! })
      : v.deliveryTerm || null;
  return {
    term,
    // termen + data livrarii ("6 săptămâni · până la 3 martie 2027")
    delivery: (v: QuoteVersionDto): string =>
      [term(v), v.deliveryDate ? t('deliveryBy', { date: date(v.deliveryDate) }) : null]
        .filter(Boolean)
        .join(' · '),
    warranty: (v: QuoteVersionDto): string | null =>
      v.warrantyMonths != null ? tu('month', { n: v.warrantyMonths }) : v.warranty || null,
    // "Prețul include TVA" / "Nu include TVA · cu TVA (21%): 13.915,00 lei" / "Firma nu e plătitoare
    // de TVA"; null pe variantele vechi. Suma cu TVA e a totalului (pret + proiectare), calculata
    // de server (aceeasi cifra ca in tabel si PDF); interfata nu aplica singura cota.
    vat: (v: QuoteVersionDto): string | null => {
      if (!v.vatMode) return null;
      const withVat = v.totalWithVat;
      if (v.vatMode !== 'VAT_EXCLUDED' || withVat == null) return t(`vatShown.${v.vatMode}`);
      const rate = v.vatRatePercent != null ? format.number(v.vatRatePercent, { maximumFractionDigits: 2 }) : '—';
      return t('vatShown.excludedWithTotal', { rate, amount: money(withVat, v.currency) });
    },
    // "Transport inclus · Montaj neinclus"; null pe variantele vechi (fara bife)
    included: (v: QuoteVersionDto): string | null => {
      if (v.includesTransport == null && v.includesAssembly == null) return null;
      return [
        t(v.includesTransport ? 'includedShown.transportYes' : 'includedShown.transportNo'),
        t(v.includesAssembly ? 'includedShown.assemblyYes' : 'includedShown.assemblyNo'),
      ].join(' · ');
    },
  };
}
