import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import ro from '../../../messages/ro.json';
import { DatePartsField, dateIssue, joinDateParts, splitDateParts } from './date-parts-field';

// g2 (etapa 12): campul zi / luna / an care inlocuieste campul nativ type="date" (mm/dd/yyyy).

describe('dateIssue / joinDateParts — validarea pe text, fara fus orar', () => {
  it('26.11.2026 → 2026-11-26, valida', () => {
    const v = joinDateParts('2026', '11', '26');
    expect(v).toBe('2026-11-26');
    expect(dateIssue(v)).toBeNull();
  });

  it('31.02 e respins; 29.02 doar in an bisect', () => {
    expect(dateIssue('2026-02-31')).toBe('invalid');
    expect(dateIssue('2026-04-31')).toBe('invalid');
    expect(dateIssue('2027-02-29')).toBe('invalid');
    expect(dateIssue('2028-02-29')).toBeNull();
    expect(dateIssue('2026-12-31')).toBeNull();
  });

  it('gol = fara data; incomplet = mesaj', () => {
    expect(joinDateParts('', '', '')).toBe('');
    expect(dateIssue('')).toBeNull();
    expect(dateIssue(undefined)).toBeNull();
    expect(dateIssue(joinDateParts('2026', '', '26'))).toBe('incomplete');
    expect(dateIssue(joinDateParts('', '11', ''))).toBe('incomplete');
  });

  it('partile se recitesc din valoare (si din cea incompleta)', () => {
    expect(splitDateParts('2026-11-26')).toEqual(['2026', '11', '26']);
    expect(splitDateParts('2026--26')).toEqual(['2026', '', '26']);
    expect(splitDateParts(null)).toEqual(['', '', '']);
  });
});

const YEAR = String(
  Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric' }).format(new Date())) + 1,
);

function Harness({ locale, initial = '' }: { locale: 'ro' | 'en'; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en} timeZone="UTC">
      <DatePartsField label="Data livrării" value={value} onChange={setValue} issue={dateIssue(value)} />
      <output data-testid="value">{value}</output>
    </NextIntlClientProvider>
  );
}

const value = () => screen.getByTestId('value').textContent;

describe('DatePartsField', () => {
  it('ro: grup cu nume, trei selectii, lunile in romana; alegerea scrie AAAA-LL-ZZ', () => {
    render(<Harness locale="ro" />);
    const group = screen.getByRole('group', { name: 'Data livrării' });
    const day = within(group).getByRole('combobox', { name: ro.DateField.day });
    const month = within(group).getByRole('combobox', { name: ro.DateField.month });
    const year = within(group).getByRole('combobox', { name: ro.DateField.year });
    expect(within(month).getByRole('option', { name: 'noiembrie' })).toBeInTheDocument();

    fireEvent.change(day, { target: { value: '26' } });
    expect(screen.getByText(ro.DateField.incomplete)).toBeInTheDocument();
    expect(day).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(month, { target: { value: '11' } });
    fireEvent.change(year, { target: { value: YEAR } });
    expect(value()).toBe(`${YEAR}-11-26`);
    expect(screen.queryByText(ro.DateField.incomplete)).not.toBeInTheDocument();
    expect(day).not.toHaveAttribute('aria-invalid');
  });

  it('31 februarie → mesajul „nu există”', () => {
    render(<Harness locale="ro" initial={`${YEAR}-02-`} />);
    fireEvent.change(screen.getByRole('combobox', { name: ro.DateField.day }), { target: { value: '31' } });
    expect(value()).toBe(`${YEAR}-02-31`);
    expect(screen.getByText(ro.DateField.invalid)).toBeInTheDocument();
  });

  it('en: lunile in engleza; „Clear date” goleste tot campul', () => {
    render(<Harness locale="en" initial={`${YEAR}-11-26`} />);
    const month = screen.getByRole('combobox', { name: en.DateField.month }) as HTMLSelectElement;
    expect(month.selectedOptions[0].textContent).toBe('November');
    fireEvent.click(screen.getByRole('button', { name: en.DateField.clear }));
    expect(value()).toBe('');
    expect(screen.queryByRole('button', { name: en.DateField.clear })).not.toBeInTheDocument();
  });

  it('o data precompletata dintr-un an din afara listei ramane aleasa', () => {
    render(<Harness locale="ro" initial="2040-03-15" />);
    const year = screen.getByRole('combobox', { name: ro.DateField.year }) as HTMLSelectElement;
    expect(year.value).toBe('2040');
  });
});
