'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { useCreateQuote, useExtraVersion, useReoffer, useReviseQuote } from '@/hooks/use-quotes';

// Numerele optionale vin din inputuri ca '' cand sunt goale; z.coerce le facea
// 0 → pica positive() FARA mesaj afisat si formularul nu se trimitea deloc
// (bug F7: "firma nu poate raspunde"). Golul devine explicit undefined.
const optionalPositive = (int = false) =>
  z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    (int ? z.number().int() : z.number()).positive().optional(),
  );

const formSchema = z.object({
  price: z.coerce.number().positive(),
  designFee: optionalPositive(),
  currency: z.enum(['RON', 'EUR']).optional(),
  deliveryTerm: z.string().optional(),
  deliveryDate: z.string().optional(),
  warranty: z.string().optional(),
  description: z.string().min(1),
  validityDays: optionalPositive(true),
});
type FormValues = z.input<typeof formSchema>;

// camerele cererii, pentru defalcarea pretului (F7, item 22)
type OfferRoom = { id: string; roomType: string };

type Props = (
  | { kind: 'create'; claimSlotId: string; includesPaidDesign: boolean; onDone?: () => void }
  | { kind: 'revise'; quoteId: string; changeRequestId: string; includesPaidDesign: boolean; onDone?: () => void }
  | { kind: 'extra'; quoteId: string; includesPaidDesign: boolean; onDone?: () => void }
  | { kind: 'reoffer'; quoteId: string; includesPaidDesign: boolean; onDone?: () => void }
) & { rooms?: OfferRoom[] };

const fmtRon = (v: number) => new Intl.NumberFormat('ro-RO').format(v);

