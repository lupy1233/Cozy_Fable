'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { MAX_QUOTE_VERSIONS } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { APP_TIME_ZONE } from '@/lib/sla-deadline';
import { cn } from '@/lib/utils';
import { useCreateQuote, useExtraVersion, useReoffer, useReviseQuote } from '@/hooks/use-quotes';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// Numerele optionale vin din inputuri ca '' cand sunt goale; z.coerce le facea
// 0 → pica positive() FARA mesaj afisat si formularul nu se trimitea deloc
// (bug F7: "firma nu poate raspunde"). Golul devine explicit undefined.
const optionalPositive = (int = false) =>
  z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    (int ? z.number().int() : z.number()).positive().optional(),
  );

const TERM_UNITS = ['WEEKS', 'WORKING_DAYS'] as const;

// Design 2026-11: fiecare camp are unitatea langa el. Termenul de livrare si garantia se
// completeaza ca numar + unitate si pleaca spre API tot ca text ("8 saptamani", "12 luni") —
// contractul ofertei (deliveryTerm / warranty = string) ramane neschimbat.
const formSchema = z.object({
  price: z.coerce.number().positive(),
  designFee: optionalPositive(),
  currency: z.enum(['RON', 'EUR']).optional(),
  deliveryTermValue: optionalPositive(true),
  deliveryTermUnit: z.enum(TERM_UNITS).optional(),
  deliveryDate: z.string().optional(),
  warrantyMonths: optionalPositive(true),
  description: z.string().min(1),
  validityDays: optionalPositive(true),
});
type FormValues = z.input<typeof formSchema>;

// camerele cererii, pentru defalcarea pretului (F7, item 22)
type OfferRoom = { id: string; roomType: string };
type OfferCurrency = 'RON' | 'EUR';

