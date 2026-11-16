'use client';

import {
  APPROX_LENGTH_DECIMALS,
  APPROX_LENGTH_MAX_M,
  APPROX_LENGTH_MIN_M,
  approxLengthApplies,
  hasAtMostDecimals,
} from '@marketplace/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDecimal } from '@/lib/decimal';
import { useConfiguratorStore, type RoomInstance } from '@/stores/configurator-store';
import { useDecimalField } from './use-decimal-field';

// d3 (PO d3-2, 2026-11-13): cu "Am deja un proiect" pasii de dimensiuni se sar, iar camera ar
// conta ca "sub 2 m" la costul preluarii. Campul optional "Lungime aproximativa (m)" apare doar
// cand fluxul camerei are (cu raspunsurile de acum) un pas de dimensiuni cu metri liniari si
// lungimea din dimensiuni e 0 (revizuire m10: dimensiunile ramase ascunse au prioritate, deci
// campul nu apare — altfel clientul ar scrie o valoare care nu conteaza). Aceeasi regula ca serverul.
export function needsApproxLength(room: Pick<RoomInstance, 'roomType' | 'flowVersion' | 'answers'>, hasOwnProject: boolean): boolean {
  return hasOwnProject && approxLengthApplies(room.roomType, room.answers, room.flowVersion);
}

// Randul din Sumar: "Lungime aproximativa: 6,5 m" (formatat dupa limba aplicatiei).
export function ApproxLengthNote({ value }: { value: number }) {
  const t = useTranslations('Configurator');
  const locale = useLocale();
  return (
    <p data-review-approx-length className="px-1 font-mono text-xs text-muted-foreground">
      {t('roomSpec.approxLength', { m: formatDecimal(value, locale, 2) })}
    </p>
  );
}

export function ApproxLengthField({ room }: { room: Pick<RoomInstance, 'localId' | 'approxLengthM'> }) {
  const t = useTranslations('Configurator');
  const locale = useLocale();
  const id = useId();
  const setRoomApproxLength = useConfiguratorStore((s) => s.setRoomApproxLength);
  const range = `${formatDecimal(APPROX_LENGTH_MIN_M, locale, 2)}–${formatDecimal(APPROX_LENGTH_MAX_M, locale, 2)} m`;
  // m7: cel mult 2 zecimale (ca serverul); mai multe = mesaj pe camp si nicio valoare trimisa
  // (ce vede clientul e ce se trimite — nu rotunjim pe tacute)
  const field = useDecimalField({
    value: room.approxLengthM,
    commitOn: 'change',
    maxFractionDigits: APPROX_LENGTH_DECIMALS,
    validate: (v) => {
      if (v < APPROX_LENGTH_MIN_M || v > APPROX_LENGTH_MAX_M) return t('validation.dimensionRange', { range });
      if (!hasAtMostDecimals(v, APPROX_LENGTH_DECIMALS)) return t('validation.approxLengthTooManyDecimals');
      return null;
    },
    onValue: (v) => setRoomApproxLength(room.localId, v === undefined ? null : v),
  });
  const hintId = `${id}-hint`;

  return (
    <div data-approx-length-field className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border-2 bg-surface-2/50 p-4">
      <Label htmlFor={id}>{t('approxLength.label')}</Label>
      <div className="relative max-w-40">
        <Input
          id={id}
          {...field.inputProps}
          aria-describedby={hintId}
          className={field.error ? 'border-crimson pr-8' : 'pr-8'}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">m</span>
      </div>
      {field.error ? (
        <p id={hintId} role="alert" className="text-xs text-crimson">{field.error}</p>
      ) : (
        <p id={hintId} className="text-xs text-muted-foreground">{t('approxLength.hint')}</p>
      )}
    </div>
  );
}
