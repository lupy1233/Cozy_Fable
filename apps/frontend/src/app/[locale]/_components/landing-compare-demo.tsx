import type { QuoteVatMode } from '@marketplace/shared';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { formatLei } from '@/lib/money';
import { cn } from '@/lib/utils';
import { COMPARE_ROW_KEYS, type CompareRowKey } from './offer-compare-rows';

// Tabelul-exemplu din hero-ul primei pagini (a3, etapa 4): aceleasi rubrici, cu aceleasi
// etichete (Quotes.compare.*) si in aceeasi ordine ca tabelul real de comparare.
// Proiectarea lipseste: exemplul e o bucatarie fara proiectare cu plata, iar in tabelul real
// rubrica apare doar la cererile cu proiectare cu plata.
// Cifrele sunt ilustrative si scrise ca atare (nu se calculeaza nimic): firma B are pretul de
// pornire cel mai mic, dar fara TVA iese mai scumpa — exact ce arata tabelul real.

type DemoVat = QuoteVatMode;
type DemoFirm = {
  key: 'firmA' | 'firmB' | 'firmC';
  price: number;
  vat: DemoVat;
  totalWithVat: number;
  term: { weeks: number } | { workingDays: number };
  workingDays: number;
  months: number;
  transport: boolean;
  assembly: boolean;
  validDays: number;
};

export const DEMO_FIRMS: DemoFirm[] = [
  { key: 'firmA', price: 13900, vat: 'VAT_INCLUDED', totalWithVat: 13900, term: { weeks: 6 }, workingDays: 30, months: 24, transport: true, assembly: true, validDays: 14 },
  { key: 'firmB', price: 11400, vat: 'VAT_EXCLUDED', totalWithVat: 13794, term: { weeks: 8 }, workingDays: 40, months: 12, transport: true, assembly: false, validDays: 14 },
  { key: 'firmC', price: 12900, vat: 'NOT_VAT_PAYER', totalWithVat: 12900, term: { workingDays: 35 }, workingDays: 35, months: 24, transport: false, assembly: true, validDays: 10 },
];

// rubricile exemplului = rubricile tabelului real, fara proiectare
export const DEMO_ROW_KEYS = COMPARE_ROW_KEYS.filter((k) => k !== 'design');

export function LandingCompareDemo() {
  const t = useTranslations('LandingV2.compare');
  const tc = useTranslations('Quotes.compare');
  const locale = useLocale();

  const lowest = Math.min(...DEMO_FIRMS.map((f) => f.totalWithVat));
  const fastest = Math.min(...DEMO_FIRMS.map((f) => f.workingDays));

  const cell = 'border-b border-border px-4 py-3.5 text-left align-top font-normal sm:px-5 sm:py-4';
  // coloana cu cel mai mic total cu TVA e evidentiata pe toata inaltimea tabelului
  const col = (f: DemoFirm) => (f.totalWithVat === lowest ? 'bg-surface-2' : undefined);
  const value = 'font-mono text-ui';
  const sub = 'text-meta text-muted-foreground';
  const best = 'rounded-full bg-sage-soft px-2 py-px text-xs font-medium text-sage';
  const vatLabel: Record<DemoVat, string> = {
    VAT_INCLUDED: tc('vatIncluded'),
    VAT_EXCLUDED: tc('vatExcluded'),
    NOT_VAT_PAYER: tc('vatNotPayer'),
  };

  const rows: Record<Exclude<CompareRowKey, 'design'>, (f: DemoFirm) => ReactNode> = {
    price: (f) => <span className={value}>{formatLei(f.price, locale)}</span>,
    vat: (f) => vatLabel[f.vat],
    totalLeiVat: (f) => (
      <span className="flex flex-col items-start gap-1.5">
        <span className={cn(value, f.totalWithVat === lowest && 'font-medium')}>{formatLei(f.totalWithVat, locale)}</span>
        {f.totalWithVat === lowest && <span className={best}>{tc('lowest')}</span>}
      </span>
    ),
    term: (f) => (
      <span className="flex flex-col items-start gap-1">
        <span className={cn(value, f.workingDays === fastest && 'font-medium')}>
          {'weeks' in f.term ? tc('weeks', { n: f.term.weeks }) : tc('workingDays', { n: f.term.workingDays })}
        </span>
        {'weeks' in f.term && (
          <span className={sub}>{tc('termEquals', { days: tc('workingDays', { n: f.workingDays }) })}</span>
        )}
        {f.workingDays === fastest && <span className={best}>{tc('fastest')}</span>}
      </span>
    ),
    warranty: (f) => <span className={value}>{tc('months', { n: f.months })}</span>,
    transport: (f) => (f.transport ? tc('included') : <span className="text-muted-foreground">{tc('notIncluded')}</span>),
    assembly: (f) => (f.assembly ? tc('included') : <span className="text-muted-foreground">{tc('notIncluded')}</span>),
    status: (f) => t('validFor', { n: f.validDays }),
  };

  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <span className="heading-card">{t('title')}</span>
        <span className="font-mono text-meta uppercase tracking-[0.05em] text-muted-foreground">{t('example')}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] border-collapse">
          <thead>
            <tr>
              <th scope="col" className={cn(cell, 'w-[22%]')}>
                <span className="label">{tc('field')}</span>
              </th>
              {DEMO_FIRMS.map((f) => (
                <th key={f.key} scope="col" className={cn(cell, 'font-medium', col(f))}>
                  {t(f.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEMO_ROW_KEYS.map((key, i) => {
              const last = i === DEMO_ROW_KEYS.length - 1;
              return (
                <tr key={key}>
                  <th scope="row" className={cn(cell, 'text-muted-foreground', last && 'border-b-0')}>
                    {tc(key)}
                  </th>
                  {DEMO_FIRMS.map((f) => (
                    <td key={f.key} className={cn(cell, last && 'border-b-0', col(f))}>
                      {rows[key as Exclude<CompareRowKey, 'design'>](f)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <figcaption className="border-t border-border bg-surface-2 px-4 py-3.5 text-ui text-muted-foreground sm:px-5">
        {t('caption')}
      </figcaption>
    </figure>
  );
}