type Props = (
  | { kind: 'create'; claimSlotId: string; includesPaidDesign: boolean; onDone?: () => void }
  | { kind: 'revise'; quoteId: string; changeRequestId: string; includesPaidDesign: boolean; onDone?: () => void }
  | { kind: 'extra'; quoteId: string; includesPaidDesign: boolean; onDone?: () => void }
  | { kind: 'reoffer'; quoteId: string; includesPaidDesign: boolean; onDone?: () => void }
) & {
  rooms?: OfferRoom[];
  // moneda ofertei existente (revise / extra / reoffer) — unitatea de langa campurile de pret;
  // la 'create' unitatea urmeaza moneda aleasa in formular
  currency?: OfferCurrency;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function OfferBuilder(props: Props) {
  const t = useTranslations('Quotes');
  const tc = useTranslations('Configurator');
  const tu = useTranslations('Legal.firmRules.units');
  const format = useFormatter();
  const uid = useId();
  const isCreate = props.kind === 'create';
  const quoteId = props.kind === 'create' ? '' : props.quoteId;
  const create = useCreateQuote();
  const revise = useReviseQuote(quoteId);
  const extra = useExtraVersion(quoteId);
  const reoffer = useReoffer(quoteId);
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });
  const pickedCurrency = useWatch({ control, name: 'currency' });
  const validityRaw = useWatch({ control, name: 'validityDays' });

  // unitatea de langa sume: moneda aleasa (create) sau moneda ofertei (daca apelantul o da)
  const currency: OfferCurrency | undefined = isCreate ? (pickedCurrency ?? 'RON') : props.currency;
  const moneyUnit = currency ? t(`builder.unit.${currency}`) : undefined;

  // "Valabila pana la ..." — doar cand firma a scris un numar de zile (altfel se aplica implicitul din setari)
  const validityDays = Number(validityRaw);
  const validUntil =
    Number.isInteger(validityDays) && validityDays > 0 && validityDays <= 365
      ? format.dateTime(new Date(Date.now() + validityDays * DAY_MS), {
          dateStyle: 'long',
          timeZone: APP_TIME_ZONE,
        })
      : null;

  // Defalcare pe camere (F7): cand TOATE camerele au pret, totalul se
  // calculeaza singur si campul de pret se blocheaza pe suma.
  const rooms = props.rooms ?? [];
  const [roomPrices, setRoomPrices] = useState<Record<string, string>>({});
  const filled = rooms.filter((r) => Number(roomPrices[r.id]) > 0);
  const allFilled = rooms.length > 0 && filled.length === rooms.length;
  const partial = filled.length > 0 && !allFilled;

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
    const termValue = v.deliveryTermValue ? Number(v.deliveryTermValue) : null;
    const warrantyMonths = v.warrantyMonths ? Number(v.warrantyMonths) : null;
    const base = {
      price: Number(v.price),
      designFee: v.designFee ? Number(v.designFee) : undefined,
      deliveryTerm: termValue
        ? v.deliveryTermUnit === 'WORKING_DAYS'
          ? tu('workingDay', { n: termValue })
          : t('builder.termWeeks', { n: termValue })
        : undefined,
      deliveryDate: v.deliveryDate || undefined,
      warranty: warrantyMonths ? tu('month', { n: warrantyMonths }) : undefined,
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

  const title =
    props.kind === 'create'
      ? t('builder.createTitle')
      : props.kind === 'revise'
        ? t('builder.reviseTitle')
        : props.kind === 'extra'
          ? t('builder.extraTitle')
          : t('builder.reofferTitle');
  // oferta noua = cardul principal al fisei (h2); variantele ulterioare stau in cardul ofertei (h3)
  const TitleTag = isCreate ? 'h2' : 'h3';
  const ids = {
    title: `${uid}-title`,
    price: `${uid}-price`,
    fee: `${uid}-fee`,
    term: `${uid}-term`,
    date: `${uid}-date`,
    warranty: `${uid}-warranty`,
    validity: `${uid}-validity`,
    currency: `${uid}-currency`,
    desc: `${uid}-desc`,
    descHint: `${uid}-desc-hint`,
  };

  // randul pretului: total calculat din camere (blocat) sau pret unic scris de firma
  const priceRow = (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface-2 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Label htmlFor={ids.price} className="text-sm font-semibold">
          {t('builder.price')}
        </Label>
        <UnitInput
          id={ids.price}
          type="number"
          step="0.01"
          inputMode="decimal"
          {...register('price')}
          readOnly={allFilled}
          title={allFilled ? t('builder.priceLocked') : undefined}
          unit={moneyUnit}
          wrapperClassName="shrink-0"
          className="w-32 flex-none text-right font-mono read-only:cursor-default read-only:font-medium"
        />
      </div>
      {errors.price && <p className="text-xs text-crimson">{t('validation.priceInvalid')}</p>}
      {partial && <p className="text-xs text-amber">{t('builder.roomPricesPartial')}</p>}
    </div>
  );

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      aria-labelledby={ids.title}
      className={cn(
        'flex flex-col',
        isCreate
          ? 'gap-6 rounded-xl border border-border bg-surface p-5 shadow sm:p-7'
          : 'gap-5 rounded-lg border border-border-2 bg-surface p-4',
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
        <TitleTag id={ids.title} className={isCreate ? 'font-serif text-2xl' : 'heading-card'}>
          {title}
        </TitleTag>
        {isCreate && (
          <span className="text-ui text-muted-foreground">
            {t('builder.versionOf', { n: 1, max: MAX_QUOTE_VERSIONS })}
          </span>
        )}
      </div>

      {/* pret per camera (F7, item 22): total calculat automat */}
      {rooms.length > 0 ? (
        <fieldset className="flex min-w-0 flex-col gap-2.5">
          <legend className="mb-2.5 text-sm font-semibold">{t('builder.roomPrices')}</legend>
          {rooms.map((r, i) => {
            const roomId = `${uid}-room-${r.id}`;
            return (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <label htmlFor={roomId} className="min-w-0 flex-[1_1_200px] text-sm">
                  {i + 1}. {tc(`rooms.type.${r.roomType}`)}
                </label>
                <UnitInput
                  id={roomId}
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={roomPrices[r.id] ?? ''}
                  onChange={(e) => setRoomPrice(r.id, e.target.value)}
                  placeholder="0"
                  unit={moneyUnit}
                  wrapperClassName="shrink-0"
                  className="w-32 flex-none text-right font-mono"
                />
              </div>
            );
          })}
          {priceRow}
        </fieldset>
      ) : (
        priceRow
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-5">
        {props.includesPaidDesign && (
          <Field
            label={t('builder.designFee')}
            htmlFor={ids.fee}
            error={errors.designFee ? t('validation.amountInvalid') : undefined}
          >
            <UnitInput
              id={ids.fee}
              type="number"
              step="0.01"
              inputMode="decimal"
              {...register('designFee')}
              unit={moneyUnit}
            />
          </Field>
        )}
        <Field
          label={t('builder.deliveryTerm')}
          htmlFor={ids.term}
          error={errors.deliveryTermValue ? t('validation.wholeNumber') : undefined}
        >
          <div className="flex gap-2">
            <Input
              id={ids.term}
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              {...register('deliveryTermValue')}
              className="h-11 w-20 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <Select
                aria-label={t('builder.termUnitLabel')}
                defaultValue="WEEKS"
                {...register('deliveryTermUnit')}
                className="h-11"
              >
                {TERM_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {t(`builder.termUnit.${u}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Field>
        <Field label={t('builder.deliveryDate')} htmlFor={ids.date}>
          <Input id={ids.date} type="date" {...register('deliveryDate')} className="h-11" />
        </Field>
        <Field
          label={t('builder.warranty')}
          htmlFor={ids.warranty}
          error={errors.warrantyMonths ? t('validation.wholeNumber') : undefined}
        >
          <UnitInput
            id={ids.warranty}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            {...register('warrantyMonths')}
            unit={t('builder.unitMonths')}
          />
        </Field>
        <Field
          label={t('builder.validity')}
          htmlFor={ids.validity}
          error={errors.validityDays ? t('validation.wholeNumber') : undefined}
          hint={validUntil ? t('validUntil', { date: validUntil }) : undefined}
        >
          <UnitInput
            id={ids.validity}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            {...register('validityDays')}
            placeholder="14"
            unit={t('builder.unitDays')}
          />
        </Field>
        {isCreate && (
          <Field label={t('builder.currency')} htmlFor={ids.currency}>
            <Select id={ids.currency} defaultValue="RON" {...register('currency')} className="h-11">
              <option value="RON">RON</option>
              <option value="EUR">EUR</option>
            </Select>
          </Field>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={ids.desc}>{t('builder.description')}</Label>
        <Textarea id={ids.desc} rows={4} aria-describedby={ids.descHint} {...register('description')} />
        {errors.description && <p className="text-xs text-crimson">{t('validation.descriptionRequired')}</p>}
        <p id={ids.descHint} className="text-xs text-muted-foreground">
          {t('builder.descriptionHint')}
        </p>
      </div>

      {apiErr && (
        <p role="alert" className="text-sm text-crimson">
          {t.has(`apiErrors.${apiErr}`) ? t(`apiErrors.${apiErr}`) : t('apiErrors.INTERNAL_ERROR')}
        </p>
      )}

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-x-6 gap-y-3',
          isCreate && 'border-t border-border pt-5',
        )}
      >
        {isCreate && <p className="max-w-sm text-ui text-muted-foreground">{t('builder.createNote')}</p>}
        <Button
          type="submit"
          variant={isCreate ? 'walnut' : 'default'}
          size={isCreate ? 'xl' : 'lg'}
          disabled={active.isPending || partial}
        >
          {isCreate ? t('builder.submitCreate') : t('builder.submit')}
        </Button>
      </div>
    </form>
  );
}

// Camp cu unitatea lipita in dreapta (lei, luni, zile). Unitatea e legata de input prin
// aria-describedby, deci numele accesibil al campului ramane eticheta lui.
const UnitInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { unit?: string; wrapperClassName?: string }
>(function UnitInput({ unit, wrapperClassName, className, id, ...props }, ref) {
  const unitId = unit && id ? `${id}-unit` : undefined;
  return (
    <div
      className={cn(
        'flex h-11 items-center rounded-md border border-border-2 bg-surface transition-colors',
        'focus-within:border-foreground focus-within:ring-2 focus-within:ring-foreground/5',
        'has-[input:read-only]:border-transparent has-[input:read-only]:bg-transparent',
        wrapperClassName,
      )}
    >
      <input
        ref={ref}
        id={id}
        aria-describedby={unitId}
        className={cn(
          'h-10 min-w-0 flex-1 rounded-md bg-transparent px-3 text-sm placeholder:text-muted-2 focus-visible:outline-none',
          className,
        )}
        {...props}
      />
      {unit && (
        <span id={unitId} className="shrink-0 pr-3 text-sm text-muted-foreground">
          {unit}
        </span>
      )}
    </div>
  );
});
