'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { formatDecimal, parseDecimal } from '@/lib/decimal';

// b7: campurile de dimensiune din pasul 3D (in cm). Spre deosebire de b1
// (valoarea in afara intervalului era refuzata), valoarea se CORECTEAZA si
// spunem ce am facut: "Minimul e 60 cm — am pus 60"; campul golit pastreaza
// valoarea veche cu mesaj; "1,2" (sub 10, cu virgula sau punct) = metri → 120 cm.

export type DimensionRead =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | {
      kind: 'number';
      // valoarea finala, in cm (dupa citirea ca metri si corectarea la limite)
      valueCm: number;
      // valoarea citita, inainte de corectare (cm)
      readCm: number;
      meters: boolean;
      clamped: 'min' | 'max' | null;
    };

const round1 = (v: number) => Math.round(v * 10) / 10;

// Citirea pura a textului (testabila fara React).
export function readDimensionCm(raw: string, minCm?: number, maxCm?: number): DimensionRead {
  const parsed = parseDecimal(raw);
  if (parsed.kind !== 'number') return parsed;
  // metri DOAR daca rezultatul (x100) intra in limitele campului; altfel
  // ramane in cm si primeste corectarea obisnuita ("8,5" la un rand ≠ 850 cm)
  const asMetersCm = round1(parsed.value * 100);
  const meters =
    parsed.value < 10 &&
    /[.,]/.test(raw) &&
    (minCm === undefined || asMetersCm >= minCm - 1e-9) &&
    (maxCm === undefined || asMetersCm <= maxCm + 1e-9);
  const readCm = meters ? asMetersCm : round1(parsed.value);
  let valueCm = readCm;
  let clamped: 'min' | 'max' | null = null;
  if (minCm !== undefined && valueCm < minCm - 1e-9) {
    valueCm = minCm;
    clamped = 'min';
  } else if (maxCm !== undefined && valueCm > maxCm + 1e-9) {
    valueCm = maxCm;
    clamped = 'max';
  }
  return { kind: 'number', valueCm, readCm, meters, clamped };
}

export function useDimensionField({
  valueCm,
  minCm,
  maxCm,
  onValueCm,
}: {
  valueCm: number;
  minCm?: number;
  maxCm?: number;
  onValueCm: (valueCm: number) => void;
}) {
  const locale = useLocale();
  const t = useTranslations('Configurator');
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // regiunea de mesaje (role=status) sta montata mereu, legata de camp, ca
  // cititoarele de ecran sa anunte corectarea cand apare
  const noteId = useId();
  const fmt = (v: number) => formatDecimal(v, locale, 1);

  const reset = () => {
    setDraft(null);
    setError(null);
    setNote(null);
  };

  const commit = (raw: string) => {
    setDraft(null);
    const read = readDimensionCm(raw, minCm, maxCm);
    if (read.kind === 'empty') {
      setError(null);
      setNote(t('config3d.dimKeptPrevious'));
      return;
    }
    if (read.kind === 'invalid') {
      setNote(null);
      setError(t('validation.notANumber'));
      return;
    }
    // fara minim cunoscut (randuri/coloane): 0 sau mai putin nu are sens
    if (read.valueCm <= 0) {
      setNote(null);
      setError(t('validation.positiveNumber'));
      return;
    }
    const parts: string[] = [];
    if (read.meters) parts.push(t('config3d.dimReadAsMeters', { value: fmt(read.readCm) }));
    if (read.clamped === 'min') parts.push(t('config3d.dimClampedMin', { value: fmt(read.valueCm) }));
    if (read.clamped === 'max') parts.push(t('config3d.dimClampedMax', { value: fmt(read.valueCm) }));
    setError(null);
    setNote(parts.length > 0 ? parts.join(' ') : null);
    onValueCm(read.valueCm);
  };

  return {
    error,
    note,
    noteId,
    reset,
    inputProps: {
      type: 'text' as const,
      inputMode: 'decimal' as const,
      autoComplete: 'off',
      value: draft ?? (Number.isFinite(valueCm) ? fmt(valueCm) : ''),
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        setDraft(e.target.value);
        setError(null);
        setNote(null);
      },
      onBlur: () => {
        if (draft !== null) commit(draft);
      },
      onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') reset();
      },
      'aria-invalid': error ? true : undefined,
      'aria-describedby': noteId,
    },
  };
}