export function OfferBuilder(props: Props) {
  const t = useTranslations('Quotes');
  const tc = useTranslations('Configurator');
  const quoteId = props.kind === 'create' ? '' : props.quoteId;
  const create = useCreateQuote();
  const revise = useReviseQuote(quoteId);
  const extra = useExtraVersion(quoteId);
  const reoffer = useReoffer(quoteId);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  // Defalcare pe camere (F7): cand TOATE camerele au pret, totalul se
  // calculeaza singur si campul de pret se blocheaza pe suma.
  const rooms = props.rooms ?? [];
  const [roomPrices, setRoomPrices] = useState<Record<string, string>>({});
  const filled = rooms.filter((r) => Number(roomPrices[r.id]) > 0);
  const allFilled = rooms.length > 0 && filled.length === rooms.length;
  const partial = filled.length > 0 && !allFilled;
  const total = useMemo(
    () => filled.reduce((acc, r) => acc + Number(roomPrices[r.id]), 0),
    [filled, roomPrices],
  );

  const setRoomPrice = (roomId: string, raw: string) => {
    const next = { ...roomPrices, [roomId]: raw };
    setRoomPrices(next);
    const nextFilled = rooms.filter((r) => Number(next[r.id]) > 0);
    if (rooms.length > 0 && nextFilled.length === rooms.length) {
      const sum = nextFilled.reduce((acc, r) => acc + Number(next[r.id]), 0);
      setValue('price', Math.round(sum * 100) / 100, { shouldValidate: true });
    }
  };

  const active =
    props.kind === 'create' ? create : props.kind === 'revise' ? revise : props.kind === 'extra' ? extra : reoffer;
  const apiErr = active.error instanceof ApiError ? active.error.code : null;

  const onSubmit = (v: FormValues) => {
    if (partial) return; // defalcare incompleta: completeaza tot sau goleste
    const base = {
      price: Number(v.price),
      designFee: v.designFee ? Number(v.designFee) : undefined,
      deliveryTerm: v.deliveryTerm || undefined,
      deliveryDate: v.deliveryDate || undefined,
      warranty: v.warranty || undefined,
      description: v.description,
      validityDays: v.validityDays ? Number(v.validityDays) : undefined,
      roomPrices: allFilled
        ? rooms.map((r) => ({ requestRoomId: r.id, price: Number(roomPrices[r.id]) }))
        : undefined,
    };
    if (props.kind === 'create') {
      create.mutate(
        { ...base, claimSlotId: props.claimSlotId, currency: v.currency },
        { onSuccess: () => props.onDone?.() },
      );
    } else if (props.kind === 'revise') {
      revise.mutate({ ...base, changeRequestId: props.changeRequestId }, { onSuccess: () => props.onDone?.() });
    } else if (props.kind === 'extra') {
      extra.mutate({ ...base }, { onSuccess: () => props.onDone?.() });
    } else {
      reoffer.mutate({ ...base }, { onSuccess: () => props.onDone?.() });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h3 className="font-serif text-lg">
        {props.kind === 'create'
          ? t('builder.createTitle')
          : props.kind === 'revise'
            ? t('builder.reviseTitle')
            : props.kind === 'extra'
              ? t('builder.extraTitle')
              : t('builder.reofferTitle')}
      </h3>

      {/* pret per camera (F7, item 22): total calculat automat */}
      {rooms.length > 0 && (
        <div className="rounded-lg border border-border-2 bg-surface-2 p-3">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            {t('builder.roomPrices')}
          </p>
          <div className="flex flex-col gap-2">
            {rooms.map((r, i) => (
              <label key={r.id} className="grid grid-cols-[1fr_9rem] items-center gap-3 text-sm">
                <span>
                  {i + 1}. {tc(`rooms.type.${r.roomType}`)}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={roomPrices[r.id] ?? ''}
                  onChange={(e) => setRoomPrice(r.id, e.target.value)}
                  placeholder="0"
                  className="input text-right"
                />
              </label>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border-2 pt-2 text-sm">
            <span className="font-medium">{t('builder.roomPricesTotal')}</span>
            <span className="font-serif text-lg tabular-nums">
              {allFilled ? fmtRon(total) : partial ? fmtRon(total) + '…' : '—'}
            </span>
          </div>
          {partial && <p className="mt-1 text-xs text-amber">{t('builder.roomPricesPartial')}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('builder.price')} error={errors.price && t('validation.priceInvalid')}>
          <input
            type="number"
            step="0.01"
            {...register('price')}
            readOnly={allFilled}
            title={allFilled ? t('builder.priceLocked') : undefined}
            className="input"
          />
        </Field>
        {props.kind === 'create' && (
          <Field label={t('builder.currency')}>
            <select {...register('currency')} className="input" defaultValue="RON">
              <option value="RON">RON</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
        )}
        {props.includesPaidDesign && (
          <Field label={t('builder.designFee')}>
            <input type="number" step="0.01" {...register('designFee')} className="input" />
          </Field>
        )}
        <Field label={t('builder.deliveryTerm')}>
          <input {...register('deliveryTerm')} className="input" />
        </Field>
        <Field label={t('builder.deliveryDate')}>
          <input type="date" {...register('deliveryDate')} className="input" />
        </Field>
        <Field label={t('builder.warranty')}>
          <input {...register('warranty')} className="input" />
        </Field>
        <Field label={t('builder.validityDays')}>
          <input type="number" {...register('validityDays')} placeholder="14" className="input" />
        </Field>
      </div>

      <Field label={t('builder.description')} error={errors.description && t('validation.descriptionRequired')}>
        <textarea {...register('description')} rows={3} className="input" />
      </Field>

      {apiErr && (
        <p className="text-sm text-crimson">
          {t.has(`apiErrors.${apiErr}`) ? t(`apiErrors.${apiErr}`) : t('apiErrors.INTERNAL_ERROR')}
        </p>
      )}

      <button
        type="submit"
        disabled={active.isPending || partial}
        className="self-start rounded-md bg-walnut px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:opacity-50"
      >
        {t('builder.submit')}
      </button>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border: 1px solid hsl(var(--border-2));
          background: hsl(var(--card));
          color: hsl(var(--foreground));
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        :global(.input:focus-visible) {
          outline: none;
          border-color: hsl(var(--foreground));
        }
      `}</style>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{label}</span>
      {children}
      {error && <span className="text-xs text-crimson">{error}</span>}
    </label>
  );
}
