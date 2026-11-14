'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useId, type Ref } from 'react';
import { Select } from '@/components/ui/select';
import { APP_TIME_ZONE } from '@/lib/sla-deadline';
import { cn } from '@/lib/utils';

// g2 (etapa 12): camp de data zi / luna / an cu trei selectii native — pe telefon deschid
// roata sistemului, iar ordinea si numele lunilor urmeaza limba APLICATIEI, nu a browserului
// (campul nativ type="date" arata mm/dd/yyyy pe un browser in engleza).
// Valoarea e un text "AAAA-LL-ZZ"; cat timp omul n-a ales tot, partile lipsa raman goale
// ("2026--26"), ca schema sa poata spune "incomplet" — nu ramane in spate o data veche.
// Nimic nu trece prin Date / fus orar: ziua aleasa e ziua trimisa.

export type DatePartsIssue = 'incomplete' | 'invalid';

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

export function splitDateParts(value: string | null | undefined): [string, string, string] {
  if (!value) return ['', '', ''];
  const [y = '', m = '', d = ''] = value.split('-');
  return [y, m, d];
}

export function joinDateParts(year: string, month: string, day: string): string {
  return year || month || day ? `${year}-${month}-${day}` : '';
}

// '' = camp gol (data e optionala); altfel o data calendaristica reala, verificata pe text
export function dateIssue(value: string | null | undefined): DatePartsIssue | null {
  if (!value) return null;
  const [y, m, d] = splitDateParts(value);
  if (!y || !m || !d) return 'incomplete';
  if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d)) return 'invalid';
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1) return 'invalid';
  // ultima zi a lunii (ziua 0 a lunii urmatoare), calcul pur UTC — fara fusul browserului
  const daysInMonth = new Date(Date.UTC(Number(y), month, 0)).getUTCDate();
  return day > daysInMonth ? 'invalid' : null;
}

function bucharestYear(): number {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric' }).format(new Date()));
}

export function DatePartsField({
  label,
  value,
  onChange,
  onBlur,
  inputRef,
  issue,
  yearsAhead = 5,
  className,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  // ref-ul formularului (react-hook-form), ca focusul la eroare sa ajunga in camp
  inputRef?: Ref<HTMLSelectElement>;
  issue?: DatePartsIssue | null;
  yearsAhead?: number;
  className?: string;
}) {
  const t = useTranslations('DateField');
  const format = useFormatter();
  const uid = useId();
  const errorId = `${uid}-error`;
  const [year, month, day] = splitDateParts(value);

  const firstYear = bucharestYear();
  const years = Array.from({ length: yearsAhead + 1 }, (_, i) => String(firstYear + i));
  // o data precompletata in afara intervalului (alt an) ramane aleasa, nu dispare
  if (year && !years.includes(year)) years.push(year);
  years.sort();

  const monthName = (m: string) =>
    format.dateTime(new Date(Date.UTC(2024, Number(m) - 1, 15)), { month: 'long', timeZone: 'UTC' });

  const invalid = issue ? true : undefined;
  const describedBy = issue ? errorId : undefined;
  const set = (y: string, m: string, d: string) => onChange(joinDateParts(y, m, d));
  // m5 (revizuire): ref-ul formularului (focus la eroare) sta pe partea care trebuie aleasa —
  // prima goala la "incomplet", altfel ziua (31.02 se repara din zi)
  // (din valoare, nu din `issue`: formularul focalizeaza inainte sa randeze eroarea)
  const focusPart = dateIssue(value) === 'incomplete' ? (!day ? 'day' : !month ? 'month' : 'year') : 'day';
  const refFor = (part: 'day' | 'month' | 'year') => (part === focusPart ? inputRef : undefined);

  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-[minmax(4.5rem,1fr)_minmax(0,2fr)_minmax(5rem,1.3fr)] gap-2">
        <Select
          ref={refFor('day')}
          aria-label={t('day')}
          value={day}
          onChange={(e) => set(year, month, e.target.value)}
          onBlur={onBlur}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="h-11"
        >
          <option value="">{t('dayPlaceholder')}</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {Number(d)}
            </option>
          ))}
        </Select>
        <Select
          ref={refFor('month')}
          aria-label={t('month')}
          value={month}
          onChange={(e) => set(year, e.target.value, day)}
          onBlur={onBlur}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="h-11"
        >
          <option value="">{t('monthPlaceholder')}</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {monthName(m)}
            </option>
          ))}
        </Select>
        <Select
          ref={refFor('year')}
          aria-label={t('year')}
          value={year}
          onChange={(e) => set(e.target.value, month, day)}
          onBlur={onBlur}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="h-11"
        >
          <option value="">{t('yearPlaceholder')}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
      {(year || month || day) && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t('clear')}
        </button>
      )}
      {issue && (
        <p id={errorId} className="text-xs text-crimson">
          {t(issue)}
        </p>
      )}
    </fieldset>
  );
}
