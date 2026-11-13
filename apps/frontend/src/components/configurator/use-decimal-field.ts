'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { formatDecimal, parseDecimal } from '@/lib/decimal';

// Camp de dimensiune cu virgula (b1): type=text + inputMode=decimal (tastatura
// numerica cu virgula pe telefon), ciorna locala a textului tastat si citire
// prin parseDecimal. Valoarea salvata ramane numar.
//
// commitOn:
// - 'change' (camerele): scrie in ciorna formularului la fiecare tasta, DOAR
//   cand textul se poate citi; altfel ramane textul + mesajul "Scrie un numar".
// - 'blur' (3D): scrie la blur / Enter; o valoare refuzata (text invalid sau
//   in afara intervalului) NU se taie pe tacute — ramane valoarea veche si
//   apare mesajul langa camp.
// Campurile din 3D lucreaza in cm, limitele pieselor sunt in metri.
export function inRangeCm(valueCm: number, minM: number, maxM: number): boolean {
  const m = valueCm / 100;
  return m >= minM - 1e-9 && m <= maxM + 1e-9;
}

export function cmRangeText(minM: number, maxM: number, locale: string): string {
  return `${formatDecimal(minM * 100, locale, 1)}–${formatDecimal(maxM * 100, locale, 1)} cm`;
}

export interface DecimalFieldOptions {
  value: number | undefined;
  onValue: (value: number | undefined) => void;
  commitOn: 'change' | 'blur';
  // mesaj de refuz pentru o valoare citita (ex. in afara intervalului); null = ok
  validate?: (value: number) => string | null;
  maxFractionDigits?: number;
  // 'blur': campul golit pastreaza valoarea veche (nu se poate goli)
  allowEmpty?: boolean;
}

export function useDecimalField({
  value,
  onValue,
  commitOn,
  validate,
  maxFractionDigits = 4,
  allowEmpty = commitOn === 'change',
}: DecimalFieldOptions) {
  const locale = useLocale();
  const t = useTranslations('Configurator');
  const [draft, setDraft] = useState<string | null>(null);
  const [blurError, setBlurError] = useState<string | null>(null);

  const shown = value === undefined || !Number.isFinite(value) ? '' : formatDecimal(value, locale, maxFractionDigits);

  // mesajul pentru un text: null = se poate scrie in raspuns
  const problemOf = (raw: string): string | null => {
    const parsed = parseDecimal(raw);
    if (parsed.kind === 'invalid') return t('validation.notANumber');
    if (parsed.kind === 'empty') return null;
    return validate?.(parsed.value) ?? null;
  };

  const changeError = commitOn === 'change' && draft !== null ? problemOf(draft) : null;

  const reset = () => {
    setDraft(null);
    setBlurError(null);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDraft(raw);
    if (commitOn === 'blur') {
      setBlurError(null);
      return;
    }
    // ce vede clientul e ce se trimite (m7): textul gol SAU nevalid goleste
    // raspunsul, ca validarea pasului sa opreasca "Continua" la campul obligatoriu
    const parsed = parseDecimal(raw);
    onValue(parsed.kind === 'number' && !validate?.(parsed.value) ? parsed.value : undefined);
  };

  const commitBlur = (raw: string) => {
    const parsed = parseDecimal(raw);
    setDraft(null);
    if (parsed.kind === 'empty') {
      if (allowEmpty) onValue(undefined);
      setBlurError(null);
      return;
    }
    const problem = problemOf(raw);
    setBlurError(problem);
    if (!problem && parsed.kind === 'number') onValue(parsed.value);
  };

  const onBlur = () => {
    if (draft === null) return;
    if (commitOn === 'blur') commitBlur(draft);
    // 'change': textul citit se reformateaza; textul invalid ramane cu mesajul
    else if (!changeError) setDraft(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (commitOn !== 'blur') return;
    if (e.key === 'Enter') e.currentTarget.blur();
    else if (e.key === 'Escape') reset();
  };

  const error = commitOn === 'blur' ? blurError : changeError;

  return {
    error,
    reset,
    inputProps: {
      type: 'text' as const,
      // fara atributul pattern (m6): validarea nativa a browserului ar putea
      // marca / bloca un text pe care parseDecimal il accepta (ex. spatii);
      // inputMode ajunge pentru tastatura numerica cu virgula
      inputMode: 'decimal' as const,
      autoComplete: 'off',
      value: draft ?? shown,
      onChange,
      onBlur,
      onKeyDown,
      'aria-invalid': error ? true : undefined,
    },
  };
}
